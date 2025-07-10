
import { Plugin, Notice, WorkspaceLeaf, TFile } from 'obsidian';
import { GtdView, GTD_VIEW_TYPE, GTD_VIEW_DISPLAY_TEXT, GTD_VIEW_ICON } from './modules/moduloGTDv3/view.js';
import { TimeTrackerService } from './modules/moduloGTDv3/timeTrackerService.js';
import { TimeLogModal } from './modules/moduloGTDv3/timeLogModal.js';
import type { ActiveTimerState, Task } from './modules/moduloGTDv3/model.js';
import { parseVault } from './modules/moduloGTDv3/parser.js';
import moment from 'moment';
import { SmartInboxView } from './modules/moduloGTDv3/smartInboxView.js';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

export default class DovelaPersonalManagementPlugin extends Plugin {
    public activeTimer: ActiveTimerState | null = null;
    public timeTrackerService!: TimeTrackerService;
    public statusBarItem!: HTMLElement;
    private activeTimerInterval: number | null = null;
    public availableTasks: (TFile | Task)[] = [];

    // Metadata cache
    public gtdProjectsAndAreas: TFile[] = [];
    public gtdContextTags: string[] = [];
    public gtdPersonTags: string[] = [];

    private smartInboxView: SmartInboxView | null = null;

    override async onload() {
        console.log('Loading Dovela Personal Management Plugin...');
        
        this.timeTrackerService = new TimeTrackerService(this);
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.style.display = 'none';

        await this.loadAvailableTasks();
        await this.collectMetadata();
        this.handleInterruptedSession();

        // Re-scan for metadata on file changes
        this.registerEvent(this.app.vault.on('modify', () => this.collectMetadata()));
        this.registerEvent(this.app.vault.on('rename', () => this.collectMetadata()));
        this.registerEvent(this.app.vault.on('delete', () => this.collectMetadata()));


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

        this.addCommand({
            id: 'smart-inbox',
            name: 'Smart Inbox',
            callback: () => {
                this.openSmartInbox();
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
        this.smartInboxView?.remove();
    }

    private openSmartInbox(): void {
        if (!this.smartInboxView) {
            this.smartInboxView = new SmartInboxView(this);
        }
        this.smartInboxView.open();
    }

    public async collectMetadata(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles();
        const projectAndAreaPrefixes = ['PGTD -', 'AV -', 'AI -'];
        this.gtdProjectsAndAreas = files.filter(file => 
            projectAndAreaPrefixes.some(prefix => file.basename.startsWith(prefix))
        );

        const allTagsObject: Record<string, number> = {};
        this.app.vault.getMarkdownFiles().forEach(file => {
            const fileCache = this.app.metadataCache.getFileCache(file);
            fileCache?.tags?.forEach(tag => {
                const tagName = tag.tag;
                allTagsObject[tagName] = (allTagsObject[tagName] || 0) + 1;
            });
        });
        const allTags = Object.keys(allTagsObject);

        this.gtdContextTags = allTags.filter(tag => tag.startsWith('#cx-'));
        this.gtdPersonTags = allTags.filter(tag => tag.startsWith('#px-'));
    }

    private async activateView(switchToTimeTracker: boolean = false): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(GTD_VIEW_TYPE);
        let leaf: WorkspaceLeaf;

        if (leaves.length === 0) {
            const newLeaf = this.app.workspace.getLeaf('tab');
            if (!newLeaf) {
                new Notice('No se pudo crear una nueva pestaña');
                return;
            }
            leaf = newLeaf;
            await leaf.setViewState({
                type: GTD_VIEW_TYPE,
                active: true,
            });
        } else {
            leaf = leaves[0]!;
        }

        this.app.workspace.revealLeaf(leaf);

        const view = leaf.view as GtdView;
        if (switchToTimeTracker && view instanceof GtdView) {
            view.switchToTimeTrackerView();
        }
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
        if (!this.statusBarItem) return;

        if (text) {
            this.statusBarItem.setText(`⏱️ ${text}`);
            this.statusBarItem.style.display = 'block';
            this.statusBarItem.onclick = () => {
                this.activateView(true);
            };
        } else {
            this.statusBarItem.style.display = 'none';
            this.statusBarItem.onclick = null;
        }
    }

    public startTracking(taskNotePath: string, taskDescription: string, lineNumber?: number) {
        if (this.activeTimer) return;

        this.activeTimer = {
            taskNotePath: taskNotePath,
            startTime: moment().local().toISOString(true),
            taskDescription: taskDescription,
            ...(lineNumber !== undefined && { lineNumber })
        };

        const taskName = taskNotePath.split('/').pop()?.replace('.md', '') || 'Tarea';
        this.updateStatusBar(`${taskName}...`);

        const startTimeMoment = moment(this.activeTimer.startTime);
        this.activeTimerInterval = window.setInterval(() => {
            const now = moment().local();
            const diff = now.diff(startTimeMoment);
            const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}:${seconds}`;
            this.updateStatusBar(`${taskName}... ${timeString}`);
        }, 1000);
    }

    public async stopTracking() {
        if (!this.activeTimer || this.activeTimerInterval === null) return;

        clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = null;

        const endTime = moment().local();
        const startTime = moment(this.activeTimer.startTime);
        const currentTimer = this.activeTimer;

        new TimeLogModal(this.app, this.timeTrackerService, this, async () => {
            const leaves = this.app.workspace.getLeavesOfType(GTD_VIEW_TYPE);
            if (leaves.length > 0) {
                const view = leaves[0]!.view as GtdView;
                if (view instanceof GtdView && 'refreshStatistics' in view) {
                    await view.refreshStatistics();
                }
            }
        }, {
            taskNotePath: currentTimer.taskNotePath,
            startTime: startTime.toISOString(true),
            endTime: endTime.toISOString(true),
            notes: currentTimer.taskDescription || '',
            taskDescription: currentTimer.taskDescription || ''
        }).open();

        this.activeTimer = null;
        this.updateStatusBar('');
    }

    public async loadAvailableTasks(source: TaskSource = 'all-tasks'): Promise<void> {
        const allTasks = (await parseVault(this.app.vault, this.app.metadataCache)).allTasks;

        switch (source) {
            case 'open-notes':
                this.availableTasks = this.app.workspace.getLeavesOfType('markdown').map(leaf => (leaf.view as any).file as TFile).filter(f => f);
                break;
            case 'in-progress':
                this.availableTasks = allTasks.filter((t: Task) => t.status === 'in-progress');
                break;
            case 'all-tasks':
                 this.availableTasks = allTasks.filter((t: Task) => t.status !== 'completed');
                break;
            default:
                this.availableTasks = [];
        }
    }
}
