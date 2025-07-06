import type { HierarchicalItem, Task, ProcessedVaultData, InProgressData } from './model.js';
import { GtdList } from './gtdProcessor.js';
import { isDatePast } from './dateUtils.js';

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
    metadataHtml += '<span class="gtd-breadcrumb-toggle">📄</span>'; // Add toggle icon

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

function renderInProgressView(data: InProgressData, taskBreadcrumbMap: Map<string, string>): string {
    const { stats, overdueTasks, todayTasks, otherTasks } = data;
    const hours = Math.floor(stats.totalDurationMinutes / 60);
    const minutes = stats.totalDurationMinutes % 60;
    const durationString = `${hours}h ${minutes}min`;

    let html = `
        <div class="in-progress-header">
            <span>Tareas Activas: <strong>${stats.total}</strong></span>
            <span>Tiempo Estimado: <strong>${durationString}</strong></span>
            ${stats.overdue > 0 ? `<span>Vencidas: <strong class="is-overdue">${stats.overdue}</strong></span>` : ''}
        </div>
        <div class="in-progress-container">
    `;

    const renderTaskWithBreadcrumb = (task: Task) => renderInProgressTask(task, taskBreadcrumbMap.get(task.id) || '');

    if (overdueTasks.length > 0) {
        html += `
            <div class="gtd-group">
                <div class="gtd-group-title">🔴 Vencidas</div>
                <ul class="gtd-task-list">
                    ${overdueTasks.map(renderTaskWithBreadcrumb).join('')}
                </ul>
            </div>
        `;
    }

    if (todayTasks.length > 0) {
        html += `
            <div class="gtd-group">
                <div class="gtd-group-title">⭐ Prioridades de Hoy</div>
                <ul class="gtd-task-list">
                    ${todayTasks.map(renderTaskWithBreadcrumb).join('')}
                </ul>
            </div>
        `;
    }
    
    if (otherTasks.length > 0) {
        html += `
            <div class="gtd-group">
                <div class="gtd-group-title">Otras Tareas</div>
                <ul class="gtd-task-list">
                    ${otherTasks.map(renderTaskWithBreadcrumb).join('')}
                </ul>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * Renders a single task item into an HTML string.
 * @param task The task to render.
 * @param breadcrumb The hierarchical path of the task's source note.
 * @returns An HTML string for the task.
 */
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
    metadataHtml += '<span class="gtd-breadcrumb-toggle">📄</span>'; // Add toggle icon

    // Convert wikilinks to clickable data-attributes
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

/**
 * Renders the GTD Lists view into an HTML string.
 * @param data The processed data from the vault.
 * @param taskBreadcrumbMap A map from task ID to its breadcrumb path.
 * @returns An HTML string for the GTD lists view.
 */
function renderGtdListsView(data: ProcessedVaultData, taskBreadcrumbMap: Map<string, string>): string {
    const { gtdLists, uniqueContexts, uniquePeople } = data;
    let html = '<div class="gtd-lists-container">';

    // --- Render Filters ---
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

    // --- Render Quick Navigation ---
    const navLinks = listOrder
        .filter(listName => gtdLists[listName] && gtdLists[listName].length > 0)
        .map(listName => `
            <a href="#gtd-list-${listName.replace(/[^a-zA-Z0-9-]/g, '-')}" class="gtd-nav-link">${listName}</a>
        `).join(' | ');
    
    html += `<nav class="gtd-quick-nav">${navLinks}</nav>`;

    // --- Render Task Lists ---
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

/**
 * Recursively renders the hierarchical view into an HTML string using a nested card design.
 * @param item The current hierarchical item to render.
 * @param level The current depth level of the recursion.
 * @returns An HTML string for the item and its children.
 */
function renderHierarchyViewRecursive(item: HierarchicalItem, level: number = 0): string {
    const hasChildren = item.children && item.children.length > 0;
    // Clicks should open the note, so the path is on the header.
    const itemPathAttr = item.file ? `data-item-path="${item.file.path}"` : '';
    const totalTasks = item.ownTaskCount + item.descendantTaskCount;

    const estado = item.frontmatter?.['estado'] ? `<span class="gtd-card-estado">${item.frontmatter['estado']}</span>` : '';
    const missingClass = item.isNoteMissing ? 'is-missing' : '';

    // The header contains all the main info and is clickable.
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
        // Leaf node: just a simple container with the header.
        return `<div class="gtd-card-leaf ${missingClass}">${cardHeader}</div>`;
    }

    // Node with children: use <details> for collapsibility.
    // Only expand the first two levels by default to keep the view clean.
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

/**
 * Generates the complete HTML for the GTD view, including view-switcher controls.
 * @param data The processed data from the vault.
 * @param activeView The view to display ('hierarchy' or 'gtd').
 * @param taskBreadcrumbMap A map from task ID to its breadcrumb path.
 * @returns The complete HTML string for the view.
 */
export function generateGtdViewHtml(data: ProcessedVaultData, activeView: 'hierarchy' | 'gtd' | 'inProgress', taskBreadcrumbMap: Map<string, string>): string {
    const totalOpenTasks = data.allTasks.filter(task => !task.completed).length;

    const hierarchyActiveClass = activeView === 'hierarchy' ? 'active' : '';
    const gtdActiveClass = activeView === 'gtd' ? 'active' : '';
    const inProgressActiveClass = activeView === 'inProgress' ? 'active' : '';

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
        viewContent = renderInProgressView(data.inProgressData, taskBreadcrumbMap);
    }

    return `
        <div class="gtd-view-container">
            <div class="gtd-view-controls">
                <button class="gtd-view-button ${hierarchyActiveClass}" data-view="hierarchy">Vista Jerárquica</button>
                <button class="gtd-view-button ${gtdActiveClass}" data-view="gtd">Listas GTD</button>
                <button class="gtd-view-button ${inProgressActiveClass}" data-view="inProgress">En Progreso</button>
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
