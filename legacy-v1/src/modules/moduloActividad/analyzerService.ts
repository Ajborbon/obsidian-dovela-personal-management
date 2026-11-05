import type { TFile } from 'obsidian';
import moment from 'moment';
import type DovelaPersonalManagementPlugin from '../../main.js';

// --- Data Structures for the results ---

export interface TaskDetail {
    content: string;
    date: string;
    sourceFile: TFile;
}

export interface ActivityMetrics {
    notesCreated: TFile[];
    notesModified: TFile[];
    tasksCompleted: TaskDetail[];
    tasksCaptured: TaskDetail[];
}

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export class AnalyzerService {
    private plugin: DovelaPersonalManagementPlugin;
    private cache: Map<string, ActivityMetrics> = new Map();

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
    }

    public async getMetricsForPeriod(period: Period, customStart?: moment.Moment, customEnd?: moment.Moment): Promise<ActivityMetrics> {
        const cacheKey = period === 'custom' ? `custom-${customStart?.format()}-${customEnd?.format()}` : period;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const { start, end } = this.getDateRange(period, customStart, customEnd);
        
        const noteActivity = this.calculateNoteActivity(start, end);
        const taskActivity = await this.calculateTaskActivity(start, end);

        const metrics: ActivityMetrics = {
            notesCreated: noteActivity.created,
            notesModified: noteActivity.modified,
            tasksCompleted: taskActivity.completed,
            tasksCaptured: taskActivity.captured,
        };

        this.cache.set(cacheKey, metrics);
        return metrics;
    }

    public clearCache() {
        this.cache.clear();
    }

    private getDateRange(period: Period, customStart?: moment.Moment, customEnd?: moment.Moment): { start: moment.Moment, end: moment.Moment } {
        if (period === 'custom') {
            return { start: customStart || moment().subtract(10, 'years'), end: customEnd || moment() };
        }
        
        const momentPeriod = period === 'today' ? 'day' : (period === 'yesterday' ? 'day' : (period === 'week' ? 'isoWeek' : period));
        let start = moment().startOf(momentPeriod);
        let end = moment().endOf(momentPeriod);

        if (period === 'yesterday') {
            start.subtract(1, 'day');
            end.subtract(1, 'day');
        } else if (period !== 'today') {
            // For week and month, we want to end at the current moment, not the end of the period
            end = moment();
        }

        return { start, end };
    }

    private calculateNoteActivity(start: moment.Moment, end: moment.Moment): { created: TFile[], modified: TFile[] } {
        const files = this.plugin.app.vault.getMarkdownFiles();
        const created: TFile[] = [];
        const modified: TFile[] = [];

        for (const file of files) {
            const ctime = moment(file.stat.ctime);
            const mtime = moment(file.stat.mtime);

            if (ctime.isBetween(start, end, undefined, '[]')) {
                created.push(file);
            }
            if (mtime.isBetween(start, end, undefined, '[]')) {
                modified.push(file);
            }
        }
        return { created, modified };
    }

    private async calculateTaskActivity(start: moment.Moment, end: moment.Moment): Promise<{ completed: TaskDetail[], captured: TaskDetail[] }> {
        const files = this.plugin.app.vault.getMarkdownFiles();
        const completed: TaskDetail[] = [];
        const captured: TaskDetail[] = [];

        const completedRegex = /^(.*?)✅ (\d{4}-\d{2}-\d{2})/gm;
        const capturedRegex = /^(.*?)➕ (\d{4}-\d{2}-\d{2})/gm;

        for (const file of files) {
            const content = await this.plugin.app.vault.cachedRead(file);
            
            let match;
            // Find completed tasks
            while ((match = completedRegex.exec(content)) !== null) {
                if (match[2]) {
                    const date = moment(match[2]);
                    if (date.isBetween(start, end, undefined, '[]')) {
                        completed.push({
                            content: (match[1] || '').trim(),
                            date: match[2],
                            sourceFile: file,
                        });
                    }
                }
            }

            // Find captured tasks
            while ((match = capturedRegex.exec(content)) !== null) {
                if (match[2]) {
                    const date = moment(match[2]);
                    if (date.isBetween(start, end, undefined, '[]')) {
                        captured.push({
                            content: (match[1] || '').trim(),
                            date: match[2],
                            sourceFile: file,
                        });
                    }
                }
            }
        }
        return { completed, captured };
    }
}
