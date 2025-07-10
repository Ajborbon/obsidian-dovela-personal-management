import { App } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { TimeLogEntry, ActiveTimerState } from './model.js';
import moment from 'moment';

export class TimeTrackerService {
    private plugin: DovelaPersonalManagementPlugin;
    private app: App;

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    async addLogEntry(entryData: Omit<TimeLogEntry, 'id'>): Promise<void> {
        const newEntry: TimeLogEntry = {
            id: Date.now().toString(),
            ...entryData
        };
        this.plugin.data.timeLogs.push(newEntry);
        await this.plugin.savePluginData();
    }

    getStatistics(filters: { startDate?: moment.Moment, endDate?: moment.Moment }): Map<string, number> {
        const stats = new Map<string, number>();
        const logs = this.plugin.data.timeLogs;

        const filteredLogs = logs.filter(log => {
            const logTime = moment(log.startTime);

            if (filters.startDate && logTime.isBefore(filters.startDate)) return false;
            if (filters.endDate && logTime.isAfter(filters.endDate)) return false;
            return true;
        });

        for (const log of filteredLogs) {
            if (!log.taskNotePath) continue;
            const pathParts = log.taskNotePath.split('/');
            let currentPath = '';
            for (const part of pathParts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const currentDuration = stats.get(currentPath) || 0;
                stats.set(currentPath, currentDuration + log.durationMinutes);
            }
        }
        return stats;
    }

    async saveInterruptedSession(timer: ActiveTimerState): Promise<void> {
        this.plugin.data.interruptedTimer = timer;
        await this.plugin.savePluginData();
    }

    async loadInterruptedSession(): Promise<ActiveTimerState | null> {
        return this.plugin.data.interruptedTimer || null;
    }

    async clearInterruptedSession(): Promise<void> {
        this.plugin.data.interruptedTimer = undefined;
        await this.plugin.savePluginData();
    }

    async updateLogEntry(logId: string, updatedData: Partial<Omit<TimeLogEntry, 'id'>>): Promise<void> {
        const logIndex = this.plugin.data.timeLogs.findIndex(log => log.id === logId);
        if (logIndex > -1) {
            this.plugin.data.timeLogs[logIndex] = { ...this.plugin.data.timeLogs[logIndex], ...updatedData };
            await this.plugin.savePluginData();
        }
    }

    async deleteLogEntry(logId: string): Promise<void> {
        this.plugin.data.timeLogs = this.plugin.data.timeLogs.filter(log => log.id !== logId);
        await this.plugin.savePluginData();
    }
}
