/**
 * Ediciones puras sobre líneas de tarea y localización SEGURA de la línea a editar.
 * Sustituye a las tres copias de `createCompletedTaskLine`/`findTaskLine` de v1,
 * sin el fallback "primera tarea abierta del archivo" (defecto B-S1).
 */
import { parseTaskLine } from './parse';

const CHECKBOX_RE = /^(\s*-\s+\[)(.)(\]\s+.*)$/u;
const DONE_MARK_RE = /✅️?\s*\d{4}-\d{2}-\d{2}/u;
const TRAILING_BLOCK_ID_RE = /(\s\^[A-Za-z0-9-]+)\s*$/u;

function setStatusChar(line: string, from: readonly string[], to: string): string | null {
  const raw = line.replace(/\r$/, '');
  const m = CHECKBOX_RE.exec(raw);
  if (!m || !from.includes(m[2] ?? '')) return null;
  return `${m[1]}${to}${m[3]}`;
}

/** `[ ]` → `[/]`. Null si la línea no es una tarea abierta. */
export function markInProgress(line: string): string | null {
  return setStatusChar(line, [' '], '/');
}

/** `[/]` → `[ ]`. Null si no está en progreso. */
export function markOpen(line: string): string | null {
  return setStatusChar(line, ['/'], ' ');
}

/**
 * `[ ]`/`[/]` → `[x]` y añade ` ✅ YYYY-MM-DD` si la línea no tiene ya fecha de cierre.
 * El sello se coloca antes de un id de bloque final (`^abc`) para que Obsidian lo siga reconociendo.
 */
export function markDone(line: string, today: string): string | null {
  const changed = setStatusChar(line, [' ', '/'], 'x');
  if (changed === null) return null;
  if (DONE_MARK_RE.test(changed)) return changed;
  const block = TRAILING_BLOCK_ID_RE.exec(changed);
  if (block) {
    const head = changed.slice(0, block.index).trimEnd();
    return `${head} ✅ ${today}${block[1]}`;
  }
  return `${changed.trimEnd()} ✅ ${today}`;
}

export interface TaskLocator {
  /** Línea esperada (0-based) en el momento en que se leyó la tarea. */
  readonly line?: number;
  /** Línea original esperada (se compara sin `\r` ni espacios finales). */
  readonly raw?: string;
  /** Id explícito de la tarea (`🆔` o `^`). */
  readonly id?: string;
}

export type LocateResult =
  | { readonly ok: true; readonly line: number; readonly how: 'line' | 'id' | 'raw' }
  | { readonly ok: false; readonly reason: 'not-found' | 'ambiguous' };

/**
 * Normaliza para comparar: sin `\r`, sin espacios finales y con el carácter de estado
 * neutralizado (`[ ]`, `[/]`, `[x]` comparan igual), porque entre la lectura y la escritura
 * la propia app pudo poner la tarea en progreso (`[ ]` → `[/]`) o Sync pudo cambiarla.
 */
function norm(s: string): string {
  return s.replace(/\r$/, '').trimEnd().replace(/^(\s*-\s+\[).(\])/u, '$1 $2');
}

/**
 * Localiza la línea de una tarea:
 * 1. la línea esperada si su contenido coincide exactamente;
 * 2. la única línea con ese id explícito;
 * 3. la única línea idéntica al texto esperado.
 * Nunca adivina: 0 o >1 candidatos ⇒ error.
 */
export function locateTaskLine(lines: readonly string[], loc: TaskLocator): LocateResult {
  if (loc.line !== undefined && loc.raw !== undefined) {
    const at = lines[loc.line];
    if (at !== undefined && norm(at) === norm(loc.raw)) return { ok: true, line: loc.line, how: 'line' };
  }
  if (loc.id) {
    const hits: number[] = [];
    lines.forEach((l, i) => {
      const t = parseTaskLine(l);
      if (t?.id === loc.id) hits.push(i);
    });
    if (hits.length === 1 && hits[0] !== undefined) return { ok: true, line: hits[0], how: 'id' };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous' };
  }
  if (loc.raw !== undefined) {
    const target = norm(loc.raw);
    const hits: number[] = [];
    lines.forEach((l, i) => {
      if (norm(l) === target) hits.push(i);
    });
    if (hits.length === 1 && hits[0] !== undefined) return { ok: true, line: hits[0], how: 'raw' };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous' };
  }
  return { ok: false, reason: 'not-found' };
}

export type EditOutcome =
  | { readonly ok: true; readonly content: string; readonly line: number }
  | { readonly ok: false; readonly reason: 'not-found' | 'ambiguous' | 'not-applicable' };

/** Aplica una edición de línea sobre el contenido completo de una nota. */
export function applyTaskEdit(
  content: string,
  loc: TaskLocator,
  edit: (line: string) => string | null,
): EditOutcome {
  const lines = content.split('\n');
  const found = locateTaskLine(lines, loc);
  if (!found.ok) return found;
  const current = lines[found.line] ?? '';
  const hadCR = current.endsWith('\r');
  const next = edit(current);
  if (next === null) return { ok: false, reason: 'not-applicable' };
  lines[found.line] = hadCR ? `${next}\r` : next;
  return { ok: true, content: lines.join('\n'), line: found.line };
}

/** Análisis de una selección de editor para iniciar tiempo sobre una tarea (v1 `TaskSelectionAnalyzer`). */
export type SelectionAnalysis =
  | { readonly kind: 'note' }
  | { readonly kind: 'task'; readonly line: number; readonly raw: string; readonly text: string; readonly status: string; readonly id?: string }
  | { readonly kind: 'error'; readonly message: string };

export function analyzeSelection(selection: string, fromLine: number, toLine: number, lineText: string): SelectionAnalysis {
  if (selection.trim() === '') return { kind: 'note' };
  if (fromLine !== toLine) {
    return { kind: 'error', message: 'Verifica la tarea que has seleccionado: la selección ocupa varias líneas.' };
  }
  const t = parseTaskLine(lineText);
  if (!t) return { kind: 'error', message: 'La selección en la nota no es una tarea.' };
  if (t.status === 'done' || t.status === 'cancelled') {
    return { kind: 'error', message: 'La tarea seleccionada ya está cerrada.' };
  }
  return {
    kind: 'task',
    line: fromLine,
    raw: t.raw,
    text: t.text,
    status: t.status,
    ...(t.id ? { id: t.id } : {}),
  };
}
