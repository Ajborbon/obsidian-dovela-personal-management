import { App, Modal, Setting, TFile } from 'obsidian';
import { TimeTrackerService } from './timeTrackerService.js';
import type { Task } from './model.js';

type TimeLogModalEntry = {
    taskNotePath: string;
    startTime: Date;
    endTime: Date;
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
        
        const now = new Date();
        this.entry = {
            taskNotePath: entryData?.taskNotePath || '',
            startTime: entryData?.startTime || now,
            endTime: entryData?.endTime || now,
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
                text.setValue(this.entry.startTime.toISOString().split('T')[0]);
                text.onChange(value => {
                    const newDate = new Date(value);
                    const oldStartTime = this.entry.startTime;
                    const oldEndTime = this.entry.endTime;

                    this.entry.startTime = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), oldStartTime.getHours(), oldStartTime.getMinutes());
                    this.entry.endTime = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), oldEndTime.getHours(), oldEndTime.getMinutes());
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

    private formatTime(date: Date): string {
        return date.toTimeString().slice(0, 5);
    }

    private parseTime(time: string, originalDate: Date): Date | null {
        const newDate = new Date(originalDate);
        const [hours, minutes] = time.split(':').map(Number);
        if (hours !== undefined && minutes !== undefined && !isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            newDate.setHours(hours, minutes);
            return newDate;
        }
        return null;
    }

    async save() {
        if (!this.entry.taskNotePath) {
            // TODO: Show error to user
            return;
        }

        const durationMinutes = Math.round((this.entry.endTime.getTime() - this.entry.startTime.getTime()) / 60000);
        if (durationMinutes < 0) {
            // TODO: Show error
            return;
        }

        await this.service.addLogEntry({
            taskNotePath: this.entry.taskNotePath,
            startTime: this.entry.startTime.toISOString(),
            endTime: this.entry.endTime.toISOString(),
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
