/**
 * Clasificación en listas GTD (equivalente a `gtdProcessor.processGtdLists` de v1).
 * Conserva las reglas del CÓDIGO v1 (no las de DOC-REGLAS cuando difieren) con las
 * correcciones de `02-decisiones-de-diseno.md` §4. `today` se recibe como parámetro.
 */
import { compareYmd, isValidYmd, parseWeekCode, isoWeekOf, compareWeeks } from '../dates';
import type { DateSymbol, Task } from '../tasks/model';
import { GTD_TAG_INBOX, GTD_TAG_NOT_THIS_WEEK, GTD_TAG_SOMEDAY, PROJECT_CONTEXTS, isOpen } from '../tasks/model';

export type DisplayStatus = 'overdue' | 'today' | 'paused-start' | 'paused-dep' | null;
export type OverdueMode = 'date-first' | 'context-first';

export const NO_CONTEXT = 'Sin Contexto';
export const AGENDA_TODAY = '📅 Agenda de Hoy';

export type ListId =
  | 'hopeToday' | 'overdue' | 'inbox' | 'calendar' | 'projects'
  | 'nextActions' | 'assigned' | 'paused' | 'thisWeekNot' | 'someday';

export const LIST_META: Readonly<Record<ListId, { readonly name: string; readonly icon: string }>> = {
  hopeToday: { name: 'Ojalá Hoy', icon: '🌟' },
  overdue: { name: 'Vencidas', icon: '⚠️' },
  inbox: { name: 'Bandeja de Entrada', icon: '📥' },
  calendar: { name: 'Calendario', icon: '📅' },
  projects: { name: 'Proyectos', icon: '💼' },
  nextActions: { name: 'Próximas Acciones', icon: '➡️' },
  assigned: { name: 'Asignadas o Delegadas', icon: '👥' },
  paused: { name: 'En Pausa', icon: '⏸️' },
  thisWeekNot: { name: 'Esta Semana No', icon: '⛔' },
  someday: { name: 'Algún Día / Tal Vez', icon: '🕰️' },
};

/** Orden de navegación v1 (Ojalá Hoy primero solo si tiene tareas). */
export const LIST_ORDER: readonly ListId[] = [
  'hopeToday', 'overdue', 'inbox', 'calendar', 'projects', 'nextActions', 'assigned', 'paused', 'thisWeekNot', 'someday',
];

export interface GtdLists {
  readonly inbox: Task[];
  readonly calendar: Task[];
  readonly projects: Task[];
  readonly someday: Task[];
  readonly thisWeekNot: Task[];
  readonly paused: Task[];
  /** Claves `cx-<ctx>` (y `cx-Sin Contexto`). */
  readonly nextActions: Map<string, Task[]>;
  /** Claves `📅 Agenda de Hoy`, `cx-<ctx>`, `px-<persona>`, `cx-Sin Contexto`. */
  readonly hopeToday: Map<string, Task[]>;
  /** Claves `px-<persona>`. */
  readonly assigned: Map<string, Task[]>;
  /** date-first: `📅 <fecha>|cx-<ctx>`; context-first: `📋 cx-<ctx>|<fecha>` / `👤 px-<p>|<fecha>`. */
  readonly overdue: Map<string, Task[]>;
}

export interface Classification {
  readonly lists: GtdLists;
  readonly displayStatus: ReadonlyMap<string, DisplayStatus>;
  /** Tareas abiertas (únicas). */
  readonly openTasks: readonly Task[];
  /** Ids de dependencia que no existen en el vault, por tarea. */
  readonly missingDependencies: ReadonlyMap<string, readonly string[]>;
  /** Tareas en un ciclo de dependencias (van a Bandeja de Entrada). */
  readonly dependencyCycles: ReadonlySet<string>;
  readonly contexts: readonly string[];
  readonly people: readonly string[];
}

export interface ClassifyOptions {
  readonly today: string; // YYYY-MM-DD local
  readonly overdueMode?: OverdueMode;
  /** Todas las tareas con id explícito (incluidas cerradas) para resolver dependencias. */
  readonly taskById?: ReadonlyMap<string, Task>;
}

function push<K>(map: Map<K, Task[]>, key: K, t: Task): void {
  const arr = map.get(key);
  if (arr) {
    if (!arr.includes(t)) arr.push(t);
  } else map.set(key, [t]);
}

function cmpDate(a: string, today: string): number {
  return compareYmd(a, today);
}

const validDates = (t: Task, symbols?: readonly DateSymbol[]): string[] =>
  t.dates.filter((d) => isValidYmd(d.date) && (!symbols || symbols.includes(d.symbol))).map((d) => d.date);

export function buildTaskById(tasks: Iterable<Task>): Map<string, Task> {
  const map = new Map<string, Task>();
  for (const t of tasks) if (t.id && !map.has(t.id)) map.set(t.id, t);
  return map;
}

function isResolved(t: Task | undefined): boolean {
  return t === undefined || t.status === 'done' || t.status === 'cancelled';
}

/** Tareas abiertas que forman parte de un ciclo de dependencias (incluida la autodependencia). */
export function findDependencyCycles(open: readonly Task[], byId: ReadonlyMap<string, Task>): Set<string> {
  const inCycle = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>(); // 1 = visitando, 2 = terminado
  const stack: Task[] = [];
  const visit = (t: Task): void => {
    state.set(t.key, 1);
    stack.push(t);
    for (const depId of t.dependencies) {
      const dep = byId.get(depId);
      if (!dep || !isOpen(dep)) continue;
      const st = state.get(dep.key) ?? 0;
      if (st === 0) visit(dep);
      else if (st === 1) {
        const idx = stack.indexOf(dep);
        for (const c of stack.slice(idx)) inCycle.add(c.key);
      }
    }
    stack.pop();
    state.set(t.key, 2);
  };
  for (const t of open) if ((state.get(t.key) ?? 0) === 0) visit(t);
  return inCycle;
}

export function computeDisplayStatus(t: Task, today: string, pausedByDep: boolean, weekFuture: boolean): DisplayStatus {
  if (t.invalidDateOrder) return null;
  const dueOrSched = validDates(t, ['⏳', '📅']);
  if (pausedByDep) {
    return dueOrSched.some((d) => cmpDate(d, today) < 0) ? 'overdue' : 'paused-dep';
  }
  if (weekFuture) return 'paused-start';
  const all = validDates(t);
  if (all.length === 0) return null;
  if (dueOrSched.some((d) => cmpDate(d, today) < 0)) return 'overdue';
  if (all.some((d) => cmpDate(d, today) === 0)) return 'today';
  if (validDates(t, ['🛫']).some((d) => cmpDate(d, today) > 0)) return 'paused-start';
  return null;
}

/** Fecha bajo la que se agrupa una vencida: 📅 vencida más reciente; si no, ⏳ vencida más reciente (B-G2). */
export function overdueGroupDate(t: Task, today: string): string {
  const pick = (sym: DateSymbol): string | undefined =>
    validDates(t, [sym]).filter((d) => cmpDate(d, today) < 0).sort(compareYmd).at(-1);
  return pick('📅') ?? pick('⏳') ?? t.date ?? '';
}

function weekRelation(week: string | undefined, today: string): -1 | 0 | 1 | null {
  if (!week) return null;
  const w = parseWeekCode(week);
  if (!w) return null;
  const c = compareWeeks(w, isoWeekOf(today));
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}

/** Minutos para ordenar por hora (B-G1: nunca por texto). Sin hora → al final. */
function minutesOf(t: Task): number {
  return t.startMinutes ?? 24 * 60;
}

export function sortCalendar(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => compareYmd(a.date ?? '9999-99-99', b.date ?? '9999-99-99') || minutesOf(a) - minutesOf(b));
}

/** Ojalá Hoy (mejora documentada): 📅 antes que ⏳, luego prioridad. */
function sortHopeToday(tasks: Task[]): Task[] {
  const symRank = (t: Task): number => (t.dateSymbol === '📅' ? 0 : t.dateSymbol === '⏳' ? 1 : 2);
  return tasks.sort((a, b) => symRank(a) - symRank(b) || a.priority.rank - b.priority.rank);
}

export function classifyTasks(all: readonly Task[], opts: ClassifyOptions): Classification {
  const today = opts.today;
  const mode: OverdueMode = opts.overdueMode ?? 'date-first';
  const byId = opts.taskById ?? buildTaskById(all);
  const lists: GtdLists = {
    inbox: [], calendar: [], projects: [], someday: [], thisWeekNot: [], paused: [],
    nextActions: new Map(), hopeToday: new Map(), assigned: new Map(), overdue: new Map(),
  };
  const displayStatus = new Map<string, DisplayStatus>();
  const missing = new Map<string, string[]>();
  const open = all.filter(isOpen);
  const cycles = findDependencyCycles(open, byId);
  const contexts = new Set<string>();
  const people = new Set<string>();

  for (const t of open) {
    t.contexts.forEach((c) => contexts.add(c));
    t.people.forEach((p) => people.add(p));

    const miss = t.dependencies.filter((d) => !byId.has(d));
    if (miss.length) missing.set(t.key, miss);
    const pausedByDep = t.dependencies.some((d) => {
      const dep = byId.get(d);
      return dep !== undefined && dep !== t && !isResolved(dep);
    });
    const wk = weekRelation(t.week, today);
    const weekFuture = wk === 1;
    const ds = computeDisplayStatus(t, today, pausedByDep, weekFuture);
    displayStatus.set(t.key, ds);

    // Listas exclusivas.
    if (t.gtdTags.includes(GTD_TAG_SOMEDAY)) { lists.someday.push(t); continue; }
    if (t.gtdTags.includes(GTD_TAG_NOT_THIS_WEEK)) { lists.thisWeekNot.push(t); continue; }

    const hasCtx = t.contexts.length > 0;
    const hasPx = t.people.length > 0;
    let placed = false;
    const toInbox = (): void => {
      if (!lists.inbox.includes(t)) lists.inbox.push(t);
      placed = true;
    };

    if (t.hasConflict || t.gtdTags.includes(GTD_TAG_INBOX)) toInbox();
    if (t.invalidDateOrder || cycles.has(t.key)) { toInbox(); continue; }
    if (t.date && isValidYmd(t.date) && !hasCtx && !hasPx && cmpDate(t.date, today) <= 0) toInbox();
    if (wk !== null && wk <= 0 && !hasCtx && !hasPx) toInbox();

    if (pausedByDep || weekFuture || ds === 'paused-start') {
      lists.paused.push(t);
      placed = true;
      if (!pausedByDep) continue; // 🛫 futuro / semana futura: solo En Pausa (y quizá Inbox)
    }

    const principalToday = t.date !== undefined && isValidYmd(t.date) && cmpDate(t.date, today) === 0;
    if (t.dateSymbol === '📅' && t.startTime !== undefined) { lists.calendar.push(t); placed = true; }
    if (ds === 'overdue') {
      const date = overdueGroupDate(t, today);
      const keys: string[] = [];
      if (mode === 'date-first') {
        if (hasCtx) t.contexts.forEach((c) => keys.push(`📅 ${date}|cx-${c}`));
        else if (hasPx) t.people.forEach((p) => keys.push(`📅 ${date}|px-${p}`));
        else keys.push(`📅 ${date}|cx-${NO_CONTEXT}`);
      } else {
        if (hasCtx) t.contexts.forEach((c) => keys.push(`📋 cx-${c}|${date}`));
        else if (hasPx) t.people.forEach((p) => keys.push(`👤 px-${p}|${date}`));
        else keys.push(`📋 cx-${NO_CONTEXT}|${date}`);
      }
      keys.forEach((k) => push(lists.overdue, k, t));
      placed = true;
    }

    const isCalendarToday = t.dateSymbol === '📅' && t.startTime !== undefined && principalToday;
    const dsToday = (sym: readonly DateSymbol[]): boolean => validDates(t, sym).some((d) => cmpDate(d, today) === 0);
    const hopeCandidate = t.startTime === undefined && dsToday(['⏳', '📅']);
    const depToday = pausedByDep && ds === 'paused-dep' && (principalToday || dsToday(['⏳', '📅']));
    if (isCalendarToday) {
      push(lists.hopeToday, AGENDA_TODAY, t);
      placed = true;
    } else if (hopeCandidate || depToday) {
      if (hasCtx) t.contexts.forEach((c) => push(lists.hopeToday, `cx-${c}`, t));
      if (hasPx) t.people.forEach((p) => push(lists.hopeToday, `px-${p}`, t));
      if (!hasCtx && !hasPx) push(lists.hopeToday, `cx-${NO_CONTEXT}`, t);
      placed = true;
    }

    if (hasPx) { t.people.forEach((p) => push(lists.assigned, `px-${p}`, t)); placed = true; }
    if (hasCtx) {
      t.contexts.forEach((c) => push(lists.nextActions, `cx-${c}`, t));
      placed = true;
    } else if (t.dateSymbol === '🛫' && t.date && isValidYmd(t.date) && cmpDate(t.date, today) <= 0 && !hasPx) {
      push(lists.nextActions, `cx-${NO_CONTEXT}`, t);
      placed = true;
    }
    if (t.contexts.some((c) => PROJECT_CONTEXTS.includes(c))) { lists.projects.push(t); placed = true; }

    if (!placed) lists.inbox.push(t);
  }

  sortCalendar(lists.calendar);
  const agenda = lists.hopeToday.get(AGENDA_TODAY);
  if (agenda) agenda.sort((a, b) => minutesOf(a) - minutesOf(b));
  for (const [k, v] of lists.hopeToday) if (k !== AGENDA_TODAY) sortHopeToday(v);

  const locale = (a: string, b: string): number => a.localeCompare(b, 'es');
  return {
    lists,
    displayStatus,
    openTasks: open,
    missingDependencies: missing,
    dependencyCycles: cycles,
    contexts: [...contexts].sort(locale),
    people: [...people].sort(locale),
  };
}

/** Tamaño de una lista: entradas (como v1, una tarea con 2 contextos cuenta 2) y tareas únicas. */
export function listSize(lists: GtdLists, id: ListId): { entries: number; unique: number } {
  const v = lists[id];
  if (Array.isArray(v)) return { entries: v.length, unique: v.length };
  const set = new Set<Task>();
  let entries = 0;
  for (const arr of (v as Map<string, Task[]>).values()) {
    entries += arr.length;
    arr.forEach((t) => set.add(t));
  }
  return { entries, unique: set.size };
}

/** Clave de sublista sin prefijo para mostrar (`cx-Casa` → `Casa`). */
export function sublistLabel(key: string): string {
  return key.replace(/^(#?cx-|#?px-)/, '');
}

export function sublistIcon(key: string): string {
  return /^(#?px-|@|px:)/.test(key) ? '👤' : '📋';
}

/** Id de ancla estable y legible (`Próximas Acciones` → `proximas-acciones`). */
export function anchorId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';
}

export interface NavItem {
  readonly id: ListId;
  readonly label: string;
  readonly icon: string;
  readonly count: number;
  readonly anchor: string;
  readonly sublists: ReadonlyArray<{ readonly key: string; readonly label: string; readonly icon: string; readonly count: number; readonly anchor: string }>;
}

export function navigationItems(lists: GtdLists): NavItem[] {
  const out: NavItem[] = [];
  for (const id of LIST_ORDER) {
    const { entries } = listSize(lists, id);
    if (entries === 0) continue;
    const meta = LIST_META[id];
    const v = lists[id];
    const sublists = Array.isArray(v) || id === 'overdue'
      ? []
      : [...(v as Map<string, Task[]>).entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([key, arr]) => ({
          key,
          label: sublistLabel(key),
          icon: sublistIcon(key),
          count: arr.length,
          anchor: `gtd-sub-${anchorId(id)}-${anchorId(key)}`,
        }));
    out.push({ id, label: meta.name, icon: meta.icon, count: entries, anchor: `gtd-list-${anchorId(meta.name)}`, sublists });
  }
  return out;
}
