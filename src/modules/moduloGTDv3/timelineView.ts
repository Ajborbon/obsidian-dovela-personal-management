import type DovelaPersonalManagementPlugin from '../../main.js';
import moment from 'moment';
import { generateColorFromString } from './colorUtils.js';
import type { TimeLogEntry } from './model.js';
import { TimeLogModal } from './timeLogModal.js';

type TimelineViewType = 'day' | '3-day' | 'week';

const MINUTES_IN_DAY = 24 * 60;

export class TimelineView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private viewType: TimelineViewType = 'day';
    private currentDate: moment.Moment;

    constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin) {
        this.container = container;
        this.plugin = plugin;
        this.currentDate = moment();
        this.render();
    }

    public updateContainer(newContainer: HTMLElement) {
        this.container = newContainer;
        this.render();
    }

    public render() {
        this.container.empty();
        this.container.addClass('timeline-view-container');

        this.renderControls();
        this.renderGrid();
    }

    private renderControls() {
        const controlsContainer = this.container.createEl('div', { cls: 'timeline-controls' });

        // Navegación de Fecha
        const dateNav = controlsContainer.createEl('div', { cls: 'timeline-date-nav' });
        dateNav.createEl('button', { text: '◄' }).addEventListener('click', () => this.navigate(-1));
        dateNav.createEl('button', { text: 'Hoy' }).addEventListener('click', () => this.goToday());
        dateNav.createEl('span', { text: this.getDateRangeTitle(), cls: 'timeline-date-title' });
        dateNav.createEl('button', { text: '►' }).addEventListener('click', () => this.navigate(1));

        // Selector de Vista
        const viewSelector = controlsContainer.createEl('div', { cls: 'timeline-view-selector' });
        const views: TimelineViewType[] = ['day', '3-day', 'week'];
        views.forEach(view => {
            const button = viewSelector.createEl('button', { text: this.getButtonText(view) });
            if (this.viewType === view) button.addClass('is-active');
            button.addEventListener('click', () => this.setViewType(view));
        });
    }

    private renderGrid() {
        const gridContainer = this.container.createEl('div', { cls: 'timeline-grid-container' });

        // Eje de Tiempo (columna de horas)
        const timeAxis = gridContainer.createEl('div', { cls: 'timeline-time-axis' });
        // Add a blank space for the sticky header
        timeAxis.createEl('div', { cls: 'timeline-header-spacer' });
        for (let hour = 0; hour < 24; hour++) {
            timeAxis.createEl('div', { cls: 'timeline-hour-label', text: `${hour}:00` });
        }

        // Wrapper for headers and scrollable grid
        const daysWrapper = gridContainer.createEl('div', { cls: 'timeline-days-wrapper' });
        const days = this.getVisibleDays();

        // Sticky Header Container
        const headerContainer = daysWrapper.createEl('div', { cls: 'timeline-header-container' });
        headerContainer.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
        days.forEach(day => {
            headerContainer.createEl('div', { cls: 'timeline-day-header', text: day.format('ddd D') });
        });

        // Scrollable Grid Container
        const daysContainer = daysWrapper.createEl('div', { cls: 'timeline-days-container' });
        daysContainer.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

        days.forEach(day => {
            const dayColumn = daysContainer.createEl('div', { cls: 'timeline-day-column' });
            dayColumn.dataset.date = day.format('YYYY-MM-DD');
            
            // Hour lines for the grid
            for (let hour = 0; hour < 24; hour++) {
                dayColumn.createEl('div', { cls: 'timeline-hour-line' });
            }

            // Render Time Blocks
            this.renderTimeBlocks(day, dayColumn);

            // Add create event listener
            this.addCreateEvent(day, dayColumn);
        });
    }

    private renderTimeBlocks(day: moment.Moment, dayColumn: HTMLElement) {
        const dayStart = day.clone().startOf('day');
        const dayEnd = day.clone().endOf('day');

        // Find logs that INTERSECT with the current day
        const logsForDay = this.plugin.data.timeLogs.filter(log => {
            const start = moment(log.startTime);
            const end = moment(log.endTime);
            // Ensure the log has a duration before attempting to render
            if (start.isSameOrAfter(end)) return false;
            return start.isBefore(dayEnd) && end.isAfter(dayStart);
        });

        logsForDay.forEach(log => {
            const startMoment = moment(log.startTime);
            const endMoment = moment(log.endTime);

            // Clamp the segment to the current day's bounds
            const segmentStart = moment.max(startMoment, dayStart);
            const segmentEnd = moment.min(endMoment, dayEnd);

            const startOfDay = segmentStart.clone().startOf('day');
            const startMinute = segmentStart.diff(startOfDay, 'minutes');
            const durationMinutes = segmentEnd.diff(segmentStart, 'minutes');

            if (durationMinutes <= 0) return;

            const top = (startMinute / MINUTES_IN_DAY) * 100;
            const height = (durationMinutes / MINUTES_IN_DAY) * 100;

            const block = dayColumn.createEl('div', { cls: 'timeline-block' });
            block.style.top = `${top}%`;
            block.style.height = `${height}%`;
            block.style.backgroundColor = this.getBlockColor(log);
            
            // Add data-log-id for hover interaction
            block.dataset.logId = log.id;

            const isMultiDay = !startMoment.isSame(endMoment, 'day');
            if (isMultiDay) {
                const isFirstSegment = day.isSame(startMoment, 'day');
                const isLastSegment = day.isSame(endMoment, 'day');
                
                if (isFirstSegment) {
                    block.addClass('timeline-block-continuation-start');
                } else if (isLastSegment) {
                    block.addClass('timeline-block-continuation-end');
                } else {
                    block.addClass('timeline-block-continuation-middle');
                }
            }

            const projectName = log.taskNotePath.split('/').pop()?.replace('.md', '') || 'Tarea';
            const fullStartTime = startMoment.format('MMM D, HH:mm');
            const fullEndTime = endMoment.format('MMM D, HH:mm');

            const tooltipParts = [
                `Proyecto: ${projectName}`,
                `Tarea: ${log.taskDescription || '(Sin descripción)'}`,
                `Periodo: ${fullStartTime} - ${fullEndTime}`,
                `Notas: ${log.notes || '(Sin notas)'}`
            ];
            block.setAttribute('title', tooltipParts.join('\n'));

            const blockContent = block.createEl('div', { cls: 'timeline-block-content' });
            blockContent.createEl('strong', { text: projectName });

            // Add hover listeners for unified highlighting
            block.addEventListener('mouseenter', () => {
                document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"]`).forEach(el => el.addClass('is-hovered'));
            });
            block.addEventListener('mouseleave', () => {
                document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"]`).forEach(el => el.removeClass('is-hovered'));
            });

            // For multi-day events, disable complex interactions for now to prevent data corruption.
            // A simple click will open the editor modal.
            if (isMultiDay) {
                block.addEventListener('click', () => {
                    new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
                });
            } else {
                const resizeHandle = block.createEl('div', { cls: 'timeline-block-resize-handle' });
                this.addBlockInteraction(block, resizeHandle, log, dayColumn);
            }
        });
    }

    private addBlockInteraction(block: HTMLElement, handle: HTMLElement, log: TimeLogEntry, dayColumn: HTMLElement) {
        const DRAG_THRESHOLD = 5;
        let initialY: number, initialTop: number, initialHeight: number;
        let columnRect: DOMRect;
        let hasMoved = false;
        let isCopying = false;

        const onResizeMouseDown = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            
            hasMoved = false;
            initialY = e.clientY;
            initialHeight = block.offsetHeight;
            columnRect = dayColumn.getBoundingClientRect();

            document.addEventListener('mousemove', onResizeMouseMove);
            document.addEventListener('mouseup', onResizeMouseUp);
        };

        const onResizeMouseMove = (e: MouseEvent) => {
            if (!hasMoved && Math.abs(e.clientY - initialY) > DRAG_THRESHOLD) hasMoved = true;
            const dy = e.clientY - initialY;
            block.style.height = `${Math.max(10, initialHeight + dy)}px`;
        };

        const onResizeMouseUp = async () => {
            document.removeEventListener('mousemove', onResizeMouseMove);
            document.removeEventListener('mouseup', onResizeMouseUp);

            if (hasMoved) {
                const finalHeight = block.offsetHeight;
                const durationMinutes = (finalHeight / columnRect.height) * MINUTES_IN_DAY;
                const newEndTime = moment(log.startTime).add(durationMinutes, 'minutes');
                await this.plugin.timeTrackerService.updateLogEntry(log.id, {
                    endTime: newEndTime.toISOString(),
                    durationMinutes: Math.round(durationMinutes)
                });
                this.render();
            } else {
                new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
            }
        };

        const onMoveMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            
            isCopying = e.altKey;
            hasMoved = false;
            initialY = e.clientY;
            initialTop = block.offsetTop;
            columnRect = dayColumn.getBoundingClientRect();

            if (isCopying) {
                document.body.classList.add('is-copying');
            }

            document.addEventListener('mousemove', onMoveMouseMove);
            document.addEventListener('mouseup', onMoveMouseUp);
        };

        const onMoveMouseMove = (e: MouseEvent) => {
            if (!hasMoved && Math.abs(e.clientY - initialY) > DRAG_THRESHOLD) hasMoved = true;
            const dy = e.clientY - initialY;
            block.style.top = `${initialTop + dy}px`;
        };

        const onMoveMouseUp = async () => {
            document.removeEventListener('mousemove', onMoveMouseMove);
            document.removeEventListener('mouseup', onMoveMouseUp);
            
            if (isCopying) {
                document.body.classList.remove('is-copying');
            }

            if (hasMoved) {
                const finalTop = block.offsetTop;
                const startMinutes = (finalTop / columnRect.height) * MINUTES_IN_DAY;
                const durationMinutes = moment(log.endTime).diff(moment(log.startTime), 'minutes');
                
                // The new start time is relative to the day of the column it was dropped in
                const dayOfColumn = moment(dayColumn.dataset.date);
                const newStartTime = dayOfColumn.startOf('day').add(startMinutes, 'minutes');
                const newEndTime = newStartTime.clone().add(durationMinutes, 'minutes');

                if (isCopying) {
                    await this.plugin.timeTrackerService.addLogEntry({
                        taskNotePath: log.taskNotePath,
                        taskDescription: log.taskDescription,
                        notes: log.notes,
                        startTime: newStartTime.toISOString(),
                        endTime: newEndTime.toISOString(),
                        durationMinutes: durationMinutes
                    });
                } else {
                    await this.plugin.timeTrackerService.updateLogEntry(log.id, {
                        startTime: newStartTime.toISOString(),
                        endTime: newEndTime.toISOString()
                    });
                }
                this.render();
            } else if (!isCopying) {
                new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
            }
        };

        handle.addEventListener('mousedown', onResizeMouseDown);
        block.addEventListener('mousedown', onMoveMouseDown);
    }

    private addCreateEvent(day: moment.Moment, dayColumn: HTMLElement) {
        dayColumn.addEventListener('mousedown', (e) => {
            // Solo iniciar si se hace clic directamente en la columna, no en un bloque
            if ((e.target as HTMLElement) !== dayColumn) return;

            e.preventDefault();

            const columnRect = dayColumn.getBoundingClientRect();
            const startY = e.clientY - columnRect.top;
            
            const previewBlock = dayColumn.createEl('div', { cls: 'timeline-block-preview' });
            previewBlock.style.top = `${(startY / columnRect.height) * 100}%`;
            previewBlock.style.height = '1px';

            const onMouseMove = (moveEvent: MouseEvent) => {
                const currentY = moveEvent.clientY - columnRect.top;
                const height = Math.abs(currentY - startY);
                const top = Math.min(startY, currentY);
                
                previewBlock.style.top = `${(top / columnRect.height) * 100}%`;
                previewBlock.style.height = `${(height / columnRect.height) * 100}%`;
            };

            const onMouseUp = (upEvent: MouseEvent) => {
                dayColumn.removeEventListener('mousemove', onMouseMove);
                dayColumn.removeEventListener('mouseup', onMouseUp);
                dayColumn.removeChild(previewBlock);

                const endY = upEvent.clientY - columnRect.top;
                
                // Ignorar si el arrastre fue muy pequeño
                if (Math.abs(endY - startY) < 5) return;

                const startPercent = (Math.min(startY, endY) / columnRect.height);
                const endPercent = (Math.max(startY, endY) / columnRect.height);

                const startMinute = Math.round(startPercent * MINUTES_IN_DAY);
                const endMinute = Math.round(endPercent * MINUTES_IN_DAY);

                const startTime = day.clone().startOf('day').add(startMinute, 'minutes');
                const endTime = day.clone().startOf('day').add(endMinute, 'minutes');

                new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => {
                    this.render();
                }, {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString()
                }).open();
            };

            dayColumn.addEventListener('mousemove', onMouseMove);
            dayColumn.addEventListener('mouseup', onMouseUp);
        });
    }

    // --- Lógica de Navegación y Estado ---

    private navigate(direction: -1 | 1) {
        const unit = this.viewType === 'week' ? 'week' : (this.viewType === '3-day' ? 'day' : 'day');
        const amount = this.viewType === '3-day' ? 3 * direction : (this.viewType === 'week' ? 7 * direction : 1 * direction);
        this.currentDate.add(amount, 'day');
        this.render();
    }

    private goToday() {
        this.currentDate = moment();
        this.render();
    }

    private setViewType(viewType: TimelineViewType) {
        this.viewType = viewType;
        this.render();
    }

    private getVisibleDays(): moment.Moment[] {
        const start = this.currentDate.clone();
        switch (this.viewType) {
            case 'day':
                return [start];
            case '3-day':
                return [start.clone(), start.clone().add(1, 'day'), start.clone().add(2, 'day')];
            case 'week':
                const weekStart = start.clone().startOf('isoWeek');
                return Array.from({ length: 7 }, (_, i) => weekStart.clone().add(i, 'days'));
        }
    }

    private getDateRangeTitle(): string {
        const days = this.getVisibleDays();
        if (days.length === 1) {
            return days[0].format('MMMM D, YYYY');
        }
        const start = days[0];
        const end = days[days.length - 1];
        if (start.isSame(end, 'month')) {
            return `${start.format('MMMM D')} - ${end.format('D, YYYY')}`;
        }
        return `${start.format('MMMM D')} - ${end.format('MMMM D, YYYY')}`;
    }

    private getButtonText(view: TimelineViewType): string {
        switch (view) {
            case 'day': return 'Día';
            case '3-day': return '3 Días';
            case 'week': return 'Semana';
        }
    }

    private getBlockColor(log: TimeLogEntry): string {
        const pathParts = log.taskNotePath.split('/');
        const colorSource = pathParts.length > 1 ? pathParts[0] : log.taskNotePath;
        return generateColorFromString(colorSource);
    }

    public clear(): void {
        // Lógica de limpieza si es necesario en el futuro
    }
}
