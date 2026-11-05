/**
 * Geometría pura del Cronograma: días visibles, conversión píxel↔minuto, mover/redimensionar/crear
 * con ajuste a 5 minutos. La vista solo traduce eventos de puntero a estas funciones.
 */
import { addDays, localInstant, startOfIsoWeek, toLocalYmd } from '../dates';
import { snapMinutes } from './timeline';

export type TimelineMode = 'day' | '3day' | 'week';

export const BASE_HOUR_HEIGHT = 50;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;
/** Duración mínima de un registro creado o redimensionado en el Cronograma. */
export const MIN_BLOCK_MINUTES = 5;

export function visibleDays(mode: TimelineMode, anchor: string): string[] {
  const first = mode === 'week' ? startOfIsoWeek(anchor) : anchor;
  const n = mode === 'day' ? 1 : mode === '3day' ? 3 : 7;
  return Array.from({ length: n }, (_v, i) => addDays(first, i));
}

export function shiftTimeline(mode: TimelineMode, anchor: string, dir: 1 | -1): string {
  return addDays(anchor, (mode === 'day' ? 1 : mode === '3day' ? 3 : 7) * dir);
}

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1.5;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z / ZOOM_STEP) * ZOOM_STEP));
}

export function hourHeight(zoom: number): number {
  return BASE_HOUR_HEIGHT * clampZoom(zoom);
}

/** Minuto del día (0..1440, decimal) correspondiente a una coordenada Y dentro de la columna. */
export function yToMinutes(y: number, columnHeight: number): number {
  if (!(columnHeight > 0)) return 0;
  return Math.max(0, Math.min(1440, (y / columnHeight) * 1440));
}

export function minutesToY(min: number, columnHeight: number): number {
  return (min / 1440) * columnHeight;
}

export interface Interval {
  readonly start: number;
  readonly end: number;
}

/**
 * Mover un registro: el segmento arrastrado (que empezaba en `segStart`) pasa a empezar en
 * `targetMin` (ajustado a 5 min) del día `targetDay`; todo el registro se desplaza lo mismo
 * (un registro multi‑día conserva su duración).
 */
export function moveInterval(log: Interval, segStart: number, targetDay: string, targetMin: number, step = 5): Interval {
  const newSegStart = localInstant(targetDay, snapMinutes(targetMin, step)).getTime();
  const offset = newSegStart - segStart;
  return { start: log.start + offset, end: log.end + offset };
}

/** Redimensionar por el borde inferior del segmento final (día `day`). Mínimo 5 minutos. */
export function resizeInterval(log: Interval, day: string, endMin: number, step = 5): Interval {
  const end = localInstant(day, snapMinutes(endMin, step)).getTime();
  return { start: log.start, end: Math.max(end, log.start + MIN_BLOCK_MINUTES * 60_000) };
}

/** Intervalo creado arrastrando en vacío; null si es demasiado corto (un clic). */
export function createInterval(day: string, aMin: number, bMin: number, step = 5): Interval | null {
  const lo = snapMinutes(Math.min(aMin, bMin), step);
  const hi = snapMinutes(Math.max(aMin, bMin), step);
  if (hi - lo < MIN_BLOCK_MINUTES) return null;
  return { start: localInstant(day, lo).getTime(), end: localInstant(day, hi).getTime() };
}

/** Minuto del día de "ahora" si `day` es hoy (línea roja); null en otro caso. */
export function nowMinutes(now: number, day: string): number | null {
  const d = new Date(now);
  if (toLocalYmd(d) !== day) return null;
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Clase de tamaño del bloque según su altura en px (v1: < 35 diminuto, < 70 pequeño). */
export function blockSizeClass(px: number): 'size-tiny' | 'size-small' | 'size-normal' {
  if (px < 35) return 'size-tiny';
  if (px < 70) return 'size-small';
  return 'size-normal';
}

/** Carpeta raíz de una ruta (clave de color del Cronograma, como v1). */
export function rootFolder(path: string): string {
  const i = path.indexOf('/');
  return i < 0 ? path : path.slice(0, i);
}
