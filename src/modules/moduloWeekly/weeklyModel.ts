import type { Task } from '../moduloGTDv3/model.js';

/**
 * Tipos específicos para el módulo Weekly
 */

export interface WeeklyData {
    targetWeek: string;              // Código semana: "2025-W43"
    year: number;                    // 2025
    week: number;                    // 43
    weekDateRange: {                 // Rango de fechas
        start: string;               // "2025-10-20" (Lunes)
        end: string;                 // "2025-10-26" (Domingo)
    };

    // Tareas W:: para esta semana
    weeklyTasks: Task[];

    // Tareas con fechas en esta semana, agrupadas por día
    dailyTasks: {
        monday: Task[];
        tuesday: Task[];
        wednesday: Task[];
        thursday: Task[];
        friday: Task[];
        saturday: Task[];
        sunday: Task[];
    };

    // Tareas W:: de semanas anteriores (vencidas)
    overdueWeeklyTasks: Task[];

    // Tareas con fechas vencidas (due/scheduled anteriores al inicio de la semana)
    overdueByDate: Task[];

    // Tareas completadas esta semana
    completedThisWeek: Task[];
}

export interface WeeklyRenderOptions {
    showOverdueLimit?: number;       // Límite de vencidas a mostrar
    showCompletedCollapsed?: boolean; // Completadas colapsadas por defecto
    highlightToday?: boolean;        // Destacar día actual en la semana
}

export interface WeeklyGroupConfig {
    title: string;
    icon: string;
    tasks: Task[];
    collapsible: boolean;
    defaultCollapsed: boolean;
    showCount: boolean;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DailyTaskGroup {
    dayOfWeek: DayOfWeek;
    date: string;                    // "2025-10-20"
    dayNumber: number;               // 20
    dayName: string;                 // "Lunes"
    isToday: boolean;                // true si es hoy
    tasks: Task[];
}
