import type DovelaPersonalManagementPlugin from '../../main.js';
import { WeeklyTaskRenderer } from './weeklyTaskRenderer.js';
import { WeeklyPathHelper } from './weeklyPathHelper.js';
import type { WeeklyRenderOptions } from './weeklyModel.js';
import moment from 'moment';

/**
 * API expuesta para DataviewJS
 * Proporciona acceso a funciones de renderizado de Weekly
 */
export class WeeklyAPI {
    private renderer: WeeklyTaskRenderer;
    private pathHelper: WeeklyPathHelper;

    constructor(private plugin: DovelaPersonalManagementPlugin) {
        this.renderer = new WeeklyTaskRenderer(plugin);
        this.pathHelper = new WeeklyPathHelper(plugin.data.journalSettings);
    }

    /**
     * Función principal para DataviewJS - genera elemento DOM de tareas por semana
     * @param weekCode - Código de semana en formato YYYY-W## (ej: "2025-W43")
     * @param options - Opciones de renderizado (opcional)
     * @returns HTMLElement listo para insertar en el DOM
     */
    async renderTasksForWeek(weekCode: string, options: WeeklyRenderOptions = {}): Promise<HTMLElement> {
        try {
            // Validar formato de weekCode
            if (!this.isValidWeekCode(weekCode)) {
                throw new Error(`Formato de semana inválido: ${weekCode}. Use YYYY-W## (ej: 2025-W43)`);
            }

            // Generar HTML usando el renderer
            const htmlString = await this.renderer.generateForWeek(weekCode, options);

            // Crear elemento DOM
            const container = this.createDOMElement(htmlString);

            // Añadir event listeners para interactividad
            this.attachEventListeners(container);

            return container;

        } catch (error) {
            console.error('Error in WeeklyAPI.renderTasksForWeek:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.createErrorElement(errorMessage);
        }
    }

    /**
     * Función simplificada para obtener solo conteos de tareas
     * @param weekCode - Código de semana en formato YYYY-W##
     * @returns Objeto con conteos por categoría
     */
    async getTaskCounts(weekCode: string): Promise<{
        weekly: number;
        monday: number;
        tuesday: number;
        wednesday: number;
        thursday: number;
        friday: number;
        saturday: number;
        sunday: number;
        overdue: number;
        completed: number;
    }> {
        try {
            if (!this.isValidWeekCode(weekCode)) {
                throw new Error(`Formato de semana inválido: ${weekCode}`);
            }

            const htmlString = await this.renderer.generateForWeek(weekCode);

            // Extraer conteos del HTML generado
            const counts = this.extractCountsFromHTML(htmlString);

            return counts;

        } catch (error) {
            console.error('Error in WeeklyAPI.getTaskCounts:', error);
            return {
                weekly: 0,
                monday: 0,
                tuesday: 0,
                wednesday: 0,
                thursday: 0,
                friday: 0,
                saturday: 0,
                sunday: 0,
                overdue: 0,
                completed: 0
            };
        }
    }

    /**
     * Genera la ruta para una nota semanal basada en la configuración
     * @param weekCode - Código de semana en formato YYYY-W##
     * @returns Ruta completa para la nota semanal
     */
    getWeeklyNotePath(weekCode: string): string {
        if (!this.isValidWeekCode(weekCode)) {
            throw new Error(`Formato de semana inválido: ${weekCode}. Use YYYY-W##`);
        }

        // Actualizar pathHelper con configuración actual
        this.pathHelper = new WeeklyPathHelper(this.plugin.data.journalSettings);
        return this.pathHelper.getWeeklyNotePath(weekCode);
    }

    /**
     * Obtiene código de semana ISO para una fecha
     * @param date - Fecha en formato YYYY-MM-DD
     * @returns Código semana en formato YYYY-W##
     */
    getWeekCodeFromDate(date: string): string {
        if (!this.isValidDateFormat(date)) {
            throw new Error(`Formato de fecha inválido: ${date}. Use YYYY-MM-DD`);
        }

        const momentDate = moment(date);
        const year = momentDate.isoWeekYear();
        const week = momentDate.isoWeek();

        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
     * Obtiene código de semana actual
     * @returns Código semana actual en formato YYYY-W##
     */
    getCurrentWeekCode(): string {
        const now = moment();
        const year = now.isoWeekYear();
        const week = now.isoWeek();

        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
     * Crea la estructura de carpetas para una semana específica
     * @param weekCode - Código de semana en formato YYYY-W##
     */
    async ensureFolderStructure(weekCode: string): Promise<void> {
        if (!this.isValidWeekCode(weekCode)) {
            throw new Error(`Formato de semana inválido: ${weekCode}. Use YYYY-W##`);
        }

        this.pathHelper = new WeeklyPathHelper(this.plugin.data.journalSettings);
        await this.pathHelper.ensureFolderStructure(this.plugin.app.vault, weekCode);
    }

    /**
     * Valida que weekCode tenga formato YYYY-W##
     */
    private isValidWeekCode(weekCode: string): boolean {
        return /^\d{4}-W\d{1,2}$/.test(weekCode);
    }

    /**
     * Valida que la fecha tenga formato YYYY-MM-DD
     */
    private isValidDateFormat(dateString: string): boolean {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) return false;

        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
    }

    /**
     * Crea elemento DOM a partir del HTML string
     */
    private createDOMElement(htmlString: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'weekly-tasks-container dovela-weekly';
        container.innerHTML = htmlString;
        return container;
    }

    /**
     * Crea elemento de error
     */
    private createErrorElement(message: string): HTMLElement {
        const errorEl = document.createElement('div');
        errorEl.className = 'weekly-error';
        errorEl.style.cssText = `
            color: var(--text-error);
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid var(--text-error);
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
            font-size: 14px;
        `;
        errorEl.textContent = `Error Weekly: ${message}`;
        return errorEl;
    }

    /**
     * Añade event listeners para interactividad
     */
    private attachEventListeners(container: HTMLElement): void {
        // Event listener para clicks en tareas (navegación)
        container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;

            // Click en tarea (navegar al archivo en nueva pestaña)
            const taskElement = target.closest('.weekly-task') as HTMLElement;
            if (taskElement) {
                const taskPath = taskElement.dataset['taskPath'];
                const taskLine = taskElement.dataset['taskLine'];

                if (taskPath) {
                    const line = taskLine ? parseInt(taskLine) : 0;
                    this.plugin.app.workspace.openLinkText(taskPath, '', true, {
                        eState: { line: line }
                    });
                }
            }

            // Click en título de grupo colapsible
            const groupTitle = target.closest('.weekly-group-title') as HTMLElement;
            if (groupTitle) {
                const group = groupTitle.closest('.weekly-group.collapsible');
                if (group) {
                    group.classList.toggle('collapsed');
                }
            }
        });

        // Event listener para checkboxes (marcar completada)
        container.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;

            if (target.type === 'checkbox') {
                const taskElement = target.closest('.weekly-task') as HTMLElement;
                if (taskElement) {
                    const taskPath = taskElement.dataset['taskPath'];
                    if (taskPath && target.checked) {
                        // TODO: Implementar lógica de marcar como completada
                        // Reutilizar TaskStateManager del sistema existente
                        console.log('Marcar tarea como completada:', taskPath);
                    }
                }
            }
        });
    }

    /**
     * Extrae conteos del HTML generado
     */
    private extractCountsFromHTML(htmlString: string): {
        weekly: number;
        monday: number;
        tuesday: number;
        wednesday: number;
        thursday: number;
        friday: number;
        saturday: number;
        sunday: number;
        overdue: number;
        completed: number;
    } {
        const counts = {
            weekly: 0,
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 0,
            overdue: 0,
            completed: 0
        };

        // Extraer números de los títulos usando regex
        const weeklyMatch = htmlString.match(/📊 Tareas Semanales \((\d+)\)/);
        if (weeklyMatch && weeklyMatch[1]) counts.weekly = parseInt(weeklyMatch[1]);

        const overdueMatch = htmlString.match(/🔥 Tareas Vencidas de Semanas Anteriores \((\d+)\)/);
        if (overdueMatch && overdueMatch[1]) counts.overdue = parseInt(overdueMatch[1]);

        const completedMatch = htmlString.match(/✅ Completadas esta Semana \((\d+)\)/);
        if (completedMatch && completedMatch[1]) counts.completed = parseInt(completedMatch[1]);

        // Contar tareas por día (método simple: contar elementos .weekly-task en cada .daily-group)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;

        const dailyGroups = tempDiv.querySelectorAll('.daily-group');
        dailyGroups.forEach((group) => {
            const title = group.querySelector('.daily-group-title')?.textContent || '';
            const taskCount = group.querySelectorAll('.weekly-task').length;

            if (title.includes('Lunes')) counts.monday = taskCount;
            else if (title.includes('Martes')) counts.tuesday = taskCount;
            else if (title.includes('Miércoles')) counts.wednesday = taskCount;
            else if (title.includes('Jueves')) counts.thursday = taskCount;
            else if (title.includes('Viernes')) counts.friday = taskCount;
            else if (title.includes('Sábado')) counts.saturday = taskCount;
            else if (title.includes('Domingo')) counts.sunday = taskCount;
        });

        return counts;
    }
}
