
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeTrackerView } from './timeTrackerView.js';
import { TimelineView } from './timelineView.js'; // Importar la nueva vista

// Import our custom modules
import { parseVault } from './parser.js';
import { buildHierarchy } from './hierarchyBuilder.js';
import { processGtdLists } from './gtdProcessor.js';
import { processInProgressTasks } from './inProgressProcessor.js';
import { generateGtdViewHtml } from './htmlGenerator.js';
import type { ProcessedVaultData, HierarchicalItem } from './model.js';

export const GTD_VIEW_TYPE = 'gtd-view';
export const GTD_VIEW_DISPLAY_TEXT = 'GTD Dashboard';
export const GTD_VIEW_ICON = 'list-checks';

export class GtdView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private timeTrackerService: TimeTrackerService;
    private timeTrackerView: TimeTrackerView | null = null;
    private timelineView: TimelineView | null = null; // Añadir la nueva vista

    private activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'timeline' = 'hierarchy'; // Añadir 'timeline'
    private activeGrouping: 'none' | 'context' | 'person' | 'project' = 'none';
    private activeSorting: 'priority' | 'duration-asc' | 'duration-desc' = 'priority';
    private eventAbortController: AbortController = new AbortController();

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
        // CORRECTO: Usar la instancia de servicio centralizada del plugin.
        this.timeTrackerService = this.plugin.timeTrackerService;
    }

    getViewType(): string {
        return GTD_VIEW_TYPE;
    }

    getDisplayText(): string {
        return GTD_VIEW_DISPLAY_TEXT;
    }

    override getIcon(): string {
        return GTD_VIEW_ICON;
    }

    override async onOpen() {
        this.contentEl.innerHTML = '<div class="gtd-loading">Loading GTD Dashboard...</div>';
        await this.drawView();
    }

    override async onClose() {
        this.eventAbortController?.abort();
        this.timeTrackerView?.clearTimerInterval(); // Clear interval when view closes
        this.timelineView?.clear(); // Limpiar la nueva vista
        this.contentEl.empty();
    }

    public switchToTimeTrackerView(): void {
        if (this.activeView !== 'time-tracker') {
            this.activeView = 'time-tracker';
            this.drawView();
        }
    }

    public async refreshStatistics(): Promise<void> {
        if (this.timeTrackerView) {
            await this.timeTrackerView.renderStatistics();
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

    private async drawView(): Promise<void> {
        this.eventAbortController?.abort();
        this.eventAbortController = new AbortController();

        try {
            // Common data parsing for all views
            const parsedData = await parseVault(this.app.vault, this.app.metadataCache);
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

            // Generate the main HTML structure including headers and an empty content area
            const html = generateGtdViewHtml(finalData, this.activeView, taskBreadcrumbMap, this.activeGrouping, this.activeSorting);

            this.contentEl.empty();
            this.contentEl.innerHTML = html;

            // Render the specific content for the active view
            if (this.activeView === 'time-tracker') {
                const timeTrackerContainer = this.contentEl.querySelector('#time-tracker-container');
                if (timeTrackerContainer) {
                    if (!this.timeTrackerView) {
                        this.timeTrackerView = new TimeTrackerView(timeTrackerContainer as HTMLElement, this.plugin, this.timeTrackerService);
                    } else {
                        this.timeTrackerView.updateContainer(timeTrackerContainer as HTMLElement);
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
            console.error('Error drawing GTD view:', error);
            this.contentEl.innerHTML = '<div class="gtd-error">An error occurred while rendering the GTD view. Check the console for details.</div>';
        }
    }

    private addEventListeners(): void {
        const container = this.contentEl;

        const contextFilter = container.querySelector('#context-filter') as HTMLInputElement;
        const personFilter = container.querySelector('#person-filter') as HTMLInputElement;

        const applyFilters = () => {
            const selectedContext = contextFilter.value.trim();
            const selectedPerson = personFilter.value.trim();

            container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                const htmlTaskEl = taskEl as HTMLElement;
                const taskContexts: string[] = JSON.parse(htmlTaskEl.dataset['contexts'] || '[]');
                const taskPeople: string[] = JSON.parse(htmlTaskEl.dataset['people'] || '[]');

                const contextMatch = selectedContext === '' || taskContexts.includes(selectedContext);
                const personMatch = selectedPerson === '' || taskPeople.includes(selectedPerson);

                htmlTaskEl.style.display = (contextMatch && personMatch) ? '' : 'none';
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
                    const view = button.getAttribute('data-view') as 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'timeline';
                    if (view && view !== this.activeView) {
                        this.activeView = view;
                        this.drawView();
                    }
                } else if (button.classList.contains('gtd-refresh-button')) {
                    this.drawView();
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
                        this.drawView();
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
                    this.drawView();
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
