
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

    private activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'statistics' | 'timeline' = 'gtd'; // Cambio: iniciar con 'gtd'
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
        console.log('🔍 FOCO DEBUG: Iniciando drawView');
        console.log('🔍 FOCO DEBUG: activeFile:', activeFile?.path);
        console.log('🔍 FOCO DEBUG: isMobile:', (this.app as any).isMobile || 'unknown');
        console.log('🔍 FOCO DEBUG: Platform:', (this.app as any).platform || 'unknown');
        
        this.eventAbortController?.abort();
        this.eventAbortController = new AbortController();

        try {
            console.log('🔍 FOCO DEBUG: Llamando a parseFocus...');
            const parsedData = await parseFocus(activeFile, this.app.vault, this.app.metadataCache);
            console.log('🔍 FOCO DEBUG: parseFocus completado exitosamente');
            console.log('🔍 FOCO DEBUG: Datos obtenidos - tareas:', parsedData.allTasks.length, 'items:', parsedData.hierarchicalData.length);
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
            console.error('🔍 FOCO DEBUG: Error en drawView:', error);
            console.error('🔍 FOCO DEBUG: Error type:', typeof error);
            console.error('🔍 FOCO DEBUG: Error message:', (error as any)?.message || 'No message available');
            console.error('🔍 FOCO DEBUG: Error stack:', (error as any)?.stack || 'No stack available');
            console.error('🔍 FOCO DEBUG: Error code:', (error as any)?.code);
            console.error('🔍 FOCO DEBUG: Error data:', (error as any)?.data);
            console.error('🔍 FOCO DEBUG: Full error object:', error);
            this.contentEl.innerHTML = '<div class="gtd-error">Ocurrió un error al renderizar la Vista de Foco. Revisa la consola para más detalles.</div>';
        }
    }

    private addEventListeners(): void {
        const container = this.contentEl;
        
        // === MANEJO DEL HEADER PEGAJOSO ===
        const stickyHeader = container.querySelector('#gtd-sticky-header') as HTMLElement;
        const totalTasks = container.querySelector('#gtd-total-tasks') as HTMLElement;
        const focusTitle = container.querySelector('#focus-view-title') as HTMLElement;
        const filtersToggle = container.querySelector('#filters-toggle') as HTMLElement;
        const filters = container.querySelector('#gtd-filters') as HTMLElement;
        
        let isHeaderCompact = false;

        // Scroll handler para efectos en header
        const scrollHandler = () => {
            const scrollY = container.scrollTop;
            
            if (scrollY > 50 && !isHeaderCompact) {
                stickyHeader?.classList.add('scrolled');
                totalTasks?.classList.add('compact');
                focusTitle?.classList.add('collapsed');
                isHeaderCompact = true;
            } else if (scrollY <= 50 && isHeaderCompact) {
                stickyHeader?.classList.remove('scrolled');
                totalTasks?.classList.remove('compact');
                focusTitle?.classList.remove('collapsed');
                isHeaderCompact = false;
            }
        };
        
        container.addEventListener('scroll', scrollHandler, { signal: this.eventAbortController.signal });
        
        // === TOGGLE DEL TÍTULO DE FOCO ===
        if (focusTitle) {
            focusTitle.addEventListener('click', () => {
                focusTitle.classList.toggle('collapsed');
            }, { signal: this.eventAbortController.signal });
        }
        
        // === TOGGLE DE FILTROS MEJORADO PARA MÓVIL ===
        if (filtersToggle && filters) {
            console.log('Configurando toggle de filtros mejorado para móvil en Vista de Foco');
            
            // Función para actualizar contador de filtros activos
            const updateFiltersCounter = () => {
                const inputs = filters.querySelectorAll('.gtd-filter-group input');
                const activeFilters = Array.from(inputs).filter(input => 
                    (input as HTMLInputElement).value.trim() !== ''
                ).length;
                
                const counterSpan = filtersToggle.querySelector('span:first-child');
                if (counterSpan) {
                    const baseText = '🔍 Filtros';
                    const finalText = activeFilters > 0 
                        ? `${baseText} (${activeFilters})` 
                        : `${baseText}`;
                    counterSpan.textContent = finalText;
                }
                
                // Añadir indicador visual si hay filtros activos
                if (activeFilters > 0) {
                    filtersToggle.classList.add('has-active-filters');
                } else {
                    filtersToggle.classList.remove('has-active-filters');
                }
            };
            
            // Función para actualizar el estado de los filtros
            const updateFiltersState = () => {
                const isMobile = window.innerWidth <= 768;
                const isExpanded = filters.classList.contains('expanded');
                const filtersContent = filters.querySelector('.filters-content') as HTMLElement;
                
                if (isMobile) {
                    // Mostrar el toggle en móvil
                    filtersToggle.style.display = 'flex';
                    
                    if (isExpanded) {
                        // Calcular altura dinámica basada en el contenido
                        const contentHeight = filtersContent.scrollHeight;
                        const minRequiredHeight = 180; // Altura mínima para 3 filtros
                        const calculatedHeight = Math.max(contentHeight + 20, minRequiredHeight); // Asegurar mínimo
                        const maxAllowedHeight = Math.min(calculatedHeight, 500); // Máximo 500px
                        
                        filtersContent.style.maxHeight = maxAllowedHeight + 'px';
                        filtersContent.style.minHeight = minRequiredHeight + 'px';
                        filtersContent.style.opacity = '1';
                        filtersContent.style.marginTop = '12px';
                    } else {
                        filtersContent.style.maxHeight = '0';
                        filtersContent.style.minHeight = '0';
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
                
                // Configurar accesibilidad
                filtersToggle.setAttribute('aria-expanded', isExpanded.toString());
                filtersToggle.setAttribute('aria-controls', 'filters-content');
            };
            
            // Función para manejar optimizaciones móviles
            const initializeMobileOptimizations = () => {
                const isMobile = window.innerWidth <= 768;
                
                if (isMobile) {
                    // Mejorar inputs para móvil
                    const filterInputs = filters.querySelectorAll('input');
                    filterInputs.forEach((input) => {
                        // Reducir debounce en móvil para mejor responsividad
                        input.setAttribute('autocomplete', 'off');
                        input.setAttribute('autocorrect', 'off');
                        input.setAttribute('spellcheck', 'false');
                        
                        // Manejar virtual keyboard
                        input.addEventListener('focus', () => {
                            // Pequeño delay para que el keyboard aparezca
                            setTimeout(() => {
                                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                        }, { signal: this.eventAbortController.signal });
                    });
                    
                    // Auto-colapsar filtros cuando se hace scroll (UX mejorada)
                    let scrollTimer: NodeJS.Timeout;
                    let lastScrollY = container.scrollTop;
                    
                    const smartScrollHandler = () => {
                        clearTimeout(scrollTimer);
                        
                        const currentScrollY = container.scrollTop;
                        const isScrollingDown = currentScrollY > lastScrollY;
                        
                        // Si está expandido y se está scrolleando hacia abajo, colapsar
                        if (isScrollingDown && filters.classList.contains('expanded')) {
                            scrollTimer = setTimeout(() => {
                                filters.classList.remove('expanded');
                                updateFiltersState();
                            }, 100);
                        }
                        
                        lastScrollY = currentScrollY;
                    };
                    
                    container.addEventListener('scroll', smartScrollHandler, { signal: this.eventAbortController.signal });
                }
            };
            
            // Event listener para el toggle
            filtersToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle de filtros clickeado en Vista de Foco');
                
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    filters.classList.toggle('expanded');
                    updateFiltersState();
                    console.log('Estado expandido:', filters.classList.contains('expanded'));
                }
            }, { signal: this.eventAbortController.signal });
            
            // Event listener para actualizar contador cuando cambian los filtros
            filters.addEventListener('input', (e) => {
                if ((e.target as HTMLElement).closest('.gtd-filter-group')) {
                    updateFiltersCounter();
                }
            }, { signal: this.eventAbortController.signal });
            
            // Manejar cambios de orientación
            const handleOrientationChange = () => {
                setTimeout(() => {
                    const isMobile = window.innerWidth <= 768;
                    
                    if (isMobile) {
                        // Asegurar que los filtros estén colapsados en landscape
                        // para maximizar espacio vertical
                        if (window.innerHeight < window.innerWidth) {
                            filters.classList.remove('expanded');
                        }
                    } else {
                        // En desktop, mostrar filtros siempre
                        filters.classList.add('expanded');
                    }
                    updateFiltersState();
                }, 100);
            };
            
            // Inicializar estado y optimizaciones
            updateFiltersState();
            updateFiltersCounter();
            initializeMobileOptimizations();
            
            // Event listeners globales
            window.addEventListener('resize', handleOrientationChange, { signal: this.eventAbortController.signal });
            window.addEventListener('orientationchange', handleOrientationChange, { signal: this.eventAbortController.signal });
            
        } else {
            console.log('No se encontraron elementos de filtros en Vista de Foco:', { filtersToggle, filters });
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
                let taskContexts: string[] = [];
                let taskPeople: string[] = [];
                const taskContent = (htmlTaskEl.dataset['content'] || '').toLowerCase();

                try {
                    const parsedContexts = JSON.parse(htmlTaskEl.dataset['contexts'] || '[]');
                    if (Array.isArray(parsedContexts)) taskContexts = parsedContexts as string[];
                } catch (e) {
                    // ignore malformed datasets
                }

                try {
                    const parsedPeople = JSON.parse(htmlTaskEl.dataset['people'] || '[]');
                    if (Array.isArray(parsedPeople)) taskPeople = parsedPeople as string[];
                } catch (e) {
                    // ignore malformed datasets
                }

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
