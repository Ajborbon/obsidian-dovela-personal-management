// cascadeSuggestionProvider.ts
import { TFile } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { MenuOption, CascadeMenuConfig } from './cascadeMenuTypes.js';

export class CascadeSuggestionProvider {
    private plugin: DovelaPersonalManagementPlugin;
    private activeFile: TFile | null = null;

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
    }

    public setActiveFile(activeFile: TFile | null): void {
        this.activeFile = activeFile;
    }

    public getProjectMenuOptions(): MenuOption[] {
        const projectsAndAreas = this.plugin.gtdProjectsAndAreas;
        
        if (!projectsAndAreas || projectsAndAreas.length === 0) {
            return [
                {
                    id: 'no-projects',
                    label: 'No hay proyectos disponibles',
                    value: '',
                    description: 'Crea algunos proyectos GTD primero'
                }
            ];
        }
        
        // Filtrar solo archivos con estado: 🟢 en frontmatter
        const activeFiles = projectsAndAreas.filter(file => {
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            
            if (!frontmatter || !frontmatter['estado']) {
                return false;
            }
            
            // Verificar si el estado es activo (🟢)
            const estado = frontmatter['estado'];
            return estado === '🟢';
        });
        
        if (activeFiles.length === 0) {
            return [
                {
                    id: 'no-active-projects',
                    label: 'No hay proyectos activos (estado: 🟢)',
                    value: '',
                    description: 'Marca algunos proyectos con estado: 🟢'
                }
            ];
        }
        
        // Separar áreas de interés y proyectos activos
        const areas = activeFiles.filter(file => file.basename.startsWith('AV -') || file.basename.startsWith('AI -'));
        const projects = activeFiles.filter(file => file.basename.startsWith('PGTD -') || file.basename.startsWith('PQ -'));
        
        const options: MenuOption[] = [];
        
        // Agregar la nota activa como primera opción SIEMPRE si existe
        if (this.activeFile && this.activeFile.extension === 'md') {
            const activeFileName = this.activeFile.basename;
            
            options.push({
                id: `active-file-${activeFileName}`,
                label: `📝 ${activeFileName}`,
                value: activeFileName,
                description: 'Nota actualmente abierta'
            });
        }
        
        // Agregar áreas de interés activas (evitando duplicado con nota activa)
        if (areas.length > 0) {
            const activeFileName = this.activeFile?.basename;
            areas.forEach(area => {
                // Solo agregar si no es la misma nota activa que ya agregamos
                if (area.basename !== activeFileName) {
                    options.push({
                        id: `area-${area.basename}`,
                        label: area.basename,
                        value: area.basename,
                        description: 'Área de interés activa (🟢)'
                    });
                }
            });
        }
        
        // Agregar proyectos GTD activos (evitando duplicado con nota activa)
        if (projects.length > 0) {
            const activeFileName = this.activeFile?.basename;
            projects.forEach(project => {
                // Solo agregar si no es la misma nota activa que ya agregamos
                if (project.basename !== activeFileName) {
                    options.push({
                        id: `project-${project.basename}`,
                        label: project.basename,
                        value: project.basename,
                        description: 'Proyecto GTD activo (🟢)'
                    });
                }
            });
        }
        
        return options;
    }

    public generateConfig(): CascadeMenuConfig {
        return {
            mainMenuOptions: this.getMainMenuOptions(),
            contextMenuOptions: this.getContextMenuOptions(),
            personMenuOptions: this.getPersonMenuOptions(),
            gtdMenuOptions: this.getGTDMenuOptions(),
            projectMenuOptions: this.getProjectMenuOptions()
        };
    }

    private getMainMenuOptions(): MenuOption[] {
        return [
            {
                id: 'cx',
                label: 'cx-',
                value: 'cx-',
                description: 'Contextos'
            },
            {
                id: 'px',
                label: 'px-',
                value: 'px-',
                description: 'Personas Asignadas'
            },
            {
                id: 'gtd',
                label: 'gtd-',
                value: 'gtd-',
                description: 'Estados GTD'
            }
        ];
    }

    private getContextMenuOptions(): MenuOption[] {
        // Usar los contextos existentes del plugin
        const contexts = this.plugin.gtdContextTags
            .map((tag: string) => tag.substring(4)) // Remover '#cx-'
            .filter((context: string) => context.length > 0);

        // Agregar contextos predeterminados si no existen
        const defaultContexts = ['oficina', 'casa', 'llamadas', 'reuniones', 'urgente'];
        const allContexts = [...new Set([...contexts, ...defaultContexts])];

        return allContexts.map((context: string) => ({
            id: `cx-${context}`,
            label: context,
            value: context,
            description: `Contexto: ${context}`
        }));
    }

    private getPersonMenuOptions(): MenuOption[] {
        // Usar las personas existentes del plugin
        const persons = this.plugin.gtdPersonTags
            .map((tag: string) => tag.substring(4)) // Remover '#px-'
            .filter((person: string) => person.length > 0);

        // Agregar personas predeterminadas si no existen
        const defaultPersons = ['juan', 'maria', 'carlos', 'sofia', 'equipo'];
        const allPersons = [...new Set([...persons, ...defaultPersons])];

        return allPersons.map((person: string) => ({
            id: `px-${person}`,
            label: person,
            value: person,
            description: `Persona: ${person}`
        }));
    }

    private getGTDMenuOptions(): MenuOption[] {
        // Estados GTD predefinidos
        const gtdStates = [
            { id: 'EstaSemanaNo', label: 'EstaSemanaNo', description: 'Esta Semana No' },
            { id: 'AlgunDia', label: 'AlgunDia', description: 'Algún Día' }
        ];

        return gtdStates.map((state) => ({
            id: `gtd-${state.id}`,
            label: state.label,
            value: state.id,
            description: `Estado GTD: ${state.description}`
        }));
    }

    public filterOptions(options: MenuOption[], query: string): MenuOption[] {
        if (!query || query.length === 0) {
            return options;
        }

        const lowerQuery = query.toLowerCase();
        return options.filter(option => 
            option.label.toLowerCase().includes(lowerQuery) ||
            option.value.toLowerCase().includes(lowerQuery) ||
            (option.description?.toLowerCase().includes(lowerQuery) ?? false)
        );
    }
}
