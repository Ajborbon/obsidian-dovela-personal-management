
import { Plugin, Notice, WorkspaceLeaf, TFile, TAbstractFile } from 'obsidian';
import { GtdView, GTD_VIEW_TYPE, GTD_VIEW_DISPLAY_TEXT, GTD_VIEW_ICON } from './modules/moduloGTDv3/view.js';
import { FocoView, FOCO_VIEW_TYPE, FOCO_VIEW_ICON } from './modules/moduloFoco/focoView.js';
import { ActivityView, ACTIVITY_VIEW_TYPE, ACTIVITY_VIEW_DISPLAY_TEXT, ACTIVITY_VIEW_ICON } from './modules/moduloActividad/activityView.js';
import { TimeTrackerService } from './modules/moduloGTDv3/timeTrackerService.js';
import { AnalyzerService } from './modules/moduloActividad/analyzerService.js';
import { TimeLogModal } from './modules/moduloGTDv3/timeLogModal.js';
import type { ActiveTimerState, Task, DovelaPluginData } from './modules/moduloGTDv3/model.js';
import { DEFAULT_SETTINGS } from './modules/moduloGTDv3/model.js';
import { parseVault } from './modules/moduloGTDv3/parser.js';
import moment from 'moment';
import { SmartInboxView } from './modules/moduloGTDv3/smartInboxView.js';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

export default class DovelaPersonalManagementPlugin extends Plugin {
    public data!: DovelaPluginData;
    public activeTimer: ActiveTimerState | null = null;
    public timeTrackerService!: TimeTrackerService;
    public analyzerService!: AnalyzerService;
    public statusBarItem!: HTMLElement;
    private activeTimerInterval: number | null = null;
    private syncInterval: number | null = null;
    public availableTasks: (TFile | Task)[] = [];

    // Metadata cache
    public gtdProjectsAndAreas: TFile[] = [];
    public gtdContextTags: string[] = [];
    public gtdPersonTags: string[] = [];

    private smartInboxView: SmartInboxView | null = null;

    override async onload() {
        console.log('Loading Dovela Personal Management Plugin...');
        
        await this.loadPluginData();

        this.timeTrackerService = new TimeTrackerService(this);
        this.analyzerService = new AnalyzerService(this);
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.style.display = 'none';

        // Sync active timer from data.json on load
        if (this.data.activeTimer) {
            console.log("Dovela PM Sync: Active timer found on load. Initializing.");
            this.initializeTimerFromState(this.data.activeTimer);
        }

        await this.loadAvailableTasks();
        await this.collectMetadata();

        // Re-scan for metadata on file changes
        this.registerEvent(this.app.vault.on('modify', (file) => this.handleFileChange(file)));
        this.registerEvent(this.app.vault.on('rename', () => this.collectMetadata()));
        this.registerEvent(this.app.vault.on('delete', () => this.collectMetadata()));


        this.registerView(
            GTD_VIEW_TYPE,
            (leaf) => new GtdView(leaf, this)
        );

        this.registerView(
            FOCO_VIEW_TYPE,
            (leaf) => new FocoView(leaf, this, null) // Initially null, will be set on activation
        );

        this.registerView(
            ACTIVITY_VIEW_TYPE,
            (leaf) => new ActivityView(leaf, this)
        );

        this.addCommand({
            id: 'open-gtd-dashboard',
            name: 'Open GTD Dashboard',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'open-focus-view',
            name: 'Dovela: Mostrar Vista de Foco del Proyecto',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        this.activateFocoView(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'open-activity-panel',
            name: 'Panel de Actividad: Mostrar resumen de actividad',
            callback: () => {
                this.activateActivityView();
            }
        });

        this.addCommand({
            id: 'smart-inbox',
            name: 'Smart Inbox',
            callback: () => {
                this.openSmartInbox();
            }
        });

        this.addCommand({
            id: 'time-tracker-start-for-active-note',
            name: 'Control de Tiempo: Iniciar temporizador para la nota activa',
            checkCallback: (checking: boolean) => {
                // Conditions to meet for the command to be available
                const activeFile = this.app.workspace.getActiveFile();
                const isTimerRunning = !!this.activeTimer;

                if (activeFile && !isTimerRunning) {
                    if (!checking) {
                        // Execute the command's logic
                        const taskNotePath = activeFile.path;
                        const taskDescription = activeFile.basename.replace('.md', '');
                        this.startTracking(taskNotePath, taskDescription);
                        new Notice(`Temporizador iniciado para: ${taskDescription}`);
                    }
                    return true; // Command is valid
                }
                return false; // Command is not valid
            }
        });

        this.addRibbonIcon('plus-circle', 'Captura Rápida (Smart Inbox)', () => {
            this.openSmartInbox();
        });

        this.addRibbonIcon('play-circle', 'Control de Tiempo: Iniciar temporizador para la nota activa', () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (this.activeTimer) {
                new Notice('Ya hay un temporizador en curso.');
                return;
            }
            if (!activeFile) {
                new Notice('Por favor, abra una nota para iniciar el temporizador.');
                return;
            }
            
            const taskNotePath = activeFile.path;
            const taskDescription = activeFile.basename.replace('.md', '');
            this.startTracking(taskNotePath, taskDescription);
            new Notice(`Temporizador iniciado para: ${taskDescription}`);
        });
        
        this.addRibbonIcon(GTD_VIEW_ICON, GTD_VIEW_DISPLAY_TEXT, () => {
            this.activateView();
        });

        this.addRibbonIcon(FOCO_VIEW_ICON, 'Abrir Vista de Foco', () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                this.activateFocoView(activeFile);
            } else {
                new Notice('Por favor, abra o seleccione una nota para usar la Vista de Foco.');
            }
        });

        this.addRibbonIcon(ACTIVITY_VIEW_ICON, ACTIVITY_VIEW_DISPLAY_TEXT, () => {
            this.activateActivityView();
        });

        // Start the sync poller now that the plugin is fully loaded
        this.startSyncInterval();
    }

    override onunload() {
        console.log('Unloading Dovela Personal Management Plugin...');
        this.stopSyncInterval(); // Use the dedicated stop function
        if (this.activeTimerInterval) clearInterval(this.activeTimerInterval);
        this.app.workspace.detachLeavesOfType(GTD_VIEW_TYPE);
        this.smartInboxView?.remove();
    }

    async loadPluginData() {
        this.data = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    
        // --- ONE-TIME MIGRATION SCRIPT ---
        const oldTimeLogsFile = `${this.manifest.dir}/timelogs.json`;
        if (await this.app.vault.adapter.exists(oldTimeLogsFile)) {
            try {
                const oldLogsContent = await this.app.vault.adapter.read(oldTimeLogsFile);
                const oldLogs = JSON.parse(oldLogsContent);
                if (Array.isArray(oldLogs) && oldLogs.length > 0) {
                    // Merge logs, preventing duplicates just in case
                    const existingLogIds = new Set(this.data.timeLogs.map(log => log.id));
                    const logsToMigrate = oldLogs.filter(log => !existingLogIds.has(log.id));
                    this.data.timeLogs.push(...logsToMigrate);
                    await this.savePluginData();
                }
                // Remove the old file so the migration doesn't run again
                await this.app.vault.adapter.remove(oldTimeLogsFile);
                new Notice('Dovela PM: Registros de tiempo migrados al nuevo formato.');
                console.log('Dovela PM: Migration from timelogs.json completed successfully.');
            } catch (error) {
                new Notice('Dovela PM: Error al migrar los registros de tiempo. Revisa la consola.');
                console.error('Dovela PM: Failed to migrate timelogs.json', error);
            }
        }
    }

    async savePluginData() {
        await this.saveData(this.data);
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

    private async activateFocoView(activeFile: TFile): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(FOCO_VIEW_TYPE);
        let leaf: WorkspaceLeaf | undefined = leaves.find(l => (l.view as FocoView).getDisplayText().includes(activeFile.basename));

        if (!leaf) {
            leaf = this.app.workspace.getLeaf('tab');
            if (!leaf) {
                new Notice('No se pudo crear una nueva pestaña');
                return;
            }
            await leaf.setViewState({
                type: FOCO_VIEW_TYPE,
                active: true,
                state: { activeFile: activeFile.path } // Pass file path to the view state
            });
            (leaf.view as FocoView)['activeFile'] = activeFile; // Directly set the active file
            await (leaf.view as FocoView).onOpen(); // Manually trigger onOpen to render with the file
        }
        
        this.app.workspace.revealLeaf(leaf);
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

    private async activateActivityView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(ACTIVITY_VIEW_TYPE);
        if (leaves.length > 0) {
            this.app.workspace.revealLeaf(leaves[0]);
            return;
        }
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.setViewState({
            type: ACTIVITY_VIEW_TYPE,
            active: true,
        });
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

    public async startTracking(taskNotePath: string, taskDescription: string, lineNumber?: number) {
        if (this.activeTimer) return;

        const newTimerState: ActiveTimerState = {
            taskNotePath: taskNotePath,
            startTime: moment().local().toISOString(true),
            taskDescription: taskDescription,
            ...(lineNumber !== undefined && { lineNumber })
        };
        
        // Persist the new state to trigger sync
        this.data.activeTimer = newTimerState;
        await this.savePluginData();

        // Initialize the timer locally using the single, centralized function
        this.initializeTimerFromState(newTimerState);
    }

    public async stopTracking() {
        if (!this.activeTimer || this.activeTimerInterval === null) return;

        // Stop the local UI timer immediately, but keep the state in memory for the modal
        clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = null;
        
        const endTime = moment().local();
        const startTime = moment(this.activeTimer.startTime);
        const currentTimer = this.activeTimer;

        new TimeLogModal(this.app, this.timeTrackerService, this, async () => {
            // This onSave callback runs AFTER the user saves the log in the modal.
            
            // 1. Clear the active timer state from memory and stop sync
            this.clearActiveTimer();
            
            // 2. Clear the active timer from persistent data
            this.data.activeTimer = undefined;
            await this.savePluginData();

            // 3. Refresh statistics in all open views
            const allGtdViews = this.app.workspace.getLeavesOfType(GTD_VIEW_TYPE);
            allGtdViews.forEach(leaf => {
                const view = leaf.view as GtdView;
                if (view instanceof GtdView && 'refreshStatistics' in view) {
                    view.refreshStatistics();
                }
            });
            const allFocoViews = this.app.workspace.getLeavesOfType(FOCO_VIEW_TYPE);
            allFocoViews.forEach(leaf => {
                const view = leaf.view as FocoView;
                 if (view instanceof FocoView && 'refreshStatistics' in view) {
                    view.refreshStatistics();
                }
            });

        }, {
            taskNotePath: currentTimer.taskNotePath,
            startTime: startTime.toISOString(true),
            endTime: endTime.toISOString(true),
            notes: currentTimer.taskDescription || '',
            taskDescription: currentTimer.taskDescription || ''
        }).open();
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

    private async handleFileChange(file: TAbstractFile) {
        // First, run the metadata collection on any change
        await this.collectMetadata();

        // We only care about file modifications, not folder modifications
        if (!(file instanceof TFile)) {
            return;
        }

        // Then, specifically handle data.json sync for immediate feedback
        if (file.path === `${this.manifest.dir}/data.json`) {
            console.log("Dovela PM Sync: data.json modified. Checking for changes.");
            await this.syncTimerStateWithFile();
        }
    }

    private initializeTimerFromState(timerState: ActiveTimerState) {
        this.activeTimer = timerState;
        const taskName = this.activeTimer.taskNotePath.split('/').pop()?.replace('.md', '') || 'Tarea';
        const startTimeMoment = moment(this.activeTimer.startTime);
    
        // Clear any existing interval before starting a new one
        if (this.activeTimerInterval) clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = window.setInterval(() => {
            const now = moment().local();
            const diff = now.diff(startTimeMoment);
            const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            this.updateStatusBar(`${taskName}... ${hours}:${minutes}:${seconds}`);
        }, 1000);
    
        this.updateStatusBar(`${taskName}...`);
        this.refreshAllTimerViews();
    }

    private clearActiveTimer() {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
        this.activeTimer = null;
        this.updateStatusBar('');
        this.refreshAllTimerViews();
    }

    private async syncTimerStateWithFile() {
        try {
            const previousTimerStateInMemory = this.activeTimer;
            
            // Important: We read the data directly, not using loadPluginData to avoid side effects
            const fileContent = await this.app.vault.adapter.read(`${this.manifest.dir}/data.json`);
            const dataFromDisk = JSON.parse(fileContent) as DovelaPluginData;
            const newTimerStateFromDisk = dataFromDisk.activeTimer;

            const wasRunning = !!previousTimerStateInMemory;
            const isRunning = !!newTimerStateFromDisk;

            if (wasRunning && !isRunning) {
                // Case 1: Timer was stopped on another device.
                console.log("Dovela PM Sync: Timer stopped remotely. Updating UI.");
                this.clearActiveTimer();
            } else if (!wasRunning && isRunning) {
                // Case 2: Timer was started on another device.
                console.log("Dovela PM Sync: Timer started remotely. Updating UI.");
                this.initializeTimerFromState(newTimerStateFromDisk!);
            }
            // Case 3 (wasRunning && isRunning) and Case 4 (!wasRunning && !isRunning) require no action.
        } catch (error) {
            console.error("Dovela PM Sync: Error during file sync check. It's possible the file was being written by another process. This is usually safe to ignore.", error);
        }
    }

    private startSyncInterval() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        console.log("Dovela PM Sync: Starting sync interval (15s).");
        this.syncInterval = window.setInterval(() => this.syncTimerStateWithFile(), 15000);
    }

    private stopSyncInterval() {
        if (this.syncInterval) {
            console.log("Dovela PM Sync: Stopping sync interval.");
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    private refreshAllTimerViews() {
        const allGtdViews = this.app.workspace.getLeavesOfType(GTD_VIEW_TYPE);
        allGtdViews.forEach(leaf => {
            const view = leaf.view as GtdView;
            if (view.timeTrackerView && typeof view.timeTrackerView.refreshTimerUI === 'function') {
                view.timeTrackerView.refreshTimerUI();
            }
        });

        const allFocoViews = this.app.workspace.getLeavesOfType(FOCO_VIEW_TYPE);
        allFocoViews.forEach(leaf => {
            const view = leaf.view as FocoView;
            if (view.timeTrackerView && typeof view.timeTrackerView.refreshTimerUI === 'function') {
                view.timeTrackerView.refreshTimerUI();
            }
        });
    }
}
