import { TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeLogModal } from './timeLogModal.js';
import type { Task, TimeLogEntry } from './model.js';
import moment from 'moment';
import 'moment/locale/es';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

export class TimeTrackerView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private _service: TimeTrackerService;
    
    private activeTimerInterval: number | null = null;
    
    private selectedTask: { path: string, description: string, lineNumber: number } | null = null;
    private searchInputEl!: HTMLInputElement;

    private activeTaskSource: TaskSource = 'all-tasks';

    constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin, service: TimeTrackerService) {
        this.container = container;
        this.plugin = plugin;
        this._service = service;
        // Mark _service as used to satisfy the compiler (the service is intentionally unused here).
        void this._service;
        this.render();
    }

    public updateContainer(newContainer: HTMLElement) {
        this.container = newContainer;
        this.render();
    }

    private async render() {
        this.container.empty();
        const dashboard = this.container.createEl('div', { cls: 'time-tracker-dashboard' });

        const controlPanel = dashboard.createEl('div', { cls: 'time-tracker-control-panel' });
        
        const timerCard = controlPanel.createEl('div', { cls: 'control-card' });
        timerCard.createEl('h4', { text: 'Control de Tiempo' });

        const selectorCard = controlPanel.createEl('div', { cls: 'control-card' });
        selectorCard.createEl('h4', { text: 'Seleccionar Tarea' });

        await this.renderTaskSelector(selectorCard);
        this.renderTimerControls(timerCard);
    }

    private async renderTaskSelector(parent: HTMLElement) {
        const selectorContainer = parent.createDiv('time-tracker-task-selector');
        
        const sourceContainer = selectorContainer.createDiv({ cls: 'source-selector' });
        this.searchInputEl = selectorContainer.createEl('input', { 
            type: 'text', 
            placeholder: 'Buscar tarea...',
            cls: 'search-input'
        });
        const resultsContainer = selectorContainer.createDiv({ cls: 'results-container' });

        const renderResults = (tasks: (TFile | Task)[]) => {
            resultsContainer.empty();
            tasks.forEach(taskOrFile => {
                const resultEl = resultsContainer.createDiv({ cls: 'result-item' });
                let path: string, text: string, description: string, lineNumber: number;

                if (taskOrFile instanceof TFile) {
                    path = taskOrFile.path;
                    text = taskOrFile.path;
                    description = taskOrFile.basename;
                    lineNumber = 0; // Default for a whole note
                } else {
                    const task = taskOrFile as Task;
                    path = task.sourceFile.path;
                    text = `${task.content.substring(0, 100)}... (${task.sourceFile.basename})`;
                    description = task.content;
                    lineNumber = task.lineNumber;
                }
                resultEl.setText(text);
                resultEl.dataset['path'] = path;
                resultEl.dataset['description'] = description;
                resultEl.dataset['linenumber'] = lineNumber.toString();

                resultEl.onClickEvent(() => {
                    this.selectedTask = { path, description, lineNumber };
                    this.searchInputEl.value = text;
                    resultsContainer.style.display = 'none'; // Ocultar en lugar de vaciar
                    
                    // Gestionar la clase 'is-selected'
                    resultsContainer.querySelectorAll('.result-item').forEach(el => el.classList.remove('is-selected'));
                    resultEl.classList.add('is-selected');
                });
            });
        };

        this.searchInputEl.addEventListener('input', () => {
            resultsContainer.style.display = 'block'; // Mostrar al escribir
            const searchTerm = this.searchInputEl.value.toLowerCase();
            const filteredTasks = this.plugin.availableTasks.filter(taskOrFile => {
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

        const updateButtons = () => {
            sourceContainer.querySelectorAll('button').forEach(btn => {
                if (btn.dataset['source'] === this.activeTaskSource) {
                    btn.classList.add('is-active');
                } else {
                    btn.classList.remove('is-active');
                }
            });
        };

        const createSourceButton = (source: TaskSource, name: string) => {
            const button = sourceContainer.createEl('button', { text: name });
            button.dataset['source'] = source;
            button.onClickEvent(async () => {
                this.activeTaskSource = source;
                updateButtons();
                await this.plugin.loadAvailableTasks(source);
                renderResults(this.plugin.availableTasks);
                this.searchInputEl.focus();
            });
        };

        createSourceButton('open-notes', 'Notas Abiertas');
        createSourceButton('in-progress', 'En Progreso');
        createSourceButton('all-tasks', 'Todas');
        
        updateButtons(); // Set initial active button

        // Load initial tasks
        await this.plugin.loadAvailableTasks(this.activeTaskSource);
        renderResults(this.plugin.availableTasks);
        resultsContainer.style.display = 'none'; // Hide initially
    }

    private renderTimerControls(parent: HTMLElement) {
        const timerDiv = parent.createDiv('timer-controls');
        
        const timerDisplayContainer = timerDiv.createDiv({ cls: 'timer-display-container' });
        const timerDisplay = timerDisplayContainer.createEl('span', { text: '00:00:00', cls: 'timer-display' });
        const goToTaskButton = timerDisplayContainer.createEl('button', { 
            text: '↗️', 
            cls: 'goto-task-button is-hidden',
            attr: { 'aria-label': 'Ir a la tarea' }
        });

        // Contenedor estructurado para detalles de la tarea activa
        const activeTaskDetailsContainer = timerDiv.createDiv({ cls: 'active-task-details-container is-hidden' });

        const buttonsContainer = timerDiv.createDiv({ cls: 'timer-buttons-container' });
        const startButton = buttonsContainer.createEl('button', { text: '▶️ Iniciar', cls: 'start-button' });
        const stopButton = buttonsContainer.createEl('button', { text: '⏹️ Detener', cls: 'stop-button is-hidden' });
        const editButton = buttonsContainer.createEl('button', { text: '✏️ Modificar', cls: 'edit-button is-hidden' });
        const manualButton = buttonsContainer.createEl('button', { text: '+ Manual', cls: 'manual-button' });

        startButton.onClickEvent(async () => {
            if (!this.selectedTask) {
                new Notice("Por favor, seleccione una tarea para iniciar el temporizador.");
                return;
            }
            const { path, description, lineNumber } = this.selectedTask;
            
            this.startTimer(path, description, lineNumber, timerDisplay, startButton, stopButton, editButton);
        });

        stopButton.onClickEvent(() => {
            this.stopTimer(timerDisplay, startButton, stopButton, editButton);
        });

        editButton.onClickEvent(() => {
            (this.plugin as any).openEditActiveTimerModal();
        });

        manualButton.onClickEvent(() => {
            this.openManualEntryModal();
        });

        this.syncTimerUI(timerDisplay, startButton, stopButton, editButton, goToTaskButton, activeTaskDetailsContainer);
    }

    

    public refreshTimerUI() {
        const timerDisplay = this.container.querySelector('.timer-display') as HTMLElement;
        const startButton = this.container.querySelector('.start-button') as HTMLElement;
        const stopButton = this.container.querySelector('.stop-button') as HTMLElement;
        const editButton = this.container.querySelector('.edit-button') as HTMLElement;
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDetailsContainer = this.container.querySelector('.active-task-details-container') as HTMLElement;

        if (timerDisplay && startButton && stopButton && editButton && goToTaskButton && activeTaskDetailsContainer) {
            this.syncTimerUI(timerDisplay, startButton, stopButton, editButton, goToTaskButton, activeTaskDetailsContainer);
        }
    }

    public clearTimerInterval() {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
    }

    private syncTimerUI(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, editBtn: HTMLElement, goToTaskBtn: HTMLElement, activeTaskDetailsContainer: HTMLElement) {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }

        const isTimerActive = !!this.plugin.activeTimer;

        startBtn.classList.toggle('is-hidden', isTimerActive);
        stopBtn.classList.toggle('is-hidden', !isTimerActive);
        editBtn.classList.toggle('is-hidden', !isTimerActive);
        goToTaskBtn.classList.toggle('is-hidden', !isTimerActive);
        activeTaskDetailsContainer.classList.toggle('is-hidden', !isTimerActive);
        
        activeTaskDetailsContainer.empty();

        if (isTimerActive) {
            const { taskNotePath, taskDescription, startTime, lineNumber, notes } = this.plugin.activeTimer!;
            
            this.selectedTask = { path: taskNotePath, description: taskDescription || '', lineNumber: lineNumber || 0 };
            this.searchInputEl.value = taskDescription || taskNotePath;
            this.searchInputEl.disabled = true;

            const projectName = taskNotePath.split('/').pop()?.replace('.md', '') || 'N/A';

            const createDetailRow = (label: string, value?: string) => {
                if (!value) return; // No renderizar si no hay valor
                const row = activeTaskDetailsContainer.createDiv({ cls: 'task-detail-row' });
                row.createEl('strong', { text: `${label}:` });
                row.createEl('span', { text: value });
            };

            createDetailRow('Proyecto', projectName);

            // Lógica condicional para mostrar la tarea
            if (taskDescription && taskDescription !== projectName) {
                createDetailRow('Tarea', taskDescription);
            }

            createDetailRow('Notas', notes);

            if (taskNotePath) {
                goToTaskBtn.onclick = () => {
                    this.plugin.app.workspace.openLinkText(taskNotePath, '', false, {
                        eState: { line: lineNumber }
                    });
                };
            } else {
                goToTaskBtn.onclick = null;
            }

            const startTimeMoment = moment(startTime);
            
            this.activeTimerInterval = window.setInterval(() => {
                const now = moment().local();
                const diff = now.diff(startTimeMoment);
                const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                const timeString = `${hours}:${minutes}:${seconds}`;
                timerDisplay.setText(timeString);
            }, 1000);

        } else {
            timerDisplay.setText('00:00:00');
            this.searchInputEl.disabled = false;
            goToTaskBtn.onclick = null;
        }
    }

    private startTimer(taskPath: string, taskDescription: string | undefined, lineNumber: number, timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, editBtn: HTMLElement) {
        if (this.plugin.activeTimer) return;

        this.plugin.startTracking(taskPath, taskDescription || '', lineNumber);
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDetailsContainer = this.container.querySelector('.active-task-details-container') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, editBtn, goToTaskButton, activeTaskDetailsContainer);
    }

    private stopTimer(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, editBtn: HTMLElement) {
        if (!this.plugin.activeTimer) return;

        this.plugin.stopTracking();
        
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDetailsContainer = this.container.querySelector('.active-task-details-container') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, editBtn, goToTaskButton, activeTaskDetailsContainer);
    }

    private async openManualEntryModal() {
        const onSaveCallback = async (entryData: Partial<TimeLogEntry>) => {
            if (entryData.id) {
                const id = entryData.id as string;
                await this.plugin.timeTrackerService.updateLogEntry(id, entryData);
            } else {
                await this.plugin.timeTrackerService.addLogEntry(entryData as Omit<TimeLogEntry, 'id'>);
            }
            // Since statistics view is separate, we don't need to call renderStatistics here.
            // Consider a more robust refresh mechanism if needed in the future.
        };

        new TimeLogModal(this.plugin.app, this.plugin, onSaveCallback, {}).open();
    }

    
}
