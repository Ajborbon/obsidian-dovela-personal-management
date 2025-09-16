import { TFile, App, Notice } from 'obsidian';
import { TaskSelectionAnalyzer } from './taskSelectionAnalyzer.js';
import moment from 'moment';

/**
 * Utilidad para manejar estados de tareas en archivos
 * Funcionalidades: cerrar tareas, poner en progreso, cambiar estados
 */
export class TaskStateManager {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Cierra una tarea específica en un archivo
     * @param taskNotePath - Ruta del archivo donde está la tarea
     * @param taskDescription - Descripción de la tarea para encontrarla (opcional)
     * @returns true si la tarea se cerró exitosamente, false en caso contrario
     */
    async closeTask(taskNotePath: string, taskDescription?: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(taskNotePath);
            if (!(file instanceof TFile)) {
                console.warn(`Dovela PM: No se pudo encontrar el archivo: ${taskNotePath}`);
                return false;
            }

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            const taskLineIndex = this.findTaskLine(lines, taskDescription, ['open', 'in-progress']);
            if (taskLineIndex === -1) {
                console.warn('Dovela PM: No se encontró una tarea válida para cerrar en el archivo');
                return false;
            }

            const taskLine = lines[taskLineIndex];
            if (!taskLine) return false;
            
            const taskState = TaskSelectionAnalyzer.getTaskState(taskLine);
            if (taskState === 'completed') {
                console.log('Dovela PM: La tarea ya está completada');
                return false;
            }

            // Crear la nueva línea con estado completado y fecha
            const today = moment().format('YYYY-MM-DD');
            const newLine = this.createCompletedTaskLine(taskLine, today);
            
            if (!newLine) {
                console.warn('Dovela PM: No se pudo crear la línea de tarea completada');
                return false;
            }

            lines[taskLineIndex] = newLine;
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
            
            console.log('Dovela PM: Tarea cerrada exitosamente');
            return true;
            
        } catch (error) {
            console.error('Dovela PM: Error al cerrar la tarea:', error);
            new Notice('Error al cerrar la tarea. Revisa la consola para más detalles.');
            return false;
        }
    }

    /**
     * Pone una tarea en estado de progreso (- [/])
     * @param taskNotePath - Ruta del archivo donde está la tarea
     * @param taskDescription - Descripción de la tarea para encontrarla (opcional)
     * @returns true si la tarea se puso en progreso exitosamente
     */
    async setTaskInProgress(taskNotePath: string, taskDescription?: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(taskNotePath);
            if (!(file instanceof TFile)) {
                console.warn(`Dovela PM: No se pudo encontrar el archivo: ${taskNotePath}`);
                return false;
            }

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            const taskLineIndex = this.findTaskLine(lines, taskDescription, ['open']);
            if (taskLineIndex === -1) {
                console.log('Dovela PM: No se encontró una tarea abierta para poner en progreso');
                return false;
            }

            const taskLine = lines[taskLineIndex];
            if (!taskLine) return false;
            
            const taskState = TaskSelectionAnalyzer.getTaskState(taskLine);
            if (taskState === 'in-progress') {
                console.log('Dovela PM: La tarea ya está en progreso');
                return false;
            }

            // Cambiar de - [ ] a - [/]
            const newLine = taskLine.replace(/^(\s*-\s\[)\s(\]\s*.*)$/, '$1/$2');
            
            if (newLine === taskLine) {
                console.warn('Dovela PM: No se pudo cambiar el estado de la tarea');
                return false;
            }

            lines[taskLineIndex] = newLine;
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
            
            console.log('Dovela PM: Tarea puesta en progreso exitosamente');
            return true;
            
        } catch (error) {
            console.error('Dovela PM: Error al poner la tarea en progreso:', error);
            new Notice('Error al cambiar el estado de la tarea. Revisa la consola para más detalles.');
            return false;
        }
    }

    /**
     * Verifica si un archivo y descripción corresponden a una tarea específica
     * (usando la misma lógica que TimeLogModal.shouldShowCloseCheckbox)
     * @param taskNotePath - Ruta del archivo
     * @param taskDescription - Descripción de la tarea
     * @returns true si es una tarea específica, false si es solo un archivo general
     */
    isSpecificTask(taskNotePath: string, taskDescription?: string): boolean {
        if (!taskNotePath || !taskDescription) return false;

        // Obtener el nombre del archivo sin extensión
        const fileName = taskNotePath.split('/').pop()?.replace(/\.md$/, '') || '';

        // Si taskDescription es diferente del nombre del archivo, es una tarea específica
        const isSpecificTask = taskDescription !== fileName &&
                               taskDescription !== taskNotePath &&
                               taskDescription.length > 0;

        return isSpecificTask;
    }

    /**
     * Busca una línea de tarea que coincida con la descripción y estados especificados
     * @param lines - Líneas del archivo
     * @param taskDescription - Descripción a buscar (opcional)
     * @param allowedStates - Estados permitidos para la búsqueda
     * @returns Índice de la línea encontrada o -1 si no se encuentra
     */
    private findTaskLine(lines: string[], taskDescription?: string, allowedStates?: string[]): number {
        // Buscar por descripción de tarea si se proporciona
        if (taskDescription && taskDescription.trim() !== '') {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i] ?? '';
                if (TaskSelectionAnalyzer.isValidTaskLine(line)) {
                    const content = TaskSelectionAnalyzer.extractTaskContent(line);
                    if (content && content.includes(taskDescription)) {
                        const taskState = TaskSelectionAnalyzer.getTaskState(line);
                        if (!allowedStates || (taskState && allowedStates.includes(taskState))) {
                            return i;
                        }
                    }
                }
            }
        }
        
        // Si no se encontró por descripción, buscar la primera tarea con estado permitido
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? '';
            const taskState = TaskSelectionAnalyzer.getTaskState(line);
            if (taskState && (!allowedStates || allowedStates.includes(taskState))) {
                return i;
            }
        }
        
        return -1;
    }

    /**
     * Crea una línea de tarea completada con fecha
     * @param originalLine - Línea original de la tarea
     * @param completionDate - Fecha de completación (formato YYYY-MM-DD)
     * @returns Nueva línea con estado completado y fecha
     */
    private createCompletedTaskLine(originalLine: string, completionDate: string): string | null {
        const taskMatch = originalLine.match(/^(\s*-\s\[)[\s\/xX!?*+-](\]\s*.*)$/);
        
        if (!taskMatch) {
            return null;
        }
        
        // Construir la nueva línea: cambiar estado a 'x' y agregar fecha de finalización
        let newLine = `${taskMatch[1]}x${taskMatch[2]}`;
        
        // Verificar si ya tiene una fecha de finalización
        if (!newLine.includes('✅')) {
            newLine = `${newLine.trimEnd()} ✅ ${completionDate}`;
        }
        
        return newLine;
    }
}