import { TFile, Notice, MarkdownView } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TaskSelectionAnalyzer, type TaskAnalysisResult } from './taskSelectionAnalyzer.js';

export class TimeTrackerCommands {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    /**
     * Inicia el seguimiento de tiempo con detección automática de selección de tareas
     * @param activeFile - Archivo activo donde iniciar el seguimiento
     */
    async startTrackingWithSelectionDetection(activeFile: TFile): Promise<void> {
        const taskNotePath = activeFile.path;
        
        // Obtener el editor activo
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.editor) {
            // Fallback al comportamiento original
            const taskDescription = activeFile.basename.replace('.md', '');
            await this.plugin.startTracking(taskNotePath, taskDescription);
            new Notice(`Temporizador iniciado para: ${taskDescription}`);
            return;
        }

        // Analizar la selección
        const analysis = TaskSelectionAnalyzer.extractTaskFromActiveView(activeView);
        
        if (!analysis.isValid) {
            // Caso 1: No hay selección válida - comportamiento original
            if (!analysis.errorMessage) {
                const taskDescription = activeFile.basename.replace('.md', '');
                await this.plugin.startTracking(taskNotePath, taskDescription);
                new Notice(`Temporizador iniciado para: ${taskDescription}`);
            } else {
                // Caso 2: Error en la selección
                new Notice(analysis.errorMessage);
            }
            return;
        }

        // Caso 3: Selección válida de tarea
        const taskDescription = analysis.taskContent!;
        const lineNumber = analysis.lineNumber!;
        
        // Intentar cambiar el estado de la tarea si está abierta
        let stateChanged = false;
        if (analysis.taskState === 'open' && analysis.fullLine) {
            stateChanged = TaskSelectionAnalyzer.changeTaskStateToInProgress(
                activeView.editor, 
                lineNumber, 
                analysis.fullLine
            );
        }
        
        await this.plugin.startTracking(taskNotePath, taskDescription, lineNumber);
        
        // Mostrar notice apropiado según si se cambió el estado
        if (stateChanged) {
            new Notice(`Temporizador iniciado para: ${taskDescription} (tarea marcada como en progreso)`);
        } else {
            new Notice(`Temporizador iniciado para: ${taskDescription}`);
        }
    }

    /**
     * Registra todos los comandos relacionados con el time tracker
     */
    registerCommands(): void {
        // Comando principal de iniciar temporizador
        this.plugin.addCommand({
            id: 'time-tracker-start-for-active-note',
            name: 'Control de Tiempo: Iniciar temporizador para la nota activa',
            checkCallback: (checking: boolean) => {
                const activeFile = this.plugin.app.workspace.getActiveFile();
                const isTimerRunning = !!this.plugin.activeTimer;

                if (activeFile && !isTimerRunning) {
                    if (!checking) {
                        this.startTrackingWithSelectionDetection(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });

        // Comando para modificar temporizador activo
        this.plugin.addCommand({
            id: 'time-tracker-edit-active-timer',
            name: 'Control de Tiempo: Modificar temporizador activo',
            checkCallback: (checking: boolean) => {
                console.log("Dovela PM Debug: Checking for 'edit active timer' command. Active timer is:", this.plugin.activeTimer);
                if (this.plugin.activeTimer) {
                    if (!checking) {
                        this.plugin.openEditActiveTimerModal();
                    }
                    return true;
                }
                return false;
            }
        });
    }

    /**
     * Registra los ribbon icons relacionados con el time tracker
     */
    registerRibbonIcons(): void {
        this.plugin.addRibbonIcon('play-circle', 'Iniciar temporizador', () => {
            const activeFile = this.plugin.app.workspace.getActiveFile();
            if (this.plugin.activeTimer) {
                new Notice('Ya hay un temporizador en curso.');
                return;
            }
            if (!activeFile) {
                new Notice('Por favor, abra una nota para iniciar el temporizador.');
                return;
            }
            
            this.startTrackingWithSelectionDetection(activeFile);
        });
    }

    /**
     * Valida si se puede iniciar un temporizador en el contexto actual
     * @returns true si se puede iniciar, false en caso contrario
     */
    canStartTimer(): boolean {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        const isTimerRunning = !!this.plugin.activeTimer;
        return !!(activeFile && !isTimerRunning);
    }

    /**
     * Obtiene información sobre la tarea seleccionada actualmente
     * @returns Información de la tarea o null si no hay selección válida
     */
    getCurrentTaskSelection(): TaskAnalysisResult | null {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            return null;
        }

        return TaskSelectionAnalyzer.extractTaskFromActiveView(activeView);
    }
}
