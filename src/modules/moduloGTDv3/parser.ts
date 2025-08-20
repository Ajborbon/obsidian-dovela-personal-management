import { TFile, Vault, MetadataCache } from 'obsidian';
import type { HierarchicalItem, Task, ProcessedVaultData, HierarchicalItemType, DateSymbol } from './model.js';

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

// Helper function to parse time strings (HH:mm or hham/pm) into minutes from midnight
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

    return null; // Invalid format
}

function parseTasks(content: string, sourceFile: TFile): Task[] {
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
            case 'x':
                status = 'completed';
                completed = true;
                break;
            case '/':
                status = 'in-progress';
                completed = false;
                break;
            default:
                status = 'incomplete';
                completed = false;
                break;
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

        // Conflict detection logic
        if (startTime && endTime) {
            const startMinutes = parseTimeToMinutes(startTime);
            const endMinutes = parseTimeToMinutes(endTime);

            if (startMinutes === null || endMinutes === null) {
                hasConflict = true; // Invalid time format
            } else if (endMinutes <= startMinutes) {
                hasConflict = true; // End time is before or same as start time
            }

            if (duration && !hasConflict && startMinutes !== null && endMinutes !== null) {
                const durationMatch = duration.match(/(\d+)(h|min)/);
                if (durationMatch) {
                    const value = parseInt(durationMatch[1] || '0', 10);
                    const unit = durationMatch[2] || '';
                    const durationMinutes = unit === 'h' ? value * 60 : value;
                    if (endMinutes - startMinutes !== durationMinutes) {
                        hasConflict = true; // Duration does not match start/end times
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
            id,
            content: currentTaskContent,
            status,
            completed,
            priority,
            dependencies,
            contexts,
            assignedPeople,
            tags,
            sourceFile,
            lineNumber: i,
            hasConflict,
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

export async function parseVault(vault: Vault, metadataCache: MetadataCache): Promise<ProcessedVaultData> {
    const processedItems: HierarchicalItem[] = [];
    let allTasks: Task[] = [];
    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    for (const file of vault.getMarkdownFiles()) {
        if (shouldBeExcluded(file)) continue;

        const content = await vault.cachedRead(file);
        const frontmatter = metadataCache.getCache(file.path)?.frontmatter || {};
        const itemType = determineItemType(file, metadataCache);
        const tasks = parseTasks(content, file);
        allTasks = allTasks.concat(tasks);

        // Collect unique contexts and people
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
        navigationItems: [] // Agregamos navigationItems vacío ya que el parser no genera listas GTD
    };
}
