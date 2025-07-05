
import type { HierarchicalItem, Task, ProcessedVaultData } from './model.js';
import { GtdList } from './gtdProcessor.js';

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
    if (task.dueDate) metadataHtml += `<span>📅 ${task.dueDate}</span>`;
    if (task.contexts.length > 0) metadataHtml += `<span>${task.contexts.join(' ')}</span>`;
    if (task.assignedPeople.length > 0) metadataHtml += `<span>${task.assignedPeople.join(' ')}</span>`;

    // Convert wikilinks to clickable data-attributes
    const linkedContent = task.content.replace(/\[\[(.*?)\]\]/g, 
        '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
    );

    return `
        <li class="gtd-task" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}">
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
 * @param gtdLists The classified GTD lists.
 * @returns An HTML string for the GTD lists view.
 */
function renderGtdListsView(gtdLists: Record<GtdList, Task[]>): string {
    let html = '<div class="gtd-lists-container">';
    for (const listName in gtdLists) {
        const tasks = gtdLists[listName as GtdList];
        if (!tasks || tasks.length === 0) continue;

        html += `
            <details class="gtd-list" open>
                <summary>${listName} <span class="gtd-list-count">(${tasks.length})</span></summary>
                <ul class="gtd-task-list">
                    ${tasks.map(renderTask).join('')}
                </ul>
            </details>
        `;
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
    const hierarchyData = data.hierarchicalData;
    const gtdLists = data.gtdLists;
    const totalOpenTasks = data.allTasks.filter(task => !task.completed).length;

    const hierarchyActiveClass = activeView === 'hierarchy' ? 'active' : '';
    const gtdActiveClass = activeView === 'gtd' ? 'active' : '';

    let viewContent = '';
    if (activeView === 'hierarchy') {
        viewContent = hierarchyData.map(renderHierarchyViewRecursive).join('');
    } else {
        viewContent = renderGtdListsView(gtdLists);
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
