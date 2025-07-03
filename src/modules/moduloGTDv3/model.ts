import { TFile } from 'obsidian';

/**
 * Define los tipos de elementos jerárquicos que pueden existir en el vault.
 * Estos tipos se determinan de forma híbrida:
 * 1. Por el campo 'type' en el frontmatter (para notas de Journal).
 * 2. Por el prefijo en el nombre del fichero o carpeta (para la mayoría de notas).
 * 3. Como un tipo por defecto para notas sin identificación.
 */
export type HierarchicalItemType = 
    // --- Tipos por Prefijo ---
    | 'AV'   // Área de Vida
    | 'AI'   // Área de Interés
    | 'PGTD' // Proyecto GTD
    | 'PQ'   // Proyecto de Trimestre
    | 'RR'   // Recurso Recurrente
    | 'Tx'   // Transacción
    | 'Vx'   // Video
    | 'Reu'  // Reunión
    | 'Rf'   // Reflexión
    | 'Sue'  // Sueño
    | 'Cp'   // Campaña
    | 'EMkt' // Entregable Marketing
    | 'RT'   // Registro Tiempo
    | 'RL'   // Registro Lectura
    | 'Ax'   // Asunto / Nota Estándar (también es el tipo por defecto)

    // --- Tipos por Frontmatter (Journal) ---
    | 'Dly'  // Diario
    | 'Wk'   // Semanal
    | 'M'    // Mensual
    | 'Q'    // Trimestral
    | 'H'    // Semestral
    | 'Y'    // Anual

    // --- Tipos Estructurales (No de Notas) ---
    | 'Root'  // Raíz de la jerarquía (virtual)
    | 'Group' // Carpeta contenedora de AVs (ej. "01 - Productividad")
    ;

// Representa una tarea extraída de una nota de Obsidian.
export interface Task {
    id: string;
    content: string;
    completed: boolean;
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'None';
    creationDate?: string;
    startDate?: string;
    dueDate?: string;
    scheduledDate?: string;
    startTime?: string;
    endTime?: string;
    week?: string;
    dependencies: string[];
    contexts: string[];
    assignedPeople: string[];
    sourceFile: TFile;
    lineNumber: number;
}

// Representa un elemento en la jerarquía del vault (una nota o un grupo de notas).
export interface HierarchicalItem {
    id: string; // Usaremos la ruta del archivo como ID único.
    type: HierarchicalItemType;
    name: string;
    file?: TFile; // Opcional porque los 'Group' no tienen un fichero asociado.
    parent?: HierarchicalItem;
    children: HierarchicalItem[];
    tasks: Task[];
    totalTaskCount: number; // Tareas propias + tareas de todos los descendientes.
    frontmatter: Record<string, any>; // Metadatos del frontmatter.
}

// Contenedor para los datos procesados.
export interface ProcessedVaultData {
    hierarchicalData: HierarchicalItem[];
    gtdLists: Record<string, Task[]>;
    allTasks: Task[];
}