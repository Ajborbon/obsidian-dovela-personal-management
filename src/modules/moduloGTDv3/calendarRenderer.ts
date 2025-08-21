// calendarRenderer.ts
import { DateType, type CalendarContext, type DateTypeOption, type CalendarDate, type QuickDateOption } from './calendarTypes.js';

export class CalendarRenderer {
    public containerEl: HTMLElement;
    private calendarEl: HTMLElement | null = null;
    private isVisible: boolean = false;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
        this.createCalendarElement();
    }

    private createCalendarElement(): void {
        this.calendarEl = this.containerEl.createDiv({ cls: 'calendar-picker-container' });
        this.calendarEl.style.display = 'none';
        this.calendarEl.style.position = 'absolute';
        this.calendarEl.style.zIndex = '10000';
        this.calendarEl.style.background = 'var(--background-secondary)';
        this.calendarEl.style.border = '1px solid var(--background-modifier-border)';
        this.calendarEl.style.borderRadius = '12px';
        this.calendarEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        this.calendarEl.style.minWidth = '320px';
        this.calendarEl.style.padding = '16px';
    }

    public renderCalendar(
        context: CalendarContext,
        inputEl: HTMLInputElement,
        dateTypeOptions: DateTypeOption[],
        calendarDates: CalendarDate[],
        quickDateOptions: QuickDateOption[],
        monthName: string,
        weekdayNames: string[]
    ): void {
        if (!this.calendarEl) return;

        this.calendarEl.empty();
        this.isVisible = true;

        // Header con selector de tipo de fecha
        this.renderDateTypeSelector(context, dateTypeOptions);

        // Navegación del calendario
        this.renderCalendarNavigation(monthName);

        // Grid del calendario
        this.renderCalendarGrid(context, calendarDates, weekdayNames);

        // Accesos rápidos
        this.renderQuickDateOptions(quickDateOptions);

        // Posicionar y mostrar
        this.positionCalendar(inputEl);
        this.calendarEl.style.display = 'block';
    }

    private renderDateTypeSelector(context: CalendarContext, dateTypeOptions: DateTypeOption[]): void {
        if (!this.calendarEl) return;

        const selectorContainer = this.calendarEl.createDiv({ cls: 'date-type-selector' });
        selectorContainer.style.marginBottom = '16px';

        const label = selectorContainer.createDiv({ cls: 'date-type-label' });
        label.textContent = 'Tipo de Fecha:';
        label.style.fontSize = '0.9em';
        label.style.color = 'var(--text-muted)';
        label.style.marginBottom = '8px';
        label.style.fontWeight = '500';

        const buttonsContainer = selectorContainer.createDiv({ cls: 'date-type-buttons' });
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '8px';

        dateTypeOptions.forEach((option) => {
            const button = buttonsContainer.createDiv({ cls: 'date-type-button' });
            button.style.padding = '8px 12px';
            button.style.border = '1px solid var(--background-modifier-border)';
            button.style.borderRadius = '8px';
            button.style.cursor = 'pointer';
            button.style.transition = 'all 0.2s ease';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.gap = '6px';
            button.style.fontSize = '0.9em';
            button.style.fontWeight = '500';

            const isSelected = context.selectedDateType === option.type;
            if (isSelected) {
                button.classList.add('is-selected');
                button.style.backgroundColor = 'var(--interactive-accent)';
                button.style.color = 'var(--text-on-accent)';
                button.style.borderColor = 'var(--interactive-accent)';
            } else {
                button.style.backgroundColor = 'var(--background-primary)';
                button.style.color = 'var(--text-normal)';
            }

            const icon = button.createSpan({ cls: 'date-type-icon' });
            icon.textContent = option.icon;

            const labelSpan = button.createSpan({ cls: 'date-type-text' });
            labelSpan.textContent = option.label;

            button.addEventListener('click', () => {
                this.triggerDateTypeChange(option.type);
            });

            button.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    button.style.backgroundColor = 'var(--background-modifier-hover)';
                }
            });

            button.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    button.style.backgroundColor = 'var(--background-primary)';
                }
            });
        });
    }

    private renderCalendarNavigation(monthName: string): void {
        if (!this.calendarEl) return;

        const navContainer = this.calendarEl.createDiv({ cls: 'calendar-navigation' });
        navContainer.style.display = 'flex';
        navContainer.style.justifyContent = 'space-between';
        navContainer.style.alignItems = 'center';
        navContainer.style.marginBottom = '12px';

        const prevButton = navContainer.createDiv({ cls: 'calendar-nav-button' });
        prevButton.textContent = '‹';
        prevButton.style.cursor = 'pointer';
        prevButton.style.padding = '8px 12px';
        prevButton.style.borderRadius = '6px';
        prevButton.style.fontSize = '1.2em';
        prevButton.style.fontWeight = 'bold';
        prevButton.style.transition = 'background-color 0.2s ease';
        prevButton.addEventListener('click', () => this.triggerMonthChange('prev'));
        prevButton.addEventListener('mouseenter', () => {
            prevButton.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        prevButton.addEventListener('mouseleave', () => {
            prevButton.style.backgroundColor = '';
        });

        const monthTitle = navContainer.createDiv({ cls: 'calendar-month-title' });
        monthTitle.textContent = monthName;
        monthTitle.style.fontSize = '1.1em';
        monthTitle.style.fontWeight = 'bold';
        monthTitle.style.color = 'var(--text-normal)';

        const nextButton = navContainer.createDiv({ cls: 'calendar-nav-button' });
        nextButton.textContent = '›';
        nextButton.style.cursor = 'pointer';
        nextButton.style.padding = '8px 12px';
        nextButton.style.borderRadius = '6px';
        nextButton.style.fontSize = '1.2em';
        nextButton.style.fontWeight = 'bold';
        nextButton.style.transition = 'background-color 0.2s ease';
        nextButton.addEventListener('click', () => this.triggerMonthChange('next'));
        nextButton.addEventListener('mouseenter', () => {
            nextButton.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        nextButton.addEventListener('mouseleave', () => {
            nextButton.style.backgroundColor = '';
        });
    }

    private renderCalendarGrid(context: CalendarContext, calendarDates: CalendarDate[], weekdayNames: string[]): void {
        if (!this.calendarEl) return;

        const gridContainer = this.calendarEl.createDiv({ cls: 'calendar-grid-container' });
        gridContainer.style.marginBottom = '16px';

        // Header con nombres de días
        const weekdayHeader = gridContainer.createDiv({ cls: 'calendar-weekdays' });
        weekdayHeader.style.display = 'grid';
        weekdayHeader.style.gridTemplateColumns = 'repeat(7, 1fr)';
        weekdayHeader.style.gap = '2px';
        weekdayHeader.style.marginBottom = '8px';

        weekdayNames.forEach(dayName => {
            const dayHeader = weekdayHeader.createDiv({ cls: 'calendar-weekday' });
            dayHeader.textContent = dayName;
            dayHeader.style.textAlign = 'center';
            dayHeader.style.fontSize = '0.85em';
            dayHeader.style.color = 'var(--text-muted)';
            dayHeader.style.fontWeight = '500';
            dayHeader.style.padding = '4px';
        });

        // Grid de días
        const daysGrid = gridContainer.createDiv({ cls: 'calendar-days' });
        daysGrid.style.display = 'grid';
        daysGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        daysGrid.style.gap = '2px';

        calendarDates.forEach(calendarDate => {
            const dayCell = daysGrid.createDiv({ cls: 'calendar-day' });
            dayCell.textContent = calendarDate.dayOfMonth.toString();
            dayCell.style.textAlign = 'center';
            dayCell.style.padding = '8px 4px';
            dayCell.style.borderRadius = '6px';
            dayCell.style.cursor = 'pointer';
            dayCell.style.transition = 'all 0.2s ease';
            dayCell.style.fontSize = '0.9em';
            dayCell.style.minHeight = '32px';
            dayCell.style.display = 'flex';
            dayCell.style.alignItems = 'center';
            dayCell.style.justifyContent = 'center';

            // Estilos según estado
            if (!calendarDate.isCurrentMonth) {
                dayCell.style.color = 'var(--text-faint)';
                dayCell.style.cursor = 'default';
            } else if (calendarDate.isToday) {
                dayCell.style.backgroundColor = 'var(--interactive-accent)';
                dayCell.style.color = 'var(--text-on-accent)';
                dayCell.style.fontWeight = 'bold';
            } else if (calendarDate.isSelected) {
                dayCell.style.backgroundColor = 'var(--background-modifier-active)';
                dayCell.style.color = 'var(--text-accent)';
                dayCell.style.fontWeight = 'bold';
            } else if (calendarDate.isPast) {
                // Para fechas pasadas, permitir solo Due dates
                if (context.selectedDateType !== DateType.DUE) {
                    dayCell.style.color = 'var(--text-faint)';
                    dayCell.style.cursor = 'not-allowed';
                } else {
                    dayCell.style.color = 'var(--text-muted)';
                }
            } else {
                dayCell.style.color = 'var(--text-normal)';
            }

            // Eventos
            if (calendarDate.isCurrentMonth && (!calendarDate.isPast || context.selectedDateType === DateType.DUE)) {
                dayCell.addEventListener('click', () => {
                    this.triggerDateSelection(calendarDate.date);
                });

                dayCell.addEventListener('mouseenter', () => {
                    if (!calendarDate.isToday && !calendarDate.isSelected) {
                        dayCell.style.backgroundColor = 'var(--background-modifier-hover)';
                    }
                });

                dayCell.addEventListener('mouseleave', () => {
                    if (!calendarDate.isToday && !calendarDate.isSelected) {
                        dayCell.style.backgroundColor = '';
                    }
                });
            }
        });
    }

    private renderQuickDateOptions(quickDateOptions: QuickDateOption[]): void {
        if (!this.calendarEl) return;

        const quickContainer = this.calendarEl.createDiv({ cls: 'calendar-quick-dates' });

        const label = quickContainer.createDiv({ cls: 'quick-dates-label' });
        label.textContent = 'Accesos rápidos:';
        label.style.fontSize = '0.9em';
        label.style.color = 'var(--text-muted)';
        label.style.marginBottom = '8px';
        label.style.fontWeight = '500';

        const buttonsContainer = quickContainer.createDiv({ cls: 'quick-date-buttons' });
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexWrap = 'wrap';
        buttonsContainer.style.gap = '6px';

        quickDateOptions.forEach(option => {
            const button = buttonsContainer.createDiv({ cls: 'quick-date-button' });
            button.textContent = option.label;
            button.style.padding = '6px 10px';
            button.style.border = '1px solid var(--background-modifier-border)';
            button.style.borderRadius = '6px';
            button.style.cursor = 'pointer';
            button.style.transition = 'all 0.2s ease';
            button.style.fontSize = '0.85em';
            button.style.backgroundColor = 'var(--background-primary)';
            button.style.color = 'var(--text-normal)';

            button.addEventListener('click', () => {
                this.triggerDateSelection(option.getDate());
            });

            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = 'var(--background-modifier-hover)';
                button.style.borderColor = 'var(--interactive-accent)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'var(--background-primary)';
                button.style.borderColor = 'var(--background-modifier-border)';
            });
        });
    }

    private positionCalendar(inputEl: HTMLInputElement): void {
        if (!this.calendarEl) return;

        const inputRect = inputEl.getBoundingClientRect();
        const containerRect = this.containerEl.getBoundingClientRect();

        const left = inputRect.left - containerRect.left;
        const top = inputRect.bottom - containerRect.top + 4;

        this.calendarEl.style.left = `${left}px`;
        this.calendarEl.style.top = `${top}px`;

        // Ajustar si se sale de la pantalla
        const calendarRect = this.calendarEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (calendarRect.right > viewportWidth) {
            const adjustedLeft = left - (calendarRect.right - viewportWidth) - 10;
            this.calendarEl.style.left = `${Math.max(0, adjustedLeft)}px`;
        }

        if (calendarRect.bottom > viewportHeight) {
            const adjustedTop = top - calendarRect.height - inputRect.height - 8;
            this.calendarEl.style.top = `${adjustedTop}px`;
        }
    }

    private triggerDateTypeChange(dateType: DateType): void {
        const event = new CustomEvent('calendar-date-type-change', {
            detail: { dateType }
        });
        this.containerEl.dispatchEvent(event);
    }

    private triggerDateSelection(date: Date): void {
        const event = new CustomEvent('calendar-date-select', {
            detail: { date }
        });
        this.containerEl.dispatchEvent(event);
    }

    private triggerMonthChange(direction: 'prev' | 'next'): void {
        const event = new CustomEvent('calendar-month-change', {
            detail: { direction }
        });
        this.containerEl.dispatchEvent(event);
    }

    public hideCalendar(): void {
        if (this.calendarEl) {
            this.calendarEl.style.display = 'none';
            this.isVisible = false;
        }
    }

    public isCalendarVisible(): boolean {
        return this.isVisible;
    }

    public destroy(): void {
        if (this.calendarEl) {
            this.calendarEl.remove();
            this.calendarEl = null;
        }
    }
}
