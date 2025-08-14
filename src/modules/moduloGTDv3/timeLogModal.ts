import { App, Modal, Setting, TFile, Notice, setIcon } from 'obsidian';
import type { Task, TimeLogEntry } from './model.js';
import moment from 'moment';
import type DovelaPersonalManagementPlugin from '../../main.js';

// The callback now passes the entry data back to the caller.
type OnSaveCallback = (entry: Partial<TimeLogEntry>) => Promise<void>;

export class TimeLogModal extends Modal {
    private plugin: DovelaPersonalManagementPlugin;
    private onSave: OnSaveCallback;
    private entry: Partial<TimeLogEntry>;
    private availableTasks: (TFile | Task)[] = [];
    private isEditing: boolean;
    private isEditingActiveTimer: boolean; // Flag for our new mode
    private savedOrDeleted = false;

    constructor(
        app: App,
        plugin: DovelaPersonalManagementPlugin,
        onSave: OnSaveCallback,
        entryData: Partial<TimeLogEntry> = {},
        isEditingActiveTimer = false // New parameter to control the mode
    ) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
        this.isEditing = !!entryData?.id;
        this.isEditingActiveTimer = isEditingActiveTimer;

        const now = moment().local();
        this.entry = {
            id: entryData?.id || '',
            taskNotePath: entryData?.taskNotePath || '',
            taskDescription: entryData?.taskDescription || '',
            startTime: entryData?.startTime ? moment(entryData.startTime).local().toISOString(true) : now.clone().subtract(1, 'hour').toISOString(true),
            endTime: entryData?.endTime ? moment(entryData.endTime).local().toISOString(true) : now.clone().toISOString(true),
            notes: entryData?.notes || '',
            durationMinutes: entryData?.durationMinutes || 0
        };
    }

    override async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        // Set title based on the mode
        this.titleEl.setText(this.isEditingActiveTimer ? 'Modificar Temporizador Activo' : (this.isEditing ? 'Editar Registro de Tiempo' : 'Registrar Tiempo'));

        // --- Task Selector (Conditional Rendering) ---
        const taskSetting = new Setting(contentEl).setName('Tarea');
        taskSetting.controlEl.addClass('dovela-task-setting-container');

        const noteLinkIcon = taskSetting.controlEl.createEl('a', {
            cls: 'dovela-note-link-icon',
            attr: { 'aria-label': 'Abrir nota', title: 'Abrir nota' }
        });
        setIcon(noteLinkIcon, 'external-link');
        noteLinkIcon.style.display = 'none'; // Oculto por defecto

        noteLinkIcon.onClickEvent((e) => {
            e.preventDefault();
            if (this.entry.taskNotePath) {
                this.app.workspace.openLinkText(this.entry.taskNotePath, '', true);
            }
        });

        // If the task is already defined (editing mode or stopping a timer), just display it.
        if (this.entry.taskNotePath) {
            taskSetting.controlEl.createEl('div', {
                text: this.entry.taskDescription || this.entry.taskNotePath,
                cls: 'task-display-text'
            });
            noteLinkIcon.style.display = 'inline-block';
        } else {
            // MANUAL MODE: If no task is defined, show the interactive selector.
            const searchContainer = taskSetting.controlEl.createDiv('dovela-timelog-task-selector');
            const sourceContainer = searchContainer.createDiv({ cls: 'source-selector' });
            const searchInputEl = searchContainer.createEl('input', {
                type: 'text',
                placeholder: 'Buscar tarea...'
            });
            const resultsContainer = searchContainer.createDiv({ cls: 'results-container' });
            resultsContainer.style.display = 'none';

            const renderResults = (tasks: (TFile | Task)[]) => {
                resultsContainer.empty();
                tasks.slice(0, 100).forEach(taskOrFile => {
                    const resultEl = resultsContainer.createDiv({ cls: 'result-item' });
                    let path: string, text: string, description: string;

                    if (taskOrFile instanceof TFile) {
                        path = taskOrFile.path;
                        text = taskOrFile.path;
                        description = taskOrFile.basename;
                    } else {
                        const task = taskOrFile as Task;
                        path = task.sourceFile.path;
                        text = `${task.content.substring(0, 100)}... (${task.sourceFile.basename})`;
                        description = task.content;
                    }
                    resultEl.setText(text);

                    resultEl.onClickEvent(() => {
                        this.entry.taskNotePath = path;
                        this.entry.taskDescription = description;
                        searchInputEl.value = text;
                        resultsContainer.style.display = 'none';
                        noteLinkIcon.style.display = 'inline-block';
                    });
                });
            };

            searchInputEl.addEventListener('input', () => {
                resultsContainer.style.display = 'block';
                const searchTerm = searchInputEl.value.toLowerCase();
                const filteredTasks = this.availableTasks.filter(taskOrFile => {
                    if (taskOrFile instanceof TFile) {
                        return taskOrFile.path.toLowerCase().includes(searchTerm);
                    } else {
                        const task = taskOrFile as Task;
                        const searchCorpus = [
                            task.content,
                            ...task.contexts,
                            ...task.assignedPeople,
                            ...task.tags
                        ].join(' ').toLowerCase();
                        return searchCorpus.includes(searchTerm);
                    }
                });
                renderResults(filteredTasks);
            });

            const updateButtons = (activeSource: string) => {
                sourceContainer.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('is-active', btn.dataset['source'] === activeSource);
                });
            };

            const createSourceButton = (source: 'open-notes' | 'in-progress' | 'all-tasks', name: string) => {
                const button = sourceContainer.createEl('button', { text: name });
                button.dataset['source'] = source;
                button.onClickEvent(async () => {
                    updateButtons(source);
                    await this.plugin.loadAvailableTasks(source);
                    this.availableTasks = this.plugin.availableTasks;
                    renderResults(this.availableTasks);
                });
            };

            createSourceButton('open-notes', 'Notas Abiertas');
            createSourceButton('in-progress', 'En Progreso');
            createSourceButton('all-tasks', 'Todas');

            // Set initial state
            const initialSource = 'open-notes';
            updateButtons(initialSource);
            await this.plugin.loadAvailableTasks(initialSource);
            this.availableTasks = this.plugin.availableTasks;
            renderResults(this.availableTasks);
        }

        // --- Conditional Fields ---
        // Hide Date and End Time when editing an active timer
        if (!this.isEditingActiveTimer) {
            new Setting(contentEl)
                .setName('Fecha')
                .addText(text => {
                    text.inputEl.type = 'date';
                    text.setValue(moment(this.entry.startTime).format('YYYY-MM-DD'));
                    text.onChange(value => {
                        const newDate = moment(value, 'YYYY-MM-DD');
                        const oldStartTime = moment(this.entry.startTime);
                        const oldEndTime = moment(this.entry.endTime);
                        this.entry.startTime = oldStartTime.year(newDate.year()).month(newDate.month()).date(newDate.date()).toISOString(true);
                        this.entry.endTime = oldEndTime.year(newDate.year()).month(newDate.month()).date(newDate.date()).toISOString(true);
                    });
                });
        }

        new Setting(contentEl)
            .setName('Hora de Inicio')
            .addText(text => {
                text.setValue(moment(this.entry.startTime).format('HH:mm'));
                text.onChange(value => {
                    const newTime = this.parseTime(value, moment(this.entry.startTime));
                    if (newTime) this.entry.startTime = newTime.toISOString(true);
                });
            });

        if (!this.isEditingActiveTimer) {
            new Setting(contentEl)
                .setName('Hora de Finalización')
                .addText(text => {
                    text.setValue(moment(this.entry.endTime).format('HH:mm'));
                    text.onChange(value => {
                        const newTime = this.parseTime(value, moment(this.entry.endTime));
                        if (newTime) this.entry.endTime = newTime.toISOString(true);
                    });
                });
        }

        new Setting(contentEl)
            .setName('Notas de la Sesión')
            .addTextArea(text => {
                text.setValue(this.entry.notes || ''); // Use only notes field
                text.onChange(value => this.entry.notes = value);
                text.inputEl.rows = 4;
            });

        const buttonContainer = new Setting(contentEl);
        if (this.isEditing) {
            buttonContainer.addButton(btn => btn
                .setButtonText('Eliminar')
                .setWarning()
                .onClick(() => this.delete()));
        }
        buttonContainer.addButton(btn => btn
            .setButtonText('Guardar')
            .setCta()
            .onClick(() => this.save()));
    }

    private parseTime(time: string, originalMoment: moment.Moment): moment.Moment | null {
        const [hours, minutes] = time.split(':').map(Number);
        if (hours !== undefined && minutes !== undefined && !isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            return originalMoment.clone().hours(hours).minutes(minutes).seconds(0).milliseconds(0);
        }
        return null;
    }

    async save() {
        if (!this.entry.taskNotePath) {
            new Notice('Por favor, seleccione una tarea.');
            return;
        }

        // Only validate duration for completed logs
        if (!this.isEditingActiveTimer) {
            const startTime = moment(this.entry.startTime);
            const endTime = moment(this.entry.endTime);
            const durationMinutes = endTime.diff(startTime, 'minutes');

            if (durationMinutes < 0) {
                new Notice('La hora de finalización no puede ser anterior a la de inicio.');
                return;
            }
            this.entry.durationMinutes = durationMinutes;
        }

        this.savedOrDeleted = true;
        // The caller is now responsible for the save logic.
        await this.onSave(this.entry);
        this.close();
    }

    async delete() {
        if (!this.isEditing || !this.entry.id) return;
        this.savedOrDeleted = true;
        // Use the service from the plugin instance
        await this.plugin.timeTrackerService.deleteLogEntry(this.entry.id);
        new Notice('Registro eliminado.');
        // We need a way to refresh the view after deletion.
        // The onSave callback is repurposed here to trigger a refresh.
        await this.onSave({});
        this.close();
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();

        // If the modal was dismissed without saving, and it was NOT for editing the active timer
        if (!this.savedOrDeleted && this.plugin.activeTimer && !this.isEditingActiveTimer) {
            console.log("Dovela PM: Time log modal dismissed. Restarting timer UI.");
            this.plugin.initializeTimerFromState(this.plugin.activeTimer);
        }
    }
}
