
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
    [GtdList.HopeToday]: Map<string, Task[]>; // Changed to Map for grouping
    [GtdList.Assigned]: Map<string, Task[]>; // Changed to Map for grouping
    [GtdList.Projects]: Task[];
    [GtdList.SomedayMaybe]: Task[];
    [GtdList.ThisWeekNot]: Task[];
    [GtdList.Paused]: Task[];
    [GtdList.Overdue]: Task[];
};

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

    // Helper to push into a Map<string, Task[]>
    const pushToMap = (map: Map<string, Task[]>, key: string, task: Task) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(task);
    };

    for (const task of allTasks) {
        if (task.completed) continue;

        // Collect contexts and people only from open tasks
        task.contexts.forEach(context => uniqueContexts.add(context));
        task.assignedPeople.forEach(person => uniquePeople.add(person));

        const isPausedByDependency = task.dependencies.some(depId => {
            const depTask = allTaskMap.get(depId.replace(/^\^/, '')); // Handle IDs with or without '^'
            return !!(depTask && !depTask.completed);
        });

        const hasDate = !!task.date;
        const hasContext = task.contexts.length > 0;
        const hasAssigned = task.assignedPeople.length > 0;

        // NUEVA LÓGICA MEJORADA: Detección de fechas y estados para colores
        let hasInvalidDateConfiguration = false;
        let isStartDate = false;
        let isDueDate = false;
        let isOverdue = false;
        let isToday = false;
        let isFutureStart = false;
        let isCalendarItem = false;
        let isHopeTodayCandidate = false;

        // Colección de todas las fechas presentes en la tarea para análisis de colores
        let allTaskDates: {symbol: DateSymbol, date: string, isPrimary: boolean}[] = [];

        if (hasDate && task.dateSymbol) {
            isStartDate = task.dateSymbol === '🛫';
            isDueDate = task.dateSymbol === '📅';

            // Agregar fecha principal
            allTaskDates.push({
                symbol: task.dateSymbol,
                date: task.date!,
                isPrimary: true
            });

            // Agregar fechas adicionales si existen
            if (task.additionalDates && task.additionalDates.length > 0) {
                allTaskDates.push(...task.additionalDates.map(ad => ({
                    symbol: ad.symbol,
                    date: ad.date,
                    isPrimary: false
                })));
            }

            const taskDate = task.date!;
            
            // Validar coherencia de fechas: Start date no puede ser posterior a Schedule/Due dates
            if (isStartDate) {
                // NUEVA LÓGICA: Validar coherencia usando fechas adicionales capturadas por el parser
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
                    // Fallback: buscar en el contenido de la tarea (método anterior)
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

            // NUEVA LÓGICA: Análisis de fechas para colores mejorado
            let hasAnyOverdueDate = false;
            let hasAnyTodayDate = false;
            let hasActiveFutureStart = false;

            // Analizar TODAS las fechas presentes en la tarea
            for (const dateInfo of allTaskDates) {
                const isDateOverdue = isDatePast(dateInfo.date);
                const isDateTodayMatch = isDateToday(dateInfo.date);
                const isDateFutureStart = dateInfo.symbol === '🛫' && isDateFuture(dateInfo.date);

                // Para ROJOS: cualquier fecha vencida (Schedule o Due)
                if (isDateOverdue && (dateInfo.symbol === '⏳' || dateInfo.symbol === '📅')) {
                    hasAnyOverdueDate = true;
                }
                
                // Para VERDES: cualquier fecha que coincida con hoy
                if (isDateTodayMatch) {
                    hasAnyTodayDate = true;
                }
                
                // Para AZULES: Start date futuro
                if (isDateFutureStart) {
                    hasActiveFutureStart = true;
                }
            }

            // Asignar estados basados en análisis de todas las fechas
            isOverdue = hasAnyOverdueDate;
            isToday = hasAnyTodayDate;
            isFutureStart = hasActiveFutureStart;
            
            // Mantener lógica específica para algunos casos
            isCalendarItem = isDueDate && !!task.startTime;
            
            // NUEVA LÓGICA MEJORADA: Hope Today - Detectar cualquier fecha Schedule/Due = hoy
            // Incluye tanto fecha principal como fechas adicionales
            let hasScheduleOrDueToday = false;
            
            // Verificar en TODAS las fechas de la tarea
            for (const dateInfo of allTaskDates) {
                if ((dateInfo.symbol === '⏳' || dateInfo.symbol === '📅') && 
                    isDateToday(dateInfo.date) && 
                    !task.startTime) { // Sin hora de inicio para evitar Calendar items
                    hasScheduleOrDueToday = true;
                    break;
                }
            }
            
            isHopeTodayCandidate = hasScheduleOrDueToday;
        }

        const isWeekFutureFlag = !!task.week && isWeekFuture(task.week!);

        // NUEVA LÓGICA: Compute displayStatus con prioridades mejoradas
        // Orden de prioridad: invalid > overdue > today > paused-dep > paused-start > future
        if (hasInvalidDateConfiguration) {
            task.displayStatus = null; // Las tareas inválidas no tienen estado especial, van a Inbox
        } else if (isOverdue) {
            task.displayStatus = 'overdue';
        } else if (isToday) {
            task.displayStatus = 'today';
        } else if (isPausedByDependency) {
            task.displayStatus = 'paused-dep';
        } else if (isFutureStart || isWeekFutureFlag) {
            task.displayStatus = 'paused-start';
        } else {
            task.displayStatus = null;
        }

        // Exclusive lists: SomedayMaybe y ThisWeekNot per requirement
        if (task.tags.includes('GTD-AlgunDia')) {
            gtdLists[GtdList.SomedayMaybe].push(task);
            continue;
        }
        if (task.tags.includes('GTD-EstaSemanaNo')) {
            gtdLists[GtdList.ThisWeekNot].push(task);
            continue;
        }

        // NUEVA LÓGICA: Inbox - Incluir tareas con configuración de fechas inválida
        if (task.hasConflict || task.tags.includes('inbox') || hasInvalidDateConfiguration ||
            (task.date && !hasContext && !hasAssigned && (isDatePast(task.date) || isDateToday(task.date))) ||
            (task.week && !hasContext && !hasAssigned && (isWeekPast(task.week!) || isWeekToday(task.week!)))
        ) {
            gtdLists[GtdList.Inbox].push(task);
            // Si la tarea tiene fechas inválidas, NO debe aparecer en otras listas
            if (hasInvalidDateConfiguration) {
                continue;
            }
            // Para otras condiciones de Inbox, continúa el procesamiento normal
        }

        // NUEVA LÓGICA: Paused - Incluir tareas con start date futuro
        if (isPausedByDependency || isWeekFutureFlag || isFutureStart) {
            gtdLists[GtdList.Paused].push(task);
            // Las tareas pausadas por start date futuro NO deben aparecer en otras listas activas
            if (isFutureStart) {
                continue;
            }
            // Para otras pausas (dependencias, semana futura), continúa el procesamiento
        }

        // Calendar: scheduled items with start time
        if (isCalendarItem) {
            gtdLists[GtdList.Calendar].push(task);
        }

        // NUEVA LÓGICA CONSOLIDADA: Overdue - Incluir tareas vencidas una sola vez
        // Verificar si debe ir a Overdue por cualquier razón y agregarlo solo una vez
        let shouldAddToOverdue = false;
        
        // Caso 1: Tareas vencidas normales (Schedule/Due vencidas con contexto o asignación)
        if (isOverdue && (hasContext || hasAssigned)) {
            shouldAddToOverdue = true;
        }
        
        // Caso 2: Start dates vencidas con fechas adicionales vencidas
        if (isStartDate && task.date && isDatePast(task.date)) {
            if (task.additionalDates && task.additionalDates.length > 0) {
                for (const additionalDate of task.additionalDates) {
                    if ((additionalDate.symbol === '⏳' || additionalDate.symbol === '📅') && 
                        isDatePast(additionalDate.date)) {
                        shouldAddToOverdue = true;
                        break;
                    }
                }
            } else {
                // Fallback al método anterior
                const hasOtherOverdueDate = task.content.match(/(⏳|📅)\s*(\d{4}-\d{2}-\d{2})/);
                if (hasOtherOverdueDate && hasOtherOverdueDate[2] && isDatePast(hasOtherOverdueDate[2])) {
                    shouldAddToOverdue = true;
                }
            }
        }
        
        // Agregar a Overdue solo una vez si cumple cualquier condición
        if (shouldAddToOverdue) {
            gtdLists[GtdList.Overdue].push(task);
        }

        // CAMBIO PRINCIPAL: Hope Today - Agregar a TODOS los contextos y personas
        if (isHopeTodayCandidate) {
            // Agregar a todos los contextos
            if (task.contexts.length > 0) {
                task.contexts.forEach(context => {
                    const key = `cx-${context}`;
                    pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
                });
            }
            
            // Agregar a todas las personas asignadas
            if (task.assignedPeople.length > 0) {
                task.assignedPeople.forEach(person => {
                    const key = `px-${person}`;
                    pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
                });
            }
            
            // Si no tiene contextos ni personas, agregar a "Sin Contexto"
            if (task.contexts.length === 0 && task.assignedPeople.length === 0) {
                const key = 'cx-Sin Contexto';
                pushToMap(gtdLists[GtdList.HopeToday] as Map<string, Task[]>, key, task);
            }
        }

        // CAMBIO PRINCIPAL: Assigned - Agregar a TODAS las personas asignadas
        if (hasAssigned) {
            task.assignedPeople.forEach(person => {
                const key = `px-${person}`;
                pushToMap(gtdLists[GtdList.Assigned] as Map<string, Task[]>, key, task);
            });
        }

        // CAMBIO PRINCIPAL: Next Actions - Agregar a TODOS los contextos
        // NUEVA LÓGICA: Incluir tareas con start date que ya pasó (sin contexto requerido)
        if (hasContext) {
            task.contexts.forEach(context => {
                const key = `cx-${context}`;
                pushToMap(gtdLists[GtdList.NextActions] as Map<string, Task[]>, key, task);
            });
        } else if (isStartDate && task.date && (isDatePast(task.date) || isDateToday(task.date))) {
            // Start date activo sin contexto: agregar a contexto especial
            const key = 'cx-Sin Contexto';
            pushToMap(gtdLists[GtdList.NextActions] as Map<string, Task[]>, key, task);
        }

        // Projects: keep a list of project-related tasks but not exclusive
        if (task.contexts.includes('ProyectoGTD') || task.contexts.includes('Entregable')) {
            gtdLists[GtdList.Projects].push(task);
        }

        // Fallback: if nothing matched (no context, no assigned, no date-based inclusion), put into Inbox
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

    // Generar elementos de navegación
    const navigationItems = generateNavigationItems(gtdLists);

    return { 
        gtdLists, 
        uniqueContexts: Array.from(uniqueContexts).sort((a, b) => a.localeCompare(b)), 
        uniquePeople: Array.from(uniquePeople).sort((a, b) => a.localeCompare(b)), 
        inProgressData: { groups: {}, stats: { total: 0, overdue: 0, definedTimeMinutes: 0, estimatedTimeMinutes: 0 } },
        navigationItems
    };
}

/**
 * Genera los elementos de navegación para las listas GTD
 */
function generateNavigationItems(gtdLists: GtdListsData): NavigationItem[] {
    const navigationItems: NavigationItem[] = [];
    
    // Función auxiliar para crear un ID válido para anclas
    const createAnchorId = (text: string): string => {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales excepto espacios y guiones
            .replace(/\s+/g, '-') // Reemplazar espacios con guiones
            .replace(/-+/g, '-') // Remover guiones múltiples
            .trim();
    };
    
    // Procesar cada lista GTD con tipos correctos
    for (const [listName, tasks] of Object.entries(gtdLists) as [string, Task[] | Map<string, Task[]>][]) {
        let totalTasksInList = 0;
        const listId = createAnchorId(listName);
        
        // Calcular total de tareas en la lista
        if (Array.isArray(tasks)) {
            totalTasksInList = tasks.length;
        } else if (tasks instanceof Map) {
            totalTasksInList = Array.from(tasks.values()).reduce((sum, arr: Task[]) => sum + arr.length, 0);
        }
        
        // Solo agregar si hay tareas
        if (totalTasksInList > 0) {
            // Agregar lista principal
            navigationItems.push({
                id: `gtd-list-${listId}`,
                label: listName,
                count: totalTasksInList,
                icon: getListIcon(listName as GtdList),
                isSublist: false,
                anchor: `gtd-list-${listId}`
            });
            
            // Agregar sublistas si existen
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

/**
 * Obtiene el icono apropiado para cada lista GTD
 */
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

/**
 * Obtiene el icono apropiado para sublistas según el tipo
 */
function getSublistIcon(listName: GtdList, sublistKey: string): string {
    // Para Próximas Acciones y Ojalá Hoy, detectar si es contexto o persona
    if (listName === GtdList.NextActions || listName === GtdList.HopeToday) {
        if (sublistKey.startsWith('#cx-') || sublistKey.startsWith('cx-')) {
            return '📋'; // Contexto
        }
        if (sublistKey.startsWith('#px-') || sublistKey.startsWith('@') || sublistKey.startsWith('px-')) {
            return '👤'; // Persona
        }
    }
    
    // Para Asignadas, siempre son personas
    if (listName === GtdList.Assigned) {
        return '👤'; // Persona
    }
    
    // Icono genérico por defecto
    return '📋';
}
