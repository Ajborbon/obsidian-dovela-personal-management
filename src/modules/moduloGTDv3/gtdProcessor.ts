
import type { Task } from './model.js';

export enum GtdList {
    Inbox = 'Inbox',
    NextActions = 'Next Actions',
    Calendar = 'Calendar',
    Projects = 'Proyectos',
    Assigned = 'Asignadas',
    Paused = 'En Pausa',
    SomedayMaybe = 'Someday/Maybe',
    ThisWeekNot = 'Esta Semana No',
    HopeToday = 'Ojalá Hoy',
    Overdue = 'Vencidas',
}

/**
 * Clasifica una lista de tareas en las diferentes listas GTD.
 * @param allTasks - La lista completa de tareas extra��das del vault.
 * @returns Un Record donde cada clave es un nombre de lista GTD y el valor es un array de tareas.
 */
export function processGtdLists(allTasks: Task[]): Record<GtdList, Task[]> {
    const gtdLists: Record<GtdList, Task[]> = {
        [GtdList.Inbox]: [],
        [GtdList.NextActions]: [],
        [GtdList.Calendar]: [],
        [GtdList.Projects]: [],
        [GtdList.Assigned]: [],
        [GtdList.Paused]: [],
        [GtdList.SomedayMaybe]: [],
        [GtdList.ThisWeekNot]: [],
        [GtdList.HopeToday]: [],
        [GtdList.Overdue]: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a la medianoche para comparaciones de solo fecha.

    for (const task of allTasks) {
        if (task.completed) continue;

        // Las reglas se aplican en orden de precedencia.

        if (task.content.includes('#GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }

        if (task.content.includes('#GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        const startDate = task.startDate ? new Date(task.startDate) : null;
        if (startDate && startDate > today) {
            gtdLists[GtdList.Paused].push(task);
            continue;
        }
        // TODO: Añadir lógica para dependencias no completadas y semana futura.

        if (task.dueDate && task.startTime) {
            gtdLists[GtdList.Calendar].push(task);
            continue;
        }

        if (task.contexts.includes('#cx-ProyectoGTD') || task.contexts.includes('#cx-Entregable')) {
            gtdLists[GtdList.Projects].push(task);
            continue;
        }

        if (task.assignedPeople.length > 0 && task.contexts.length === 0) {
            gtdLists[GtdList.Assigned].push(task);
            continue;
        }

        if (task.contexts.length > 0) {
            gtdLists[GtdList.NextActions].push(task);
            continue;
        }

        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const scheduledDate = task.scheduledDate ? new Date(task.scheduledDate) : null;
        const relevantDate = dueDate || scheduledDate;

        if (relevantDate && !task.startTime) {
            relevantDate.setHours(0, 0, 0, 0);
            if (relevantDate.getTime() < today.getTime()) {
                gtdLists[GtdList.Overdue].push(task);
            } else {
                gtdLists[GtdList.HopeToday].push(task);
            }
            continue;
        }

        // Si no cumple ninguna otra regla, va al Inbox.
        gtdLists[GtdList.Inbox].push(task);
    }

    return gtdLists;
}
