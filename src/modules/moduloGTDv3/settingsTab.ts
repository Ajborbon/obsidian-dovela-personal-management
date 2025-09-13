import { App, PluginSettingTab, Setting } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';

export class DovelaSettingsTab extends PluginSettingTab {
    plugin: DovelaPersonalManagementPlugin;

    constructor(app: App, plugin: DovelaPersonalManagementPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header principal
        containerEl.createEl('h1', { text: 'Dovela Personal Management' });

        // Sección Pomodoro
        this.renderPomodoroSettings(containerEl);
    }

    private renderPomodoroSettings(containerEl: HTMLElement): void {
        const pomodoroSection = containerEl.createDiv();
        pomodoroSection.createEl('h2', { text: '🍅 Configuración Pomodoro' });
        pomodoroSection.createEl('p', { 
            text: 'Configura los tiempos y comportamientos para las sesiones Pomodoro.',
            cls: 'setting-item-description'
        });

        const settings = this.plugin.data.pomodoroSettings;

        // Duración del trabajo
        new Setting(pomodoroSection)
            .setName('Duración de trabajo')
            .setDesc('Tiempo en minutos para las sesiones de trabajo')
            .addSlider(slider => slider
                .setLimits(1, 60, 1)
                .setValue(settings.workDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.workDuration = value;
                    await this.plugin.savePluginData();
                }));

        // Descanso corto
        new Setting(pomodoroSection)
            .setName('Duración descanso corto')
            .setDesc('Tiempo en minutos para los descansos cortos')
            .addSlider(slider => slider
                .setLimits(1, 15, 1)
                .setValue(settings.shortBreakDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.shortBreakDuration = value;
                    await this.plugin.savePluginData();
                }));

        // Descanso largo
        new Setting(pomodoroSection)
            .setName('Duración descanso largo')
            .setDesc('Tiempo en minutos para los descansos largos')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(settings.longBreakDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.longBreakDuration = value;
                    await this.plugin.savePluginData();
                }));

        // Ciclos antes de descanso largo
        new Setting(pomodoroSection)
            .setName('Ciclos antes de descanso largo')
            .setDesc('Número de sesiones de trabajo antes de un descanso largo')
            .addSlider(slider => slider
                .setLimits(2, 8, 1)
                .setValue(settings.cyclesBeforeLongBreak)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.cyclesBeforeLongBreak = value;
                    await this.plugin.savePluginData();
                }));

        // Intervalo de alertas de overtime
        new Setting(pomodoroSection)
            .setName('Intervalo de alertas en overtime')
            .setDesc('Frecuencia de recordatorios en modo overtime (minutos)')
            .addSlider(slider => slider
                .setLimits(1, 15, 1)
                .setValue(settings.overtimeAlertInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.overtimeAlertInterval = value;
                    await this.plugin.savePluginData();
                }));

        // Separador
        pomodoroSection.createEl('hr');

        // Auto-iniciar descansos
        new Setting(pomodoroSection)
            .setName('Auto-iniciar descansos')
            .setDesc('Iniciar automáticamente los descansos al completar una sesión de trabajo')
            .addToggle(toggle => toggle
                .setValue(settings.autoStartBreaks)
                .onChange(async (value) => {
                    settings.autoStartBreaks = value;
                    await this.plugin.savePluginData();
                }));

        // Auto-iniciar trabajo
        new Setting(pomodoroSection)
            .setName('Auto-iniciar trabajo después del descanso')
            .setDesc('Iniciar automáticamente el trabajo al completar un descanso')
            .addToggle(toggle => toggle
                .setValue(settings.autoStartWork)
                .onChange(async (value) => {
                    settings.autoStartWork = value;
                    await this.plugin.savePluginData();
                }));

        // Separador
        pomodoroSection.createEl('hr');

        // Notificaciones
        new Setting(pomodoroSection)
            .setName('Mostrar notificaciones')
            .setDesc('Mostrar notificaciones cuando se completen las sesiones')
            .addToggle(toggle => toggle
                .setValue(settings.notificationsEnabled)
                .onChange(async (value) => {
                    settings.notificationsEnabled = value;
                    await this.plugin.savePluginData();
                }));

        // Sonido
        new Setting(pomodoroSection)
            .setName('Reproducir sonido')
            .setDesc('Reproducir sonido de alerta al completar sesiones')
            .addToggle(toggle => toggle
                .setValue(settings.soundEnabled)
                .onChange(async (value) => {
                    settings.soundEnabled = value;
                    await this.plugin.savePluginData();
                }));

        // Botón de resetear a valores por defecto
        pomodoroSection.createEl('hr');
        
        new Setting(pomodoroSection)
            .setName('Restablecer configuración')
            .setDesc('Volver a los valores por defecto de Pomodoro')
            .addButton(button => button
                .setButtonText('Restablecer')
                .setWarning()
                .onClick(async () => {
                    // Importar los valores por defecto
                    const { DEFAULT_POMODORO_SETTINGS } = await import('./model.js');
                    
                    // Actualizar la configuración
                    this.plugin.data.pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
                    await this.plugin.savePluginData();
                    
                    // Refrescar la pantalla de configuración
                    this.display();
                }));

        // Información de estadísticas
        pomodoroSection.createEl('hr');
        pomodoroSection.createEl('h3', { text: '📊 Estadísticas' });
        
        const stats = this.plugin.data.pomodoroStats;
        const statsContainer = pomodoroSection.createDiv({ cls: 'pomodoro-stats-container' });
        
        const statsGrid = statsContainer.createDiv({ cls: 'stats-grid' });
        
        this.createStatItem(statsGrid, 'Sesiones de trabajo completadas', stats.totalWorkSessions.toString());
        this.createStatItem(statsGrid, 'Tiempo total de trabajo', `${Math.floor(stats.totalWorkMinutes / 60)}h ${stats.totalWorkMinutes % 60}m`);
        this.createStatItem(statsGrid, 'Ciclos completos', stats.completedCycles.toString());
        this.createStatItem(statsGrid, 'Sesiones hoy', stats.todayWorkSessions.toString());
        this.createStatItem(statsGrid, 'Tiempo hoy', `${Math.floor(stats.todayWorkMinutes / 60)}h ${stats.todayWorkMinutes % 60}m`);

        // Botón para resetear estadísticas
        new Setting(pomodoroSection)
            .setName('Resetear estadísticas')
            .setDesc('⚠️ Eliminar todas las estadísticas de Pomodoro')
            .addButton(button => button
                .setButtonText('Resetear estadísticas')
                .setWarning()
                .onClick(async () => {
                    if (confirm('¿Estás seguro de que quieres resetear todas las estadísticas de Pomodoro? Esta acción no se puede deshacer.')) {
                        const { DEFAULT_POMODORO_STATS } = await import('./model.js');
                        this.plugin.data.pomodoroStats = { ...DEFAULT_POMODORO_STATS };
                        await this.plugin.savePluginData();
                        this.display();
                    }
                }));
    }

    private createStatItem(container: HTMLElement, label: string, value: string): void {
        const item = container.createDiv({ cls: 'stat-item' });
        item.createDiv({ text: label, cls: 'stat-label' });
        item.createDiv({ text: value, cls: 'stat-value' });
    }
}