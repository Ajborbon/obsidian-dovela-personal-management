import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main';
import type { AnalyzerService, TaskDetail } from './analyzerService';
import moment from 'moment';

export const ACTIVITY_VIEW_TYPE = 'dovela-activity-view';
export const ACTIVITY_VIEW_DISPLAY_TEXT = 'Panel de Actividad';
export const ACTIVITY_VIEW_ICON = 'activity';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type Screen = 'dashboard' | 'notesCreated' | 'notesModified' | 'tasksCompleted' | 'tasksCaptured';

export class ActivityView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private analyzerService: AnalyzerService;

    private currentScreen: Screen = 'dashboard';
    private activePeriod: Period = 'week';
    private customStartDate: moment.Moment | null = null;
    private customEndDate: moment.Moment | null = null;
    private detailData: TFile[] | TaskDetail[] = [];
    private detailTitle: string = '';

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.analyzerService = plugin.analyzerService;
    }

    getViewType(): string {
        return ACTIVITY_VIEW_TYPE;
    }

    getDisplayText(): string {
        return ACTIVITY_VIEW_DISPLAY_TEXT;
    }

    getIcon(): string {
        return ACTIVITY_VIEW_ICON;
    }

    async onOpen() {
        this.analyzerService.clearCache();
        this.render();
    }

    async onClose() {
        // Cleanup
    }

    async render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('dovela-activity-view');

        switch (this.currentScreen) {
            case 'dashboard':
                await this.renderDashboard(container);
                break;
            default:
                this.renderDetailView(container);
                break;
        }
    }

    private async renderDashboard(container: Element) {
        let title = 'Panel de Actividad';
        if (this.activePeriod === 'custom' && (this.customStartDate || this.customEndDate)) {
            const start = this.customStartDate ? this.customStartDate.format('YYYY-MM-DD') : '...';
            const end = this.customEndDate ? this.customEndDate.format('YYYY-MM-DD') : '...';
            title = `Actividad: ${start} a ${end}`;
        }
        container.createEl('h2', { text: title });

        this.renderFilterControls(container);

        const metrics = await this.analyzerService.getMetricsForPeriod(this.activePeriod, this.customStartDate, this.customEndDate);
        const dashboardGrid = container.createDiv({ cls: 'activity-dashboard-grid' });

        const periodText = this.getPeriodText();

        const taskCard = this.createMetricCard(dashboardGrid, '📊 Balance de Tareas');
        this.createMetric(taskCard, 'Tareas Capturadas (vía Smart Inbox)', metrics.tasksCaptured.length.toString(), () => {
            this.detailTitle = `Tareas Capturadas (${periodText})`;
            this.detailData = metrics.tasksCaptured;
            this.currentScreen = 'tasksCaptured';
            this.render();
        });
        this.createMetric(taskCard, 'Tareas Completadas', metrics.tasksCompleted.length.toString(), () => {
            this.detailTitle = `Tareas Completadas (${periodText})`;
            this.detailData = metrics.tasksCompleted;
            this.currentScreen = 'tasksCompleted';
            this.render();
        });
        const balance = metrics.tasksCompleted.length - metrics.tasksCaptured.length;
        this.createMetric(taskCard, 'Balance Neto', `${balance >= 0 ? '+' : ''}${balance}`, undefined, balance > 0 ? 'positive' : (balance < 0 ? 'negative' : 'neutral'));

        const noteCard = this.createMetricCard(dashboardGrid, '📝 Actividad de Notas');
        this.createMetric(noteCard, 'Nuevas Notas Creadas', metrics.notesCreated.length.toString(), () => {
            this.detailTitle = `Notas Creadas (${periodText})`;
            this.detailData = metrics.notesCreated;
            this.currentScreen = 'notesCreated';
            this.render();
        });
        this.createMetric(noteCard, 'Notas Modificadas', metrics.notesModified.length.toString(), () => {
            this.detailTitle = `Notas Modificadas (${periodText})`;
            this.detailData = metrics.notesModified;
            this.currentScreen = 'notesModified';
            this.render();
        });
    }

    private renderFilterControls(container: Element) {
        const filterContainer = container.createDiv({ cls: 'activity-filter-container' });
        const periods: { key: Period, text: string }[] = [
            { key: 'today', text: 'Hoy' },
            { key: 'yesterday', text: 'Ayer' },
            { key: 'week', text: 'Esta Semana' },
            { key: 'month', text: 'Este Mes' },
            { key: 'custom', text: 'Personalizado' },
        ];
        
        const customFilterEl = container.createDiv({ cls: 'custom-filter-controls is-hidden' });

        const buttons: HTMLButtonElement[] = [];
        periods.forEach(period => {
            const button = filterContainer.createEl('button', {
                text: period.text,
                cls: 'activity-period-button'
            });
            if (this.activePeriod === period.key) {
                button.addClass('is-active');
            }
            
            button.onClickEvent(async () => {
                this.activePeriod = period.key;
                
                // Update active class on buttons
                buttons.forEach(btn => btn.removeClass('is-active'));
                button.addClass('is-active');

                if (period.key !== 'custom') {
                    customFilterEl.addClass('is-hidden');
                    this.analyzerService.clearCache();
                    this.render();
                } else {
                    customFilterEl.removeClass('is-hidden');
                }
            });
            buttons.push(button);
        });

        // --- Custom Date Controls ---
        const startDateInput = customFilterEl.createEl('input', { type: 'date' });
        if (this.customStartDate) startDateInput.value = this.customStartDate.format('YYYY-MM-DD');
        
        const endDateInput = customFilterEl.createEl('input', { type: 'date' });
        if (this.customEndDate) endDateInput.value = this.customEndDate.format('YYYY-MM-DD');

        const applyButton = customFilterEl.createEl('button', { text: 'Aplicar' });
        applyButton.onClickEvent(() => {
            this.customStartDate = startDateInput.value ? moment(startDateInput.value) : null;
            this.customEndDate = endDateInput.value ? moment(endDateInput.value) : null;
            this.analyzerService.clearCache();
            this.render();
        });
        
        if (this.activePeriod === 'custom') {
            customFilterEl.removeClass('is-hidden');
        }
    }

    private getPeriodText(): string {
        if (this.activePeriod === 'custom') {
            if (this.customStartDate && this.customEndDate) {
                return `${this.customStartDate.format('DD/MM')} - ${this.customEndDate.format('DD/MM')}`;
            }
            return 'Personalizado';
        }
        const periodMap: Record<Period, string> = {
            today: 'Hoy',
            yesterday: 'Ayer',
            week: 'Esta Semana',
            month: 'Este Mes',
            custom: 'Personalizado'
        };
        return periodMap[this.activePeriod];
    }

    private createMetricCard(parent: HTMLElement, title: string): HTMLElement {
        const card = parent.createDiv({ cls: 'activity-card' });
        card.createEl('h4', { text: title });
        return card;
    }

    private createMetric(card: HTMLElement, label: string, value: string, onClick?: () => void, valueClass?: string) {
        const metricEl = card.createDiv({ cls: 'activity-metric' });
        if (onClick && value !== '0') {
            metricEl.addClass('is-clickable');
            metricEl.onClickEvent(onClick);
        }
        metricEl.createEl('div', { text: label, cls: 'metric-label' });
        metricEl.createEl('div', { text: value, cls: `metric-value ${valueClass || ''}` });
    }

    private renderDetailView(container: Element) {
        this.renderDetailHeader(container, this.detailTitle);

        if (this.detailData.length === 0) {
            container.createEl('p', { text: 'No hay datos para mostrar en este período.' });
            return;
        }

        if (this.currentScreen === 'notesCreated' || this.currentScreen === 'notesModified') {
            this.renderNoteDetailList(container, this.detailData as TFile[]);
        } else {
            this.renderTaskDetailList(container, this.detailData as TaskDetail[]);
        }
    }

    private renderNoteDetailList(container: Element, files: TFile[]) {
        const list = container.createEl('ul', { cls: 'activity-detail-list' });
        files.sort((a, b) => b.stat.mtime - a.stat.mtime);
        
        files.forEach(file => {
            const item = list.createEl('li');
            const link = item.createEl('a', { text: file.basename.replace('.md', '') });
            link.onClickEvent(() => this.plugin.app.workspace.openLinkText(file.path, '', true));
            const context = item.createEl('span', { cls: 'detail-context' });
            context.setText(`(Modificado: ${moment(file.stat.mtime).format('YYYY-MM-DD HH:mm')})`);
            if (file.parent && file.parent.path !== '/') {
                context.appendText(` (en ${file.parent.path})`);
            }
        });
    }

    private renderTaskDetailList(container: Element, tasks: TaskDetail[]) {
        const list = container.createEl('ul', { cls: 'activity-detail-list' });
        tasks.sort((a, b) => b.date.localeCompare(a.date));

        tasks.forEach(task => {
            const item = list.createEl('li');
            item.createEl('span', { text: `[x] ${task.content}` });
            const context = item.createEl('span', { cls: 'detail-context' });
            context.setText(`(${task.date} en `);
            const link = context.createEl('a', { text: task.sourceFile.basename.replace('.md', '') });
            link.onClickEvent(() => this.plugin.app.workspace.openLinkText(task.sourceFile.path, '', true));
            context.appendText(')');
        });
    }

    private renderDetailHeader(container: Element, title: string) {
        const header = container.createDiv({ cls: 'activity-detail-header' });
        const backButton = header.createEl('button', { text: '← Volver al Panel' });
        backButton.onClickEvent(() => {
            this.currentScreen = 'dashboard';
            this.render();
        });
        header.createEl('h3', { text: title });
    }
}
