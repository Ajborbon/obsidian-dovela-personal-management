/**
 * Parser de tareas de Dovela v2. Sustituye a `parser.ts` y `focoParser.ts` de v1
 * con las reglas R1–R12 de `docs/v2/02-decisiones-de-diseno.md` §4.
 */
import { compareYmd, isValidYmd, normalizeWeekCode, parseTimeOfDay } from '../dates';
import { parseDurationMinutes } from '../duration';
import type { DateSymbol, ParsedTask, Priority, Task, TaskDate, TaskStatus } from './model';

/** `- [c] contenido` con indentación libre; solo viñeta `-` (como v1). */
const TASK_LINE_RE = /^(\s*)-\s+\[(.)\]\s+(.*\S.*)$/u;

const STATUS_BY_CHAR: Readonly<Record<string, TaskStatus>> = {
  ' ': 'open',
  '/': 'in-progress',
  x: 'done',
  X: 'done',
  '-': 'cancelled',
};

const VS = '\\uFE0F?';
const DATE_RE = new RegExp(`(🛫|⏳|📅)${VS}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'gu');
const CREATED_RE = new RegExp(`➕${VS}\\s*(\\d{4}-\\d{2}-\\d{2})(?:\\s+(\\d{1,2}:\\d{2}))?`, 'u');
const DONE_RE = new RegExp(`✅${VS}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'u');
const CANCELLED_RE = new RegExp(`❌${VS}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'u');
const RECURRENCE_RE = new RegExp(`🔁${VS}\\s*([^🛫⏳📅➕✅❌🆔⛔🔺⏫🔼🔽⏬#\\[\\^]+)`, 'u');
const ID_RE = new RegExp(`🆔${VS}\\s*([A-Za-z0-9_-]+)`, 'u');
const BLOCK_ID_RE = /(?:^|\s)\^([A-Za-z0-9-]+)(?=\s|$)/u;
const DEP_RE = new RegExp(`⛔${VS}\\s*(\\^?[A-Za-z0-9_-]+(?:\\s*,\\s*\\^?[A-Za-z0-9_-]+)*)`, 'gu');
const HI_RE = /\[hI::\s*([^\]]*)\]/u;
const HF_RE = /\[hF::\s*([^\]]*)\]/u;
const DURATION_RE = /\[\s*(\d+(?:[.,]\d+)?\s*(?:horas|hora|hrs|hr|h|mins|min|m)(?:\s*\d+\s*(?:mins|min|m))?)\s*\]/iu;
const WEEK_RE = /\[\s*[wW]\s*::\s*\[\[(?:[^\]|]*\|)?[^\]|]*?(\d{4}-[Ww]\d{1,2})\]\]\s*\]/u;
const CTX_RE = /#cx-([\p{L}\p{N}_-]+)/gu;
const PX_RE = /#px-([\p{L}\p{N}_-]+)/gu;
const GTD_TAG_RE = /#(GTD-AlgunDia|GTD-EstaSemanaNo|inbox)(?![\p{L}\p{N}_/-])/gu;
const OTHER_TAG_RE = /(?:^|\s)#([\p{L}\p{N}_/-]*[\p{L}_][\p{L}\p{N}_/-]*)/gu;
const PRIORITY_RE = new RegExp(`(🔺|⏫|🔼|🔽|⏬)${VS}`, 'u');

const PRIORITY_RANK: Readonly<Record<string, number>> = { '🔺': 0, '⏫': 1, '🔼': 2, '🔽': 3, '⏬': 4 };
export const NO_PRIORITY: Priority = { rank: 5, symbol: '' };

function uniq(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

/** ¿Es una línea de tarea de Dovela (incluidas canceladas)? */
export function isTaskLine(line: string): boolean {
  const m = TASK_LINE_RE.exec(line.replace(/\r$/, ''));
  return m !== null && STATUS_BY_CHAR[m[2] ?? ''] !== undefined;
}

/** Parsea una línea. Devuelve null si no es una tarea reconocida. */
export function parseTaskLine(lineIn: string): ParsedTask | null {
  const raw = lineIn.replace(/\r$/, '');
  const m = TASK_LINE_RE.exec(raw);
  if (!m) return null;
  const statusChar = m[2] ?? '';
  const status = STATUS_BY_CHAR[statusChar];
  if (!status) return null;
  const indent = m[1] ?? '';
  let work = m[3] ?? '';

  const remove = (re: RegExp): RegExpExecArray | null => {
    const found = re.exec(work);
    if (found) work = work.slice(0, found.index) + ' ' + work.slice(found.index + found[0].length);
    return found;
  };

  // 1. Dependencias (antes que ids: `⛔ ^dep` no debe tomarse como id propio). R3/R4.
  const dependencies: string[] = [];
  for (const dm of work.matchAll(DEP_RE)) {
    for (const part of (dm[1] ?? '').split(',')) {
      const id = part.trim().replace(/^\^/, '');
      if (id) dependencies.push(id);
    }
  }
  work = work.replace(DEP_RE, ' ');

  // 2. Ids: 🆔 explícito; si no, id de bloque `^x` precedido de espacio. R2.
  const idMatch = remove(ID_RE);
  const blockMatch = remove(BLOCK_ID_RE);
  const blockId = blockMatch?.[1];
  const id = idMatch?.[1] ?? blockId;

  // 3. Fechas.
  const dates: TaskDate[] = [];
  for (const dm of work.matchAll(DATE_RE)) {
    dates.push({ symbol: dm[1] as DateSymbol, date: dm[2] ?? '' });
  }
  work = work.replace(DATE_RE, ' ');
  const created = remove(CREATED_RE);
  const done = remove(DONE_RE);
  const cancelled = remove(CANCELLED_RE);
  const recurrence = remove(RECURRENCE_RE);

  // 4. Horas, duración y semana.
  const hi = remove(HI_RE);
  const hf = remove(HF_RE);
  const dur = remove(DURATION_RE);
  const wk = remove(WEEK_RE);

  // 5. Contextos, personas y etiquetas GTD (se eliminan del texto).
  const contexts = uniq([...work.matchAll(CTX_RE)].map((x) => x[1] ?? ''));
  work = work.replace(CTX_RE, ' ');
  const people = uniq([...work.matchAll(PX_RE)].map((x) => x[1] ?? ''));
  work = work.replace(PX_RE, ' ');
  const gtdTags = uniq([...work.matchAll(GTD_TAG_RE)].map((x) => x[1] ?? ''));
  work = work.replace(GTD_TAG_RE, ' ');
  const otherTags = uniq([...work.matchAll(OTHER_TAG_RE)].map((x) => x[1] ?? ''));

  // 6. Prioridad: primer símbolo.
  const pr = remove(PRIORITY_RE);
  const prioritySymbol = pr?.[1] ?? '';
  const priority: Priority = prioritySymbol
    ? { rank: PRIORITY_RANK[prioritySymbol] ?? 5, symbol: prioritySymbol }
    : NO_PRIORITY;

  const text = work.replace(/\s+/g, ' ').trim();

  // Conflictos.
  const conflicts: string[] = [];
  const startTime = hi?.[1]?.trim();
  const endTime = hf?.[1]?.trim();
  const startMinutes = parseTimeOfDay(startTime) ?? undefined;
  const endMinutes = parseTimeOfDay(endTime) ?? undefined;
  const duration = dur?.[1]?.trim();
  const durationMinutes = parseDurationMinutes(duration) ?? undefined;
  if (startTime !== undefined && startMinutes === undefined) conflicts.push('hora de inicio inválida');
  if (endTime !== undefined && endMinutes === undefined) conflicts.push('hora de fin inválida');
  if (startMinutes !== undefined && endMinutes !== undefined) {
    if (endMinutes <= startMinutes) conflicts.push('la hora de fin no es posterior a la de inicio');
    else if (durationMinutes !== undefined && endMinutes - startMinutes !== durationMinutes) {
      conflicts.push('la duración no coincide con las horas');
    }
  }
  // v1 solo marcaba conflicto con ambas horas; una sola hora es válida.
  const invalid = dates.filter((d) => !isValidYmd(d.date));
  if (invalid.length > 0) conflicts.push(`fecha inválida: ${invalid.map((d) => d.date).join(', ')}`);

  const first = dates[0];
  const week = wk?.[1] ? normalizeWeekCode(wk[1]) ?? undefined : undefined;
  if (wk?.[1] && !week) conflicts.push(`semana inválida: ${wk[1]}`);

  return {
    status,
    statusChar,
    indent,
    raw,
    text,
    priority,
    ...(first ? { date: first.date, dateSymbol: first.symbol } : {}),
    dates,
    ...(created?.[1] ? { created: created[1] } : {}),
    ...(created?.[2] ? { createdTime: created[2] } : {}),
    ...(done?.[1] ? { done: done[1] } : {}),
    ...(cancelled?.[1] ? { cancelledOn: cancelled[1] } : {}),
    ...(recurrence?.[1] ? { recurrence: recurrence[1].trim() } : {}),
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
    ...(startMinutes !== undefined ? { startMinutes } : {}),
    ...(endMinutes !== undefined ? { endMinutes } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(week ? { week } : {}),
    ...(id ? { id } : {}),
    ...(blockId ? { blockId } : {}),
    dependencies: uniq(dependencies),
    contexts,
    people,
    gtdTags,
    otherTags,
    hasConflict: conflicts.length > 0,
    conflicts,
    invalidDateOrder: hasInvalidDateOrder(dates),
  };
}

/** Start ≤ Scheduled ≤ Due (con fechas válidas). */
export function hasInvalidDateOrder(dates: readonly TaskDate[]): boolean {
  const valid = dates.filter((d) => isValidYmd(d.date));
  const of = (s: DateSymbol): string[] => valid.filter((d) => d.symbol === s).map((d) => d.date);
  const starts = of('🛫');
  const scheds = of('⏳');
  const dues = of('📅');
  const after = (a: string[], b: string[]): boolean => a.some((x) => b.some((y) => compareYmd(x, y) > 0));
  return after(starts, scheds) || after(starts, dues) || after(scheds, dues);
}

/**
 * Tareas de una nota. Ignora frontmatter, bloques de código (``` y ~~~) y
 * comentarios `%% %%` (R11).
 */
export function parseTasksInNote(content: string, path: string): Task[] {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let i = 0;
  if (lines[0]?.replace(/\r$/, '') === '---') {
    for (i = 1; i < lines.length; i++) {
      const l = lines[i]?.replace(/\r$/, '') ?? '';
      if (l === '---' || l === '...') {
        i++;
        break;
      }
    }
    if (i >= lines.length) i = 0; // frontmatter sin cerrar: no es frontmatter
  }
  let fence: string | null = null;
  let inComment = false;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trimStart();
    const fm = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (fm && fm[1] && fm[1][0] === fence[0] && fm[1].length >= fence.length && trimmed.slice(fm[1].length).trim() === '') {
        fence = null;
      }
      continue;
    }
    if (fm && fm[1]) {
      fence = fm[1];
      continue;
    }
    const markers = line.split('%%').length - 1;
    if (inComment) {
      if (markers % 2 === 1) inComment = false;
      continue;
    }
    if (markers > 0) {
      // Comentario que abre (y quizá cierra) en esta línea: si queda abierto, saltar.
      if (markers % 2 === 1) inComment = true;
      if (trimmed.startsWith('%%')) continue;
    }
    if (!line.includes('[')) continue;
    const parsed = parseTaskLine(line);
    if (parsed) tasks.push({ ...parsed, path, line: i, key: `${path}#${i}` });
  }
  return tasks;
}
