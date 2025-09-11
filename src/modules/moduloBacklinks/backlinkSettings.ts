// Configuración para el módulo de Backlinks - Archivo separado para no afectar otras funcionalidades

export type BreadcrumbStyle = 'full' | 'smart' | 'compact';
export type ClickBehavior = 'open-folder' | 'reveal-in-explorer';

export interface BacklinkSettings {
    breadcrumbStyle: BreadcrumbStyle;
    maxBreadcrumbLength: number;
    maxSegmentLength: number;
    showFolderIcons: boolean;
    clickBehavior: ClickBehavior;
}

export const DEFAULT_BACKLINK_SETTINGS: BacklinkSettings = {
    breadcrumbStyle: 'full',         // Por defecto mostrar completo
    maxBreadcrumbLength: 60,         // Longitud generosa para sidebar
    maxSegmentLength: 20,            // Segmentos más largos
    showFolderIcons: true,
    clickBehavior: 'open-folder'
};

// Almacenamiento local simple para configuración de backlinks
export class BacklinkSettingsManager {
    private static STORAGE_KEY = 'dovela-backlink-settings';
    
    static save(settings: BacklinkSettings): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    }
    
    static load(): BacklinkSettings {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Object.assign({}, DEFAULT_BACKLINK_SETTINGS, parsed);
            }
        } catch (error) {
            console.warn('Error loading backlink settings:', error);
        }
        return Object.assign({}, DEFAULT_BACKLINK_SETTINGS);
    }
    
    static reset(): BacklinkSettings {
        localStorage.removeItem(this.STORAGE_KEY);
        return Object.assign({}, DEFAULT_BACKLINK_SETTINGS);
    }
}