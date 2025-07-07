import { App } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { TimeLogEntry, ActiveTimerState } from './model.js';
import moment from 'moment';

const TIME_LOGS_FILE = '.obsidian/plugins/obsidian-dovela-personal-management/timelogs.json';
const INTERRUPTED_SESSION_KEY = 'dovela-interrupted-timer';

export class TimeTrackerService {
    app: App;
    plugin: DovelaPersonalManagementPlugin;

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    async loadTimeLogs(): Promise<TimeLogEntry[]> {
        try {
            const fileExists = await this.app.vault.adapter.exists(TIME_LOGS_FILE);
            if (!fileExists) {
                await this.saveTimeLogs([]);
                return [];
            }
            const content = await this.app.vault.adapter.read(TIME_LOGS_FILE);
            return JSON.parse(content);
        } catch (error) {
            console.error('Dovela PM: Error loading time logs', error);
            return [];
        }
    }

    async saveTimeLogs(logs: TimeLogEntry[]): Promise<void> {
        try {
            const content = JSON.stringify(logs, null, 2);
            await this.app.vault.adapter.write(TIME_LOGS_FILE, content);
        } catch (error) {
            console.error('Dovela PM: Error saving time logs', error);
        }
    }

    async addLogEntry(entryData: Omit<TimeLogEntry, 'id'>): Promise<void> {
        const logs = await this.loadTimeLogs();
        const newEntry: TimeLogEntry = {
            id: Date.now().toString(),
            ...entryData
        };
        logs.push(newEntry);
        await this.saveTimeLogs(logs);
    }

    getStatistics(logs: TimeLogEntry[], filters: { startDate?: moment.Moment, endDate?: moment.Moment }): Map<string, number> {
        const stats = new Map<string, number>();
        
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
        await this.plugin.saveData({ [INTERRUPTED_SESSION_KEY]: timer });
    }

    async loadInterruptedSession(): Promise<ActiveTimerState | null> {
        const data = await this.plugin.loadData();
        return data?.[INTERRUPTED_SESSION_KEY] || null;
    }

    async clearInterruptedSession(): Promise<void> {
        const data = await this.plugin.loadData();
        if (data && data[INTERRUPTED_SESSION_KEY]) {
            delete data[INTERRUPTED_SESSION_KEY];
            await this.plugin.saveData(data);
        }
    }
}
