import { TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeLogModal } from './timeLogModal.js';
import type { Task, TimeLogEntry } from './model.js';
// Removed unused import: parseVault
import moment from 'moment';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

interface TreeNode {
    name: string;
    path: string;
    duration: number;
    recordCount: number; // <-- Añadido
    children: TreeNode[];
    logs?: TimeLogEntry[] | undefined; // Explicitly allow undefined
}

export class TimeTrackerView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private service: TimeTrackerService;
    
    private activeTimerInterval: number | null = null; // Reintroduced
    
    private statsContainer!: HTMLElement;
    private selectedTask: { path: string, description: string, lineNumber: number } | null = null;
    private searchInputEl!: HTMLInputElement;

    private activeDateFilter: string = 'today';
    private activeTaskSource: TaskSource = 'all-tasks';

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
        await this.renderStatistics(this.activeDateFilter);
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
                    return (taskOrFile as Task).content.toLowerCase().includes(searchTerm);
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

        const activeTaskDisplay = timerDiv.createEl('div', { cls: 'active-task-display is-hidden' });

        const buttonsContainer = timerDiv.createDiv({ cls: 'timer-buttons-container' });
        const startButton = buttonsContainer.createEl('button', { text: '▶️ Iniciar', cls: 'start-button' });
        const stopButton = buttonsContainer.createEl('button', { text: '⏹️ Detener', cls: 'stop-button', attr: { style: 'display: none;' } });
        const manualButton = buttonsContainer.createEl('button', { text: '+ Manual', cls: 'manual-button' });

        startButton.onClickEvent(async () => {
            if (!this.selectedTask) {
                new Notice("Por favor, seleccione una tarea para iniciar el temporizador.");
                return;
            }
            const { path, description, lineNumber } = this.selectedTask;
            
            this.startTimer(path, description, lineNumber, timerDisplay, startButton, stopButton);
        });

        stopButton.onClickEvent(() => {
            this.stopTimer(timerDisplay, startButton, stopButton);
        });

        manualButton.onClickEvent(() => {
            this.openManualEntryModal();
        });

        this.syncTimerUI(timerDisplay, startButton, stopButton, goToTaskButton, activeTaskDisplay);
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
            const filterKey = this.activeDateFilter as keyof typeof filters;
            titleText = `Estadísticas de Tiempo: ${filters[filterKey]}`;
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

        const updateTreeControlButtons = (activeButton: 'expand' | 'collapse') => {
            expandButton.classList.toggle('is-active', activeButton === 'expand');
            collapseButton.classList.toggle('is-active', activeButton === 'collapse');
        };

        expandButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => d.open = true);
            updateTreeControlButtons('expand');
        });

        collapseButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => {
                const level = parseInt(d.dataset['level'] || '99', 10);
                d.open = level < 2;
            });
            updateTreeControlButtons('collapse');
        });

        // Estado inicial por defecto
        updateTreeControlButtons('collapse');

        const { startDate, endDate } = this.getDateRange(filter);
        
        const logs = await this.service.loadTimeLogs();
        const filteredLogs = logs.filter(log => {
            const logTime = moment(log.startTime);
            if (startDate && logTime.isBefore(startDate)) return false;
            if (endDate && logTime.isAfter(endDate)) return false;
            return true;
        });

        // Resumen de Estadísticas del Período
        const totalDurationForPeriod = filteredLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
        const hours = Math.floor(totalDurationForPeriod / 60);
        const minutes = totalDurationForPeriod % 60;
        const totalLogs = filteredLogs.length;

        const summaryContainer = this.statsContainer.createDiv({ cls: 'stats-summary-container' });

        // Bloque para Tiempo Total
        const timeStatBlock = summaryContainer.createDiv({ cls: 'stat-block' });
        timeStatBlock.createEl('div', { text: `${hours}h ${minutes}m`, cls: 'stat-value' });
        timeStatBlock.createEl('div', { text: 'Tiempo Total', cls: 'stat-label' });

        // Bloque para Total de Registros
        const logsStatBlock = summaryContainer.createDiv({ cls: 'stat-block' });
        logsStatBlock.createEl('div', { text: totalLogs.toString(), cls: 'stat-value' });
        logsStatBlock.createEl('div', { text: 'Registros', cls: 'stat-label' });

        if (filteredLogs.length === 0) {
            this.statsContainer.createEl('p', { text: 'No hay registros de tiempo para el período seleccionado.' });
            return;
        }

        const tree = this.buildTree(filteredLogs);
        this.renderTree(tree, this.statsContainer, 0, totalDurationForPeriod);

        // Forzar el estado de colapso parcial inicial para que coincida con el botón.
        this.statsContainer.querySelectorAll('details.stats-table-row').forEach(d => {
            const detailElement = d as HTMLDetailsElement;
            const level = parseInt(detailElement.dataset['level'] || '99', 10);
            detailElement.open = level < 2;
        });
    }

    private renderFilterControls(parent: HTMLElement) {
        const filterContainer = parent.createDiv({ cls: 'time-stats-filters' });
        const filters: Record<string, string> = {
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
            case 'custom': {
                const customRange: { startDate?: moment.Moment, endDate?: moment.Moment } = {};
                if (this.customStartDate) customRange.startDate = this.customStartDate;
                if (this.customEndDate) customRange.endDate = this.customEndDate;
                return customRange;
            }
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
                if (!part) continue; // Skip empty parts
                
                const isFile = i === pathParts.length - 1 && part.endsWith('.md');
                
                if (currentPathAccumulator === '') {
                    currentPathAccumulator = part;
                } else {
                    currentPathAccumulator += '/' + part;
                }

                if (!finalTreeNodes[currentPathAccumulator]) {
                    finalTreeNodes[currentPathAccumulator] = {
                        name: isFile ? part.replace('.md', '') : part,
                        path: currentPathAccumulator,
                        duration: 0,
                        recordCount: 0, // <-- Añadido
                        children: [],
                        ...(isFile ? { logs: [] } : {}) // Only add logs property for files
                    };
                }

                // If it's the file itself, add the log
                if (isFile) {
                    const targetNode = finalTreeNodes[currentPathAccumulator];
                    if (targetNode && targetNode.logs) {
                        targetNode.logs.push(log);
                    }
                }
            }
        }

        // Link children to parents and sum durations for leaf nodes
        const sortedKeys = Object.keys(finalTreeNodes).sort((a, b) => a.length - b.length); // Process shorter paths (parents) first

        for (const path of sortedKeys) {
            const node = finalTreeNodes[path];
            if (!node) continue; // Skip if node doesn't exist
            
            // Sum duration and count from its own logs if it's a file (leaf node)
            if (node.logs) {
                node.duration = node.logs.reduce((sum, log) => sum + log.durationMinutes, 0);
                node.recordCount = node.logs.length; // <-- Añadido
                node.logs.sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());
            }

            const parentPath = path.substring(0, path.lastIndexOf('/'));
            const parentNode = finalTreeNodes[parentPath];
            if (parentPath && parentNode) {
                parentNode.children.push(node);
            }
        }

        // Final pass to sum up durations for parent nodes from their children (from leaves up to roots)
        const reverseSortedKeys = Object.keys(finalTreeNodes).sort((a, b) => b.length - a.length); // Process longer paths (leaves) first

        for (const path of reverseSortedKeys) {
            const node = finalTreeNodes[path];
            if (!node) continue; // Skip if node doesn't exist
            
            if (node.children.length > 0) {
                // Sum children's duration and record count to its own
                node.duration = node.children.reduce((sum, child) => sum + child.duration, node.duration);
                node.recordCount = node.children.reduce((sum, child) => sum + child.recordCount, node.recordCount); // <-- Añadido
            }
        }

        // Collect root nodes
        const finalRootNodes: TreeNode[] = [];
        for (const path in finalTreeNodes) {
            const node = finalTreeNodes[path];
            if (!node) continue; // Skip if node doesn't exist
            
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            const parentNode = finalTreeNodes[parentPath];
            if (!parentPath || !parentNode) { // If no parent or parent doesn't exist in our map, it's a root
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

            const rowContainer = parent.createEl('details', {
                cls: 'stats-table-row',
                attr: { 'data-level': level.toString(), open: level < 2 } // Open first two levels by default
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

            if (node.recordCount > 0) {
                statsCell.createEl('span', { text: `[${node.recordCount}]`, cls: 'stat-log-count' });
            }
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

    private syncTimerUI(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, goToTaskBtn: HTMLElement, activeTaskDisplay: HTMLElement) {
        // Clear any existing interval to prevent multiple timers running
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }

        if (this.plugin.activeTimer) {
            const { taskNotePath, taskDescription, startTime, lineNumber } = this.plugin.activeTimer;
            
            // Restore selected task
            this.selectedTask = { path: taskNotePath, description: taskDescription || '', lineNumber: lineNumber || 0 };
            this.searchInputEl.value = taskDescription || taskNotePath;
            this.searchInputEl.disabled = true;

            // Update UI to reflect running timer
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            
            activeTaskDisplay.setText(taskDescription || 'Seguimiento de nota completa');
            activeTaskDisplay.classList.remove('is-hidden');
            goToTaskBtn.classList.remove('is-hidden');

            goToTaskBtn.onclick = () => {
                this.plugin.app.workspace.openLinkText(taskNotePath, '', false, {
                    eState: { line: lineNumber }
                });
            };

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
            
            activeTaskDisplay.classList.add('is-hidden');
            goToTaskBtn.classList.add('is-hidden');
            goToTaskBtn.onclick = null;
        }
    }

    private startTimer(taskPath: string, taskDescription: string | undefined, lineNumber: number, timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (this.plugin.activeTimer) return;

        this.plugin.startTracking(taskPath, taskDescription || '', lineNumber);
        // We need to pass the other UI elements to syncTimerUI
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDisplay = this.container.querySelector('.active-task-display') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, goToTaskButton, activeTaskDisplay);
    }

    private stopTimer(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement) {
        if (!this.plugin.activeTimer) return;

        this.plugin.stopTracking();
        
        // Sincroniza la UI para reflejar que el temporizador se ha detenido
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDisplay = this.container.querySelector('.active-task-display') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, goToTaskButton, activeTaskDisplay);
    }

    private async openManualEntryModal() {
        // Abre el modal sin datos previos para el registro manual
        new TimeLogModal(this.plugin.app, this.service, this.plugin, async () => {
            await this.renderStatistics();
        }).open();
    }

    
}
