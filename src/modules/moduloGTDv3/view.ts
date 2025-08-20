
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { TimeTrackerView } from './timeTrackerView.js';
import { StatisticsView } from './statisticsView.js'; // Importar la nueva vista de estadísticas
import { TimelineView } from './timelineView.js';

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
    public timeTrackerView: TimeTrackerView | null = null;
    public statisticsView: StatisticsView | null = null; // Añadir la nueva vista de estadísticas
    private timelineView: TimelineView | null = null;

    private activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'statistics' | 'timeline' = 'gtd'; // Cambio: iniciar con 'gtd'
    private activeGrouping: 'none' | 'context' | 'person' | 'project' = 'none';
    private activeSorting: 'priority' | 'duration-asc' | 'duration-desc' = 'priority';
    private eventAbortController: AbortController = new AbortController();

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
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
        this.timeTrackerView?.clearTimerInterval();
        this.timelineView?.clear();
        this.contentEl.empty();
    }

    public switchToTimeTrackerView(): void {
        if (this.activeView !== 'time-tracker') {
            this.activeView = 'time-tracker';
            this.drawView();
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

    private async drawView(): Promise<void> {
        this.eventAbortController?.abort();
        this.eventAbortController = new AbortController();

        try {
            // Common data parsing for all views
            const parsedData = await parseVault(this.app.vault, this.app.metadataCache);
            const hierarchicalData = buildHierarchy(parsedData.hierarchicalData);
            const taskBreadcrumbMap = this.createTaskBreadcrumbMap(hierarchicalData);

            const allTaskMap = new Map(parsedData.allTasks.map(task => [task.id, task]));
            const { gtdLists, uniqueContexts, uniquePeople, navigationItems } = processGtdLists(parsedData.allTasks, allTaskMap);
            const inProgressData = processInProgressTasks(parsedData.allTasks, this.activeGrouping, this.activeSorting);

            const finalData: ProcessedVaultData = {
                hierarchicalData: hierarchicalData,
                gtdLists: gtdLists,
                inProgressData: inProgressData,
                allTasks: parsedData.allTasks,
                uniqueContexts: uniqueContexts,
                uniquePeople: uniquePeople,
                navigationItems: navigationItems
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
            console.error('Error drawing GTD view:', error);
            this.contentEl.innerHTML = '<div class="gtd-error">An error occurred while rendering the GTD view. Check the console for details.</div>';
        }
    }

    private addEventListeners(): void {
        const container = this.contentEl;

        // === MANEJO DEL HEADER PEGAJOSO ===
        const stickyHeader = container.querySelector('#gtd-sticky-header') as HTMLElement;
        const totalTasks = container.querySelector('#gtd-total-tasks') as HTMLElement;
        const filtersToggle = container.querySelector('#filters-toggle') as HTMLElement;
        const filters = container.querySelector('#gtd-filters') as HTMLElement;
        
        let isHeaderCompact = false;

        // Scroll handler para efectos en header
        const scrollHandler = () => {
            const scrollY = container.scrollTop;
            
            if (scrollY > 50 && !isHeaderCompact) {
                stickyHeader?.classList.add('scrolled');
                totalTasks?.classList.add('compact');
                isHeaderCompact = true;
            } else if (scrollY <= 50 && isHeaderCompact) {
                stickyHeader?.classList.remove('scrolled');
                totalTasks?.classList.remove('compact');
                isHeaderCompact = false;
            }
        };
        
        container.addEventListener('scroll', scrollHandler, { signal: this.eventAbortController.signal });
        
        // === TOGGLE DE FILTROS MEJORADO ===
        if (filtersToggle && filters) {
            console.log('Configurando toggle de filtros mejorado');
            
            // Función para actualizar el estado de los filtros
            const updateFiltersState = () => {
                const isMobile = window.innerWidth <= 768;
                const isExpanded = filters.classList.contains('expanded');
                const filtersContent = filters.querySelector('.filters-content') as HTMLElement;
                
                if (isMobile) {
                    // Mostrar el toggle en móvil
                    filtersToggle.style.display = 'flex';
                    
                    if (isExpanded) {
                        filtersContent.style.maxHeight = filtersContent.scrollHeight + 'px';
                        filtersContent.style.opacity = '1';
                        filtersContent.style.marginTop = '12px';
                    } else {
                        filtersContent.style.maxHeight = '0';
                        filtersContent.style.opacity = '0';
                        filtersContent.style.marginTop = '0';
                    }
                } else {
                    // En desktop, ocultar toggle y mostrar filtros siempre
                    filtersToggle.style.display = 'none';
                    filtersContent.style.maxHeight = 'none';
                    filtersContent.style.opacity = '1';
                    filtersContent.style.marginTop = '0';
                    filters.classList.remove('expanded');
                }
                
                // Actualizar icono
                const icon = filtersToggle.querySelector('span:last-child');
                if (icon && isMobile) {
                    icon.textContent = isExpanded ? '▲' : '▼';
                }
            };
            
            // Event listener para el toggle
            filtersToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle de filtros clickeado');
                
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    filters.classList.toggle('expanded');
                    updateFiltersState();
                    console.log('Estado expandido:', filters.classList.contains('expanded'));
                }
            }, { signal: this.eventAbortController.signal });
            
            // Inicializar estado
            updateFiltersState();
            
            // Manejar redimensionamiento de ventana
            const resizeHandler = () => {
                updateFiltersState();
            };
            
            window.addEventListener('resize', resizeHandler, { signal: this.eventAbortController.signal });
            
        } else {
            console.log('No se encontraron elementos de filtros:', { filtersToggle, filters });
        }
        
        // === INDICADORES DE FILTROS ACTIVOS ===
        const filterInputs = container.querySelectorAll('.gtd-filter-group input[type="text"]');
        filterInputs.forEach(input => {
            const updateFilterState = () => {
                const filterGroup = input.closest('.gtd-filter-group');
                if (filterGroup) {
                    if ((input as HTMLInputElement).value.trim()) {
                        filterGroup.classList.add('has-value');
                    } else {
                        filterGroup.classList.remove('has-value');
                    }
                }
            };
            
            input.addEventListener('input', updateFilterState, { signal: this.eventAbortController.signal });
            updateFilterState(); // Verificar estado inicial
        });
        


        // === FILTROS ORIGINALES ===
        const contextFilter = container.querySelector('#context-filter') as HTMLInputElement;
        const personFilter = container.querySelector('#person-filter') as HTMLInputElement;
        const contentFilter = container.querySelector('#task-content-filter') as HTMLInputElement;

        const applyFilters = () => {
            const selectedContext = contextFilter.value.trim();
            const selectedPerson = personFilter.value.trim();
            const contentSearchTerm = contentFilter.value.trim().toLowerCase();

            // Contar tareas visibles por lista y sublista
            const listCounts = new Map<string, number>();
            const groupCounts = new Map<string, number>();
            let totalVisible = 0;

            container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                const htmlTaskEl = taskEl as HTMLElement;
                const contextsRaw = htmlTaskEl.dataset['contexts'];
                const taskContexts: string[] = contextsRaw ? (JSON.parse(contextsRaw) as string[]) : [];
                const peopleRaw = htmlTaskEl.dataset['people'];
                const taskPeople: string[] = peopleRaw ? (JSON.parse(peopleRaw) as string[]) : [];
                const taskContent = (htmlTaskEl.dataset['content'] || '').toLowerCase();

                const contextMatch = selectedContext === '' || taskContexts.includes(selectedContext);
                const personMatch = selectedPerson === '' || taskPeople.includes(selectedPerson);
                const contentMatch = contentSearchTerm === '' || taskContent.includes(contentSearchTerm);

                const isVisible = contextMatch && personMatch && contentMatch;
                htmlTaskEl.style.display = isVisible ? '' : 'none';

                if (isVisible) {
                    totalVisible++;
                    
                    // Contar para la lista principal
                    const listEl = htmlTaskEl.closest('.gtd-list');
                    if (listEl) {
                        const listId = listEl.id;
                        listCounts.set(listId, (listCounts.get(listId) || 0) + 1);
                    }
                    
                    // Contar para sublistas/grupos
                    const groupEl = htmlTaskEl.closest('.gtd-group');
                    if (groupEl) {
                        const groupId = groupEl.id;
                        groupCounts.set(groupId, (groupCounts.get(groupId) || 0) + 1);
                    }
                }
            });

            // Actualizar contadores y visibilidad de listas principales
            container.querySelectorAll('.gtd-list').forEach((listEl: Element) => {
                const htmlListEl = listEl as HTMLElement;
                const listId = htmlListEl.id;
                const visibleCount = listCounts.get(listId) || 0;
                
                // Mostrar/ocultar lista
                const shouldShow = visibleCount > 0;
                htmlListEl.style.display = shouldShow ? '' : 'none';
                
                // Actualizar contador en el summary
                const countSpan = htmlListEl.querySelector('.gtd-list-count');
                if (countSpan) {
                    countSpan.textContent = `(${visibleCount})`;
                }
                
                // Actualizar navegación rápida
                const navLink = container.querySelector(`.gtd-quick-nav a[href="#${listId}"]`) as HTMLElement;
                if (navLink) {
                    navLink.style.display = shouldShow ? '' : 'none';
                    const navCount = navLink.querySelector('.gtd-nav-count');
                    if (navCount) {
                        navCount.textContent = visibleCount.toString();
                    }
                }
            });

            // Actualizar contadores y visibilidad de sublistas/grupos
            container.querySelectorAll('.gtd-group').forEach((groupEl: Element) => {
                const htmlGroupEl = groupEl as HTMLElement;
                const groupId = htmlGroupEl.id;
                const visibleCount = groupCounts.get(groupId) || 0;
                
                // Mostrar/ocultar grupo
                const shouldShow = visibleCount > 0;
                htmlGroupEl.style.display = shouldShow ? '' : 'none';
                
                // Actualizar contador en el título del grupo
                const countSpan = htmlGroupEl.querySelector('.gtd-group-count');
                if (countSpan) {
                    countSpan.textContent = visibleCount.toString();
                }
                
                // Actualizar navegación rápida para sublistas
                const navLink = container.querySelector(`.gtd-quick-nav a[href="#${groupId}"]`) as HTMLElement;
                if (navLink) {
                    navLink.style.display = shouldShow ? '' : 'none';
                    const navCount = navLink.querySelector('.gtd-nav-count');
                    if (navCount) {
                        navCount.textContent = visibleCount.toString();
                    }
                }
            });

            // Actualizar total general
            const totalTasksEl = container.querySelector('#gtd-total-tasks');
            if (totalTasksEl) {
                const hasFilters = selectedContext || selectedPerson || contentSearchTerm;
                if (hasFilters) {
                    totalTasksEl.innerHTML = `<span>Tareas Filtradas: <strong>${totalVisible}</strong> (de ${container.querySelectorAll('.gtd-task').length} totales)</span>`;
                } else {
                    totalTasksEl.innerHTML = `<span>Total de Tareas Abiertas: <strong>${container.querySelectorAll('.gtd-task').length}</strong></span>`;
                }
            }

            // Actualizar contadores en subgrupos de navegación
            container.querySelectorAll('.gtd-subgroup').forEach((subgroupEl: Element) => {
                const subgroupHtml = subgroupEl as HTMLElement;
                const visibleLinks = subgroupHtml.querySelectorAll('.gtd-sub-nav-link:not([style*="display: none"])');
                const countSpan = subgroupHtml.querySelector('.gtd-subgroup-count');
                if (countSpan) {
                    countSpan.textContent = visibleLinks.length.toString();
                }
                
                // Ocultar subgrupo si no tiene enlaces visibles
                subgroupHtml.style.display = visibleLinks.length > 0 ? '' : 'none';
            });
        };

        if (contextFilter) contextFilter.addEventListener('input', applyFilters);
        if (personFilter) personFilter.addEventListener('input', applyFilters);
        if (contentFilter) contentFilter.addEventListener('input', applyFilters);

        container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;

            const navLink = target.closest('.gtd-nav-link');
            if (navLink) {
                event.preventDefault();
                const href = navLink.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetId = href.substring(1);
                    const targetElement = container.querySelector(`[id="${targetId}"]`);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
                return;
            }

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
