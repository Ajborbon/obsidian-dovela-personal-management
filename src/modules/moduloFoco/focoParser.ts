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
        
        // NUEVA FUNCIÓN: Extraer dependencias SIN limpiar el contenido
        const extractDependenciesWithoutCleaning = (content: string): string[] => {
            const dependencyRegex = /⛔\s*(\^?[a-zA-Z0-9]+)/g;
            const matches = Array.from(content.matchAll(dependencyRegex));
            return matches.map(match => match[1] || '').filter(id => id.length > 0);
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
        const dependencies = extractDependenciesWithoutCleaning(currentTaskContent);
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
    console.log('🔍 COLLECT DEBUG: Iniciando collectFocusFiles');
    console.log('🔍 COLLECT DEBUG: activeFile:', activeFile.path);
    console.log('🔍 COLLECT DEBUG: parent folder:', activeFile.parent?.path);
    
    const focusFiles = new Set<TFile>();
    const processedPaths = new Set<string>();

    // 1. Add the active file itself
    console.log('🔍 COLLECT DEBUG: Añadiendo archivo activo');
    focusFiles.add(activeFile);
    processedPaths.add(activeFile.path);

    // 2. Get all files in the same folder and subfolders
    console.log('🔍 COLLECT DEBUG: Recolectando archivos de carpeta...');
    const rootFolder = activeFile.parent;
    if (rootFolder) {
        console.log('🔍 COLLECT DEBUG: Carpeta raíz encontrada:', rootFolder.path);
        const allDescendantFiles = (folder: TFolder): TFile[] => {
            let files: TFile[] = [];
            for (const child of folder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    console.log(`🔍 COLLECT DEBUG: Archivo MD encontrado: ${child.path}`);
                    files.push(child);
                } else if (child instanceof TFile) {
                    console.log(`🔍 COLLECT DEBUG: Archivo no-MD saltado (${child.extension}): ${child.path}`);
                } else if (child instanceof TFolder) {
                    files = files.concat(allDescendantFiles(child));
                }
            }
            return files;
        };
        const folderFiles = allDescendantFiles(rootFolder);
        console.log('🔍 COLLECT DEBUG: Archivos de carpeta encontrados:', folderFiles.length);
        folderFiles.forEach(file => {
            focusFiles.add(file);
            processedPaths.add(file.path);
        });
    } else {
        console.log('🔍 COLLECT DEBUG: No se encontró carpeta padre');
    }

    // 3. Get linked files recursively (2 levels)
    console.log('🔍 COLLECT DEBUG: Recolectando archivos enlazados...');
    const getLinkedFiles = (fileSet: Set<TFile>): Set<TFile> => {
        const newFiles = new Set<TFile>();
        for (const file of fileSet) {
            const cache = metadataCache.getCache(file.path);
            if (!cache?.links) continue;

            for (const link of cache.links) {
                const linkedFile = metadataCache.getFirstLinkpathDest(link.link, file.path);
                if (linkedFile instanceof TFile && 
                    linkedFile.extension === 'md' && 
                    !processedPaths.has(linkedFile.path)) {
                    console.log(`🔍 COLLECT DEBUG: Archivo enlazado MD encontrado: ${linkedFile.path}`);
                    newFiles.add(linkedFile);
                    processedPaths.add(linkedFile.path);
                } else if (linkedFile instanceof TFile && linkedFile.extension !== 'md') {
                    console.log(`🔍 COLLECT DEBUG: Archivo enlazado no-MD saltado (${linkedFile.extension}): ${linkedFile.path}`);
                }
            }
        }
        return newFiles;
    };

    const level1Files = getLinkedFiles(new Set(focusFiles));
    console.log('🔍 COLLECT DEBUG: Archivos nivel 1:', level1Files.size);
    level1Files.forEach(file => focusFiles.add(file));

    const level2Files = getLinkedFiles(level1Files);
    console.log('🔍 COLLECT DEBUG: Archivos nivel 2:', level2Files.size);
    level2Files.forEach(file => focusFiles.add(file));

    console.log('🔍 COLLECT DEBUG: Total archivos recolectados:', focusFiles.size);
    console.log('🔍 COLLECT DEBUG: Lista de archivos:', Array.from(focusFiles).map(f => f.path));
    
    return focusFiles;
}


export async function parseFocus(activeFile: TFile, vault: Vault, metadataCache: MetadataCache): Promise<ProcessedVaultData> {
    console.log('🔍 PARSER DEBUG: Iniciando parseFocus');
    console.log('🔍 PARSER DEBUG: activeFile:', activeFile.path);
    
    const processedItems: HierarchicalItem[] = [];
    let allTasks: Task[] = [];
    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    try {
        console.log('🔍 PARSER DEBUG: Recolectando archivos de foco...');
        const filesToProcess = await collectFocusFiles(activeFile, vault, metadataCache);
        console.log('🔍 PARSER DEBUG: Archivos recolectados:', filesToProcess.size);
        console.log('🔍 PARSER DEBUG: Lista de archivos:', Array.from(filesToProcess).map(f => f.path));
        
        let processedCount = 0;
        for (const file of filesToProcess) {
            console.log(`🔍 PARSER DEBUG: Procesando archivo ${++processedCount}/${filesToProcess.size}: ${file.path}`);
            
            try {
                // Verificar si el archivo existe primero
                console.log(`🔍 PARSER DEBUG: Verificando existencia de: ${file.path}`);
                const exists = await vault.adapter.exists(file.path);
                console.log(`🔍 PARSER DEBUG: Archivo existe: ${exists}`);
                
                if (!exists) {
                    console.warn(`🔍 PARSER DEBUG: Archivo no existe, saltando: ${file.path}`);
                    continue;
                }
                
                console.log(`🔍 PARSER DEBUG: Leyendo contenido de: ${file.path}`);
                const content = await vault.cachedRead(file);
                console.log(`🔍 PARSER DEBUG: Contenido leído exitosamente, longitud: ${content.length}`);
                
                console.log(`🔍 PARSER DEBUG: Obteniendo frontmatter y tipo de item...`);
                const frontmatter = metadataCache.getCache(file.path)?.frontmatter || {};
                const itemType = determineItemType(file, metadataCache);
                console.log(`🔍 PARSER DEBUG: Tipo de item determinado: ${itemType}`);
                
                console.log(`🔍 PARSER DEBUG: Parseando tareas...`);
                const tasks = parseTasks(content, file);
                console.log(`🔍 PARSER DEBUG: Tareas parseadas: ${tasks.length}`);
                
                allTasks = allTasks.concat(tasks);

                tasks.forEach(task => {
                    task.contexts.forEach(context => uniqueContexts.add(context));
                    task.assignedPeople.forEach(person => uniquePeople.add(person));
                });
                
                console.log(`🔍 PARSER DEBUG: Creando item jerarquico...`);
                processedItems.push({
                    id: file.path, type: itemType, name: file.basename, file: file,
                    children: [], tasks: tasks, ownTaskCount: tasks.filter(t => !t.completed).length, descendantTaskCount: 0, frontmatter: frontmatter,
                });
                
                console.log(`🔍 PARSER DEBUG: Archivo procesado exitosamente: ${file.path}`);
            } catch (fileError) {
                console.error(`🔍 PARSER DEBUG: Error procesando archivo ${file.path}:`, fileError);
                console.error(`🔍 PARSER DEBUG: Error type:`, typeof fileError);
                console.error(`🔍 PARSER DEBUG: Error message:`, (fileError as any)?.message || 'No message available');
                console.error(`🔍 PARSER DEBUG: Error code:`, (fileError as any)?.code);
                console.error(`🔍 PARSER DEBUG: Error stack:`, (fileError as any)?.stack || 'No stack available');
                // Continuar con el siguiente archivo en lugar de fallar completamente
                console.log(`🔍 PARSER DEBUG: Continuando con el siguiente archivo...`);
                continue;
            }
        }

        console.log('🔍 PARSER DEBUG: Creando resultado final...');
        console.log('🔍 PARSER DEBUG: Items procesados:', processedItems.length);
        console.log('🔍 PARSER DEBUG: Total tareas:', allTasks.length);
        console.log('🔍 PARSER DEBUG: Contextos únicos:', uniqueContexts.size);
        console.log('🔍 PARSER DEBUG: Personas únicas:', uniquePeople.size);
        
        const result = {
            hierarchicalData: processedItems,
            gtdLists: {},
            allTasks: allTasks,
            uniqueContexts: Array.from(uniqueContexts),
            uniquePeople: Array.from(uniquePeople),
            inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } },
            navigationItems: [] // Agregamos navigationItems vacío ya que se generará en el processor
        };
        
        console.log('🔍 PARSER DEBUG: parseFocus completado exitosamente');
        return result;
        
    } catch (error) {
        console.error('🔍 PARSER DEBUG: Error general en parseFocus:', error);
        console.error('🔍 PARSER DEBUG: Error type:', typeof error);
        console.error('🔍 PARSER DEBUG: Error message:', (error as any)?.message || 'No message available');
        console.error('🔍 PARSER DEBUG: Error stack:', (error as any)?.stack || 'No stack available');
        throw error;
    }
}
