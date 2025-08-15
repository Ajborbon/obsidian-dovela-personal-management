import { DatePickerModal } from './datePickerModal.js';
import { TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeLogModal } from './timeLogModal.js';
import type { Task, TimeLogEntry } from './model.js';
import { formatDuration } from './durationUtils.js';
// Removed unused import: parseVault
import moment from 'moment';
import 'moment/locale/es';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';
type FolderType = 'ROOT' | 'AV' | 'AI' | 'PGTD' | 'PQ' | 'DEFAULT';

interface TreeNode {
    name: string;
    folderType: FolderType;
    path: string;
    duration: number; // Total duration (own + descendants)
    recordCount: number; // Total record count (own + descendants)
    ownDuration: number; // Duration from logs directly in this node (if it's a file)
    ownRecordCount: number; // Record count from logs directly in this node
    isTransitNode: boolean; // True if it has no own time and exactly one child
    children: TreeNode[];
    logs?: TimeLogEntry[] | undefined;
}

export class TimeTrackerView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private service: TimeTrackerService;
    
    private activeTimerInterval: number | null = null; // Reintroduced
    
    private statsContainer!: HTMLElement;
    private selectedTask: { path: string, description: string, lineNumber: number } | null = null;
    private searchInputEl!: HTMLInputElement;

    public activeDateFilter: string = 'today';
    private activeTaskSource: TaskSource = 'all-tasks';
    private currentDateFocus: moment.Moment = moment();

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

        const activeTaskDisplay = timerDiv.createEl('div', { cls: 'active-task-display is-hidden' });

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
            // This directly calls the method on the plugin instance
            (this.plugin as any).openEditActiveTimerModal();
        });

        manualButton.onClickEvent(() => {
            this.openManualEntryModal();
        });

        this.syncTimerUI(timerDisplay, startButton, stopButton, editButton, goToTaskButton, activeTaskDisplay);
    }

    public async renderStatistics(filter: string = 'all') {
        this.activeDateFilter = filter;
        this.statsContainer.empty();
        
        const { startDate, endDate } = this.getDateRange(filter);
        
        this.renderUnifiedDatePicker(this.statsContainer, filter, startDate, endDate);

        // --- Smart Jump Event Listener ---
        this.statsContainer.addEventListener('click', (event) => {
            const summary = (event.target as HTMLElement).closest('.stats-table-row-summary');
            if (!summary) return;

            const details = summary.parentElement as HTMLDetailsElement;
            // Only apply smart jump if the node is a transit node AND it's currently closed.
            if (details && details.classList.contains('is-transit-node') && !details.open) {
                event.preventDefault(); // Prevent the default single-level toggle.
                
                // Smart jump logic to open the entire chain.
                let currentElement: HTMLDetailsElement | null = details;
                while (currentElement && currentElement.classList.contains('is-transit-node')) {
                    currentElement.open = true;
                    const nextElement = currentElement.querySelector(':scope > .stats-table-row');
                    currentElement = nextElement ? nextElement as HTMLDetailsElement : null;
                }
            }
            // If the node is already open, we do nothing and let the default browser behavior handle the collapse.
        });


        
        // CORRECTO: Leer los logs directamente desde los datos del plugin.
        const logs = this.plugin.data.timeLogs;
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

    private generateTitleText(filter: string, startDate?: moment.Moment, endDate?: moment.Moment): string {
        moment.locale('es');
        let title = 'Estadísticas de Tiempo';

        if (!startDate) {
            return `${title}: Siempre`;
        }

        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        switch (filter) {
            case 'today':
            case 'single-day':
                return `${title}: ${capitalize(startDate.format('dddd, D [de] MMMM [de] YYYY'))}`;
            case 'week':
                const endOfWeek = startDate.clone().endOf('isoWeek');
                return `${title}: ${startDate.format('D MMM')} - ${endOfWeek.format('D MMM, YYYY')}`;
            case 'month':
                return `${title}: ${capitalize(startDate.format('MMMM [de] YYYY'))}`;
            case 'year':
                return `${title}: Año ${startDate.format('YYYY')}`;
            case 'custom':
                const start = this.customStartDate?.format('dddd, D MMM YYYY');
                const end = this.customEndDate?.format('dddd, D MMM YYYY');
                if (start && end) return `${title}: ${start} a ${end}`;
                if (start) return `${title}: Desde ${start}`;
                if (end) return `${title}: Hasta ${end}`;
                return `${title}: Rango Personalizado`;
            case 'all':
            default:
                return `${title}: Siempre`;
        }
    }

    private getDateRange(filter: string): { startDate?: moment.Moment, endDate?: moment.Moment } {
        const now = this.currentDateFocus.clone().local();
        let startDate: moment.Moment | undefined;
        let endDate: moment.Moment | undefined;

        switch (filter) {
            case 'today':
                startDate = now.clone().startOf('day');
                endDate = now.clone().endOf('day');
                break;
            case 'week':
                startDate = now.clone().startOf('isoWeek');
                endDate = now.clone().endOf('isoWeek');
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
            case 'single-day': {
                startDate = now.clone().startOf('day');
                endDate = now.clone().endOf('day');
                break;
            }
            default:
                return {}; // Fallback
        }
        return { startDate, endDate };
    }

    private customStartDate: moment.Moment | undefined;
    private customEndDate: moment.Moment | undefined;

    private renderUnifiedDatePicker(parent: HTMLElement, filter: string, startDate?: moment.Moment, endDate?: moment.Moment) {
        const controlsContainer = parent.createDiv({ cls: 'stats-controls-container' });
        const headerContainer = controlsContainer.createDiv({ cls: 'stats-header-container' });
    
        // Date Navigation (Left)
        const navContainer = headerContainer.createDiv({ cls: 'date-navigation' });
        const prevButton = navContainer.createEl('button', { text: '‹' });
        const nextButton = navContainer.createEl('button', { text: '›' });
    
        // Date Display Button (Center)
        const dateDisplayButton = navContainer.createEl('button', { 
            cls: 'date-display',
            text: this.generateTitleText(filter, startDate, endDate) 
        });
    
        // View Toolbar (Right)
        this.renderViewToolbar(headerContainer);
    
        // --- LOGIC ---
    
        // Navigation Logic
        const canNavigate = !['all', 'custom'].includes(filter);
        prevButton.disabled = !canNavigate;
        nextButton.disabled = !canNavigate;
    
        if (canNavigate) {
            const updateDateFocus = (direction: 'next' | 'prev') => {
                const amount = direction === 'next' ? 1 : -1;
                let unit: moment.unitOfTime.DurationConstructor = 'day';
                
                switch (filter) {
                    case 'week': unit = 'week'; break;
                    case 'month': unit = 'month'; break;
                    case 'year': unit = 'year'; break;
                    case 'today':
                    case 'single-day':
                    default: unit = 'day'; break;
                }
                this.currentDateFocus.add(amount, unit);
                this.renderStatistics(filter);
            };
    
            prevButton.onClickEvent(() => updateDateFocus('prev'));
            nextButton.onClickEvent(() => updateDateFocus('next'));
        }
    
        // Date Picker Modal Logic
        dateDisplayButton.onClickEvent(() => {
            new DatePickerModal(this.plugin.app, (result) => {
                if (result.filter === 'custom') {
                    this.customStartDate = result.startDate;
                    this.customEndDate = result.endDate;
                } else if (result.filter === 'single-day' && result.startDate) {
                    this.currentDateFocus = result.startDate;
                } else if (['today', 'week', 'month', 'year'].includes(result.filter)) {
                    this.currentDateFocus = moment();
                }
                this.renderStatistics(result.filter);
            }).open();
        });
    }
    
    private renderViewToolbar(parent: HTMLElement) {
        const toolbarContainer = parent.createDiv({ cls: 'view-toolbar' });
        const expandButton = toolbarContainer.createEl('button', { text: '🔽' });
        const collapseButton = toolbarContainer.createEl('button', { text: '🔼' });
    
        expandButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => d.open = true);
        });
    
        collapseButton.onClickEvent(() => {
            this.statsContainer.querySelectorAll('details').forEach(d => {
                const level = parseInt(d.dataset['level'] || '99', 10);
                d.open = level < 2;
            });
        });
    }

    private parseNodeName(name: string): { folderType: FolderType } {
        const rules: { regex: RegExp, type: FolderType }[] = [
            { regex: /^\d{2} - /, type: 'ROOT' },
            { regex: /^AV - /, type: 'AV' },
            { regex: /^AI - /, type: 'AI' },
            { regex: /^PGTD - /, type: 'PGTD' },
            { regex: /^PQ - /, type: 'PQ' }
        ];

        for (const rule of rules) {
            if (rule.regex.test(name)) {
                return { folderType: rule.type };
            }
        }

        return { folderType: 'DEFAULT' };
    }

    private buildTree(logs: TimeLogEntry[]): TreeNode[] {
        const treeNodes: { [key: string]: TreeNode } = {};

        // 1. Create all nodes from paths and assign logs to file nodes
        for (const log of logs) {
            if (!log.taskNotePath) continue;
            const pathParts = log.taskNotePath.split('/');
            let currentPath = '';

            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                currentPath = i === 0 ? part : `${currentPath}/${part}`;
                const isFile = i === pathParts.length - 1 && part.endsWith('.md');

                if (!treeNodes[currentPath]) {
                    const name = isFile ? part.replace('.md', '') : part;
                    const { folderType } = this.parseNodeName(name);
                    
                    treeNodes[currentPath] = {
                        name: name,
                        folderType: folderType,
                        path: currentPath,
                        duration: 0,
                        recordCount: 0,
                        ownDuration: 0,
                        ownRecordCount: 0,
                        isTransitNode: false,
                        children: [],
                        ...(isFile && { logs: [] })
                    };
                }

                if (isFile) {
                    treeNodes[currentPath].logs?.push(log);
                }
            }
        }

        // 2. Link children to parents
        const sortedKeys = Object.keys(treeNodes).sort((a, b) => a.length - b.length);
        for (const path of sortedKeys) {
            const node = treeNodes[path];
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (parentPath && treeNodes[parentPath]) {
                treeNodes[parentPath].children.push(node);
            }
        }

        // 3. Bottom-up traversal to calculate durations and identify transit nodes
        const reverseSortedKeys = sortedKeys.slice().reverse();
        for (const path of reverseSortedKeys) {
            const node = treeNodes[path];

            // Calculate own duration/count if it's a file with logs
            if (node.logs) {
                node.ownDuration = node.logs.reduce((sum, log) => sum + log.durationMinutes, 0);
                node.ownRecordCount = node.logs.length;
                node.logs.sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());
            }

            // Sum up from children
            const descendantDuration = node.children.reduce((sum, child) => sum + child.duration, 0);
            const descendantRecordCount = node.children.reduce((sum, child) => sum + child.recordCount, 0);

            node.duration = node.ownDuration + descendantDuration;
            node.recordCount = node.ownRecordCount + descendantRecordCount;

            // Identify transit node
            node.isTransitNode = node.ownDuration === 0 && node.children.length === 1;
        }

        // 4. Collect root nodes and sort children
        const rootNodes: TreeNode[] = [];
        for (const path of sortedKeys) {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (!parentPath || !treeNodes[parentPath]) {
                rootNodes.push(treeNodes[path]);
            }
        }

        function sortRecursive(nodes: TreeNode[]) {
            nodes.sort((a, b) => {
                const aIsFile = a.path.endsWith('.md');
                const bIsFile = b.path.endsWith('.md');
                if (aIsFile && !bIsFile) return 1;
                if (!bIsFile && aIsFile) return -1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => sortRecursive(node.children));
        }
        sortRecursive(rootNodes);

        return rootNodes;
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
                attr: { 
                    'data-level': level.toString(), 
                    'data-folder-type': node.folderType.toLowerCase(),
                    open: level < 2 
                }
            });

            if (node.isTransitNode) {
                rowContainer.classList.add('is-transit-node');
            }

            const summary = rowContainer.createEl('summary', { cls: 'stats-table-row-summary' });
            summary.style.paddingLeft = `${(level - 1) * 20}px`;

            const nameCell = summary.createEl('div', { cls: 'row-name' });
            const isFolder = node.children.length > 0;
            const iconEl = nameCell.createSpan({ cls: 'node-icon' });
            iconEl.setText(isFolder ? '📁' : '📄');
            
            nameCell.createEl('span', { text: node.name, cls: 'node-name-text' });

            const statsCell = summary.createEl('div', { cls: 'row-stats' });
            
            // --- NEW DURATION AND PERCENTAGE LOGIC ---
            const percentage = totalDurationForPeriod > 0 ? (node.duration / totalDurationForPeriod) * 100 : 0;
            
            let durationString = '';
            const hours = Math.floor(node.duration / 60);
            const minutes = node.duration % 60;

            if (node.duration < 60) {
                durationString = `${minutes}m`;
            } else {
                durationString = `${hours}h ${minutes}m`;
            }

            if (node.recordCount > 0) {
                statsCell.createEl('span', { text: `[${node.recordCount}]`, cls: 'stat-log-count' });
                statsCell.createEl('span', { text: durationString, cls: 'stat-duration' });
                statsCell.createEl('span', { text: `${percentage.toFixed(1)}%`, cls: 'stat-percentage-text' });
            }
            // --- END OF NEW LOGIC ---

            // Render children or logs
            if (node.children.length > 0) {
                this.renderTree(node.children, rowContainer, level + 1, totalDurationForPeriod);
            } else if (node.logs && node.logs.length > 0) {
                const logsContainer = rowContainer.createEl('div', { cls: 'log-details-container' });
                for (const log of node.logs) {
                    const logEntryEl = logsContainer.createEl('div', { cls: 'log-entry' });
                    
                    // Añadir evento de clic para abrir el modal de edición
                    logEntryEl.addEventListener('click', () => {
                        const onSaveCallback = async (updatedEntry: Partial<TimeLogEntry>) => {
                            if (updatedEntry.id) {
                                await this.plugin.timeTrackerService.updateLogEntry(updatedEntry.id, updatedEntry);
                            }
                            this.renderStatistics(this.activeDateFilter);
                        };
                        new TimeLogModal(this.plugin.app, this.plugin, onSaveCallback, log, false).open();
                    });

                    const date = moment(log.startTime);
                    const startTime = date.format('HH:mm');
                    const endTime = moment(log.endTime).format('HH:mm');
                    const dayOfWeek = date.locale('es').format('dddd');
                    
                    // Contenedor principal para la fecha
                    const dateLineEl = logEntryEl.createEl('div', { cls: 'log-entry-line log-entry-date-container' });

                    // "Badge" del calendario
                    const dateBadge = dateLineEl.createEl('div', { cls: 'date-badge' });
                    dateBadge.createEl('span', { text: date.format('MMM'), cls: 'date-badge-month' });
                    dateBadge.createEl('span', { text: date.format('D'), cls: 'date-badge-day' });

                    // Contexto de la fecha (Día de la semana, Año)
                    const dateContext = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${date.format('YYYY')}`;
                    dateLineEl.createEl('span', { text: dateContext, cls: 'date-context' });

                    const formattedDuration = formatDuration(log.durationMinutes);
                    const timeLineEl = logEntryEl.createEl('div', { cls: 'log-entry-line log-entry-time-line' });
                    
                    timeLineEl.createEl('span', { text: `🕒 ${startTime} → ${endTime}` });
                    timeLineEl.createEl('span', { text: formattedDuration, cls: 'duration-pill' });
                    
                    // Mostrar la descripción de la tarea solo si es diferente del nombre del proyecto
                    if (log.taskDescription && log.taskDescription !== node.name) {
                        logEntryEl.createEl('div', { cls: 'log-entry-line' })
                            .setText(`📌 Tarea: ${log.taskDescription}`);
                    }
                    
                    // Mostrar las notas si existen
                    if (log.notes) {
                        logEntryEl.createEl('div', { cls: 'log-entry-line' })
                            .setText(`📝 Nota: ${log.notes}`);
                    }
                }
            }
        }
    }

    public refreshTimerUI() {
        const timerDisplay = this.container.querySelector('.timer-display') as HTMLElement;
        const startButton = this.container.querySelector('.start-button') as HTMLElement;
        const stopButton = this.container.querySelector('.stop-button') as HTMLElement;
        const editButton = this.container.querySelector('.edit-button') as HTMLElement;
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDisplay = this.container.querySelector('.active-task-display') as HTMLElement;

        if (timerDisplay && startButton && stopButton && editButton && goToTaskButton && activeTaskDisplay) {
            this.syncTimerUI(timerDisplay, startButton, stopButton, editButton, goToTaskButton, activeTaskDisplay);
        }
    }

    public clearTimerInterval() {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
    }

    private syncTimerUI(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, editBtn: HTMLElement, goToTaskBtn: HTMLElement, activeTaskDisplay: HTMLElement) {
        // Clear any existing interval to prevent multiple timers running
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }

        const isTimerActive = !!this.plugin.activeTimer;

        // Toggle visibility using the 'is-hidden' class
        startBtn.classList.toggle('is-hidden', isTimerActive);
        stopBtn.classList.toggle('is-hidden', !isTimerActive);
        editBtn.classList.toggle('is-hidden', !isTimerActive);
        goToTaskBtn.classList.toggle('is-hidden', !isTimerActive);
        activeTaskDisplay.classList.toggle('is-hidden', !isTimerActive);

        if (isTimerActive) {
            const { taskNotePath, taskDescription, startTime, lineNumber } = this.plugin.activeTimer!;
            
            this.selectedTask = { path: taskNotePath, description: taskDescription || '', lineNumber: lineNumber || 0 };
            this.searchInputEl.value = taskDescription || taskNotePath;
            this.searchInputEl.disabled = true;
            
            activeTaskDisplay.setText(taskDescription || 'Seguimiento de nota completa');

            goToTaskBtn.onclick = () => {
                this.plugin.app.workspace.openLinkText(taskNotePath, '', false, {
                    eState: { line: lineNumber }
                });
            };

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
        // We need to pass the other UI elements to syncTimerUI
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDisplay = this.container.querySelector('.active-task-display') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, editBtn, goToTaskButton, activeTaskDisplay);
    }

    private stopTimer(timerDisplay: HTMLElement, startBtn: HTMLElement, stopBtn: HTMLElement, editBtn: HTMLElement) {
        if (!this.plugin.activeTimer) return;

        this.plugin.stopTracking();
        
        // Sincroniza la UI para reflejar que el temporizador se ha detenido
        const goToTaskButton = this.container.querySelector('.goto-task-button') as HTMLElement;
        const activeTaskDisplay = this.container.querySelector('.active-task-display') as HTMLElement;
        this.syncTimerUI(timerDisplay, startBtn, stopBtn, editBtn, goToTaskButton, activeTaskDisplay);
    }

    private async openManualEntryModal() {
        const onSaveCallback = async (entryData: Partial<TimeLogEntry>) => {
            if (entryData.id) {
                await this.plugin.timeTrackerService.updateLogEntry(entryData.id, entryData);
            } else {
                await this.plugin.timeTrackerService.addLogEntry(entryData as Omit<TimeLogEntry, 'id'>);
            }
            await this.renderStatistics(this.activeDateFilter);
        };

        // Abre el modal sin datos previos para el registro manual
        new TimeLogModal(this.plugin.app, this.plugin, onSaveCallback, {}).open();
    }

    
}
