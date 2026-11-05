/**
 * Tokenizador de la línea de captura del Smart Inbox (puro). Sustituye a `processInput` de v1
 * corrigiendo los defectos de RI-B §3.6:
 * - `@proyecto` se resuelve contra los nombres conocidos por coincidencia MÁS LARGA y no consume el
 *   resto del texto (`@PGTD - X comprar leche` → proyecto `PGTD - X`, descripción `comprar leche`).
 *   También acepta `@[[Nombre]]`.
 * - Etiquetas `#cx-`/`#px-` con acentos y ñ; `#GTD-AlgunDia`/`#GTD-EstaSemanaNo` normalizadas.
 * - Fechas del calendario (`🛫/⏳/📅 YYYY-MM-DD`) y legacy con `!` (ver `dates.ts`) → 📅 por defecto.
 * - Nunca se pierde texto: lo que no se reconoce se queda en la descripción y se avisa.
 */
import { compareYmd, isValidYmd, type Ymd } from '../dates';
import { GTD_TAG_NOT_THIS_WEEK, GTD_TAG_SOMEDAY, type DateSymbol } from '../tasks/model';
import { isDatePrefixWord, parseLegacyDate } from './dates';

export type DateKind = 'start' | 'scheduled' | 'due';

export const DATE_KINDS: readonly DateKind[] = ['start', 'scheduled', 'due'];

export const DATE_ICON: Readonly<Record<DateKind, DateSymbol>> = { start: '🛫', scheduled: '⏳', due: '📅' };

export const DATE_LABEL: Readonly<Record<DateKind, string>> = { start: 'Inicio', scheduled: 'Programada', due: 'Vence' };

const KIND_BY_ICON: Readonly<Record<string, DateKind>> = { '🛫': 'start', '⏳': 'scheduled', '📅': 'due' };

/** Estados GTD fijos (clave plegada → etiqueta normalizada). */
export const GTD_STATES: readonly string[] = [GTD_TAG_SOMEDAY, GTD_TAG_NOT_THIS_WEEK];

/** Nota a la que puede ir la tarea (`@`). `rank` menor = preferida ante nombres iguales. */
export interface ProjectRef {
  readonly name: string;
  readonly path: string;
  readonly rank: number;
}

export interface CaptureWarning {
  readonly code:
    | 'empty' | 'project-not-found' | 'project-multiple' | 'date-invalid' | 'date-unknown' | 'date-duplicate'
    | 'date-order' | 'tag-incomplete' | 'gtd-unknown';
  readonly message: string;
}

export interface CaptureDates {
  start?: Ymd;
  scheduled?: Ymd;
  due?: Ymd;
}

export interface ParsedCapture {
  /** Texto de la tarea sin los tokens reconocidos (espacios normalizados). */
  readonly description: string;
  readonly project: ProjectRef | null;
  /** Valores sin prefijo (`casa` para `#cx-casa`), en orden de aparición y sin duplicados. */
  readonly contexts: readonly string[];
  readonly people: readonly string[];
  /** `GTD-AlgunDia` / `GTD-EstaSemanaNo`. */
  readonly gtd: readonly string[];
  /** El usuario escribió `#inbox` explícitamente. */
  readonly explicitInbox: boolean;
  readonly dates: Readonly<CaptureDates>;
  readonly warnings: readonly CaptureWarning[];
}

export interface CaptureOptions {
  readonly today: Ymd;
  /** Nombres de nota conocidos para resolver `@`. */
  readonly projects: readonly ProjectRef[];
}

interface Span {
  readonly start: number;
  readonly end: number;
}

const WS = /\s/u;
const NAME_CHAR = /[\p{L}\p{N}_]/u;
const CAL_DATE_RE = /(🛫|⏳|📅)️?[ \t]*(\d{4}-\d{2}-\d{2})/gu;
const TAG_RE = /#([\p{L}\p{N}_/-]+)/uy;
const LINK_RE = /\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/uy;

/** ¿Hay un disparador en `i` (inicio de línea o tras espacio)? */
export function isTriggerBoundary(text: string, i: number): boolean {
  return i === 0 || WS.test(text.charAt(i - 1));
}

function overlaps(spans: readonly Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

function removeSpans(text: string, spans: readonly Span[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const s of sorted) {
    if (s.start < pos) continue;
    out += text.slice(pos, s.start) + ' ';
    pos = s.end;
  }
  out += text.slice(pos);
  return out.replace(/\s+/gu, ' ').trim();
}

/** Proyecto cuyo nombre empieza en `pos` (coincidencia más larga, sin distinguir mayúsculas). */
export function longestProjectAt(text: string, pos: number, projects: readonly ProjectRef[]): ProjectRef | null {
  const lowerRest = text.slice(pos).toLowerCase();
  let best: ProjectRef | null = null;
  for (const p of projects) {
    const n = p.name.toLowerCase();
    if (!n || !lowerRest.startsWith(n)) continue;
    const after = text.charAt(pos + p.name.length);
    if (after && NAME_CHAR.test(after)) continue; // `@PGTD - Xy` no es `PGTD - X`
    if (!best || p.name.length > best.name.length || (p.name.length === best.name.length && p.rank < best.rank)) best = p;
  }
  return best;
}

function findByName(name: string, projects: readonly ProjectRef[]): ProjectRef | null {
  const n = name.trim().toLowerCase();
  let best: ProjectRef | null = null;
  for (const p of projects) if (p.name.toLowerCase() === n && (!best || p.rank < best.rank)) best = p;
  return best;
}

function firstWord(text: string, from: number): string {
  const m = /^\S*/u.exec(text.slice(from));
  return m ? m[0] : '';
}

/** Analiza la línea de captura. */
export function parseCapture(input: string, opts: CaptureOptions): ParsedCapture {
  const text = input;
  const spans: Span[] = [];
  const warnings: CaptureWarning[] = [];
  const dates: CaptureDates = {};
  const seenKinds = new Set<DateKind>();
  const setDate = (kind: DateKind, d: Ymd): void => {
    if (seenKinds.has(kind)) {
      warnings.push({ code: 'date-duplicate', message: `Hay varias fechas de tipo ${DATE_ICON[kind]}; se usa la última (${d}).` });
    }
    seenKinds.add(kind);
    dates[kind] = d;
  };

  // 1. Fechas insertadas por el calendario (en cualquier posición).
  for (const m of text.matchAll(CAL_DATE_RE)) {
    const kind = KIND_BY_ICON[m[1] ?? ''];
    const d = m[2] ?? '';
    const start = m.index;
    if (!kind) continue;
    if (!isValidYmd(d)) {
      warnings.push({ code: 'date-invalid', message: `Fecha inválida «${m[0]}»: se deja en el texto.` });
      continue;
    }
    spans.push({ start, end: start + m[0].length });
    setDate(kind, d);
  }

  // 2. Proyecto `@`.
  let project: ProjectRef | null = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '@' || !isTriggerBoundary(text, i) || overlaps(spans, i, i + 1)) continue;
    let found: ProjectRef | null = null;
    let end = i + 1;
    LINK_RE.lastIndex = i + 1;
    const link = LINK_RE.exec(text);
    if (link) {
      found = findByName(link[1] ?? '', opts.projects);
      end = i + 1 + link[0].length;
      if (!found) {
        warnings.push({ code: 'project-not-found', message: `No encuentro la nota «${(link[1] ?? '').trim()}»: la tarea irá a la Bandeja de entrada.` });
        continue;
      }
    } else {
      found = longestProjectAt(text, i + 1, opts.projects);
      if (found) end = i + 1 + found.name.length;
      else {
        const w = firstWord(text, i + 1);
        if (w) warnings.push({ code: 'project-not-found', message: `No encuentro el proyecto «@${w}…»: se deja en el texto y la tarea irá a la Bandeja de entrada.` });
        continue;
      }
    }
    if (overlaps(spans, i, end)) continue;
    if (project) {
      warnings.push({ code: 'project-multiple', message: `Hay varios proyectos; se usa «${project.name}» y «@${found.name}» queda en el texto.` });
      continue;
    }
    project = found;
    spans.push({ start: i, end });
  }

  // 3. Etiquetas.
  const contexts: string[] = [];
  const people: string[] = [];
  const gtd: string[] = [];
  let explicitInbox = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '#' || !isTriggerBoundary(text, i) || overlaps(spans, i, i + 1)) continue;
    TAG_RE.lastIndex = i;
    const m = TAG_RE.exec(text);
    if (!m) continue;
    const body = m[1] ?? '';
    const lower = body.toLowerCase();
    const span: Span = { start: i, end: i + m[0].length };
    const prefix = lower.slice(0, 3);
    if (prefix === 'cx-' || prefix === 'px-') {
      const value = body.slice(3);
      if (!value) {
        warnings.push({ code: 'tag-incomplete', message: `Etiqueta incompleta «#${body}»: se ignora.` });
        spans.push(span);
        continue;
      }
      if (value.includes('/')) {
        warnings.push({ code: 'tag-incomplete', message: `«#${body}» tiene «/»: no es un contexto/persona válido y se deja como etiqueta libre.` });
        continue;
      }
      (prefix === 'cx-' ? contexts : people).push(value);
      spans.push(span);
    } else if (lower.startsWith('gtd-')) {
      const state = GTD_STATES.find((s) => s.toLowerCase() === lower);
      if (state) {
        gtd.push(state);
        spans.push(span);
      } else if (lower === 'gtd-') {
        warnings.push({ code: 'tag-incomplete', message: 'Etiqueta incompleta «#GTD-»: se ignora.' });
        spans.push(span);
      } else {
        warnings.push({ code: 'gtd-unknown', message: `Estado GTD desconocido «#${body}»: se deja como etiqueta libre.` });
      }
    } else if (lower === 'inbox') {
      explicitInbox = true;
      spans.push(span);
    }
    // Otras etiquetas: se quedan en la descripción tal cual.
  }

  // 4. Fechas legacy `!texto` (→ 📅).
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '!' || !isTriggerBoundary(text, i) || overlaps(spans, i, i + 1)) continue;
    const w1 = firstWord(text, i + 1);
    if (!w1) continue;
    let end = i + 1 + w1.length;
    let parsed: Ymd | null = null;
    if (isDatePrefixWord(w1)) {
      const m = /^\s+(\S+)/u.exec(text.slice(end));
      if (m) {
        const two = parseLegacyDate(`${w1} ${m[1] ?? ''}`, opts.today);
        if (two) {
          parsed = two;
          end += m[0].length;
        }
      }
    }
    parsed ??= parseLegacyDate(w1, opts.today);
    if (!parsed) {
      warnings.push({ code: 'date-unknown', message: `No reconozco la fecha «!${w1}»: se deja en el texto.` });
      continue;
    }
    spans.push({ start: i, end });
    setDate('due', parsed);
  }

  const description = removeSpans(text, spans);
  if (!description) warnings.push({ code: 'empty', message: 'La descripción de la tarea está vacía.' });
  warnings.push(...dateOrderWarnings(dates));

  return {
    description,
    project,
    contexts: [...new Set(contexts)],
    people: [...new Set(people)],
    gtd: [...new Set(gtd)],
    explicitInbox,
    dates,
    warnings,
  };
}

/** Coherencia Start ≤ Schedule ≤ Due (aviso, no bloquea; el clasificador manda las incoherentes al Inbox). */
export function dateOrderWarnings(d: Readonly<CaptureDates>): CaptureWarning[] {
  const out: CaptureWarning[] = [];
  const check = (a: DateKind, b: DateKind): void => {
    const x = d[a];
    const y = d[b];
    if (x && y && compareYmd(x, y) > 0) {
      out.push({
        code: 'date-order',
        message: `${DATE_ICON[a]} ${DATE_LABEL[a]} (${x}) es posterior a ${DATE_ICON[b]} ${DATE_LABEL[b]} (${y}): la tarea aparecerá en la Bandeja de entrada hasta corregirlo.`,
      });
    }
  };
  check('start', 'scheduled');
  check('start', 'due');
  check('scheduled', 'due');
  return out;
}

export interface CreatedStamp {
  readonly date: Ymd;
  /** `HH:mm` si `settings.general.createdStampWithTime`. */
  readonly time?: string;
}

/** Etiquetas finales en orden: contextos, personas, estados GTD; `#inbox` si no hay ninguna (o si se escribió). */
export function captureTags(p: Pick<ParsedCapture, 'contexts' | 'people' | 'gtd' | 'explicitInbox'>): string[] {
  const tags = [...p.contexts.map((c) => `#cx-${c}`), ...p.people.map((x) => `#px-${x}`), ...p.gtd.map((g) => `#${g}`)];
  if (tags.length === 0 || p.explicitInbox) tags.push('#inbox');
  return tags;
}

/** Genera la línea final: `- [ ] desc tags ➕ fecha[ hora] [🛫 d] [⏳ d] [📅 d]`. */
export function buildTaskLine(p: ParsedCapture, created: CreatedStamp): string {
  const parts = [`- [ ] ${p.description}`, ...captureTags(p), `➕ ${created.date}${created.time ? ` ${created.time}` : ''}`];
  for (const k of DATE_KINDS) {
    const d = p.dates[k];
    if (d) parts.push(`${DATE_ICON[k]} ${d}`);
  }
  return parts.join(' ');
}
