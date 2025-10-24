import type DovelaPersonalManagementPlugin from '../../main.js';
import { JournalTaskRenderer } from './journalTaskRenderer.js';
import { JournalPathHelper } from './journalPathHelper.js';
import type { JournalRenderOptions } from './journalModel.js';

/**
 * API expuesta para DataviewJS
 * Proporciona acceso a funciones de renderizado de Journal
 */
export class JournalAPI {
    private renderer: JournalTaskRenderer;
    private pathHelper: JournalPathHelper;

    constructor(private plugin: DovelaPersonalManagementPlugin) {
        this.renderer = new JournalTaskRenderer(plugin);
        this.pathHelper = new JournalPathHelper(plugin.data.journalSettings);
    }

    /**
     * Función principal para DataviewJS - genera elemento DOM de tareas por fecha
     * @param targetDate - Fecha en formato YYYY-MM-DD
     * @param options - Opciones de renderizado (opcional)
     * @returns HTMLElement listo para insertar en el DOM
     */
    async renderTasksForDate(targetDate: string, options: JournalRenderOptions = {}): Promise<HTMLElement> {
        try {
            // Validar formato de fecha
            if (!this.isValidDateFormat(targetDate)) {
                throw new Error(`Formato de fecha inválido: ${targetDate}. Use YYYY-MM-DD`);
            }

            // Generar HTML usando el renderer
            const htmlString = await this.renderer.generateForDate(targetDate, options);

            // Crear elemento DOM
            const container = this.createDOMElement(htmlString);

            // Añadir event listeners para interactividad
            this.attachEventListeners(container);

            return container;

        } catch (error) {
            console.error('Error in JournalAPI.renderTasksForDate:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.createErrorElement(errorMessage);
        }
    }

    /**
     * Función simplificada para obtener solo conteos de tareas
     * @param targetDate - Fecha en formato YYYY-MM-DD
     * @returns Objeto con conteos por categoría
     */
    async getTaskCounts(targetDate: string): Promise<{
        calendar: number;
        programmed: number;
        overdue: number;
        inProgress: number;
        blocked: number;
        completed: number;
    }> {
        try {
            if (!this.isValidDateFormat(targetDate)) {
                throw new Error(`Formato de fecha inválido: ${targetDate}`);
            }

            const htmlString = await this.renderer.generateForDate(targetDate);

            // Extraer conteos del HTML generado (método simple)
            const counts = this.extractCountsFromHTML(htmlString);

            return counts;

        } catch (error) {
            console.error('Error in JournalAPI.getTaskCounts:', error);
            return {
                calendar: 0,
                programmed: 0,
                overdue: 0,
                inProgress: 0,
                blocked: 0,
                completed: 0
            };
        }
    }

    /**
     * Genera la ruta para una nota diaria basada en la configuración
     * @param targetDate - Fecha en formato YYYY-MM-DD
     * @returns Ruta completa para la nota diaria
     */
    getDailyNotePath(targetDate: string): string {
        if (!this.isValidDateFormat(targetDate)) {
            throw new Error(`Formato de fecha inválido: ${targetDate}. Use YYYY-MM-DD`);
        }

        // Actualizar pathHelper con configuración actual
        this.pathHelper = new JournalPathHelper(this.plugin.data.journalSettings);
        return this.pathHelper.getDailyNotePath(targetDate);
    }

    /**
     * Genera enlace semanal basado en la configuración
     * @param weekCode - Código de semana en formato YYYY-W##
     * @returns Enlace en formato [w::[[path|weekCode]]]
     */
    generateWeeklyLink(weekCode: string): string {
        this.pathHelper = new JournalPathHelper(this.plugin.data.journalSettings);
        return this.pathHelper.generateWeeklyLink(weekCode);
    }

    /**
     * Crea la estructura de carpetas para una fecha específica
     * @param targetDate - Fecha en formato YYYY-MM-DD
     */
    async ensureFolderStructure(targetDate: string): Promise<void> {
        if (!this.isValidDateFormat(targetDate)) {
            throw new Error(`Formato de fecha inválido: ${targetDate}. Use YYYY-MM-DD`);
        }

        this.pathHelper = new JournalPathHelper(this.plugin.data.journalSettings);
        await this.pathHelper.ensureFolderStructure(this.plugin.app.vault, targetDate);
    }

    /**
     * Valida la configuración actual del Journal
     * @returns Resultado de validación
     */
    async validateJournalSettings(): Promise<{ valid: boolean; message?: string }> {
        this.pathHelper = new JournalPathHelper(this.plugin.data.journalSettings);
        return await this.pathHelper.validateBaseFolderPath(this.plugin.app.vault);
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
        container.className = 'journal-tasks-container dovela-journal';
        container.innerHTML = htmlString;
        return container;
    }

    /**
     * Crea elemento de error
     */
    private createErrorElement(message: string): HTMLElement {
        const errorEl = document.createElement('div');
        errorEl.className = 'journal-error';
        errorEl.style.cssText = `
            color: var(--text-error);
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid var(--text-error);
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
            font-size: 14px;
        `;
        errorEl.textContent = `Error Journal: ${message}`;
        return errorEl;
    }

    /**
     * Añade event listeners para interactividad
     */
    private attachEventListeners(container: HTMLElement): void {
        // Event listener para clicks en tareas (navegación)
        container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;

            // Click en enlace de dependencia
            const dependencyLink = target.closest('.dependency-link') as HTMLElement;
            if (dependencyLink) {
                event.preventDefault();
                const dependencyId = dependencyLink.dataset['dependencyId'];
                if (dependencyId) {
                    this.handleDependencyLinkClick(dependencyId);
                }
                return;
            }

            // Click en enlace interno
            const internalLink = target.closest('.internal-link') as HTMLElement;
            if (internalLink) {
                event.preventDefault();
                const linkPath = internalLink.dataset['linkPath'];
                if (linkPath) {
                    this.plugin.app.workspace.openLinkText(linkPath, '', false);
                }
                return;
            }

            // Click en tarea (navegar al archivo)
            const taskElement = target.closest('.journal-task') as HTMLElement;
            if (taskElement) {
                const taskPath = taskElement.dataset['taskPath'];
                const taskLine = taskElement.dataset['taskLine'];

                if (taskPath) {
                    const line = taskLine ? parseInt(taskLine) : 0;
                    this.plugin.app.workspace.openLinkText(taskPath, '', false, {
                        eState: { line: line }
                    });
                }
            }
        });

        // Event listener para checkboxes (marcar completada)
        container.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;

            if (target.type === 'checkbox') {
                const taskElement = target.closest('.journal-task') as HTMLElement;
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
     * Maneja clicks en enlaces de dependencias
     */
    private async handleDependencyLinkClick(dependencyId: string): Promise<void> {
        try {
            // Reutilizar lógica del GTD Dashboard existente
            const { parseVault } = await import('../moduloGTDv3/parser.js');

            const parsedData = await parseVault(
                this.plugin.app.vault,
                this.plugin.app.metadataCache
            );

            const targetTask = parsedData.allTasks.find(task => task.id === dependencyId);

            if (!targetTask) {
                console.warn(`No se encontró la tarea dependiente: ${dependencyId}`);
                return;
            }

            // Navegar al archivo de la tarea
            const file = targetTask.sourceFile;
            if (file) {
                await this.plugin.app.workspace.openLinkText(file.path, '', false, {
                    eState: { line: targetTask.lineNumber }
                });
            }

        } catch (error) {
            console.error('Error al navegar a la tarea dependiente:', error);
        }
    }

    /**
     * Extrae conteos del HTML generado (método simple basado en títulos)
     */
    private extractCountsFromHTML(htmlString: string): {
        calendar: number;
        programmed: number;
        overdue: number;
        inProgress: number;
        blocked: number;
        completed: number;
    } {
        const counts = {
            calendar: 0,
            programmed: 0,
            overdue: 0,
            inProgress: 0,
            blocked: 0,
            completed: 0
        };

        // Extraer números de los títulos usando regex
        const calendarMatch = htmlString.match(/⏰ Calendario del Día \((\d+)\)/);
        if (calendarMatch && calendarMatch[1]) counts.calendar = parseInt(calendarMatch[1]);

        const programmedMatch = htmlString.match(/📅 Programadas para Hoy \((\d+)\)/);
        if (programmedMatch && programmedMatch[1]) counts.programmed = parseInt(programmedMatch[1]);

        const overdueMatch = htmlString.match(/🔥 Vencidas a Hoy \((\d+)\)/);
        if (overdueMatch && overdueMatch[1]) counts.overdue = parseInt(overdueMatch[1]);

        const progressMatch = htmlString.match(/🔄 En Progreso \((\d+)\)/);
        if (progressMatch && progressMatch[1]) counts.inProgress = parseInt(progressMatch[1]);

        const blockedMatch = htmlString.match(/⛔ Bloqueadas por Dependencias \((\d+)\)/);
        if (blockedMatch && blockedMatch[1]) counts.blocked = parseInt(blockedMatch[1]);

        const completedMatch = htmlString.match(/✅ Completadas Hoy \((\d+)\)/);
        if (completedMatch && completedMatch[1]) counts.completed = parseInt(completedMatch[1]);

        return counts;
    }
}