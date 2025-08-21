import { App, Modal, Setting, TFile, Notice, setIcon } from 'obsidian';
import type { Task, TimeLogEntry } from './model.js';
import moment from 'moment';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TaskSelectionAnalyzer } from './taskSelectionAnalyzer.js';

// The callback now passes the entry data back to the caller.
type OnSaveCallback = (entry: Partial<TimeLogEntry>) => Promise<void>;

export class TimeLogModal extends Modal {
    private plugin: DovelaPersonalManagementPlugin;
    private onSave: OnSaveCallback;
    private entry: Partial<TimeLogEntry> & { taskNotePath: string; taskDescription: string; startTime: string; endTime: string; };
    private availableTasks: (TFile | Task)[] = [];
    private isEditing: boolean;
    private isEditingActiveTimer: boolean; // Flag for our new mode
    private closeTaskCheckbox: HTMLElement | null = null;
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
        } as Partial<TimeLogEntry> & { taskNotePath: string; taskDescription: string; startTime: string; endTime: string; };
    }

    override async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        // Set title based on the mode
        this.titleEl.setText(this.isEditingActiveTimer ? 'Modificar Temporizador Activo' : (this.isEditing ? 'Editar Registro de Tiempo' : 'Registrar Tiempo'));

        // Mejorar la X de cierre en móvil
        const closeButton = this.modalEl.querySelector('.modal-close-button');
        if (closeButton) {
            closeButton.setAttribute('style', 'min-width: 44px; min-height: 44px; touch-action: manipulation;');
            closeButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            });
        }

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
            const notePath = this.entry.taskNotePath;
            if (notePath) {
                this.app.workspace.openLinkText(notePath, '', true);
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
                    text.setValue(moment(String(this.entry.startTime)).format('YYYY-MM-DD'));
                    text.onChange(value => {
                        const newDate = moment(value, 'YYYY-MM-DD');
                        const oldStartTime = moment(String(this.entry.startTime));
                        const oldEndTime = moment(String(this.entry.endTime));
                        this.entry.startTime = oldStartTime.year(newDate.year()).month(newDate.month()).date(newDate.date()).toISOString(true);
                        this.entry.endTime = oldEndTime.year(newDate.year()).month(newDate.month()).date(newDate.date()).toISOString(true);
                    });
                });
        }

        new Setting(contentEl)
            .setName('Hora de Inicio')
                .addText(text => {
                text.setValue(moment(String(this.entry.startTime)).format('HH:mm'));
                text.onChange(value => {
                    const newTime = this.parseTime(value, moment(String(this.entry.startTime)));
                    if (newTime) this.entry.startTime = newTime.toISOString(true);
                });
            });

        if (!this.isEditingActiveTimer) {
            new Setting(contentEl)
                .setName('Hora de Finalización')
                .addText(text => {
                    text.setValue(moment(String(this.entry.endTime)).format('HH:mm'));
                    text.onChange(value => {
                        const newTime = this.parseTime(value, moment(String(this.entry.endTime)));
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

        // Agregar opción de cerrar tarea solo cuando se está registrando tiempo completado
        // y hay una tarea específica (no solo cuando se está editando un temporizador activo)
        if (this.shouldShowCloseCheckbox()) {
            const closeTaskSetting = new Setting(contentEl)
                .setName('Cerrar tarea activa?')
                .setDesc('No usar en tareas recurrentes 🔁.')
                .addToggle(toggle => {
                    this.closeTaskCheckbox = toggle.toggleEl;
                    toggle.setValue(true); // Marcar como seleccionado por defecto
                });
            
            // Añadir el texto personalizado después del toggle
            const labelText = closeTaskSetting.controlEl.createSpan({
                text: 'Cerrar la tarea ✅ ' + moment().format('YYYY-MM-DD'),
                cls: 'task-close-label'
            });
            
            // Hacer que el texto también sea clickeable
            labelText.addEventListener('click', () => {
                const currentValue = this.closeTaskCheckbox?.classList.contains('is-enabled');
                if (currentValue) {
                    this.closeTaskCheckbox?.removeClass('is-enabled');
                } else {
                    this.closeTaskCheckbox?.addClass('is-enabled');
                }
            });
        }

        const buttonContainer = new Setting(contentEl);
        if (this.isEditing) {
            buttonContainer.addButton(btn => btn
                .setButtonText('Eliminar')
                .setWarning()
                .onClick(() => this.delete()));
        }
        buttonContainer.addButton(btn => btn
            .setButtonText('Cancelar')
            .onClick(() => this.close()));
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

    /**
     * Decide si debe mostrarse el checkbox "Cerrar tarea" para la entrada actual.
     * Lógica simplificada:
     * 1) Si estamos editando el temporizador activo o editando un registro -> false.
     * 2) Si no hay taskNotePath -> false.
     * 3) Si hay taskDescription y es diferente del nombre del archivo -> true (es una tarea específica).
     * 4) Si no hay taskDescription o es igual al nombre del archivo -> false (es un proyecto/nota).
     */
    private shouldShowCloseCheckbox(): boolean {
        if (this.isEditingActiveTimer || this.isEditing) return false;
        if (!this.entry.taskNotePath) return false;
        if (!this.entry.taskDescription) return false;

        // Obtener el nombre del archivo sin extensión
        const fileName = this.entry.taskNotePath.split('/').pop()?.replace(/\.md$/, '') || '';
        
        // Si taskDescription es diferente del nombre del archivo, es una tarea específica
        const isSpecificTask = this.entry.taskDescription !== fileName && 
                               this.entry.taskDescription !== this.entry.taskNotePath &&
                               this.entry.taskDescription.length > 0;
        
        return isSpecificTask;
    }

    async save() {
        if (!this.entry.taskNotePath) {
            new Notice('Por favor, seleccione una tarea.');
            return;
        }

        // Only validate duration for completed logs
        if (!this.isEditingActiveTimer) {
            const startTime = moment(String(this.entry.startTime));
            const endTime = moment(String(this.entry.endTime));
            const durationMinutes = endTime.diff(startTime, 'minutes');

            if (durationMinutes < 0) {
                new Notice('La hora de finalización no puede ser anterior a la de inicio.');
                return;
            }
            this.entry.durationMinutes = durationMinutes;
        }

        // Intentar cerrar la tarea si la opción está seleccionada
        const shouldCloseTask = this.closeTaskCheckbox?.classList.contains('is-enabled') === true;
        let taskClosed = false;
        
        if (shouldCloseTask) {
            const taskNotePath = this.entry.taskNotePath;
            const taskDescription = this.entry.taskDescription;
            if (taskNotePath) {
                taskClosed = await this.closeTaskInFile(taskNotePath, taskDescription);
            }
        }

        this.savedOrDeleted = true;
        // The caller is now responsible for the save logic.
        await this.onSave(this.entry);
        
        // Mostrar mensaje apropiado según si se cerró la tarea
        if (taskClosed) {
            new Notice('Registro guardado y tarea marcada como completada.');
        }
        
        this.close();
    }

    async delete() {
        if (!this.isEditing || !this.entry.id) return;
        this.savedOrDeleted = true;
        // Use the service from the plugin instance
        if (this.entry.id) {
            await this.plugin.timeTrackerService.deleteLogEntry(this.entry.id);
        }
        new Notice('Registro eliminado.');
        // We need a way to refresh the view after deletion.
        // The onSave callback is repurposed here to trigger a refresh.
        await this.onSave({});
        this.close();
    }

    /**
     * Cierra una tarea en el archivo especificado
     * @param taskNotePath - Ruta del archivo donde está la tarea
     * @param taskDescription - Descripción de la tarea para encontrarla
     * @returns true si la tarea se cerró exitosamente, false en caso contrario
     */
    private async closeTaskInFile(taskNotePath: string, taskDescription?: string): Promise<boolean> {
        try {
            // Obtener el archivo
            const file = this.app.vault.getAbstractFileByPath(taskNotePath);
            if (!(file instanceof TFile)) {
                console.warn(`Dovela PM: No se pudo encontrar el archivo: ${taskNotePath}`);
                return false;
            }

            // Leer el contenido del archivo
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            // Buscar la línea de la tarea
            let taskLineIndex = -1;
            
            if (taskDescription) {
                // Buscar por descripción de tarea
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] ?? '';
                    if (TaskSelectionAnalyzer.isValidTaskLine(line)) {
                        const content = TaskSelectionAnalyzer.extractTaskContent(line);
                        if (content && content.includes(taskDescription)) {
                            taskLineIndex = i;
                            break;
                        }
                    }
                }
            }
            
            // Si no se encontró por descripción, buscar la primera tarea abierta o en progreso
            if (taskLineIndex === -1) {
                for (let i = 0; i < lines.length; i++) {
                    // Asegurarse de pasar siempre un string a getTaskState (evitar string | undefined)
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
            
            console.log('Dovela PM: Tarea cerrada exitosamente');
            return true;
            
        } catch (error) {
            console.error('Dovela PM: Error al cerrar la tarea:', error);
            new Notice('Error al cerrar la tarea. Revisa la consola para más detalles.');
            return false;
        }
    }

    /**
     * Crea una línea de tarea completada con fecha de finalización
     * @param originalLine - Línea original de la tarea
     * @param completionDate - Fecha de finalización en formato YYYY-MM-DD
     * @returns Nueva línea con estado completado o null si hay error
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

        // If the modal was dismissed without saving, and it was NOT for editing the active timer
        if (!this.savedOrDeleted && this.plugin.activeTimer && !this.isEditingActiveTimer) {
            console.log("Dovela PM: Time log modal dismissed. Restarting timer UI.");
            this.plugin.initializeTimerFromState(this.plugin.activeTimer);
        }
    }
}
