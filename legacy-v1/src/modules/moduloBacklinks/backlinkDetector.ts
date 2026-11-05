import { App, TFile, MetadataCache, Vault } from 'obsidian';
import type { BacklinkItem } from './backlinkModel.js';

export class BacklinkDetector {
    constructor(
        private app: App,
        private vault: Vault,
        private metadataCache: MetadataCache
    ) {}

    async findBacklinks(currentFile: TFile): Promise<BacklinkItem[]> {
        if (!currentFile) return [];

        const currentFolder = currentFile.parent?.path || '';
        const currentPath = currentFile.path;
        const allFiles = this.vault.getMarkdownFiles();

        const backlinks: BacklinkItem[] = [];

        for (const file of allFiles) {
            if (file.path === currentPath) continue;

            const isInSameFolder = file.parent?.path === currentFolder;
            
            const hasBacklink = this.hasLinkToFile(file, currentPath);

            if (isInSameFolder || hasBacklink) {
                const backlink = await this.createBacklinkItem(file, isInSameFolder, hasBacklink);
                backlinks.push(backlink);
            }
        }

        return backlinks;
    }

    private hasLinkToFile(file: TFile, targetPath: string): boolean {
        const fileCache = this.metadataCache.getFileCache(file);
        if (!fileCache?.links) return false;

        const targetBasename = targetPath.replace(/\.md$/, '');
        
        return fileCache.links.some(link => {
            const linkPath = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path)?.path;
            return linkPath === targetPath || link.link === targetBasename;
        });
    }

    private async createBacklinkItem(
        file: TFile, 
        isInSameFolder: boolean, 
        hasBacklink: boolean
    ): Promise<BacklinkItem> {
        const fileCache = this.metadataCache.getFileCache(file);
        const frontmatter = fileCache?.frontmatter;

        return {
            file,
            type: frontmatter?.['type'] || '',
            estado: frontmatter?.['estado'] || '',
            folderPath: file.parent?.path || '',
            isInSameFolder,
            hasBacklink,
            creationDate: new Date(file.stat.ctime),
            modificationDate: new Date(file.stat.mtime),
            // Información financiera para transacciones
            moneda: frontmatter?.['moneda'],
            monto: frontmatter?.['monto']
        };
    }

    public static sortBacklinks(
        backlinks: BacklinkItem[], 
        sortColumn: number, 
        direction: 'asc' | 'desc'
    ): BacklinkItem[] {
        return [...backlinks].sort((a, b) => {
            let aVal: string, bVal: string;

            switch (sortColumn) {
                case 0: // File name
                    aVal = a.file.basename;
                    bVal = b.file.basename;
                    break;
                case 1: // Type
                    aVal = a.type;
                    bVal = b.type;
                    break;
                case 2: // Estado
                    aVal = a.estado;
                    bVal = b.estado;
                    break;
                case 3: // Folder path
                    aVal = a.folderPath;
                    bVal = b.folderPath;
                    break;
                default:
                    return 0;
            }

            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();

            const result = aVal.localeCompare(bVal);
            return direction === 'desc' ? -result : result;
        });
    }

    public static sortBacklinksByDate(
        backlinks: BacklinkItem[], 
        dateType: 'creation' | 'modification', 
        direction: 'asc' | 'desc'
    ): BacklinkItem[] {
        return [...backlinks].sort((a, b) => {
            const dateA = dateType === 'creation' ? a.creationDate : a.modificationDate;
            const dateB = dateType === 'creation' ? b.creationDate : b.modificationDate;

            const result = dateA.getTime() - dateB.getTime();
            return direction === 'desc' ? -result : result;
        });
    }
}