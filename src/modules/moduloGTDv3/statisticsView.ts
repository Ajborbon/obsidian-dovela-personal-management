
import { DatePickerModal } from './datePickerModal.js';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { TimeLogEntry } from './model.js';
import { formatDuration } from './durationUtils.js';
import { TimeLogModal } from './timeLogModal.js';
import moment from 'moment';
import 'moment/locale/es';
import * as XLSX from 'xlsx';
import { Notice, Menu } from 'obsidian';

type FolderType = 'ROOT' | 'AV' | 'AI' | 'PGTD' | 'PQ' | 'DEFAULT';

interface TreeNode {
    name: string;
    folderType: FolderType;
    path: string;
    duration: number;
    recordCount: number;
    ownDuration: number;
    ownRecordCount: number;
    isTransitNode: boolean;
    children: TreeNode[];
    logs?: TimeLogEntry[] | undefined;
}

export class StatisticsView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    
    public activeDateFilter: string = 'today';
    private currentDateFocus: moment.Moment = moment();
    private customStartDate: moment.Moment | undefined;
    private customEndDate: moment.Moment | undefined;

    constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin) {
        this.container = container;
        this.plugin = plugin;
        this.renderStatistics(this.activeDateFilter);
    }

    public updateContainer(newContainer: HTMLElement) {
        this.container = newContainer;
        this.renderStatistics(this.activeDateFilter);
    }

    public async renderStatistics(filter: string = 'all') {
        this.activeDateFilter = filter;
        this.container.empty();
        
        const { startDate, endDate } = this.getDateRange(filter);
        
        this.renderUnifiedDatePicker(this.container, filter, startDate, endDate);

        // --- Smart Jump Event Listener ---
        this.container.addEventListener('click', (event) => {
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
        });

        const logs = this.plugin.data.timeLogs;
        const filteredLogs = logs.filter(log => {
            const logTime = moment(log.startTime);
            if (startDate && logTime.isBefore(startDate)) return false;
            if (endDate && logTime.isAfter(endDate)) return false;
            return true;
        });

        const totalDurationForPeriod = filteredLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
        const hours = Math.floor(totalDurationForPeriod / 60);
        const minutes = totalDurationForPeriod % 60;
        const totalLogs = filteredLogs.length;

        const summaryContainer = this.container.createDiv({ cls: 'stats-summary-container' });

        const timeStatBlock = summaryContainer.createDiv({ cls: 'stat-block' });
        timeStatBlock.createEl('div', { text: `${hours}h ${minutes}m`, cls: 'stat-value' });
        timeStatBlock.createEl('div', { text: 'Tiempo Total', cls: 'stat-label' });

        const logsStatBlock = summaryContainer.createDiv({ cls: 'stat-block' });
        logsStatBlock.createEl('div', { text: totalLogs.toString(), cls: 'stat-value' });
        logsStatBlock.createEl('div', { text: 'Registros', cls: 'stat-label' });

        if (filteredLogs.length === 0) {
            this.container.createEl('p', { text: 'No hay registros de tiempo para el período seleccionado.' });
            return;
        }

        const tree = this.buildTree(filteredLogs);
        this.renderTree(tree, this.container, 0, totalDurationForPeriod);

        this.container.querySelectorAll('details.stats-table-row').forEach(d => {
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

    private renderUnifiedDatePicker(parent: HTMLElement, filter: string, startDate?: moment.Moment, endDate?: moment.Moment) {
        const controlsContainer = parent.createDiv({ cls: 'stats-controls-container' });
        const headerContainer = controlsContainer.createDiv({ cls: 'stats-header-container' });
    
        // Izquierda: Flechas de Navegación
        const navArrowsContainer = headerContainer.createDiv({ cls: 'date-navigation' });
        const prevButton = navArrowsContainer.createEl('button', { text: '‹' });
        const nextButton = navArrowsContainer.createEl('button', { text: '›' });
    
        // Centro: Botón de Despliegue de Fecha
        const dateDisplayButton = headerContainer.createEl('button', { 
            cls: 'date-display',
            text: this.generateTitleText(filter, startDate, endDate) 
        });
    
        // Derecha: Barra de Herramientas de la Vista
        this.renderViewToolbar(headerContainer);
    
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
            this.container.querySelectorAll('details').forEach(d => d.open = true);
        });
    
        collapseButton.onClickEvent(() => {
            this.container.querySelectorAll('details').forEach(d => {
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

        const sortedKeys = Object.keys(treeNodes).sort((a, b) => a.length - b.length);
        for (const path of sortedKeys) {
            const node = treeNodes[path];
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (parentPath && treeNodes[parentPath]) {
                treeNodes[parentPath].children.push(node);
            }
        }

        const reverseSortedKeys = sortedKeys.slice().reverse();
        for (const path of reverseSortedKeys) {
            const node = treeNodes[path];

            if (node.logs) {
                node.ownDuration = node.logs.reduce((sum, log) => sum + log.durationMinutes, 0);
                node.ownRecordCount = node.logs.length;
                node.logs.sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());
            }

            const descendantDuration = node.children.reduce((sum, child) => sum + child.duration, 0);
            const descendantRecordCount = node.children.reduce((sum, child) => sum + child.recordCount, 0);

            node.duration = node.ownDuration + descendantDuration;
            node.recordCount = node.ownRecordCount + descendantRecordCount;

            node.isTransitNode = node.ownDuration === 0 && node.children.length === 1;
        }

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
        if (level === 0) {
            const tableBody = parent.createEl('div', { cls: 'stats-table-body' });
            this.renderTree(nodes, tableBody, level + 1, totalDurationForPeriod);
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

            summary.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const menu = new Menu();
                menu.addItem((item) =>
                    item
                        .setTitle('Exportar a Excel')
                        .setIcon('document')
                        .onClick(() => {
                            this.exportNodeToExcel(node);
                        })
                );
                menu.showAtMouseEvent(event);
            });

            const nameCell = summary.createEl('div', { cls: 'row-name' });
            const isFolder = node.children.length > 0;
            const iconEl = nameCell.createSpan({ cls: 'node-icon' });
            iconEl.setText(isFolder ? '📁' : '📄');
            
            nameCell.createEl('span', { text: node.name, cls: 'node-name-text' });

            const statsCell = summary.createEl('div', { cls: 'row-stats' });
            
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

            if (node.children.length > 0) {
                this.renderTree(node.children, rowContainer, level + 1, totalDurationForPeriod);
            } else if (node.logs && node.logs.length > 0) {
                const logsContainer = rowContainer.createEl('div', { cls: 'log-details-container' });
                for (const log of node.logs) {
                    const logEntryEl = logsContainer.createEl('div', { cls: 'log-entry' });
                    
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
                    
                    const dateLineEl = logEntryEl.createEl('div', { cls: 'log-entry-line log-entry-date-container' });

                    const dateBadge = dateLineEl.createEl('div', { cls: 'date-badge' });
                    dateBadge.createEl('span', { text: date.format('MMM'), cls: 'date-badge-month' });
                    dateBadge.createEl('span', { text: date.format('D'), cls: 'date-badge-day' });

                    const dateContext = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${date.format('YYYY')}`;
                    dateLineEl.createEl('span', { text: dateContext, cls: 'date-context' });

                    const formattedDuration = formatDuration(log.durationMinutes);
                    const timeLineEl = logEntryEl.createEl('div', { cls: 'log-entry-line log-entry-time-line' });
                    
                    timeLineEl.createEl('span', { text: `🕒 ${startTime} → ${endTime}` });
                    timeLineEl.createEl('span', { text: formattedDuration, cls: 'duration-pill' });
                    
                    if (log.taskDescription && log.taskDescription !== node.name) {
                        logEntryEl.createEl('div', { cls: 'log-entry-line' })
                            .setText(`📌 Tarea: ${log.taskDescription}`);
                    }
                    
                    if (log.notes) {
                        logEntryEl.createEl('div', { cls: 'log-entry-line' })
                            .setText(`📝 Nota: ${log.notes}`);
                    }
                }
            }
        }
    }

    private collectLogsFromNode(node: TreeNode): TimeLogEntry[] {
        let logs: TimeLogEntry[] = [];

        if (node.logs) {
            logs = logs.concat(node.logs);
        }

        for (const child of node.children) {
            logs = logs.concat(this.collectLogsFromNode(child));
        }

        return logs;
    }

    private getFilterDateRangeText(): string {
        const { startDate, endDate } = this.getDateRange(this.activeDateFilter);
        
        switch (this.activeDateFilter) {
            case 'today':
                return 'Hoy';
            case 'week':
                return `Semana del ${startDate?.format('D MMM')}`;
            case 'month':
                return startDate?.format('MMMM YYYY') || 'Mes Actual';
            case 'year':
                return `Año ${startDate?.format('YYYY')}`;
            case 'all':
                return 'Siempre';
            case 'custom':
                if (startDate && endDate) {
                    return `${startDate.format('YYYY-MM-DD')} a ${endDate.format('YYYY-MM-DD')}`;
                } else if (startDate) {
                    return `Desde ${startDate.format('YYYY-MM-DD')}`;
                } else if (endDate) {
                    return `Hasta ${endDate.format('YYYY-MM-DD')}`;
                }
                return 'Rango Personalizado';
            case 'single-day':
                return startDate?.format('YYYY-MM-DD') || 'Día específico';
            default:
                return 'General';
        }
    }

    private exportNodeToExcel(node: TreeNode) {
        const logs = this.collectLogsFromNode(node);

        if (logs.length === 0) {
            new Notice('No hay registros de tiempo para exportar en este nodo.');
            return;
        }

        // Ordenar los registros por fecha de inicio
        logs.sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());

        const dataForSheet = logs.map(log => {
            const startTime = moment(log.startTime);
            const endTime = moment(log.endTime);
            const finalTaskName = log.taskNotePath?.split('/').pop()?.replace('.md', '') || 'N/A';

            return {
                'Ruta Completa': log.taskNotePath?.replace('.md', '') || '',
                'Tarea': finalTaskName,
                'Descripción Tarea': log.taskDescription,
                'Fecha': startTime.format('YYYY-MM-DD'),
                'Día de la Semana': startTime.locale('es').format('dddd'),
                'Hora Inicio': startTime.format('HH:mm'),
                'Hora Fin': endTime.format('HH:mm'),
                'Duración (Minutos)': log.durationMinutes,
                'Duración (hh:mm)': formatDuration(log.durationMinutes, true),
                'Notas del Registro': log.notes || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Tiempo');

        // Auto-ajustar el ancho de las columnas
        const colsWidth = Object.keys(dataForSheet[0]).map(key => {
            const maxLength = Math.max(...dataForSheet.map(row => (row[key as keyof typeof row] ?? '').toString().length), key.length);
            return { wch: maxLength + 2 }; // +2 para un poco de padding
        });
        worksheet['!cols'] = colsWidth;

        const dateRangeText = this.getFilterDateRangeText();
        const fileName = `Exportación - ${node.name} - ${dateRangeText}.xlsx`;

        try {
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            new Notice('La exportación a Excel ha comenzado.');
        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            new Notice('Error al generar el archivo Excel. Consulte la consola para más detalles.');
        }
    }
}
