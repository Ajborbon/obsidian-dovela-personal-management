import type { HierarchicalItem, Task, ProcessedVaultData, InProgressData } from './model.js';
import { GtdList } from './gtdProcessor.js';
import { isDatePast } from './dateUtils.js';

type Grouping = 'none' | 'context' | 'person' | 'project';
type Sorting = 'priority' | 'duration-asc' | 'duration-desc';

/**
 * Procesa el contenido de una tarea para agregar enlaces interactivos a las dependencias
 */
function processDependencyLinks(content: string): string {
    // Patrón para detectar dependencias: ⛔ seguido de ID (opcionalmente con ^)
    const dependencyPattern = /⛔\s*(\^?[a-zA-Z0-9-_]+)/g;
    
    return content.replace(dependencyPattern, (_match: string, ...args: any[]) => {
        const depId = args[0] as string;
        const cleanDepId = depId.replace(/^\^/, '');
        return `⛔ ${depId} <span class="dependency-link" data-dependency-id="${cleanDepId}" title="Ir a la tarea dependiente: ${cleanDepId}">🔗</span>`;
    });
}

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

    // Procesar enlaces internos de Obsidian
    let processedContent = task.content.replace(/\[\[(.*?)\]\]/g, 
        '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
    );
    
    // Procesar enlaces de dependencias
    processedContent = processDependencyLinks(processedContent);

    const contextsData = JSON.stringify(task.contexts);
    const peopleData = JSON.stringify(task.assignedPeople);

    const displayClass = task.displayStatus ? ` task--${task.displayStatus}` : '';
    const displayAttr = task.displayStatus ? `${task.displayStatus}` : '';

    return `
        <li class="gtd-task${displayClass}" data-display-status="${displayAttr}" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}'>
            <div class="gtd-task-content">
                <input type="checkbox" />
                <span class="gtd-task-priority">${prioritySymbols[task.priority]}</span>
                ${processedContent}
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

/**
 * Calcula la hora de finalización de una tarea
 */
function calculateEndTime(task: Task): string | null {
    if (!task.startTime) return null;
    
    // Si tiene hora de finalización explícita (hF), convertir a 24h
    if (task.endTime) return convertTo24Hour(task.endTime);
    
    // Si tiene duración, calcular fin = inicio + duración
    if (task.duration) {
        return addDurationToTime(task.startTime, task.duration);
    }
    
    // Por defecto, 30 minutos
    return addMinutesToTime(task.startTime, 30);
}

/**
 * Convierte duración en formato "30min" o "2h" a minutos (sin corchetes)
 */
function parseDurationToMinutes(duration: string): number {
    // Primero, limpiar corchetes si los tiene
    const cleanDuration = duration.replace(/[\[\]]/g, '');
    
    // Buscar patrón: número seguido de "min" o "h"
    const match = cleanDuration.match(/(\d+)(min|h)/);
    if (!match) return 30; // default
    
    const value = parseInt(match[1] || '');
    const unit = match[2] || '';
    
    if (isNaN(value)) return 30;
    
    return unit === 'h' ? value * 60 : value;
}

/**
 * Suma duración a una hora de inicio
 */
function addDurationToTime(startTime: string, duration: string): string {
    const minutes = parseDurationToMinutes(duration);
    return addMinutesToTime(startTime, minutes);
}

/**
 * Convierte tiempo de formato 12h (10am, 2:30pm) a formato 24h (10:00, 14:30)
 */
function convertTo24Hour(time12: string): string {
    // Si ya está en formato 24h (HH:MM), devolverlo tal como está
    if (time12.match(/^\d{1,2}:\d{2}$/)) {
        return time12;
    }
    
    // Limpiar espacios y convertir a minúsculas
    const cleanTime = time12.trim().toLowerCase();
    
    // Extraer am/pm
    const isAM = cleanTime.includes('am');
    const isPM = cleanTime.includes('pm');
    
    if (!isAM && !isPM) {
        // Si no tiene am/pm, asumir formato 24h y agregar :00 si es necesario
        if (cleanTime.match(/^\d{1,2}$/)) {
            return `${cleanTime.padStart(2, '0')}:00`;
        }
        return cleanTime;
    }
    
    // Extraer la parte numérica (remover am/pm)
    const timeOnly = cleanTime.replace(/am|pm/g, '').trim();
    
    // Separar horas y minutos
    let hours: number, minutes: number;
    if (timeOnly.includes(':')) {
        const parts = timeOnly.split(':');
        if (parts.length >= 2) {
            hours = parseInt(parts[0] || '0') || 0;
            minutes = parseInt(parts[1] || '0') || 0;
        } else {
            hours = 0;
            minutes = 0;
        }
    } else {
        hours = parseInt(timeOnly) || 0;
        minutes = 0;
    }
    
    // Convertir a formato 24h
    if (isAM) {
        if (hours === 12) hours = 0; // 12am = 00:xx
    } else { // isPM
        if (hours !== 12) hours += 12; // 1pm = 13:xx, pero 12pm = 12:xx
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Suma minutos a una hora en formato HH:MM
 */
function addMinutesToTime(time: string, minutesToAdd: number): string {
    // Primero convertir a formato 24h si es necesario
    const time24 = convertTo24Hour(time);
    const timeParts = time24.split(':');
    if (timeParts.length !== 2) {
        return '00:00'; // Fallback si el formato es inválido
    }
    
    const hoursNum = parseInt(timeParts[0] || '0');
    const minutesNum = parseInt(timeParts[1] || '0');
    if (isNaN(hoursNum) || isNaN(minutesNum)) {
        return '00:00'; // Fallback si la conversión falla
    }
    
    const totalMinutes = hoursNum * 60 + minutesNum + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

/**
 * Calcula el tiempo total de las tareas de la agenda y formatea el título
 */
function calculateAgendaTotalTime(tasks: Task[]): string {
    let totalMinutes = 0;
    
    for (const task of tasks) {
        if (task.endTime && task.startTime) {
            // Convertir ambos tiempos a formato 24h antes de calcular
            const startTime24 = convertTo24Hour(task.startTime);
            const endTime24 = convertTo24Hour(task.endTime);
            
            // Calcular duración basada en hora fin - hora inicio
            const startParts = startTime24.split(':');
            const endParts = endTime24.split(':');
            
            if (startParts.length === 2 && endParts.length === 2) {
                const startH = parseInt(startParts[0] || '0');
                const startM = parseInt(startParts[1] || '0');
                const endH = parseInt(endParts[0] || '0');
                const endM = parseInt(endParts[1] || '0');
                
                if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
                    const startTotalMin = startH * 60 + startM;
                    const endTotalMin = endH * 60 + endM;
                    
                    // Manejar casos donde la hora de fin es al día siguiente
                    let duration = endTotalMin - startTotalMin;
                    if (duration < 0) {
                        duration += 24 * 60; // Agregar 24 horas
                    }
                    totalMinutes += duration;
                }
            }
        } else if (task.duration) {
            // Usar duración explícita
            totalMinutes += parseDurationToMinutes(task.duration);
        } else {
            // Por defecto 30 minutos
            totalMinutes += 30;
        }
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    } else {
        return `${mins}min`;
    }
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

    // Procesar enlaces internos de Obsidian
    let processedContent = task.content.replace(/\[\[(.*?)\]\]/g, 
        '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
    );
    
    // NUEVA LÓGICA: Mostrar hora ANTES del contenido si es tarea del calendario
    if (task.startTime) {
        const startTime24 = convertTo24Hour(task.startTime);
        const endTime = calculateEndTime(task);
        const timeRange = endTime ? `${startTime24}-${endTime}` : startTime24;
        processedContent = `<span class="gtd-time-range">⏰ ${timeRange}</span> ${processedContent}`;
    }
    
    // Procesar enlaces de dependencias
    processedContent = processDependencyLinks(processedContent);

    const contextsData = JSON.stringify(task.contexts);
    const peopleData = JSON.stringify(task.assignedPeople);

    const displayClass = task.displayStatus ? ` task--${task.displayStatus}` : '';
    const displayAttr = task.displayStatus ? `${task.displayStatus}` : '';

    return `
        <li class="gtd-task${displayClass}" data-display-status="${displayAttr}" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}" data-contexts='${contextsData}' data-people='${peopleData}' data-content="${task.content.replace(/"/g, '"')}">
            <div class="gtd-task-content">
                <span class="gtd-task-priority">${prioritySymbols[task.priority]}</span>
                ${processedContent}
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
 * Renderiza las tareas vencidas con agrupación dual jerárquica
 */
function renderOverdueGroupedTasks(
    overdueMap: Map<string, Task[]>, 
    renderTaskWithBreadcrumb: (task: Task) => string,
    createAnchorId: (text: string) => string,
    listName: string
): string {
    let html = '';
    
    // Procesar las claves agrupadas para organizarlas jerárquicamente
    const groupedData = new Map<string, Map<string, Task[]>>();
    
    for (const [key, tasks] of overdueMap.entries()) {
        if (key.includes('|')) {
            // Clave compuesta: "📅 2024-01-15|cx-Trabajo" o "📋 cx-Trabajo|2024-01-15"
            const splitResult = key.split('|');
            const primaryKey = splitResult[0];
            const secondaryKey = splitResult[1];
            
            if (primaryKey && secondaryKey && !groupedData.has(primaryKey)) {
                groupedData.set(primaryKey, new Map());
            }
            if (primaryKey && secondaryKey) {
                groupedData.get(primaryKey)!.set(secondaryKey, tasks);
            }
        } else {
            // Clave simple (no debería ocurrir con la nueva lógica, pero por seguridad)
            if (!groupedData.has(key)) {
                groupedData.set(key, new Map());
            }
            groupedData.get(key)!.set('', tasks);
        }
    }
    
    // Ordenar las claves primarias
    const sortedPrimaryKeys = Array.from(groupedData.keys()).sort((a, b) => {
        // Si es por fechas primero, ordenar por fecha (más antigua primero = más urgente)
        if (a.startsWith('📅') && b.startsWith('📅')) {
            const dateA = a.replace('📅 ', '');
            const dateB = b.replace('📅 ', '');
            return dateA.localeCompare(dateB);
        }
        // Si es por contexto/persona primero, ordenar alfabéticamente
        return a.localeCompare(b);
    });
    
    // Renderizar la jerarquía
    for (const primaryKey of sortedPrimaryKeys) {
        const secondaryGroups = groupedData.get(primaryKey)!;
        const totalTasksInPrimary = Array.from(secondaryGroups.values()).reduce((sum, tasks) => sum + tasks.length, 0);
        
        // Limpiar la clave primaria para mostrar
        let displayPrimaryKey = primaryKey.replace(/^📅 /, '').replace(/^📋 /, '').replace(/^👤 /, '');
        
        const primaryGroupId = createAnchorId(`${listName}-${primaryKey}`);
        
        html += `
            <div class="gtd-group gtd-overdue-primary-group" id="${primaryGroupId}">
                <div class="gtd-group-title gtd-overdue-primary-title">${displayPrimaryKey} <span class="gtd-group-count">${totalTasksInPrimary}</span></div>
        `;
        
        // Ordenar las claves secundarias
        const sortedSecondaryKeys = Array.from(secondaryGroups.keys()).sort((a, b) => {
            // Si las claves secundarias son fechas, ordenar por fecha (más antigua primero)
            if (a.match(/^\d{4}-\d{2}-\d{2}$/) && b.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return a.localeCompare(b);
            }
            // Si son contextos/personas, ordenar alfabéticamente
            return a.localeCompare(b);
        });
        
        for (const secondaryKey of sortedSecondaryKeys) {
            const tasks = secondaryGroups.get(secondaryKey)!;
            if (tasks.length > 0) {
                // Limpiar la clave secundaria para mostrar
                let displaySecondaryKey = secondaryKey.replace(/^cx-/, '').replace(/^px-/, '');
                
                // Si la clave secundaria está vacía, no mostrar sublista
                if (secondaryKey === '') {
                    html += `
                        <ul class="gtd-task-list">
                            ${tasks.map(renderTaskWithBreadcrumb).join('')}
                        </ul>
                    `;
                } else {
                    const secondaryGroupId = createAnchorId(`${listName}-${primaryKey}-${secondaryKey}`);
                    html += `
                        <div class="gtd-subgroup gtd-overdue-secondary-group" id="${secondaryGroupId}">
                            <div class="gtd-subgroup-title gtd-overdue-secondary-title">${displaySecondaryKey} <span class="gtd-subgroup-count">${tasks.length}</span></div>
                            <ul class="gtd-task-list">
                                ${tasks.map(renderTaskWithBreadcrumb).join('')}
                            </ul>
                        </div>
                    `;
                }
            }
        }
        
        html += `</div>`;
    }
    
    return html;
}

function renderGtdListsView(data: ProcessedVaultData, taskBreadcrumbMap: Map<string, string>, overdueGroupingMode: 'date-first' | 'context-first' = 'date-first'): string {
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
            GtdList.Overdue, GtdList.Inbox, GtdList.Calendar,
            GtdList.Projects, GtdList.NextActions, GtdList.Assigned, GtdList.Paused,
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
        else if (listName === GtdList.Overdue) extraClass = ' gtd-list-overdue';

        // Generar botón de toggle para lista Vencidas
        let toggleButton = '';
        if (listName === GtdList.Overdue) {
            const mode = overdueGroupingMode;
            const buttonText = mode === 'date-first' ? '📅→📋' : '📋→📅';
            const titleText = mode === 'date-first' 
                ? 'Modo: Por fecha primero. Click para cambiar a contexto/persona primero'
                : 'Modo: Por contexto/persona primero. Click para cambiar a fecha primero';
                
            toggleButton = `
                <button class="gtd-overdue-toggle" 
                        data-mode="${mode}" 
                        title="${titleText}">
                    ${buttonText} 
                </button>
            `;
        }

        html += `
            <details class="gtd-list${extraClass}" open id="${listId}">
                <summary>${listName} <span class="gtd-list-count">(${totalTasksInList})</span>${toggleButton}</summary>
        `;
        
        const renderTaskWithBreadcrumb = (task: Task) => renderTask(task, taskBreadcrumbMap.get(task.id) || '');

        // Handle grouped lists (Maps) vs simple lists (Arrays)
        if (tasks instanceof Map) {
            if (listName === GtdList.Overdue) {
                // Renderizado especial para lista de vencidas con agrupación dual
                html += renderOverdueGroupedTasks(tasks, renderTaskWithBreadcrumb, createAnchorId, listName);
            } else {
                // Renderizado normal para otras listas agrupadas
                // Ordenamiento especial: "📅 Agenda de Hoy" siempre primera
                const groupNames = Array.from(tasks.keys());
                const sortedGroupNames = groupNames.sort((a, b) => {
                    // "📅 Agenda de Hoy" siempre primera
                    if (a === '📅 Agenda de Hoy') return -1;
                    if (b === '📅 Agenda de Hoy') return 1;
                    // Resto alfabéticamente
                    return a.localeCompare(b);
                });

                for (const groupName of sortedGroupNames) {
                    const groupTasks = tasks.get(groupName);
                    if (groupTasks && groupTasks.length > 0) {
                        // Usar la misma lógica de generación de ID que en el processor
                        const groupId = createAnchorId(`${listName}-${groupName}`);
                        
                        // Título especial para "Agenda de Hoy" con tiempo total y "citas"
                        let groupTitle = '';
                        if (groupName === '📅 Agenda de Hoy') {
                            const totalTime = calculateAgendaTotalTime(groupTasks);
                            groupTitle = `${groupName} <span class="gtd-group-count">${groupTasks.length} citas - ${totalTime}</span>`;
                        } else {
                            groupTitle = `${groupName} <span class="gtd-group-count">${groupTasks.length}</span>`;
                        }
                        
                        html += `
                            <div class="gtd-group" id="${groupId}">
                                <div class="gtd-group-title">${groupTitle}</div>
                                <ul class="gtd-task-list">
                                    ${groupTasks.map(renderTaskWithBreadcrumb).join('')}
                                </ul>
                            </div>
                        `;
                    }
                }
            }
        } else {
            // Handle arrays (simple lists without grouping)  
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

    // Agregar datos para búsqueda
    const searchData = {
        name: item.name.replace(/\[FALTA\]\s*/, ''),
        type: item.type,
        hasOwnTasks: item.ownTaskCount > 0,
        hasDescendantTasks: item.descendantTaskCount > 0,
        totalTasks: totalTasks,
        level: level
    };
    const searchDataAttrs = [
        `data-search-name="${searchData.name.toLowerCase()}"`,
        `data-search-type="${searchData.type}"`,
        `data-search-has-own="${searchData.hasOwnTasks}"`,
        `data-search-has-desc="${searchData.hasDescendantTasks}"`,
        `data-search-total="${searchData.totalTasks}"`,
        `data-search-level="${searchData.level}"`
    ].join(' ');

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
        const checkInProgressClass = item.file ? 'check-in-progress' : '';
        const checkInProgressAttr = item.file ? `data-check-path="${item.file.path}"` : '';
        return `<div class="gtd-card-leaf gtd-hierarchy-item ${missingClass} ${checkInProgressClass}" ${checkInProgressAttr} ${searchDataAttrs}>${cardHeader}</div>`;
    }

    const openAttr = level < 2 ? 'open' : '';

    const checkInProgressClass = item.file ? 'check-in-progress' : '';
    const checkInProgressAttr = item.file ? `data-check-path="${item.file.path}"` : '';
    return `
        <details class="gtd-card-container gtd-hierarchy-item ${missingClass} ${checkInProgressClass}" ${checkInProgressAttr} ${openAttr} ${searchDataAttrs}>
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

    // === NAVEGACIÓN YA ORDENADA POR gtdProcessor ===
    // Los navigationItems ya vienen en el orden correcto desde generateNavigationItems
    const orderedMainItems = navigationItems.filter(item => !item.isSublist);
    
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
    activeSorting: Sorting,
    overdueGroupingMode: 'date-first' | 'context-first' = 'date-first'
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
                <div class="hierarchy-search-container">
                    <div class="gtd-filter-group">
                        <label for="hierarchy-search-filter">🔍 Buscar:</label>
                        <input type="text" id="hierarchy-search-filter" placeholder="Buscar por título...">
                    </div>
                    <div class="hierarchy-search-options">
                        <div class="hierarchy-toggle-container">
                            <span class="hierarchy-toggle-text">Incluir contenido:</span>
                            <div class="hierarchy-toggle-controls">
                                <div class="hierarchy-toggle" id="hierarchy-include-content" role="button" tabindex="0">
                                    <div class="hierarchy-toggle-slider"></div>
                                </div>
                                <div class="hierarchy-search-results" id="hierarchy-search-results"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hierarchy-buttons">
                    <button class="gtd-hierarchy-control-button" data-action="expand-all">Expandir Todo</button>
                    <button class="gtd-hierarchy-control-button" data-action="collapse-all">Colapsar Todo</button>
                </div>
            </div>
        `;
        viewContent = hierarchyControls + data.hierarchicalData.map(root => renderHierarchyViewRecursive(root, 0)).join('');
    } else if (activeView === 'gtd') {
        viewContent = renderGtdListsView(data, taskBreadcrumbMap, overdueGroupingMode);
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
