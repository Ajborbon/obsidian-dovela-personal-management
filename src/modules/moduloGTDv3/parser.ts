

import { TFile, Vault, MetadataCache } from 'obsidian';
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
    'GrupoAV': 'GrupoAV', 'Dly': 'Dly', 'Wk': 'Wk', 'M': 'M', 'Q': 'Q', 'H': 'H', 'Y': 'Y',
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
        if (taskContent === undefined) continue;

        const completed = match[1]?.toLowerCase() === 'x';

        const extractAndClean = (regex: RegExp): string | undefined => {
            const match = taskContent?.match(regex);
            if (match && taskContent) {
                taskContent = taskContent.replace(regex, '').trim();
                return match[1];
            }
            return undefined;
        };

        const extractAndCleanAll = (regex: RegExp): string[] => {
            const allMatches = taskContent?.match(regex);
            if (allMatches && taskContent) {
                taskContent = taskContent.replace(regex, '').trim();
                return allMatches.map(match => {
                    const captureGroup = new RegExp(regex.source.replace(/\\g$/, '')).exec(match);
                    return captureGroup ? captureGroup[1] : null;
                }).filter((value): value is string => value !== null);
            }
            return [];
        };

        const id = extractAndClean(/\s+\^([a-zA-Z0-9]+)/) || crypto.randomUUID();
        const startDate = extractAndClean(/📅\s*(\d{4}-\d{2}-\d{2})/);
        const dueDate = extractAndClean(/⏳\s*(\d{4}-\d{2}-\d{2})/);
        const startTime = extractAndClean(/\[hI::\s*([^\]]+)\]/);
        const endTime = extractAndClean(/\[hF::\s*([^\]]+)\]/);
        const duration = extractAndClean(/\[(\d+h|\d+min)\]/);
        const week = extractAndClean(/\[w::\s*(\[\[\d{4}-W\d{2}\]\])\]/);
        const dependencies = extractAndCleanAll(/⛔\s*([a-zA-Z0-9]+)/g);
        const contexts = extractAndCleanAll(/#cx-([\w-]+)/g);
        const assignedPeople = extractAndCleanAll(/#px-([\w-]+)/g);
        const tags = extractAndCleanAll(/#(GTD-AlgunDia|GTD-EstaSemanaNo|inbox)/g);

        const priorityMatch = taskContent?.match(/(⏫|🔼|🔽|⏬)/);
        let priority: Task['priority'] = 'None';
        if (priorityMatch && taskContent) {
            const prioritySymbol = priorityMatch[0];
            if (prioritySymbol === '⏫') priority = 'Highest';
            else if (prioritySymbol === '🔼') priority = 'High';
            else if (prioritySymbol === '🔽') priority = 'Medium';
            else if (prioritySymbol === '⏬') priority = 'Low';
            taskContent = taskContent.replace(prioritySymbol, '').trim();
        }

        const task: Task = {
            id,
            content: taskContent || '',
            completed,
            priority,
            dependencies,
            contexts,
            assignedPeople,
            tags,
            sourceFile,
            lineNumber: i,
        };

        if (startDate) task.startDate = startDate;
        if (dueDate) task.dueDate = dueDate;
        if (startTime) task.startTime = startTime;
        if (endTime) task.endTime = endTime;
        if (duration) task.duration = duration;
        if (week) task.week = week;

        tasks.push(task);
    }
    return tasks;
}

export async function parseVault(vault: Vault, metadataCache: MetadataCache): Promise<ProcessedVaultData> {
    const processedItems: HierarchicalItem[] = [];
    let allTasks: Task[] = [];

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

    return {
        hierarchicalData: processedItems,
        gtdLists: {},
        allTasks: allTasks,
    };
}
