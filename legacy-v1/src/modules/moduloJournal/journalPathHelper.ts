import moment from 'moment';
import type { JournalSettings } from '../moduloGTDv3/model.js';

/**
 * Helper para generar rutas de Journal basadas en la configuración
 */
export class JournalPathHelper {
    constructor(private settings: JournalSettings) {}

    /**
     * Genera la ruta completa para una nota diaria
     * @param date - Fecha en formato YYYY-MM-DD o objeto Date
     * @returns Ruta completa para la nota diaria
     */
    getDailyNotePath(date: string | Date): string {
        const momentDate = moment(date);
        const year = momentDate.year();
        const quarter = Math.ceil(momentDate.month() / 3) + 1;
        const month = momentDate.format('MM');

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

        const dayName = momentDate.format('dddd');
        const fileName = `${momentDate.format('YYYY-MM-DD')} ${dayName}.md`;

        return `${path}/${fileName}`;
    }

    /**
     * Genera la ruta para enlaces semanales
     * @param weekCode - Código de semana en formato YYYY-W##
     * @returns Ruta completa para el enlace semanal
     */
    getWeeklyLinkPath(weekCode: string): string {
        const match = weekCode.match(/(\d{4})-W(\d{1,2})/);
        if (!match) {
            throw new Error(`Formato de semana inválido: ${weekCode}`);
        }

        const year = parseInt(match[1]!);
        const week = parseInt(match[2]!);

        // Calcular trimestre basado en la semana ISO
        // Encontrar el primer lunes de la semana 1 ISO
        const jan4 = moment().year(year).month(0).date(4);
        const firstMondayOfYear = jan4.clone().startOf('isoWeek');

        // Calcular la fecha de la semana objetivo
        const targetWeek = firstMondayOfYear.clone().add(week - 1, 'weeks');
        const quarter = Math.ceil((targetWeek.month() + 1) / 3);
        const month = targetWeek.format('MM');

        let weekPattern = this.settings.weekFolderPattern
            .replace('{YYYY}', year.toString())
            .replace('{Q}', quarter.toString())
            .replace('{MM}', month)
            .replace('{WW}', String(week).padStart(2, '0'));

        return `${this.settings.baseFolderPath}/${weekPattern}/${weekCode}`;
    }

    /**
     * Genera el enlace completo de Obsidian para una semana
     * @param weekCode - Código de semana en formato YYYY-W##
     * @returns Enlace en formato [w::[[path|weekCode]]]
     */
    generateWeeklyLink(weekCode: string): string {
        const linkPath = this.getWeeklyLinkPath(weekCode);
        return `[w::[[${linkPath}|${weekCode}]]]`;
    }

    /**
     * Valida que la carpeta base existe o puede ser creada
     * @param vault - Instancia del vault de Obsidian
     * @returns true si la carpeta es válida
     */
    async validateBaseFolderPath(vault: any): Promise<{ valid: boolean; message?: string }> {
        try {
            if (!this.settings.baseFolderPath || this.settings.baseFolderPath.trim() === '') {
                return {
                    valid: false,
                    message: 'La carpeta base no puede estar vacía'
                };
            }

            // Verificar si contiene caracteres inválidos
            const invalidChars = /[<>:"|?*]/;
            if (invalidChars.test(this.settings.baseFolderPath)) {
                return {
                    valid: false,
                    message: 'La carpeta contiene caracteres inválidos: < > : " | ? *'
                };
            }

            // Verificar si la carpeta existe
            const folder = vault.getAbstractFileByPath(this.settings.baseFolderPath);
            if (folder && folder.children !== undefined) {
                return { valid: true };
            }

            // Si no existe, verificar que se puede crear
            const pathParts = this.settings.baseFolderPath.split('/');
            let currentPath = '';

            for (const part of pathParts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const existingFolder = vault.getAbstractFileByPath(currentPath);

                if (existingFolder && existingFolder.children === undefined) {
                    return {
                        valid: false,
                        message: `"${currentPath}" es un archivo, no una carpeta`
                    };
                }
            }

            return { valid: true };

        } catch (error) {
            return {
                valid: false,
                message: `Error validando la ruta: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Crea la estructura de carpetas si no existe
     * @param vault - Instancia del vault de Obsidian
     */
    async ensureFolderStructure(vault: any, date?: string | Date): Promise<void> {
        const targetDate = date ? moment(date) : moment();
        const year = targetDate.year();
        const quarter = Math.ceil(targetDate.month() / 3) + 1;
        const month = targetDate.format('MM');

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
     * Obtiene una vista previa de las rutas que se generarían
     * @param sampleDate - Fecha de ejemplo (opcional, usa hoy por defecto)
     * @returns Objeto con ejemplos de rutas
     */
    getPathPreview(sampleDate?: string | Date): {
        dailyNotePath: string;
        weeklyLinkPath: string;
        weeklyLinkFull: string;
    } {
        const date = sampleDate ? moment(sampleDate) : moment();
        const weekCode = `${date.year()}-W${String(date.isoWeek()).padStart(2, '0')}`;

        return {
            dailyNotePath: this.getDailyNotePath(date.toDate()),
            weeklyLinkPath: this.getWeeklyLinkPath(weekCode),
            weeklyLinkFull: this.generateWeeklyLink(weekCode)
        };
    }
}