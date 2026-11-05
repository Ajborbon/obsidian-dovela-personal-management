
import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
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
    private overdueGroupingMode: 'date-first' | 'context-first' = 'date-first'; // Modo de organización de Vencidas

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

    /**
     * Maneja los clics en enlaces de dependencias para navegar a la tarea dependiente
     */
    private async handleDependencyLinkClick(dependencyId: string): Promise<void> {
        try {
            // Buscar la tarea dependiente en todas las tareas cargadas
            const parsedData = await parseVault(this.app.vault, this.app.metadataCache);
            const targetTask = parsedData.allTasks.find(task => task.id === dependencyId);
            
            if (!targetTask) {
                new Notice(`No se encontró la tarea dependiente: ${dependencyId}`);
                return;
            }
            
            // Navegar al archivo de la tarea
            const file = targetTask.sourceFile;
            if (file) {
                await this.app.workspace.openLinkText(file.path, '', false, {
                    eState: { line: targetTask.lineNumber }
                });
                new Notice(`Navegando a la tarea dependiente: ${dependencyId}`);
            } else {
                new Notice(`El archivo de la tarea dependiente ${dependencyId} no se encuentra disponible`);
            }
        } catch (error) {
            console.error('Error al navegar a la tarea dependiente:', error);
            new Notice(`Error al abrir la tarea dependiente: ${dependencyId}`);
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
            const { gtdLists, uniqueContexts, uniquePeople, navigationItems } = processGtdLists(parsedData.allTasks, allTaskMap, this.overdueGroupingMode);
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
            const html = generateGtdViewHtml(finalData, this.activeView, taskBreadcrumbMap, this.activeGrouping, this.activeSorting, this.overdueGroupingMode);

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

            // Detectar tareas en progreso después de renderizar
            setTimeout(() => this.checkInProgressTasks(), 100);

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
        
        // === TOGGLE DE FILTROS MEJORADO PARA MÓVIL ===
        if (filtersToggle && filters) {
            console.log('Configurando toggle de filtros mejorado para móvil');
            this.initializeMobileFiltersOptimization(container);
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
            
            // NUEVO: Set para trackear IDs únicos de tareas visibles
            const uniqueVisibleTaskIds = new Set<string>();
            let totalVisible = 0;

            container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                const htmlTaskEl = taskEl as HTMLElement;
                const contextsRaw = htmlTaskEl.dataset['contexts'];
                const taskContexts: string[] = contextsRaw ? (JSON.parse(contextsRaw) as string[]) : [];
                const peopleRaw = htmlTaskEl.dataset['people'];
                const taskPeople: string[] = peopleRaw ? (JSON.parse(peopleRaw) as string[]) : [];
                const taskContent = (htmlTaskEl.dataset['content'] || '').toLowerCase();
                
                // NUEVO: Obtener ID único de la tarea combinando path y línea
                const taskPath = htmlTaskEl.dataset['taskPath'] || '';
                const taskLine = htmlTaskEl.dataset['taskLine'] || '';
                const taskId = taskPath && taskLine ? `${taskPath}:${taskLine}` : (htmlTaskEl.dataset['taskId'] || htmlTaskEl.dataset['taskLine'] || '');

                const contextMatch = selectedContext === '' || taskContexts.includes(selectedContext);
                const personMatch = selectedPerson === '' || taskPeople.includes(selectedPerson);
                const contentMatch = contentSearchTerm === '' || taskContent.includes(contentSearchTerm);

                const isVisible = contextMatch && personMatch && contentMatch;
                htmlTaskEl.style.display = isVisible ? '' : 'none';

                if (isVisible) {
                    // NUEVO: Solo contar para el total único si no hemos visto este ID antes
                    if (taskId && !uniqueVisibleTaskIds.has(taskId)) {
                        uniqueVisibleTaskIds.add(taskId);
                        totalVisible++;
                    }
                    
                    // Mantener conteo por lista para navegación (esto sigue igual)
                    const listEl = htmlTaskEl.closest('.gtd-list');
                    if (listEl) {
                        const listId = listEl.id;
                        listCounts.set(listId, (listCounts.get(listId) || 0) + 1);
                    }
                    
                    // Mantener conteo por grupos para navegación (esto sigue igual)
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

            // CAMBIO PRINCIPAL: Actualizar total general usando conteo único
            const totalTasksEl = container.querySelector('#gtd-total-tasks');
            if (totalTasksEl) {
                const hasFilters = selectedContext || selectedPerson || contentSearchTerm;
                
                // NUEVO: Calcular total único sin filtros para la comparación
                const allUniqueTaskIds = new Set<string>();
                container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                    const htmlTaskEl = taskEl as HTMLElement;
                    const taskPath = htmlTaskEl.dataset['taskPath'] || '';
                    const taskLine = htmlTaskEl.dataset['taskLine'] || '';
                    const taskId = taskPath && taskLine ? `${taskPath}:${taskLine}` : (htmlTaskEl.dataset['taskId'] || htmlTaskEl.dataset['taskLine'] || '');
                    if (taskId) {
                        allUniqueTaskIds.add(taskId);
                    }
                });
                const totalUniqueCount = allUniqueTaskIds.size;
                
                if (hasFilters) {
                    totalTasksEl.innerHTML = `<span>Tareas Filtradas: <strong>${totalVisible}</strong> (de ${totalUniqueCount} totales)</span>`;
                } else {
                    totalTasksEl.innerHTML = `<span>Total de Tareas Abiertas: <strong>${totalUniqueCount}</strong></span>`;
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

        // === FILTRO DE BÚSQUEDA JERÁRQUICA ===
        const hierarchySearchFilter = container.querySelector('#hierarchy-search-filter') as HTMLInputElement;
        const includeContentToggle = container.querySelector('#hierarchy-include-content') as HTMLElement;

        if (hierarchySearchFilter && includeContentToggle) {
            let searchTimeout: NodeJS.Timeout;
            let contentCache = new Map<string, string>();
            let isContentIncluded = false;

            // Actualizar placeholder dinámicamente
            const updatePlaceholder = () => {
                if (isContentIncluded) {
                    hierarchySearchFilter.placeholder = 'Buscar por título y contenido...';
                } else {
                    hierarchySearchFilter.placeholder = 'Buscar por título...';
                }
            };

            const readFileContent = async (filePath: string): Promise<string> => {
                if (contentCache.has(filePath)) {
                    return contentCache.get(filePath)!;
                }

                try {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    if (file && 'extension' in file && file.extension === 'md') {
                        const content = await this.app.vault.read(file as any);
                        const contentLower = content.toLowerCase();
                        contentCache.set(filePath, contentLower);
                        return contentLower;
                    }
                } catch (error) {
                    console.warn('Error reading file:', filePath, error);
                }
                return '';
            };

            const applyHierarchySearch = async () => {
                const searchTerm = hierarchySearchFilter.value.trim().toLowerCase();
                const includeContent = isContentIncluded;
                const resultsContainer = container.querySelector('#hierarchy-search-results') as HTMLElement;

                // Limpiar timeout anterior
                clearTimeout(searchTimeout);

                if (searchTerm === '') {
                    // Mostrar todos los elementos y limpiar resultados
                    container.querySelectorAll('.gtd-hierarchy-item').forEach((item: Element) => {
                        (item as HTMLElement).style.display = '';
                        (item as HTMLElement).style.visibility = '';
                        (item as HTMLElement).classList.remove('search-highlight', 'search-match-title', 'search-match-content');
                    });
                    if (resultsContainer) resultsContainer.innerHTML = '';
                    return;
                }

                // Mostrar indicador de carga si incluye contenido
                if (includeContent && resultsContainer) {
                    resultsContainer.innerHTML = '<div class="search-loading">Buscando en archivos...</div>';
                }

                // Debounce para búsqueda de contenido
                const delay = includeContent ? 300 : 0;

                searchTimeout = setTimeout(async () => {
                    let totalMatches = 0;
                    const matches: Array<{element: HTMLElement, type: 'title'|'content', name: string, level: number}> = [];

                    // Primero limpiar todas las clases de búsqueda
                    container.querySelectorAll('.gtd-hierarchy-item').forEach((item: Element) => {
                        const htmlItem = item as HTMLElement;
                        htmlItem.classList.remove('search-highlight', 'search-match-title', 'search-match-content');
                    });

                    // Procesar cada elemento
                    const items = Array.from(container.querySelectorAll('.gtd-hierarchy-item'));
                    for (const item of items) {
                        const htmlItem = item as HTMLElement;
                        const itemName = htmlItem.dataset['searchName'] || '';
                        const itemLevel = parseInt(htmlItem.dataset['searchLevel'] || '0');
                        let isVisible = false;

                        // Búsqueda en título
                        if (itemName.includes(searchTerm)) {
                            isVisible = true;
                            htmlItem.classList.add('search-highlight', 'search-match-title');
                            matches.push({element: htmlItem, type: 'title', name: itemName, level: itemLevel});
                            totalMatches++;
                        }
                        // Búsqueda en contenido (solo si checkbox está marcado)
                        else if (includeContent) {
                            // Buscar el path en el elemento o sus hijos
                            const pathElement = htmlItem.querySelector('[data-item-path]') || htmlItem.querySelector('.gtd-card-header[data-item-path]');
                            const itemPath = pathElement?.getAttribute('data-item-path');

                            if (itemPath) {
                                try {
                                    const fileContent = await readFileContent(itemPath);
                                    if (fileContent && fileContent.includes(searchTerm)) {
                                        isVisible = true;
                                        htmlItem.classList.add('search-highlight', 'search-match-content');
                                        matches.push({element: htmlItem, type: 'content', name: itemName, level: itemLevel});
                                        totalMatches++;
                                    }
                                } catch (error) {
                                    console.warn('Error processing file content for:', itemPath, error);
                                }
                            }
                        }

                        // Aplicar visibilidad
                        htmlItem.style.display = isVisible ? 'block' : 'none';
                        htmlItem.style.visibility = isVisible ? 'visible' : 'hidden';

                        // Expandir padres si hay coincidencia
                        if (isVisible) {
                            let parent = htmlItem.parentElement;
                            while (parent && parent !== container) {
                                if (parent.classList.contains('gtd-card-container')) {
                                    (parent as HTMLDetailsElement).open = true;
                                    parent.style.display = 'block';
                                }
                                if (parent.classList.contains('gtd-card-children')) {
                                    parent.style.display = 'block';
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }

                    // Mostrar resultados
                    if (resultsContainer) {
                        if (totalMatches === 0) {
                            resultsContainer.innerHTML = '<div class="search-no-results">No se encontraron coincidencias</div>';
                        } else {
                            const titleMatches = matches.filter(m => m.type === 'title').length;
                            const contentMatches = matches.filter(m => m.type === 'content').length;

                            // Mostrar conteos específicos con formato: "6: 📄 4 📝 2"
                            const parts = [];
                            if (titleMatches > 0) {
                                parts.push(`<span class="match-type-title">📄 ${titleMatches}</span>`);
                            }
                            if (contentMatches > 0) {
                                parts.push(`<span class="match-type-content">📝 ${contentMatches}</span>`);
                            }

                            const resultsText = `
                                <span class="results-total">${totalMatches}:</span>
                                ${parts.join(' ')}
                            `;

                            resultsContainer.innerHTML = `<div class="search-results-summary">${resultsText}</div>`;
                        }
                    }
                }, delay);
            };

            // Toggle functionality
            const toggleContent = () => {
                isContentIncluded = !isContentIncluded;
                includeContentToggle.classList.toggle('active', isContentIncluded);
                updatePlaceholder();
                applyHierarchySearch();
            };

            // Event listeners
            hierarchySearchFilter.addEventListener('input', applyHierarchySearch, { signal: this.eventAbortController.signal });
            includeContentToggle.addEventListener('click', toggleContent, { signal: this.eventAbortController.signal });
            includeContentToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleContent();
                }
            }, { signal: this.eventAbortController.signal });

            // Inicializar placeholder
            updatePlaceholder();
        }

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

            // Manejar clics en enlaces de dependencias
            const dependencyLink = target.closest('.dependency-link') as HTMLElement;
            if (dependencyLink) {
                event.preventDefault();
                const dependencyId = dependencyLink.dataset['dependencyId'];
                if (dependencyId) {
                    this.handleDependencyLinkClick(dependencyId);
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

        // === EVENT LISTENER PARA BOTÓN TOGGLE DE VENCIDAS ===
        container.addEventListener('click', (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const toggleButton = target.closest('.gtd-overdue-toggle') as HTMLElement;
            
            if (toggleButton) {
                event.preventDefault();
                event.stopPropagation();
                this.toggleOverdueGroupingMode();
            }
        }, { signal: this.eventAbortController.signal });
    }

    private toggleOverdueGroupingMode(): void {
        // Cambiar el modo
        this.overdueGroupingMode = this.overdueGroupingMode === 'date-first' ? 'context-first' : 'date-first';
        
        // Recargar la vista - ahora el HTML se generará con el estado correcto
        this.drawView();
    }

    private initializeMobileFiltersOptimization(container: HTMLElement): void {
        const filtersToggle = container.querySelector('#filters-toggle') as HTMLElement;
        const filters = container.querySelector('#gtd-filters') as HTMLElement;
        
        if (!filtersToggle || !filters) {
            console.log('Elementos de filtros no encontrados');
            return;
        }

        console.log('Inicializando optimización de filtros móviles');
        
        // === FUNCIONES AUXILIARES ===
        
        const isMobile = () => window.innerWidth <= 768;
        
        const updateFiltersState = () => {
            const mobile = isMobile();
            const isExpanded = filters.classList.contains('expanded');
            const filtersContent = filters.querySelector('.filters-content') as HTMLElement;
            
            if (mobile) {
                // Mostrar toggle en móvil
                filtersToggle.style.display = 'flex';
                
                if (isExpanded) {
                    // Estado expandido: hacer todo interactivo
                    filters.classList.add('expanded');
                    filtersContent.style.pointerEvents = 'auto';
                    filtersContent.style.visibility = 'visible';
                    filtersContent.style.zIndex = '50';
                    
                    // Activar inputs individualmente
                    const inputs = filters.querySelectorAll('input');
                    inputs.forEach(input => {
                        (input as HTMLElement).style.pointerEvents = 'auto';
                        (input as HTMLElement).style.visibility = 'visible';
                        (input as HTMLElement).style.zIndex = '1000';
                    });
                    
                    // Activar grupos de filtros
                    const filterGroups = filters.querySelectorAll('.gtd-filter-group');
                    filterGroups.forEach(group => {
                        (group as HTMLElement).style.pointerEvents = 'auto';
                        (group as HTMLElement).style.visibility = 'visible';
                        (group as HTMLElement).style.zIndex = '100';
                    });
                    
                } else {
                    // Estado colapsado: hacer todo no interactivo
                    filters.classList.remove('expanded');
                    filtersContent.style.pointerEvents = 'none';
                    filtersContent.style.visibility = 'hidden';
                    filtersContent.style.zIndex = '-1';
                    
                    // Desactivar inputs individualmente
                    const inputs = filters.querySelectorAll('input');
                    inputs.forEach(input => {
                        (input as HTMLElement).style.pointerEvents = 'none';
                        (input as HTMLElement).style.visibility = 'hidden';
                        (input as HTMLElement).style.zIndex = '-1';
                        (input as HTMLInputElement).blur(); // Quitar foco si lo tiene
                    });
                    
                    // Desactivar grupos de filtros
                    const filterGroups = filters.querySelectorAll('.gtd-filter-group');
                    filterGroups.forEach(group => {
                        (group as HTMLElement).style.pointerEvents = 'none';
                        (group as HTMLElement).style.visibility = 'hidden';
                        (group as HTMLElement).style.zIndex = '-1';
                    });
                }
            } else {
                // En desktop: resetear todo y mostrar siempre
                filtersToggle.style.display = 'none';
                filters.classList.add('expanded'); // Siempre expandido en desktop
                
                // Resetear estilos inline
                filtersContent.style.pointerEvents = '';
                filtersContent.style.visibility = '';
                filtersContent.style.zIndex = '';
                
                const inputs = filters.querySelectorAll('input');
                inputs.forEach(input => {
                    (input as HTMLElement).style.pointerEvents = '';
                    (input as HTMLElement).style.visibility = '';
                    (input as HTMLElement).style.zIndex = '';
                });
                
                const filterGroups = filters.querySelectorAll('.gtd-filter-group');
                filterGroups.forEach(group => {
                    (group as HTMLElement).style.pointerEvents = '';
                    (group as HTMLElement).style.visibility = '';
                    (group as HTMLElement).style.zIndex = '';
                });
            }
            
            // Actualizar icono
            const icon = filtersToggle.querySelector('span:last-child');
            if (icon && mobile) {
                icon.textContent = isExpanded ? '▲' : '▼';
            }
            
            // Actualizar accesibilidad
            filtersToggle.setAttribute('aria-expanded', isExpanded.toString());
        };
        
        const updateFiltersCounter = () => {
            const inputs = filters.querySelectorAll('.gtd-filter-group input');
            const activeFilters = Array.from(inputs).filter(input => 
                (input as HTMLInputElement).value.trim() !== ''
            ).length;
            
            const counterSpan = filtersToggle.querySelector('span:first-child');
            if (counterSpan) {
                const baseText = '🔍 Filtros';
                counterSpan.textContent = activeFilters > 0 
                    ? `${baseText} (${activeFilters})` 
                    : `${baseText}`;
            }
            
            // Indicador visual de filtros activos
            if (activeFilters > 0) {
                filtersToggle.classList.add('has-active-filters');
            } else {
                filtersToggle.classList.remove('has-active-filters');
            }
        };
        
        // === OPTIMIZACIONES ESPECÍFICAS PARA MÓVIL ===
        
        const initializeMobileOptimizations = () => {
            if (!isMobile()) return;
            
            // Mejorar inputs para móvil
            const filterInputs = filters.querySelectorAll('input');
            filterInputs.forEach((input) => {
                // Atributos para mejor experiencia móvil
                input.setAttribute('autocomplete', 'off');
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('spellcheck', 'false');
                
                // Manejar teclado virtual
                input.addEventListener('focus', () => {
                    // Asegurar que el filtro esté expandido cuando se enfoca un input
                    if (!filters.classList.contains('expanded')) {
                        filters.classList.add('expanded');
                        updateFiltersState();
                    }
                    
                    // Scroll suave hacia el input después de que aparezca el teclado
                    setTimeout(() => {
                        input.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }, 300);
                }, { signal: this.eventAbortController.signal });
                
                // Manejar pérdida de foco
                input.addEventListener('blur', () => {
                    // Permitir un pequeño delay antes de colapsar automáticamente
                    setTimeout(() => {
                        // Solo colapsar si ningún input tiene foco
                        const focusedInput = filters.querySelector('input:focus');
                        if (!focusedInput && isMobile()) {
                            // No colapsar automáticamente para mejor UX
                            // El usuario puede colapsar manualmente si lo desea
                        }
                    }, 100);
                }, { signal: this.eventAbortController.signal });
            });
            
            // Auto-colapsar en scroll (UX mejorada)
            let scrollTimer: NodeJS.Timeout;
            let lastScrollY = container.scrollTop;
            
            const smartScrollHandler = () => {
                if (!isMobile()) return;
                
                clearTimeout(scrollTimer);
                
                const currentScrollY = container.scrollTop;
                const isScrollingDown = currentScrollY > lastScrollY;
                const scrollDelta = Math.abs(currentScrollY - lastScrollY);
                
                // Solo colapsar si se está scrolleando significativamente hacia abajo
                if (isScrollingDown && scrollDelta > 30 && filters.classList.contains('expanded')) {
                    scrollTimer = setTimeout(() => {
                        // Verificar que ningún input tenga foco antes de colapsar
                        const focusedInput = filters.querySelector('input:focus');
                        if (!focusedInput) {
                            filters.classList.remove('expanded');
                            updateFiltersState();
                        }
                    }, 150);
                }
                
                lastScrollY = currentScrollY;
            };
            
            container.addEventListener('scroll', smartScrollHandler, { 
                signal: this.eventAbortController.signal,
                passive: true 
            });
        };
        
        // === EVENT LISTENERS ===
        
        // Toggle principal
        filtersToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isMobile()) {
                const wasExpanded = filters.classList.contains('expanded');
                
                if (wasExpanded) {
                    filters.classList.remove('expanded');
                } else {
                    filters.classList.add('expanded');
                }
                
                updateFiltersState();
                
                console.log('Toggle filtros:', filters.classList.contains('expanded') ? 'expandido' : 'colapsado');
            }
        }, { signal: this.eventAbortController.signal });
        
        // Actualizar contador cuando cambian los filtros
        filters.addEventListener('input', (e) => {
            if ((e.target as HTMLElement).closest('.gtd-filter-group')) {
                updateFiltersCounter();
            }
        }, { signal: this.eventAbortController.signal });
        
        // Manejar cambios de tamaño de ventana y orientación
        const handleOrientationChange = () => {
            // Delay para que la orientación se complete
            setTimeout(() => {
                const mobile = isMobile();
                
                if (mobile) {
                    // En móvil: permitir estado actual pero optimizar para landscape
                    if (window.innerHeight < window.innerWidth) {
                        // Landscape: colapsar para maximizar espacio vertical
                        filters.classList.remove('expanded');
                    }
                } else {
                    // En desktop: siempre expandido
                    filters.classList.add('expanded');
                }
                
                updateFiltersState();
            }, 100);
        };
        
        // === INICIALIZACIÓN ===
        
        // Estado inicial
        updateFiltersState();
        updateFiltersCounter();
        initializeMobileOptimizations();
        
        // Listeners globales
        window.addEventListener('resize', handleOrientationChange, { 
            signal: this.eventAbortController.signal 
        });
        
        window.addEventListener('orientationchange', handleOrientationChange, { 
            signal: this.eventAbortController.signal 
        });
        
        // Escuchar cambios en los inputs para indicadores de estado
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
            
            input.addEventListener('input', updateFilterState, { 
                signal: this.eventAbortController.signal 
            });
            updateFilterState(); // Estado inicial
        });

        console.log('Optimización de filtros móviles inicializada correctamente');
    }

    private async checkInProgressTasks(): Promise<void> {
        const container = this.contentEl;
        const elementsToCheck = container.querySelectorAll('.check-in-progress[data-check-path]');

        for (const element of Array.from(elementsToCheck)) {
            const htmlElement = element as HTMLElement;
            const filePath = htmlElement.dataset['checkPath'];

            if (filePath) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    if (file && file.path === filePath) {
                        const content = await this.app.vault.read(file as any);
                        if (/^- \[\/\]/m.test(content)) {
                            htmlElement.classList.add('has-in-progress-tasks');
                        }
                    }
                } catch (error) {
                    console.warn('Error checking file for in-progress tasks:', filePath, error);
                }
            }
        }
    }
}
