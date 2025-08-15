
import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from '../moduloGTDv3/timeTrackerService.js';
import { TimeTrackerView } from '../moduloGTDv3/timeTrackerView.js';
import { StatisticsView } from '../moduloGTDv3/statisticsView.js';
import { TimelineView } from '../moduloGTDv3/timelineView.js';

// Import from the new "foco" module
import { parseFocus } from './focoParser.js';
import { buildHierarchy } from './focoHierarchyBuilder.js';
import { processGtdLists } from './focoProcessor.js';
import { processInProgressTasks } from '../moduloGTDv3/inProgressProcessor.js';
import { generateGtdViewHtml } from './focoHtmlGenerator.js';
import type { ProcessedVaultData, HierarchicalItem } from './focoModel.js';

export const FOCO_VIEW_TYPE = 'foco-gtd-view';
export const FOCO_VIEW_DISPLAY_TEXT = 'Vista de Foco';
export const FOCO_VIEW_ICON = 'crosshair';

export class FocoView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private timeTrackerService: TimeTrackerService;
    public timeTrackerView: TimeTrackerView | null = null;
    public statisticsView: StatisticsView | null = null;
    private timelineView: TimelineView | null = null;
    private activeFile: TFile | null = null;

    private activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'statistics' | 'timeline' = 'hierarchy';
    private activeGrouping: 'none' | 'context' | 'person' | 'project' = 'none';
    private activeSorting: 'priority' | 'duration-asc' | 'duration-desc' = 'priority';
    private eventAbortController: AbortController = new AbortController();

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin, activeFile: TFile | null) {
        super(leaf);
        this.plugin = plugin;
        this.timeTrackerService = this.plugin.timeTrackerService;
        this.activeFile = activeFile;
    }

    getViewType(): string {
        return FOCO_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.activeFile ? `${FOCO_VIEW_DISPLAY_TEXT}: ${this.activeFile.basename}` : FOCO_VIEW_DISPLAY_TEXT;
    }

    override getIcon(): string {
        return FOCO_VIEW_ICON;
    }

    override async onOpen() {
        this.contentEl.innerHTML = `<div class="gtd-loading">Cargando ${this.getDisplayText()}...</div>`;
        if (this.activeFile) {
            await this.drawView(this.activeFile);
        } else {
            this.contentEl.innerHTML = '<div class="gtd-error">No se ha proporcionado un archivo activo para enfocar.</div>';
        }
    }

    override async onClose() {
        this.eventAbortController?.abort();
        this.timeTrackerView?.clearTimerInterval();
        this.timelineView?.clear();
        this.contentEl.empty();
    }

    public switchToTimeTrackerView(): void {
        if (this.activeView !== 'time-tracker') {
            this.activeView = 'time-tracker';
            if (this.activeFile) this.drawView(this.activeFile);
        }
    }

    public async refreshStatistics(): Promise<void> {
        if (this.statisticsView) {
            await this.statisticsView.renderStatistics(this.statisticsView.activeDateFilter);
        }
    }

    private createTaskBreadcrumbMap(hierarchicalData: HierarchicalItem[]): Map<string, string> {
        const breadcrumbMap = new Map<string, string>();
        function traverse(item: HierarchicalItem, path: string[]) {
            const cleanName = item.name.replace(/\s*\[FALTA\]\s*/g, '');
            const currentPath = [...path, cleanName];
            for (const task of item.tasks) {
                breadcrumbMap.set(task.id, currentPath.join(' > '));
            }
            for (const child of item.children) {
                traverse(child, currentPath);
            }
        }
        for (const rootItem of hierarchicalData) {
            traverse(rootItem, []);
        }
        return breadcrumbMap;
    }

    private async drawView(activeFile: TFile): Promise<void> {
        this.eventAbortController?.abort();
        this.eventAbortController = new AbortController();

        try {
            const parsedData = await parseFocus(activeFile, this.app.vault, this.app.metadataCache);
            const hierarchicalData = buildHierarchy(parsedData.hierarchicalData);
            const taskBreadcrumbMap = this.createTaskBreadcrumbMap(hierarchicalData);

            const allTaskMap = new Map(parsedData.allTasks.map(task => [task.id, task]));
            const { gtdLists, uniqueContexts, uniquePeople } = processGtdLists(parsedData.allTasks, allTaskMap);
            const inProgressData = processInProgressTasks(parsedData.allTasks, this.activeGrouping, this.activeSorting);

            const finalData: ProcessedVaultData = {
                hierarchicalData: hierarchicalData,
                gtdLists: gtdLists,
                inProgressData: inProgressData,
                allTasks: parsedData.allTasks,
                uniqueContexts: uniqueContexts,
                uniquePeople: uniquePeople,
            };

            const html = generateGtdViewHtml(finalData, this.activeView, taskBreadcrumbMap, this.activeGrouping, this.activeSorting, this.activeFile?.basename);
            this.contentEl.empty();
            this.contentEl.innerHTML = html;

            if (this.activeView === 'time-tracker') {
                const timeTrackerContainer = this.contentEl.querySelector('#time-tracker-container');
                if (timeTrackerContainer) {
                    if (!this.timeTrackerView) {
                        this.timeTrackerView = new TimeTrackerView(timeTrackerContainer as HTMLElement, this.plugin, this.timeTrackerService);
                    } else {
                        this.timeTrackerView.updateContainer(timeTrackerContainer as HTMLElement);
                    }
                }
            } else if (this.activeView === 'statistics') {
                const statisticsContainer = this.contentEl.querySelector('#statistics-container');
                if (statisticsContainer) {
                    if (!this.statisticsView) {
                        this.statisticsView = new StatisticsView(statisticsContainer as HTMLElement, this.plugin);
                    } else {
                        this.statisticsView.updateContainer(statisticsContainer as HTMLElement);
                    }
                }
            } else if (this.activeView === 'timeline') {
                const timelineContainer = this.contentEl.querySelector('#timeline-container');
                if (timelineContainer) {
                    if (!this.timelineView) {
                        this.timelineView = new TimelineView(timelineContainer as HTMLElement, this.plugin);
                    } else {
                        this.timelineView.updateContainer(timelineContainer as HTMLElement);
                    }
                }
            }
            
            this.addEventListeners();

        } catch (error) {
            console.error('Error drawing Focus view:', error);
            this.contentEl.innerHTML = '<div class="gtd-error">Ocurrió un error al renderizar la Vista de Foco. Revisa la consola para más detalles.</div>';
        }
    }

    private addEventListeners(): void {
        const container = this.contentEl;
        const contextFilter = container.querySelector('#context-filter') as HTMLInputElement;
        const personFilter = container.querySelector('#person-filter') as HTMLInputElement;
        const contentFilter = container.querySelector('#task-content-filter') as HTMLInputElement;

        const applyFilters = () => {
            const selectedContext = contextFilter.value.trim();
            const selectedPerson = personFilter.value.trim();
            const contentSearchTerm = contentFilter.value.trim().toLowerCase();

            container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                const htmlTaskEl = taskEl as HTMLElement;
                const taskContexts: string[] = JSON.parse(htmlTaskEl.dataset['contexts'] || '[]');
                const taskPeople: string[] = JSON.parse(htmlTaskEl.dataset['people'] || '[]');
                const taskContent = (htmlTaskEl.dataset['content'] || '').toLowerCase();

                const contextMatch = selectedContext === '' || taskContexts.includes(selectedContext);
                const personMatch = selectedPerson === '' || taskPeople.includes(selectedPerson);
                const contentMatch = contentSearchTerm === '' || taskContent.includes(contentSearchTerm);

                htmlTaskEl.style.display = (contextMatch && personMatch && contentMatch) ? '' : 'none';
            });

            container.querySelectorAll('.gtd-list').forEach((listEl: Element) => {
                const htmlListEl = listEl as HTMLElement;
                const visibleTasks = htmlListEl.querySelectorAll('.gtd-task:not([style*="display: none;"])');
                const allTasksHidden = visibleTasks.length === 0;
                htmlListEl.style.display = allTasksHidden ? 'none' : '';
                const listId = htmlListEl.id;
                const navLink = container.querySelector(`.gtd-quick-nav a[href="#${listId}"]`) as HTMLElement;
                if (navLink) {
                    navLink.style.display = allTasksHidden ? 'none' : '';
                }
            });
        };
        if (contextFilter) contextFilter.addEventListener('input', applyFilters);
        if (personFilter) personFilter.addEventListener('input', applyFilters);
        if (contentFilter) contentFilter.addEventListener('input', applyFilters);

        container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('gtd-breadcrumb-toggle')) {
                const taskEl = target.closest('.gtd-task');
                taskEl?.classList.toggle('breadcrumb-is-open');
                return;
            }
            const button = target.closest('button');
            if (button) {
                if (button.classList.contains('gtd-view-button')) {
                    const view = button.getAttribute('data-view') as 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'statistics' | 'timeline';
                    if (view && view !== this.activeView) {
                        this.activeView = view;
                        if (this.activeFile) this.drawView(this.activeFile);
                    }
                } else if (button.classList.contains('gtd-refresh-button')) {
                    if (this.activeFile) this.drawView(this.activeFile);
                } else if (button.classList.contains('gtd-hierarchy-control-button')) {
                    const action = button.getAttribute('data-action');
                    const detailsElements = container.querySelectorAll('.gtd-card-container') as NodeListOf<HTMLDetailsElement>;
                    detailsElements.forEach(detail => {
                        if (action === 'expand-all') {
                            detail.open = true;
                        } else if (action === 'collapse-all') {
                            detail.open = false;
                        }
                    });
                } else if (button.classList.contains('gtd-grouping-button')) {
                    const grouping = button.getAttribute('data-grouping') as 'none' | 'context' | 'person' | 'project';
                    if (grouping && grouping !== this.activeGrouping) {
                        this.activeGrouping = grouping;
                        if (this.activeFile) this.drawView(this.activeFile);
                    }
                } else if (button.classList.contains('gtd-sorting-button')) {
                    const currentSort = this.activeSorting;
                    if (currentSort === 'priority') {
                        this.activeSorting = 'duration-asc';
                    } else if (currentSort === 'duration-asc') {
                        this.activeSorting = 'duration-desc';
                    } else {
                        this.activeSorting = 'priority';
                    }
                    if (this.activeFile) this.drawView(this.activeFile);
                }
                return;
            }
            const link = target.closest('[data-item-path], [data-task-path], .internal-link') as HTMLElement;
            if (link) {
                event.preventDefault();
                const itemPath = link.dataset['itemPath'];
                const taskPath = link.dataset['taskPath'];
                const hrefPath = link.getAttribute('href');
                const path: string = (itemPath || taskPath || hrefPath || '');
                const lineAttr = link.dataset['taskLine'];
                const line = lineAttr ? parseInt(lineAttr) : 0;
                if (path.length > 0) {
                    this.app.workspace.openLinkText(path, '', false, {
                        eState: { line: line }
                    });
                }
            }
        }, { signal: this.eventAbortController.signal });
    }
}
