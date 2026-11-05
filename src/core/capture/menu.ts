/**
 * Modelo del menú unificado del Smart Inbox (puro): detección del disparador activo (`@`, `#`, `!`),
 * niveles del menú en cascada, filtrado incremental con relevancia y aplicación de la selección.
 *
 * El estado del menú se DERIVA del texto y del cursor (no hay máquina de estados oculta como en v1),
 * así que escribir, borrar o pegar siempre deja el menú coherente:
 * - `#` → menú principal (cx-, px-, gtd-); `#cx-` → contextos; `#px-` → personas; `#gtd-` → estados GTD.
 * - `@` → proyectos/áreas; la consulta puede tener espacios mientras algún nombre coincida.
 * - `!` → calendario (la consulta es una fecha legacy opcional).
 * - Un espacio tras un token completo cierra el menú; sin coincidencias, Enter envía la captura.
 */
import { matchLabel, type MatchRange } from './match';
import { isDatePrefixWord } from './dates';
import { GTD_STATES, isTriggerBoundary } from './tokenize';

export type TriggerKind = '@' | '#' | '!';

export interface ActiveTrigger {
  readonly kind: TriggerKind;
  /** Índice del carácter disparador. */
  readonly start: number;
  /** Posición del cursor (fin de la consulta). */
  readonly end: number;
  /** Texto entre el disparador y el cursor. */
  readonly query: string;
}

export interface MenuProject {
  readonly name: string;
  readonly path: string;
  readonly type: string;
  readonly folder: string;
  readonly isActiveNote: boolean;
}

export interface CountedValue {
  readonly value: string;
  readonly count: number;
}

export interface MenuData {
  readonly projects: readonly MenuProject[];
  readonly contexts: readonly CountedValue[];
  readonly people: readonly CountedValue[];
}

export type MenuLevel = 'project' | 'main' | 'context' | 'person' | 'gtd';

export interface MenuOption {
  readonly id: string;
  /** Prefijo atenuado (`#cx-`, `@`). */
  readonly prefix: string;
  readonly label: string;
  readonly detail: string;
  readonly badge: string;
  /** Texto que sustituye al token (sin espacio final). */
  readonly insert: string;
  /** true = el menú sigue abierto tras elegir (paso al submenú). */
  readonly keepOpen: boolean;
  readonly ranges: readonly MatchRange[];
}

export interface MenuModel {
  readonly level: MenuLevel;
  readonly title: string;
  readonly options: readonly MenuOption[];
  /** Mensaje cuando no hay opciones. */
  readonly emptyText: string;
}

const MAX_OPTIONS = 60;
const WS = /\s/u;

/** Prefijos de submenú (en minúsculas) y su nivel. */
const SUBMENUS: ReadonlyArray<{ prefix: string; level: MenuLevel; insert: string; label: string; detail: string }> = [
  { prefix: 'cx-', level: 'context', insert: '#cx-', label: 'cx-', detail: 'Contextos' },
  { prefix: 'px-', level: 'person', insert: '#px-', label: 'px-', detail: 'Personas asignadas' },
  { prefix: 'gtd-', level: 'gtd', insert: '#GTD-', label: 'GTD-', detail: 'Estados GTD' },
];

const GTD_DETAIL: Readonly<Record<string, string>> = {
  'GTD-AlgunDia': 'Algún día / quizá',
  'GTD-EstaSemanaNo': 'Esta semana no',
};

/** Prefijo de submenú completo (`cx-`, `px-`, `gtd-`) o null. */
export function submenuPrefix(query: string): string | null {
  const lower = query.toLowerCase();
  return SUBMENUS.find((s) => lower.startsWith(s.prefix))?.prefix ?? null;
}

/**
 * ¿Sigue viva la consulta `@`? Sí mientras algún proyecto coincida (los nombres llevan espacios),
 * salvo que se haya escrito un espacio tras un nombre completo (token cerrado).
 */
export function projectQueryAlive(query: string, projects: readonly MenuProject[]): boolean {
  if (/\s$/u.test(query)) {
    const done = query.trimEnd().toLowerCase();
    if (projects.some((p) => p.name.toLowerCase() === done)) return false;
  }
  return projects.some((p) => matchLabel(p.name, query) !== null);
}

/**
 * Disparador activo en el cursor, o null. Manda el disparador más cercano al cursor:
 * si ese ya no está activo (p. ej. `#cx-casa ` con espacio), no hay menú.
 */
export function findTrigger(text: string, cursor: number, projectAlive: (q: string) => boolean): ActiveTrigger | null {
  for (let i = cursor - 1; i >= 0; i--) {
    const c = text.charAt(i);
    if ((c !== '@' && c !== '#' && c !== '!') || !isTriggerBoundary(text, i)) continue;
    const query = text.slice(i + 1, cursor);
    const hasWs = WS.test(query);
    let active: boolean;
    if (c === '#') active = !hasWs;
    else if (c === '!') {
      const m = /^(\S+)\s+\S*$/u.exec(query);
      active = !hasWs || (m !== null && isDatePrefixWord(m[1] ?? ''));
    } else active = !hasWs || (!/^\s/u.test(query) && projectAlive(query));
    return active ? { kind: c, start: i, end: cursor, query } : null;
  }
  return null;
}

function byScore<T extends { m: { score: number } }>(a: T, b: T): number {
  return a.m.score - b.m.score;
}

function valueOptions(values: readonly CountedValue[], sub: string, insertPrefix: string, prefix: string): MenuOption[] {
  const scored: Array<{ v: CountedValue; m: NonNullable<ReturnType<typeof matchLabel>> }> = [];
  for (const v of values) {
    const m = matchLabel(v.value, sub);
    if (m) scored.push({ v, m });
  }
  scored.sort((a, b) => byScore(a, b) || b.v.count - a.v.count || a.v.value.localeCompare(b.v.value, 'es'));
  return scored.slice(0, MAX_OPTIONS).map(({ v, m }) => ({
    id: `${prefix}${v.value}`,
    prefix,
    label: v.value,
    detail: v.count === 1 ? '1 tarea' : `${v.count} tareas`,
    badge: '',
    insert: `${insertPrefix}${v.value}`,
    keepOpen: false,
    ranges: m.ranges,
  }));
}

/** Construye el menú para un disparador `@` o `#` (el `!` lo atiende el calendario). */
export function buildMenu(trigger: ActiveTrigger, data: MenuData): MenuModel {
  if (trigger.kind === '@') {
    const scored: Array<{ p: MenuProject; m: NonNullable<ReturnType<typeof matchLabel>> }> = [];
    for (const p of data.projects) {
      const m = matchLabel(p.name, trigger.query);
      if (m) scored.push({ p, m });
    }
    // La nota activa SIEMPRE primero (si coincide); luego por relevancia y orden de origen.
    scored.sort((a, b) => Number(b.p.isActiveNote) - Number(a.p.isActiveNote) || byScore(a, b));
    return {
      level: 'project',
      title: '📁 Áreas y proyectos activos',
      options: scored.slice(0, MAX_OPTIONS).map(({ p, m }) => ({
        id: p.path,
        prefix: p.isActiveNote ? '📝 ' : '',
        label: p.name,
        detail: p.isActiveNote ? `Nota actual · ${p.folder || '/'}` : p.folder || '/',
        badge: p.type,
        insert: `@${p.name}`,
        keepOpen: false,
        ranges: m.ranges,
      })),
      emptyText: data.projects.length
        ? 'Sin coincidencias · Enter guarda la tarea'
        : 'No hay proyectos ni áreas activos (🟢)',
    };
  }

  const q = trigger.query;
  const lower = q.toLowerCase();
  const sub = SUBMENUS.find((s) => lower.startsWith(s.prefix));
  if (!sub) {
    const options: MenuOption[] = [];
    for (const s of SUBMENUS) {
      if (!s.prefix.startsWith(lower)) continue;
      const m = matchLabel(s.label, q);
      options.push({ id: s.prefix, prefix: '#', label: s.label, detail: s.detail, badge: '', insert: s.insert, keepOpen: true, ranges: m?.ranges ?? [] });
    }
    return {
      level: 'main',
      title: '🏷️ Etiquetas',
      options,
      emptyText: `Etiqueta libre «#${q}» · espacio para seguir, Enter guarda la tarea`,
    };
  }
  const rest = q.slice(sub.prefix.length);
  if (sub.level === 'gtd') {
    const options: MenuOption[] = [];
    for (const g of GTD_STATES) {
      const value = g.slice(4);
      const m = matchLabel(value, rest);
      if (m) options.push({ id: g, prefix: '#GTD-', label: value, detail: GTD_DETAIL[g] ?? '', badge: '', insert: `#${g}`, keepOpen: false, ranges: m.ranges });
    }
    return { level: 'gtd', title: '⏸️ Estado GTD', options, emptyText: 'Estado GTD desconocido · Enter guarda la tarea' };
  }
  const isCtx = sub.level === 'context';
  const values = isCtx ? data.contexts : data.people;
  const options = valueOptions(values, rest, sub.insert, sub.insert);
  const what = isCtx ? 'contextos' : 'personas';
  return {
    level: sub.level,
    title: isCtx ? '📍 Contexto' : '👤 Persona asignada',
    options,
    emptyText: values.length === 0
      ? `Aún no hay ${what} en tus tareas: escribe uno nuevo y pulsa espacio`
      : `Nuevo: «${sub.insert}${rest}» · espacio para seguir, Enter guarda la tarea`,
  };
}

export interface TextEdit {
  readonly text: string;
  readonly cursor: number;
}

/**
 * Sustituye el token del disparador por `insert`. Si `keepOpen` es false añade un espacio
 * (o reutiliza el que ya hubiera) para que el menú se cierre y se pueda seguir escribiendo.
 */
export function applyInsert(text: string, trigger: ActiveTrigger, insert: string, keepOpen: boolean): TextEdit {
  let endTok = trigger.end;
  if (trigger.kind !== '@') while (endTok < text.length && !WS.test(text.charAt(endTok))) endTok++;
  const before = text.slice(0, trigger.start);
  const after = text.slice(endTok);
  if (keepOpen) return { text: before + insert + after, cursor: before.length + insert.length };
  if (/^\s/u.test(after)) return { text: before + insert + after, cursor: before.length + insert.length + 1 };
  return { text: `${before}${insert} ${after}`, cursor: before.length + insert.length + 1 };
}

/** Backspace justo tras `#cx-`/`#px-`/`#gtd-`: borra el prefijo entero y vuelve al menú principal. */
export function collapsePrefixOnBackspace(text: string, cursor: number, trigger: ActiveTrigger | null): TextEdit | null {
  if (!trigger || trigger.kind !== '#' || cursor !== trigger.end) return null;
  if (!SUBMENUS.some((s) => s.prefix === trigger.query.toLowerCase())) return null;
  return { text: text.slice(0, trigger.start + 1) + text.slice(cursor), cursor: trigger.start + 1 };
}
