import { App, Modal, Setting, TFile } from 'obsidian';
import { TimeTrackerService } from './timeTrackerService.js';
import type { Task } from './model.js';
import moment from 'moment';

type TimeLogModalEntry = {
    taskNotePath: string;
    startTime: moment.Moment;
    endTime: moment.Moment;
    notes: string;
    taskDescription?: string;
};

export class TimeLogModal extends Modal {
    private service: TimeTrackerService;
    private onSave: () => void;
    private entry: TimeLogModalEntry;
    private availableTasks: (TFile | Task)[];

    constructor(app: App, service: TimeTrackerService, availableTasks: (TFile | Task)[], onSave: () => void, entryData?: Partial<TimeLogModalEntry>) {
        super(app);
        this.service = service;
        this.onSave = onSave;
        this.availableTasks = availableTasks;
        
        const now = moment().local();
        this.entry = {
            taskNotePath: entryData?.taskNotePath || '',
            startTime: entryData?.startTime ? moment(entryData.startTime).local() : now,
            endTime: entryData?.endTime ? moment(entryData.endTime).local() : now,
            notes: entryData?.notes || '',
            taskDescription: entryData?.taskDescription || ''
        };
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText('Registrar Tiempo');

        new Setting(contentEl)
            .setName('Tarea')
            .addDropdown(dropdown => {
                this.availableTasks.forEach(taskOrFile => {
                    if (taskOrFile instanceof TFile) {
                        dropdown.addOption(taskOrFile.path, taskOrFile.path);
                    } else {
                        const task = taskOrFile as Task;
                        dropdown.addOption(task.sourceFile.path, `${task.content.substring(0, 50)}... (${task.sourceFile.basename})`);
                    }
                });
                dropdown.setValue(this.entry.taskNotePath);
                dropdown.onChange(value => this.entry.taskNotePath = value);
            });

        new Setting(contentEl)
            .setName('Fecha')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.entry.startTime.format('YYYY-MM-DD'));
                text.onChange(value => {
                    const newDate = moment(value, 'YYYY-MM-DD');
                    this.entry.startTime.year(newDate.year()).month(newDate.month()).date(newDate.date());
                    this.entry.endTime.year(newDate.year()).month(newDate.month()).date(newDate.date());
                });
            });

        new Setting(contentEl)
            .setName('Hora de Inicio')
            .addText(text => {
                text.setValue(this.formatTime(this.entry.startTime));
                text.onChange(value => {
                    const newTime = this.parseTime(value, this.entry.startTime);
                    if (newTime) this.entry.startTime = newTime;
                });
            });

        new Setting(contentEl)
            .setName('Hora de Finalización')
            .addText(text => {
                text.setValue(this.formatTime(this.entry.endTime));
                text.onChange(value => {
                    const newTime = this.parseTime(value, this.entry.endTime);
                    if (newTime) this.entry.endTime = newTime;
                });
            });
        
        new Setting(contentEl)
            .setName('Notas de la Sesión')
            .addTextArea(text => {
                text.setValue(this.entry.notes || this.entry.taskDescription || '');
                text.onChange(value => this.entry.notes = value);
                text.inputEl.rows = 4;
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Guardar')
                .setCta()
                .onClick(() => this.save()));
    }

    private formatTime(date: moment.Moment): string {
        return date.format('HH:mm');
    }

    private parseTime(time: string, originalMoment: moment.Moment): moment.Moment | null {
        const [hours, minutes] = time.split(':').map(Number);
        if (hours !== undefined && minutes !== undefined && !isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            return originalMoment.clone().hours(hours).minutes(minutes).seconds(0).milliseconds(0);
        }
        return null;
    }

    async save() {
        if (!this.entry.taskNotePath) {
            // TODO: Show error to user
            return;
        }

        const durationMinutes = this.entry.endTime.diff(this.entry.startTime, 'minutes');
        if (durationMinutes < 0) {
            // TODO: Show error
            return;
        }

        await this.service.addLogEntry({
            taskNotePath: this.entry.taskNotePath,
            startTime: this.entry.startTime.toISOString(true),
            endTime: this.entry.endTime.toISOString(true),
            durationMinutes: durationMinutes,
            notes: this.entry.notes,
            taskDescription: this.entry.taskDescription || ''
        });

        this.onSave();
        this.close();
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
