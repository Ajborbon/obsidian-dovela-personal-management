/** Modelo de tarea de Dovela v2 (puro, sin dependencias de Obsidian). */

export type TaskStatus = 'open' | 'in-progress' | 'done' | 'cancelled';
export type DateSymbol = '🛫' | '⏳' | '📅';

export interface TaskDate {
  readonly symbol: DateSymbol;
  readonly date: string; // YYYY-MM-DD (puede ser inválida: ver `invalidDates`)
}

export interface Priority {
  /** 0 = 🔺 … 4 = ⏬, 5 = sin prioridad. Conserva el orden relativo de v1. */
  readonly rank: number;
  readonly symbol: string; // '' si no hay
}

export interface ParsedTask {
  readonly status: TaskStatus;
  readonly statusChar: string;
  readonly indent: string;
  /** Línea original completa (sin `\r`). */
  readonly raw: string;
  /** Texto para mostrar: contenido sin metadatos reconocidos. */
  readonly text: string;
  readonly priority: Priority;
  /** Fecha principal = la PRIMERA fecha 🛫/⏳/📅 del texto (semántica v1). */
  readonly date?: string;
  readonly dateSymbol?: DateSymbol;
  /** Todas las fechas 🛫/⏳/📅 en orden de aparición (la primera es la principal). */
  readonly dates: readonly TaskDate[];
  readonly created?: string;
  readonly createdTime?: string;
  readonly done?: string;
  readonly cancelledOn?: string;
  readonly recurrence?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly startMinutes?: number;
  readonly endMinutes?: number;
  readonly duration?: string;
  readonly durationMinutes?: number;
  /** Semana planificada normalizada `YYYY-Wnn`. */
  readonly week?: string;
  /** Id explícito (`🆔 x` o `^x`). Sin id explícito la tarea no puede ser destino de dependencias. */
  readonly id?: string;
  readonly blockId?: string;
  readonly dependencies: readonly string[];
  readonly contexts: readonly string[];
  readonly people: readonly string[];
  /** Etiquetas GTD reconocidas: `inbox`, `GTD-AlgunDia`, `GTD-EstaSemanaNo`. */
  readonly gtdTags: readonly string[];
  /** Resto de etiquetas (`#algo`), que también permanecen en `text`. */
  readonly otherTags: readonly string[];
  /** Conflicto de horas/duración o fecha inválida (→ Bandeja de Entrada). */
  readonly hasConflict: boolean;
  readonly conflicts: readonly string[];
  /** Start > Scheduled, Start > Due o Scheduled > Due (→ solo Bandeja de Entrada). */
  readonly invalidDateOrder: boolean;
}

export interface Task extends ParsedTask {
  readonly path: string;
  /** Línea 0-based en el archivo en el momento del parseo. */
  readonly line: number;
  /** Clave estable dentro de una versión del archivo: `ruta#línea`. */
  readonly key: string;
}

export const GTD_TAG_INBOX = 'inbox';
export const GTD_TAG_SOMEDAY = 'GTD-AlgunDia';
export const GTD_TAG_NOT_THIS_WEEK = 'GTD-EstaSemanaNo';
export const PROJECT_CONTEXTS: readonly string[] = ['ProyectoGTD', 'Entregable'];

export function isOpen(t: Pick<ParsedTask, 'status'>): boolean {
  return t.status === 'open' || t.status === 'in-progress';
}
