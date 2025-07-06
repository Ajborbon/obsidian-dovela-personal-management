import { TFile } from 'obsidian';

/**
 * Define los tipos de elementos jerárquicos que pueden existir en el vault.
 * Estos tipos se determinan de forma híbrida:
 * 1. Por el campo 'type' en el frontmatter (para notas de Journal).
 * 2. Por el prefijo en el nombre del fichero o carpeta (para la mayoría de notas).
 * 3. Como un tipo por defecto para notas sin identificación.
 */
export type HierarchicalItemType =
    // --- Tipos Estructurales y de Grupo ---
    | 'GrupoAV' // Grupo de Áreas de Vida (ej. "01 - Productividad.md")
    | 'AV'   // Área de Vida
    | 'AI'   // Área de Interés
    | 'Root'  // Raíz de la jerarquía (virtual)

    // --- Tipos por Prefijo ---
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
    ;

export type DateSymbol = '🛫' | '⏳' | '📅';

// Representa una tarea extraída de una nota de Obsidian.
export interface Task {
    id: string;
    content: string;
    completed: boolean;
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'None';
    creationDate?: string; // Fecha de creación (formato YYYY-MM-DD)
    date?: string;         // Fecha asociada a la tarea (YYYY-MM-DD)
    dateSymbol?: DateSymbol; // Símbolo que precede a la fecha
    startTime?: string;    // Hora de inicio ([hI:: HH:mm])
    endTime?: string;      // Hora de finalización ([hF:: HH:mm])
    duration?: string;     // Duración ([Xmin] o [Xh])
    week?: string;         // Semana planificada ([w:: [[YYYY-WXX]]])
    dependencies: string[]; // Tareas de las que depende (⛔ ID)
    contexts: string[];     // Contextos GTD (#cx-...)
    assignedPeople: string[]; // Personas asignadas (#px-...)
    tags: string[];         // Otros tags como #inbox, #GTD-AlgunDia
    sourceFile: TFile;
    lineNumber: number;
    hasConflict?: boolean; // True si la tarea tiene metadatos inconsistentes.
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
    ownTaskCount: number; // Tareas abiertas propias de la nota.
    descendantTaskCount: number; // Tareas abiertas de toda la descendencia.
    frontmatter: Record<string, any>; // Metadatos del frontmatter.
    isNoteMissing?: boolean; // True si este item es un placeholder para una nota principal faltante.
}

// Contenedor para los datos procesados.
export interface ProcessedVaultData {
    hierarchicalData: HierarchicalItem[];
    gtdLists: Record<string, Task[]>;
    allTasks: Task[];
}