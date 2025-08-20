import type { HierarchicalItem, Task, ProcessedVaultData, InProgressData } from './model.js';
import { GtdList } from './gtdProcessor.js';
import { isDatePast } from './dateUtils.js';

type Grouping = 'none' | 'context' | 'person' | 'project';
type Sorting = 'priority' | 'duration-asc' | 'duration-desc';

function renderInProgressTask(task: Task, breadcrumb: string): string {
    const prioritySymbols: Record<Task['priority'], string> = {
        Highest: '⏫', High: '🔼', Medium: '🔽', Low: '⏬', None: ''
    };

    let metadataHtml = '';
    if (task.date) {
        const dateClass = isDatePast(task.date) ? 'is-overdue' : '';
        metadataHtml += `<span class="${dateClass}">${task.dateSymbol} ${task.date}</span>`;
    }
    if (task.duration) {
        metadataHtml += `<span>[${task.duration}]</span>`;
    }
    if (task.contexts.length > 0) metadataHtml += `<span>${task.contexts.join(' ')}</span>`;
    if (task.assignedPeople.length > 0) metadataHtml += `<span>${task.assignedPeople.join(' ')}</span>`;
    metadataHtml += '<span class="gtd-breadcrumb-toggle">📄</span>';

    const linkedContent = task.content.replace(/\[\[(.*?)\]\]/g, 
        '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
    );

    const contextsData = JSON.stringify(task.contexts);
    const peopleData = JSON.stringify(task.assignedPeople);

    const displayClass = task.displayStatus ? ` task--${task.displayStatus}` : '';
    const displayAttr = task.displayStatus ? `${task.displayStatus}` : '';

    return `
        <li class="gtd-task${displayClass}" data-display-status="${displayAttr}" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}'>
            <div class="gtd-task-content">
                <input type="checkbox" />
                <span class="gtd-task-priority">${prioritySymbols[task.priority]}</span>
                ${linkedContent}
            </div>
            <div class="gtd-task-metadata">${metadataHtml}</div>
            <div class="gtd-breadcrumb-container">
                <span class="gtd-breadcrumb-symbol">└─</span>
                <span class="gtd-breadcrumb-path">${breadcrumb}</span>
            </div>
        </li>
    `;
}

function renderInProgressView(
    data: InProgressData, 
    taskBreadcrumbMap: Map<string, string>,
    activeGrouping: Grouping,
    activeSorting: Sorting
): string {
    const { stats, groups } = data;
    
    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}min`;
    };

    const definedTimeString = formatDuration(stats.definedTimeMinutes);
    const estimatedTimeString = formatDuration(stats.estimatedTimeMinutes);

    const sortButtonText = {
        'priority': 'Ordenar por Duración',
        'duration-asc': 'Duración (menor a mayor) 🔼',
        'duration-desc': 'Duración (mayor a menor) 🔽'
    };

    let html = `
        <div class="gtd-control-panel">
            <div class="gtd-stats-header">
                <div class="gtd-stat">
                    <span class="gtd-stat-label">Tareas Activas</span>
                    <span class="gtd-stat-value">${stats.total}</span>
                </div>
                <div class="gtd-stat">
                    <span class="gtd-stat-label">Tiempo Definido</span>
                    <span class="gtd-stat-value">${definedTimeString}</span>
                </div>
                <div class="gtd-stat">
                    <span class="gtd-stat-label">Tiempo Estimado</span>
                    <span class="gtd-stat-value">${estimatedTimeString}</span>
                </div>
                ${stats.overdue > 0 ? `
                <div class="gtd-stat">
                    <span class="gtd-stat-label">Vencidas</span>
                    <span class="gtd-stat-value is-overdue">${stats.overdue}</span>
                </div>` : ''}
            </div>
            <div class="gtd-focus-controls">
                <span>Agrupar por:</span>
                <button class="gtd-grouping-button ${activeGrouping === 'none' ? 'active' : ''}" data-grouping="none">Ninguno</button>
                <button class="gtd-grouping-button ${activeGrouping === 'context' ? 'active' : ''}" data-grouping="context">Contexto</button>
                <button class="gtd-grouping-button ${activeGrouping === 'person' ? 'active' : ''}" data-grouping="person">Persona</button>
                <button class="gtd-grouping-button ${activeGrouping === 'project' ? 'active' : ''}" data-grouping="project">Proyecto</button>
                <button class="gtd-sorting-button">${sortButtonText[activeSorting]}</button>
            </div>
        </div>
        <div class="in-progress-container">
    `;

    const renderTaskWithBreadcrumb = (task: Task) => renderInProgressTask(task, taskBreadcrumbMap.get(task.id) || '');

    for (const groupName in groups) {
        const groupTasks = (groups as any)[groupName] as Task[];
        if (groupTasks && groupTasks.length > 0) {
            const tasksHtml = groupTasks.map(renderTaskWithBreadcrumb).join('');
            html += `
                <details class="gtd-in-progress-group" open>
                    <summary>${groupName} (${groupTasks.length})</summary>
                    <ul>${tasksHtml}</ul>
                </details>
            `;
        }
    }

    html += '</div>';
    return html;
}

function renderTask(task: Task, breadcrumb: string): string {
    const prioritySymbols: Record<Task['priority'], string> = {
        Highest: '⏫', High: '🔼', Medium: '🔽', Low: '⏬', None: ''
    };

    let metadataHtml = '';
    if (task.date) {
        const dateClass = isDatePast(task.date) ? 'is-overdue' : '';
        metadataHtml += `<span class="${dateClass}">${task.dateSymbol} ${task.date}</span>`;
    }
    if (task.contexts.length > 0) metadataHtml += `<span>${task.contexts.join(' ')}</span>`;
    if (task.assignedPeople.length > 0) metadataHtml += `<span>${task.assignedPeople.join(' ')}</span>`;
    metadataHtml += '<span class="gtd-breadcrumb-toggle">📄</span>';

    const linkedContent = task.content.replace(/\[\[(.*?)\]\]/g, 
        '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
    );

    const contextsData = JSON.stringify(task.contexts);
    const peopleData = JSON.stringify(task.assignedPeople);

    const displayClass = task.displayStatus ? ` task--${task.displayStatus}` : '';
    const displayAttr = task.displayStatus ? `${task.displayStatus}` : '';

    return `
        <li class="gtd-task${displayClass}" data-display-status="${displayAttr}" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}' data-content="${task.content.replace(/"/g, '"')}">
            <div class="gtd-task-content">
                <span class="gtd-task-priority">${prioritySymbols[task.priority]}</span>
                ${linkedContent}
            </div>
            <div class="gtd-task-metadata">${metadataHtml}</div>
            <div class="gtd-breadcrumb-container">
                <span class="gtd-breadcrumb-symbol">└─</span>
                <span class="gtd-breadcrumb-path">${breadcrumb}</span>
            </div>
        </li>
    `;
}

function renderGtdListsView(data: ProcessedVaultData, taskBreadcrumbMap: Map<string, string>): string {
    const { gtdLists } = data;
    let html = '<div class="gtd-lists-container">';

    // Función auxiliar para crear IDs consistentes (igual que en el processor)
    const createAnchorId = (text: string): string => {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales excepto espacios y guiones
            .replace(/\s+/g, '-') // Reemplazar espacios con guiones
            .replace(/-+/g, '-') // Remover guiones múltiples
            .trim();
    };

    // === NUEVO: ORDENAMIENTO DINÁMICO CON "OJALÁ HOY" PRIMERA ===
    // Función auxiliar para generar orden dinámico basado en existencia
    const generateDynamicListOrder = (): GtdList[] => {
        // Orden base sin "Ojalá hoy"
        const baseOrder: GtdList[] = [
            GtdList.Inbox, GtdList.NextActions, GtdList.Calendar,
            GtdList.Overdue, GtdList.Assigned, GtdList.Projects, GtdList.Paused,
            GtdList.ThisWeekNot, GtdList.SomedayMaybe,
        ];
        
        // Verificar si "Ojalá hoy" existe y tiene tareas
        const hopeToday = gtdLists[GtdList.HopeToday];
        const hopeTodayExists = hopeToday && (
            Array.isArray(hopeToday) 
                ? hopeToday.length > 0
                : (hopeToday instanceof Map && hopeToday.size > 0)
        );
        
        // Si "Ojalá hoy" existe, ponerla primera. Si no, usar orden base.
        if (hopeTodayExists) {
            return [GtdList.HopeToday, ...baseOrder];
        } else {
            return baseOrder;
        }
    };
    
    // Usar orden dinámico
    const listOrder = generateDynamicListOrder();
    console.log('📋 GTD Order: Orden de listas dinámico:', listOrder.map(l => l.toString()));

    for (const listName of listOrder) {
        const tasks = gtdLists[listName];
        const totalTasksInList = Array.isArray(tasks)
            ? tasks.length
            : (tasks && typeof (tasks as any).values === 'function'
                ? (() => {
                    const vals = Array.from((tasks as any).values()) as Task[][];
                    return vals.reduce((sum, arr) => sum + arr.length, 0);
                })()
                : 0);

        if (!tasks || totalTasksInList === 0) continue;

        const listId = createAnchorId(`gtd-list-${listName}`);

        // Add semantic classes so we can style separators/visual differences between HopeToday, NextActions and Assigned
        let extraClass = '';
        if (listName === GtdList.HopeToday) extraClass = ' gtd-list-hope-today';
        else if (listName === GtdList.NextActions) extraClass = ' gtd-list-next-actions';
        else if (listName === GtdList.Assigned) extraClass = ' gtd-list-assigned';

        html += `
            <details class="gtd-list${extraClass}" open id="${listId}">
                <summary>${listName} <span class="gtd-list-count">(${totalTasksInList})</span></summary>
        `;
        
        const renderTaskWithBreadcrumb = (task: Task) => renderTask(task, taskBreadcrumbMap.get(task.id) || '');

        // Handle grouped lists (Maps) vs simple lists (Arrays)
        if (tasks instanceof Map) {
            const sortedGroupNames = Array.from(tasks.keys()).sort();

            for (const groupName of sortedGroupNames) {
                const groupTasks = tasks.get(groupName);
                if (groupTasks && groupTasks.length > 0) {
                    // Usar la misma lógica de generación de ID que en el processor
                    const groupId = createAnchorId(`${listName}-${groupName}`);
                    html += `
                        <div class="gtd-group" id="${groupId}">
                            <div class="gtd-group-title">${groupName} <span class="gtd-group-count">${groupTasks.length}</span></div>
                            <ul class="gtd-task-list">
                                ${groupTasks.map(renderTaskWithBreadcrumb).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        } else {
            // Handle special sorting for certain lists
            if (listName === GtdList.Overdue) {
                (tasks as Task[]).sort((a, b) => (a.date && b.date) ? a.date.localeCompare(b.date) : 0);
            }
            
            html += `
                <ul class="gtd-task-list">
                    ${(tasks as Task[]).map(renderTaskWithBreadcrumb).join('')}
                </ul>
            `;
        }

        html += `</details>`;
    }

    html += '</div>';
    return html;
}

function renderHierarchyViewRecursive(item: HierarchicalItem, level: number = 0): string {
    const hasChildren = item.children && item.children.length > 0;
    const itemPathAttr = item.file ? `data-item-path="${item.file.path}"` : '';
    const totalTasks = item.ownTaskCount + item.descendantTaskCount;

    const estado = item.frontmatter?.['estado'] ? `<span class="gtd-card-estado">${item.frontmatter['estado']}</span>` : '';
    const missingClass = item.isNoteMissing ? 'is-missing' : '';

    const cardHeader = `
        <div class="gtd-card-header" ${itemPathAttr}>
            <span class="gtd-card-type-icon" data-type="${item.type}"></span>
            <span class="gtd-card-name">${item.name.replace(/\[FALTA\]\s*/, '')}</span>
            ${estado}
            <div class="gtd-card-counts">
                <span class="gtd-card-own-tasks" title="Tareas en esta nota">${item.ownTaskCount}</span>
                <span class="gtd-card-total-tasks" title="Tareas totales en la jerarquía">${totalTasks}</span>
            </div>
        </div>
    `;

    if (!hasChildren) {
        return `<div class="gtd-card-leaf ${missingClass}">${cardHeader}</div>`;
    }

    const openAttr = level < 2 ? 'open' : '';

    return `
        <details class="gtd-card-container ${missingClass}" ${openAttr}>
            <summary>${cardHeader}</summary>
            <div class="gtd-card-children">
                ${item.children.map(child => renderHierarchyViewRecursive(child, level + 1)).join('')}
            </div>
        </details>
    `;
}

// Función auxiliar para generar filtros HTML
function generateFiltersHtml(data: ProcessedVaultData): string {
    const { uniqueContexts, uniquePeople } = data;
    return `
        <div class="gtd-filters" id="gtd-filters">
            <button class="filters-toggle" id="filters-toggle">
                <span>🔍 Filtros (3)</span>
                <span>▼</span>
            </button>
            <div class="filters-content">
                <div class="gtd-filter-group">
                    <label for="context-filter">Contexto:</label>
                    <input type="text" id="context-filter" list="context-list" placeholder="Escribe para filtrar...">
                    <datalist id="context-list">
                        ${uniqueContexts.map(context => `<option value="${context}"></option>`).join('')}
                    </datalist>
                </div>
                <div class="gtd-filter-group">
                    <label for="person-filter">Persona:</label>
                    <input type="text" id="person-filter" list="person-list" placeholder="Escribe para filtrar...">
                    <datalist id="person-list">
                        ${uniquePeople.map(person => `<option value="${person}"></option>`).join('')}
                    </datalist>
                </div>
                <div class="gtd-filter-group">
                    <label for="task-content-filter">Tarea:</label>
                    <input type="text" id="task-content-filter" placeholder="Escribe para filtrar...">
                </div>
            </div>
        </div>
    `;
}

// Función auxiliar para generar navegación rápida
function generateQuickNavHtml(data: ProcessedVaultData): string {
    const { navigationItems = [] } = data;
    
    // Función auxiliar para crear IDs consistentes
    const createAnchorId = (text: string): string => {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    };

    // === NUEVO: ORDENAMIENTO DINÁMICO DE NAVEGACIÓN ===
    // Filtrar y reordenar navigationItems para poner "Ojalá hoy" primera
    const reorderNavigationItems = (items: any[]) => {
        const mainItems = items.filter(item => !item.isSublist);
        const hopeTodayItem = mainItems.find(item => 
            item.label && item.label.toLowerCase().includes('ojalá')
        );
        const otherItems = mainItems.filter(item => 
            !(item.label && item.label.toLowerCase().includes('ojalá'))
        );
        
        // Si existe "Ojalá hoy", ponerla primera
        if (hopeTodayItem) {
            return [hopeTodayItem, ...otherItems];
        }
        return otherItems;
    };
    
    const orderedMainItems = reorderNavigationItems(navigationItems);
    
    // Generate navigation using reordered navigationItems
    const mainNavLinks = orderedMainItems
        .map(item => `
            <a href="#${item.anchor}" class="gtd-nav-link">${item.icon} ${item.label} <span class="gtd-nav-count">${item.count}</span></a>
        `).join('');

    // Build ordered sub-navigation groups (mantenemos la lógica existente)
    const hopeParentId = `gtd-list-${createAnchorId('Ojalá Hoy')}`;
    const nextParentId = `gtd-list-${createAnchorId('Próximas Acciones')}`;
    const assignedParentId = `gtd-list-${createAnchorId('Asignadas o Delegadas')}`;

    const subItemsForParent = (parentId: string) => navigationItems.filter(item => item.isSublist && item.parentList === parentId);

    const renderSubNavItem = (it: any, isHope: boolean) => {
        const iconHtml = isHope ? `🌟 ${it.icon}` : `${it.icon}`;
        const cleanLabel = (it.label || '').toString().replace(/^cx-/, '').replace(/^px-/, '').replace(/^#cx-/, '').replace(/^#px-/, '');
        return `<a href="#${it.anchor}" class="gtd-nav-link gtd-sub-nav-link">${iconHtml} ${cleanLabel} <span class="gtd-nav-count">${it.count}</span></a>`;
    };

    const hopeItems = subItemsForParent(hopeParentId);
    const nextItems = subItemsForParent(nextParentId);
    const assignedItems = subItemsForParent(assignedParentId);

    let subNavHtml = '<div class="gtd-sub-nav">';

    if (hopeItems.length > 0) {
        subNavHtml += `<details class="gtd-subgroup"><summary>Ojalá Hoy <span class="gtd-subgroup-count">${hopeItems.length}</span></summary><div class="gtd-subitems">${hopeItems.map((it: any) => renderSubNavItem(it, true)).join(' | ')}</div></details>`;
    }

    if (nextItems.length > 0) {
        if (hopeItems.length > 0) subNavHtml += '<hr class="gtd-sublist-hr" />';
        subNavHtml += `<details class="gtd-subgroup"><summary>Contextos <span class="gtd-subgroup-count">${nextItems.length}</span></summary><div class="gtd-subitems">${nextItems.map((it: any) => renderSubNavItem(it, false)).join(' | ')}</div></details>`;
    }

    if (assignedItems.length > 0) {
        if (hopeItems.length > 0 || nextItems.length > 0) subNavHtml += '<hr class="gtd-sublist-hr" />';
        subNavHtml += `<details class="gtd-subgroup"><summary>Asignadas <span class="gtd-subgroup-count">${assignedItems.length}</span></summary><div class="gtd-subitems">${assignedItems.map((it: any) => renderSubNavItem(it, false)).join(' | ')}</div></details>`;
    }

    subNavHtml += '</div>';

    return `
        <div class="gtd-quick-nav">
            <div class="gtd-main-nav">${mainNavLinks}</div>
            ${subNavHtml}
        </div>
    `;
}

export function generateGtdViewHtml(
    data: ProcessedVaultData, 
    activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'statistics' | 'timeline', 
    taskBreadcrumbMap: Map<string, string>,
    activeGrouping: Grouping,
    activeSorting: Sorting
): string {
    const totalOpenTasks = data.allTasks.filter(task => !task.completed).length;

    const hierarchyActiveClass = activeView === 'hierarchy' ? 'active' : '';
    const gtdActiveClass = activeView === 'gtd' ? 'active' : '';
    const inProgressActiveClass = activeView === 'inProgress' ? 'active' : '';
    const timeTrackerActiveClass = activeView === 'time-tracker' ? 'active' : '';
    const statisticsActiveClass = activeView === 'statistics' ? 'active' : '';
    const timelineActiveClass = activeView === 'timeline' ? 'active' : '';

    let viewContent = '';
    if (activeView === 'hierarchy') {
        const hierarchyControls = `
            <div class="hierarchy-controls">
                <button class="gtd-hierarchy-control-button" data-action="expand-all">Expandir Todo</button>
                <button class="gtd-hierarchy-control-button" data-action="collapse-all">Colapsar Todo</button>
            </div>
        `;
        viewContent = hierarchyControls + data.hierarchicalData.map(root => renderHierarchyViewRecursive(root, 0)).join('');
    } else if (activeView === 'gtd') {
        viewContent = renderGtdListsView(data, taskBreadcrumbMap);
    } else if (activeView === 'inProgress') {
        viewContent = renderInProgressView(data.inProgressData, taskBreadcrumbMap, activeGrouping, activeSorting);
    } else if (activeView === 'time-tracker') {
        viewContent = '<div id="time-tracker-container"></div>';
    } else if (activeView === 'statistics') {
        viewContent = '<div id="statistics-container"></div>';
    } else if (activeView === 'timeline') {
        viewContent = '<div id="timeline-container"></div>';
    }

    // Estructura HTML mejorada con header pegajoso
    return `
        <div class="gtd-view-container">
            <!-- Header pegajoso unificado -->
            <div class="gtd-sticky-header" id="gtd-sticky-header">
                <!-- Controles de vista -->
                <div class="gtd-view-controls" id="gtd-view-controls">
                    <button class="gtd-view-button ${hierarchyActiveClass}" data-view="hierarchy">
                        📊 Vista Jerárquica
                    </button>
                    <button class="gtd-view-button ${gtdActiveClass}" data-view="gtd">
                        📋 Listas GTD
                    </button>
                    <button class="gtd-view-button ${inProgressActiveClass}" data-view="inProgress">
                        ⚡ En Progreso
                    </button>
                    <button class="gtd-view-button ${timeTrackerActiveClass}" data-view="time-tracker">
                        ⏱️ Seguimiento
                    </button>
                    <button class="gtd-view-button ${statisticsActiveClass}" data-view="statistics">
                        📈 Estadísticas
                    </button>
                    <button class="gtd-view-button ${timelineActiveClass}" data-view="timeline">
                        📅 Cronograma
                    </button>
                    <button class="gtd-refresh-button" title="Refrescar datos">
                        🔄 Refrescar
                    </button>
                </div>

                <!-- Total de tareas -->
                <div class="gtd-total-tasks" id="gtd-total-tasks">
                    <span>Total de Tareas Abiertas: <strong>${totalOpenTasks}</strong></span>
                </div>

                <!-- Filtros responsivos (solo para vista GTD) -->
                ${activeView === 'gtd' ? generateFiltersHtml(data) : ''}

                <!-- Navegación rápida (solo para vista GTD) -->
                ${activeView === 'gtd' ? generateQuickNavHtml(data) : ''}
            </div>

            <!-- Contenido principal -->
            <div class="gtd-view-content" data-active-view="${activeView}">
                ${viewContent}
            </div>
        </div>
    `;
}
