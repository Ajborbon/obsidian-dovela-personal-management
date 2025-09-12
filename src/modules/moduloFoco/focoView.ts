
import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
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
import { FocoSettingsModal } from './focoSettingsModal.js';
import { FocoSettingsManager, type FocoExpansionSettings, type ExpansionStats } from './focoSettings.js';
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
    private overdueGroupingMode: 'date-first' | 'context-first' = 'date-first'; // Modo de organización de Vencidas
    private expansionStats: ExpansionStats | null = null; // Estadísticas de la última expansión
    private focoSettings: FocoExpansionSettings;

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin, activeFile: TFile | null) {
        super(leaf);
        this.plugin = plugin;
        this.timeTrackerService = this.plugin.timeTrackerService;
        this.activeFile = activeFile;
        this.focoSettings = FocoSettingsManager.load(); // Cargar configuraciones al inicializar
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

    /**
     * Maneja los clics en enlaces de dependencias para navegar a la tarea dependiente
     */
    private async handleDependencyLinkClick(dependencyId: string): Promise<void> {
        try {
            // Buscar la tarea dependiente en todas las tareas cargadas
            const parsedData = await parseFocus(this.activeFile!, this.app.vault, this.app.metadataCache);
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
            
            // Capturar estadísticas de expansión
            if (parsedData.expansionStats) {
                this.expansionStats = parsedData.expansionStats;
                console.log('🔍 FOCO DEBUG: Estadísticas de expansión capturadas:', this.expansionStats);
            }
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

            const html = generateGtdViewHtml(finalData, this.activeView, taskBreadcrumbMap, this.activeGrouping, this.activeSorting, this.overdueGroupingMode, this.activeFile?.basename, this.expansionStats);
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
            this.initializeMobileFiltersOptimization(container);
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
            
            // NUEVO: Set para trackear IDs únicos de tareas visibles
            const uniqueVisibleTaskIds = new Set<string>();
            let totalVisible = 0;

            container.querySelectorAll('.gtd-task').forEach((taskEl: Element) => {
                const htmlTaskEl = taskEl as HTMLElement;
                let taskContexts: string[] = [];
                let taskPeople: string[] = [];
                const taskContent = (htmlTaskEl.dataset['content'] || '').toLowerCase();
                
                // NUEVO: Obtener ID único de la tarea combinando path y línea
                const taskPath = htmlTaskEl.dataset['taskPath'] || '';
                const taskLine = htmlTaskEl.dataset['taskLine'] || '';
                const taskId = taskPath && taskLine ? `${taskPath}:${taskLine}` : (htmlTaskEl.dataset['taskId'] || htmlTaskEl.dataset['taskLine'] || '');

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
                } else if (button.classList.contains('foco-settings-button')) {
                    this.openSettingsModal();
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

        // === EVENT LISTENER PARA ESTADÍSTICAS DE EXPANSIÓN ===
        container.addEventListener('click', (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const statsContainer = target.closest('.foco-expansion-stats') as HTMLElement;
            
            if (statsContainer) {
                event.preventDefault();
                event.stopPropagation();
                
                const summary = statsContainer.querySelector('.foco-stats-summary') as HTMLElement;
                const detailed = statsContainer.querySelector('.foco-stats-detailed') as HTMLElement;
                
                if (detailed && summary) {
                    const isDetailed = detailed.style.display !== 'none';
                    if (isDetailed) {
                        detailed.style.display = 'none';
                        summary.style.display = '';
                        statsContainer.title = 'Click para más detalles';
                    } else {
                        detailed.style.display = '';
                        summary.style.display = 'none';
                        statsContainer.title = 'Click para vista compacta';
                    }
                }
            }
        }, { signal: this.eventAbortController.signal });

        // === EVENT LISTENER PARA COLAPSAR HEADER DE FOCO ===
        container.addEventListener('click', (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const focusTitle = target.closest('#focus-view-title') as HTMLElement;
            
            if (focusTitle) {
                event.preventDefault();
                event.stopPropagation();
                this.toggleFocusHeaderCollapse();
            }
        }, { signal: this.eventAbortController.signal });

        // Inicializar el estado del header colapsible
        this.initializeFocusHeaderState();
    }

    private toggleFocusHeaderCollapse(): void {
        const collapsibleContent = this.contentEl.querySelector('#focus-collapsible-content') as HTMLElement;
        const indicator = this.contentEl.querySelector('#focus-collapse-indicator') as HTMLElement;
        
        if (collapsibleContent && indicator) {
            const isCollapsed = collapsibleContent.style.display === 'none';
            
            if (isCollapsed) {
                // Expandir
                collapsibleContent.style.display = '';
                indicator.textContent = '👆 Click para colapsar';
                localStorage.setItem('dovela-focus-header-collapsed', 'false');
            } else {
                // Colapsar
                collapsibleContent.style.display = 'none';
                indicator.textContent = '👇 Click para expandir';
                localStorage.setItem('dovela-focus-header-collapsed', 'true');
            }
        }
    }

    private initializeFocusHeaderState(): void {
        const isCollapsed = localStorage.getItem('dovela-focus-header-collapsed') === 'true';
        const collapsibleContent = this.contentEl.querySelector('#focus-collapsible-content') as HTMLElement;
        const indicator = this.contentEl.querySelector('#focus-collapse-indicator') as HTMLElement;
        
        if (collapsibleContent && indicator && isCollapsed) {
            collapsibleContent.style.display = 'none';
            indicator.textContent = '👇 Click para expandir';
        }
    }

    private toggleOverdueGroupingMode(): void {
        // Cambiar el modo
        this.overdueGroupingMode = this.overdueGroupingMode === 'date-first' ? 'context-first' : 'date-first';
        
        // Actualizar el visual del botón
        this.updateOverdueToggleButton();
        
        // Recargar la vista
        if (this.activeFile) {
            this.drawView(this.activeFile);
        }
    }

    private updateOverdueToggleButton(): void {
        const toggleButton = this.contentEl.querySelector('.gtd-overdue-toggle') as HTMLElement;
        if (toggleButton) {
            if (this.overdueGroupingMode === 'date-first') {
                toggleButton.textContent = '📅→📋';
                toggleButton.setAttribute('data-mode', 'date-first');
                toggleButton.title = 'Modo: Por fecha primero. Click para cambiar a contexto/persona primero';
            } else {
                toggleButton.textContent = '📋→📅';
                toggleButton.setAttribute('data-mode', 'context-first');
                toggleButton.title = 'Modo: Por contexto/persona primero. Click para cambiar a fecha primero';
            }
        }
    }

    private openSettingsModal(): void {
        const modal = new FocoSettingsModal(
            this.app, 
            this.plugin,
            (newSettings: FocoExpansionSettings) => {
                this.focoSettings = newSettings;
                console.log('🔍 FOCO DEBUG: Configuraciones actualizadas, refrescando vista...');
                if (this.activeFile) {
                    this.drawView(this.activeFile);
                }
            }
        );
        modal.open();
    }

    public getExpansionStats(): ExpansionStats | null {
        return this.expansionStats;
    }

    public getFocoSettings(): FocoExpansionSettings {
        return this.focoSettings;
    }

    private initializeMobileFiltersOptimization(container: HTMLElement): void {
        const filtersToggle = container.querySelector('#filters-toggle') as HTMLElement;
        const filters = container.querySelector('#gtd-filters') as HTMLElement;
        
        if (!filtersToggle || !filters) {
            console.log('Elementos de filtros no encontrados en Vista de Foco');
            return;
        }

        console.log('Inicializando optimización de filtros móviles en Vista de Foco');
        
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
                
                console.log('Toggle filtros en Vista de Foco:', filters.classList.contains('expanded') ? 'expandido' : 'colapsado');
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
        
        console.log('Optimización de filtros móviles inicializada correctamente en Vista de Foco');
    }
}
