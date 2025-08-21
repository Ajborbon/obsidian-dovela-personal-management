// calendarDataProvider.ts
import moment from 'moment';
import { DateType, type DateTypeOption, type CalendarDate, type QuickDateOption, type DateValidationResult } from './calendarTypes.js';

export class CalendarDataProvider {
    
    public getDateTypeOptions(): DateTypeOption[] {
        return [
            {
                type: DateType.START,
                icon: '🛫',
                label: 'Start',
                description: 'Fecha de inicio'
            },
            {
                type: DateType.SCHEDULE,
                icon: '⏳',
                label: 'Schedule',
                description: 'Fecha programada'
            },
            {
                type: DateType.DUE,
                icon: '📅',
                label: 'Due',
                description: 'Fecha de vencimiento'
            }
        ];
    }

    public getQuickDateOptions(): QuickDateOption[] {
        const today = moment();
        
        return [
            {
                id: 'today',
                label: 'Hoy',
                getDate: () => today.clone().toDate(),
                description: today.format('DD/MM/YYYY')
            },
            {
                id: 'tomorrow',
                label: 'Mañana',
                getDate: () => today.clone().add(1, 'day').toDate(),
                description: today.clone().add(1, 'day').format('DD/MM/YYYY')
            },
            {
                id: 'this-week',
                label: 'Esta Semana',
                getDate: () => {
                    // Próximo viernes o viernes de esta semana si aún no ha pasado
                    const friday = today.clone().day(5); // 5 = viernes
                    if (friday.isBefore(today, 'day')) {
                        friday.add(1, 'week');
                    }
                    return friday.toDate();
                },
                description: (() => {
                    const friday = today.clone().day(5);
                    if (friday.isBefore(today, 'day')) {
                        friday.add(1, 'week');
                    }
                    return friday.format('DD/MM/YYYY');
                })()
            },
            {
                id: 'next-week',
                label: 'Próxima Semana',
                getDate: () => today.clone().add(1, 'week').day(5).toDate(), // Viernes de próxima semana
                description: today.clone().add(1, 'week').day(5).format('DD/MM/YYYY')
            },
            {
                id: 'next-month',
                label: 'Próximo Mes',
                getDate: () => today.clone().add(1, 'month').toDate(),
                description: today.clone().add(1, 'month').format('DD/MM/YYYY')
            }
        ];
    }

    public getCalendarDates(viewDate: Date, selectedDate: Date | null): CalendarDate[] {
        const viewMoment = moment(viewDate);
        const today = moment();
        const selectedMoment = selectedDate ? moment(selectedDate) : null;
        
        // Obtener primer día del mes y ajustar al inicio de la semana
        const firstDayOfMonth = viewMoment.clone().startOf('month');
        const startOfCalendar = firstDayOfMonth.clone().startOf('week');
        
        // Obtener último día del mes y ajustar al final de la semana
        const lastDayOfMonth = viewMoment.clone().endOf('month');
        const endOfCalendar = lastDayOfMonth.clone().endOf('week');
        
        const dates: CalendarDate[] = [];
        const current = startOfCalendar.clone();
        
        while (current.isSameOrBefore(endOfCalendar)) {
            const isCurrentMonth = current.month() === viewMoment.month();
            const isToday = current.isSame(today, 'day');
            const isPast = current.isBefore(today, 'day');
            const isSelected = selectedMoment ? current.isSame(selectedMoment, 'day') : false;
            
            dates.push({
                date: current.toDate(),
                dayOfMonth: current.date(),
                isCurrentMonth,
                isToday,
                isPast,
                isSelected
            });
            
            current.add(1, 'day');
        }
        
        return dates;
    }

    public formatDateForInsertion(date: Date, dateType: DateType): string {
        const formattedDate = moment(date).format('YYYY-MM-DD');
        const dateTypeOption = this.getDateTypeOptions().find(opt => opt.type === dateType);
        
        if (!dateTypeOption) {
            return `📅 ${formattedDate}`; // Fallback a Due
        }
        
        return `${dateTypeOption.icon} ${formattedDate}`;
    }

    public validateDateCoherence(
        newDate: Date, 
        newType: DateType, 
        existingDates: Array<{ date: Date; type: DateType }>
    ): DateValidationResult {
        const newMoment = moment(newDate);
        
        // Encontrar fechas existentes por tipo
        const startDate = existingDates.find(d => d.type === DateType.START)?.date;
        const scheduleDate = existingDates.find(d => d.type === DateType.SCHEDULE)?.date;
        const dueDate = existingDates.find(d => d.type === DateType.DUE)?.date;
        
        // Crear objeto con todas las fechas incluyendo la nueva
        const dates = {
            start: newType === DateType.START ? newMoment : (startDate ? moment(startDate) : null),
            schedule: newType === DateType.SCHEDULE ? newMoment : (scheduleDate ? moment(scheduleDate) : null),
            due: newType === DateType.DUE ? newMoment : (dueDate ? moment(dueDate) : null)
        };
        
        // Validar coherencia: Start ≤ Schedule ≤ Due
        if (dates.start && dates.schedule && dates.start.isAfter(dates.schedule)) {
            return {
                isValid: false,
                warning: 'La fecha de inicio no puede ser posterior a la fecha programada',
                suggestion: `Considera cambiar la fecha de inicio a ${dates.schedule.format('DD/MM/YYYY')} o anterior`
            };
        }
        
        if (dates.schedule && dates.due && dates.schedule.isAfter(dates.due)) {
            return {
                isValid: false,
                warning: 'La fecha programada no puede ser posterior a la fecha de vencimiento',
                suggestion: `Considera cambiar la fecha programada a ${dates.due.format('DD/MM/YYYY')} o anterior`
            };
        }
        
        if (dates.start && dates.due && dates.start.isAfter(dates.due)) {
            return {
                isValid: false,
                warning: 'La fecha de inicio no puede ser posterior a la fecha de vencimiento',
                suggestion: `Considera cambiar la fecha de inicio a ${dates.due.format('DD/MM/YYYY')} o anterior`
            };
        }
        
        return { isValid: true };
    }

    public parseExistingDatesFromText(text: string): Array<{ date: Date; type: DateType }> {
        const existingDates: Array<{ date: Date; type: DateType }> = [];
        
        // Patrones para detectar fechas existentes
        const patterns = [
            { regex: /🛫\s+(\d{4}-\d{2}-\d{2})/g, type: DateType.START },
            { regex: /⏳\s+(\d{4}-\d{2}-\d{2})/g, type: DateType.SCHEDULE },
            { regex: /📅\s+(\d{4}-\d{2}-\d{2})/g, type: DateType.DUE }
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                const dateMoment = moment(match[1], 'YYYY-MM-DD');
                if (dateMoment.isValid()) {
                    existingDates.push({
                        date: dateMoment.toDate(),
                        type: pattern.type
                    });
                }
            }
        });
        
        return existingDates;
    }

    public getMonthName(date: Date): string {
        return moment(date).format('MMMM YYYY');
    }

    public getWeekdayNames(): string[] {
        return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    }

    public navigateMonth(currentDate: Date, direction: 'prev' | 'next'): Date {
        const current = moment(currentDate);
        return direction === 'next' 
            ? current.add(1, 'month').toDate()
            : current.subtract(1, 'month').toDate();
    }
}
