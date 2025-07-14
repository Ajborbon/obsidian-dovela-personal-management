import type { ProcessedVaultData, HierarchicalItem, Task, InProgressData } from './focoModel.js';
import { GtdList } from './focoProcessor.js';
import { isDatePast } from './focoDateUtils.js';

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

    return `
        <li class="gtd-task" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}'>
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
        const groupTasks = groups[groupName];
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

    return `
        <li class="gtd-task" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}'>
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
    const { gtdLists, uniqueContexts, uniquePeople } = data;
    let html = '<div class="gtd-lists-container">';

    html += `
        <div class="gtd-filters">
            <div class="gtd-filter-group">
                <label for="context-filter">Filtrar por Contexto:</label>
                <select id="context-filter">
                    <option value="all">Todos</option>
                    ${uniqueContexts.map(context => `<option value="${context}">${context}</option>`).join('')}
                </select>
            </div>
            <div class="gtd-filter-group">
                <label for="person-filter">Filtrar por Persona:</label>
                <select id="person-filter">
                    <option value="all">Todos</option>
                    ${uniquePeople.map(person => `<option value="${person}">${person}</option>`).join('')}
                </select>
            </div>
        </div>
    `;

    const listOrder: GtdList[] = [
        GtdList.Inbox, GtdList.NextActions, GtdList.Calendar, GtdList.HopeToday,
        GtdList.Overdue, GtdList.Assigned, GtdList.Projects, GtdList.Paused,
        GtdList.ThisWeekNot, GtdList.SomedayMaybe,
    ];

    const navLinks = listOrder
        .filter(listName => gtdLists[listName] && gtdLists[listName].length > 0)
        .map(listName => `
            <a href="#gtd-list-${listName.replace(/[^a-zA-Z0-9-]/g, '-')}" class="gtd-nav-link">${listName}</a>
        `).join(' | ');
    
    html += `<nav class="gtd-quick-nav">${navLinks}</nav>`;

    for (const listName of listOrder) {
        const tasks = gtdLists[listName];
        if (!tasks || tasks.length === 0) continue;

        const listId = `gtd-list-${listName.replace(/[^a-zA-Z0-9-]/g, '-')}`;
        html += `
            <details class="gtd-list" open id="${listId}">
                <summary>${listName} <span class="gtd-list-count">(${tasks.length})</span></summary>
        `;
        
        const renderTaskWithBreadcrumb = (task: Task) => renderTask(task, taskBreadcrumbMap.get(task.id) || '');

        if (listName === GtdList.HopeToday) {
            tasks.sort((a, b) => {
                const aIsCalendar = a.dateSymbol === '📅' ? 0 : 1;
                const bIsCalendar = b.dateSymbol === '📅' ? 0 : 1;
                if (aIsCalendar !== bIsCalendar) return aIsCalendar - bIsCalendar;
                return a.priority.localeCompare(b.priority);
            });

            const grouped: Record<string, Task[]> = {};
            for (const task of tasks) {
                const key = task.contexts[0] || task.assignedPeople[0] || 'Sin Contexto';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(task);
            }

            const sortedGroupNames = Object.keys(grouped).sort();

            for (const groupName of sortedGroupNames) {
                const groupTasks = grouped[groupName];
                if (groupTasks) {
                    html += `
                        <div class="gtd-group">
                            <div class="gtd-group-title">${groupName}</div>
                            <ul class="gtd-task-list">
                                ${groupTasks.map(renderTaskWithBreadcrumb).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        } else if (listName === GtdList.Overdue) {
            tasks.sort((a, b) => (a.date && b.date) ? a.date.localeCompare(b.date) : 0);
            html += `
                <ul class="gtd-task-list">
                    ${tasks.map(renderTaskWithBreadcrumb).join('')}
                </ul>
            `;
        } else if (listName === GtdList.Assigned) {
            const grouped: Record<string, Task[]> = {};
            for (const task of tasks) {
                const key = task.assignedPeople[0] || 'Sin Asignar';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(task);
            }

            const sortedGroupNames = Object.keys(grouped).sort();

            for (const groupName of sortedGroupNames) {
                const groupTasks = grouped[groupName];
                if (groupTasks) {
                    html += `
                        <div class="gtd-group">
                            <div class="gtd-group-title">${groupName}</div>
                            <ul class="gtd-task-list">
                                ${groupTasks.map(renderTaskWithBreadcrumb).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        } else {
            html += `
                <ul class="gtd-task-list">
                    ${tasks.map(renderTaskWithBreadcrumb).join('')}
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

export function generateGtdViewHtml(
    data: ProcessedVaultData, 
    activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'timeline', 
    taskBreadcrumbMap: Map<string, string>,
    activeGrouping: Grouping,
    activeSorting: Sorting
): string {
    const totalOpenTasks = data.allTasks.filter(task => !task.completed).length;

    const hierarchyActiveClass = activeView === 'hierarchy' ? 'active' : '';
    const gtdActiveClass = activeView === 'gtd' ? 'active' : '';
    const inProgressActiveClass = activeView === 'inProgress' ? 'active' : '';
    const timeTrackerActiveClass = activeView === 'time-tracker' ? 'active' : '';
    const timelineActiveClass = activeView === 'timeline' ? 'active' : ''; // Clase para la nueva vista

    let viewContent = '';
    let hierarchyControls = '';

    if (activeView === 'hierarchy') {
        viewContent = data.hierarchicalData.map(root => renderHierarchyViewRecursive(root, 0)).join('');
        hierarchyControls = `
            <button class="gtd-hierarchy-control-button" data-action="expand-all">Expandir Todo</button>
            <button class="gtd-hierarchy-control-button" data-action="collapse-all">Colapsar Todo</button>
        `;
    } else if (activeView === 'gtd') {
        viewContent = renderGtdListsView(data, taskBreadcrumbMap);
    } else if (activeView === 'inProgress') {
        viewContent = renderInProgressView(data.inProgressData, taskBreadcrumbMap, activeGrouping, activeSorting);
    } else if (activeView === 'time-tracker') {
        viewContent = '<div id="time-tracker-container"></div>';
    } else if (activeView === 'timeline') {
        viewContent = '<div id="timeline-container"></div>'; // Contenedor para la nueva vista
    }

    return `
        <div class="gtd-view-container">
            <div class="gtd-view-controls">
                <button class="gtd-view-button ${hierarchyActiveClass}" data-view="hierarchy">Vista Jerárquica</button>
                <button class="gtd-view-button ${gtdActiveClass}" data-view="gtd">Listas GTD</button>
                <button class="gtd-view-button ${inProgressActiveClass}" data-view="inProgress">En Progreso</button>
                <button class="gtd-view-button ${timeTrackerActiveClass}" data-view="time-tracker">Time Tracker</button>
                <button class="gtd-view-button ${timelineActiveClass}" data-view="timeline">Cronograma</button> 
                <button class="gtd-refresh-button">Refrescar</button>
                ${hierarchyControls}
            </div>
            <div class="gtd-total-tasks">
                <span>Total de Tareas Abiertas: ${totalOpenTasks}</span>
            </div>
            <div class="gtd-view-content" data-active-view="${activeView}">
                ${viewContent}
            </div>
        </div>
    `;
}
