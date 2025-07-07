import type { Task, InProgressData } from './model.js';
import { isDatePast } from './dateUtils.js';

type Grouping = 'none' | 'context' | 'person' | 'project';
type Sorting = 'priority' | 'duration-asc' | 'duration-desc';

function parseDuration(duration: string | undefined): number {
    if (!duration) return 0;
    const match = duration.match(/(\d+\.?\d*)\s*(h|min|m)/);
    if (!match) return 0;

    const value = parseFloat(match[1] || '0');
    const unit = match[2];

    if (unit === 'h') {
        return value * 60;
    }
    return value;
}

function getProjectGroupForTask(task: Task): string {
    if (!task.sourceFile || !task.sourceFile.path) return 'Tareas Generales';
    const pathParts = task.sourceFile.path.split('/').slice(0, -1);

    const pgtd = pathParts.find(part => part.startsWith('PGTD - '));
    if (pgtd) return `📂 ${pgtd}`;

    const ais = pathParts.filter(part => part.startsWith('AI - '));
    if (ais.length > 0) return `🧠 ${ais[ais.length - 1]}`;

    const structuralPrefixes = ['AV -', 'PQ -', 'RR -'];
    for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (part && structuralPrefixes.some(prefix => part.startsWith(prefix))) {
            return `🏠 ${part}`;
        }
    }

    if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        return `📁 ${lastPart}`;
    }

    return 'Tareas Generales';
}

function sortTasks(tasks: Task[], sorting: Sorting) {
    tasks.sort((a, b) => {
        if (sorting === 'duration-asc') {
            return (parseDuration(a.duration) || 9999) - (parseDuration(b.duration) || 9999);
        }
        if (sorting === 'duration-desc') {
            return (parseDuration(b.duration) || 0) - (parseDuration(a.duration) || 0);
        }
        
        const priorityOrder = { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'None': 4 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.date && b.date) {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        return 0;
    });
}

export function processInProgressTasks(
    tasks: Task[],
    grouping: Grouping,
    sorting: Sorting
): InProgressData {
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress');

    let definedTimeMinutes = 0;
    let estimatedTimeMinutes = 0;

    for (const task of inProgressTasks) {
        const duration = parseDuration(task.duration);
        if (duration > 0) {
            definedTimeMinutes += duration;
            estimatedTimeMinutes += duration;
        } else {
            estimatedTimeMinutes += 20; // Default duration
        }
    }

    const stats = {
        total: inProgressTasks.length,
        overdue: inProgressTasks.filter(t => t.date && isDatePast(t.date)).length,
        definedTimeMinutes,
        estimatedTimeMinutes,
    };

    const groups: { [groupName: string]: Task[] } = {};

    if (grouping === 'none') {
        const overdue: Task[] = [];
        const today: Task[] = [];
        const other: Task[] = [];
        for (const task of inProgressTasks) {
            if (task.date && isDatePast(task.date)) {
                overdue.push(task);
            } else if (task.date) {
                today.push(task);
            } else {
                other.push(task);
            }
        }
        sortTasks(overdue, 'priority');
        sortTasks(today, sorting);
        sortTasks(other, sorting);
        if(overdue.length > 0) groups['🔴 Vencidas'] = overdue;
        if(today.length > 0) groups['⭐ Prioridades de Hoy'] = today;
        if(other.length > 0) groups['Otras Tareas'] = other;

    } else {
        for (const task of inProgressTasks) {
            let groupNames: string[] = [];
            if (grouping === 'context') {
                groupNames = task.contexts.length > 0 ? task.contexts.map(c => `@${c}`) : ['Sin Contexto'];
            } else if (grouping === 'person') {
                groupNames = task.assignedPeople.length > 0 ? task.assignedPeople.map(p => `@${p}`) : ['Sin Asignar'];
            } else if (grouping === 'project') {
                groupNames = [getProjectGroupForTask(task)];
            }

            for (const groupName of groupNames) {
                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                const group = groups[groupName];
                if(group) {
                    group.push(task);
                }
            }
        }
        for (const groupName in groups) {
            const group = groups[groupName];
            if (group) {
                sortTasks(group, sorting);
            }
        }
    }

    return {
        groups,
        stats,
    };
}
