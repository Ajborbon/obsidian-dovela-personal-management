import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import DovelaPersonalManagementPlugin from '../../main.js';
import { BacklinkDetector } from './backlinkDetector.js';
import { BreadcrumbRenderer } from './breadcrumbRenderer.js';
import type { BacklinkItem, SortConfig } from './backlinkModel.js';
import { DEFAULT_SORT_CONFIG } from './backlinkModel.js';

interface FolderNode {
    name: string;
    path: string;
    files: BacklinkItem[];
    subfolders: Map<string, FolderNode>;
    level: number;
}

export const BACKLINKS_VIEW_TYPE = 'dovela-backlinks-view';
export const BACKLINKS_VIEW_DISPLAY_TEXT = 'Backlinks';
export const BACKLINKS_VIEW_ICON = 'link';

export class BacklinksView extends ItemView {
    private detector: BacklinkDetector;
    private breadcrumbRenderer: BreadcrumbRenderer;
    private currentFile: TFile | null = null;
    private backlinks: BacklinkItem[] = [];
    private sortConfig: SortConfig = { ...DEFAULT_SORT_CONFIG };
    private lastClickTime = 0;
    private lastClickedButton: string | null = null;
    private readonly DOUBLE_CLICK_DELAY = 800;
    private showingTabs = false;
    private expandedTreeMode = false;

    constructor(leaf: WorkspaceLeaf, private plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.detector = new BacklinkDetector(this.app, this.app.vault, this.app.metadataCache);
        this.breadcrumbRenderer = new BreadcrumbRenderer(this.plugin);
    }

    override getViewType(): string {
        return BACKLINKS_VIEW_TYPE;
    }

    override getDisplayText(): string {
        return BACKLINKS_VIEW_DISPLAY_TEXT;
    }

    override getIcon(): string {
        return BACKLINKS_VIEW_ICON;
    }

    getDefaultLocation() {
        return 'right' as const;
    }

    override async onOpen() {
        const container = this.containerEl.children[1];
        if (!container) return;
        container.empty();
        container.addClass('backlinks-view-container');

        this.currentFile = this.app.workspace.getActiveFile();
        await this.render();

        // Listen for active file changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.handleActiveFileChange();
            })
        );

        // Listen for file open events
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.handleActiveFileChange();
            })
        );

        // Listen for file modifications that might affect backlinks
        this.registerEvent(
            this.app.vault.on('modify', () => {
                this.refreshBacklinks();
            })
        );
    }

    private async handleActiveFileChange() {
        // Small delay to ensure the file is fully loaded
        setTimeout(async () => {
            const newActiveFile = this.app.workspace.getActiveFile();
            if (newActiveFile !== this.currentFile) {
                this.currentFile = newActiveFile;
                await this.render();
            }
        }, 50);
    }

    private async refreshBacklinks() {
        if (this.currentFile) {
            this.backlinks = await this.detector.findBacklinks(this.currentFile);
            this.applySorting();
            this.renderBacklinksList();
        }
    }

    private async render() {
        const container = this.containerEl.children[1];
        if (!container) return;
        container.empty();

        if (!this.currentFile) {
            this.renderEmptyState(container);
            return;
        }

        await this.refreshBacklinks();

        this.renderHeader(container);
        this.renderCurrentPath(container);
        this.renderControls(container);
        this.renderBacklinksList();
    }

    private renderEmptyState(container: Element) {
        const emptyState = container.createEl('div', { cls: 'backlinks-empty-state' });
        
        emptyState.createEl('div', { 
            cls: 'empty-state-icon',
            text: '📎'
        });
        
        emptyState.createEl('div', { 
            cls: 'empty-state-title',
            text: 'No hay nota activa'
        });
        
        emptyState.createEl('div', { 
            cls: 'empty-state-description',
            text: 'Abre una nota para ver sus backlinks organizados'
        });
    }

    private renderHeader(container: Element) {
        const header = container.createEl('div', { cls: 'backlinks-header' });
        
        // Removed title section to save space
        
        const currentNote = header.createEl('div', { cls: 'current-note' });
        const noteName = this.currentFile?.basename || '';
        currentNote.createEl('span', { 
            cls: 'note-name',
            text: noteName,
            attr: { title: noteName }
        });

        const headerRight = header.createEl('div', { cls: 'header-right' });
        
        const count = headerRight.createEl('div', { cls: 'backlinks-count' });
        count.createEl('span', { 
            text: `${this.backlinks.length} enlace${this.backlinks.length !== 1 ? 's' : ''}`,
            cls: 'count-text'
        });

        // Toggle button para cambiar estilo de breadcrumb
        const toggleBtn = headerRight.createEl('button', {
            cls: 'breadcrumb-toggle-btn',
            attr: { title: 'Cambiar estilo de rutas (Completo/Compacto/Inteligente)' }
        });

        toggleBtn.createEl('span', { text: '📁' });

        toggleBtn.onclick = () => {
            this.cycleBreadcrumbStyle();
        };

        // Button for open tabs viewer
        const tabsBtn = headerRight.createEl('button', {
            cls: 'open-tabs-btn',
            attr: { title: 'Ver pestañas abiertas' }
        });

        tabsBtn.createEl('span', { text: '🗂️' });

        tabsBtn.onclick = () => {
            this.toggleTabsViewer();
        };
    }

    private renderCurrentPath(container: Element) {
        // Remove existing path if it exists
        const existingPath = container.querySelector('.current-path-section');
        if (existingPath) {
            existingPath.remove();
        }

        // Only show path if file has a parent folder
        if (this.currentFile?.parent?.path) {
            const pathSection = container.createEl('div', { cls: 'current-path-section' });
            const pathBreadcrumb = this.breadcrumbRenderer.createBreadcrumb(this.currentFile.parent.path);
            pathBreadcrumb.addClass('current-path-breadcrumb');
            pathSection.appendChild(pathBreadcrumb);
        }
    }

    private renderControls(container: Element) {
        // Remove existing controls if they exist
        const existingControls = container.querySelector('.backlinks-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        const controls = container.createEl('div', { cls: 'backlinks-controls' });

        // Column sort buttons (compact for sidebar)
        const columnControls = controls.createEl('div', { cls: 'column-controls' });
        
        const columns = [
            { name: 'Archivo', icon: '📄', index: 0 },
            { name: 'Tipo', icon: '🏷️', index: 1 },
            { name: 'Estado', icon: '🟢', index: 2 },
            { name: 'Ruta', icon: '📁', index: 3 }
        ];

        columns.forEach(col => {
            // Special title for path button based on expanded mode
            const buttonTitle = col.index === 3
                ? `Ordenar por ${col.name} ${this.expandedTreeMode ? '(Modo expandido - doble click para compactar)' : '(doble click para expandir)'}`
                : `Ordenar por ${col.name}`;

            const btn = columnControls.createEl('button', {
                cls: 'sort-btn' + (this.sortConfig.column === col.index ? ' active' : ''),
                attr: { title: buttonTitle }
            });
            
            // Special handling for path button (index 3) to show expanded mode indicator
            if (col.index === 3) {
                const pathIcon = btn.createEl('span', { cls: 'btn-icon path-icon' });
                if (this.expandedTreeMode) {
                    pathIcon.innerHTML = '📁<span class="expand-indicator">+</span>';
                } else {
                    pathIcon.textContent = '📁';
                }
            } else {
                btn.createEl('span', { cls: 'btn-icon', text: col.icon });
                if (this.sortConfig.column === col.index) {
                    btn.createEl('span', {
                        cls: 'sort-indicator',
                        text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
                    });
                }
            }

            btn.onclick = () => this.handleColumnSort(col.index);
        });

        // Date sort buttons
        const dateControls = controls.createEl('div', { cls: 'date-controls' });
        
        const creationBtn = dateControls.createEl('button', {
            cls: 'date-btn' + (this.sortConfig.dateSort === 'creation' ? ' active' : ''),
            attr: { title: 'Ordenar por fecha de creación' }
        });
        creationBtn.createEl('span', { text: '📅' });
        if (this.sortConfig.dateSort === 'creation') {
            creationBtn.createEl('span', { 
                cls: 'sort-indicator',
                text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
            });
        }
        creationBtn.onclick = () => this.handleDateSort('creation');

        const modificationBtn = dateControls.createEl('button', {
            cls: 'date-btn' + (this.sortConfig.dateSort === 'modification' ? ' active' : ''),
            attr: { title: 'Ordenar por fecha de modificación' }
        });
        modificationBtn.createEl('span', { text: '📝' });
        if (this.sortConfig.dateSort === 'modification') {
            modificationBtn.createEl('span', { 
                cls: 'sort-indicator',
                text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
            });
        }
        modificationBtn.onclick = () => this.handleDateSort('modification');
    }

    private renderBacklinksList() {
        const container = this.containerEl.children[1];
        if (!container) return;
        const existingList = container.querySelector('.backlinks-list');
        if (existingList) {
            existingList.remove();
        }

        const listContainer = container.createEl('div', { cls: 'backlinks-list' });

        if (this.backlinks.length === 0) {
            const emptyMessage = listContainer.createEl('div', { cls: 'empty-message' });
            emptyMessage.createEl('div', { text: '🔍', cls: 'empty-icon' });
            emptyMessage.createEl('div', {
                text: 'No se encontraron backlinks',
                cls: 'empty-text'
            });
            return;
        }

        // Check if we're showing tabs or normal content
        if (this.showingTabs) {
            this.renderTabsView(listContainer);
        } else if (this.sortConfig.column === 3) {
            this.renderTreeView(listContainer);
        } else {
            this.renderListView(listContainer);
        }
    }

    private renderListView(listContainer: HTMLElement) {
        this.backlinks.forEach(backlink => {
            const item = listContainer.createEl('div', { cls: 'backlink-item' });
            
            // Main content
            const content = item.createEl('div', { cls: 'item-content' });
            
            // File name with icon
            const fileName = content.createEl('div', { cls: 'file-name' });
            fileName.createEl('span', { 
                cls: 'file-icon',
                text: backlink.hasBacklink ? '🔗' : '📁'
            });
            fileName.createEl('span', { 
                cls: 'file-title',
                text: backlink.file.basename
            });

            // Metadata row - Type and Estado
            if (backlink.type || backlink.estado) {
                const metadata = content.createEl('div', { cls: 'metadata-row' });
                if (backlink.type) {
                    metadata.createEl('span', { 
                        cls: 'metadata-tag type',
                        text: backlink.type
                    });
                }
                if (backlink.estado) {
                    metadata.createEl('span', { 
                        cls: 'metadata-tag estado',
                        text: backlink.estado
                    });
                }
            }

            // Financial information for transactions
            if (backlink.moneda && backlink.monto) {
                const financialRow = content.createEl('div', { cls: 'financial-row' });
                financialRow.createEl('span', { 
                    cls: 'financial-icon',
                    text: '💰'
                });
                financialRow.createEl('span', { 
                    cls: 'financial-amount',
                    text: this.formatMoney(backlink.moneda, backlink.monto)
                });
            }

            // Date information row
            const dateRow = content.createEl('div', { cls: 'date-row' });
            
            // Creation date
            const creationInfo = dateRow.createEl('div', { cls: 'date-info creation' });
            creationInfo.createEl('span', { cls: 'date-icon', text: '📅' });
            creationInfo.createEl('span', { 
                cls: 'date-label', 
                text: 'Creado:' 
            });
            creationInfo.createEl('span', { 
                cls: 'date-value', 
                text: this.formatDateTime(backlink.creationDate)
            });

            // Modification date
            const modificationInfo = dateRow.createEl('div', { cls: 'date-info modification' });
            modificationInfo.createEl('span', { cls: 'date-icon', text: '📝' });
            modificationInfo.createEl('span', { 
                cls: 'date-label', 
                text: 'Modificado:' 
            });
            modificationInfo.createEl('span', { 
                cls: 'date-value', 
                text: this.formatDateTime(backlink.modificationDate)
            });

            // Breadcrumb
            if (backlink.folderPath) {
                const breadcrumbContainer = content.createEl('div', { cls: 'breadcrumb-container' });
                const breadcrumb = this.breadcrumbRenderer.createBreadcrumb(backlink.folderPath);
                breadcrumbContainer.appendChild(breadcrumb);
            }

            // Click handler to open file
            item.onclick = (e) => {
                e.preventDefault();

                // Check for modifier keys (Command on Mac, Ctrl on Windows/Linux)
                const shouldOpenInNewTab = e.metaKey || e.ctrlKey;

                if (shouldOpenInNewTab) {
                    // Open in new tab
                    this.app.workspace.getLeaf('tab').openFile(backlink.file);
                } else {
                    // Open in current tab
                    this.app.workspace.getLeaf().openFile(backlink.file);
                }
            };

            // Add connection indicator
            item.addClass(backlink.hasBacklink ? 'has-backlink' : 'same-folder');
        });
    }

    private renderTreeView(listContainer: HTMLElement) {
        // Get backlinks and add current file + expanded mode files if needed
        let allFiles = [...this.backlinks];

        // Always add current file if it exists and not already in backlinks
        if (this.currentFile) {
            const currentFileExists = allFiles.some(backlink => backlink.file.path === this.currentFile!.path);
            if (!currentFileExists) {
                const currentFileBacklink: BacklinkItem = {
                    file: this.currentFile,
                    type: '',
                    estado: '',
                    folderPath: this.currentFile.parent?.path || '',
                    isInSameFolder: false,
                    hasBacklink: false,
                    creationDate: new Date(this.currentFile.stat.ctime),
                    modificationDate: new Date(this.currentFile.stat.mtime),
                    isCurrentFile: true
                };
                allFiles.push(currentFileBacklink);
            } else {
                // Mark existing backlink as current file
                const existingBacklink = allFiles.find(backlink => backlink.file.path === this.currentFile!.path);
                if (existingBacklink) {
                    existingBacklink.isCurrentFile = true;
                }
            }
        }

        // Add expanded mode files if enabled
        if (this.expandedTreeMode && this.currentFile) {
            const currentFileFolder = this.currentFile.parent?.path || '';
            const additionalFiles = this.getFilesInFolderAndSubfolders(currentFileFolder);

            for (const file of additionalFiles) {
                const fileExists = allFiles.some(backlink => backlink.file.path === file.path);
                if (!fileExists) {
                    const fileBacklink: BacklinkItem = {
                        file: file,
                        type: '',
                        estado: '',
                        folderPath: file.parent?.path || '',
                        isInSameFolder: false,
                        hasBacklink: false,
                        creationDate: new Date(file.stat.ctime),
                        modificationDate: new Date(file.stat.mtime),
                        isExpandedModeFile: true
                    };
                    allFiles.push(fileBacklink);
                }
            }
        }

        // Create folder hierarchy from all files
        const folderStructure = this.buildFolderStructure(allFiles);

        // Add tree view specific class
        listContainer.addClass('tree-view');

        // Render folder structure
        this.renderFolderStructure(listContainer, folderStructure, 0);
    }

    private getFilesInFolderAndSubfolders(folderPath: string): TFile[] {
        const allFiles = this.app.vault.getMarkdownFiles();
        const filesInFolder: TFile[] = [];

        for (const file of allFiles) {
            const fileFolderPath = file.parent?.path || '';
            // Include files in the same folder or any subfolder
            if (fileFolderPath === folderPath || fileFolderPath.startsWith(folderPath + '/')) {
                filesInFolder.push(file);
            }
        }

        return filesInFolder;
    }

    private buildFolderStructure(backlinks: BacklinkItem[]): FolderNode {
        const rootNode: FolderNode = {
            name: '',
            path: '',
            files: [],
            subfolders: new Map(),
            level: 0
        };

        for (const backlink of backlinks) {
            const pathParts = backlink.folderPath ? backlink.folderPath.split('/') : [''];
            let currentNode = rootNode;

            // Navigate/create folder structure
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i] || 'Root';
                const currentPath = pathParts.slice(0, i + 1).join('/');

                if (!currentNode.subfolders.has(part)) {
                    currentNode.subfolders.set(part, {
                        name: part,
                        path: currentPath,
                        files: [],
                        subfolders: new Map(),
                        level: i + 1
                    });
                }
                currentNode = currentNode.subfolders.get(part)!;
            }

            // Add file to the appropriate folder
            currentNode.files.push(backlink);
        }

        return rootNode;
    }

    private renderFolderStructure(container: HTMLElement, folderNode: FolderNode, level: number) {
        // Render files in current folder
        if (folderNode.files.length > 0) {
            for (const backlink of folderNode.files) {
                this.renderBacklinkInTree(container, backlink, level);
            }
        }

        // Render subfolders
        const sortedFolders = Array.from(folderNode.subfolders.entries())
            .sort(([a], [b]) => a.localeCompare(b));

        for (const [folderName, subfolder] of sortedFolders) {
            if (folderName === 'Root' && level === 0) {
                // Skip root folder display, just render its contents
                this.renderFolderStructure(container, subfolder, level);
                continue;
            }

            const folderItem = container.createEl('details', {
                cls: 'folder-item'
            });

            if (level < 2) {
                folderItem.setAttribute('open', 'true');
            }

            const folderHeader = folderItem.createEl('summary', { cls: 'folder-header' });
            folderHeader.style.paddingLeft = `${level * 20}px`;

            folderHeader.createEl('span', { cls: 'folder-icon', text: '📁' });
            folderHeader.createEl('span', { cls: 'folder-name', text: folderName });
            const fileCount = this.countFilesInFolder(subfolder);
            folderHeader.createEl('span', {
                cls: 'folder-count',
                text: `(${fileCount})`
            });

            // Create container for folder contents
            const folderContent = folderItem.createEl('div', { cls: 'folder-content' });

            // Recursively render subfolder contents
            this.renderFolderStructure(folderContent, subfolder, level + 1);
        }
    }

    private renderBacklinkInTree(container: HTMLElement, backlink: BacklinkItem, level: number) {
        const item = container.createEl('div', { cls: 'backlink-item tree-item' });
        item.style.paddingLeft = `${(level + 1) * 20}px`;

        // Add special classes for current file and expanded mode files
        if (backlink.isCurrentFile) {
            item.addClass('current-file');
        }
        if (backlink.isExpandedModeFile) {
            item.addClass('expanded-mode-file');
        }

        // Main content
        const content = item.createEl('div', { cls: 'item-content' });

        // File name with icon
        const fileName = content.createEl('div', { cls: 'file-name' });

        // Choose icon based on file type and status
        let fileIcon = '📄';
        if (backlink.isCurrentFile) {
            fileIcon = '📍'; // Pin icon for current file
        } else if (backlink.hasBacklink) {
            fileIcon = '🔗';
        } else if (backlink.isExpandedModeFile) {
            fileIcon = '📋'; // Clipboard icon for expanded mode files
        }

        fileName.createEl('span', {
            cls: 'file-icon',
            text: fileIcon
        });
        fileName.createEl('span', {
            cls: 'file-title',
            text: backlink.file.basename
        });

        // Metadata row - Type and Estado (compact for tree view)
        if (backlink.type || backlink.estado) {
            const metadata = content.createEl('div', { cls: 'metadata-row compact' });
            if (backlink.type) {
                metadata.createEl('span', {
                    cls: 'metadata-tag type',
                    text: backlink.type
                });
            }
            if (backlink.estado) {
                metadata.createEl('span', {
                    cls: 'metadata-tag estado',
                    text: backlink.estado
                });
            }
        }

        // Click handler to open file
        item.onclick = (e) => {
            e.preventDefault();
            const shouldOpenInNewTab = e.metaKey || e.ctrlKey;
            if (shouldOpenInNewTab) {
                this.app.workspace.getLeaf('tab').openFile(backlink.file);
            } else {
                this.app.workspace.getLeaf().openFile(backlink.file);
            }
        };

        // Add connection indicator
        item.addClass(backlink.hasBacklink ? 'has-backlink' : 'same-folder');
    }

    private countFilesInFolder(folder: FolderNode): number {
        let count = folder.files.length;
        for (const subfolder of folder.subfolders.values()) {
            count += this.countFilesInFolder(subfolder);
        }
        return count;
    }

    private toggleTabsViewer() {
        this.showingTabs = !this.showingTabs;

        // Update button appearance
        const tabsBtn = this.containerEl.querySelector('.open-tabs-btn');
        if (tabsBtn) {
            tabsBtn.classList.toggle('active', this.showingTabs);
            const icon = tabsBtn.querySelector('span');
            if (icon) {
                icon.textContent = this.showingTabs ? '📋' : '🗂️';
            }
            tabsBtn.setAttribute('title', this.showingTabs ? 'Volver a backlinks' : 'Ver pestañas abiertas');
        }

        // Re-render the content
        this.renderBacklinksList();
    }

    private renderTabsView(listContainer: HTMLElement) {
        // Add tabs view specific class
        listContainer.addClass('tabs-view');

        // Get all open tabs
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        const allLeaves = [...leaves, ...this.app.workspace.getLeavesOfType('canvas')];

        if (allLeaves.length === 0) {
            const emptyMessage = listContainer.createEl('div', { cls: 'empty-message' });
            emptyMessage.createEl('div', { text: '📑', cls: 'empty-icon' });
            emptyMessage.createEl('div', {
                text: 'No hay pestañas abiertas',
                cls: 'empty-text'
            });
            return;
        }

        // Check if there are real splits (multiple groups with tabs)
        const tabGroups = new Map<string, typeof allLeaves>();

        for (const leaf of allLeaves) {
            // Better split detection
            const split = leaf.parent;
            let splitType = 'main';

            if (split === this.app.workspace.leftSplit) {
                splitType = 'left';
            } else if (split === this.app.workspace.rightSplit) {
                splitType = 'right';
            } else {
                // Check if it's in a split within the main area
                let currentParent = split?.parent;
                while (currentParent && currentParent !== this.app.workspace.rootSplit) {
                    if ('type' in currentParent && currentParent.type === 'split') {
                        const direction = 'direction' in currentParent ? currentParent.direction : 'unknown';
                        splitType = `split-${direction}`;
                        break;
                    }
                    currentParent = currentParent.parent;
                }
            }

            if (!tabGroups.has(splitType)) {
                tabGroups.set(splitType, []);
            }
            tabGroups.get(splitType)!.push(leaf);
        }

        // Only show groups if there are multiple splits with tabs
        const groupsWithTabs = Array.from(tabGroups.entries()).filter(([_, tabs]) => tabs.length > 0);
        const shouldShowGroups = groupsWithTabs.length > 1;

        if (shouldShowGroups) {
            // Render with groups
            const groupOrder = ['main', 'left', 'right'];
            const groupNames = {
                main: '📄 Panel Central',
                left: '◀️ Panel Izquierdo',
                right: '▶️ Panel Derecho'
            };

            for (const groupType of groupOrder) {
                const groupLeaves = tabGroups.get(groupType);
                if (!groupLeaves || groupLeaves.length === 0) continue;

                // Group header
                const groupHeader = listContainer.createEl('div', { cls: 'tab-group-header' });
                groupHeader.createEl('span', {
                    cls: 'group-title',
                    text: groupNames[groupType as keyof typeof groupNames] || `📋 ${groupType}`
                });
                groupHeader.createEl('span', {
                    cls: 'group-count',
                    text: `(${groupLeaves.length})`
                });

                // Tabs list
                const tabsList = listContainer.createEl('div', { cls: 'tabs-list' });

                for (const leaf of groupLeaves) {
                    this.renderTabItem(tabsList, leaf);
                }
            }

            // Handle other split types
            for (const [groupType, groupLeaves] of tabGroups.entries()) {
                if (!groupOrder.includes(groupType) && groupLeaves.length > 0) {
                    const groupHeader = listContainer.createEl('div', { cls: 'tab-group-header' });
                    groupHeader.createEl('span', {
                        cls: 'group-title',
                        text: `📋 ${groupType}`
                    });
                    groupHeader.createEl('span', {
                        cls: 'group-count',
                        text: `(${groupLeaves.length})`
                    });

                    const tabsList = listContainer.createEl('div', { cls: 'tabs-list' });
                    for (const leaf of groupLeaves) {
                        this.renderTabItem(tabsList, leaf);
                    }
                }
            }
        } else {
            // Render without groups (single list)
            const tabsList = listContainer.createEl('div', { cls: 'tabs-list no-groups' });
            for (const leaf of allLeaves) {
                this.renderTabItem(tabsList, leaf);
            }
        }
    }

    private renderTabItem(container: HTMLElement, leaf: any) {
        const tabItem = container.createEl('div', { cls: 'tab-item' });

        // Check if this is the active tab
        const isActive = this.app.workspace.activeLeaf === leaf;
        if (isActive) {
            tabItem.addClass('active-tab');
        }

        // Main content
        const content = tabItem.createEl('div', { cls: 'tab-content' });

        // Title section with background
        const titleSection = content.createEl('div', { cls: 'tab-title-section' });
        const titleRow = titleSection.createEl('div', { cls: 'tab-title-row' });

        const icon = titleRow.createEl('span', { cls: 'tab-icon' });
        if (leaf.view?.file) {
            icon.textContent = '📄';
        } else if (leaf.view?.getViewType() === 'canvas') {
            icon.textContent = '🎨';
        } else {
            icon.textContent = '📋';
        }

        const title = titleRow.createEl('span', { cls: 'tab-title' });
        title.textContent = leaf.getDisplayText();

        // Path section with different background
        if (leaf.view?.file) {
            const pathSection = content.createEl('div', { cls: 'tab-path-section' });
            const pathRow = pathSection.createEl('div', { cls: 'tab-path-row' });

            pathRow.createEl('span', { cls: 'path-icon', text: '📁' });

            const pathText = pathRow.createEl('span', { cls: 'tab-path' });
            // Get folder path without the filename
            const folderPath = leaf.view.file.parent?.path || '';
            pathText.textContent = folderPath || 'Raíz';
        }

        // Click handler to switch to tab
        tabItem.onclick = (e) => {
            e.preventDefault();
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
        };

        // Hover effect
        tabItem.addEventListener('mouseenter', () => {
            tabItem.addClass('tab-hover');
        });

        tabItem.addEventListener('mouseleave', () => {
            tabItem.removeClass('tab-hover');
        });
    }

    private handleColumnSort(columnIndex: number) {
        // Special handling for path column (index 3) to support expanded tree mode
        if (columnIndex === 3) {
            const currentTime = Date.now();
            const isDoubleClick = this.lastClickedButton === 'path' &&
                (currentTime - this.lastClickTime) < this.DOUBLE_CLICK_DELAY;

            if (isDoubleClick) {
                // Toggle expanded tree mode on double click
                this.expandedTreeMode = !this.expandedTreeMode;
            }

            this.lastClickedButton = 'path';
            this.lastClickTime = currentTime;
        }

        const newDirection = (this.sortConfig.column === columnIndex && this.sortConfig.direction === 'asc')
            ? 'desc' : 'asc';

        this.sortConfig = {
            column: columnIndex,
            direction: newDirection,
            dateSort: null
        };

        this.applySorting();
        this.updateControlsState();
        this.updatePathButtonIcon();
        this.renderBacklinksList();
    }

    private updatePathButtonIcon() {
        const pathIcon = this.containerEl.querySelector('.path-icon');
        if (pathIcon) {
            if (this.expandedTreeMode) {
                pathIcon.innerHTML = '📁<span class="expand-indicator">+</span>';
            } else {
                pathIcon.textContent = '📁';
            }

            // Update button title
            const pathButton = pathIcon.closest('button');
            if (pathButton) {
                const newTitle = `Ordenar por Ruta ${this.expandedTreeMode ? '(Modo expandido - doble click para compactar)' : '(doble click para expandir)'}`;
                pathButton.setAttribute('title', newTitle);
            }
        }
    }

    private handleDateSort(dateType: 'creation' | 'modification') {
        const currentTime = Date.now();
        const isDoubleClick = this.lastClickedButton === dateType && 
            (currentTime - this.lastClickTime) < this.DOUBLE_CLICK_DELAY;

        let newDirection = this.sortConfig.direction;
        if (isDoubleClick) {
            newDirection = this.sortConfig.direction === 'desc' ? 'asc' : 'desc';
        } else if (this.sortConfig.dateSort !== dateType) {
            newDirection = 'desc';
        }

        this.sortConfig = {
            column: -1,
            direction: newDirection,
            dateSort: dateType
        };

        this.applySorting();
        this.updateControlsState();
        this.renderBacklinksList();

        this.lastClickTime = currentTime;
        this.lastClickedButton = dateType;
    }

    private updateControlsState() {
        const container = this.containerEl.children[1];
        if (!container) return;
        const controls = container.querySelector('.backlinks-controls');
        if (!controls) return;

        // Update column buttons
        const columnButtons = controls.querySelectorAll('.sort-btn');
        columnButtons.forEach((btn, index) => {
            btn.classList.toggle('active', this.sortConfig.column === index);
            
            // Update sort indicator
            const existingIndicator = btn.querySelector('.sort-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            if (this.sortConfig.column === index && index !== 3) {
                btn.createEl('span', {
                    cls: 'sort-indicator',
                    text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
                });
            }
        });

        // Update date buttons
        const creationBtn = controls.querySelector('.date-btn[title*="creación"]') as HTMLElement;
        const modificationBtn = controls.querySelector('.date-btn[title*="modificación"]') as HTMLElement;
        
        if (creationBtn) {
            creationBtn.classList.toggle('active', this.sortConfig.dateSort === 'creation');
            const existingIndicator = creationBtn.querySelector('.sort-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            if (this.sortConfig.dateSort === 'creation') {
                creationBtn.createEl('span', { 
                    cls: 'sort-indicator',
                    text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
                });
            }
        }
        
        if (modificationBtn) {
            modificationBtn.classList.toggle('active', this.sortConfig.dateSort === 'modification');
            const existingIndicator = modificationBtn.querySelector('.sort-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            if (this.sortConfig.dateSort === 'modification') {
                modificationBtn.createEl('span', { 
                    cls: 'sort-indicator',
                    text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
                });
            }
        }
    }

    private applySorting() {
        if (this.sortConfig.dateSort) {
            this.backlinks = BacklinkDetector.sortBacklinksByDate(
                this.backlinks,
                this.sortConfig.dateSort,
                this.sortConfig.direction
            );
        } else if (this.sortConfig.column >= 0) {
            this.backlinks = BacklinkDetector.sortBacklinks(
                this.backlinks,
                this.sortConfig.column,
                this.sortConfig.direction
            );
        }
    }

    private cycleBreadcrumbStyle() {
        const styles = ['full', 'smart', 'compact'] as const;
        const currentSettings = this.breadcrumbRenderer['settings'];
        const currentIndex = styles.indexOf(currentSettings.breadcrumbStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        const nextStyle = styles[nextIndex];
        
        const newSettings = Object.assign({}, currentSettings, {
            breadcrumbStyle: nextStyle
        });
        
        this.breadcrumbRenderer.updateSettings(newSettings);
        this.renderCurrentPath(this.containerEl.children[1] as Element); // Update current path style
        this.renderBacklinksList(); // Re-render con nuevo estilo
        
        // Update button tooltip to show current style
        const toggleBtn = this.containerEl.querySelector('.breadcrumb-toggle-btn');
        if (toggleBtn) {
            const styleNames: Record<string, string> = { full: 'Completo', smart: 'Inteligente', compact: 'Compacto' };
            const styleName = styleNames[nextStyle as keyof typeof styleNames] || 'Desconocido';
            toggleBtn.setAttribute('title', `Estilo actual: ${styleName} - Click para cambiar`);
        }
    }

    private formatDateTime(date: Date): string {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    }

    private formatMoney(moneda: string, monto: number): string {
        const formatter = new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: moneda.toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        try {
            return formatter.format(monto);
        } catch (error) {
            // Fallback if currency is not recognized
            return `${moneda.toUpperCase()} ${monto.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }
    }

    override async onClose() {
        // Cleanup if needed
    }
}