
import type { Task } from './model.js';

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

// --- Date Helper Functions ---

function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function isDatePast(dateString: string): boolean {
    const date = new Date(dateString);
    return date < getToday();
}

function isDateToday(dateString: string): boolean {
    const today = getToday();
    const date = new Date(dateString);
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
}

function isDateFuture(dateString: string): boolean {
    const date = new Date(dateString);
    return date > getToday();
}

function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

function isWeekPast(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentWeek = getWeekNumber(today);

    if (year < currentYear) return true;
    if (year === currentYear && week < currentWeek) return true;
    return false;
}

function isWeekToday(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentWeek = getWeekNumber(today);

    return year === currentYear && week === currentWeek;
}

function isWeekFuture(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentWeek = getWeekNumber(today);

    if (year > currentYear) return true;
    if (year === currentYear && week > currentWeek) return true;
    return false;
}


export function processGtdLists(allTasks: Task[], allTaskMap: Map<string, Task>): Record<GtdList, Task[]> {
    const gtdLists: Record<GtdList, Task[]> = {
        [GtdList.Inbox]: [],
        [GtdList.NextActions]: [],
        [GtdList.Calendar]: [],
        [GtdList.HopeToday]: [],
        [GtdList.Assigned]: [],
        [GtdList.Projects]: [],
        [GtdList.SomedayMaybe]: [],
        [GtdList.ThisWeekNot]: [],
        [GtdList.Paused]: [],
        [GtdList.Overdue]: [],
    };

    for (const task of allTasks) {
        if (task.completed) continue;

        let isClassified = false;

        // Rule 1: Inbox (for conflicts and explicit tag)
        if (task.hasConflict || task.tags.includes('inbox')) {
            gtdLists[GtdList.Inbox].push(task);
            isClassified = true;
        }

        // Rule 7: Someday/Maybe
        if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }

        // Rule 8: This Week Not
        if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        // Rule 9: Paused
        const isPausedByDependency = task.dependencies.some(depId => {
            const depTask = allTaskMap.get(depId);
            return depTask && !depTask.completed;
        });
        if ((task.startDate && isDateFuture(task.startDate)) || isPausedByDependency || (task.week && isWeekFuture(task.week))) {
            gtdLists[GtdList.Paused].push(task);
            continue;
        }

        // Rule 3: Calendar
        if (task.startDate && task.startTime) {
            gtdLists[GtdList.Calendar].push(task);
            continue;
        }
        
        // Rule 6: Projects
        if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);
            continue;
        }

        // Rule 5: Assigned or Delegated
        if (task.assignedPeople.length > 0 && task.contexts.length === 0) {
            gtdLists[GtdList.Assigned].push(task);
            continue;
        }

        // Rule 2: Next Actions
        const hasContext = task.contexts.length > 0;
        const isStartDateTodayOrPast = task.startDate && (isDateToday(task.startDate) || isDatePast(task.startDate));
        const isDueDateTodayOrPast = task.dueDate && (isDateToday(task.dueDate) || isDatePast(task.dueDate));
        const isWeekTodayOrPast = task.week && (isWeekToday(task.week) || isWeekPast(task.week));
        const areDependenciesMet = !isPausedByDependency;

        if (hasContext && (isStartDateTodayOrPast || isDueDateTodayOrPast || isWeekTodayOrPast || areDependenciesMet)) {
             gtdLists[GtdList.NextActions].push(task);
             continue;
        }

        // Rule 4: Hope Today & Overdue
        const relevantDate = task.dueDate || task.startDate;
        if (relevantDate && !task.startTime) {
            if (isDateToday(relevantDate)) {
                gtdLists[GtdList.HopeToday].push(task);
            } else if (isDatePast(relevantDate)) {
                if (task.contexts.length > 0 || task.assignedPeople.length > 0) {
                    gtdLists[GtdList.Overdue].push(task);
                } else {
                    gtdLists[GtdList.HopeToday].push(task);
                    gtdLists[GtdList.Inbox].push(task); // Add to Inbox as well
                }
            }
            continue;
        }
        
        // Default to Inbox if not classified by any other rule
        if (!isClassified) {
            gtdLists[GtdList.Inbox].push(task);
        }
    }

    return gtdLists;
}
