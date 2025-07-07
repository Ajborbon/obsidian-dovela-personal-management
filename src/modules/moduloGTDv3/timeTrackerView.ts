import { TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeLogModal } from './timeLogModal.js';
import type { Task } from './model.js';
import { parseVault } from './parser.js';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

interface TreeNode {
    name: string;
    path: string;
    duration: number;
    children: TreeNode[];
}

export class TimeTrackerView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private service: TimeTrackerService;
    
    private activeTimerInterval: number | null = null;
    private availableTasks: (TFile | Task)[] = [];
    private statsContainer!: HTMLElement;
    private taskSelectorDropdown!: HTMLSelectElement;
    private selectedTask: { path: string, description: string } | null = null;
    private searchInputEl!: HTMLInputElement;

    private activeDateFilter: string = 'all';

    constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin, service: TimeTrackerService) {
        this.container = container;
        this.plugin = plugin;
        this.service = service;
        this.render();
    }

    public updateContainer(newContainer: HTMLElement) {
        this.container = newContainer;
        this.render();
    }

    private async render() {
        this.container.empty();
        const mainDiv = this.container.createEl('div', { cls: 'time-tracker-main' });

        const controlPanel = mainDiv.createEl('div', { cls: 'time-tracker-control-panel' });
        await this.renderTaskSelector(controlPanel);
        this.renderTimerControls(controlPanel);

        this.statsContainer = mainDiv.createEl('div', { cls: 'time-tracker-stats-panel' });
        await this.renderStatistics();
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
                resultEl.dataset['path'] = path;
                resultEl.dataset['description'] = description;

                resultEl.onClickEvent(() => {
                    this.selectedTask = { path, description };
                    this.searchInputEl.value = text;
                    resultsContainer.empty(); // Hide results after selection
                    // Optionally, highlight the selected item
                    resultsContainer.querySelectorAll('.result-item').forEach(el => el.classList.remove('is-selected'));
                    resultEl.classList.add('is-selected');
                });
            });
        };

        this.searchInputEl.addEventListener('input', () => {
            const searchTerm = this.searchInputEl.value.toLowerCase();
            const filteredTasks = this.availableTasks.filter(taskOrFile => {
                if (taskOrFile instanceof TFile) {
                    return taskOrFile.path.toLowerCase().includes(searchTerm);
                } else {
                    return (taskOrFile as Task).content.toLowerCase().includes(searchTerm);
                }
            });
            renderResults(filteredTasks);
        });

        const createSourceButton = (source: TaskSource, name: string) => {
            const button = sourceContainer.createEl('button', { text: name });
            button.onClickEvent(async () => {
                this.availableTasks = await this.getTasks(source);
                renderResults(this.availableTasks);
                this.searchInputEl.focus();
            });
        };

        createSourceButton('open-notes', 'Notas Abiertas');
        createSourceButton('in-progress', 'En Progreso');
        createSourceButton('all-tasks', 'Todas');
    }

    private renderTimerControls(parent: HTMLElement) {
        const timerDiv = parent.createDiv('timer-controls');
        const timerDisplay = timerDiv.createEl('span', { text: '00:00:00', cls: 'timer-display' });
        
        const startButton = timerDiv.createEl('button', { text: '▶️ Iniciar', cls: 'start-button' });
        const stopButton = timerDiv.createEl('button', { text: '⏹️ Detener', cls: 'stop-button', attr: { style: 'display: none;' } });
        const manualButton = timerDiv.createEl('button', { text: '+ Manual', cls: 'manual-button' });

        startButton.onClickEvent(async () => {
            if (!this.selectedTask) {
                new Notice("Por favor, seleccione una tarea para iniciar el temporizador.");
                return;
            }
            const { path, description } = this.selectedTask;
            
            this.startTimer(path, description, timerDisplay, startButton, stopButton);
        });

        stopButton.onClickEvent(() => {
            this.stopTimer(timerDisplay, startButton, stopButton);
        });

        manualButton.onClickEvent(() => {
            this.openManualEntryModal();
        });
    }

    private async renderStatistics(filter: string = 'all') {
        this.activeDateFilter = filter;
        this.statsContainer.empty();
        this.statsContainer.createEl('h3', { text: 'Estadísticas de Tiempo' });

        this.renderFilterControls(this.statsContainer);

        const customFilterContainer = this.statsContainer.createDiv({ cls: 'custom-filter-container is-hidden' });
        this.renderCustomFilterControls(customFilterContainer);

        const { startDate, endDate } = this.getDateRange(filter);
        
        const logs = await this.service.loadTimeLogs();
        const stats = this.service.getStatistics(logs, { startDate, endDate });

        if (stats.size === 0) {
            this.statsContainer.createEl('p', { text: 'No hay registros de tiempo para el período seleccionado.' });
            return;
        }

        const tree = this.buildTree(stats);
        this.renderTree(tree, this.statsContainer, 0);
    }

    private renderFilterControls(parent: HTMLElement) {
        const filterContainer = parent.createDiv({ cls: 'time-stats-filters' });
        const filters = {
            'today': 'Hoy',
            'week': 'Esta Semana',
            'month': 'Este Mes',
            'year': 'Este Año',
            'all': 'Siempre',
            'custom': 'Personalizado'
        };

        for (const [key, value] of Object.entries(filters)) {
            const button = filterContainer.createEl('button', { 
                text: value, 
                cls: this.activeDateFilter === key ? 'is-active' : '' 
            });
            button.onClickEvent(() => {
                const customContainer = this.statsContainer.querySelector('.custom-filter-container');
                if (key === 'custom') {
                    customContainer?.classList.remove('is-hidden');
                } else {
                    customContainer?.classList.add('is-hidden');
                }
                this.renderStatistics(key)
            });
        }
    }

    private renderCustomFilterControls(parent: HTMLElement) {
        const startDateInput = parent.createEl('input', { type: 'date' });
        const endDateInput = parent.createEl('input', { type: 'date' });
        const applyButton = parent.createEl('button', { text: 'Aplicar' });

        applyButton.onClickEvent(() => {
            this.customStartDate = startDateInput.value ? new Date(startDateInput.value) : undefined;
            this.customEndDate = endDateInput.value ? new Date(endDateInput.value) : undefined;
            this.renderStatistics('custom');
        });
    }

    private getDateRange(filter: string): { startDate?: Date, endDate?: Date } {
        const now = new Date();
        let startDate: Date | undefined;
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (filter) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday as first day
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
                return {}; // No filter
            case 'custom':
                return { startDate: this.customStartDate, endDate: this.customEndDate };
            default:
                return {}; // Fallback
        }
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
    }

    private customStartDate: Date | undefined;
    private customEndDate: Date | undefined;

    private buildTree(stats: Map<string, number>): TreeNode[] {
        const nodes: { [key: string]: TreeNode } = {};

        // Create all nodes
        for (const path of Array.from(stats.keys()).sort()) {
            nodes[path] = {
                name: path.split('/').pop() || path,
                path: path,
                duration: stats.get(path)!,
                children: []
            };
        }

        const tree: TreeNode[] = [];
        // Link children to parents
        for (const path in nodes) {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (nodes[parentPath]) {
                nodes[parentPath].children.push(nodes[path]);
            } else {
                tree.push(nodes[path]);
            }
        }

        return tree;
    }

    private renderTree(nodes: TreeNode[], parent: HTMLElement, level: number) {
        const ul = parent.createEl('ul', { cls: `tree-level-${level}` });
        for (const node of nodes) {
            const li = ul.createEl('li');
            const container = li.createEl('div', { cls: 'tree-node-container' });
            
            const hours = Math.floor(node.duration / 60);
            const minutes = node.duration % 60;
            const text = `${node.name} (${hours}h ${minutes}m)`;

            if (node.children.length > 0) {
                const details = container.createEl('details', { attr: { open: true } });
                details.createEl('summary', { text });
                this.renderTree(node.children, details, level + 1);
            } else {
                container.createEl('div', { text, cls: 'tree-leaf-node' });
            }
        }
    }

    private startTimer(taskPath: string, taskDescription: string | undefined, timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (this.plugin.activeTimer) return;

        this.plugin.activeTimer = {
            taskNotePath: taskPath,
            startTime: new Date().toISOString(),
            taskDescription: taskDescription || ''
        };
        const taskName = taskPath.split('/').pop()?.replace('.md', '') || 'Tarea';
        this.plugin.updateStatusBar(`${taskName}...`);

        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        this.searchInputEl.disabled = true;

        const startTime = new Date(this.plugin.activeTimer.startTime).getTime();
        this.activeTimerInterval = window.setInterval(() => {
            const now = Date.now();
            const diff = now - startTime;
            const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}:${seconds}`;
            timerDisplay.setText(timeString);
            this.plugin.updateStatusBar(`${taskName}... ${timeString}`);
        }, 1000);
    }

    private stopTimer(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (!this.plugin.activeTimer || this.activeTimerInterval === null) return;

        clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = null;

        const endTime = new Date();
        const startTime = new Date(this.plugin.activeTimer.startTime);

        new TimeLogModal(this.plugin.app, this.service, this.availableTasks, async () => {
            await this.renderStatistics();
        }, {
            taskNotePath: this.plugin.activeTimer.taskNotePath,
            startTime: startTime,
            endTime: endTime,
            notes: this.plugin.activeTimer.taskDescription || '',
            taskDescription: this.plugin.activeTimer.taskDescription || ''
        }).open();

        this.plugin.activeTimer = null;
        this.plugin.updateStatusBar('');
        timerDisplay.setText('00:00:00');
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        this.searchInputEl.disabled = false;
    }

    private async openManualEntryModal() {
        new TimeLogModal(this.plugin.app, this.service, this.availableTasks, async () => {
            await this.renderStatistics();
        }).open();
    }

    private async getTasks(source: TaskSource): Promise<(TFile | Task)[]> {
        const allTasks = (await parseVault(this.plugin.app.vault, this.plugin.app.metadataCache)).allTasks;

        switch (source) {
            case 'open-notes':
                return this.plugin.app.workspace.getLeavesOfType('markdown').map(leaf => (leaf.view as any).file as TFile).filter(f => f);
            case 'in-progress':
                return allTasks.filter((t: Task) => t.status === 'in-progress');
            case 'all-tasks':
                 return allTasks.filter((t: Task) => t.status !== 'completed');
            default:
                return [];
        }
    }
}
