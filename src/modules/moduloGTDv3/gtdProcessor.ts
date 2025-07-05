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
}

function isDateInFuture(dateString: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString);
    return date > today;
}

function isDateToday(dateString: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return dateString === today;
}

function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

function isWeekInFuture(weekString: string): boolean {
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
    };

    for (const task of allTasks) {
        if (task.completed) continue;

        // Regla 1: Someday/Maybe
        if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }

        // Regla 2: Esta Semana No
        if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        // Regla 3: En Pausa
        if (task.startDate && isDateInFuture(task.startDate)) {
            gtdLists[GtdList.Paused].push(task);
            continue;
        }
        if (task.week && isWeekInFuture(task.week)) {
            gtdLists[GtdList.Paused].push(task);
            continue;
        }
        const isPausedByDependency = task.dependencies.some(depId => {
            const depTask = allTaskMap.get(depId);
            return depTask && !depTask.completed;
        });
        if (isPausedByDependency) {
            gtdLists[GtdList.Paused].push(task);
            continue;
        }

        // Regla 4: Calendar
        if (task.startDate && task.startTime) {
            gtdLists[GtdList.Calendar].push(task);
            continue;
        }

        // Regla 5: Asignadas o Delegadas
        if (task.assignedPeople.length > 0 && task.contexts.length === 0) {
            gtdLists[GtdList.Assigned].push(task);
            continue;
        }

        // Regla 6: Proyectos
        if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);
            continue;
        }

        // Regla 7: Next Actions
        if (task.contexts.length > 0) {
            gtdLists[GtdList.NextActions].push(task);
            continue;
        }

        // Regla 8: Ojalá Hoy
        if ((task.startDate && isDateToday(task.startDate)) || (task.dueDate && isDateToday(task.dueDate))) {
            if (!task.startTime) {
                gtdLists[GtdList.HopeToday].push(task);
                continue;
            }
        }

        // Regla 9: Inbox (por defecto)
        gtdLists[GtdList.Inbox].push(task);
    }

    return gtdLists;
}