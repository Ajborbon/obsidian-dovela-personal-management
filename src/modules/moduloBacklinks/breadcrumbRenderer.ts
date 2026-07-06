import DovelaPersonalManagementPlugin from '../../main.js';
import type { BreadcrumbSegment } from './backlinkModel.js';
import type { BacklinkSettings } from './backlinkSettings.js';
import { BacklinkSettingsManager } from './backlinkSettings.js';

export class BreadcrumbRenderer {
    private settings: BacklinkSettings;

    constructor(private plugin: DovelaPersonalManagementPlugin) {
        this.settings = BacklinkSettingsManager.load();
    }

    updateSettings(settings: BacklinkSettings): void {
        this.settings = settings;
        BacklinkSettingsManager.save(settings);
    }

    createBreadcrumb(folderPath: string): HTMLElement {
        const { breadcrumbStyle, maxBreadcrumbLength } = this.settings;
        
        switch (breadcrumbStyle) {
            case 'full':
                return this.createFullBreadcrumb(folderPath);
            case 'compact':
                return this.createCompactBreadcrumb(folderPath, maxBreadcrumbLength);
            case 'smart':
            default:
                return this.createSmartBreadcrumb(folderPath, maxBreadcrumbLength);
        }
    }

    createFullBreadcrumb(folderPath: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'backlinks-breadcrumb full';

        if (!folderPath) {
            container.createEl('span', { 
                text: '📁 Root',
                cls: 'breadcrumb-segment root'
            });
            return container;
        }

        const segments = this.parsePathSegments(folderPath);
        
        segments.forEach((segment, index) => {
            if (index > 0) {
                container.createEl('span', { 
                    text: '›',
                    cls: 'breadcrumb-separator'
                });
            }

            const segmentEl = container.createEl('span', {
                text: segment.name,
                cls: 'breadcrumb-segment clickable'
            });

            segmentEl.onclick = (e) => this.openFolder(segment.path, e.metaKey || e.ctrlKey);
            segmentEl.title = `Click para abrir ${segment.path}`;
        });

        return container;
    }

    createSmartBreadcrumb(folderPath: string, maxLength: number): HTMLElement {
        if (!folderPath) {
            return this.createFullBreadcrumb(folderPath);
        }
        
        const fullPath = folderPath.split('/').filter(Boolean).join('/');
        
        // Si es corto, mostrar completo
        if (fullPath.length <= maxLength) {
            return this.createFullBreadcrumb(folderPath);
        }
        
        // Si es largo, compactar
        return this.createCompactBreadcrumb(folderPath, maxLength);
    }

    createPathBreadcrumbs(folderPath: string): HTMLElement {
        // Mantener por compatibilidad — usa full para evitar recursión mutua con createCompactBreadcrumb
        return this.createFullBreadcrumb(folderPath);
    }


    private parsePathSegments(folderPath: string): BreadcrumbSegment[] {
        const parts = folderPath.split('/').filter(Boolean);
        const segments: BreadcrumbSegment[] = [];

        for (let i = 0; i < parts.length; i++) {
            const currentPath = parts.slice(0, i + 1).join('/');
            const folderName = parts[i];
            
            if (folderName) {
                segments.push({
                    name: folderName,
                    path: currentPath,
                    isClickable: true
                });
            }
        }

        return segments;
    }

    private async openFolder(folderPath: string, openInNewTab: boolean = false): Promise<void> {
        const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
        if (folder) {
            // Try to find a note in the folder to open, or create a new note
            const filesInFolder = this.plugin.app.vault.getMarkdownFiles()
                .filter((file: any) => file.parent?.path === folderPath);

            if (filesInFolder.length > 0) {
                // Open the first file in the folder
                const firstFile = filesInFolder[0];
                if (firstFile) {
                    const leaf = openInNewTab ?
                        this.plugin.app.workspace.getLeaf('tab') :
                        this.plugin.app.workspace.getLeaf();
                    await leaf.openFile(firstFile);
                }
            } else {
                // Open file explorer to the folder
                this.plugin.app.workspace.trigger('reveal-active-file');
            }
        }
    }

    createCompactBreadcrumb(folderPath: string, maxLength: number = 30): HTMLElement {
        const container = document.createElement('div');
        container.className = 'backlinks-breadcrumb compact';

        if (!folderPath) {
            container.createEl('span', { 
                text: '📁',
                cls: 'breadcrumb-icon'
            });
            return container;
        }

        const segments = this.parsePathSegments(folderPath);
        const fullPath = segments.map(s => s.name).join('/');

        if (fullPath.length <= maxLength) {
            return this.createPathBreadcrumbs(folderPath);
        }

        // Truncate middle segments for compact display
        if (segments.length > 2) {
            const first = segments[0];
            const last = segments[segments.length - 1];
            
            if (first) {
                container.createEl('span', {
                    text: first.name,
                    cls: 'breadcrumb-segment clickable',
                    attr: { title: `Click para abrir ${first.path}` }
                }).onclick = (e) => this.openFolder(first.path, e.metaKey || e.ctrlKey);
            }

            container.createEl('span', { 
                text: ' › ... › ',
                cls: 'breadcrumb-ellipsis'
            });

            if (last) {
                container.createEl('span', {
                    text: last.name,
                    cls: 'breadcrumb-segment clickable',
                    attr: { title: `Click para abrir ${last.path}` }
                }).onclick = (e) => this.openFolder(last.path, e.metaKey || e.ctrlKey);
            }
        } else {
            return this.createPathBreadcrumbs(folderPath);
        }

        // Add tooltip with full path
        container.title = folderPath;

        return container;
    }
}