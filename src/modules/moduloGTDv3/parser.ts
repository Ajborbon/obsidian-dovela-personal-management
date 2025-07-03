
import { TFile, TFolder, Vault, MetadataCache } from 'obsidian';
import type { HierarchicalItem, Task, ProcessedVaultData, HierarchicalItemType } from './model.js';

// --- Configuración de Exclusiones ---

const EXCLUDED_FOLDERS: string[] = [
    '03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas',
];

const DYNAMIC_EXCLUDED_FOLDER_NAMES: string[] = [
    '99 - Adjuntos',
];

// --- Lógica de Detección de Tipo ---

const PREFIX_TO_TYPE_MAP: { [prefix: string]: HierarchicalItemType } = {
    'AV': 'AV', 'AI': 'AI', 'PGTD': 'PGTD', 'PQ': 'PQ', 'RR': 'RR',
    'Tx': 'Tx', 'Vx': 'Vx', 'Reu': 'Reu', 'Rf': 'Rf', 'Sue': 'Sue',
    'Cp': 'Cp', 'EMkt': 'EMkt', 'RT': 'RT', 'RL': 'RL', 'Ax': 'Ax',
};

const FRONTMATTER_TYPE_MAP: { [type: string]: HierarchicalItemType } = {
    'Dly': 'Dly', 'Wk': 'Wk', 'M': 'M', 'Q': 'Q', 'H': 'H', 'Y': 'Y',
};

function determineItemType(file: TFile, metadataCache: MetadataCache): HierarchicalItemType {
    const frontmatter = metadataCache.getCache(file.path)?.frontmatter;
    if (frontmatter && frontmatter['type'] && FRONTMATTER_TYPE_MAP[frontmatter['type'] as string]) {
        return FRONTMATTER_TYPE_MAP[frontmatter['type'] as string] as HierarchicalItemType;
    }
    for (const prefix in PREFIX_TO_TYPE_MAP) {
        if (file.basename.startsWith(prefix + ' ')) {
            return PREFIX_TO_TYPE_MAP[prefix] as HierarchicalItemType;
        }
    }
    return 'Ax';
}

function shouldBeExcluded(file: TFile): boolean {
    if (file.extension !== 'md') return true;
    for (const excludedPath of EXCLUDED_FOLDERS) {
        if (file.path.startsWith(excludedPath)) return true;
    }
    const pathParts = file.path.split('/');
    if (pathParts.some(part => DYNAMIC_EXCLUDED_FOLDER_NAMES.includes(part))) {
        return true;
    }
    return false;
}

function parseTasks(content: string, sourceFile: TFile): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');
    const taskRegex = /^\s*-\s+\[( |x|X)\]\s+(.*)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const match = line.match(taskRegex);
        if (!match) continue;

        let taskContent: string | undefined = match[2];
        const completed = match[1]?.toLowerCase() === 'x';

        const extractMetadata = (regex: RegExp, clean = true): (string | undefined)[] => {
            if (taskContent === undefined) {
                return [];
            }
            const allMatches = taskContent.match(regex);
            if (!allMatches) {
                return [];
            }
            if (clean) {
                taskContent = taskContent.replace(regex, '').trim();
            }
            return allMatches.map(match => match.replace(regex, '$1'));
        };

        const id = extractMetadata(/\ \[id::\s*([a-zA-Z0-9-]+)\]/)[0] || crypto.randomUUID();
        const contexts = extractMetadata(/#cx-[\w-]+/g, false).filter(Boolean) as string[];
        const assignedPeople = extractMetadata(/#px-[\w-]+/g, false).filter(Boolean) as string[];
        const dueDate = extractMetadata(/📅\s*(\d{4}-\d{2}-\d{2})/)[0];
        const startDate = extractMetadata(/🛫\s*(\d{4}-\d{2}-\d{2})/)[0];
        const scheduledDate = extractMetadata(/⏳\s*(\d{4}-\d{2}-\d{2})/)[0];
        const startTime = extractMetadata(/\ \[hI::\s*(\d{2}:\d{2})\]/)[0];
        const endTime = extractMetadata(/\ \[hF::\s*(\d{2}:\d{2})\]/)[0];
        const week = extractMetadata(/\ \[w::\s*(\[\[.*?\]\])\]/)[0];
        const dependencies = extractMetadata(/⛔️\s*(\[\[.*?\]\])/g).filter(Boolean) as string[];
        
        const priorityMatch = taskContent?.match(/(⏫|🔼|🔽|⏬)/);
        let priority: Task['priority'] = 'None';
        if (priorityMatch) {
            const prioritySymbol = priorityMatch[0];
            if (prioritySymbol === '⏫') priority = 'Highest';
            else if (prioritySymbol === '🔼') priority = 'High';
            else if (prioritySymbol === '🔽') priority = 'Medium';
            else if (prioritySymbol === '⏬') priority = 'Low';
            if (taskContent) {
                taskContent = taskContent.replace(prioritySymbol, '').trim();
            }
        }

        if (taskContent) {
            taskContent = taskContent.replace(/#cx-[\w-]+/g, '').replace(/#px-[\w-]+/g, '').trim();
        }

        const task: Task = {
            id,
            content: taskContent || '',
            completed,
            priority,
            contexts,
            assignedPeople,
            dependencies,
            sourceFile,
            lineNumber: i,
        };

        if (dueDate) task.dueDate = dueDate;
        if (startDate) task.startDate = startDate;
        if (scheduledDate) task.scheduledDate = scheduledDate;
        if (startTime) task.startTime = startTime;
        if (endTime) task.endTime = endTime;
        if (week) task.week = week;

        tasks.push(task);
    }
    return tasks;
}

export async function parseVault(vault: Vault, metadataCache: MetadataCache): Promise<ProcessedVaultData> {
    const processedItems: HierarchicalItem[] = [];
    let allTasks: Task[] = [];

    // 1. Procesar todos los ficheros Markdown
    for (const file of vault.getMarkdownFiles()) {
        if (shouldBeExcluded(file)) continue;

        const content = await vault.cachedRead(file);
        const frontmatter = metadataCache.getCache(file.path)?.frontmatter || {};
        const itemType = determineItemType(file, metadataCache);
        const tasks = parseTasks(content, file);
        allTasks = allTasks.concat(tasks);

        processedItems.push({
            id: file.path, type: itemType, name: file.basename, file: file,
            children: [], tasks: tasks, ownTaskCount: tasks.filter(t => !t.completed).length, descendantTaskCount: 0, frontmatter: frontmatter,
        });
    }

    // 2. Identificar y añadir carpetas de grupo (ej. "01 - Productividad")
    const allFolders = vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];
    const groupFolderRegex = /^\d{2} - .*/;

    for (const folder of allFolders) {
        if (groupFolderRegex.test(folder.name)) {
            if (processedItems.some(item => item.id === folder.path)) continue;

            processedItems.push({
                id: folder.path, type: 'Group', name: folder.name, children: [],
                tasks: [], ownTaskCount: 0, descendantTaskCount: 0, frontmatter: {},
            });
        }
    }

    return {
        hierarchicalData: processedItems,
        gtdLists: {},
        allTasks: allTasks,
    };
}
