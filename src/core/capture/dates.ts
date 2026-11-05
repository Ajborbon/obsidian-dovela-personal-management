/**
 * Fechas del Smart Inbox (puro): fechas “legacy” escritas tras `!` y accesos rápidos del calendario.
 *
 * Semántica (documentada en docs/v2/guia/captura.md):
 * - `hoy|today`, `mañana|tomorrow`, `ayer|yesterday`, `pasado mañana`.
 * - Día de la semana (`lunes`, `lun`, `monday`, `mon`…): la PRÓXIMA ocurrencia contando hoy
 *   (si hoy es lunes, `lunes` = hoy; igual que v1).
 * - `próximo lunes` / `next monday`: ese día en la semana ISO SIGUIENTE (lunes a domingo).
 * - `YYYY-MM-DD` y `YYMMDD` (backlog v0.9), solo fechas reales.
 * Todo insensible a mayúsculas y acentos; no depende del locale de moment (defecto de v1).
 */
import { addDays, addMonths, fromYymmdd, isValidYmd, isoWeekday, startOfIsoWeek, type Ymd } from '../dates';
import { foldText } from './match';

/** 1 = lunes … 7 = domingo. */
const WEEKDAY_WORDS: Readonly<Record<string, number>> = {
  lunes: 1, lun: 1, monday: 1, mon: 1,
  martes: 2, mar: 2, tuesday: 2, tue: 2, tues: 2,
  miercoles: 3, mie: 3, mier: 3, wednesday: 3, wed: 3,
  jueves: 4, jue: 4, thursday: 4, thu: 4, thur: 4, thurs: 4,
  viernes: 5, vie: 5, friday: 5, fri: 5,
  sabado: 6, sab: 6, saturday: 6, sat: 6,
  domingo: 7, dom: 7, sunday: 7, sun: 7,
};

const RELATIVE: Readonly<Record<string, number>> = {
  hoy: 0, today: 0,
  manana: 1, tomorrow: 1,
  ayer: -1, yesterday: -1,
  'pasado manana': 2,
};

/** Palabras que pueden preceder a un día de la semana (`próximo lunes`, `next monday`). */
export const NEXT_WORDS: readonly string[] = ['proximo', 'proxima', 'next'];

/** ¿La primera palabra de una fecha de dos palabras? (para saber si `!próximo ` sigue siendo una fecha en curso). */
export function isDatePrefixWord(word: string): boolean {
  const w = foldText(word);
  return NEXT_WORDS.includes(w) || w === 'pasado';
}

/** Próxima ocurrencia (hoy incluido) del día ISO `wd` (1..7). */
export function nextWeekday(today: Ymd, wd: number): Ymd {
  return addDays(today, (wd - isoWeekday(today) + 7) % 7);
}

/** Día `wd` (1..7) de la semana ISO siguiente a la de `today`. */
export function weekdayOfNextWeek(today: Ymd, wd: number): Ymd {
  return addDays(startOfIsoWeek(today), 7 + wd - 1);
}

/** Interpreta el texto escrito tras `!`. Devuelve null si no es una fecha reconocida. */
export function parseLegacyDate(raw: string, today: Ymd): Ymd | null {
  const s = foldText(raw).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const rel = RELATIVE[s];
  if (rel !== undefined) return addDays(today, rel);
  const wd = WEEKDAY_WORDS[s];
  if (wd !== undefined) return nextWeekday(today, wd);
  const parts = s.split(' ');
  if (parts.length === 2 && NEXT_WORDS.includes(parts[0] ?? '')) {
    const w = WEEKDAY_WORDS[parts[1] ?? ''];
    if (w !== undefined) return weekdayOfNextWeek(today, w);
    if (parts[1] === 'semana' || parts[1] === 'week') return addDays(today, 7);
    if (parts[1] === 'mes' || parts[1] === 'month') return addMonths(today, 1);
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidYmd(s) ? s : null;
  if (/^\d{6}$/.test(s)) return fromYymmdd(s);
  return null;
}

export interface QuickDate {
  readonly id: 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'next-month';
  readonly label: string;
  readonly date: Ymd;
}

/**
 * Accesos rápidos del calendario (v1): Hoy, Mañana, Esta semana (viernes ≥ hoy),
 * Próxima semana (el viernes siguiente a ese), Próximo mes (+1 mes, ajustado a fin de mes).
 */
export function quickDates(today: Ymd): QuickDate[] {
  const friday = nextWeekday(today, 5);
  return [
    { id: 'today', label: 'Hoy', date: today },
    { id: 'tomorrow', label: 'Mañana', date: addDays(today, 1) },
    { id: 'this-week', label: 'Esta semana (vie)', date: friday },
    { id: 'next-week', label: 'Próxima semana (vie)', date: addDays(friday, 7) },
    { id: 'next-month', label: 'Próximo mes', date: addMonths(today, 1) },
  ];
}
