import { App, Modal, Setting, Notice, setIcon, TFile } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { PomodoroSession, PomodoroSessionType } from './model.js';
import { TaskSelectionAnalyzer } from './taskSelectionAnalyzer.js';
import moment from 'moment';

export type PomodoroModalType = 
    | 'sessionComplete'    // Modal que aparece al completar una sesión
    | 'quickSettings'      // Modal para configuración rápida
    | 'sessionOptions';    // Modal para elegir tipo de sesión

interface PomodoroModalOptions {
    type: PomodoroModalType;
    completedSession?: PomodoroSession;
    onContinue?: (nextType: PomodoroSessionType) => void;
    onFinish?: (shouldCloseTask?: boolean) => void;
    onWorkMore?: () => void;
    onContinueOvertime?: () => void; // Nueva callback para modo overtime
}

export class PomodoroModal extends Modal {
    private plugin: DovelaPersonalManagementPlugin;
    private options: PomodoroModalOptions;
    private shouldCloseTaskCheckbox: HTMLElement | null = null;
    private sessionNotes: string = '';

    constructor(app: App, plugin: DovelaPersonalManagementPlugin, options: PomodoroModalOptions) {
        super(app);
        this.plugin = plugin;
        this.options = options;
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        switch (this.options.type) {
            case 'sessionComplete':
                this.renderSessionCompleteModal();
                break;
            case 'quickSettings':
                this.renderQuickSettingsModal();
                break;
            case 'sessionOptions':
                this.renderSessionOptionsModal();
                break;
        }
    }

    private renderSessionCompleteModal() {
        const { contentEl } = this;
        const session = this.options.completedSession;

        if (!session) {
            this.close();
            return;
        }

        // Título dinámico basado en el tipo de sesión
        const title = this.getSessionCompletionTitle(session);
        this.titleEl.setText(title);

        // Inicializar notas con cualquier nota existente de la sesión
        this.sessionNotes = session.notes || '';

        // --- Campo Nota/Archivo (similar a TimeLogModal) ---
        const noteSetting = new Setting(contentEl).setName('Nota');
        noteSetting.controlEl.addClass('dovela-task-setting-container');

        const noteLinkIcon = noteSetting.controlEl.createEl('a', {
            cls: 'dovela-note-link-icon',
            attr: { 'aria-label': 'Abrir nota', title: 'Abrir nota' }
        });
        setIcon(noteLinkIcon, 'external-link');

        noteLinkIcon.onClickEvent((e) => {
            e.preventDefault();
            const notePath = session.taskPath;
            if (notePath) {
                this.app.workspace.openLinkText(notePath, '', true);
            }
        });

        if (session.taskPath) {
            const fileName = session.taskPath.split('/').pop()?.replace(/\.md$/, '') || session.taskPath;
            noteSetting.controlEl.createEl('div', {
                text: fileName,
                cls: 'task-display-text'
            });
        }

        // --- Campo Tarea (solo si hay tarea específica) ---
        if (session.type === 'work' && session.taskDescription && this.isSpecificTask(session)) {
            const taskSetting = new Setting(contentEl).setName('Tarea');
            taskSetting.controlEl.createEl('div', {
                text: session.taskDescription,
                cls: 'task-display-text'
            });
        }

        // --- Información adicional de la sesión ---
        const infoSetting = new Setting(contentEl).setName('Información de la Sesión');
        const infoDiv = infoSetting.controlEl.createDiv({ cls: 'pomodoro-session-info' });

        infoDiv.createEl('div', {
            text: `Duración: ${session.duration} minutos`,
            cls: 'pomodoro-duration-info'
        });

        if (session.type === 'work') {
            infoDiv.createEl('div', {
                text: `Ciclos completados: ${session.completedCycles}`,
                cls: 'pomodoro-cycles-info'
            });
        }

        // --- Campo Notas de la Sesión (editable) ---
        new Setting(contentEl)
            .setName('Notas de la Sesión')
            .addTextArea(text => {
                text.setValue(this.sessionNotes);
                text.onChange(value => this.sessionNotes = value);
                text.inputEl.rows = 4;
                text.inputEl.placeholder = 'Agrega notas sobre esta sesión de Pomodoro...';
            });

        // --- Checkbox para cerrar tarea (solo si es una tarea específica) ---
        if (session.type === 'work' && this.isSpecificTask(session)) {
            const closeTaskSetting = new Setting(contentEl)
                .setName('Cerrar tarea activa?')
                .setDesc('No usar en tareas recurrentes 🔁.')
                .addToggle(toggle => {
                    this.shouldCloseTaskCheckbox = toggle.toggleEl;
                    toggle.setValue(false); // Por defecto desmarcado
                });

            // Añadir el texto personalizado después del toggle
            const labelText = closeTaskSetting.controlEl.createSpan({
                text: 'Cerrar la tarea ✅ ' + moment().format('YYYY-MM-DD'),
                cls: 'task-close-label'
            });

            // Hacer que el texto también sea clickeable
            labelText.addEventListener('click', () => {
                const currentValue = this.shouldCloseTaskCheckbox?.classList.contains('is-enabled');
                if (currentValue) {
                    this.shouldCloseTaskCheckbox?.removeClass('is-enabled');
                } else {
                    this.shouldCloseTaskCheckbox?.addClass('is-enabled');
                }
            });
        }

        // Opciones según el tipo de sesión
        const buttonContainer = contentEl.createDiv({ cls: 'pomodoro-modal-buttons' });

        if (session.type === 'work') {
            this.renderWorkCompleteOptions(buttonContainer, session);
        } else {
            this.renderBreakCompleteOptions(buttonContainer, session);
        }

        // Botón para finalizar sesión
        buttonContainer.createEl('button', {
            text: '✅ Finalizar sesión',
            cls: 'mod-cta'
        }).addEventListener('click', async () => {
            if (this.options.onFinish) {
                const shouldCloseTask = this.shouldCloseTaskCheckbox?.classList.contains('is-enabled') || false;

                // Actualizar las notas de la sesión antes de finalizar
                if (session) {
                    session.notes = this.sessionNotes;
                }

                // Manejar el cierre de tarea si se solicitó
                if (shouldCloseTask && session && this.isSpecificTask(session)) {
                    await this.closeSessionTask(session);
                }

                this.options.onFinish(shouldCloseTask);
            }
            this.close();
        });
    }

    private renderWorkCompleteOptions(container: HTMLElement, session: PomodoroSession) {
        const settings = this.plugin.data.pomodoroSettings;
        const shouldBeLongBreak = session.completedCycles % settings.cyclesBeforeLongBreak === 0 && 
                                  session.completedCycles > 0;

        // Opción de descanso
        const breakType = shouldBeLongBreak ? 'longBreak' : 'shortBreak';
        const breakText = shouldBeLongBreak ? 
            `☕ Descanso largo (${settings.longBreakDuration} min)` : 
            `☕ Descanso corto (${settings.shortBreakDuration} min)`;

        container.createEl('button', {
            text: breakText,
            cls: 'mod-warning'
        }).addEventListener('click', () => {
            // Actualizar las notas de la sesión antes de continuar
            if (session) {
                session.notes = this.sessionNotes;
            }

            if (this.options.onContinue) {
                this.options.onContinue(breakType);
            }
            this.close();
        });

        // Opción de continuar trabajando
        container.createEl('button', {
            text: `🍅 Otro pomodoro (${settings.workDuration} min)`,
        }).addEventListener('click', () => {
            // Actualizar las notas de la sesión antes de continuar
            if (session) {
                session.notes = this.sessionNotes;
            }

            if (this.options.onWorkMore) {
                this.options.onWorkMore();
            }
            this.close();
        });

        // Opción de seguir trabajando en el mismo ciclo (modo overtime)
        container.createEl('button', {
            text: `🔴 Seguir trabajando en el mismo ciclo`,
            cls: 'overtime-button'
        }).addEventListener('click', () => {
            // Actualizar las notas de la sesión antes de entrar en overtime
            if (session) {
                session.notes = this.sessionNotes;
            }

            if (this.options.onContinueOvertime) {
                this.options.onContinueOvertime();
            }
            this.close();
        });
    }

    private renderBreakCompleteOptions(container: HTMLElement, session: PomodoroSession) {
        const settings = this.plugin.data.pomodoroSettings;

        // Opción de volver al trabajo
        container.createEl('button', {
            text: `🍅 Volver al trabajo (${settings.workDuration} min)`,
            cls: 'mod-cta'
        }).addEventListener('click', () => {
            if (this.options.onContinue) {
                this.options.onContinue('work');
            }
            this.close();
        });

        // Opción de extender el descanso
        const extendText = session.type === 'shortBreak' ? 
            `☕ Descanso largo (${settings.longBreakDuration} min)` : 
            `☕ Más descanso (${settings.longBreakDuration} min)`;

        container.createEl('button', {
            text: extendText,
        }).addEventListener('click', () => {
            if (this.options.onContinue) {
                this.options.onContinue('longBreak');
            }
            this.close();
        });
    }

    private renderQuickSettingsModal() {
        const { contentEl } = this;
        this.titleEl.setText('⚙️ Configuración Rápida');

        const settings = this.plugin.data.pomodoroSettings;
        let tempSettings = { ...settings };

        new Setting(contentEl)
            .setName('Duración trabajo')
            .setDesc('Minutos para sesiones de trabajo')
            .addSlider(slider => slider
                .setLimits(1, 60, 1)
                .setValue(settings.workDuration)
                .setDynamicTooltip()
                .onChange(value => {
                    tempSettings.workDuration = value;
                }));

        new Setting(contentEl)
            .setName('Descanso corto')
            .setDesc('Minutos para descansos cortos')
            .addSlider(slider => slider
                .setLimits(1, 15, 1)
                .setValue(settings.shortBreakDuration)
                .setDynamicTooltip()
                .onChange(value => {
                    tempSettings.shortBreakDuration = value;
                }));

        new Setting(contentEl)
            .setName('Descanso largo')
            .setDesc('Minutos para descansos largos')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(settings.longBreakDuration)
                .setDynamicTooltip()
                .onChange(value => {
                    tempSettings.longBreakDuration = value;
                }));

        new Setting(contentEl)
            .setName('Alertas overtime (min)')
            .setDesc('Frecuencia de recordatorios en overtime')
            .addSlider(slider => slider
                .setLimits(1, 15, 1)
                .setValue(settings.overtimeAlertInterval)
                .setDynamicTooltip()
                .onChange(value => {
                    tempSettings.overtimeAlertInterval = value;
                }));

        new Setting(contentEl)
            .setName('Auto-iniciar descansos')
            .addToggle(toggle => toggle
                .setValue(settings.autoStartBreaks)
                .onChange(value => {
                    tempSettings.autoStartBreaks = value;
                }));

        new Setting(contentEl)
            .setName('Sonido al completar')
            .addToggle(toggle => toggle
                .setValue(settings.soundEnabled)
                .onChange(value => {
                    tempSettings.soundEnabled = value;
                }));

        // Botones
        const buttonContainer = new Setting(contentEl);
        
        buttonContainer.addButton(btn => btn
            .setButtonText('Cancelar')
            .onClick(() => this.close()));
            
        buttonContainer.addButton(btn => btn
            .setButtonText('Guardar')
            .setCta()
            .onClick(async () => {
                this.plugin.data.pomodoroSettings = tempSettings;
                await this.plugin.savePluginData();
                new Notice('Configuración de Pomodoro guardada');
                this.close();
            }));
    }

    private renderSessionOptionsModal() {
        const { contentEl } = this;
        this.titleEl.setText('🍅 Iniciar Sesión Pomodoro');

        const settings = this.plugin.data.pomodoroSettings;

        contentEl.createEl('p', {
            text: 'Selecciona el tipo de sesión que quieres iniciar:',
            cls: 'pomodoro-session-description'
        });

        const buttonContainer = contentEl.createDiv({ cls: 'pomodoro-session-buttons' });

        // Botón de trabajo
        const workButton = buttonContainer.createEl('button', {
            text: `🍅 Trabajo (${settings.workDuration} min)`,
            cls: 'pomodoro-session-button work-button'
        });
        
        workButton.addEventListener('click', () => {
            if (this.options.onContinue) {
                this.options.onContinue('work');
            }
            this.close();
        });

        // Botón de descanso corto
        const shortBreakButton = buttonContainer.createEl('button', {
            text: `☕ Descanso corto (${settings.shortBreakDuration} min)`,
            cls: 'pomodoro-session-button break-button'
        });
        
        shortBreakButton.addEventListener('click', () => {
            if (this.options.onContinue) {
                this.options.onContinue('shortBreak');
            }
            this.close();
        });

        // Botón de descanso largo
        const longBreakButton = buttonContainer.createEl('button', {
            text: `☕ Descanso largo (${settings.longBreakDuration} min)`,
            cls: 'pomodoro-session-button break-button'
        });
        
        longBreakButton.addEventListener('click', () => {
            if (this.options.onContinue) {
                this.options.onContinue('longBreak');
            }
            this.close();
        });

        // Botón de configuración rápida
        const settingsButton = buttonContainer.createEl('button', {
            text: '⚙️ Configuración rápida',
            cls: 'pomodoro-session-button settings-button'
        });
        
        settingsButton.addEventListener('click', () => {
            this.close();
            new PomodoroModal(this.app, this.plugin, { 
                type: 'quickSettings' 
            }).open();
        });
    }

    private getSessionCompletionTitle(session: PomodoroSession): string {
        switch (session.type) {
            case 'work':
                return '🍅 ¡Sesión de trabajo completada!';
            case 'shortBreak':
                return '☕ ¡Descanso corto completado!';
            case 'longBreak':
                return '☕ ¡Descanso largo completado!';
            default:
                return '✅ ¡Sesión completada!';
        }
    }

    /**
     * Determina si una sesión de Pomodoro corresponde a una tarea específica
     * (usando la misma lógica que TimeLogModal.shouldShowCloseCheckbox)
     */
    private isSpecificTask(session: PomodoroSession): boolean {
        if (!session.taskPath || !session.taskDescription) return false;

        // Obtener el nombre del archivo sin extensión
        const fileName = session.taskPath.split('/').pop()?.replace(/\.md$/, '') || '';

        // Si taskDescription es diferente del nombre del archivo, es una tarea específica
        const isSpecificTask = session.taskDescription !== fileName &&
                               session.taskDescription !== session.taskPath &&
                               session.taskDescription.length > 0;

        return isSpecificTask;
    }

    /**
     * Cierra una tarea específica en el archivo correspondiente
     * (similar a la funcionalidad de TimeLogModal.closeTaskInFile)
     */
    private async closeSessionTask(session: PomodoroSession): Promise<boolean> {
        if (!session.taskPath || !session.taskDescription) {
            return false;
        }

        try {
            // Obtener el archivo
            const file = this.app.vault.getAbstractFileByPath(session.taskPath);
            if (!(file instanceof TFile)) {
                console.warn(`Dovela PM: No se pudo encontrar el archivo: ${session.taskPath}`);
                return false;
            }

            // Leer el contenido del archivo
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            // Buscar la línea de la tarea por descripción
            let taskLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i] ?? '';
                if (TaskSelectionAnalyzer.isValidTaskLine(line)) {
                    const taskContent = TaskSelectionAnalyzer.extractTaskContent(line);
                    if (taskContent && taskContent.includes(session.taskDescription)) {
                        taskLineIndex = i;
                        break;
                    }
                }
            }

            // Si no se encontró por descripción, buscar la primera tarea abierta o en progreso
            if (taskLineIndex === -1) {
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] ?? '';
                    const taskState = TaskSelectionAnalyzer.getTaskState(line);
                    if (taskState && (taskState === 'open' || taskState === 'in-progress')) {
                        taskLineIndex = i;
                        break;
                    }
                }
            }

            if (taskLineIndex === -1) {
                console.warn('Dovela PM: No se encontró una tarea válida para cerrar en el archivo');
                return false;
            }

            const taskLine = lines[taskLineIndex];
            if (!taskLine) return false;
            const taskState = TaskSelectionAnalyzer.getTaskState(taskLine);

            // Solo cerrar si la tarea no está ya completada
            if (taskState && taskState === 'completed') {
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

            // Reemplazar la línea en el contenido
            lines[taskLineIndex] = newLine;
            const newContent = lines.join('\n');

            // Guardar el archivo
            await this.app.vault.modify(file, newContent);

            console.log('Dovela PM: Tarea cerrada exitosamente desde Pomodoro');
            return true;

        } catch (error) {
            console.error('Dovela PM: Error al cerrar la tarea desde Pomodoro:', error);
            new Notice('Error al cerrar la tarea. Revisa la consola para más detalles.');
            return false;
        }
    }

    /**
     * Crea una línea de tarea completada con fecha de finalización
     * (copiado de TimeLogModal.createCompletedTaskLine)
     */
    private createCompletedTaskLine(originalLine: string, completionDate: string): string | null {
        // Patrón para detectar tareas con cualquier estado
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

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}