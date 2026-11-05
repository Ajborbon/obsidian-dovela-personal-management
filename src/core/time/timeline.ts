/**
 * Cronograma: bloques por día y disposición en columnas para solapes.
 * Mejora sobre v1: asignación de columnas por intervalos (A 10-11 y C 11:30-13 comparten
 * columna aunque B se solape con ambos), en vez de repartir el ancho a partes iguales.
 */
import { localInstant } from '../dates';
import type { TimeLog } from './merge';
import { splitByDay } from './stats';

export interface DayBlock {
  readonly log: TimeLog;
  /** Minutos desde medianoche local (0..1440). */
  readonly startMin: number;
  readonly endMin: number;
  /** El registro continúa desde el día anterior / hacia el siguiente. */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
  column: number;
  columns: number;
}

export function blocksForDay(logs: Iterable<TimeLog>, day: string): DayBlock[] {
  const dayStart = localInstant(day).getTime();
  const out: DayBlock[] = [];
  for (const log of logs) {
    if (log.bad) continue;
    for (const s of splitByDay(log)) {
      if (s.day !== day) continue;
      out.push({
        log,
        startMin: Math.round((s.start - dayStart) / 60000),
        endMin: Math.round((s.end - dayStart) / 60000),
        continuesBefore: s.start > log.start,
        continuesAfter: s.end < log.end,
        column: 0,
        columns: 1,
      });
    }
  }
  return layoutColumns(out);
}

/** Asigna columnas dentro de cada grupo de bloques encadenados por solape. */
export function layoutColumns(blocks: DayBlock[]): DayBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let cluster: DayBlock[] = [];
  let clusterEnd = -1;
  const colEnds: number[] = [];
  const flush = (): void => {
    const n = Math.max(1, colEnds.length);
    cluster.forEach((b) => (b.columns = n));
    cluster = [];
    colEnds.length = 0;
  };
  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= b.startMin);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(b.endMin);
    } else colEnds[col] = b.endMin;
    b.column = col;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();
  return sorted;
}

/** Ajuste a una rejilla de minutos (arrastrar/redimensionar). */
export function snapMinutes(min: number, step = 5): number {
  return Math.max(0, Math.min(1440, Math.round(min / step) * step));
}
