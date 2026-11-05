/**
 * Configuración (pura) de los bloques nativos ```dovela-dia``` y ```dovela-semana```,
 * alternativa opcional a los bloques `datacorejsx` de las plantillas.
 *
 * Contenido del bloque (todas las líneas opcionales):
 *   2025-10-24            ← fecha (o `hoy`); en `dovela-semana`, `2025-W43` (o `esta semana`)
 *   limite: 20            ← showOverdueLimit
 *   agrupar-por-semana: sí, solo-criticas: no, acciones-rapidas: sí,
 *   completadas-colapsadas: sí, resaltar-hoy: sí   (también con los nombres de v1: showOverdueLimit…)
 * Sin fecha/semana en el bloque se usa la del nombre de la nota y, si no hay, hoy / la semana actual.
 */
import { formatWeekCode, isoWeekOf, isValidYmd, parseWeekCode } from '../dates';
import type { JournalRenderOptions } from './daily';
import type { WeeklyRenderOptions } from './weekly';

export type TargetSource = 'block' | 'note' | 'today';

export interface DayBlockConfig {
  readonly date: string;
  readonly source: TargetSource;
  readonly options: JournalRenderOptions;
  /** Líneas no reconocidas o valores inválidos (se muestran como aviso). */
  readonly warnings: readonly string[];
}

export interface WeekBlockConfig {
  readonly week: string;
  readonly source: TargetSource;
  readonly options: WeeklyRenderOptions;
  readonly warnings: readonly string[];
}

type OptionKind = 'number' | 'boolean';
const OPTION_ALIASES: Readonly<Record<string, { key: string; kind: OptionKind }>> = {
  showoverduelimit: { key: 'showOverdueLimit', kind: 'number' },
  limite: { key: 'showOverdueLimit', kind: 'number' },
  'limite-vencidas': { key: 'showOverdueLimit', kind: 'number' },
  groupoverduebyweek: { key: 'groupOverdueByWeek', kind: 'boolean' },
  'agrupar-por-semana': { key: 'groupOverdueByWeek', kind: 'boolean' },
  showonlycritical: { key: 'showOnlyCritical', kind: 'boolean' },
  'solo-criticas': { key: 'showOnlyCritical', kind: 'boolean' },
  enablequickactions: { key: 'enableQuickActions', kind: 'boolean' },
  'acciones-rapidas': { key: 'enableQuickActions', kind: 'boolean' },
  showcompletedcollapsed: { key: 'showCompletedCollapsed', kind: 'boolean' },
  'completadas-colapsadas': { key: 'showCompletedCollapsed', kind: 'boolean' },
  highlighttoday: { key: 'highlightToday', kind: 'boolean' },
  'resaltar-hoy': { key: 'highlightToday', kind: 'boolean' },
};
const DAY_KEYS = new Set(['showOverdueLimit', 'groupOverdueByWeek', 'showOnlyCritical', 'enableQuickActions']);
const WEEK_KEYS = new Set(['showOverdueLimit', 'showCompletedCollapsed', 'highlightToday']);
const TARGET_KEYS = new Set(['fecha', 'date', 'dia', 'día', 'semana', 'week']);

const DATE_TOKEN = /\d{4}-\d{2}-\d{2}/;
const WEEK_TOKEN = /\d{4}-[Ww]\d{1,2}(?!\d)/;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseBool(v: string): boolean | null {
  const s = stripAccents(v.trim().toLowerCase());
  if (['si', 'true', '1', 'yes', 'on'].includes(s)) return true;
  if (['no', 'false', '0', 'off'].includes(s)) return false;
  return null;
}

interface Scan {
  target: string | null;
  options: Record<string, number | boolean>;
  warnings: string[];
}

function scan(source: string, kind: 'day' | 'week', today: string): Scan {
  const allowed = kind === 'day' ? DAY_KEYS : WEEK_KEYS;
  const token = kind === 'day' ? DATE_TOKEN : WEEK_TOKEN;
  const out: Scan = { target: null, options: {}, warnings: [] };
  const findTarget = (text: string): string | null => {
    const low = stripAccents(text.trim().toLowerCase());
    if (kind === 'day' && low === 'hoy') return today;
    if (kind === 'week' && (low === 'esta semana' || low === 'hoy')) return formatWeekCode(isoWeekOf(today));
    return token.exec(text)?.[0] ?? null;
  };
  for (const line0 of source.split('\n')) {
    const line = line0.trim();
    if (!line || line.startsWith('%%') || line.startsWith('//')) continue;
    const kv = /^([\p{L}\p{N}_-]+)\s*[:=]\s*(.+)$/u.exec(line);
    if (kv) {
      const rawKey = stripAccents((kv[1] ?? '').toLowerCase());
      const value = (kv[2] ?? '').trim();
      if (TARGET_KEYS.has(rawKey) || TARGET_KEYS.has(kv[1]?.toLowerCase() ?? '')) {
        const t = findTarget(value);
        if (t && !out.target) out.target = t;
        else if (!t) out.warnings.push(`Valor no reconocido: ${line}`);
        continue;
      }
      const opt = OPTION_ALIASES[rawKey];
      if (!opt || !allowed.has(opt.key)) {
        out.warnings.push(`Opción desconocida: ${kv[1] ?? ''}`);
        continue;
      }
      if (opt.kind === 'number') {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) out.options[opt.key] = Math.floor(n);
        else out.warnings.push(`Número inválido en ${kv[1] ?? ''}: ${value}`);
      } else {
        const b = parseBool(value);
        if (b === null) out.warnings.push(`Valor sí/no inválido en ${kv[1] ?? ''}: ${value}`);
        else out.options[opt.key] = b;
      }
      continue;
    }
    const t = findTarget(line);
    if (t && !out.target) out.target = t;
    else if (!t) out.warnings.push(`Línea no reconocida: ${line}`);
  }
  return out;
}

/** Configuración de ```dovela-dia```. `noteBasename` = nombre de la nota sin extensión. */
export function parseDayBlock(source: string, noteBasename: string, today: string): DayBlockConfig {
  const s = scan(source, 'day', today);
  const fromNote = DATE_TOKEN.exec(noteBasename)?.[0];
  if (s.target) return { date: s.target, source: 'block', options: s.options, warnings: s.warnings };
  if (fromNote && isValidYmd(fromNote)) return { date: fromNote, source: 'note', options: s.options, warnings: s.warnings };
  return { date: today, source: 'today', options: s.options, warnings: s.warnings };
}

/** Configuración de ```dovela-semana```. Nombre de nota como en `Plt - Semanal` (`\d{4}-W\d{1,2}`). */
export function parseWeekBlock(source: string, noteBasename: string, today: string): WeekBlockConfig {
  const s = scan(source, 'week', today);
  const fromNote = WEEK_TOKEN.exec(noteBasename)?.[0];
  if (s.target) return { week: s.target, source: 'block', options: s.options, warnings: s.warnings };
  if (fromNote && parseWeekCode(fromNote)) return { week: fromNote, source: 'note', options: s.options, warnings: s.warnings };
  return { week: formatWeekCode(isoWeekOf(today)), source: 'today', options: s.options, warnings: s.warnings };
}
