
import type { Task, ProcessedVaultData, NavigationItem } from './model.js';
import { isDatePast, isDateToday, isDateFuture, isWeekPast, isWeekToday, isWeekFuture } from './dateUtils.js';

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

    // Temporary arrays to hold tasks before grouping
    const tempNextActions: Task[] = [];
    const tempHopeTodayActions: Task[] = [];
    const tempAssignedActions: Task[] = [];

    for (const task of allTasks) {
        if (task.completed) continue;

        // Collect contexts and people only from open tasks
        task.contexts.forEach(context => uniqueContexts.add(context));
        task.assignedPeople.forEach(person => uniquePeople.add(person));

        const isPausedByDependency = task.dependencies.some(depId => {
            const depTask = allTaskMap.get(depId.replace(/^\^/, '')); // Handle IDs with or without '^'
            return !!(depTask && !depTask.completed);
        });

        // Rule 1: Inbox (Highest priority for malformed/conflicting tasks)
        if (task.hasConflict || task.tags.includes('inbox') || 
           (task.date && !task.contexts.length && !task.assignedPeople.length && (isDatePast(task.date) || isDateToday(task.date))) ||
           (task.week && !task.contexts.length && !task.assignedPeople.length && (isWeekPast(task.week) || isWeekToday(task.week)))) {
            gtdLists[GtdList.Inbox].push(task);
        
        // Rule 7: Someday/Maybe
        } else if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
        
        // Rule 8: This Week Not
        } else if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);

        // Rule 9: Paused
        } else if (isPausedByDependency || (task.week && isWeekFuture(task.week)) || (task.dateSymbol === '🛫' && task.date && isDateFuture(task.date))) {
            gtdLists[GtdList.Paused].push(task);

        // Rule 3: Calendar
        } else if (task.dateSymbol === '📅' && task.date && task.startTime) {
            gtdLists[GtdList.Calendar].push(task);

        // Rule 4: Overdue (Specific to 📅 and ⏳)
        } else if ((task.dateSymbol === '📅' || task.dateSymbol === '⏳') && task.date && isDatePast(task.date) && (task.contexts.length > 0 || task.assignedPeople.length > 0)) {
            gtdLists[GtdList.Overdue].push(task);
        
        // Rule 4: Hope Today
        } else if ((task.dateSymbol === '📅' || task.dateSymbol === '⏳') && task.date && isDateToday(task.date) && !task.startTime) {
            tempHopeTodayActions.push(task);

        // Rule 6: Projects
        } else if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);

        // Rule 5: Assigned or Delegated
        } else if (task.assignedPeople.length > 0 && task.contexts.length === 0) {
            tempAssignedActions.push(task);

        // Rule 2: Next Actions (Captures present, past 🛫, and future with context)
        } else if (task.contexts.length > 0) {
            tempNextActions.push(task); // Add to temporary list
        
        // Default to Inbox
        } else {
            gtdLists[GtdList.Inbox].push(task);
        }
    }

    // Group Next Actions by context
    for (const task of tempNextActions) {
        const context = task.contexts[0] || '(Sin Contexto)';
        if (!gtdLists[GtdList.NextActions].has(context)) {
            gtdLists[GtdList.NextActions].set(context, []);
        }
        gtdLists[GtdList.NextActions].get(context)?.push(task);
    }

    // Group Hope Today by context or person
    for (const task of tempHopeTodayActions) {
        const key = task.contexts[0] || task.assignedPeople[0] || 'Sin Contexto';
        if (!gtdLists[GtdList.HopeToday].has(key)) {
            gtdLists[GtdList.HopeToday].set(key, []);
        }
        gtdLists[GtdList.HopeToday].get(key)?.push(task);
    }

    // Group Assigned tasks by person
    for (const task of tempAssignedActions) {
        const person = task.assignedPeople[0] || 'Sin Asignar';
        if (!gtdLists[GtdList.Assigned].has(person)) {
            gtdLists[GtdList.Assigned].set(person, []);
        }
        gtdLists[GtdList.Assigned].get(person)?.push(task);
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
