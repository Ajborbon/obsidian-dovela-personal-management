/**
 * Agregaciones de tiempo (v1 `statisticsView.buildTree`, `getMonthlyActivity`), puras.
 * Mejora documentada: un registro que cruza medianoche se REPARTE entre los días (v1 lo
 * atribuía entero al día de inicio en Estadísticas y lo partía solo en el Cronograma).
 */
import { addDays, compareYmd, localInstant, toLocalYmd } from '../dates';
import type { TimeLog } from './merge';

export interface DaySlice {
  readonly day: string; // YYYY-MM-DD local
  readonly start: number;
  readonly end: number;
  readonly minutes: number;
}

/** Partes de un registro por día local. */
export function splitByDay(log: Pick<TimeLog, 'start' | 'end'>): DaySlice[] {
  if (!(log.end > log.start)) return [];
  const out: DaySlice[] = [];
  let day = toLocalYmd(new Date(log.start));
  let cursor = log.start;
  for (let guard = 0; guard < 400 && cursor < log.end; guard++) {
    const next = localInstant(addDays(day, 1)).getTime();
    const end = Math.min(next, log.end);
    out.push({ day, start: cursor, end, minutes: (end - cursor) / 60000 });
    cursor = end;
    day = addDays(day, 1);
  }
  return out;
}

export interface DayRange {
  readonly from: string; // inclusive
  readonly to: string; // inclusive
}

/** Minutos de un registro dentro del rango de días (incluido). */
export function minutesInRange(log: Pick<TimeLog, 'start' | 'end'>, range: DayRange | null): number {
  const slices = splitByDay(log);
  const inRange = range ? slices.filter((s) => compareYmd(s.day, range.from) >= 0 && compareYmd(s.day, range.to) <= 0) : slices;
  return inRange.reduce((acc, s) => acc + s.minutes, 0);
}

export function logsInRange<T extends Pick<TimeLog, 'start' | 'end'>>(logs: Iterable<T>, range: DayRange | null): T[] {
  const out: T[] = [];
  for (const l of logs) if (l.end > l.start && minutesInRange(l, range) > 0) out.push(l);
  return out;
}

/** Minutos por día (mapa de calor / calendario). */
export function dailyTotals(logs: Iterable<Pick<TimeLog, 'start' | 'end'>>): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) for (const s of splitByDay(l)) m.set(s.day, (m.get(s.day) ?? 0) + s.minutes);
  return m;
}

export type NodeKind = 'root' | 'group' | 'av' | 'ai' | 'project' | 'folder' | 'note';

export interface TimeNode {
  readonly name: string;
  readonly path: string; // ruta acumulada ('' raíz)
  readonly kind: NodeKind;
  minutes: number;
  /** Minutos registrados directamente en esta nota (no en hijas). */
  ownMinutes: number;
  records: number;
  readonly children: TimeNode[];
  readonly logs: TimeLog[];
}

/** Clasificación de un segmento de ruta por prefijo (colores por tipo de v1). */
export function kindOfSegment(seg: string, isFile: boolean): NodeKind {
  if (isFile) return 'note';
  if (/^\d{2} - /.test(seg)) return 'group';
  if (seg.startsWith('AV - ')) return 'av';
  if (seg.startsWith('AI - ')) return 'ai';
  if (/^(PGTD|PQ|RR)( |\d)/.test(seg)) return 'project';
  return 'folder';
}

/** Árbol por segmentos de ruta con minutos (repartidos por día dentro del rango) y número de registros. */
export function buildTimeTree(logs: Iterable<TimeLog>, range: DayRange | null): TimeNode {
  const root: TimeNode = { name: 'Todas las áreas', path: '', kind: 'root', minutes: 0, ownMinutes: 0, records: 0, children: [], logs: [] };
  const childIndex = new Map<TimeNode, Map<string, TimeNode>>();
  const child = (parent: TimeNode, seg: string, path: string, isFile: boolean): TimeNode => {
    let idx = childIndex.get(parent);
    if (!idx) childIndex.set(parent, (idx = new Map()));
    let n = idx.get(seg);
    if (!n) {
      n = { name: seg.replace(/\.md$/i, ''), path, kind: kindOfSegment(seg, isFile), minutes: 0, ownMinutes: 0, records: 0, children: [], logs: [] };
      idx.set(seg, n);
      parent.children.push(n);
    }
    return n;
  };
  for (const log of logs) {
    if (!log.path || log.bad) continue;
    const minutes = minutesInRange(log, range);
    if (minutes <= 0) continue;
    const segs = log.path.split('/');
    let node = root;
    root.minutes += minutes;
    root.records++;
    let acc = '';
    segs.forEach((seg, i) => {
      acc = acc ? `${acc}/${seg}` : seg;
      node = child(node, seg, acc, i === segs.length - 1);
      node.minutes += minutes;
      node.records++;
    });
    node.ownMinutes += minutes;
    node.logs.push(log);
  }
  const sortRec = (n: TimeNode): void => {
    n.children.sort((a, b) => (a.kind === 'note' ? 1 : 0) - (b.kind === 'note' ? 1 : 0) || a.name.localeCompare(b.name, 'es'));
    n.logs.sort((a, b) => a.start - b.start);
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

/** Nodo de tránsito: sin tiempo propio y con un solo hijo (se atenúa y se salta al expandir). */
export function isTransitNode(n: TimeNode): boolean {
  return n.ownMinutes === 0 && n.children.length === 1;
}

/** "Salto inteligente": baja por la cadena hasta una bifurcación o un nodo con registros propios. */
export function smartExpandChain(n: TimeNode): TimeNode[] {
  const chain: TimeNode[] = [];
  let cur: TimeNode | undefined = n;
  while (cur && isTransitNode(cur)) {
    cur = cur.children[0];
    if (cur) chain.push(cur);
  }
  return chain;
}

/** Todos los registros bajo un nodo (para exportar). */
export function collectLogs(n: TimeNode): TimeLog[] {
  const out: TimeLog[] = [...n.logs];
  for (const c of n.children) out.push(...collectLogs(c));
  return out.sort((a, b) => a.start - b.start);
}

export type PeriodKind = 'today' | 'week' | 'month' | 'year' | 'all' | 'day' | 'custom';

/** Rango de días para un periodo relativo a `anchor` (semana ISO lunes-domingo). */
export function periodRange(kind: PeriodKind, anchor: string, custom?: DayRange): DayRange | null {
  const [y, m] = [Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7))];
  switch (kind) {
    case 'today':
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const dow = (new Date(Date.UTC(y, m - 1, Number(anchor.slice(8, 10)))).getUTCDay() + 6) % 7;
      const from = addDays(anchor, -dow);
      return { from, to: addDays(from, 6) };
    }
    case 'month': {
      const from = `${anchor.slice(0, 7)}-01`;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { from, to: `${anchor.slice(0, 7)}-${String(last).padStart(2, '0')}` };
    }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom':
      return custom ?? null;
    case 'all':
      return null;
  }
}

/** Desplaza el ancla un periodo (navegación ‹ ›). */
export function shiftAnchor(kind: PeriodKind, anchor: string, dir: 1 | -1): string {
  switch (kind) {
    case 'today':
    case 'day':
      return addDays(anchor, dir);
    case 'week':
      return addDays(anchor, 7 * dir);
    case 'month': {
      const y = Number(anchor.slice(0, 4));
      const m = Number(anchor.slice(5, 7)) + dir;
      const yy = m < 1 ? y - 1 : m > 12 ? y + 1 : y;
      const mm = ((m + 11) % 12) + 1;
      return `${yy}-${String(mm).padStart(2, '0')}-01`;
    }
    case 'year':
      return `${Number(anchor.slice(0, 4)) + dir}-01-01`;
    default:
      return anchor;
  }
}

/** Estadísticas de Pomodoro recalculadas desde los registros (sustituye `pomodoroStats`). */
export function pomodoroStats(logs: Iterable<TimeLog>, today: string): {
  totalSessions: number; totalMinutes: number; todaySessions: number; todayMinutes: number;
} {
  let totalSessions = 0;
  let totalMinutes = 0;
  let todaySessions = 0;
  let todayMinutes = 0;
  for (const l of logs) {
    if (l.kind !== 'pomodoro' || l.bad) continue;
    const mins = Math.floor((l.end - l.start) / 60000);
    totalSessions++;
    totalMinutes += mins;
    const t = minutesInRange(l, { from: today, to: today });
    if (t > 0) {
      todaySessions++;
      todayMinutes += Math.floor(t);
    }
  }
  return { totalSessions, totalMinutes, todaySessions, todayMinutes };
}
