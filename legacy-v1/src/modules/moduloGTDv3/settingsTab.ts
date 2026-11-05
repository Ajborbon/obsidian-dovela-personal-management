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

        // Sección Journal
        this.renderJournalSettings(containerEl);

        // Sección Pomodoro
        this.renderPomodoroSettings(containerEl);
    }

    private renderJournalSettings(containerEl: HTMLElement): void {
        const journalSection = containerEl.createDiv();
        journalSection.createEl('h2', { text: '📋 Configuración Journal' });
        journalSection.createEl('p', {
            text: 'Configura las rutas y estructura de carpetas para el sistema de Journal diario.',
            cls: 'setting-item-description'
        });

        const settings = this.plugin.data.journalSettings;

        // Carpeta base
        const baseFolderSetting = new Setting(journalSection)
            .setName('Carpeta base de Journals')
            .setDesc('Ruta de la carpeta donde se almacenan las notas de Journal')
            .addText(text => text
                .setPlaceholder('03 - Gestion Personal/AV - Gerente de Vida/AI - Journals')
                .setValue(settings.baseFolderPath)
                .onChange(async (value) => {
                    settings.baseFolderPath = value;
                    await this.plugin.savePluginData();
                    this.updateFolderPreview();
                    this.validateJournalSettings(baseFolderSetting);
                }));

        // Validación inicial
        this.validateJournalSettings(baseFolderSetting);

        // Subcarpeta por año
        new Setting(journalSection)
            .setName('Crear subcarpeta por año')
            .setDesc('Organizar journals en subcarpetas por año (ej: /2025/)')
            .addToggle(toggle => toggle
                .setValue(settings.yearSubfolder)
                .onChange(async (value) => {
                    settings.yearSubfolder = value;
                    await this.plugin.savePluginData();
                    this.updateFolderPreview();
                }));

        // Subcarpeta por trimestre
        new Setting(journalSection)
            .setName('Crear subcarpeta por trimestre')
            .setDesc('Organizar journals en subcarpetas por trimestre (ej: /Q3/)')
            .addToggle(toggle => toggle
                .setValue(settings.quarterSubfolder)
                .onChange(async (value) => {
                    settings.quarterSubfolder = value;
                    await this.plugin.savePluginData();
                    this.updateFolderPreview();
                }));

        // Subcarpeta por mes
        new Setting(journalSection)
            .setName('Crear subcarpeta por mes')
            .setDesc('Organizar journals en subcarpetas por mes (ej: /10/)')
            .addToggle(toggle => toggle
                .setValue(settings.monthSubfolder)
                .onChange(async (value) => {
                    settings.monthSubfolder = value;
                    await this.plugin.savePluginData();
                    this.updateFolderPreview();
                }));

        // Patrón para carpetas de semanas
        new Setting(journalSection)
            .setName('Patrón de carpetas para semanas')
            .setDesc('Patrón para organizar enlaces semanales. Variables: {YYYY}, {Q}, {MM}, {WW}')
            .addText(text => text
                .setPlaceholder('{YYYY}/Q{Q}')
                .setValue(settings.weekFolderPattern)
                .onChange(async (value) => {
                    settings.weekFolderPattern = value;
                    await this.plugin.savePluginData();
                    this.updateFolderPreview();
                }));

        // Vista previa de la estructura
        this.createFolderPreview(journalSection);

        // Separador
        journalSection.createEl('hr');

        // Botón de resetear a valores por defecto
        new Setting(journalSection)
            .setName('Restablecer configuración Journal')
            .setDesc('Volver a los valores por defecto de Journal')
            .addButton(button => button
                .setButtonText('Restablecer')
                .setWarning()
                .onClick(async () => {
                    const { DEFAULT_JOURNAL_SETTINGS } = await import('./model.js');
                    this.plugin.data.journalSettings = { ...DEFAULT_JOURNAL_SETTINGS };
                    await this.plugin.savePluginData();
                    this.display();
                }));

        // Separador final
        journalSection.createEl('hr');
    }

    private createFolderPreview(container: HTMLElement): void {
        const previewContainer = container.createDiv({ cls: 'journal-folder-preview' });
        previewContainer.createEl('h4', { text: '📁 Vista previa de estructura' });

        this.folderPreviewEl = previewContainer.createEl('div', { cls: 'folder-preview-content' });
        this.updateFolderPreview();
    }

    private folderPreviewEl: HTMLElement | null = null;

    private updateFolderPreview(): void {
        if (!this.folderPreviewEl) return;

        const settings = this.plugin.data.journalSettings;
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const quarter = Math.ceil((currentDate.getMonth() + 1) / 3);
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const week = this.getISOWeek(currentDate);

        // Estructura para notas diarias
        let dailyPath = settings.baseFolderPath;
        if (settings.yearSubfolder) dailyPath += `/${year}`;
        if (settings.quarterSubfolder) dailyPath += `/Q${quarter}`;
        if (settings.monthSubfolder) dailyPath += `/${month}`;

        // Estructura para enlaces semanales
        let weekPattern = settings.weekFolderPattern
            .replace('{YYYY}', year.toString())
            .replace('{Q}', quarter.toString())
            .replace('{MM}', month)
            .replace('{WW}', String(week).padStart(2, '0'));

        let weekPath = settings.baseFolderPath + '/' + weekPattern;

        this.folderPreviewEl.innerHTML = `
            <div class="preview-section">
                <strong>📅 Notas diarias:</strong>
                <code>${dailyPath}/2025-10-24 viernes.md</code>
            </div>
            <div class="preview-section">
                <strong>📊 Enlaces semanales:</strong>
                <code>[w::[[${weekPath}/${year}-W${String(week).padStart(2, '0')}|${year}-W${String(week).padStart(2, '0')}]]]</code>
            </div>
        `;
    }

    private getISOWeek(date: Date): number {
        const target = new Date(date.valueOf());
        const dayNumber = (date.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNumber + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    }

    private async validateJournalSettings(setting: Setting): Promise<void> {
        try {
            const validation = await this.plugin.journalAPI.validateJournalSettings();

            if (!validation.valid) {
                setting.setDesc(`⚠️ ${validation.message || 'Ruta inválida'}`);
                setting.settingEl.addClass('journal-setting-error');
            } else {
                setting.setDesc('Ruta de la carpeta donde se almacenan las notas de Journal');
                setting.settingEl.removeClass('journal-setting-error');
            }
        } catch (error) {
            setting.setDesc(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            setting.settingEl.addClass('journal-setting-error');
        }
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