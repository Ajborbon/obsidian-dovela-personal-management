
import type { Task, ProcessedVaultData, NavigationItem, DateSymbol } from './model.js';
import { isDatePast, isDateToday, isDateFuture, isWeekPast, isWeekToday, isWeekFuture } from './dateUtils.js';
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
        return null; // Sin fecha, estado neutro
    }

    // Colección de todas las fechas presentes en la tarea
    let allTaskDates: {symbol: DateSymbol, date: string, isPrimary: boolean}[] = [];
    
    if (task.dateSymbol) {
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
    }

    // Analizar todas las fechas para determinar estado
    let hasAnyOverdueDate = false;
    let hasAnyTodayDate = false;
    let hasActiveFutureStart = false;

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

    // Asignar estados con prioridades: overdue > today > paused-start > null
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
        // Si no hay dependencias sin resolver, procesar como tarea normal
        return getRegularTaskDisplayStatus(task);
    }

    // Para tareas con dependencias sin resolver, verificar fechas para determinar color
    const hasDate = !!task.date;
    if (!hasDate) {
        return 'paused-dep'; // Sin fecha: naranja por dependencia
    }

    // Analizar fechas para tareas dependientes
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

    // Verificar si hay fechas vencidas (Due/Scheduled)
    let hasOverdueDependentDate = false;
    // let hasTodayDependentDate = false; // Variable removida - no se usa

    for (const dateInfo of allTaskDates) {
        const isDateOverdue = isDatePast(dateInfo.date);
        // const isDateTodayMatch = isDateToday(dateInfo.date); // Variable removida - no se usa
        
        // Solo considerar fechas Due/Scheduled para dependencias
        if (dateInfo.symbol === '⏳' || dateInfo.symbol === '📅') {
            if (isDateOverdue) {
                hasOverdueDependentDate = true;
            }
            // hasTodayDependentDate ya no se usa - removido
        }
    }

    // Para dependencias: rojo si vencida, naranja si hoy o futura
    if (hasOverdueDependentDate) {
        return 'overdue'; // Rojo para dependencias vencidas
    } else {
        return 'paused-dep'; // Naranja para dependencias activas
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

        const isPausedByDependency = hasUnresolvedDependencies(task, allTaskMap);

        const hasDate = !!task.date;
        const hasContext = task.contexts.length > 0;
        const hasAssigned = task.assignedPeople.length > 0;

        // NUEVA LÓGICA: Validación de fechas y determinación de estados
        let hasInvalidDateConfiguration = false;
        let isStartDate = false;
        let isDueDate = false;
        let isCalendarItem = false;
        let isHopeTodayCandidate = false;

        if (hasDate && task.dateSymbol) {
            isStartDate = task.dateSymbol === '🛫';
            isDueDate = task.dateSymbol === '📅';
            const taskDate = task.date!;
            
            // Validar coherencia de fechas: Start date no puede ser posterior a Schedule/Due dates
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
                    // Fallback: buscar en el contenido de la tarea
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
            
            // Detectar Calendar items
            isCalendarItem = isDueDate && !!task.startTime;
            
            // Detectar candidatos para Hope Today - fechas Schedule/Due = hoy sin hora
            if (!task.startTime) {
                // Verificar fecha principal
                if ((task.dateSymbol === '⏳' || task.dateSymbol === '📅') && isDateToday(task.date!)) {
                    isHopeTodayCandidate = true;
                }
                
                // Verificar fechas adicionales
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

        // NUEVA LÓGICA: Compute displayStatus usando las funciones especializadas
        if (hasInvalidDateConfiguration) {
            task.displayStatus = null; // Las tareas inválidas no tienen estado especial, van a Inbox
        } else if (isPausedByDependency) {
            // Para tareas con dependencias, usar la lógica especializada
            task.displayStatus = getDependentTaskDisplayStatus(task, allTaskMap);
        } else if (isWeekFutureFlag) {
            task.displayStatus = 'paused-start';
        } else {
            // Para tareas sin dependencias, usar la lógica regular
            task.displayStatus = getRegularTaskDisplayStatus(task);
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

        // NUEVA LÓGICA MEJORADA: Paused - Sistema de doble/triple listado para dependencias
        if (isPausedByDependency || isWeekFutureFlag || task.displayStatus === 'paused-start') {
            gtdLists[GtdList.Paused].push(task);
            
            // Las tareas pausadas por start date futuro NO deben aparecer en otras listas activas
            if (task.displayStatus === 'paused-start' && !isPausedByDependency) {
                continue;
            }
            // Para dependencias y semana futura, continúa el procesamiento para permitir doble listado
        }

        // Calendar: scheduled items with start time
        if (isCalendarItem) {
            gtdLists[GtdList.Calendar].push(task);
        }

        // NUEVA LÓGICA: Overdue - Incluir tareas vencidas (incluyendo dependencias vencidas)
        if (task.displayStatus === 'overdue') {
            gtdLists[GtdList.Overdue].push(task);
        }

        // NUEVA LÓGICA MEJORADA: Hope Today - Incluir dependencias con fechas de hoy
        if (isHopeTodayCandidate || 
            (isPausedByDependency && task.displayStatus === 'paused-dep' && 
             ((hasDate && isDateToday(task.date!)) || 
              (task.additionalDates && task.additionalDates.some(ad => 
                  (ad.symbol === '⏳' || ad.symbol === '📅') && isDateToday(ad.date)
              ))
             )
            )) {
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

                        // Build a clean display label removing internal prefixes (cx-/px-) and showing a star badge for HopeToday
                        let displayLabel = sublistKey;
                        // If key contains internal prefix, strip it for display
                        displayLabel = displayLabel.replace(/^cx-/, '').replace(/^px-/, '').replace(/^#cx-/, '').replace(/^#px-/, '');

                        // Don't add visual markers here; the navigation layer will render the Ojalá Hoy badge.
                        // (displayLabel stays as the cleaned label)

                        navigationItems.push({
                            id: sublistId,
                            label: displayLabel,
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
    // Para Próximas Acciones y Ojalá Hoy, detectar si es contexto o persona.
    // Devolver solo el icono de tipo (contexto 📋 o persona 👤). La marca de "Ojalá Hoy"
    // se mostrará como un badge/estrella en el label en la capa de UI, no aquí.
    if (listName === GtdList.NextActions || listName === GtdList.HopeToday) {
        const key = sublistKey.toString().toLowerCase();

        const isPerson = key.startsWith('#px-') || key.startsWith('px-') || key.startsWith('@') || key.startsWith('px:');
        if (isPerson) {
            return '👤';
        }
        // Por defecto tratar como contexto
        return '📋';
    }

    // Para Asignadas, siempre son personas
    if (listName === GtdList.Assigned) {
        return '👤'; // Persona
    }

    // Icono genérico por defecto
    return '📋';
}
