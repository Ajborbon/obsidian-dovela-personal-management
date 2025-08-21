import type { Task, ProcessedVaultData, NavigationItem, DateSymbol } from './focoModel.js';
import { isDatePast, isDateToday, isDateFuture, isWeekPast, isWeekToday, isWeekFuture } from './focoDateUtils.js';
import moment from 'moment';

export enum GtdList {
    Inbox = 'Bandeja de Entrada',
    NextActions = 'Próximas Acciones',
    Calendar = 'Calendario',
    HopeToday = 'Ojalá Hoy',
    Assigned = 'Asignadas o Delegadas',
    Projects = 'Proyectos',
    SomedayMaybe = 'Algún Día / Tal Vez',
    ThisWeekNot = 'Esta Semana No',
    Paused = 'En Pausa',
    Overdue = 'Vencidas',
}

// Define a type for the gtdLists object
type GtdListsData = {
    [GtdList.Inbox]: Task[];
    [GtdList.NextActions]: Map<string, Task[]>;
    [GtdList.Calendar]: Task[];
    [GtdList.HopeToday]: Map<string, Task[]>;
    [GtdList.Assigned]: Map<string, Task[]>;
    [GtdList.Projects]: Task[];
    [GtdList.SomedayMaybe]: Task[];
    [GtdList.ThisWeekNot]: Task[];
    [GtdList.Paused]: Task[];
    [GtdList.Overdue]: Task[];
};

// Función removida - no se usa actualmente

/**
 * Verifica si una tarea tiene dependencias sin resolver
 */
function hasUnresolvedDependencies(task: Task, allTaskMap: Map<string, Task>): boolean {
    return task.dependencies.some(depId => {
        const cleanDepId = depId.replace(/^\^/, '');
        const depTask = allTaskMap.get(cleanDepId);
        return !!(depTask && !depTask.completed);
    });
}

/**
 * Determina el estado de display para tareas regulares (sin dependencias)
 */
function getRegularTaskDisplayStatus(task: Task): Task['displayStatus'] {
    const hasDate = !!task.date;
    
    if (!hasDate) {
        return null;
    }

    let allTaskDates: {symbol: DateSymbol, date: string, isPrimary: boolean}[] = [];
    
    if (task.dateSymbol) {
        allTaskDates.push({
            symbol: task.dateSymbol,
            date: task.date!,
            isPrimary: true
        });
        
        if (task.additionalDates && task.additionalDates.length > 0) {
            allTaskDates.push(...task.additionalDates.map(ad => ({
                symbol: ad.symbol,
                date: ad.date,
                isPrimary: false
            })));
        }
    }

    let hasAnyOverdueDate = false;
    let hasAnyTodayDate = false;
    let hasActiveFutureStart = false;

    for (const dateInfo of allTaskDates) {
        const isDateOverdue = isDatePast(dateInfo.date);
        const isDateTodayMatch = isDateToday(dateInfo.date);
        const isDateFutureStart = dateInfo.symbol === '🛫' && isDateFuture(dateInfo.date);

        if (isDateOverdue && (dateInfo.symbol === '⏳' || dateInfo.symbol === '📅')) {
            hasAnyOverdueDate = true;
        }
        
        if (isDateTodayMatch) {
            hasAnyTodayDate = true;
        }
        
        if (isDateFutureStart) {
            hasActiveFutureStart = true;
        }
    }

    if (hasAnyOverdueDate) {
        return 'overdue';
    } else if (hasAnyTodayDate) {
        return 'today';
    } else if (hasActiveFutureStart) {
        return 'paused-start';
    } else {
        return null;
    }
}

/**
 * Determina el estado de display para tareas con dependencias
 */
function getDependentTaskDisplayStatus(task: Task, allTaskMap: Map<string, Task>): Task['displayStatus'] {
    const hasUnresolvedDeps = hasUnresolvedDependencies(task, allTaskMap);
    
    if (!hasUnresolvedDeps) {
        return getRegularTaskDisplayStatus(task);
    }

    const hasDate = !!task.date;
    if (!hasDate) {
        return 'paused-dep';
    }

    let allTaskDates: {symbol: DateSymbol, date: string, isPrimary: boolean}[] = [];
    
    if (task.dateSymbol) {
        allTaskDates.push({
            symbol: task.dateSymbol,
            date: task.date!,
            isPrimary: true
        });
        
        if (task.additionalDates && task.additionalDates.length > 0) {
            allTaskDates.push(...task.additionalDates.map(ad => ({
                symbol: ad.symbol,
                date: ad.date,
                isPrimary: false
            })));
        }
    }

    let hasOverdueDependentDate = false;

    for (const dateInfo of allTaskDates) {
        const isDateOverdue = isDatePast(dateInfo.date);
        
        if (dateInfo.symbol === '⏳' || dateInfo.symbol === '📅') {
            if (isDateOverdue) {
                hasOverdueDependentDate = true;
            }
        }
    }

    if (hasOverdueDependentDate) {
        return 'overdue';
    } else {
        return 'paused-dep';
    }
}

export function processGtdLists(allTasks: Task[], allTaskMap: Map<string, Task>): Omit<ProcessedVaultData, 'hierarchicalData' | 'allTasks'> {
    const gtdLists: GtdListsData = {
        [GtdList.Inbox]: [],
        [GtdList.NextActions]: new Map(),
        [GtdList.Calendar]: [],
        [GtdList.HopeToday]: new Map(),
        [GtdList.Assigned]: new Map(),
        [GtdList.Projects]: [],
        [GtdList.SomedayMaybe]: [],
        [GtdList.ThisWeekNot]: [],
        [GtdList.Paused]: [],
        [GtdList.Overdue]: [],
    };

    const uniqueContexts = new Set<string>();
    const uniquePeople = new Set<string>();

    const pushToMap = (map: Map<string, Task[]>, key: string, task: Task) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(task);
    };

    for (const task of allTasks) {
        if (task.completed) continue;

        task.contexts.forEach(context => uniqueContexts.add(context));
        task.assignedPeople.forEach(person => uniquePeople.add(person));

        const isPausedByDependency = hasUnresolvedDependencies(task, allTaskMap);

        const hasDate = !!task.date;
        const hasContext = task.contexts.length > 0;
        const hasAssigned = task.assignedPeople.length > 0;

        // Validación de fechas y determinación de estados
        let hasInvalidDateConfiguration = false;
        let isStartDate = false;
        let isDueDate = false;
        let isCalendarItem = false;
        let isHopeTodayCandidate = false;

        if (hasDate && task.dateSymbol) {
            isStartDate = task.dateSymbol === '🛫';
            isDueDate = task.dateSymbol === '📅';
            const taskDate = task.date!;
            
            if (isStartDate) {
                if (task.additionalDates && task.additionalDates.length > 0) {
                    for (const additionalDate of task.additionalDates) {
                        if (additionalDate.symbol === '⏳' || additionalDate.symbol === '📅') {
                            if (moment(taskDate).isAfter(moment(additionalDate.date), 'day')) {
                                hasInvalidDateConfiguration = true;
                                break;
                            }
                        }
                    }
                } else {
                    const scheduleMatch = task.content.match(/⏳\s*(\d{4}-\d{2}-\d{2})/);
                    const dueMatch = task.content.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    
                    if (scheduleMatch && moment(taskDate).isAfter(moment(scheduleMatch[1]), 'day')) {
                        hasInvalidDateConfiguration = true;
                    }
                    if (dueMatch && moment(taskDate).isAfter(moment(dueMatch[1]), 'day')) {
                        hasInvalidDateConfiguration = true;
                    }
                }
            }
            
            isCalendarItem = isDueDate && !!task.startTime;
            
            if (!task.startTime) {
                if ((task.dateSymbol === '⏳' || task.dateSymbol === '📅') && isDateToday(task.date!)) {
                    isHopeTodayCandidate = true;
                }
                
                if (task.additionalDates && task.additionalDates.length > 0) {
                    for (const additionalDate of task.additionalDates) {
                        if ((additionalDate.symbol === '⏳' || additionalDate.symbol === '📅') && 
                            isDateToday(additionalDate.date)) {
                            isHopeTodayCandidate = true;
                            break;
                        }
                    }
                }
            }
        }

        const isWeekFutureFlag = !!task.week && isWeekFuture(task.week!);

        // Compute displayStatus usando las funciones especializadas
        if (hasInvalidDateConfiguration) {
            task.displayStatus = null;
        } else if (isPausedByDependency) {
            task.displayStatus = getDependentTaskDisplayStatus(task, allTaskMap);
        } else if (isWeekFutureFlag) {
            task.displayStatus = 'paused-start';
        } else {
            task.displayStatus = getRegularTaskDisplayStatus(task);
        }

        if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }
        if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        if (task.hasConflict || task.tags.includes('inbox') || hasInvalidDateConfiguration ||
            (task.date && !hasContext && !hasAssigned && (isDatePast(task.date) || isDateToday(task.date))) ||
            (task.week && !hasContext && !hasAssigned && (isWeekPast(task.week!) || isWeekToday(task.week!)))
        ) {
            gtdLists[GtdList.Inbox].push(task);
            if (hasInvalidDateConfiguration) {
                continue;
            }
        }

        // Sistema de doble/triple listado para dependencias
        if (isPausedByDependency || isWeekFutureFlag || task.displayStatus === 'paused-start') {
            gtdLists[GtdList.Paused].push(task);
            
            if (task.displayStatus === 'paused-start' && !isPausedByDependency) {
                continue;
            }
        }

        if (isCalendarItem) {
            gtdLists[GtdList.Calendar].push(task);
        }

        // Overdue - Incluir tareas vencidas (incluyendo dependencias vencidas)
        if (task.displayStatus === 'overdue') {
            gtdLists[GtdList.Overdue].push(task);
        }

        // Hope Today - Incluir dependencias con fechas de hoy
        if (isHopeTodayCandidate || 
            (isPausedByDependency && task.displayStatus === 'paused-dep' && 
             ((hasDate && isDateToday(task.date!)) || 
              (task.additionalDates && task.additionalDates.some(ad => 
                  (ad.symbol === '⏳' || ad.symbol === '📅') && isDateToday(ad.date)
              ))
             )
            )) {
            if (task.contexts.length > 0) {
                task.contexts.forEach(context => {
                    const key = `cx-${context}`;
                    pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
                });
            }
            
            if (task.assignedPeople.length > 0) {
                task.assignedPeople.forEach(person => {
                    const key = `px-${person}`;
                    pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
                });
            }
            
            if (task.contexts.length === 0 && task.assignedPeople.length === 0) {
                const key = 'cx-Sin Contexto';
                pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
            }
        }

        if (hasAssigned) {
            task.assignedPeople.forEach(person => {
                const key = `px-${person}`;
                pushToMap(gtdLists[GtdList.Assigned] as Map<string, Task[]>, key, task);
            });
        }

        if (hasContext) {
            task.contexts.forEach(context => {
                const key = `cx-${context}`;
                pushToMap(gtdLists[GtdList.NextActions] as Map<string, Task[]>, key, task);
            });
        } else if (isStartDate && task.date && (isDatePast(task.date) || isDateToday(task.date))) {
            const key = 'cx-Sin Contexto';
            pushToMap(gtdLists[GtdList.NextActions] as Map<string, Task[]>, key, task);
        }

        if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);
        }

        const inAnyList = (
            gtdLists[GtdList.Calendar].includes(task) ||
            gtdLists[GtdList.Overdue].includes(task) ||
            Array.from((gtdLists[GtdList.HopeToday] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            Array.from((gtdLists[GtdList.Assigned] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            Array.from((gtdLists[GtdList.NextActions] as Map<string, Task[]>).values()).some(arr => arr.includes(task)) ||
            gtdLists[GtdList.Projects].includes(task) ||
            gtdLists[GtdList.Paused].includes(task) ||
            gtdLists[GtdList.Inbox].includes(task)
        );

        if (!inAnyList) {
            gtdLists[GtdList.Inbox].push(task);
        }
    }

    const navigationItems = generateNavigationItems(gtdLists);

    return { 
        gtdLists, 
        uniqueContexts: Array.from(uniqueContexts).sort((a, b) => a.localeCompare(b)), 
        uniquePeople: Array.from(uniquePeople).sort((a, b) => a.localeCompare(b)), 
        inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } },
        navigationItems
    };
}

function generateNavigationItems(gtdLists: GtdListsData): NavigationItem[] {
    const navigationItems: NavigationItem[] = [];
    
    const createAnchorId = (text: string): string => {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    };
    
    for (const [listName, tasks] of Object.entries(gtdLists) as [string, Task[] | Map<string, Task[]>][]) {
        let totalTasksInList = 0;
        const listId = createAnchorId(listName);
        
        if (Array.isArray(tasks)) {
            totalTasksInList = tasks.length;
        } else if (tasks instanceof Map) {
            totalTasksInList = Array.from(tasks.values()).reduce((sum, arr: Task[]) => sum + arr.length, 0);
        }
        
        if (totalTasksInList > 0) {
            navigationItems.push({
                id: `gtd-list-${listId}`,
                label: listName,
                count: totalTasksInList,
                icon: getListIcon(listName as GtdList),
                isSublist: false,
                anchor: `gtd-list-${listId}`
            });
            
            if (tasks instanceof Map) {
                const sortedKeys = Array.from(tasks.keys()).sort();
                
                sortedKeys.forEach((sublistKey: string) => {
                    const sublistTasks = tasks.get(sublistKey);
                    if (sublistTasks && sublistTasks.length > 0) {
                        const sublistId = createAnchorId(`${listName}-${sublistKey}`);
                        
                        navigationItems.push({
                            id: sublistId,
                            label: sublistKey,
                            count: sublistTasks.length,
                            icon: getSublistIcon(listName as GtdList, sublistKey),
                            isSublist: true,
                            parentList: `gtd-list-${listId}`,
                            anchor: sublistId
                        });
                    }
                });
            }
        }
    }
    
    return navigationItems;
}

function getListIcon(listName: GtdList): string {
    const iconMap: Record<GtdList, string> = {
        [GtdList.Inbox]: '📥',
        [GtdList.NextActions]: '➡️',
        [GtdList.Calendar]: '📅',
        [GtdList.HopeToday]: '🌟',
        [GtdList.Assigned]: '👥',
        [GtdList.Projects]: '💼',
        [GtdList.SomedayMaybe]: '🕰️',
        [GtdList.ThisWeekNot]: '⛔',
        [GtdList.Paused]: '⏸️',
        [GtdList.Overdue]: '⚠️'
    };
    
    return iconMap[listName] || '📋';
}

function getSublistIcon(listName: GtdList, sublistKey: string): string {
    if (listName === GtdList.NextActions || listName === GtdList.HopeToday) {
        if (sublistKey.startsWith('#cx-') || sublistKey.startsWith('cx-')) {
            return '📋';
        }
        if (sublistKey.startsWith('#px-') || sublistKey.startsWith('@') || sublistKey.startsWith('px-')) {
            return '👤';
        }
    }
    
    if (listName === GtdList.Assigned) {
        return '👤';
    }
    
    return '📋';
}
