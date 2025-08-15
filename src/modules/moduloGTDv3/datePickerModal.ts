import { App, Modal, moment, Notice } from 'obsidian';

type DatePickerResult = {
    filter: string;
    startDate?: moment.Moment;
    endDate?: moment.Moment;
};

export class DatePickerModal extends Modal {
    private onChoose: (result: DatePickerResult) => void;
    private calendarMonth: moment.Moment;
    private selectionStartDate: moment.Moment | null = null;
    private selectionEndDate: moment.Moment | null = null;
    private applyButton: HTMLButtonElement;
    private activityMap: { [date: string]: number };

    constructor(app: App, onChoose: (result: DatePickerResult) => void, activityMap: { [date: string]: number } = {}) {
        super(app);
        this.onChoose = onChoose;
        this.calendarMonth = moment().startOf('month');
        this.activityMap = activityMap;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('date-picker-modal');
        this.renderModalContent(contentEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private renderModalContent(container: HTMLElement) {
        container.empty();

        const mainContainer = container.createDiv('main-container');
        this.renderQuickActions(mainContainer);
        this.renderCalendar(mainContainer);
        this.updateApplyButtonState();
    }

    private updateApplyButtonState() {
        if (!this.applyButton) return;

        if (this.selectionStartDate && this.selectionEndDate) {
            this.applyButton.setText(`Aplicar Rango (${this.selectionStartDate.format('D MMM')} - ${this.selectionEndDate.format('D MMM')})`);
            this.applyButton.disabled = false;
        } else if (this.selectionStartDate) {
            this.applyButton.setText(`Aplicar Día (${this.selectionStartDate.format('D MMM')})`);
            this.applyButton.disabled = false;
        } else {
            this.applyButton.setText('Aplicar Selección');
            this.applyButton.disabled = true;
        }
    }

    private renderQuickActions(container: HTMLElement) {
        const actionsContainer = container.createDiv('quick-actions');
        actionsContainer.createEl('h4', { text: 'Acciones Rápidas' });

        const actions = {
            'today': 'Hoy',
            'week': 'Esta Semana',
            'month': 'Este Mes',
            'year': 'Este Año',
            'all': 'Siempre'
        };

        for (const [key, value] of Object.entries(actions)) {
            const button = actionsContainer.createEl('button', { text: value });
            button.onClickEvent(() => {
                this.onChoose({ filter: key });
                this.close();
            });
        }
        
        actionsContainer.createEl('h4', { text: 'Selección Manual' });
        this.applyButton = actionsContainer.createEl('button', { text: 'Aplicar Selección' });
        this.applyButton.onClickEvent(() => {
            if (this.selectionStartDate && this.selectionEndDate) {
                this.onChoose({ 
                    filter: 'custom', 
                    startDate: this.selectionStartDate, 
                    endDate: this.selectionEndDate 
                });
                this.close();
            } else if (this.selectionStartDate) {
                this.onChoose({
                    filter: 'single-day',
                    startDate: this.selectionStartDate
                });
                this.close();
            }
        });
    }

    private handleDayClick(day: moment.Moment) {
        if (!this.selectionStartDate || (this.selectionStartDate && this.selectionEndDate)) {
            this.selectionStartDate = day;
            this.selectionEndDate = null;
        } else {
            this.selectionEndDate = day;
            if (this.selectionEndDate.isBefore(this.selectionStartDate)) {
                [this.selectionStartDate, this.selectionEndDate] = [this.selectionEndDate, this.selectionStartDate];
            }
        }
        this.renderModalContent(this.contentEl);
    }

    private renderCalendar(container: HTMLElement) {
        const calendarContainer = container.createDiv('calendar-container');
        const calendarHeader = calendarContainer.createDiv('calendar-header');

        calendarHeader.createEl('button', { text: '‹' }).onClickEvent(() => {
            this.calendarMonth.subtract(1, 'month');
            this.renderModalContent(this.contentEl);
        });

        calendarHeader.createEl('span', { text: this.calendarMonth.format('MMMM YYYY') });

        calendarHeader.createEl('button', { text: '›' }).onClickEvent(() => {
            this.calendarMonth.add(1, 'month');
            this.renderModalContent(this.contentEl);
        });

        const grid = calendarContainer.createDiv('calendar-grid');
        const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        weekdays.forEach(day => {
            grid.createDiv({ text: day, cls: 'weekday' });
        });

        const firstDayOfMonth = this.calendarMonth.clone().startOf('month');
        const daysInMonth = this.calendarMonth.daysInMonth();
        const startOffset = (firstDayOfMonth.isoWeekday() - 1);

        for (let i = 0; i < startOffset; i++) {
            grid.createDiv({ cls: 'day-cell empty' });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = grid.createDiv({ text: day.toString(), cls: 'day-cell' });
            const currentDay = this.calendarMonth.clone().date(day);

            const dayKey = currentDay.format('YYYY-MM-DD');
            const activity = this.activityMap[dayKey];
            if (activity) {
                if (activity < 3) dayEl.addClass('activity-low');
                else if (activity < 7) dayEl.addClass('activity-medium');
                else dayEl.addClass('activity-high');
            }

            if (currentDay.isSame(moment(), 'day')) {
                dayEl.addClass('is-today');
            }

            if (this.selectionStartDate) {
                if (currentDay.isSame(this.selectionStartDate, 'day')) {
                    dayEl.addClass('is-start-date');
                }
                if (this.selectionEndDate) {
                    if (currentDay.isSame(this.selectionEndDate, 'day')) {
                        dayEl.addClass('is-end-date');
                    }
                    if (currentDay.isBetween(this.selectionStartDate, this.selectionEndDate)) {
                        dayEl.addClass('is-in-range');
                    }
                }
            }

            dayEl.onClickEvent(() => {
                this.handleDayClick(currentDay);
            });
        }
    }
}
