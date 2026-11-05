import moment from 'moment';
import type { JournalSettings } from '../moduloGTDv3/model.js';

/**
 * Helper para generar rutas de Weekly basadas en la configuración de Journal
 * Reutiliza la configuración existente de journalSettings
 */
export class WeeklyPathHelper {
    constructor(private settings: JournalSettings) {}

    /**
     * Genera la ruta completa para una nota semanal
     * @param weekCode - Código de semana en formato YYYY-W## (ej: "2025-W43")
     * @returns Ruta completa para la nota semanal
     */
    getWeeklyNotePath(weekCode: string): string {
        const parsed = this.parseWeekCode(weekCode);
        if (!parsed) {
            throw new Error(`Formato de semana inválido: ${weekCode}`);
        }

        const { year, week } = parsed;

        // Obtener el primer día de la semana (lunes) para calcular trimestre y mes
        const weekStart = moment().year(year).isoWeek(week).startOf('isoWeek');
        const quarter = Math.ceil((weekStart.month() + 1) / 3);
        const month = weekStart.format('MM');

        let path = this.settings.baseFolderPath;

        if (this.settings.yearSubfolder) {
            path += `/${year}`;
        }

        if (this.settings.quarterSubfolder) {
            path += `/Q${quarter}`;
        }

        if (this.settings.monthSubfolder) {
            path += `/${month}`;
        }

        const fileName = `${weekCode}.md`;

        return `${path}/${fileName}`;
    }

    /**
     * Parsea código de semana en año y número de semana
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
     * Crea la estructura de carpetas si no existe
     * @param vault - Instancia del vault de Obsidian
     * @param weekCode - Código de semana en formato YYYY-W##
     */
    async ensureFolderStructure(vault: any, weekCode: string): Promise<void> {
        const parsed = this.parseWeekCode(weekCode);
        if (!parsed) {
            throw new Error(`Formato de semana inválido: ${weekCode}`);
        }

        const { year, week } = parsed;
        const weekStart = moment().year(year).isoWeek(week).startOf('isoWeek');
        const quarter = Math.ceil((weekStart.month() + 1) / 3);
        const month = weekStart.format('MM');

        let path = this.settings.baseFolderPath;
        await this.ensureFolderExists(vault, path);

        if (this.settings.yearSubfolder) {
            path += `/${year}`;
            await this.ensureFolderExists(vault, path);
        }

        if (this.settings.quarterSubfolder) {
            path += `/Q${quarter}`;
            await this.ensureFolderExists(vault, path);
        }

        if (this.settings.monthSubfolder) {
            path += `/${month}`;
            await this.ensureFolderExists(vault, path);
        }
    }

    /**
     * Asegura que una carpeta existe, la crea si no existe
     */
    private async ensureFolderExists(vault: any, folderPath: string): Promise<void> {
        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await vault.createFolder(folderPath);
        }
    }

    /**
     * Obtiene una vista previa de la ruta que se generaría
     * @param weekCode - Código de semana (opcional, usa semana actual por defecto)
     * @returns Objeto con ejemplo de ruta
     */
    getPathPreview(weekCode?: string): {
        weeklyNotePath: string;
    } {
        const code = weekCode || this.getCurrentWeekCode();

        return {
            weeklyNotePath: this.getWeeklyNotePath(code)
        };
    }

    /**
     * Obtiene código de semana actual
     */
    private getCurrentWeekCode(): string {
        const now = moment();
        const year = now.isoWeekYear();
        const week = now.isoWeek();

        return `${year}-W${String(week).padStart(2, '0')}`;
    }
}
