import { TFile, Vault, MetadataCache, TFolder } from 'obsidian';
import type { HierarchicalItem, Task, ProcessedVaultData, HierarchicalItemType, DateSymbol } from './focoModel.js';

// --- Lógica de Detección de Tipo (sin cambios) ---
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

// --- Lógica de Parseo de Tareas (sin cambios) ---
function parseTimeToMinutes(timeStr: string | undefined): number | null {
    if (!timeStr) return null;
    const ampmMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1] || "0", 10);
        const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
        const period = (ampmMatch[3] || "").toLowerCase();
        if (hours === 12) {
            hours = period === 'am' ? 0 : 12;
        } else if (period === 'pm' && hours < 12) {
            hours += 12;
        }
        return hours * 60 + minutes;
    }
    const militaryMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        const hours = parseInt(militaryMatch[1] || "0", 10);
        const minutes = parseInt(militaryMatch[2] || "0", 10);
        return hours * 60 + minutes;
    }
    return null;
}
export function parseTasks(content: string, sourceFile: TFile): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');
    const taskRegex = /^\s*-\s+\[( |x|X|\/)\]\s+(.*)/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const match = line.match(taskRegex);
        if (!match || !match[2]) continue;
        let currentTaskContent: string = match[2];
        const statusChar = match[1] || ' ';
        let status: Task['status'];
        let completed: boolean;
        switch (statusChar.toLowerCase()) {
            case 'x': status = 'completed'; completed = true; break;
            case '/': status = 'in-progress'; completed = false; break;
            default: status = 'incomplete'; completed = false; break;
        }
        const extractAndClean = (regex: RegExp): string | undefined => {
            const matchResult = currentTaskContent.match(regex);
            if (matchResult && matchResult[1] !== undefined) {
                currentTaskContent = currentTaskContent.replace(regex, '').trim();
                return matchResult[1];
            }
            return undefined;
        };
        const extractAndCleanAll = (regex: RegExp): string[] => {
            const allMatches = currentTaskContent.match(regex);
            if (allMatches) {
                currentTaskContent = currentTaskContent.replace(regex, '').trim();
                return allMatches.map(match => {
                    const captureGroup = new RegExp(regex.source.replace(/\\g$/, '')).exec(match);
                    return captureGroup && captureGroup[1] !== undefined ? captureGroup[1] : null;
                }).filter((value): value is string => value !== null);
            }
            return [];
        };
        const dateRegex = /(🛫|⏳|📅)\s*(\d{4}-\d{2}-\d{2})/;
        const dateMatch = currentTaskContent.match(dateRegex);
        let date: string | undefined;
        let dateSymbol: DateSymbol | undefined;
        if (dateMatch) {
            dateSymbol = dateMatch[1] as DateSymbol;
            date = dateMatch[2];
            currentTaskContent = currentTaskContent.replace(dateRegex, '').trim();
        }
        const id = extractAndClean(/\s*(?:\^|🆔)\s*([a-zA-Z0-9]+)/) || crypto.randomUUID();
        const startTime = extractAndClean(/ \[hI::\s*([^\]]+)\]/);
        const endTime = extractAndClean(/ \[hF::\s*([^\]]+)\]/);
        const duration = extractAndClean(/ \[([0-9]+h|[0-9]+min)\]/);
        const week = extractAndClean(/ \[w::\s*(\[\[\d{4}-W\d{2}\]\])\]/);
        const dependencies = extractAndCleanAll(/⛔\s*(\^?[a-zA-Z0-9]+)/g);
        const contexts = extractAndCleanAll(/#cx-([\w-]+)/g);
        const assignedPeople = extractAndCleanAll(/#px-([\w-]+)/g);
        const tags = extractAndCleanAll(/#(GTD-AlgunDia|GTD-EstaSemanaNo|inbox)/g);
        let hasConflict = false;
        if (startTime && endTime) {
            const startMinutes = parseTimeToMinutes(startTime);
            const endMinutes = parseTimeToMinutes(endTime);
            if (startMinutes === null || endMinutes === null) {
                hasConflict = true;
            } else if (endMinutes <= startMinutes) {
                hasConflict = true;
            }
            if (duration && !hasConflict && startMinutes !== null && endMinutes !== null) {
                const durationMatch = duration.match(/(\d+)(h|min)/);
                if (durationMatch) {
                    const value = parseInt(durationMatch[1] || '0', 10);
                    const unit = durationMatch[2] || '';
                    const durationMinutes = unit === 'h' ? value * 60 : value;
                    if (endMinutes - startMinutes !== durationMinutes) {
                        hasConflict = true;
                    }
                }
            }
        }
        const priorityMatch = currentTaskContent.match(/(⏫|🔼|🔽|⏬)/);
        let priority: Task['priority'] = 'None';
        if (priorityMatch) {
            const prioritySymbol = priorityMatch[0];
            if (prioritySymbol === '⏫') priority = 'Highest';
            else if (prioritySymbol === '🔼') priority = 'High';
            else if (prioritySymbol === '🔽') priority = 'Medium';
            else if (prioritySymbol === '⏬') priority = 'Low';
            currentTaskContent = currentTaskContent.replace(prioritySymbol, '').trim();
        }
        const task: Task = {
            id, content: currentTaskContent, status, completed, priority,
            dependencies, contexts, assignedPeople, tags, sourceFile, lineNumber: i, hasConflict,
        };
        if (date) task.date = date;
        if (dateSymbol) task.dateSymbol = dateSymbol;
        if (startTime) task.startTime = startTime;
        if (endTime) task.endTime = endTime;
        if (duration) task.duration = duration;
        if (week) task.week = week;
        tasks.push(task);
    }
    return tasks;
}

// --- NUEVA LÓGICA DE RECOLECCIÓN ---

async function collectFocusFiles(activeFile: TFile, _vault: Vault, metadataCache: MetadataCache): Promise<Set<TFile>> {
    const focusFiles = new Set<TFile>();
    const processedPaths = new Set<string>();

    // 1. Add the active file itself
    focusFiles.add(activeFile);
    processedPaths.add(activeFile.path);

    // 2. Get all files in the same folder and subfolders
    const rootFolder = activeFile.parent;
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
            focusFiles.add(file);
            processedPaths.add(file.path);
        });
    }

    // 3. Get linked files recursively (2 levels)
    const getLinkedFiles = (fileSet: Set<TFile>): Set<TFile> => {
        const newFiles = new Set<TFile>();
        for (const file of fileSet) {
            const cache = metadataCache.getCache(file.path);
            if (!cache?.links) continue;

            for (const link of cache.links) {
                const linkedFile = metadataCache.getFirstLinkpathDest(link.link, file.path);
                if (linkedFile instanceof TFile && !processedPaths.has(linkedFile.path)) {
                    newFiles.add(linkedFile);
                    processedPaths.add(linkedFile.path);
                }
            }
        }
        return newFiles;
    };

    const level1Files = getLinkedFiles(new Set(focusFiles));
    level1Files.forEach(file => focusFiles.add(file));

    const level2Files = getLinkedFiles(level1Files);
    level2Files.forEach(file => focusFiles.add(file));

    return focusFiles;
}


export async function parseFocus(activeFile: TFile, vault: Vault, metadataCache: MetadataCache): Promise<ProcessedVaultData> {
    const processedItems: HierarchicalItem[] = [];
    let allTasks: Task[] = [];
    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    const filesToProcess = await collectFocusFiles(activeFile, vault, metadataCache);

    for (const file of filesToProcess) {
        // We can skip explicit exclusion here if we want the focus view to be all-encompassing
        // or add a lighter version of it. For now, let's process all collected files.

        const content = await vault.cachedRead(file);
        const frontmatter = metadataCache.getCache(file.path)?.frontmatter || {};
        const itemType = determineItemType(file, metadataCache);
        const tasks = parseTasks(content, file);
        allTasks = allTasks.concat(tasks);

        tasks.forEach(task => {
            task.contexts.forEach(context => uniqueContexts.add(context));
            task.assignedPeople.forEach(person => uniquePeople.add(person));
        });

        processedItems.push({
            id: file.path, type: itemType, name: file.basename, file: file,
            children: [], tasks: tasks, ownTaskCount: tasks.filter(t => !t.completed).length, descendantTaskCount: 0, frontmatter: frontmatter,
        });
    }

    return {
        hierarchicalData: processedItems,
        gtdLists: {},
        allTasks: allTasks,
        uniqueContexts: Array.from(uniqueContexts),
        uniquePeople: Array.from(uniquePeople),
        inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } },
        navigationItems: [] // Agregamos navigationItems vacío ya que se generará en el processor
    };
}
