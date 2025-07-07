import { TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeLogModal } from './timeLogModal.js';
import type { Task, TimeLogEntry } from './model.js';
import { parseVault } from './parser.js';
import moment from 'moment';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

interface TreeNode {
    name: string;
    path: string;
    duration: number;
    children: TreeNode[];
    logs?: TimeLogEntry[]; // Add logs property
}

export class TimeTrackerView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private service: TimeTrackerService;
    
    private activeTimerInterval: number | null = null; // Reintroduced
    
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
        const dashboard = this.container.createEl('div', { cls: 'time-tracker-dashboard' });

        // Columna Izquierda: Panel de Control
        const controlPanel = dashboard.createEl('div', { cls: 'time-tracker-control-panel' });
        
        const timerCard = controlPanel.createEl('div', { cls: 'control-card' });
        timerCard.createEl('h4', { text: 'Control de Tiempo' });

        const selectorCard = controlPanel.createEl('div', { cls: 'control-card' });
        selectorCard.createEl('h4', { text: 'Seleccionar Tarea' });

        // Columna Derecha: Panel de Estadísticas
        this.statsContainer = dashboard.createEl('div', { cls: 'time-tracker-stats-panel' });

        // Populate elements in the correct order to avoid dependency errors
        await this.renderTaskSelector(selectorCard);
        this.renderTimerControls(timerCard);
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
            const filteredTasks = this.plugin.availableTasks.filter(taskOrFile => {
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
                await this.plugin.loadAvailableTasks(source);
                renderResults(this.plugin.availableTasks);
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

        this.syncTimerUI(timerDisplay, startButton, stopButton);
    }

    public async renderStatistics(filter: string = 'all') {
        this.activeDateFilter = filter;
        this.statsContainer.empty();
        
        let titleText = 'Estadísticas de Tiempo';
        const filters = {
            'today': 'Hoy',
            'week': 'Esta Semana',
            'month': 'Este Mes',
            'year': 'Este Año',
            'all': 'Siempre',
            'custom': 'Personalizado'
        };

        if (this.activeDateFilter === 'custom') {
            const start = this.customStartDate ? this.customStartDate.format('YYYY-MM-DD') : '';
            const end = this.customEndDate ? this.customEndDate.format('YYYY-MM-DD') : '';
            if (start && end) {
                titleText = `Estadísticas de Tiempo: ${start} - ${end}`;
            } else if (start) {
                titleText = `Estadísticas de Tiempo: Desde ${start}`;
            } else if (end) {
                titleText = `Estadísticas de Tiempo: Hasta ${end}`;
            }
        } else {
            titleText = `Estadísticas de Tiempo: ${filters[this.activeDateFilter]}`;
        }

        this.statsContainer.createEl('h3', { text: titleText });

        // --- Contenedor de Controles de la Vista de Estadísticas ---
        const statsControls = this.statsContainer.createDiv({ cls: 'stats-view-controls' });

        // Controles de Filtro de Fecha
        this.renderFilterControls(statsControls);
        const customFilterContainer = statsControls.createDiv({ cls: 'custom-filter-container is-hidden' });
        this.renderCustomFilterControls(customFilterContainer);

        // Controles de Expansión/Colapso del Árbol
        const treeControls = statsControls.createDiv({ cls: 'tree-controls' });
        const expandButton = treeControls.createEl('button', { text: 'Expandir Todo' });
        const collapseButton = treeControls.createEl('button', { text: 'Colapsar Parcialmente' });

        expandButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => d.open = true);
        });

        collapseButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => {
                const level = parseInt(d.dataset.level || '99', 10);
                d.open = level < 2;
            });
        });

        const { startDate, endDate } = this.getDateRange(filter);
        
        const logs = await this.service.loadTimeLogs();
        const filteredLogs = logs.filter(log => {
            const logTime = moment(log.startTime);
            if (startDate && logTime.isBefore(startDate)) return false;
            if (endDate && logTime.isAfter(endDate)) return false;
            return true;
        });

        // Indicador de Tiempo Total
        const totalDurationForPeriod = filteredLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
        const hours = Math.floor(totalDurationForPeriod / 60);
        const minutes = totalDurationForPeriod % 60;
        const totalDisplay = this.statsContainer.createDiv({ cls: 'total-duration-display' });
        totalDisplay.createEl('span', { text: 'Total Registrado en Período:', cls: 'total-duration-label' });
        totalDisplay.createEl('span', { text: `${hours}h ${minutes}m`, cls: 'total-duration-value' });

        if (filteredLogs.length === 0) {
            this.statsContainer.createEl('p', { text: 'No hay registros de tiempo para el período seleccionado.' });
            return;
        }

        const tree = this.buildTree(filteredLogs);
        this.renderTree(tree, this.statsContainer, 0, totalDurationForPeriod);
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
                    this.renderStatistics(key);
                }
            });
        }
    }

    private renderCustomFilterControls(parent: HTMLElement) {
        const startDateInput = parent.createEl('input', { type: 'date' });
        const endDateInput = parent.createEl('input', { type: 'date' });
        const applyButton = parent.createEl('button', { text: 'Aplicar' });

        // Set initial values if custom dates are already set
        if (this.customStartDate) {
            startDateInput.value = this.customStartDate.format('YYYY-MM-DD');
        }
        if (this.customEndDate) {
            endDateInput.value = this.customEndDate.format('YYYY-MM-DD');
        }

        applyButton.onClickEvent(() => {
            this.customStartDate = startDateInput.value ? moment(startDateInput.value).startOf('day') : undefined;
            this.customEndDate = endDateInput.value ? moment(endDateInput.value).endOf('day') : undefined;
            this.renderStatistics('custom');
        });
    }

    private getDateRange(filter: string): { startDate?: moment.Moment, endDate?: moment.Moment } {
        const now = moment().local();
        let startDate: moment.Moment | undefined;
        let endDate: moment.Moment | undefined;

        switch (filter) {
            case 'today':
                startDate = now.clone().startOf('day');
                endDate = now.clone().endOf('day');
                break;
            case 'week':
                startDate = now.clone().startOf('isoWeek');
                endDate = now.clone().endOf('day'); // End of current day
                break;
            case 'month':
                startDate = now.clone().startOf('month');
                endDate = now.clone().endOf('month');
                break;
            case 'year':
                startDate = now.clone().startOf('year');
                endDate = now.clone().endOf('year');
                break;
            case 'all':
                return {}; // No filter
            case 'custom':
                if (this.customStartDate) {
                    startDate = this.customStartDate.clone().startOf('day');
                }
                if (this.customEndDate) {
                    endDate = this.customEndDate.clone().endOf('day');
                }
                return { startDate, endDate };
            default:
                return {}; // Fallback
        }
        return { startDate, endDate };
    }

    private customStartDate: moment.Moment | undefined;
    private customEndDate: moment.Moment | undefined;

    private buildTree(logs: TimeLogEntry[]): TreeNode[] {
        const finalTreeNodes: { [key: string]: TreeNode } = {}; // Map to hold all nodes, including intermediate directories

        // Create all nodes (directories and files) and assign logs to files
        for (const log of logs) {
            if (!log.taskNotePath) continue;
            const pathParts = log.taskNotePath.split('/');
            let currentPathAccumulator = '';

            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const isFile = i === pathParts.length - 1 && part.endsWith('.md');
                
                if (currentPathAccumulator === '') {
                    currentPathAccumulator = part;
                } else {
                    currentPathAccumulator += '/' + part;
                }

                if (!finalTreeNodes[currentPathAccumulator]) {
                    finalTreeNodes[currentPathAccumulator] = {
                        name: isFile ? part.replace('.md', '') : part, // Remove .md for display
                        path: currentPathAccumulator,
                        duration: 0,
                        children: [],
                        logs: isFile ? [] : undefined // Only files get logs
                    };
                }

                // If it's the file itself, add the log
                if (isFile) {
                    finalTreeNodes[currentPathAccumulator].logs?.push(log);
                }
            }
        }

        // Link children to parents and sum durations for leaf nodes
        const sortedKeys = Object.keys(finalTreeNodes).sort((a, b) => a.length - b.length); // Process shorter paths (parents) first

        for (const path of sortedKeys) {
            const node = finalTreeNodes[path];
            
            // Sum duration from its own logs if it's a file (leaf node)
            if (node.logs) {
                node.duration = node.logs.reduce((sum, log) => sum + log.durationMinutes, 0);
                node.logs.sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());
            }

            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (parentPath && finalTreeNodes[parentPath]) {
                finalTreeNodes[parentPath].children.push(node);
            }
        }

        // Final pass to sum up durations for parent nodes from their children (from leaves up to roots)
        const reverseSortedKeys = Object.keys(finalTreeNodes).sort((a, b) => b.length - a.length); // Process longer paths (leaves) first

        for (const path of reverseSortedKeys) {
            const node = finalTreeNodes[path];
            if (node.children.length > 0) {
                // Sum children's duration to its own (if it's a file, it already has its own duration from logs)
                node.duration = node.children.reduce((sum, child) => sum + child.duration, node.duration);
            }
        }

        // Collect root nodes
        const finalRootNodes: TreeNode[] = [];
        for (const path in finalTreeNodes) {
            const node = finalTreeNodes[path];
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (!parentPath || !finalTreeNodes[parentPath]) { // If no parent or parent doesn't exist in our map, it's a root
                finalRootNodes.push(node);
            }
        }

        // Sort children within each node and root nodes
        function sortNodes(nodes: TreeNode[]) {
            nodes.sort((a, b) => {
                // Directories first, then files
                const aIsFile = a.path.endsWith('.md');
                const bIsFile = b.path.endsWith('.md');
                if (aIsFile && !bIsFile) return 1;
                if (!aIsFile && bIsFile) return -1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => sortNodes(node.children));
        }
        sortNodes(finalRootNodes);

        return finalRootNodes;
    }

    private renderTree(nodes: TreeNode[], parent: HTMLElement, level: number, totalDurationForPeriod: number) {
        // Create header only at the top level
        if (level === 0) {
            const tableBody = parent.createEl('div', { cls: 'stats-table-body' });
            this.renderTree(nodes, tableBody, level + 1, totalDurationForPeriod); // Recurse into a body
            return;
        }

        for (const node of nodes) {
            const isExpandable = node.children.length > 0 || (node.logs && node.logs.length > 0);

            const rowContainer = parent.createEl('details', {
                cls: 'stats-table-row',
                attr: { 'data-level': level, open: level < 2 } // Open first two levels by default
            });

            const summary = rowContainer.createEl('summary', { cls: 'stats-table-row-summary' });
            summary.style.paddingLeft = `${(level - 1) * 20}px`;

            const nameCell = summary.createEl('div', { cls: 'row-name' });
            const icon = node.children.length > 0 ? '📁' : '📄';
            nameCell.createEl('span', { text: `${icon} ${node.name}`, cls: 'node-name-text' });

            const statsCell = summary.createEl('div', { cls: 'row-stats' });
            const hours = Math.floor(node.duration / 60);
            const minutes = node.duration % 60;
            const percentage = totalDurationForPeriod > 0 ? (node.duration / totalDurationForPeriod) * 100 : 0;

            statsCell.createEl('span', { text: `${hours}h ${minutes}m`, cls: 'stat-duration' });
            
            const percentageContainer = statsCell.createEl('div', { cls: 'stat-percentage' });
            percentageContainer.createEl('span', { text: `${percentage.toFixed(2)}%` });
            const progressBar = percentageContainer.createEl('div', { cls: 'progress-bar-container' });
            progressBar.createEl('div', { cls: 'progress-bar' }).style.width = `${percentage}%`;

            // Render children or logs
            if (node.children.length > 0) {
                this.renderTree(node.children, rowContainer, level + 1, totalDurationForPeriod);
            } else if (node.logs && node.logs.length > 0) {
                const logsContainer = rowContainer.createEl('div', { cls: 'log-details-container' });
                for (const log of node.logs) {
                    const logEntryEl = logsContainer.createEl('div', { cls: 'log-entry' });
                    
                    const date = moment(log.startTime);
                    const dayOfWeek = date.locale('es').format('dddd');
                    const formattedDate = date.format('YYYY-MM-DD');
                    const startTime = date.format('HH:mm');
                    const endTime = moment(log.endTime).format('HH:mm');

                    logEntryEl.createEl('div', { cls: 'log-entry-line' })
                        .setText(`🗓️ ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${formattedDate}`);
                    
                    logEntryEl.createEl('div', { cls: 'log-entry-line' })
                        .setText(`🕒 Inicio: ${startTime} - Fin: ${endTime} (${log.durationMinutes}m)`);
                    
                    const notes = log.notes || log.taskDescription;
                    if (notes) {
                        logEntryEl.createEl('div', { cls: 'log-entry-line' })
                            .setText(`📝 Nota: ${notes}`);
                    }
                }
            }
        }
    }

    public clearTimerInterval() {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
    }

    private syncTimerUI(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        // Clear any existing interval to prevent multiple timers running
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }

        if (this.plugin.activeTimer) {
            const { taskNotePath, taskDescription, startTime } = this.plugin.activeTimer;
            
            // Restore selected task
            this.selectedTask = { path: taskNotePath, description: taskDescription || '' };
            this.searchInputEl.value = taskDescription || taskNotePath;
            this.searchInputEl.disabled = true;

            // Update UI to reflect running timer
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';

            const startTimeMoment = moment(startTime);
            
            // Start local UI update interval
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
            // Ensure timer is reset if no active session
            timerDisplay.setText('00:00:00');
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.searchInputEl.disabled = false;
        }
    }

    private startTimer(taskPath: string, taskDescription: string | undefined, timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (this.plugin.activeTimer) return;

        this.plugin.startTracking(taskPath, taskDescription || '');
        this.syncTimerUI(timerDisplay, startBtn, stopBtn);
    }

    private stopTimer(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (!this.plugin.activeTimer) return;

        this.plugin.stopTracking(this.availableTasks);
        this.syncTimerUI(timerDisplay, startBtn, stopBtn);
    }

    private async openManualEntryModal() {
        new TimeLogModal(this.plugin.app, this.service, this.plugin.availableTasks, async () => {
            await this.renderStatistics();
        }).open();
    }

    
}
