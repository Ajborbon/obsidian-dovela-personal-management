/**
 * Rutas y nombres de las notas de journal (puro). Corrige el trimestre (v1: `ceil(mes0/3)+1`)
 * y usa año ISO para semanas (v1: `moment().year(Y).isoWeek(W)` dependía del día actual).
 */
import { formatWeekCode, isoWeekOf, isoWeekStart, parseWeekCode, parseYmd, quarterOfMonth, weekdayNameEs, addDays } from '../dates';
import type { JournalSettings } from '../settings';

function joinPath(...parts: string[]): string {
  return parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `2025-10-24 viernes` */
export function dailyNoteName(date: string): string {
  return `${date} ${weekdayNameEs(date)}`;
}

/** Carpeta de la nota diaria según los interruptores (año / trimestre / mes). */
export function dailyFolder(s: JournalSettings, date: string): string {
  const p = parseYmd(date);
  if (!p) throw new Error(`Fecha inválida: ${date}`);
  const parts = [s.baseFolderPath];
  if (s.yearSubfolder) parts.push(String(p.y));
  if (s.quarterSubfolder) parts.push(`Q${quarterOfMonth(p.m)}`);
  if (s.monthSubfolder) parts.push(pad2(p.m));
  return joinPath(...parts);
}

/** Ruta completa con `.md` (compatible con `journalAPI.getDailyNotePath`). */
export function dailyNotePath(s: JournalSettings, date: string): string {
  return `${joinPath(dailyFolder(s, date), dailyNoteName(date))}.md`;
}

/** Reemplaza `{YYYY} {Q} {MM} {WW}` (todas las apariciones). */
export function applyPattern(pattern: string, vars: { YYYY: string; Q: string; MM: string; WW: string }): string {
  return pattern
    .replace(/\{YYYY\}/g, vars.YYYY)
    .replace(/\{Q\}/g, vars.Q)
    .replace(/\{MM\}/g, vars.MM)
    .replace(/\{WW\}/g, vars.WW);
}

/**
 * Ruta (sin `.md`) del enlace de semana `[w::[[ruta|código]]]` de v1.
 * Año = año ISO; trimestre y mes del jueves de la semana (regla ISO, 02 §9.5).
 * Conserva el código tal como se recibió (v1 no rellenaba a 2 dígitos).
 */
export function weeklyLinkPath(s: JournalSettings, weekCode: string): string {
  const w = parseWeekCode(weekCode);
  if (!w) throw new Error(`Formato de semana inválido: ${weekCode}`);
  const thursday = addDays(isoWeekStart(w.year, w.week), 3);
  const m = Number(thursday.slice(5, 7));
  const folder = applyPattern(s.weekFolderPattern, { YYYY: String(w.year), Q: String(quarterOfMonth(m)), MM: pad2(m), WW: pad2(w.week) });
  return joinPath(s.baseFolderPath, folder, weekCode.trim());
}

export function weeklyLink(s: JournalSettings, weekCode: string): string {
  return `[w::[[${weeklyLinkPath(s, weekCode)}|${weekCode.trim()}]]]`;
}

export type PeriodKind = 'week' | 'month' | 'quarter' | 'year';

/** Código del periodo que contiene `date`: `2026-W45`, `2026-11`, `2026-Q4`, `2026`. */
export function periodCode(kind: PeriodKind, date: string): string {
  const p = parseYmd(date);
  if (!p) throw new Error(`Fecha inválida: ${date}`);
  switch (kind) {
    case 'week': return formatWeekCode(isoWeekOf(date));
    case 'month': return `${p.y}-${pad2(p.m)}`;
    case 'quarter': return `${p.y}-Q${quarterOfMonth(p.m)}`;
    case 'year': return String(p.y);
  }
}

/** Carpeta de notas de periodo (semanal, mensual, trimestral, anual). */
export function periodNotePath(s: JournalSettings, kind: PeriodKind, date: string): string {
  const code = periodCode(kind, date);
  const p = parseYmd(date);
  if (!p) throw new Error(`Fecha inválida: ${date}`);
  const year = kind === 'week' ? code.slice(0, 4) : String(p.y);
  const m = kind === 'week' ? Number(addDays(isoWeekStart(Number(code.slice(0, 4)), Number(code.slice(6))), 3).slice(5, 7)) : p.m;
  const folder = applyPattern(s.periodFolderPattern, { YYYY: year, Q: String(quarterOfMonth(m)), MM: pad2(m), WW: code.slice(6) });
  return `${joinPath(s.baseFolderPath, folder, code)}.md`;
}

/** Carpetas que deben existir para la nota diaria (de la base hacia abajo). */
export function dailyFolderChain(s: JournalSettings, date: string): string[] {
  const full = dailyFolder(s, date);
  const segs = full.split('/');
  return segs.map((_, i) => segs.slice(0, i + 1).join('/'));
}
