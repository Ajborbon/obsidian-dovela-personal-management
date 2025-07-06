
import { ItemView, WorkspaceLeaf } from 'obsidian';

// Import our custom modules
import { parseVault } from './parser.js';
import { buildHierarchy } from './hierarchyBuilder.js';
import { processGtdLists } from './gtdProcessor.js';
import { generateGtdViewHtml } from './htmlGenerator.js';
import type { ProcessedVaultData } from './model.js';

export const GTD_VIEW_TYPE = 'gtd-view';
export const GTD_VIEW_DISPLAY_TEXT = 'GTD Dashboard';
export const GTD_VIEW_ICON = 'list-checks';

export class GtdView extends ItemView {
    private activeView: 'hierarchy' | 'gtd' = 'hierarchy';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
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
        this.contentEl.empty();
    }

    private async drawView(): Promise<void> {
        try {
            // 1. Parse and process all data
            const parsedData = await parseVault(this.app.vault, this.app.metadataCache);
            const hierarchicalData = buildHierarchy(parsedData.hierarchicalData);

            // Create a map of all tasks by ID for dependency checking
            const allTaskMap = new Map(parsedData.allTasks.map(task => [task.id, task]));
            const { gtdLists, uniqueContexts, uniquePeople } = processGtdLists(parsedData.allTasks, allTaskMap);

            const finalData: ProcessedVaultData = {
                hierarchicalData: hierarchicalData,
                gtdLists: gtdLists,
                allTasks: parsedData.allTasks,
                uniqueContexts: uniqueContexts,
                uniquePeople: uniquePeople,
            };

            // 2. Generate HTML
            const html = generateGtdViewHtml(finalData, this.activeView);

            // 3. Render and add interactivity
            this.contentEl.empty();
            this.contentEl.innerHTML = html;
            this.addEventListeners();

        } catch (error) {
            console.error('Error drawing GTD view:', error);
            this.contentEl.innerHTML = '<div class="gtd-error">An error occurred while rendering the GTD view. Check the console for details.</div>';
        }
    }

    private addEventListeners(): void {
        const container = this.contentEl;

        // --- Filter Logic ---
        const contextFilter = container.querySelector('#context-filter') as HTMLSelectElement;
        const personFilter = container.querySelector('#person-filter') as HTMLSelectElement;

        const applyFilters = () => {
            const selectedContext = contextFilter.value;
            const selectedPerson = personFilter.value;

            container.querySelectorAll('.gtd-task').forEach((taskEl: HTMLElement) => {
                const taskContexts: string[] = JSON.parse(taskEl.dataset.contexts || '[]');
                const taskPeople: string[] = JSON.parse(taskEl.dataset.people || '[]');

                const contextMatch = selectedContext === 'all' || taskContexts.includes(selectedContext);
                const personMatch = selectedPerson === 'all' || taskPeople.includes(selectedPerson);

                taskEl.style.display = (contextMatch && personMatch) ? '' : 'none';
            });

            // --- Update List and Nav Visibility ---
            container.querySelectorAll('.gtd-list').forEach((listEl: HTMLElement) => {
                const visibleTasks = listEl.querySelectorAll('.gtd-task[style*="display: none;"]');
                const totalTasks = listEl.querySelectorAll('.gtd-task').length;
                const allTasksHidden = visibleTasks.length === totalTasks;
                
                listEl.style.display = allTasksHidden ? 'none' : '';

                const listId = listEl.id;
                const navLink = container.querySelector(`.gtd-quick-nav a[href="#${listId}"]`) as HTMLElement;
                if (navLink) {
                    navLink.style.display = allTasksHidden ? 'none' : '';
                }
            });
        };

        if (contextFilter) contextFilter.addEventListener('change', () => {
            if (personFilter) personFilter.value = 'all'; // Reset other filter
            applyFilters();
        });
        if (personFilter) personFilter.addEventListener('change', () => {
            if (contextFilter) contextFilter.value = 'all'; // Reset other filter
            applyFilters();
        });


        // --- Event Delegation for all other clicks ---
        container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;

            // Handle view switcher and refresh buttons
            const button = target.closest('button');
            if (button) {
                if (button.classList.contains('gtd-view-button')) {
                    const view = button.getAttribute('data-view') as 'hierarchy' | 'gtd';
                    if (view && view !== this.activeView) {
                        this.activeView = view;
                        this.drawView();
                    }
                } else if (button.classList.contains('gtd-refresh-button')) {
                    this.drawView();
                }
                return;
            }

            // Handle quick navigation links
            const navLink = target.closest('.gtd-nav-link');
            if (navLink) {
                event.preventDefault();
                const targetId = navLink.getAttribute('href');
                const targetElement = container.querySelector(targetId) as HTMLElement;
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                    (targetElement as HTMLDetailsElement).open = true;
                }
                return;
            }

            // Handle clicks on items to open files
            const link = target.closest('[data-item-path], [data-task-path], .internal-link') as HTMLElement;
            if (link) {
                event.preventDefault();
                const path = link.dataset['itemPath'] || link.dataset['taskPath'] || link.getAttribute('href');
                const lineAttr = link.dataset['taskLine'];
                const line = lineAttr ? parseInt(lineAttr) : 0;

                if (path) {
                    this.app.workspace.openLinkText(path, '', false, {
                        eState: { line: line }
                    });
                }
            }
        });
    }
}
