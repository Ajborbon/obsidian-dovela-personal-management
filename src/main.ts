
import { Plugin, Notice, WorkspaceLeaf, TFile, TAbstractFile } from 'obsidian';
import { GtdView, GTD_VIEW_TYPE, GTD_VIEW_DISPLAY_TEXT, GTD_VIEW_ICON } from './modules/moduloGTDv3/view.js';
import { FocoView, FOCO_VIEW_TYPE, FOCO_VIEW_ICON } from './modules/moduloFoco/focoView.js';
import { ActivityView, ACTIVITY_VIEW_TYPE, ACTIVITY_VIEW_DISPLAY_TEXT, ACTIVITY_VIEW_ICON } from './modules/moduloActividad/activityView.js';
import { ReviewPanelView, REVIEW_PANEL_VIEW_TYPE, REVIEW_PANEL_DISPLAY_TEXT, REVIEW_PANEL_ICON } from './modules/moduloGTDv3/reviewPanelView.js';
import { TimeTrackerService } from './modules/moduloGTDv3/timeTrackerService.js';
import { TimeTrackerCommands } from './modules/moduloGTDv3/timeTrackerCommands.js';
import { StalledProjectService } from './modules/moduloGTDv3/stalledProjectService.js';
import { AnalyzerService } from './modules/moduloActividad/analyzerService.js';
import { TimeLogModal } from './modules/moduloGTDv3/timeLogModal.js';
import type { ActiveTimerState, Task, DovelaPluginData, TimeLogEntry } from './modules/moduloGTDv3/model.js';
import { DEFAULT_SETTINGS } from './modules/moduloGTDv3/model.js';
import { parseVault } from './modules/moduloGTDv3/parser.js';
import moment from 'moment';
import { SmartInboxView } from './modules/moduloGTDv3/smartInboxView.js';

type TaskSource = 'open-notes' | 'in-progress' | 'all-tasks';

export default class DovelaPersonalManagementPlugin extends Plugin {
    public data!: DovelaPluginData;
    public activeTimer: ActiveTimerState | null = null;
    public timeTrackerService!: TimeTrackerService;
    public timeTrackerCommands!: TimeTrackerCommands;
    public analyzerService!: AnalyzerService;
    public stalledProjectService!: StalledProjectService;
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
        this.timeTrackerCommands = new TimeTrackerCommands(this);
        this.analyzerService = new AnalyzerService(this);
        this.stalledProjectService = new StalledProjectService(this.app.vault, this.app.metadataCache, this.data);
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.style.display = 'none';

        // Sync active timer from data.json on load
        if (this.data.activeTimer) {
            console.log("Dovela PM Sync: Active timer found on load. Initializing.");
            this.initializeTimerFromState(this.data.activeTimer);
        }

        this.app.workspace.onLayoutReady(async () => {
            await this.loadAvailableTasks();
            await this.collectMetadata();
        });

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

        this.registerView(
            REVIEW_PANEL_VIEW_TYPE,
            (leaf) => new ReviewPanelView(leaf, this)
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
            id: 'open-gtd-review-panel',
            name: 'Revisión GTD: Encontrar proyectos estancados',
            callback: () => {
                this.activateReviewPanelView();
            }
        });

        this.addCommand({
            id: 'smart-inbox',
            name: 'Smart Inbox',
            callback: () => {
                this.openSmartInbox();
            }
        });

        // Registrar comandos del time tracker
        this.timeTrackerCommands.registerCommands();

        this.addRibbonIcon('plus-circle', 'Captura Rápida (Smart Inbox)', () => {
            this.openSmartInbox();
        });

        // Registrar ribbon icons del time tracker
        this.timeTrackerCommands.registerRibbonIcons();
        
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

        this.addRibbonIcon(REVIEW_PANEL_ICON, REVIEW_PANEL_DISPLAY_TEXT, () => {
            this.activateReviewPanelView();
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
                    const isTimeLogEntry = (obj: unknown): obj is TimeLogEntry => {
                        return typeof obj === 'object' && obj !== null && 'id' in (obj as any);
                    };
                    const existingLogIds = new Set<string>();
                    for (const item of this.data.timeLogs) {
                        if (isTimeLogEntry(item)) {
                            existingLogIds.add(item.id);
                        }
                    }
                    //VALIDAR AJBB
                    //const logsToMigrate = oldLogs.filter(isTimeLogEntry).filter(log => !existingLogIds.has(log.id));
                    //this.data.timeLogs.push(...(logsToMigrate as TimeLogEntry[]));
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
        
        // Refrescar configuración del Smart Inbox si está inicializado
        if (this.smartInboxView) {
            this.smartInboxView.refreshCascadeMenuConfig();
        }
    }

    private async activateFocoView(activeFile: TFile): Promise<void> {
        console.log('🔍 MAIN DEBUG: Iniciando activateFocoView');
        console.log('🔍 MAIN DEBUG: activeFile:', activeFile.path);
        console.log('🔍 MAIN DEBUG: activeFile.basename:', activeFile.basename);
        console.log('🔍 MAIN DEBUG: isMobile:', (this.app as any).isMobile || 'unknown');
        
        const leaves = this.app.workspace.getLeavesOfType(FOCO_VIEW_TYPE);
        console.log('🔍 MAIN DEBUG: Hojas existentes de tipo FOCO:', leaves.length);
        
        let leaf: WorkspaceLeaf | undefined = leaves.find(l => (l.view as FocoView).getDisplayText().includes(activeFile.basename));

        if (!leaf) {
            console.log('🔍 MAIN DEBUG: No se encontró hoja existente, creando nueva...');
            leaf = this.app.workspace.getLeaf('tab');
            if (!leaf) {
                console.error('🔍 MAIN DEBUG: No se pudo crear una nueva pestaña');
                new Notice('No se pudo crear una nueva pestaña');
                return;
            }
            console.log('🔍 MAIN DEBUG: Hoja creada, configurando view state...');
            await leaf.setViewState({
                type: FOCO_VIEW_TYPE,
                active: true,
                state: { activeFile: activeFile.path } // Pass file path to the view state
            });
            console.log('🔍 MAIN DEBUG: View state configurado, asignando activeFile...');
            (leaf.view as FocoView)['activeFile'] = activeFile; // Directly set the active file
            console.log('🔍 MAIN DEBUG: Llamando a onOpen manualmente...');
            await (leaf.view as FocoView).onOpen(); // Manually trigger onOpen to render with the file
            console.log('🔍 MAIN DEBUG: onOpen completado');
        } else {
            console.log('🔍 MAIN DEBUG: Hoja existente encontrada, reutilizando...');
        }
        
        console.log('🔍 MAIN DEBUG: Revelando hoja...');
        this.app.workspace.revealLeaf(leaf);
        console.log('🔍 MAIN DEBUG: activateFocoView completado');
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

    private async activateReviewPanelView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(REVIEW_PANEL_VIEW_TYPE);
        if (leaves.length > 0) {
            const leaf = leaves[0];
            if (leaf) {
                this.app.workspace.revealLeaf(leaf);
            }
            return;
        }
        const leaf = this.app.workspace.getLeaf('tab');
        if (leaf) {
            await leaf.setViewState({
                type: REVIEW_PANEL_VIEW_TYPE,
                active: true,
            });
        }
    }

    private async activateActivityView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(ACTIVITY_VIEW_TYPE);
        if (leaves.length > 0) {
            const leaf = leaves[0];
            if (leaf) {
                this.app.workspace.revealLeaf(leaf);
            }
            return;
        }
        const leaf = this.app.workspace.getLeaf('tab');
        if (leaf) {
            await leaf.setViewState({
                type: ACTIVITY_VIEW_TYPE,
                active: true,
            });
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

    public async startTracking(taskNotePath: string, taskDescription: string, lineNumber?: number) {
        if (this.activeTimer) return;

        const newTimerState: ActiveTimerState = {
            taskNotePath: taskNotePath,
            startTime: moment().local().toISOString(true),
            taskDescription: taskDescription,
            notes: '', // Initialize notes as empty
            ...(lineNumber !== undefined && { lineNumber })
        };
        
        // Persist the new state to trigger sync
        this.data.activeTimer = newTimerState;
        await this.savePluginData();

        // Initialize the timer locally using the single, centralized function
        this.initializeTimerFromState(newTimerState);
    }

    public async stopTracking() {
        if (!this.activeTimer) return;
    
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
    
        const currentTimer = this.activeTimer;
        const onSaveCallback = async (entryData: Partial<TimeLogEntry>) => {
            // This callback handles saving the completed log.
            if (entryData.id) { // This case is for editing existing logs, not stopping a timer.
                await this.timeTrackerService.updateLogEntry(entryData.id, entryData);
            } else {
                await this.timeTrackerService.addLogEntry(entryData as Omit<TimeLogEntry, 'id'>);
            }
    
            this.clearActiveTimer();
            this.data.activeTimer = undefined;
            await this.savePluginData();
    
            // Refresh views
            this.refreshAllGtdAndFocoViews();
        };
    
        new TimeLogModal(
            this.app,
            this,
            onSaveCallback,
            {
                taskNotePath: currentTimer.taskNotePath,
                startTime: currentTimer.startTime,
                endTime: moment().local().toISOString(true),
                notes: currentTimer.notes || '', // Pass the accumulated notes
                taskDescription: currentTimer.taskDescription || ''
            }
        ).open();
    }

    public async openEditActiveTimerModal() {
        if (!this.activeTimer) return;
    
        const onSaveCallback = async (updatedEntry: Partial<TimeLogEntry>) => {
            if (!this.activeTimer) return;
    
            // 1. Update the in-memory active timer
            this.activeTimer.startTime = updatedEntry.startTime || this.activeTimer.startTime;
            this.activeTimer.notes = updatedEntry.notes; // Update only notes
    
            // 2. Update the persisted active timer state
            this.data.activeTimer = this.activeTimer;
            await this.savePluginData();
    
            // 3. Re-initialize the status bar to reflect the changes immediately
            this.initializeTimerFromState(this.activeTimer);
            new Notice('Temporizador activo actualizado.');
        };
    
        new TimeLogModal(
            this.app,
            this,
            onSaveCallback,
            {
                taskNotePath: this.activeTimer.taskNotePath,
                taskDescription: this.activeTimer.taskDescription,
                startTime: this.activeTimer.startTime,
                notes: this.activeTimer.notes, // Pass current notes to the modal
            },
            true // isEditingActiveTimer = true
        ).open();
    }

    public async loadAvailableTasks(source: TaskSource = 'all-tasks'): Promise<void> {
        const allTasks = (await parseVault(this.app.vault, this.app.metadataCache)).allTasks;

        switch (source) {
            case 'open-notes':
                this.availableTasks = this.app.workspace.getLeavesOfType('markdown')
                    .map(leaf => (leaf.view as any).file as TFile | undefined)
                    .filter((f): f is TFile => Boolean(f));
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

    public initializeTimerFromState(timerState: ActiveTimerState) {
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
            const parsedData: unknown = JSON.parse(fileContent);
            let newTimerStateFromDisk: ActiveTimerState | undefined = undefined;
            if (parsedData && typeof parsedData === 'object' && 'activeTimer' in parsedData) {
                newTimerStateFromDisk = (parsedData as DovelaPluginData).activeTimer;
            }

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

    private refreshAllGtdAndFocoViews() {
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
    }
}
