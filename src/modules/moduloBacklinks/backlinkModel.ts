import { TFile } from 'obsidian';

export interface BacklinkItem {
    file: TFile;
    type: string;
    estado: string;
    folderPath: string;
    isInSameFolder: boolean;
    hasBacklink: boolean;
    creationDate: Date;
    modificationDate: Date;
    // Información financiera para transacciones
    moneda?: string;
    monto?: number;
}

export interface SortConfig {
    column: number; // -1 for no column sort
    direction: 'asc' | 'desc';
    dateSort: 'creation' | 'modification' | null;
}

export interface FilterOptions {
    showSameFolder: boolean;
    showBacklinks: boolean;
    fileTypes: string[];
    estados: string[];
}

export const DEFAULT_SORT_CONFIG: SortConfig = {
    column: -1,
    direction: 'desc',
    dateSort: 'creation'
};

export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
    showSameFolder: true,
    showBacklinks: true,
    fileTypes: [],
    estados: []
};

export interface BreadcrumbSegment {
    name: string;
    path: string;
    isClickable: boolean;
}