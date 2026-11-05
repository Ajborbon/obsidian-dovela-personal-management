// calendarTypes.ts
export enum DateType {
    START = 'start',
    SCHEDULE = 'schedule', 
    DUE = 'due'
}

export interface DateTypeOption {
    type: DateType;
    icon: string;
    label: string;
    description: string;
}

export interface CalendarDate {
    date: Date;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    isSelected: boolean;
}

export interface QuickDateOption {
    id: string;
    label: string;
    getDate: () => Date;
    description: string;
}

export interface CalendarContext {
    isVisible: boolean;
    selectedDateType: DateType;
    selectedDate: Date | null;
    currentViewDate: Date; // Para navegación mensual
    triggerPosition: number;
}

export interface DateValidationResult {
    isValid: boolean;
    warning?: string;
    suggestion?: string;
}
