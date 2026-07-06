import type DovelaPersonalManagementPlugin from '../../main.js';
import type { Task } from '../moduloGTDv3/model.js';
import type { WeeklyData, WeeklyRenderOptions, DayOfWeek, DailyTaskGroup } from './weeklyModel.js';
import { parseVault } from '../moduloGTDv3/parser.js';
import { isDatePast } from '../moduloGTDv3/dateUtils.js';
import moment from 'moment';

/**
 * Renderizador de tareas para notas Weekly
 * Procesa y renderiza tareas para una semana específica
 */
export class WeeklyTaskRenderer {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    /**
     * Genera HTML para tareas de una semana específica
     * @param weekCode - Código de semana en formato YYYY-W## (ej: "2025-W43")
     */
    async generateForWeek(weekCode: string, options: WeeklyRenderOptions = {}): Promise<string> {
        try {
            // Validar formato de weekCode
            if (!this.isValidWeekCode(weekCode)) {
                throw new Error(`Formato de semana inválido: ${weekCode}. Use YYYY-W## (ej: 2025-W43)`);
            }

            // 1. Parsear vault usando funciones existentes
            const parsedData = await parseVault(
                this.plugin.app.vault,
                this.plugin.app.metadataCache
            );

            // 2. Procesar tareas para la semana específica
            const weeklyData = this.processTasksForWeek(parsedData.allTasks, weekCode);

            // 3. Generar HTML
            return this.generateWeeklyHTML(weeklyData, options);

        } catch (error) {
            console.error('Error generating weekly tasks:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `<div class="weekly-error">Error loading tasks: ${errorMessage}</div>`;
        }
    }

    /**
     * Valida formato de código de semana
     */
    private isValidWeekCode(weekCode: string): boolean {
        return /^\d{4}-W\d{1,2}$/.test(weekCode);
    }

    /**
     * Extrae año y semana de un código de semana
     */
    private parseWeekCode(weekCode: string): { year: number; week: number } | null {
        const match = weekCode.match(/^(\d{4})-W(\d{1,2})$/);
        if (!match) return null;

        return {
            year: parseInt(match[1]!),
            week: parseInt(match[2]!)
        };
    }

    /**
     * Obtiene el rango de fechas para una semana ISO específica
     */
    private getWeekDateRange(year: number, week: number): { start: moment.Moment; end: moment.Moment } {
        const weekStart = moment().year(year).isoWeek(week).startOf('isoWeek');
        const weekEnd = weekStart.clone().endOf('isoWeek');

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
     * Obtiene el día de la semana para una fecha
     */
    private getDayOfWeek(date: string): DayOfWeek {
        const dayIndex = moment(date).isoWeekday(); // 1 = Monday, 7 = Sunday
        const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return days[dayIndex - 1]!;
    }

    /**
     * Verifica si una tarea fue completada en una semana específica
     */
    private isTaskCompletedInWeek(task: Task, year: number, week: number): boolean {
        if (!task.completed) return false;

        // Buscar patrón ✅ YYYY-MM-DD en el contenido de la tarea
        const completionPattern = /✅\s*(\d{4}-\d{2}-\d{2})/;
        const match = task.content.match(completionPattern);

        if (!match || !match[1]) return false;

        const completedDate = match[1];
        return this.isDateInWeek(completedDate, year, week);
    }

    /**
     * Extrae información de semana de una tarea
     */
    private extractWeekInfo(task: Task): { weekCode: string; year: number; week: number } | null {
        if (!task.week) return null;

        const weekCode = task.week;
        const parts = weekCode.split('-W');
        if (parts.length !== 2) return null;

        const year = parseInt(parts[0]!);
        const week = parseInt(parts[1]!);

        return { weekCode, year, week };
    }

    /**
     * Verifica si una semana es anterior a otra
     */
    private isWeekOverdue(taskYear: number, taskWeek: number, currentYear: number, currentWeek: number): boolean {
        if (taskYear < currentYear) return true;
        if (taskYear > currentYear) return false;
        return taskWeek < currentWeek;
    }

    /**
     * Procesa y filtra tareas para una semana específica
     */
    private processTasksForWeek(allTasks: Task[], weekCode: string): WeeklyData {
        const parsed = this.parseWeekCode(weekCode);
        if (!parsed) {
            throw new Error(`No se pudo parsear el código de semana: ${weekCode}`);
        }

        const { year, week } = parsed;
        const { start, end } = this.getWeekDateRange(year, week);

        const weeklyData: WeeklyData = {
            targetWeek: weekCode,
            year,
            week,
            weekDateRange: {
                start: start.format('YYYY-MM-DD'),
                end: end.format('YYYY-MM-DD')
            },
            weeklyTasks: [],
            dailyTasks: {
                monday: [],
                tuesday: [],
                wednesday: [],
                thursday: [],
                friday: [],
                saturday: [],
                sunday: []
            },
            overdueWeeklyTasks: [],
            overdueByDate: [],
            completedThisWeek: []
        };

        for (const task of allTasks) {
            // Tareas completadas en esta semana
            if (task.completed && this.isTaskCompletedInWeek(task, year, week)) {
                weeklyData.completedThisWeek.push(task);
                continue;
            }

            // Solo procesar tareas abiertas para las demás categorías
            if (task.completed) continue;

            // Verificar si es una tarea semanal
            const weekInfo = this.extractWeekInfo(task);
            if (weekInfo) {
                if (weekInfo.year === year && weekInfo.week === week) {
                    // Tarea W:: para esta semana
                    weeklyData.weeklyTasks.push(task);
                } else if (this.isWeekOverdue(weekInfo.year, weekInfo.week, year, week)) {
                    // Tarea W:: de semanas anteriores (vencida)
                    weeklyData.overdueWeeklyTasks.push(task);
                }
                continue;
            }

            // Verificar si tiene fecha
            if (task.date) {
                const taskDate = moment(task.date);
                const weekStart = moment(start);

                if (this.isDateInWeek(task.date, year, week)) {
                    // Fecha cae en esta semana
                    const dayOfWeek = this.getDayOfWeek(task.date);
                    weeklyData.dailyTasks[dayOfWeek].push(task);
                } else if (taskDate.isBefore(weekStart, 'day')) {
                    // Fecha anterior al inicio de la semana
                    // Solo agregar si es due (📅) o scheduled (⏳), NO start (🛫)
                    if (task.dateSymbol && (task.dateSymbol === '📅' || task.dateSymbol === '⏳')) {
                        weeklyData.overdueByDate.push(task);
                    }
                }
            }
        }

        // Ordenar tareas en cada categoría por prioridad
        this.sortTasksByPriority(weeklyData.weeklyTasks);
        this.sortTasksByWeekPriority(weeklyData.overdueWeeklyTasks);

        // Ordenar tareas completadas por fecha de completado
        this.sortCompletedTasksByDate(weeklyData.completedThisWeek);

        // Ordenar tareas vencidas por fecha: fecha (más antigua primero), tipo, prioridad
        this.sortTasksByDateTypePriority(weeklyData.overdueByDate);

        // Ordenar tareas diarias por tipo de fecha primero, luego prioridad
        for (const day in weeklyData.dailyTasks) {
            const dayTasks = weeklyData.dailyTasks[day as DayOfWeek];
            this.sortTasksByTypePriority(dayTasks);
        }

        return weeklyData;
    }

    /**
     * Ordena tareas por prioridad
     */
    private sortTasksByPriority(tasks: Task[]): void {
        const priorityOrder: Record<string, number> = {
            'Highest': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3,
            'None': 4
        };

        tasks.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] ?? 4;
            const bPriority = priorityOrder[b.priority] ?? 4;
            return aPriority - bPriority;
        });
    }

    /**
     * Ordena tareas por tipo de fecha (due → scheduled → start), luego prioridad
     */
    private sortTasksByTypePriority(tasks: Task[]): void {
        const typeOrder: Record<string, number> = {
            '📅': 0,  // due - más urgente
            '⏳': 1,  // scheduled
            '🛫': 2   // start
        };

        const priorityOrder: Record<string, number> = {
            'Highest': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3,
            'None': 4
        };

        tasks.sort((a, b) => {
            // Primero por tipo de fecha
            const aType = typeOrder[a.dateSymbol ?? ''] ?? 999;
            const bType = typeOrder[b.dateSymbol ?? ''] ?? 999;

            if (aType !== bType) return aType - bType;

            // Luego por prioridad
            const aPriority = priorityOrder[a.priority] ?? 4;
            const bPriority = priorityOrder[b.priority] ?? 4;
            return aPriority - bPriority;
        });
    }

    /**
     * Ordena tareas por fecha (más antigua primero), tipo, prioridad
     */
    private sortTasksByDateTypePriority(tasks: Task[]): void {
        const typeOrder: Record<string, number> = {
            '📅': 0,  // due
            '⏳': 1   // scheduled
        };

        const priorityOrder: Record<string, number> = {
            'Highest': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3,
            'None': 4
        };

        tasks.sort((a, b) => {
            // Primero por fecha (más antigua primero)
            if (a.date && b.date) {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
            }

            // Luego por tipo de fecha
            const aType = typeOrder[a.dateSymbol ?? ''] ?? 999;
            const bType = typeOrder[b.dateSymbol ?? ''] ?? 999;

            if (aType !== bType) return aType - bType;

            // Finalmente por prioridad
            const aPriority = priorityOrder[a.priority] ?? 4;
            const bPriority = priorityOrder[b.priority] ?? 4;
            return aPriority - bPriority;
        });
    }

    /**
     * Ordena tareas completadas por fecha de completado (del patrón ✅ YYYY-MM-DD)
     */
    private sortCompletedTasksByDate(tasks: Task[]): void {
        tasks.sort((a, b) => {
            // Extraer fecha de completado del contenido
            const completionPattern = /✅\s*(\d{4}-\d{2}-\d{2})/;
            const aMatch = a.content.match(completionPattern);
            const bMatch = b.content.match(completionPattern);

            const aDate = aMatch?.[1] || '';
            const bDate = bMatch?.[1] || '';

            // Ordenar por fecha de completado (más antigua primero)
            return aDate.localeCompare(bDate);
        });
    }

    /**
     * Ordena tareas vencidas de semanas anteriores por semana (cronológicamente) y luego por prioridad
     */
    private sortTasksByWeekPriority(tasks: Task[]): void {
        const priorityOrder: Record<string, number> = {
            'Highest': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3,
            'None': 4
        };

        tasks.sort((a, b) => {
            // Extraer año y semana de week (formato: "2025-W43")
            const weekPattern = /^(\d{4})-W(\d{1,2})$/;

            const aMatch = a.week?.match(weekPattern);
            const bMatch = b.week?.match(weekPattern);

            // Si alguna no tiene week válido, ponerla al final
            if (!aMatch && !bMatch) {
                const aPriority = priorityOrder[a.priority] ?? 4;
                const bPriority = priorityOrder[b.priority] ?? 4;
                return aPriority - bPriority;
            }
            if (!aMatch) return 1;
            if (!bMatch) return -1;

            const aYear = parseInt(aMatch[1]!);
            const aWeek = parseInt(aMatch[2]!);
            const bYear = parseInt(bMatch[1]!);
            const bWeek = parseInt(bMatch[2]!);

            // Ordenar por año primero
            if (aYear !== bYear) {
                return aYear - bYear;
            }

            // Luego por número de semana
            if (aWeek !== bWeek) {
                return aWeek - bWeek;
            }

            // Finalmente por prioridad
            const aPriority = priorityOrder[a.priority] ?? 4;
            const bPriority = priorityOrder[b.priority] ?? 4;
            return aPriority - bPriority;
        });
    }

    /**
     * Genera HTML para la vista semanal
     */
    private generateWeeklyHTML(data: WeeklyData, options: WeeklyRenderOptions): string {
        const { start, end } = data.weekDateRange;
        const startMoment = moment(start);
        const endMoment = moment(end);

        let html = '<div class="weekly-tasks-container dovela-weekly">';

        // Header con rango de fechas
        html += '<div class="weekly-header">';
        html += `<h2>Semana ${data.targetWeek}</h2>`;
        html += `<p class="weekly-date-range">${startMoment.format('D [de] MMMM')} - ${endMoment.format('D [de] MMMM, YYYY')}</p>`;
        html += '</div>';

        // Sección: Tareas W:: para esta semana
        if (data.weeklyTasks.length > 0) {
            html += this.generateWeeklyTasksSection(data.weeklyTasks);
        }

        // Sección: Tareas vencidas por fecha (due/scheduled anteriores a la semana)
        if (data.overdueByDate.length > 0) {
            html += this.generateOverdueByDateSection(data.overdueByDate, options.showOverdueLimit);
        }

        // Sección: Tareas por día
        html += this.generateDailyTasksSection(data, options.highlightToday ?? true);

        // Sección: Tareas vencidas de semanas anteriores
        if (data.overdueWeeklyTasks.length > 0) {
            html += this.generateOverdueSection(data.overdueWeeklyTasks, options.showOverdueLimit);
        }

        // Sección: Completadas esta semana
        if (data.completedThisWeek.length > 0) {
            html += this.generateCompletedSection(data.completedThisWeek, options.showCompletedCollapsed ?? true);
        }

        html += '</div>';
        return html;
    }

    /**
     * Genera sección de tareas W:: para esta semana
     */
    private generateWeeklyTasksSection(tasks: Task[]): string {
        let html = '<div class="weekly-group">';
        html += `<h3 class="weekly-group-title">📊 Tareas Semanales (${tasks.length})</h3>`;
        html += '<div class="weekly-task-list">';

        for (const task of tasks) {
            html += this.generateTaskHTML(task);
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Genera sección de tareas vencidas por fecha
     */
    private generateOverdueByDateSection(tasks: Task[], limit?: number): string {
        const displayTasks = limit ? tasks.slice(0, limit) : tasks;
        const hasMore = limit && tasks.length > limit;

        let html = '<div class="weekly-group weekly-group--overdue collapsible">';
        html += `<h3 class="weekly-group-title">🔥 Tareas Vencidas por Fecha (${tasks.length})</h3>`;
        html += '<div class="weekly-task-list">';

        for (const task of displayTasks) {
            html += this.generateTaskHTML(task, true);
        }

        if (hasMore) {
            html += `<div class="weekly-more-tasks">... y ${tasks.length - limit!} tareas más</div>`;
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Genera sección de tareas agrupadas por día
     */
    private generateDailyTasksSection(data: WeeklyData, highlightToday: boolean): string {
        const dailyGroups = this.buildDailyGroups(data);

        let html = '<div class="weekly-group">';
        html += '<h3 class="weekly-group-title">📅 Tareas por Día</h3>';

        for (const group of dailyGroups) {
            if (group.tasks.length === 0) continue;

            const isTodayClass = group.isToday && highlightToday ? ' daily-group--today' : '';
            const todayMarker = group.isToday && highlightToday ? ' 📍 Hoy' : '';

            html += `<div class="daily-group${isTodayClass}">`;
            html += `<h4 class="daily-group-title">${group.dayName} ${group.dayNumber}${todayMarker}</h4>`;
            html += '<div class="daily-task-list">';

            for (const task of group.tasks) {
                html += this.generateTaskHTML(task);
            }

            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Construye grupos diarios con información completa
     */
    private buildDailyGroups(data: WeeklyData): DailyTaskGroup[] {
        const groups: DailyTaskGroup[] = [];
        const startDate = moment(data.weekDateRange.start);
        const today = moment().format('YYYY-MM-DD');

        const dayNames: Record<DayOfWeek, string> = {
            monday: 'Lunes',
            tuesday: 'Martes',
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo'
        };

        const daysOfWeek: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        for (let i = 0; i < 7; i++) {
            const currentDate = startDate.clone().add(i, 'days');
            const dayOfWeek = daysOfWeek[i]!;
            const dateString = currentDate.format('YYYY-MM-DD');

            groups.push({
                dayOfWeek,
                date: dateString,
                dayNumber: currentDate.date(),
                dayName: dayNames[dayOfWeek]!,
                isToday: dateString === today,
                tasks: data.dailyTasks[dayOfWeek]
            });
        }

        return groups;
    }

    /**
     * Genera sección de tareas vencidas
     */
    private generateOverdueSection(tasks: Task[], limit?: number): string {
        const displayTasks = limit ? tasks.slice(0, limit) : tasks;
        const hasMore = limit && tasks.length > limit;

        let html = '<div class="weekly-group weekly-group--overdue collapsible">';
        html += `<h3 class="weekly-group-title">🔥 Tareas Vencidas de Semanas Anteriores (${tasks.length})</h3>`;
        html += '<div class="weekly-task-list">';

        for (const task of displayTasks) {
            html += this.generateTaskHTML(task, true);
        }

        if (hasMore) {
            html += `<div class="weekly-more-tasks">... y ${tasks.length - limit!} tareas más</div>`;
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Genera sección de tareas completadas
     */
    private generateCompletedSection(tasks: Task[], defaultCollapsed: boolean): string {
        const collapsedClass = defaultCollapsed ? ' collapsed' : '';

        let html = `<div class="weekly-group weekly-group--completed collapsible${collapsedClass}">`;
        html += `<h3 class="weekly-group-title">✅ Completadas esta Semana (${tasks.length})</h3>`;
        html += '<div class="weekly-task-list">';

        for (const task of tasks) {
            html += this.generateTaskHTML(task);
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Genera HTML para una tarea individual
     */
    private generateTaskHTML(task: Task, isOverdue = false): string {
        const overdueClass = isOverdue ? ' weekly-task--overdue' : '';
        const prioritySymbol = this.getPrioritySymbol(task.priority);

        let html = `<div class="weekly-task${overdueClass}" data-task-path="${task.sourceFile.path}" data-task-line="${task.lineNumber}">`;

        // Checkbox
        const checked = task.status === 'completed' ? 'checked' : '';
        const checkboxClass = task.status === 'in-progress' ? 'in-progress' : '';
        html += `<input type="checkbox" class="task-checkbox ${checkboxClass}" ${checked} />`;

        // Contenido
        html += `<span class="task-content">${this.escapeHtml(task.content)}</span>`;

        // Metadata
        html += '<span class="task-metadata">';

        // Prioridad
        if (prioritySymbol) {
            html += `<span class="task-priority">${prioritySymbol}</span>`;
        }

        // Fecha
        if (task.date) {
            const dateSymbol = task.dateSymbol || '📅';
            const isDateOverdue = isDatePast(task.date) && task.status !== 'completed';
            const dateClass = isDateOverdue ? 'task-date is-overdue' : 'task-date';
            html += `<span class="${dateClass}">${dateSymbol} ${task.date}</span>`;
        }

        // Semana
        if (task.week) {
            const weekClass = isOverdue ? 'task-week is-overdue' : 'task-week';
            html += `<span class="${weekClass}">📊 ${task.week}</span>`;
        }

        // Duración
        if (task.duration) {
            html += `<span class="task-duration">[${task.duration}]</span>`;
        }

        // Contextos
        if (task.contexts.length > 0) {
            html += `<span class="task-contexts">${task.contexts.join(' ')}</span>`;
        }

        // Personas
        if (task.assignedPeople.length > 0) {
            html += `<span class="task-people">${task.assignedPeople.join(' ')}</span>`;
        }

        html += '</span>'; // task-metadata
        html += '</div>'; // weekly-task

        return html;
    }

    /**
     * Obtiene símbolo de prioridad
     */
    private getPrioritySymbol(priority: string): string {
        const symbols: Record<string, string> = {
            'Highest': '🔺',
            'High': '⏫',
            'Medium': '🔼',
            'Low': '🔽',
            'None': ''
        };
        return symbols[priority] || '';
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]!);
    }
}
