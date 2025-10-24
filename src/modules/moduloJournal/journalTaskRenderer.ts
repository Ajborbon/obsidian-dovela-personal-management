import type DovelaPersonalManagementPlugin from '../../main.js';
import type { Task } from '../moduloGTDv3/model.js';
import type { JournalDayData, JournalGroupConfig, JournalRenderOptions } from './journalModel.js';
import { parseVault } from '../moduloGTDv3/parser.js';
// import { processGtdLists } from '../moduloGTDv3/gtdProcessor.js';
// import { processInProgressTasks } from '../moduloGTDv3/inProgressProcessor.js';
import { isDatePast } from '../moduloGTDv3/dateUtils.js';
import moment from 'moment';

/**
 * Renderizador de tareas para notas Journal
 * Reutiliza toda la lógica del sistema GTD existente
 */
export class JournalTaskRenderer {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    /**
     * Genera HTML para tareas de una fecha específica
     */
    async generateForDate(targetDate: string, options: JournalRenderOptions = {}): Promise<string> {
        try {
            // 1. Parsear vault usando funciones existentes
            const parsedData = await parseVault(
                this.plugin.app.vault,
                this.plugin.app.metadataCache
            );

            // 2. Procesar tareas con funciones existentes (para future use)
            // const taskMap = new Map(parsedData.allTasks.map(task => [task.id, task]));
            // const { gtdLists } = processGtdLists(parsedData.allTasks, taskMap, 'date-first');
            // const inProgressData = processInProgressTasks(parsedData.allTasks, 'none', 'priority');

            // 3. Filtrar y organizar para la fecha específica
            const journalData = this.processTasksForDate(parsedData.allTasks, targetDate);

            // 4. Generar HTML
            return this.generateJournalHTML(journalData, options);

        } catch (error) {
            console.error('Error generating journal tasks:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `<div class="journal-error">Error loading tasks: ${errorMessage}</div>`;
        }
    }

    /**
     * Extrae información de semana de una tarea
     */
    private extractWeekInfo(task: Task): { weekCode: string; year: number; week: number } | null {
        // Usar la información de semana que ya extrajo y guardó el parser
        if (!task.week) return null;

        // El parser guarda el código de semana extraído (ej: "2025-W43")
        const weekCode = task.week;
        const parts = weekCode.split('-W');
        if (parts.length !== 2) return null;

        const year = parseInt(parts[0]!);
        const week = parseInt(parts[1]!);

        return { weekCode, year, week };
    }

    /**
     * Obtiene el rango de fechas para una semana ISO específica
     */
    private getWeekDateRange(year: number, week: number): { start: moment.Moment; end: moment.Moment } {
        // Método más directo usando moment.js
        // Crear una fecha en la semana ISO específica
        const weekStart = moment().year(year).isoWeek(week).startOf('isoWeek');
        const weekEnd = weekStart.clone().endOf('isoWeek');

        console.log(`[Journal Debug] Week ${year}-W${week} calculated range: ${weekStart.format('YYYY-MM-DD')} to ${weekEnd.format('YYYY-MM-DD')}`);

        return { start: weekStart, end: weekEnd };
    }

    /**
     * Verifica si una fecha está en una semana específica
     */
    private isDateInWeek(date: string, year: number, week: number): boolean {
        const targetDate = moment(date);
        const { start, end } = this.getWeekDateRange(year, week);

        return targetDate.isBetween(start, end, 'day', '[]');
    }

    /**
     * Verifica si una semana es anterior a la fecha actual
     */
    private isWeekOverdue(year: number, week: number, currentDate: string): boolean {
        const current = moment(currentDate);
        const { end } = this.getWeekDateRange(year, week);

        return end.isBefore(current, 'day');
    }

    /**
     * Procesa y filtra tareas para una fecha específica
     */
    private processTasksForDate(allTasks: Task[], targetDate: string): JournalDayData {
        const target = moment(targetDate);

        const calendarTasks: Task[] = [];
        const programmedToday: Task[] = [];
        const weeklyTasksThisWeek: Task[] = [];
        const weeklyTasksOverdue: Task[] = [];
        const overdueToday: Task[] = [];
        const inProgress: Task[] = [];
        const blockedDependencies: Task[] = [];
        const completedToday: Task[] = [];

        for (const task of allTasks) {
            // Tareas completadas hoy
            if (task.completed && this.isTaskCompletedOnDate(task, targetDate)) {
                completedToday.push(task);
                continue;
            }

            // Solo procesar tareas abiertas
            if (task.completed) continue;

            // Tareas en progreso
            if (task.status === 'in-progress') {
                inProgress.push(task);
                continue;
            }

            // Verificar si es una tarea semanal
            const weekInfo = this.extractWeekInfo(task);
            if (weekInfo) {
                // Es una tarea semanal
                if (this.isDateInWeek(targetDate, weekInfo.year, weekInfo.week)) {
                    // La fecha actual está en esta semana
                    weeklyTasksThisWeek.push(task);
                } else if (this.isWeekOverdue(weekInfo.year, weekInfo.week, targetDate)) {
                    // La semana ya pasó
                    weeklyTasksOverdue.push(task);
                }
                // Si no es esta semana ni vencida, es futura (no se muestra)
                continue;
            }

            // Tareas con dependencias bloqueadas
            if (task.dependencies.length > 0 && this.isTaskBlockedByDependencies(task, allTasks)) {
                // Solo mostrar si es para hoy o vencida
                if (this.isTaskForDateOrOverdue(task, targetDate)) {
                    blockedDependencies.push(task);
                }
                continue;
            }

            // Tareas con fecha due/schedule
            if (task.date && task.dateSymbol && ['📅', '⏳', '🛫'].includes(task.dateSymbol)) {
                const taskDate = moment(task.date);

                if (taskDate.isSame(target, 'day')) {
                    // Tareas programadas para hoy
                    if (task.startTime) {
                        calendarTasks.push(task);
                    } else {
                        programmedToday.push(task);
                    }
                } else if (taskDate.isBefore(target, 'day')) {
                    // Tareas vencidas
                    overdueToday.push(task);
                }
            }
        }

        // Ordenar grupos según especificaciones
        const priorityOrder = { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'None': 4 };
        const taskTypeOrder = { '📅': 0, '⏳': 1, '🛫': 2 };

        // Calendar tasks: por hora, luego prioridad
        calendarTasks.sort((a, b) => {
            if (a.startTime && b.startTime) {
                const timeCompare = a.startTime.localeCompare(b.startTime);
                if (timeCompare !== 0) return timeCompare;
            }
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Programadas para hoy: due (📅), scheduled (⏳), start (🛫), luego prioridad
        programmedToday.sort((a, b) => {
            const typeA = taskTypeOrder[a.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            const typeB = taskTypeOrder[b.dateSymbol as keyof typeof taskTypeOrder] ?? 999;

            if (typeA !== typeB) return typeA - typeB;
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Vencidas: fecha (más vieja primero), tipo, prioridad
        overdueToday.sort((a, b) => {
            if (a.date && b.date) {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
            }

            const typeA = taskTypeOrder[a.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            const typeB = taskTypeOrder[b.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            if (typeA !== typeB) return typeA - typeB;

            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // En progreso: fecha (más vieja primero), tipo, prioridad
        inProgress.sort((a, b) => {
            if (a.date && b.date) {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
            }

            const typeA = taskTypeOrder[a.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            const typeB = taskTypeOrder[b.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            if (typeA !== typeB) return typeA - typeB;

            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Bloqueadas: fecha, tipo, prioridad
        blockedDependencies.sort((a, b) => {
            if (a.date && b.date) {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
            }

            const typeA = taskTypeOrder[a.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            const typeB = taskTypeOrder[b.dateSymbol as keyof typeof taskTypeOrder] ?? 999;
            if (typeA !== typeB) return typeA - typeB;

            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Tareas semanales de esta semana: por prioridad
        weeklyTasksThisWeek.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        // Tareas semanales vencidas: por semana (más antigua primero), luego prioridad
        weeklyTasksOverdue.sort((a, b) => {
            const weekInfoA = this.extractWeekInfo(a);
            const weekInfoB = this.extractWeekInfo(b);

            if (weekInfoA && weekInfoB) {
                // Comparar por año primero
                if (weekInfoA.year !== weekInfoB.year) {
                    return weekInfoA.year - weekInfoB.year;
                }
                // Luego por semana
                if (weekInfoA.week !== weekInfoB.week) {
                    return weekInfoA.week - weekInfoB.week;
                }
            }

            // Finalmente por prioridad
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        return {
            targetDate,
            calendarTasks,
            programmedToday,
            weeklyTasksThisWeek,
            weeklyTasksOverdue,
            overdueToday,
            inProgress,
            blockedDependencies,
            completedToday
        };
    }

    /**
     * Verifica si una tarea fue completada en una fecha específica
     */
    private isTaskCompletedOnDate(task: Task, targetDate: string): boolean {
        // Buscar patrón ✅ YYYY-MM-DD en el contenido de la tarea
        const completionPattern = /✅\s*(\d{4}-\d{2}-\d{2})/;
        const match = task.content.match(completionPattern);
        return match ? match[1] === targetDate : false;
    }

    /**
     * Verifica si una tarea está bloqueada por dependencias
     */
    private isTaskBlockedByDependencies(task: Task, allTasks: Task[]): boolean {
        if (task.dependencies.length === 0) return false;

        const taskMap = new Map(allTasks.map(t => [t.id, t]));

        for (const depId of task.dependencies) {
            const depTask = taskMap.get(depId);
            if (!depTask || !depTask.completed) {
                return true; // Al menos una dependencia no está completa
            }
        }

        return false; // Todas las dependencias están completas
    }

    /**
     * Verifica si una tarea es para una fecha específica o está vencida
     */
    private isTaskForDateOrOverdue(task: Task, targetDate: string): boolean {
        if (!task.date) return false;

        const taskDate = moment(task.date);
        const target = moment(targetDate);

        return taskDate.isSameOrBefore(target, 'day');
    }

    /**
     * Genera el HTML final del journal
     */
    private generateJournalHTML(data: JournalDayData, options: JournalRenderOptions): string {
        const dayName = moment(data.targetDate).format('dddd');
        const groups: JournalGroupConfig[] = [];

        // Configurar grupos
        if (data.calendarTasks.length > 0) {
            groups.push({
                title: `⏰ Calendario del Día (${data.calendarTasks.length})`,
                icon: '⏰',
                tasks: data.calendarTasks,
                collapsible: false,
                defaultCollapsed: false,
                showCount: true
            });
        }

        if (data.programmedToday.length > 0) {
            groups.push({
                title: `📅⏳🛫 Programadas para Hoy (${data.programmedToday.length})`,
                icon: '📅',
                tasks: data.programmedToday,
                collapsible: false,
                defaultCollapsed: false,
                showCount: true
            });
        }

        // Tareas semanales para esta semana
        if (data.weeklyTasksThisWeek.length > 0) {
            groups.push({
                title: `📊 Tareas para esta Semana (${data.weeklyTasksThisWeek.length})`,
                icon: '📊',
                tasks: data.weeklyTasksThisWeek,
                collapsible: false,
                defaultCollapsed: false,
                showCount: true
            });
        }

        // Tareas semanales vencidas (de semanas anteriores)
        if (data.weeklyTasksOverdue.length > 0) {
            groups.push({
                title: `🔥📊 Tareas de Semanas Anteriores (${data.weeklyTasksOverdue.length})`,
                icon: '🔥',
                tasks: data.weeklyTasksOverdue,
                collapsible: true,
                defaultCollapsed: false,
                showCount: true
            });
        }

        if (data.inProgress.length > 0) {
            groups.push({
                title: `🔄 En Progreso (${data.inProgress.length})`,
                icon: '🔄',
                tasks: data.inProgress,
                collapsible: false,
                defaultCollapsed: false,
                showCount: true
            });
        }

        if (data.overdueToday.length > 0) {
            const overdueLimit = options.showOverdueLimit || 50;
            const displayTasks = data.overdueToday.slice(0, overdueLimit);
            // const hasMore = data.overdueToday.length > overdueLimit; // Para uso futuro

            groups.push({
                title: `🔥 Vencidas a Hoy (${data.overdueToday.length})`,
                icon: '🔥',
                tasks: displayTasks,
                collapsible: true,
                defaultCollapsed: true,
                showCount: true
            });
        }

        if (data.blockedDependencies.length > 0) {
            groups.push({
                title: `⛔ Bloqueadas por Dependencias (${data.blockedDependencies.length})`,
                icon: '⛔',
                tasks: data.blockedDependencies,
                collapsible: true,
                defaultCollapsed: false,
                showCount: true
            });
        }

        if (data.completedToday.length > 0) {
            groups.push({
                title: `✅ Completadas Hoy (${data.completedToday.length})`,
                icon: '✅',
                tasks: data.completedToday,
                collapsible: true,
                defaultCollapsed: true,
                showCount: true
            });
        }

        // Generar HTML
        let html = `
            <div class="journal-container">
                <div class="journal-header">
                    <h2>📋 Tareas del Día - ${data.targetDate} ${dayName}</h2>
                </div>
                <div class="journal-content">
        `;

        for (const group of groups) {
            html += this.generateGroupHTML(group);
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Genera HTML para un grupo de tareas
     */
    private generateGroupHTML(group: JournalGroupConfig): string {
        const detailsClass = group.collapsible ? 'journal-group collapsible' : 'journal-group';
        const openAttr = group.defaultCollapsed ? '' : 'open';

        // Determinar si es el grupo de tareas semanales vencidas
        const isWeeklyOverdueGroup = group.title.includes('Semanas Anteriores');

        let html = `
            <details class="${detailsClass}" ${openAttr}>
                <summary class="journal-group-header">
                    <span class="group-title">${group.title}</span>
                </summary>
                <div class="journal-group-content">
        `;

        for (const task of group.tasks) {
            html += this.generateTaskHTML(task, isWeeklyOverdueGroup);
        }

        html += `
                </div>
            </details>
        `;

        return html;
    }

    /**
     * Genera HTML para una tarea individual (reutiliza estilos GTD)
     */
    private generateTaskHTML(task: Task, isWeeklyOverdue: boolean = false): string {
        const prioritySymbols: Record<Task['priority'], string> = {
            'Highest': '🔺',
            'High': '⏫',
            'Medium': '🔼',
            'Low': '🔽',
            'None': '⏬'
        };

        const priority = task.priority !== 'None' ? prioritySymbols[task.priority] : '';
        let displayClass = task.displayStatus ? ` task--${task.displayStatus}` : '';

        // Agregar clase de overdue para tareas semanales vencidas
        if (isWeeklyOverdue) {
            displayClass += ' task--overdue';
        }

        // Metadatos
        let metadata = '';
        if (task.duration) metadata += `<span class="task-duration">[${task.duration}]</span>`;
        if (task.date) {
            const dateClass = isDatePast(task.date) ? 'is-overdue' : '';
            metadata += `<span class="task-date ${dateClass}">${task.dateSymbol} ${task.date}</span>`;
        }
        if (task.startTime) metadata += `<span class="task-time">[hI:: ${task.startTime}]</span>`;
        if (task.endTime) metadata += `<span class="task-time">[hF:: ${task.endTime}]</span>`;

        // Agregar información de semana para tareas semanales
        const weekInfo = this.extractWeekInfo(task);
        if (weekInfo) {
            const weekClass = isWeeklyOverdue ? 'is-overdue' : '';
            metadata += `<span class="task-week ${weekClass}">📊 ${weekInfo.weekCode}</span>`;
        }

        // Procesar contenido (enlaces y dependencias)
        let processedContent = this.processTaskContent(task.content);

        return `
            <div class="gtd-task journal-task${displayClass}"
                 data-task-path="${task.sourceFile.path}"
                 data-task-line="${task.lineNumber}">
                <div class="gtd-task-content">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} />
                    ${priority ? `<span class="gtd-task-priority">${priority}</span>` : ''}
                    <span class="task-text">${processedContent}</span>
                </div>
                ${metadata ? `<div class="gtd-task-metadata">${metadata}</div>` : ''}
            </div>
        `;
    }

    /**
     * Procesa el contenido de la tarea (enlaces y dependencias)
     */
    private processTaskContent(content: string): string {
        // Procesar enlaces internos de Obsidian
        let processedContent = content.replace(/\[\[(.*?)\]\]/g,
            '<a href="$1" class="internal-link" data-link-path="$1">$1</a>'
        );

        // Procesar enlaces de dependencias
        const dependencyPattern = /⛔\s*(\^?[a-zA-Z0-9-_]+)/g;
        processedContent = processedContent.replace(dependencyPattern, (...args: any[]) => {
            const depId = args[1] as string;
            const cleanDepId = depId.replace(/^\^/, '');
            return `⛔ ${depId} <span class="dependency-link" data-dependency-id="${cleanDepId}" title="Ir a la tarea dependiente: ${cleanDepId}">🔗</span>`;
        });

        return processedContent;
    }
}