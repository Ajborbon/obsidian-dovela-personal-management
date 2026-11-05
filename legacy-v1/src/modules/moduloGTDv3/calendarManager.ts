// calendarManager.ts
import { DateType, type CalendarContext, type DateValidationResult } from './calendarTypes.js';
import { CalendarDataProvider } from './calendarDataProvider.js';
import { CalendarRenderer } from './calendarRenderer.js';

export class CalendarManager {
    private dataProvider: CalendarDataProvider;
    private renderer: CalendarRenderer;
    private inputEl: HTMLInputElement;
    private currentContext: CalendarContext | null = null;
    private onSelectionCallback: ((dateString: string) => void) | null = null;

    constructor(inputEl: HTMLInputElement, containerEl: HTMLElement) {
        this.inputEl = inputEl;
        this.dataProvider = new CalendarDataProvider();
        this.renderer = new CalendarRenderer(containerEl);
        
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Escuchar eventos del renderer
        this.renderer.containerEl.addEventListener('calendar-date-type-change', ((event: CustomEvent) => {
            this.handleDateTypeChange(event.detail.dateType);
        }) as EventListener);

        this.renderer.containerEl.addEventListener('calendar-date-select', ((event: CustomEvent) => {
            this.handleDateSelection(event.detail.date);
        }) as EventListener);

        this.renderer.containerEl.addEventListener('calendar-month-change', ((event: CustomEvent) => {
            this.handleMonthChange(event.detail.direction);
        }) as EventListener);
    }

    public setSelectionCallback(callback: (dateString: string) => void): void {
        this.onSelectionCallback = callback;
    }

    public detectTrigger(text: string, cursorPos: number): boolean {
        // Buscar '!' antes del cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        const exclamationMatch = textBeforeCursor.match(/(^|\s)!$/);
        
        if (exclamationMatch) {
            const triggerPosition = exclamationMatch.index! + exclamationMatch[0].length - 1;
            this.showCalendar(triggerPosition);
            return true;
        }
        
        return false;
    }

    private showCalendar(triggerPosition: number): void {
        const now = new Date();
        
        this.currentContext = {
            isVisible: true,
            selectedDateType: DateType.DUE, // Predeterminado
            selectedDate: null,
            currentViewDate: now,
            triggerPosition
        };

        this.renderCalendar();
    }

    private renderCalendar(): void {
        if (!this.currentContext) return;

        const dateTypeOptions = this.dataProvider.getDateTypeOptions();
        const calendarDates = this.dataProvider.getCalendarDates(
            this.currentContext.currentViewDate,
            this.currentContext.selectedDate
        );
        const quickDateOptions = this.dataProvider.getQuickDateOptions();
        const monthName = this.dataProvider.getMonthName(this.currentContext.currentViewDate);
        const weekdayNames = this.dataProvider.getWeekdayNames();

        this.renderer.renderCalendar(
            this.currentContext,
            this.inputEl,
            dateTypeOptions,
            calendarDates,
            quickDateOptions,
            monthName,
            weekdayNames
        );
    }

    private handleDateTypeChange(dateType: DateType): void {
        if (!this.currentContext) return;

        this.currentContext.selectedDateType = dateType;
        this.renderCalendar();
    }

    private handleDateSelection(date: Date): void {
        if (!this.currentContext) return;

        // Validar coherencia de fechas antes de seleccionar
        const currentText = this.inputEl.value;
        const existingDates = this.dataProvider.parseExistingDatesFromText(currentText);
        
        const validation = this.dataProvider.validateDateCoherence(
            date,
            this.currentContext.selectedDateType,
            existingDates
        );

        if (!validation.isValid && validation.warning) {
            // Mostrar advertencia pero permitir la selección
            console.warn('Advertencia de fecha:', validation.warning);
            if (validation.suggestion) {
                console.log('Sugerencia:', validation.suggestion);
            }
            // En una implementación real, podrías mostrar un toast o modal de confirmación
        }

        // Formatear y insertar la fecha
        const formattedDate = this.dataProvider.formatDateForInsertion(
            date,
            this.currentContext.selectedDateType
        );

        if (this.onSelectionCallback) {
            this.onSelectionCallback(formattedDate);
        }

        this.hideCalendar();
    }

    private handleMonthChange(direction: 'prev' | 'next'): void {
        if (!this.currentContext) return;

        this.currentContext.currentViewDate = this.dataProvider.navigateMonth(
            this.currentContext.currentViewDate,
            direction
        );
        
        this.renderCalendar();
    }

    public handleKeyDown(event: KeyboardEvent): boolean {
        if (!this.currentContext || !this.renderer.isCalendarVisible()) {
            return false;
        }

        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                this.hideCalendar();
                return true;
                
            case 'Tab':
                event.preventDefault();
                this.cycleDateType();
                return true;
                
            case 'Enter':
                event.preventDefault();
                // Si hay una fecha seleccionada, confirmarla; si no, seleccionar hoy
                const dateToSelect = this.currentContext.selectedDate || new Date();
                this.handleDateSelection(dateToSelect);
                return true;
                
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown':
                event.preventDefault();
                this.handleArrowNavigation(event.key);
                return true;
        }
        
        return false;
    }

    private cycleDateType(): void {
        if (!this.currentContext) return;

        const dateTypes = [DateType.START, DateType.SCHEDULE, DateType.DUE];
        const currentIndex = dateTypes.indexOf(this.currentContext.selectedDateType);
        const nextIndex = (currentIndex + 1) % dateTypes.length;
        
        this.currentContext.selectedDateType = dateTypes[nextIndex] as DateType;
        this.renderCalendar();
    }

    private handleArrowNavigation(key: string): void {
        if (!this.currentContext) return;

        const currentDate = this.currentContext.selectedDate || new Date();
        let newDate = new Date(currentDate);

        switch (key) {
            case 'ArrowLeft':
                newDate.setDate(newDate.getDate() - 1);
                break;
            case 'ArrowRight':
                newDate.setDate(newDate.getDate() + 1);
                break;
            case 'ArrowUp':
                newDate.setDate(newDate.getDate() - 7);
                break;
            case 'ArrowDown':
                newDate.setDate(newDate.getDate() + 7);
                break;
        }

        // Actualizar el mes de vista si es necesario
        if (newDate.getMonth() !== this.currentContext.currentViewDate.getMonth() ||
            newDate.getFullYear() !== this.currentContext.currentViewDate.getFullYear()) {
            this.currentContext.currentViewDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
        }

        this.currentContext.selectedDate = newDate;
        this.renderCalendar();
    }

    public handleInput(text: string, cursorPos: number): boolean {
        // Si ya hay un calendario visible, verificar si seguimos en contexto válido
        if (this.currentContext && this.renderer.isCalendarVisible()) {
            const textBeforeCursor = text.substring(0, cursorPos);
            
            // Verificar si seguimos teniendo el trigger
            if (!textBeforeCursor.includes('!')) {
                this.hideCalendar();
                return false;
            }
            
            return true;
        }
        
        // Detectar nuevo trigger
        return this.detectTrigger(text, cursorPos);
    }

    public hideCalendar(): void {
        this.renderer.hideCalendar();
        this.currentContext = null;
    }

    public isCalendarVisible(): boolean {
        return this.renderer.isCalendarVisible();
    }

    public destroy(): void {
        this.renderer.destroy();
        this.currentContext = null;
    }

    // Método público para mostrar validaciones
    public validateCurrentDates(): DateValidationResult | null {
        const currentText = this.inputEl.value;
        const existingDates = this.dataProvider.parseExistingDatesFromText(currentText);
        
        if (existingDates.length < 2) {
            return null; // No hay suficientes fechas para validar
        }

        // Validar todas las combinaciones existentes
        for (const dateInfo of existingDates) {
            const otherDates = existingDates.filter(d => d !== dateInfo);
            const validation = this.dataProvider.validateDateCoherence(
                dateInfo.date,
                dateInfo.type,
                otherDates
            );
            
            if (!validation.isValid) {
                return validation;
            }
        }
        
        return { isValid: true };
    }
}
