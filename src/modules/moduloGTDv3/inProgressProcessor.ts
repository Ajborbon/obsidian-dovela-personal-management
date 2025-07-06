import type { Task, InProgressData } from './model.js';
import { isDatePast } from './dateUtils.js';

function parseDuration(duration: string | undefined): number {
    if (!duration) return 0;
    const match = duration.match(/(\d+\.?\d*)\s*(h|min|m)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    if (unit === 'h') {
        return value * 60;
    }
    // Handles 'min' and 'm'
    return value;
}

export function processInProgressTasks(tasks: Task[]): InProgressData {
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress');

    const overdueTasks: Task[] = [];
    const todayTasks: Task[] = [];
    const otherTasks: Task[] = [];

    let totalDurationMinutes = 0;

    for (const task of inProgressTasks) {
        totalDurationMinutes += parseDuration(task.duration);

        if (task.date && isDatePast(task.date)) {
            overdueTasks.push(task);
        } else if (task.date) { // Assuming tasks with a date are for today or future
            todayTasks.push(task);
        } else {
            otherTasks.push(task);
        }
    }

    // Sorting logic
    const sortByPriority = (a: Task, b: Task) => {
        const priorityOrder = { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'None': 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    };

    overdueTasks.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    todayTasks.sort(sortByPriority);
    otherTasks.sort(sortByPriority);

    return {
        inProgressTasks,
        overdueTasks,
        todayTasks,
        otherTasks,
        stats: {
            total: inProgressTasks.length,
            overdue: overdueTasks.length,
            totalDurationMinutes,
        },
    };
}
