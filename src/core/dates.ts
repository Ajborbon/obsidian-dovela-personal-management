/**
 * Fechas "de calendario" sin zona horaria (YYYY-MM-DD) y semanas ISO.
 *
 * Toda la aritmética usa Date.UTC sobre (año, mes, día) para que el resultado
 * no dependa de la zona horaria del dispositivo. Solo `toLocalYmd` y
 * `toLocalHm` leen la hora local, y reciben el instante como parámetro
 * (nunca leen el reloj por su cuenta): así la lógica es testeable.
 */

export type Ymd = string; // 'YYYY-MM-DD'

export interface YmdParts {
  readonly y: number;
  readonly m: number; // 1..12
  readonly d: number; // 1..31
}

export interface IsoWeek {
  readonly year: number; // año ISO (puede diferir del año calendario)
  readonly week: number; // 1..53
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const WEEKDAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Devuelve las partes de una fecha si es una fecha de calendario real. */
export function parseYmd(s: string): YmdParts | null {
  const m = YMD_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export function isValidYmd(s: string): boolean {
  return parseYmd(s) !== null;
}

export function formatYmd(y: number, m: number, d: number): Ymd {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

/** Número de día absoluto (días desde 1970-01-01). Lanza si la fecha es inválida. */
export function dayNumber(s: Ymd): number {
  const p = parseYmd(s);
  if (!p) throw new Error(`Fecha inválida: ${s}`);
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / DAY_MS);
}

export function fromDayNumber(n: number): Ymd {
  const dt = new Date(n * DAY_MS);
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s: Ymd, n: number): Ymd {
  return fromDayNumber(dayNumber(s) + n);
}

export function addMonths(s: Ymd, n: number): Ymd {
  const p = parseYmd(s);
  if (!p) throw new Error(`Fecha inválida: ${s}`);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return formatYmd(y, m, Math.min(p.d, daysInMonth(y, m)));
}

export function diffDays(a: Ymd, b: Ymd): number {
  return dayNumber(a) - dayNumber(b);
}

/** Compara dos fechas válidas; las cadenas YYYY-MM-DD ordenan lexicográficamente. */
export function compareYmd(a: Ymd, b: Ymd): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(s: Ymd): number {
  const dow = new Date(dayNumber(s) * DAY_MS).getUTCDay(); // 0 = domingo
  return dow === 0 ? 7 : dow;
}

export function weekdayNameEs(s: Ymd): string {
  return WEEKDAYS_ES[isoWeekday(s) - 1] ?? '';
}

export function monthNameEs(m: number): string {
  return MONTHS_ES[m - 1] ?? '';
}

export function quarterOfMonth(m: number): number {
  return Math.ceil(m / 3);
}

/** Lunes de la semana ISO que contiene `s`. */
export function startOfIsoWeek(s: Ymd): Ymd {
  return addDays(s, 1 - isoWeekday(s));
}

/** Semana ISO 8601 (la semana pertenece al año de su jueves). */
export function isoWeekOf(s: Ymd): IsoWeek {
  const thursday = addDays(s, 4 - isoWeekday(s));
  const p = parseYmd(thursday);
  if (!p) throw new Error(`Fecha inválida: ${s}`);
  const jan1 = formatYmd(p.y, 1, 1);
  const week = Math.floor(diffDays(thursday, jan1) / 7) + 1;
  return { year: p.y, week };
}

export function weeksInIsoYear(year: number): number {
  // Un año ISO tiene 53 semanas si el 28 de diciembre cae en la semana 53.
  return isoWeekOf(formatYmd(year, 12, 28)).week;
}

/** Lunes de la semana ISO (year, week), anclado al 4 de enero (independiente del día actual). */
export function isoWeekStart(year: number, week: number): Ymd {
  const jan4 = formatYmd(year, 1, 4);
  return addDays(startOfIsoWeek(jan4), (week - 1) * 7);
}

export function isoWeekEnd(year: number, week: number): Ymd {
  return addDays(isoWeekStart(year, week), 6);
}

export function formatWeekCode(w: IsoWeek): string {
  return `${w.year}-W${pad2(w.week)}`;
}

/** Acepta `2025-W5`, `2025-W05`, `2025-w05`. Devuelve null si no es válida. */
export function parseWeekCode(code: string): IsoWeek | null {
  const m = /^(\d{4})-[Ww](\d{1,2})$/.exec(code.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > weeksInIsoYear(year)) return null;
  return { year, week };
}

/** Normaliza a `YYYY-Wnn`; null si no es válida. */
export function normalizeWeekCode(code: string): string | null {
  const w = parseWeekCode(code);
  return w ? formatWeekCode(w) : null;
}

export function compareWeeks(a: IsoWeek, b: IsoWeek): number {
  return a.year !== b.year ? a.year - b.year : a.week - b.week;
}

export function addWeeks(w: IsoWeek, n: number): IsoWeek {
  return isoWeekOf(addDays(isoWeekStart(w.year, w.week), n * 7));
}

/** Fecha local (zona del dispositivo) de un instante. */
export function toLocalYmd(instant: Date): Ymd {
  return formatYmd(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
}

/** Hora local HH:mm de un instante. */
export function toLocalHm(instant: Date): string {
  return `${pad2(instant.getHours())}:${pad2(instant.getMinutes())}`;
}

/** Construye el instante correspondiente a una fecha y hora LOCALES. */
export function localInstant(day: Ymd, minutesOfDay = 0): Date {
  const p = parseYmd(day);
  if (!p) throw new Error(`Fecha inválida: ${day}`);
  return new Date(p.y, p.m - 1, p.d, Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
}

/** `YYMMDD` para nombres de archivo. */
export function toYymmdd(s: Ymd): string {
  return s.slice(2, 4) + s.slice(5, 7) + s.slice(8, 10);
}

/** `YYMMDD` → `YYYY-MM-DD` (siglo 2000). */
export function fromYymmdd(s: string): Ymd | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const ymd = `20${m[1]}-${m[2]}-${m[3]}`;
  return isValidYmd(ymd) ? ymd : null;
}

/** Minutos del día desde un texto de hora: `10am`, `3:30 pm`, `15:00`. Null si no es válido. */
export function parseTimeOfDay(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$/.exec(s);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = ampm[2] ? Number(ampm[2]) : 0;
    if (h < 1 || h > 12 || min > 59) {
      // v1 aceptaba 0am como 0:00; se conserva.
      if (!(h === 0 && min <= 59)) return null;
    }
    const pm = (ampm[3] ?? '').startsWith('p');
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return h * 60 + min;
  }
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) {
    const h = Number(hm[1]);
    const min = Number(hm[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  return null;
}

export function formatMinutesOfDay(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
