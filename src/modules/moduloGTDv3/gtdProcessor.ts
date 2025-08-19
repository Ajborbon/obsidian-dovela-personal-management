
import type { Task, ProcessedVaultData } from './model.js';
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
    [GtdList.NextActions]: Map<string, Task[]>; // Changed from Task[]
    [GtdList.Calendar]: Task[];
    [GtdList.HopeToday]: Task[];
    [GtdList.Assigned]: Task[];
    [GtdList.Projects]: Task[];
    [GtdList.SomedayMaybe]: Task[];
    [GtdList.ThisWeekNot]: Task[];
    [GtdList.Paused]: Task[];
    [GtdList.Overdue]: Task[];
};


export function processGtdLists(allTasks: Task[], allTaskMap: Map<string, Task>): Omit<ProcessedVaultData, 'hierarchicalData' | 'allTasks'> {
    const gtdLists: GtdListsData = {
        [GtdList.Inbox]: [],
        [GtdList.NextActions]: new Map(), // Changed from []
        [GtdList.Calendar]: [],
        [GtdList.HopeToday]: [],
        [GtdList.Assigned]: [],
        [GtdList.Projects]: [],
        [GtdList.SomedayMaybe]: [],
        [GtdList.ThisWeekNot]: [],
        [GtdList.Paused]: [],
        [GtdList.Overdue]: [],
    };

    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    // Temporary array to hold next actions before grouping
    const tempNextActions: Task[] = [];

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
            gtdLists[GtdList.HopeToday].push(task);

        // Rule 6: Projects
        } else if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);

        // Rule 5: Assigned or Delegated
        } else if (task.assignedPeople.length > 0 && task.contexts.length === 0) {
            gtdLists[GtdList.Assigned].push(task);

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

    return { 
        gtdLists, 
        uniqueContexts: Array.from(uniqueContexts).sort((a, b) => a.localeCompare(b)), 
        uniquePeople: Array.from(uniquePeople).sort((a, b) => a.localeCompare(b)), 
        inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } } 
    };
}
