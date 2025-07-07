
import { Plugin, Notice } from 'obsidian';
import { GtdView, GTD_VIEW_TYPE, GTD_VIEW_DISPLAY_TEXT, GTD_VIEW_ICON } from './modules/moduloGTDv3/view.js';
import { TimeTrackerService } from './modules/moduloGTDv3/timeTrackerService.js';
import type { ActiveTimerState } from './modules/moduloGTDv3/model.js';

export default class DovelaPersonalManagementPlugin extends Plugin {
    public activeTimer: ActiveTimerState | null = null;
    public timeTrackerService!: TimeTrackerService;
    public statusBarItem!: HTMLElement;

    override async onload() {
        console.log('Loading Dovela Personal Management Plugin...');
        
        this.timeTrackerService = new TimeTrackerService(this);
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.style.display = 'none';

        this.handleInterruptedSession();

        this.registerView(
            GTD_VIEW_TYPE,
            (leaf) => new GtdView(leaf, this)
        );

        this.addCommand({
            id: 'open-gtd-dashboard',
            name: 'Open GTD Dashboard',
            callback: () => {
                this.activateView();
            }
        });

        this.addRibbonIcon(GTD_VIEW_ICON, GTD_VIEW_DISPLAY_TEXT, () => {
            this.activateView();
        });
    }

    override onunload() {
        console.log('Unloading Dovela Personal Management Plugin...');
        if (this.activeTimer) {
            this.timeTrackerService.saveInterruptedSession(this.activeTimer);
        }
        this.app.workspace.detachLeavesOfType(GTD_VIEW_TYPE);
    }

    private async activateView(): Promise<void> {
        this.app.workspace.detachLeavesOfType(GTD_VIEW_TYPE);
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.setViewState({
            type: GTD_VIEW_TYPE,
            active: true,
        });
        this.app.workspace.revealLeaf(leaf);
    }

    private async handleInterruptedSession() {
        const interruptedSession = await this.timeTrackerService.loadInterruptedSession();
        if (interruptedSession) {
            const notice = new Notice('Dovela: Sesión de tiempo interrumpida encontrada.', 0);
            const buttonContainer = notice.noticeEl.createDiv({ cls: 'dovela-notice-buttons' });
            
            const saveButton = buttonContainer.createEl('button', { text: 'Guardar' });
            saveButton.onclick = async () => {
                const endTime = new Date();
                const startTime = new Date(interruptedSession.startTime);
                const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

                if (durationMinutes > 0) {
                    await this.timeTrackerService.addLogEntry({
                        taskNotePath: interruptedSession.taskNotePath,
                        startTime: interruptedSession.startTime,
                        endTime: endTime.toISOString(),
                        durationMinutes: durationMinutes,
                        notes: 'Sesión recuperada automáticamente.',
                        taskDescription: interruptedSession.taskDescription || ''
                    });
                }
                await this.timeTrackerService.clearInterruptedSession();
                notice.hide();
                new Notice('Dovela: Sesión de tiempo guardada.');
            };

            const discardButton = buttonContainer.createEl('button', { text: 'Descartar' });
            discardButton.onclick = async () => {
                await this.timeTrackerService.clearInterruptedSession();
                notice.hide();
                new Notice('Dovela: Sesión de tiempo descartada.');
            };
        }
    }

    public updateStatusBar(text: string) {
        if (text) {
            this.statusBarItem.setText(`⏱️ ${text}`);
            this.statusBarItem.style.display = 'block';
        } else {
            this.statusBarItem.style.display = 'none';
        }
    }
}
