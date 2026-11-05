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
export type TaskStatus = 'incomplete' | 'completed' | 'in-progress';
export type DisplayStatus = 'overdue' | 'today' | 'future' | 'paused-dep' | 'paused-start' | null;

// Representa una tarea extraída de una nota de Obsidian.
export interface Task {
    id: string;
    content: string;
    status: TaskStatus; // Nuevo campo
    completed: boolean; // Mantenemos este por retrocompatibilidad
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'None';
    creationDate?: string; // Fecha de creación (formato YYYY-MM-DD)
    date?: string;         // Fecha asociada a la tarea (YYYY-MM-DD)
    dateSymbol?: DateSymbol; // Símbolo que precede a la fecha
    additionalDates?: {symbol: DateSymbol, date: string}[]; // NUEVO: Fechas adicionales para validación
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
    displayStatus?: DisplayStatus; // Estado derivado para la presentación (overdue, today, future, paused-dep, paused-start)
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

// Representa un elemento de navegación para las listas GTD
export interface NavigationItem {
    id: string;           // ID único para el elemento (ej: "next-actions-cx-oficina")
    label: string;        // Texto a mostrar (ej: "#cx-oficina")
    count: number;        // Número de tareas
    icon: string;         // Icono a mostrar (ej: "📋" para contextos, "👤" para personas)
    isSublist: boolean;   // True si es una sublista, false si es lista principal
    parentList?: string;  // ID de la lista padre (solo para sublistas)
    anchor: string;       // Ancla para navegación (ej: "#cx-oficina")
}

// Contenedor para los datos procesados.
export interface ProcessedVaultData {
    hierarchicalData: HierarchicalItem[];
    gtdLists: Record<string, Task[] | Map<string, Task[]>>;
    inProgressData: InProgressData;
    allTasks: Task[];
    uniqueContexts: string[];
    uniquePeople: string[];
    navigationItems: NavigationItem[]; // Nueva propiedad para navegación
}

export interface InProgressData {
    groups: { [groupName: string]: Task[] };
    stats: {
        total: number;
        overdue: number;
        definedTimeMinutes: number;
        estimatedTimeMinutes: number;
    };
}

// --- Time Tracking ---

// Representa una única sesión de tiempo registrada.
export interface TimeLogEntry {
    id: string; // ID único, p.ej., timestamp en ms.
    taskNotePath: string; // Ruta a la nota de la tarea.
    startTime: string; // Fecha y hora de inicio en formato ISO 8601.
    endTime: string; // Fecha y hora de finalización en formato ISO 8601.
    durationMinutes: number; // Duración total en minutos.
    notes: string; // Notas opcionales sobre la sesión.
    taskDescription?: string; // Descripción de la tarea en ese momento.
}

// Representa el estado de un temporizador activo que fue interrumpido.
export interface ActiveTimerState {
    taskNotePath: string; // Ruta a la nota de la tarea.
    startTime: string; // Fecha y hora de inicio en formato ISO 8601.
    taskDescription?: string; // Descripción de la tarea que se estaba cronometrando.
    lineNumber?: number; // Línea de la tarea en la nota.
}

// --- Plugin Data ---

// Define la estructura completa de los datos que el plugin guarda en data.json.
export interface DovelaPluginData {
    schemaVersion: number;
    timeLogs: TimeLogEntry[];
    interruptedTimer?: ActiveTimerState | undefined;
}

// Define los valores por defecto para los datos del plugin.
export const DEFAULT_SETTINGS: DovelaPluginData = {
    schemaVersion: 1,
    timeLogs: [],
    interruptedTimer: undefined as ActiveTimerState | undefined
};
