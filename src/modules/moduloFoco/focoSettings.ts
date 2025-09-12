// Configuración para el módulo de Vista Foco - Sistema de expansión bidireccional de enlaces

export interface FocoExpansionSettings {
    outgoingLinksLevels: number;
    incomingLinksLevels: number;
    terminationFolders: string[];
    terminationNotes: string[];
    showOriginIndicators: boolean;
    enableNetworkVisualization: boolean;
}

export const DEFAULT_FOCO_SETTINGS: FocoExpansionSettings = {
    outgoingLinksLevels: 2,                    // Default: 2 niveles para enlaces salientes
    incomingLinksLevels: 5,                    // Default: 5 niveles para enlaces entrantes
    terminationFolders: [
        "03 - Gestion Personal/AV - Gerente de Vida/AI - Journals"
    ],                                         // Carpetas donde se corta la recursividad
    terminationNotes: [],                      // Notas específicas donde se corta la recursividad
    showOriginIndicators: true,                // Mostrar badges de origen por defecto
    enableNetworkVisualization: false         // Vista de red deshabilitada inicialmente
};

// Gestión de configuraciones usando localStorage (similar al sistema de backlinks)
export class FocoSettingsManager {
    private static STORAGE_KEY = 'dovela-foco-expansion-settings';
    
    static save(settings: FocoExpansionSettings): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving Foco settings:', error);
        }
    }
    
    static load(): FocoExpansionSettings {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge con defaults para mantener compatibilidad con nuevas propiedades
                return Object.assign({}, DEFAULT_FOCO_SETTINGS, parsed);
            }
        } catch (error) {
            console.warn('Error loading Foco settings, using defaults:', error);
        }
        return Object.assign({}, DEFAULT_FOCO_SETTINGS);
    }
    
    static reset(): FocoExpansionSettings {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error resetting Foco settings:', error);
        }
        return Object.assign({}, DEFAULT_FOCO_SETTINGS);
    }

    // Validación de configuraciones
    static validate(settings: FocoExpansionSettings): FocoExpansionSettings {
        const validated = Object.assign({}, settings);
        
        // Validar niveles de expansión (mínimo 0, máximo 10 para evitar problemas de rendimiento)
        validated.outgoingLinksLevels = Math.max(0, Math.min(10, validated.outgoingLinksLevels));
        validated.incomingLinksLevels = Math.max(0, Math.min(10, validated.incomingLinksLevels));
        
        // Validar que las carpetas de terminación sean arrays válidos
        if (!Array.isArray(validated.terminationFolders)) {
            validated.terminationFolders = DEFAULT_FOCO_SETTINGS.terminationFolders;
        }
        
        if (!Array.isArray(validated.terminationNotes)) {
            validated.terminationNotes = DEFAULT_FOCO_SETTINGS.terminationNotes;
        }
        
        return validated;
    }
}

// Tipos para tracking del origen de las notas
export type NoteOriginType = 
    | 'folder-base'           // Nota de la carpeta base
    | 'outgoing-link'         // Enlace saliente
    | 'incoming-link'         // Enlace entrante  
    | 'termination-folder'    // Nota en carpeta de terminación
    | 'termination-note';     // Nota específica de terminación

export interface NoteOriginInfo {
    type: NoteOriginType;
    level: number;            // Nivel de expansión (0 para carpeta base)
    path: string;             // Ruta de la nota
    terminationReason?: string; // Si se terminó por configuración, explicar por qué
}

// Estadísticas de expansión para mostrar al usuario
export interface ExpansionStats {
    totalNotes: number;
    folderBaseNotes: number;
    outgoingLinksNotes: number;
    incomingLinksNotes: number;
    terminationNotes: number;
    maxOutgoingLevel: number;
    maxIncomingLevel: number;
    processingTimeMs: number;
}