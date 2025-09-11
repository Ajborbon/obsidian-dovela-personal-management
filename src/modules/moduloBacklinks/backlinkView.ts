import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import DovelaPersonalManagementPlugin from '../../main.js';
import { BacklinkDetector } from './backlinkDetector.js';
import { BreadcrumbRenderer } from './breadcrumbRenderer.js';
import type { BacklinkItem, SortConfig } from './backlinkModel.js';
import { DEFAULT_SORT_CONFIG } from './backlinkModel.js';

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

        // Listen for file modifications that might affect backlinks
        this.registerEvent(
            this.app.vault.on('modify', () => {
                this.refreshBacklinks();
            })
        );
    }

    private async handleActiveFileChange() {
        const newActiveFile = this.app.workspace.getActiveFile();
        if (newActiveFile !== this.currentFile) {
            this.currentFile = newActiveFile;
            await this.render();
        }
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
            const btn = columnControls.createEl('button', {
                cls: 'sort-btn' + (this.sortConfig.column === col.index ? ' active' : ''),
                attr: { title: `Ordenar por ${col.name}` }
            });
            
            btn.createEl('span', { cls: 'btn-icon', text: col.icon });
            if (this.sortConfig.column === col.index) {
                btn.createEl('span', { 
                    cls: 'sort-indicator',
                    text: this.sortConfig.direction === 'asc' ? '↑' : '↓'
                });
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
                this.app.workspace.getLeaf().openFile(backlink.file);
            };

            // Add connection indicator
            item.addClass(backlink.hasBacklink ? 'has-backlink' : 'same-folder');
        });
    }

    private handleColumnSort(columnIndex: number) {
        const newDirection = (this.sortConfig.column === columnIndex && this.sortConfig.direction === 'asc') 
            ? 'desc' : 'asc';
        
        this.sortConfig = {
            column: columnIndex,
            direction: newDirection,
            dateSort: null
        };

        this.applySorting();
        this.updateControlsState();
        this.renderBacklinksList();
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
            
            if (this.sortConfig.column === index) {
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