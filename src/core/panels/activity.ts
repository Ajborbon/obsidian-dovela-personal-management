/**
 * Panel de actividad (lógica pura). Sustituye a `AnalyzerService` de v1 (RI-C §5.5):
 * - no lee el vault: usa las tareas del índice (`➕ created`, `✅ done`) y `ctime/mtime` de los registros;
 * - periodos con fin INCLUSIVO hasta el final del día (v1 cortaba el día final a las 00:00 en «personalizado»);
 * - serie por día/semana/mes para un gráfico simple de barras.
 *
 * Las fechas de las tareas son de calendario (YYYY-MM-DD); los instantes de las notas se convierten
 * a fecha LOCAL del dispositivo (`toLocalYmd`).
 */
import {
  addDays, compareYmd, dayNumber, formatYmd, isValidYmd, isoWeekOf, isoWeekday, localInstant, monthNameEs,
  parseYmd, startOfIsoWeek, toLocalYmd, type Ymd,
} from '../dates';
import type { TaskStatus } from '../tasks/model';

export type ActivityPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export const ACTIVITY_PERIODS: readonly { readonly key: ActivityPeriod; readonly label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
];

/** Rango de días inclusivo en ambos extremos. */
export interface DayRange {
  readonly from: Ymd;
  readonly to: Ymd;
}

/** Subconjunto de `Task` que necesita el panel (facilita las pruebas). */
export interface ActivityTask {
  readonly path: string;
  readonly line: number;
  readonly key: string;
  readonly text: string;
  readonly raw: string;
  readonly status: TaskStatus;
  readonly created?: string;
  readonly done?: string;
}

/** Subconjunto de `NoteRecord`. */
export interface ActivityNote {
  readonly path: string;
  readonly basename: string;
  readonly folder: string;
  readonly ctime: number;
  readonly mtime: number;
}

export interface TaskHit<T extends ActivityTask = ActivityTask> {
  readonly task: T;
  readonly day: Ymd;
}

export interface NoteHit<N extends ActivityNote = ActivityNote> {
  readonly note: N;
  /** Instante (ms) que hizo entrar a la nota en el periodo (ctime o mtime). */
  readonly at: number;
  readonly day: Ymd;
}

export type SeriesBucket = 'day' | 'week' | 'month';

export interface SeriesPoint {
  readonly key: string;
  readonly label: string;
  readonly from: Ymd;
  readonly to: Ymd;
  captured: number;
  completed: number;
  created: number;
  modified: number;
}

export interface ActivityMetrics<T extends ActivityTask = ActivityTask, N extends ActivityNote = ActivityNote> {
  readonly range: DayRange;
  readonly captured: TaskHit<T>[];
  readonly completed: TaskHit<T>[];
  readonly notesCreated: NoteHit<N>[];
  readonly notesModified: NoteHit<N>[];
  /** Completadas − capturadas (v1: «Balance neto»). */
  readonly balance: number;
  readonly bucket: SeriesBucket;
  readonly series: SeriesPoint[];
}

export interface ActivityOptions {
  /** Prefijos de ruta que no cuentan como notas creadas/modificadas (p. ej. la carpeta de registros de tiempo). */
  readonly excludeNotePrefixes?: readonly string[];
}

/** Rango del periodo. `week` = lunes ISO..hoy; `month` = día 1..hoy; `custom` sin rango = últimos 30 días. */
export function periodRange(period: ActivityPeriod, today: Ymd, custom?: Partial<DayRange> | null): DayRange {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: startOfIsoWeek(today), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'custom':
      return normalizeRange(custom?.from, custom?.to, today);
  }
}

/** Ordena los extremos y completa los ausentes/inválidos (fin = hoy, inicio = fin − 29 días). */
export function normalizeRange(from: string | undefined | null, to: string | undefined | null, today: Ymd): DayRange {
  const f = from && isValidYmd(from) ? from : null;
  const t = to && isValidYmd(to) ? to : null;
  if (f && t) return compareYmd(f, t) <= 0 ? { from: f, to: t } : { from: t, to: f };
  if (f) return { from: f, to: compareYmd(f, today) <= 0 ? today : f };
  const end = t ?? today;
  return { from: addDays(end, -29), to: end };
}

export function rangeDays(r: DayRange): number {
  return dayNumber(r.to) - dayNumber(r.from) + 1;
}

/** Instantes [inicio, fin) en hora local: el día final se incluye completo. */
export function rangeInstants(r: DayRange): { readonly start: number; readonly end: number } {
  return { start: localInstant(r.from).getTime(), end: localInstant(addDays(r.to, 1)).getTime() };
}

export function inRange(day: string | undefined, r: DayRange): day is Ymd {
  return !!day && isValidYmd(day) && day >= r.from && day <= r.to;
}

/** Texto corto del periodo para títulos (`Hoy`, `03/11 – 05/11`…). */
export function periodLabel(period: ActivityPeriod, r: DayRange): string {
  if (period !== 'custom') return ACTIVITY_PERIODS.find((p) => p.key === period)?.label ?? '';
  const short = (d: Ymd): string => `${d.slice(8, 10)}/${d.slice(5, 7)}${d.slice(0, 4) === r.to.slice(0, 4) ? '' : `/${d.slice(2, 4)}`}`;
  return r.from === r.to ? short(r.from) : `${short(r.from)} – ${short(r.to)}`;
}

/** Agrupación automática de la serie: ≤ 31 días por día, ≤ 26 semanas por semana, si no por mes. */
export function chooseBucket(r: DayRange): SeriesBucket {
  const n = rangeDays(r);
  if (n <= 31) return 'day';
  if (n <= 182) return 'week';
  return 'month';
}

const SHORT_WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function bucketKey(day: Ymd, bucket: SeriesBucket): string {
  if (bucket === 'day') return day;
  if (bucket === 'month') return day.slice(0, 7);
  return startOfIsoWeek(day);
}

/** Puntos vacíos de la serie, en orden, cubriendo todo el rango. */
export function emptySeries(r: DayRange, bucket: SeriesBucket = chooseBucket(r)): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let d = r.from;
  while (d <= r.to) {
    let end: Ymd;
    let label: string;
    if (bucket === 'day') {
      end = d;
      const wd = SHORT_WD[isoWeekday(d) - 1] ?? '';
      label = `${wd} ${Number(d.slice(8, 10))}`;
    } else if (bucket === 'week') {
      end = addDays(startOfIsoWeek(d), 6);
      label = `S${isoWeekOf(d).week}`;
    } else {
      const p = parseYmd(d);
      if (!p) break;
      end = addDays(formatYmd(p.m === 12 ? p.y + 1 : p.y, p.m === 12 ? 1 : p.m + 1, 1), -1);
      label = `${monthNameEs(p.m).slice(0, 3)} ${String(p.y).slice(2)}`;
    }
    if (end > r.to) end = r.to;
    out.push({ key: bucketKey(d, bucket), label, from: d, to: end, captured: 0, completed: 0, created: 0, modified: 0 });
    d = addDays(end, 1);
  }
  return out;
}

function excluded(path: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) {
    if (!p) continue;
    const pre = p.endsWith('/') ? p : `${p}/`;
    if (path.startsWith(pre)) return true;
  }
  return false;
}

/**
 * Calcula las métricas del periodo.
 * - Capturadas: tareas con `➕` en el rango (cualquier estado).
 * - Completadas: tareas con `✅` en el rango y estado completada (una tarea reabierta que conserva `✅` no cuenta).
 * - Notas creadas: `ctime` en el rango; modificadas: `mtime` en el rango (incluye las creadas, como v1).
 */
export function computeActivity<T extends ActivityTask, N extends ActivityNote>(
  notes: Iterable<N>,
  tasks: Iterable<T>,
  range: DayRange,
  opts: ActivityOptions = {},
): ActivityMetrics<T, N> {
  const captured: TaskHit<T>[] = [];
  const completed: TaskHit<T>[] = [];
  const notesCreated: NoteHit<N>[] = [];
  const notesModified: NoteHit<N>[] = [];
  const bucket = chooseBucket(range);
  const series = emptySeries(range, bucket);
  const byKey = new Map(series.map((p) => [p.key, p]));
  const point = (day: Ymd): SeriesPoint | undefined => byKey.get(bucketKey(day, bucket));

  for (const t of tasks) {
    if (inRange(t.created, range)) {
      captured.push({ task: t, day: t.created });
      const p = point(t.created);
      if (p) p.captured++;
    }
    if (t.status === 'done' && inRange(t.done, range)) {
      completed.push({ task: t, day: t.done });
      const p = point(t.done);
      if (p) p.completed++;
    }
  }

  const { start, end } = rangeInstants(range);
  const prefixes = opts.excludeNotePrefixes ?? [];
  for (const n of notes) {
    if (prefixes.length && excluded(n.path, prefixes)) continue;
    if (n.ctime > 0 && n.ctime >= start && n.ctime < end) {
      const day = toLocalYmd(new Date(n.ctime));
      notesCreated.push({ note: n, at: n.ctime, day });
      const p = point(day);
      if (p) p.created++;
    }
    if (n.mtime > 0 && n.mtime >= start && n.mtime < end) {
      const day = toLocalYmd(new Date(n.mtime));
      notesModified.push({ note: n, at: n.mtime, day });
      const p = point(day);
      if (p) p.modified++;
    }
  }

  const byTaskDay = (a: TaskHit<T>, b: TaskHit<T>): number =>
    compareYmd(b.day, a.day) || a.task.path.localeCompare(b.task.path) || a.task.line - b.task.line;
  const byInstant = (a: NoteHit<N>, b: NoteHit<N>): number => b.at - a.at || a.note.path.localeCompare(b.note.path);
  captured.sort(byTaskDay);
  completed.sort(byTaskDay);
  notesCreated.sort(byInstant);
  notesModified.sort(byInstant);

  return {
    range, captured, completed, notesCreated, notesModified,
    balance: completed.length - captured.length,
    bucket, series,
  };
}

/** Máximo de la serie para escalar las barras (≥ 1). */
export function seriesMax(series: readonly SeriesPoint[], keys: readonly (keyof Pick<SeriesPoint, 'captured' | 'completed' | 'created' | 'modified'>)[]): number {
  let max = 1;
  for (const p of series) for (const k of keys) if (p[k] > max) max = p[k];
  return max;
}

/** `+3`, `0`, `-2`. */
export function formatBalance(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
