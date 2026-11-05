import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { StalledProject } from './stalledProjectService.js';

export const REVIEW_PANEL_VIEW_TYPE = 'dovela-gtd-review-panel-view';
export const REVIEW_PANEL_DISPLAY_TEXT = 'Panel de Revisión GTD';
export const REVIEW_PANEL_ICON = 'clipboard-check';

export class ReviewPanelView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private stalledProjects: StalledProject[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    override getViewType(): string {
        return REVIEW_PANEL_VIEW_TYPE;
    }

    override getDisplayText(): string {
        return REVIEW_PANEL_DISPLAY_TEXT;
    }

    override getIcon(): string {
        return REVIEW_PANEL_ICON;
    }

    override async onOpen() {
        this.render();
    }

    override async onClose() {
        // Lógica de limpieza si es necesaria
    }

    async render() {
        const container = this.containerEl.children[1];
        if (!container) return;
        container.empty();
        container.addClass('dovela-review-panel');

        container.createEl('h2', { text: 'Panel de Revisión GTD' });
        const loadingEl = container.createEl('p', { text: 'Buscando proyectos estancados...' });
        if (!loadingEl) return;

        try {
            this.stalledProjects = await this.plugin.stalledProjectService.findStalledProjects();
            loadingEl.remove();
            if (container) {
                this.drawContent(container);
            }
        } catch (error) {
            console.error("Error al buscar proyectos estancados:", error);
            loadingEl.setText('Error al cargar los proyectos. Revise la consola.');
        }
    }
    
    private drawContent(container: Element) {
        if (this.stalledProjects.length === 0) {
            this.drawEmptyState(container);
        } else {
            this.drawProjectList(container);
        }
    }

    private drawEmptyState(container: Element) {
        const emptyStateContainer = container.createDiv({ cls: 'review-panel-empty-state' });
        emptyStateContainer.createEl('div', { text: '✅', cls: 'empty-state-icon' });
        emptyStateContainer.createEl('h3', { text: '¡Excelente!' });
        emptyStateContainer.createEl('p', { text: 'Todos tus proyectos tienen próximas acciones definidas. ¡Sigue así!' });
    }

    private drawProjectList(container: Element) {
        container.createEl('p', { text: `Se encontraron ${this.stalledProjects.length} proyectos que no tienen próximas acciones definidas.` });
        
        const list = container.createEl('ul', { cls: 'review-panel-list' });
        this.stalledProjects.forEach(project => {
            const item = list.createEl('li', { cls: 'review-panel-item' });
            
            const info = item.createDiv({ cls: 'project-info' });
            info.createEl('div', { text: project.name, cls: 'project-name' });
            info.createEl('div', { text: project.path, cls: 'project-path' });

            const actions = item.createDiv({ cls: 'project-actions' });
            
            const addTaskBtn = actions.createEl('button', { text: '+ Añadir Tarea' });
            addTaskBtn.addEventListener('click', () => {
                this.plugin.app.workspace.openLinkText(project.file.path, '', false);
                new Notice(`Abriendo ${project.name} para añadir una tarea.`);
            });
            
            const archiveBtn = actions.createEl('button', { text: '🔵 Archivar' });
            archiveBtn.addEventListener('click', async () => {
                await this.archiveProject(project.file);
                new Notice(`Proyecto ${project.name} archivado.`);
                this.render(); // Re-render para actualizar la lista
            });
            
            const openFolderBtn = actions.createEl('button', { text: '📂 Abrir Carpeta' });
            openFolderBtn.addEventListener('click', () => {
                // Solo intentar abrir la carpeta en desktop
                if ((this.plugin.app as any).openWithDefaultApp) {
                    (this.plugin.app as any).openWithDefaultApp(project.file.parent?.path);
                    new Notice(`Abriendo la carpeta ${project.path}`);
                } else {
                    new Notice('Esta función no está disponible en móvil');
                }
            });
        });
    }

    private async archiveProject(file: TFile) {
        try {
            await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter.estado = '🔵';
            });
        } catch (error) {
            console.error(`Error al archivar el proyecto ${file.path}:`, error);
            new Notice(`No se pudo archivar el proyecto. Revisa la consola.`);
        }
    }
}
