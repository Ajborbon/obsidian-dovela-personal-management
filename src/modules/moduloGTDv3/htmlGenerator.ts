
import type { HierarchicalItem, Task, ProcessedVaultData } from './model.js';
import { GtdList } from './gtdProcessor.js';
import { isDatePast } from './dateUtils.js';

/**
 * Renders a single task item into an HTML string.
 * @param task The task to render.
 * @returns An HTML string for the task.
 */
function renderTask(task: Task): string {
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
        </li>
    `;
}

/**
 * Renders the GTD Lists view into an HTML string.
 * @param data The processed data from the vault.
 * @returns An HTML string for the GTD lists view.
 */
function renderGtdListsView(data: ProcessedVaultData): string {
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
            <a href="#gtd-list-${listName.replace(/\s+/g, '-')}" class="gtd-nav-link">${listName}</a>
        `).join(' | ');
    
    html += `<nav class="gtd-quick-nav">${navLinks}</nav>`;

    // --- Render Task Lists ---
    for (const listName of listOrder) {
        const tasks = gtdLists[listName];
        if (!tasks || tasks.length === 0) continue;

        const listId = `gtd-list-${listName.replace(/\s+/g, '-')}`;
        html += `
            <details class="gtd-list" open id="${listId}">
                <summary>${listName} <span class="gtd-list-count">(${tasks.length})</span></summary>
        `;

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

            for (const groupName in grouped) {
                const groupTasks = grouped[groupName];
                if (groupTasks) {
                    html += `
                        <div class="gtd-group">
                            <div class="gtd-group-title">${groupName}</div>
                            <ul class="gtd-task-list">
                                ${groupTasks.map(renderTask).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        } else if (listName === GtdList.Overdue) {
            tasks.sort((a, b) => (a.date && b.date) ? a.date.localeCompare(b.date) : 0);
            html += `
                <ul class="gtd-task-list">
                    ${tasks.map(renderTask).join('')}
                </ul>
            `;
        } else if (listName === GtdList.Assigned) {
            const grouped: Record<string, Task[]> = {};
            for (const task of tasks) {
                const key = task.assignedPeople[0] || 'Sin Asignar';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(task);
            }

            for (const groupName in grouped) {
                const groupTasks = grouped[groupName];
                if (groupTasks) {
                    html += `
                        <div class="gtd-group">
                            <div class="gtd-group-title">${groupName}</div>
                            <ul class="gtd-task-list">
                                ${groupTasks.map(renderTask).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        } else {
            html += `
                <ul class="gtd-task-list">
                    ${tasks.map(renderTask).join('')}
                </ul>
            `;
        }

        html += `</details>`;
    }

    html += '</div>';
    return html;
}

/**
 * Recursively renders the hierarchical view into an HTML string.
 * @param item The current hierarchical item to render.
 * @returns An HTML string for the item and its children.
 */
function renderHierarchyViewRecursive(item: HierarchicalItem): string {
    const hasChildren = item.children.length > 0;
    const itemPath = item.file ? `data-item-path="${item.file.path}"` : '';
    const totalTasks = item.ownTaskCount + item.descendantTaskCount;

    const estado = item.frontmatter?.['estado'] ? `<span class="gtd-hierarchy-estado">${item.frontmatter['estado']}</span>` : '';
    
    // Añadir una clase si la nota principal falta
    const missingClass = item.isNoteMissing ? 'is-missing' : '';

    const summaryContent = `
        <span class="gtd-hierarchy-type">[${item.type}]</span>
        ${estado}
        <span class="gtd-hierarchy-name">${item.name}</span>
        <span class="gtd-hierarchy-count">(${item.ownTaskCount}) - &lt;${totalTasks}&gt;</span>
    `;

    if (!hasChildren) {
        return `
            <div class="gtd-hierarchy-item ${missingClass}" ${itemPath}>
                ${summaryContent}
            </div>
        `;
    }

    // Usar <details> para todos los elementos con hijos
    return `
        <details class="gtd-hierarchy-item ${missingClass}" open>
            <summary ${itemPath}>${summaryContent}</summary>
            <div class="gtd-hierarchy-children">
                ${item.children.map(renderHierarchyViewRecursive).join('')}
            </div>
        </details>
    `;
}

/**
 * Generates the complete HTML for the GTD view, including view-switcher controls.
 * @param data The processed data from the vault.
 * @param activeView The view to display ('hierarchy' or 'gtd').
 * @returns The complete HTML string for the view.
 */
export function generateGtdViewHtml(data: ProcessedVaultData, activeView: 'hierarchy' | 'gtd'): string {
    const totalOpenTasks = data.allTasks.filter(task => !task.completed).length;

    const hierarchyActiveClass = activeView === 'hierarchy' ? 'active' : '';
    const gtdActiveClass = activeView === 'gtd' ? 'active' : '';

    let viewContent = '';
    if (activeView === 'hierarchy') {
        viewContent = data.hierarchicalData.map(renderHierarchyViewRecursive).join('');
    } else {
        viewContent = renderGtdListsView(data);
    }

    return `
        <div class="gtd-view-container">
            <div class="gtd-view-controls">
                <button class="gtd-view-button ${hierarchyActiveClass}" data-view="hierarchy">Vista Jerárquica</button>
                <button class="gtd-view-button ${gtdActiveClass}" data-view="gtd">Listas GTD</button>
                <button class="gtd-refresh-button">Refrescar</button>
            </div>
            <div class="gtd-total-tasks">
                <span>Total de Tareas Abiertas: ${totalOpenTasks}</span>
            </div>
            <div class="gtd-view-content">
                ${viewContent}
            </div>
        </div>
    `;
}
