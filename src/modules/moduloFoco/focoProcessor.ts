
import type { Task, ProcessedVaultData, NavigationItem } from './focoModel.js';
import { isDatePast, isDateToday, isDateFuture, isWeekPast, isWeekToday, isWeekFuture } from './focoDateUtils.js';

export enum GtdList {
    Inbox = 'Bandeja de Entrada',
    NextActions = 'Próximas Acciones',
    Calendar = 'Calendario',
    HopeToday = 'Ojalá Hoy',
    Assigned = 'Asignadas o Delegadas',
    Projects = 'Proyectos',
    SomedayMaybe = 'Algún Día / Tal Vez',
    ThisWeekNot = 'Esta Semana No',
    Paused = 'En Pausa',
    Overdue = 'Vencidas',
}

// Define a type for the gtdLists object
type GtdListsData = {
    [GtdList.Inbox]: Task[];
    [GtdList.NextActions]: Map<string, Task[]>;
    [GtdList.Calendar]: Task[];
    [GtdList.HopeToday]: Map<string, Task[]>; // Changed to Map for grouping
    [GtdList.Assigned]: Map<string, Task[]>; // Changed to Map for grouping
    [GtdList.Projects]: Task[];
    [GtdList.SomedayMaybe]: Task[];
    [GtdList.ThisWeekNot]: Task[];
    [GtdList.Paused]: Task[];
    [GtdList.Overdue]: Task[];
};

export function processGtdLists(allTasks: Task[], allTaskMap: Map<string, Task>): Omit<ProcessedVaultData, 'hierarchicalData' | 'allTasks'> {
    const gtdLists: GtdListsData = {
        [GtdList.Inbox]: [],
        [GtdList.NextActions]: new Map(),
        [GtdList.Calendar]: [],
        [GtdList.HopeToday]: new Map(),
        [GtdList.Assigned]: new Map(),
        [GtdList.Projects]: [],
        [GtdList.SomedayMaybe]: [],
        [GtdList.ThisWeekNot]: [],
        [GtdList.Paused]: [],
        [GtdList.Overdue]: [],
    };

    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    // Helper to push into a Map<string, Task[]>
    const pushToMap = (map: Map<string, Task[]>, key: string, task: Task) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(task);
    };

    for (const task of allTasks) {
        if (task.completed) continue;

        // Collect contexts and people only from open tasks
        task.contexts.forEach(context => uniqueContexts.add(context));
        task.assignedPeople.forEach(person => uniquePeople.add(person));

        const isPausedByDependency = task.dependencies.some(depId => {
            const depTask = allTaskMap.get(depId.replace(/^\^/, '')); // Handle IDs with or without '^'
            return !!(depTask && !depTask.completed);
        });

        const hasDate = !!task.date;
        const isOverdue = hasDate && (task.dateSymbol === '📅' || task.dateSymbol === '⏳') && isDatePast(task.date!);
        const isToday = hasDate && isDateToday(task.date!);
        const isFutureStart = task.dateSymbol === '🛫' && task.date && isDateFuture(task.date);
        const isWeekFutureFlag = !!task.week && isWeekFuture(task.week!);
        const isCalendarItem = task.dateSymbol === '📅' && task.date && task.startTime;
        const isHopeTodayCandidate = (task.dateSymbol === '📅' || task.dateSymbol === '⏳') && task.date && isDateToday(task.date) && !task.startTime;
        const hasContext = task.contexts.length > 0;
        const hasAssigned = task.assignedPeople.length > 0;

        // Compute displayStatus with priority:
        // overdue > today > paused-by-dependency (orange) > paused-start (blue) > future
        // Note: "future" visual styling should apply ONLY for tasks that are flagged as a future start (🛫).
        // Due (📅) or scheduled (⏳) dates in the future should NOT receive the 'future' displayStatus.
        if (isOverdue) {
            task.displayStatus = 'overdue';
        } else if (isToday) {
            task.displayStatus = 'today';
        } else if (isPausedByDependency) {
            task.displayStatus = 'paused-dep';
        } else if (isFutureStart) {
            task.displayStatus = 'paused-start';
        } else if (hasDate && isDateFuture(task.date!) && task.dateSymbol === '🛫') {
            // Defensive: only assign 'future' when the dateSymbol explicitly indicates a start (🛫).
            task.displayStatus = 'future';
        } else {
            task.displayStatus = null;
        }

        // Exclusive lists: SomedayMaybe and ThisWeekNot per requirement
        if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }
        if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        // Inbox: keep adding to Inbox when conditions match but NOT exclusive (inbox items will also be shown in other lists)
        if (task.hasConflict || task.tags.includes('inbox') ||
            (task.date && !hasContext && !hasAssigned && (isDatePast(task.date) || isDateToday(task.date))) ||
            (task.week && !hasContext && !hasAssigned && (isWeekPast(task.week!) || isWeekToday(task.week!)))
        ) {
            gtdLists[GtdList.Inbox].push(task);
            // DO NOT continue; inbox entries should still appear in other relevant lists
        }

        // Paused (both dependency and future-start) - also not exclusive: show in Paused and in context/person lists
        if (isPausedByDependency || isWeekFutureFlag || isFutureStart) {
            gtdLists[GtdList.Paused].push(task);
            // continue is intentionally omitted because paused tasks should also appear in context/assigned lists
        }

        // Calendar: scheduled items with start time
        if (isCalendarItem) {
            gtdLists[GtdList.Calendar].push(task);
        }

        // Overdue: specific to date symbols 📅 or ⏳ and must have context or assigned
        if (isOverdue && (hasContext || hasAssigned)) {
            gtdLists[GtdList.Overdue].push(task);
        }

        // Hope Today
        if (isHopeTodayCandidate) {
            // Use explicit prefixes so navigation and icons can unambiguously detect type
            if (task.contexts[0]) {
                const key = `cx-${task.contexts[0]}`;
                pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
            } else if (task.assignedPeople[0]) {
                const key = `px-${task.assignedPeople[0]}`;
                pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
            } else {
                const key = 'cx-Sin Contexto';
                pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
            }
        }

        // Assigned: add to Assigned map (can co-exist with context)
        if (hasAssigned) {
            const person = task.assignedPeople[0] || 'Sin Asignar';
            const key = `px-${person}`;
            pushToMap(gtdLists[GtdList.Assigned] as Map<string, Task[]>, key, task);
        }

        // Next Actions: add by context (can co-exist with assigned and date-based lists)
        if (hasContext) {
            const context = task.contexts[0] || '(Sin Contexto)';
            const key = `cx-${context}`;
            pushToMap(gtdLists[GtdList.NextActions] as Map<string, Task[]>, key, task);
        }

        // Projects: keep a list of project-related tasks but not exclusive
        if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);
        }

        // Fallback: if nothing matched (no context, no assigned, no date-based inclusion), put into Inbox
        const inAnyList = (
            gtdLists[GtdList.Calendar].includes(task) ||
            gtdLists[GtdList.Overdue].includes(task) ||
            Array.from((gtdLists[GtdList.HopeToday] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            Array.from((gtdLists[GtdList.Assigned] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            Array.from((gtdLists[GtdList.NextActions] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            gtdLists[GtdList.Projects].includes(task) ||
            gtdLists[GtdList.Paused].includes(task) ||
            gtdLists[GtdList.Inbox].includes(task)
        );

        if (!inAnyList) {
            gtdLists[GtdList.Inbox].push(task);
        }
    }

    // Generar elementos de navegación
    const navigationItems = generateNavigationItems(gtdLists);

    return { 
        gtdLists, 
        uniqueContexts: Array.from(uniqueContexts).sort((a, b) => a.localeCompare(b)), 
        uniquePeople: Array.from(uniquePeople).sort((a, b) => a.localeCompare(b)), 
        inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } },
        navigationItems
    };
}

/**
 * Genera los elementos de navegación para las listas GTD
 */
function generateNavigationItems(gtdLists: GtdListsData): NavigationItem[] {
    const navigationItems: NavigationItem[] = [];
    
    // Función auxiliar para crear un ID válido para anclas
    const createAnchorId = (text: string): string => {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales excepto espacios y guiones
            .replace(/\s+/g, '-') // Reemplazar espacios con guiones
            .replace(/-+/g, '-') // Remover guiones múltiples
            .trim();
    };
    
    // Procesar cada lista GTD con tipos correctos
    for (const [listName, tasks] of Object.entries(gtdLists) as [string, Task[] | Map<string, Task[]>][]) {
        let totalTasksInList = 0;
        const listId = createAnchorId(listName);
        
        // Calcular total de tareas en la lista
        if (Array.isArray(tasks)) {
            totalTasksInList = tasks.length;
        } else if (tasks instanceof Map) {
            totalTasksInList = Array.from(tasks.values()).reduce((sum, arr: Task[]) => sum + arr.length, 0);
        }
        
        // Solo agregar si hay tareas
        if (totalTasksInList > 0) {
            // Agregar lista principal
            navigationItems.push({
                id: `gtd-list-${listId}`,
                label: listName,
                count: totalTasksInList,
                icon: getListIcon(listName as GtdList),
                isSublist: false,
                anchor: `gtd-list-${listId}`
            });
            
            // Agregar sublistas si existen
            if (tasks instanceof Map) {
                const sortedKeys = Array.from(tasks.keys()).sort();
                
                sortedKeys.forEach((sublistKey: string) => {
                    const sublistTasks = tasks.get(sublistKey);
                    if (sublistTasks && sublistTasks.length > 0) {
                        const sublistId = createAnchorId(`${listName}-${sublistKey}`);
                        
                        navigationItems.push({
                            id: sublistId,
                            label: sublistKey,
                            count: sublistTasks.length,
                            icon: getSublistIcon(listName as GtdList, sublistKey),
                            isSublist: true,
                            parentList: `gtd-list-${listId}`,
                            anchor: sublistId
                        });
                    }
                });
            }
        }
    }
    
    return navigationItems;
}

/**
 * Obtiene el icono apropiado para cada lista GTD
 */
function getListIcon(listName: GtdList): string {
    const iconMap: Record<GtdList, string> = {
        [GtdList.Inbox]: '📥',
        [GtdList.NextActions]: '➡️',
        [GtdList.Calendar]: '📅',
        [GtdList.HopeToday]: '🌟',
        [GtdList.Assigned]: '👥',
        [GtdList.Projects]: '💼',
        [GtdList.SomedayMaybe]: '🕰️',
        [GtdList.ThisWeekNot]: '⛔',
        [GtdList.Paused]: '⏸️',
        [GtdList.Overdue]: '⚠️'
    };
    
    return iconMap[listName] || '📋';
}

/**
 * Obtiene el icono apropiado para sublistas según el tipo
 */
function getSublistIcon(listName: GtdList, sublistKey: string): string {
    // Para Próximas Acciones y Ojalá Hoy, detectar si es contexto o persona
    if (listName === GtdList.NextActions || listName === GtdList.HopeToday) {
        if (sublistKey.startsWith('#cx-') || sublistKey.startsWith('cx-')) {
            return '📋'; // Contexto
        }
        if (sublistKey.startsWith('#px-') || sublistKey.startsWith('@') || sublistKey.startsWith('px-')) {
            return '👤'; // Persona
        }
    }
    
    // Para Asignadas, siempre son personas
    if (listName === GtdList.Assigned) {
        return '👤'; // Persona
    }
    
    // Icono genérico por defecto
    return '📋';
}
