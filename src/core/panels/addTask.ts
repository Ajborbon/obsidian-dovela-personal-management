/**
 * «+ Añadir tarea» del panel de revisión: inserta una tarea vacía `- [ ] ` al final de la sección
 * de tareas (por defecto `## Tareas`), creando la sección al final de la nota si no existe.
 * Puro: recibe el contenido y devuelve el nuevo contenido y la posición del cursor.
 */

export const EMPTY_TASK = '- [ ] ';

export interface AppendTaskResult {
  readonly content: string;
  /** Línea (0-based) de la tarea insertada. */
  readonly line: number;
  /** Columna donde dejar el cursor (tras `- [ ] `). */
  readonly ch: number;
  /** true si hubo que crear la sección. */
  readonly createdHeading: boolean;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;
const FENCE_RE = /^[ \t]{0,3}(```|~~~)/;

function parseHeading(line: string): { level: number; text: string } | null {
  const m = HEADING_RE.exec(line);
  if (!m) return null;
  return { level: (m[1] ?? '').length, text: (m[2] ?? '').trim() };
}

/** Índice de la primera línea del cuerpo (tras el frontmatter YAML, si lo hay). */
function bodyStart(lines: readonly string[]): number {
  if (lines[0]?.trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]?.trim();
    if (l === '---' || l === '...') return i + 1;
  }
  return 0;
}

/**
 * Inserta `- [ ] ` al final de la sección `heading` (tras su última línea no vacía).
 * La sección termina en el siguiente encabezado del mismo nivel o superior. Se ignoran
 * encabezados dentro de bloques de código y del frontmatter. Conserva los finales de línea `\r\n`.
 */
export function appendEmptyTask(content: string, heading = '## Tareas'): AppendTaskResult {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const target = parseHeading(heading.trim()) ?? { level: 2, text: heading.replace(/^#+\s*/, '').trim() };
  const wanted = target.text.toLowerCase();

  let start = -1;
  let end = lines.length;
  let inFence = false;
  for (let i = bodyStart(lines); i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h = parseHeading(line);
    if (!h) continue;
    if (start < 0) {
      if (h.level === target.level && h.text.toLowerCase() === wanted) start = i;
    } else if (h.level <= target.level) {
      end = i;
      break;
    }
  }

  if (start >= 0) {
    let last = start;
    for (let i = end - 1; i > start; i--) {
      if ((lines[i] ?? '').trim() !== '') {
        last = i;
        break;
      }
    }
    const at = last + 1;
    lines.splice(at, 0, EMPTY_TASK);
    return { content: lines.join(eol), line: at, ch: EMPTY_TASK.length, createdHeading: false };
  }

  // Sin sección: se añade al final, separada por una línea en blanco.
  while (lines.length > 1 && (lines[lines.length - 1] ?? '') === '' && (lines[lines.length - 2] ?? '').trim() === '') lines.pop();
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === '';
  if (hadTrailingNewline) lines.pop();
  const isEmpty = lines.length === 0 || (lines.length === 1 && lines[0] === '');
  if (isEmpty) lines.length = 0;
  else if ((lines[lines.length - 1] ?? '').trim() !== '') lines.push('');
  const headingText = parseHeading(heading.trim()) ? heading.trim() : `## ${target.text}`;
  lines.push(headingText, EMPTY_TASK);
  const line = lines.length - 1;
  lines.push('');
  return { content: lines.join(eol), line, ch: EMPTY_TASK.length, createdHeading: true };
}
