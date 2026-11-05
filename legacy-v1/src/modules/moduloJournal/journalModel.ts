import type { Task } from '../moduloGTDv3/model.js';

/**
 * Tipos específicos para el módulo Journal
 */

export interface JournalDayData {
    targetDate: string;
    calendarTasks: Task[];          // Tareas con [hI:: hora]
    programmedToday: Task[];        // Due/Schedule para hoy
    weeklyTasksThisWeek: Task[];    // Tareas [w::] para esta semana
    weeklyTasksOverdue: Task[];     // Tareas [w::] de semanas anteriores
    overdueToday: Task[];          // Due/Schedule vencidas hasta hoy
    inProgress: Task[];            // Tareas [/]
    blockedDependencies: Task[];   // Tareas con ⛔ para hoy o vencidas
    completedToday: Task[];        // Tareas completadas hoy
}

export interface JournalGroupConfig {
    title: string;
    icon: string;
    tasks: Task[];
    collapsible: boolean;
    defaultCollapsed: boolean;
    showCount: boolean;
}

export interface JournalRenderOptions {
    showOverdueLimit?: number;      // Límite de vencidas a mostrar por defecto
    groupOverdueByWeek?: boolean;   // Agrupar vencidas por semana
    showOnlyCritical?: boolean;     // Solo mostrar 🔺⏫ en vencidas
    enableQuickActions?: boolean;   // Botones rápidos de acción
}