import { App, Modal, Setting, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { PomodoroSession, PomodoroSessionType } from './model.js';

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
    private shouldCloseTaskCheckbox: HTMLInputElement | null = null;

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

        // Información de la sesión
        const infoContainer = contentEl.createDiv({ cls: 'pomodoro-session-info' });
        
        if (session.type === 'work' && session.taskDescription) {
            infoContainer.createEl('p', { 
                text: `Tarea: ${session.taskDescription}`,
                cls: 'pomodoro-task-info'
            });
        }

        infoContainer.createEl('p', { 
            text: `Duración: ${session.duration} minutos`,
            cls: 'pomodoro-duration-info'
        });

        if (session.type === 'work') {
            infoContainer.createEl('p', { 
                text: `Ciclos completados: ${session.completedCycles}`,
                cls: 'pomodoro-cycles-info'
            });
        }

        // Checkbox para cerrar tarea (solo si es una tarea específica)
        if (session.type === 'work' && this.plugin.pomodoroService.hasSpecificTask(session)) {
            const checkboxContainer = contentEl.createDiv({ cls: 'pomodoro-close-task-container' });
            
            const checkboxLabel = checkboxContainer.createEl('label', { 
                cls: 'pomodoro-close-task-label' 
            });
            
            this.shouldCloseTaskCheckbox = checkboxLabel.createEl('input', { 
                type: 'checkbox',
                cls: 'pomodoro-close-task-checkbox'
            }) as HTMLInputElement;
            
            checkboxLabel.appendText(' ¿Cerrar la tarea al finalizar?');
            this.shouldCloseTaskCheckbox.checked = true; // Por defecto marcado
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
        }).addEventListener('click', () => {
            if (this.options.onFinish) {
                const shouldCloseTask = this.shouldCloseTaskCheckbox?.checked || false;
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
            if (this.options.onContinue) {
                this.options.onContinue(breakType);
            }
            this.close();
        });

        // Opción de continuar trabajando
        container.createEl('button', {
            text: `🍅 Otro pomodoro (${settings.workDuration} min)`,
        }).addEventListener('click', () => {
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

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}