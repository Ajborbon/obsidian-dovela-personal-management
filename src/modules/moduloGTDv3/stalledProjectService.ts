import { TFile, TFolder, Vault, MetadataCache } from 'obsidian';
import type { DovelaPluginData } from './model.js';
import { parseTasks } from '../moduloFoco/focoParser.js'; // Reutilizamos el parser de tareas

/**
 * Representa un proyecto GTD que ha sido identificado como estancado.
 */
export interface StalledProject {
    path: string; // Ruta a la carpeta del proyecto
    file: TFile;  // El archivo principal del proyecto
    name: string; // Nombre del proyecto
}

/**
 * Servicio para analizar y encontrar proyectos GTD estancados.
 * Un proyecto se considera estancado si es un proyecto activo (estado: 🟢)
 * y no contiene ninguna tarea abierta en su jerarquía.
 */
export class StalledProjectService {
    private vault: Vault;
    private metadataCache: MetadataCache;

    constructor(vault: Vault, metadataCache: MetadataCache, _settings: DovelaPluginData) {
        this.vault = vault;
        this.metadataCache = metadataCache;
        // _settings is intentionally unused but kept for API compatibility
    }

    /**
     * Encuentra todos los proyectos GTD activos que están estancados.
     * @returns Una promesa que se resuelve con una lista de proyectos estancados.
     */
    public async findStalledProjects(): Promise<StalledProject[]> {
        const stalledProjects: StalledProject[] = [];
        const allFolders = this.vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];
        const projectFolders = allFolders.filter(folder => folder.name.startsWith('PGTD '));

        for (const folder of projectFolders) {
            const projectFile = this.vault.getAbstractFileByPath(`${folder.path}/${folder.name}.md`);

            if (projectFile instanceof TFile) {
                const isActive = await this.isProjectActive(projectFile);
                if (isActive) {
                    const hasOpenTasks = await this.projectHasOpenTasks(projectFile);
                    if (!hasOpenTasks) {
                        stalledProjects.push({
                            path: folder.path,
                            file: projectFile,
                            name: folder.name,
                        });
                    }
                }
            }
        }

        return stalledProjects;
    }

    /**
     * Verifica si un proyecto está activo basado en su frontmatter.
     * @param file El archivo principal del proyecto.
     * @returns `true` si el proyecto tiene estado '🟢', `false` en caso contrario.
     */
    private async isProjectActive(file: TFile): Promise<boolean> {
        const fileCache = this.metadataCache.getFileCache(file);
        return fileCache?.frontmatter?.['estado'] === '🟢';
    }

    /**
     * Determina si un proyecto y su jerarquía contienen tareas abiertas.
     * @param projectFile El archivo principal del proyecto.
     * @returns `true` si se encuentra al menos una tarea abierta, `false` en caso contrario.
     */
    private async projectHasOpenTasks(projectFile: TFile): Promise<boolean> {
        const hierarchyFiles = await this.collectProjectHierarchyFiles(projectFile);
        for (const file of hierarchyFiles) {
            const content = await this.vault.cachedRead(file);
            const tasks = parseTasks(content, file);
            if (tasks.some((task: any) => !task.completed)) {
                return true; // Encontramos una tarea abierta, no necesitamos seguir buscando.
            }
        }
        return false;
    }

    /**
     * Recopila todos los archivos que pertenecen a la jerarquía de un proyecto.
     * Lógica adaptada de `collectFocusFiles` del módulo Foco.
     * @param projectFile El archivo principal del proyecto.
     * @returns Un conjunto de TFiles que componen la jerarquía del proyecto.
     */
    private async collectProjectHierarchyFiles(projectFile: TFile): Promise<Set<TFile>> {
        const hierarchyFiles = new Set<TFile>();
        const processedPaths = new Set<string>();

        // 1. Añadir el archivo del proyecto y los archivos en su carpeta y subcarpetas.
        const rootFolder = projectFile.parent;
        if (rootFolder) {
            const allDescendantFiles = (folder: TFolder): TFile[] => {
                let files: TFile[] = [];
                for (const child of folder.children) {
                    if (child instanceof TFile && child.extension === 'md') {
                        files.push(child);
                    } else if (child instanceof TFolder) {
                        files = files.concat(allDescendantFiles(child));
                    }
                }
                return files;
            };
            const folderFiles = allDescendantFiles(rootFolder);
            folderFiles.forEach(file => {
                hierarchyFiles.add(file);
                processedPaths.add(file.path);
            });
        }

        // 2. Añadir archivos con enlaces salientes (2 niveles de profundidad).
        const getLinkedFiles = (fileSet: Set<TFile>): Set<TFile> => {
            const newFiles = new Set<TFile>();
            for (const file of fileSet) {
                const cache = this.metadataCache.getCache(file.path);
                if (!cache?.links) continue;

                for (const link of cache.links) {
                    const linkedFile = this.metadataCache.getFirstLinkpathDest(link.link, file.path);
                    if (linkedFile instanceof TFile && !processedPaths.has(linkedFile.path)) {
                        newFiles.add(linkedFile);
                        processedPaths.add(linkedFile.path);
                    }
                }
            }
            return newFiles;
        };

        const level1Files = getLinkedFiles(new Set(hierarchyFiles));
        level1Files.forEach(file => hierarchyFiles.add(file));

        const level2Files = getLinkedFiles(level1Files);
        level2Files.forEach(file => hierarchyFiles.add(file));

        return hierarchyFiles;
    }
}
