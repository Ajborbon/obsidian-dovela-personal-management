import type DovelaPersonalManagementPlugin from '../../main.js';
import moment from 'moment';
import { generateColorFromString } from './colorUtils.js';
import type { TimeLogEntry } from './model.js';
import { TimeLogModal } from './timeLogModal.js';

type TimelineViewType = 'day' | '3-day' | 'week';

const MINUTES_IN_DAY = 24 * 60;
const MIN_DURATION_FOR_BLOCK = 10; // En minutos


export class TimelineView {
    private container: HTMLElement;
    private plugin: DovelaPersonalManagementPlugin;
    private viewType: TimelineViewType = 'day';
    private currentDate: moment.Moment;
    private calendarPopover: HTMLElement | null = null;
    private calendarCurrentDate: moment.Moment;

    constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin) {
        this.container = container;
        this.plugin = plugin;
        this.currentDate = moment();
        this.calendarCurrentDate = this.currentDate.clone();
        this.render();

        // Close popover when clicking outside
        this.container.ownerDocument.addEventListener('click', (e) => {
            if (this.calendarPopover && !this.calendarPopover.contains(e.target as Node) && !(e.target as HTMLElement).closest('.timeline-date-title-button')) {
                this.hideCalendarPopover();
            }
        });
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
        
        const dateTitleButton = dateNav.createEl('button', { 
            text: this.getDateRangeTitle(), 
            cls: 'timeline-date-title-button' 
        });
        dateTitleButton.addEventListener('click', () => this.toggleCalendarPopover());

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

    private toggleCalendarPopover() {
        if (this.calendarPopover) {
            this.hideCalendarPopover();
        } else {
            this.showCalendarPopover();
        }
    }

    private showCalendarPopover() {
        if (!this.calendarPopover) {
            this.calendarPopover = this.container.createEl('div', { cls: 'timeline-calendar-popover' });
        }
        this.calendarPopover.style.display = 'block';
        this.renderCalendarPopoverContent();
    }

    private hideCalendarPopover() {
        if (this.calendarPopover) {
            this.calendarPopover.style.display = 'none';
            this.calendarPopover = null; // Destroy to ensure it's recreated fresh
        }
    }

    private renderCalendarPopoverContent() {
        if (!this.calendarPopover) return;
        this.calendarPopover.empty();

        // 1. Header
        const header = this.calendarPopover.createEl('div', { cls: 'popover-header' });
        header.createEl('button', { text: '◄' }).addEventListener('click', (e) => {
            e.stopPropagation();
            this.calendarCurrentDate.subtract(1, 'month');
            this.renderCalendarPopoverContent();
        });
        header.createEl('span', { text: this.calendarCurrentDate.format('MMMM YYYY') });
        header.createEl('button', { text: '►' }).addEventListener('click', (e) => {
            e.stopPropagation();
            this.calendarCurrentDate.add(1, 'month');
            this.renderCalendarPopoverContent();
        });

        // 2. Weekday Headers
        const weekdays = this.calendarPopover.createEl('div', { cls: 'popover-weekdays' });
        moment.weekdaysMin().forEach(day => weekdays.createEl('div', { text: day }));

        // 3. Days Grid
        const daysGrid = this.calendarPopover.createEl('div', { cls: 'popover-days-grid' });
        const activityMap = this.plugin.timeTrackerService.getMonthlyActivity(this.calendarCurrentDate);
        
        const startOfMonth = this.calendarCurrentDate.clone().startOf('month');
        const endOfMonth = this.calendarCurrentDate.clone().endOf('month');
        const startDayOfWeek = startOfMonth.day();

        // Fill in days from the previous month
        for (let i = 0; i < startDayOfWeek; i++) {
            daysGrid.createEl('div', { cls: 'day-cell other-month' });
        }

        // Fill in days for the current month
        for (let day = 1; day <= endOfMonth.date(); day++) {
            const date = this.calendarCurrentDate.clone().date(day);
            const dayKey = date.format('YYYY-MM-DD');
            const dayCell = daysGrid.createEl('div', { cls: 'day-cell', text: String(day) });
            
            if (date.isSame(moment(), 'day')) {
                dayCell.addClass('is-today');
            }
            if (date.isSame(this.currentDate, 'day')) {
                dayCell.addClass('is-selected');
            }

            const minutes = activityMap.get(dayKey) || 0;
            if (minutes > 0) {
                if (minutes < 120) dayCell.addClass('activity-low');
                else if (minutes < 300) dayCell.addClass('activity-medium');
                else dayCell.addClass('activity-high');
            }

            dayCell.addEventListener('click', () => {
                this.currentDate = date;
                this.calendarCurrentDate = date.clone();
                this.hideCalendarPopover();
                this.render();
            });
        }
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
            if (day) headerContainer.createEl('div', { cls: 'timeline-day-header', text: day.format('ddd D') });
        });

        // Scrollable Grid Container
        const daysContainer = daysWrapper.createEl('div', { cls: 'timeline-days-container' });
        daysContainer.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

        days.forEach(day => {
            if (!day) return;
            const dayColumn = daysContainer.createEl('div', { cls: 'timeline-day-column' });
            dayColumn.dataset['date'] = day.format('YYYY-MM-DD');
            
            // Hour lines for the grid
            for (let hour = 0; hour < 24; hour++) {
                dayColumn.createEl('div', { cls: 'timeline-hour-line' });
            }

            // Add listeners for drag-and-drop functionality
            this.addDropZoneInteraction(day, dayColumn);

            // Render Time Blocks
            this.renderTimeBlocks(day, dayColumn);

            // Add create event listener
            this.addCreateEvent(day, dayColumn);
        });
    }

    private addDropZoneInteraction(day: moment.Moment, dayColumn: HTMLElement) {
        dayColumn.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault(); // Necessary to allow dropping
            if (e.dataTransfer) {
                // Provide visual feedback based on Alt/Option key state
                e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
            }
        });

        dayColumn.addEventListener('dragenter', (e: DragEvent) => {
            // Check if the dragged item is one of our blocks
            if (e.dataTransfer?.types.includes('text/plain')) {
                dayColumn.classList.add('drop-target-hover');
            }
        });

        dayColumn.addEventListener('dragleave', (e: DragEvent) => {
            // Avoid flickering when moving over child elements
            if (!dayColumn.contains(e.relatedTarget as Node)) {
                dayColumn.classList.remove('drop-target-hover');
            }
        });

        dayColumn.addEventListener('drop', async (e: DragEvent) => {
            e.preventDefault();
            dayColumn.classList.remove('drop-target-hover');

            if (!e.dataTransfer) return;

            const logId = e.dataTransfer.getData('text/plain');
            const originalLog = this.plugin.data.timeLogs.find(log => log.id === logId);

            if (!originalLog) return;

            // Calculate original duration
            const durationMinutes = moment(originalLog.endTime).diff(moment(originalLog.startTime), 'minutes');

            // Calculate new start time based on drop position
            const columnRect = dayColumn.getBoundingClientRect();
            const dropY = e.clientY - columnRect.top;
            
            // Ensure dropY is within bounds
            const relativeY = Math.max(0, Math.min(dropY, columnRect.height));
            
            const startMinutes = (relativeY / columnRect.height) * MINUTES_IN_DAY;

            const newStartTime = day.clone().startOf('day').add(startMinutes, 'minutes');
            const newEndTime = newStartTime.clone().add(durationMinutes, 'minutes');

            // Check if the Alt/Option key is pressed to duplicate instead of move
            if (e.altKey) {
                await this.plugin.timeTrackerService.addLogEntry({
                    taskNotePath: originalLog.taskNotePath,
                    taskDescription: originalLog.taskDescription || '',
                    notes: originalLog.notes,
                    startTime: newStartTime.toISOString(),
                    endTime: newEndTime.toISOString(),
                    durationMinutes: durationMinutes
                });
            } else {
                await this.plugin.timeTrackerService.updateLogEntry(logId, {
                    startTime: newStartTime.toISOString(),
                    endTime: newEndTime.toISOString()
                });
            }

            // Re-render the entire view to reflect the change
            this.render();
        });
    }

    private renderTimeBlocks(day: moment.Moment, dayColumn: HTMLElement) {
        const dayStart = day.clone().startOf('day');
        const dayEnd = day.clone().endOf('day');

        const logsForDay = this.plugin.data.timeLogs.filter(log => {
            const start = moment(log.startTime);
            const end = moment(log.endTime);
            if (start.isSameOrAfter(end)) return false;
            return start.isBefore(dayEnd) && end.isAfter(dayStart);
        });

        const eventGroups = this.groupOverlappingLogs(logsForDay);

        eventGroups.forEach(group => {
            const groupSize = group.length;
            group.forEach((log, index) => {
                const startMoment = moment(log.startTime);
                const endMoment = moment(log.endTime);

                const segmentStart = moment.max(startMoment, dayStart);
                const segmentEnd = moment.min(endMoment, dayEnd);

                const startOfDay = segmentStart.clone().startOf('day');
                const startMinute = segmentStart.diff(startOfDay, 'minutes');
                const durationMinutes = segmentEnd.diff(segmentStart, 'minutes');

                if (durationMinutes <= 0) return;

                const width = 100 / groupSize;
                const left = index * width;

                if (durationMinutes < MIN_DURATION_FOR_BLOCK && !startMoment.isSame(endMoment, 'day')) {
                    this.renderShortEventIndicator(log, dayColumn, startMinute, left, width);
                } else {
                    this.renderFullBlock(log, dayColumn, startMinute, durationMinutes, segmentStart, segmentEnd, left, width);
                }
            });
        });
    }

    private groupOverlappingLogs(logs: TimeLogEntry[]): TimeLogEntry[][] {
        if (logs.length === 0) return [];

        const sortedLogs = logs.sort((a, b) => moment(a.startTime).diff(moment(b.startTime)));

        const groups: TimeLogEntry[][] = [];
        let currentGroup: TimeLogEntry[] = [];

        sortedLogs.forEach(log => {
            if (currentGroup.length === 0) {
                currentGroup.push(log);
                return;
            }

            const groupEndTime = Math.max(...currentGroup.map(l => moment(l.endTime).valueOf()));
            
            if (moment(log.startTime).valueOf() < groupEndTime) {
                currentGroup.push(log);
            } else {
                groups.push(currentGroup);
                currentGroup = [log];
            }
        });

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    private renderShortEventIndicator(log: TimeLogEntry, dayColumn: HTMLElement, startMinute: number, left: number, width: number) {
        const top = (startMinute / MINUTES_IN_DAY) * 100;

        const indicator = dayColumn.createEl('div', { cls: 'timeline-short-event-indicator' });
        indicator.style.top = `${top}%`;
        indicator.style.left = `${left}%`;
        indicator.style.width = `calc(${width}% - 2px)`; // 2px for margin
        indicator.style.backgroundColor = this.getBlockColor(log);
        indicator.dataset['logId'] = log.id;

        const startMoment = moment(log.startTime);
        const endMoment = moment(log.endTime);
        const projectName = log.taskNotePath.split('/').pop()?.replace('.md', '') || 'Tarea';
        const fullStartTime = startMoment.format('MMM D, HH:mm');
        const fullEndTime = endMoment.format('MMM D, HH:mm');
        const duration = endMoment.diff(startMoment, 'minutes');

        const tooltipParts = [
            `Proyecto: ${projectName}`,
            `Tarea: ${log.taskDescription || '(Sin descripción)'}`,
            `Periodo: ${fullStartTime} - ${fullEndTime} (${duration} min)`,
            `Notas: ${log.notes || '(Sin notas)'}`
        ];
        indicator.setAttribute('title', tooltipParts.join('\n'));

        indicator.addEventListener('click', () => {
            new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
        });

        indicator.addEventListener('mouseenter', () => {
            document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"], .timeline-short-event-indicator[data-log-id="${log.id}"]`).forEach(el => el.addClass('is-hovered'));
        });
        indicator.addEventListener('mouseleave', () => {
            document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"], .timeline-short-event-indicator[data-log-id="${log.id}"]`).forEach(el => el.removeClass('is-hovered'));
        });
    }

    private renderFullBlock(log: TimeLogEntry, dayColumn: HTMLElement, startMinute: number, durationMinutes: number, segmentStart: moment.Moment, _segmentEnd: moment.Moment, left: number, width: number) {
        const top = (startMinute / MINUTES_IN_DAY) * 100;
        const height = (durationMinutes / MINUTES_IN_DAY) * 100;

        const block = dayColumn.createEl('div', { cls: 'timeline-block' });
        block.style.top = `${top}%`;
        block.style.height = `${height}%`;
        block.style.left = `${left}%`;
        block.style.width = `calc(${width}% - 2px)`; // 2px for margin
        block.style.backgroundColor = this.getBlockColor(log);
        
        block.dataset['logId'] = log.id;

        const startMoment = moment(log.startTime);
        const endMoment = moment(log.endTime);
        const day = segmentStart.clone().startOf('day');

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

        block.addEventListener('mouseenter', () => {
            document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"], .timeline-short-event-indicator[data-log-id="${log.id}"]`).forEach(el => el.addClass('is-hovered'));
        });
        block.addEventListener('mouseleave', () => {
            document.querySelectorAll(`.timeline-block[data-log-id="${log.id}"], .timeline-short-event-indicator[data-log-id="${log.id}"]`).forEach(el => el.removeClass('is-hovered'));
        });

        if (isMultiDay) {
            block.addEventListener('click', () => {
                new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
            });
        } else {
            const resizeHandle = block.createEl('div', { cls: 'timeline-block-resize-handle' });
            this.addBlockInteraction(block, resizeHandle, log, dayColumn);
        }
    }

    private addBlockInteraction(block: HTMLElement, handle: HTMLElement, log: TimeLogEntry, dayColumn: HTMLElement) {
        // Prevent the resize handle itself from being draggable
        handle.draggable = false;

        // 1. NATIVE DRAG-AND-DROP FOR MOVING BETWEEN COLUMNS
        block.draggable = true;

        block.addEventListener('dragstart', (e: DragEvent) => {
            // Prevent drag if the resize handle was the target
            if (e.target === handle) {
                e.preventDefault();
                return;
            }
            
            // Ensure dataTransfer is available
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', log.id);
                e.dataTransfer.effectAllowed = 'copyMove';
            }
            
            // Add a slight delay to allow the DOM to update before applying the class
            setTimeout(() => {
                block.classList.add('is-dragging');
            }, 0);
        });

        block.addEventListener('dragend', () => {
            block.classList.remove('is-dragging');
        });


        // 2. MOUSE EVENTS FOR RESIZING (existing logic preserved)
        const DRAG_THRESHOLD = 5;
        let initialY: number, initialHeight: number;
        let columnRect: DOMRect;
        let hasMoved = false;

        const onResizeMouseDown = (e: MouseEvent) => {
            e.stopPropagation(); // Stop event from bubbling to the block's click/drag listeners
            block.draggable = false; // Temporarily disable dragging during resize
            
            hasMoved = false;
            initialY = e.clientY;
            initialHeight = block.offsetHeight;
            columnRect = dayColumn.getBoundingClientRect();

            document.addEventListener('mousemove', onResizeMouseMove);
            document.addEventListener('mouseup', onResizeMouseUp);
        };

        const onResizeMouseMove = (e: MouseEvent) => {
            if (!hasMoved && Math.abs(e.clientY - initialY) > DRAG_THRESHOLD) {
                hasMoved = true;
            }
            if (hasMoved) {
                const dy = e.clientY - initialY;
                block.style.height = `${Math.max(10, initialHeight + dy)}px`;
            }
        };

        const onResizeMouseUp = async () => {
            document.removeEventListener('mousemove', onResizeMouseMove);
            document.removeEventListener('mouseup', onResizeMouseUp);
            block.draggable = true; // Re-enable dragging after resize is complete

            if (hasMoved) {
                const finalHeight = block.offsetHeight;
                const durationMinutes = (finalHeight / columnRect.height) * MINUTES_IN_DAY;
                const newEndTime = moment(log.startTime).add(durationMinutes, 'minutes');
                await this.plugin.timeTrackerService.updateLogEntry(log.id, {
                    endTime: newEndTime.toISOString(),
                    durationMinutes: Math.round(durationMinutes)
                });
                this.render();
            }
        };

        handle.addEventListener('mousedown', onResizeMouseDown);

        // 3. CLICK EVENT FOR OPENING THE MODAL (existing logic preserved)
        block.addEventListener('click', () => {
            // This check ensures that the modal doesn't open after a resize action.
            if (!hasMoved) {
                new TimeLogModal(this.plugin.app, this.plugin.timeTrackerService, this.plugin, () => this.render(), log).open();
            }
        });
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
            const firstDay = days[0];
            if (!firstDay) return 'Sin fecha';
            return firstDay!.format('MMMM D, YYYY');
        }
        const start = days[0];
        const end = days[days.length - 1];
        if (!start || !end) return 'Rango de fechas';
        if (start!.isSame(end!, 'month')) {
            return `${start!.format('MMMM D')} - ${end!.format('D, YYYY')}`;
        }
        return `${start!.format('MMMM D')} - ${end!.format('MMMM D, YYYY')}`;
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
        const colorSource = pathParts.length > 1 ? (pathParts[0] || log.taskNotePath) : log.taskNotePath;
        return generateColorFromString(colorSource);
    }

    public clear(): void {
        // Lógica de limpieza si es necesario en el futuro
    }
}
