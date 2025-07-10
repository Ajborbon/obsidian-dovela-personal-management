
// src/modules/moduloGTDv3/timelineView.ts

import { TimeTrackerService } from './timeTrackerService.js';
import type { TimeLogEntry } from './model.js';
import { stringToHslColor } from './colorUtils.js';
import moment from 'moment';

type TimelineViewType = 'day' | '3-day' | 'week';

const HOUR_HEIGHT = 60; // Altura en píxeles para una hora

export class TimelineView {
    private container: HTMLElement;
    private service: TimeTrackerService;
    private viewType: TimelineViewType = 'day';
    private currentDate: moment.Moment;

    constructor(container: HTMLElement, service: TimeTrackerService) {
        this.container = container;
        this.service = service;
        this.currentDate = moment().startOf('day');
        this.render();
    }

    public updateContainer(newContainer: HTMLElement) {
        this.container = newContainer;
        this.render();
    }

    private async render() {
        this.container.empty();
        this.container.addClass('timeline-view-container');

        this.renderControls();
        await this.renderTimeline();
    }

    private renderControls() {
        const controlsEl = this.container.createDiv({ cls: 'timeline-controls' });

        const navGroup = controlsEl.createDiv({ cls: 'timeline-nav-group' });
        navGroup.createEl('button', { text: '◄' }).onClickEvent(() => this.navigate(-1));
        navGroup.createEl('button', { text: 'Hoy' }).onClickEvent(() => this.goToday());
        const dateDisplay = navGroup.createEl('span', { cls: 'timeline-date-display' });
        this.updateDateDisplay(dateDisplay);
        navGroup.createEl('button', { text: '►' }).onClickEvent(() => this.navigate(1));

        const viewGroup = controlsEl.createDiv({ cls: 'timeline-view-group' });
        const viewTypes: TimelineViewType[] = ['day', '3-day', 'week'];
        viewTypes.forEach(type => {
            const button = viewGroup.createEl('button', { text: this.getButtonText(type) });
            if (this.viewType === type) button.addClass('is-active');
            button.onClickEvent(() => {
                this.viewType = type;
                this.render();
            });
        });
    }

    private updateDateDisplay(element: HTMLElement) {
        let text = '';
        switch (this.viewType) {
            case 'day':
                text = this.currentDate.format('dddd, D [de] MMMM [de] YYYY');
                break;
            case '3-day':
                const end3Day = this.currentDate.clone().add(2, 'days');
                text = `${this.currentDate.format('D MMM')} - ${end3Day.format('D MMM, YYYY')}`;
                break;
            case 'week':
                const startOfWeek = this.currentDate.clone().startOf('isoWeek');
                const endOfWeek = this.currentDate.clone().endOf('isoWeek');
                text = `Semana del ${startOfWeek.format('D MMM')} al ${endOfWeek.format('D MMM, YYYY')}`;
                break;
        }
        element.setText(text);
    }

    private getButtonText(type: TimelineViewType): string {
        switch (type) {
            case 'day': return 'Día';
            case '3-day': return '3 Días';
            case 'week': return 'Semana';
        }
    }

    private navigate(direction: number) {
        const unit = this.viewType === 'week' ? 'weeks' : this.viewType === '3-day' ? 'days' : 'days';
        const amount = this.viewType === '3-day' ? 3 * direction : direction;
        this.currentDate.add(amount, unit);
        this.render();
    }

    private goToday() {
        this.currentDate = moment().startOf('day');
        this.render();
    }

    private async renderTimeline() {
        const timelineContainer = this.container.createDiv({ cls: 'timeline-grid-container' });

        // 1. Definir el rango de fechas
        const { startDate, endDate, days } = this.getDateRange();
        
        // 2. Cargar los logs para ese rango
        const allLogs = await this.service.loadTimeLogs();
        const filteredLogs = allLogs.filter(log => {
            const logMoment = moment(log.startTime);
            return logMoment.isBetween(startDate, endDate, undefined, '[]');
        });

        // 3. Renderizar la parrilla
        this.renderGrid(timelineContainer, days);

        // 4. Renderizar los bloques de eventos
        this.renderEventBlocks(timelineContainer, filteredLogs, startDate);
    }

    private getDateRange() {
        let startDate: moment.Moment;
        let days: moment.Moment[] = [];
        
        switch (this.viewType) {
            case 'day':
                startDate = this.currentDate.clone();
                days = [startDate];
                break;
            case '3-day':
                startDate = this.currentDate.clone();
                days = [startDate, startDate.clone().add(1, 'day'), startDate.clone().add(2, 'days')];
                break;
            case 'week':
                startDate = this.currentDate.clone().startOf('isoWeek');
                days = Array.from({ length: 7 }, (_, i) => startDate.clone().add(i, 'days'));
                break;
            default:
                startDate = this.currentDate.clone();
                days = [startDate];
                break;
        }
        
        if (days.length === 0) {
            // Fallback safety
            startDate = this.currentDate.clone();
            days = [startDate];
        }
        
        const endDate = days[days.length - 1]!.clone().endOf('day');
        return { startDate, endDate, days };
    }

    private renderGrid(container: HTMLElement, days: moment.Moment[]) {
        container.style.setProperty('--num-days', days.length.toString());

        // Eje de tiempo
        const timeAxis = container.createDiv({ cls: 'timeline-time-axis' });
        for (let i = 0; i < 24; i++) {
            timeAxis.createDiv({ cls: 'timeline-hour-label', text: `${i}:00` });
        }

        // Columnas de días
        days.forEach(day => {
            const dayColumn = container.createDiv({ cls: 'timeline-day-column' });
            if (!dayColumn) return; // Defensive check

            dayColumn.createEl('div', { cls: 'timeline-day-header', text: day.format('ddd D') });
            const gridLines = dayColumn.createDiv({cls: 'timeline-grid-lines'});
            
            if (!gridLines) return; // Defensive check

            for (let i = 0; i < 24; i++) {
                gridLines.createDiv({ cls: 'timeline-hour-line' });
            }
        });
    }

    private renderEventBlocks(container: HTMLElement, logs: TimeLogEntry[], viewStartDate: moment.Moment) {
        logs.forEach(log => {
            const start = moment(log.startTime);
            const end = moment(log.endTime);
            
            const top = (start.hours() * HOUR_HEIGHT) + (start.minutes() / 60 * HOUR_HEIGHT);
            const height = Math.max(15, (end.diff(start, 'minutes') / 60 * HOUR_HEIGHT)); // Mínimo 15px de alto
            
            const dayIndex = start.diff(viewStartDate.clone().startOf('day'), 'days');

            const block = container.createDiv({
                cls: 'timeline-event-block',
                attr: {
                    style: `
                        top: ${top}px;
                        height: ${height}px;
                        grid-column: ${dayIndex + 2};
                        background-color: ${this.getBlockColor(log.taskNotePath || '')};
                    `,
                    'data-log-id': log.id || 'unknown'
                }
            });

            const description = log.taskDescription || log.taskNotePath?.split('/').pop() || 'Tarea';
            block.createEl('div', { cls: 'event-block-title', text: description });
            block.createEl('div', { cls: 'event-block-time', text: `${start.format('HH:mm')} - ${end.format('HH:mm')}` });
        });
    }

    private getBlockColor(path: string): string {
        if (!path) return stringToHslColor('default');
        const parts = path.split('/');
        const rootFolder = parts.length > 1 ? parts[0] : 'default';
        return stringToHslColor(rootFolder || 'default');
    }
}
