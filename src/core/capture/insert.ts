/**
 * Inserción de una tarea capturada en el contenido de una nota (puro, para `vault.process`).
 *
 * Semántica v1 (`appendTaskToFile`) con correcciones:
 * - Se inserta al final de la sección del encabezado configurado (tras su última línea no vacía),
 *   antes del siguiente encabezado de nivel igual o superior; los subencabezados forman parte de la sección.
 * - El encabezado se busca por línea completa (nivel + texto, sin distinguir mayúsculas); si no hay,
 *   se acepta uno del mismo nivel que empiece por ese texto (`## Tareas pendientes`, como hacía v1).
 * - Se ignoran encabezados dentro del frontmatter y de bloques de código.
 * - Si no existe el encabezado se añade al final (`\n\n## Tareas\n- [ ] …`).
 * - Nota nueva o vacía → `## Tareas\n- [ ] …\n` (v1 dejaba la primera tarea sin encabezado).
 * - Conserva los finales de línea CRLF si el archivo los usa.
 */

export interface HeadingSpec {
  readonly level: number;
  readonly text: string;
  /** Línea a escribir si hay que crearlo. */
  readonly raw: string;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/u;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/u;

/** `## Tareas` → nivel 2; `Tareas` (sin `#`) → `## Tareas`. */
export function parseHeadingSpec(heading: string): HeadingSpec {
  const h = heading.trim() || '## Tareas';
  const m = HEADING_RE.exec(h);
  if (m) return { level: (m[1] ?? '##').length, text: (m[2] ?? '').trim(), raw: `${m[1] ?? '##'} ${(m[2] ?? '').trim()}` };
  return { level: 2, text: h.replace(/^#+/u, '').trim(), raw: `## ${h.replace(/^#+/u, '').trim()}` };
}

interface HeadingLine {
  readonly idx: number;
  readonly level: number;
  readonly text: string;
}

function scanHeadings(lines: readonly string[]): HeadingLine[] {
  const out: HeadingLine[] = [];
  let i = 0;
  if ((lines[0] ?? '').replace(/\r$/u, '') === '---') {
    for (i = 1; i < lines.length; i++) {
      const l = (lines[i] ?? '').replace(/\r$/u, '');
      if (l === '---' || l === '...') {
        i++;
        break;
      }
    }
    if (i >= lines.length) i = 0; // frontmatter sin cierre: no es frontmatter
  }
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const l = (lines[i] ?? '').replace(/\r$/u, '');
    const f = FENCE_RE.exec(l);
    if (f) {
      const marker = f[1] ?? '';
      if (fence === null) fence = marker.charAt(0).repeat(3);
      else if (marker.startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = HEADING_RE.exec(l);
    if (m) out.push({ idx: i, level: (m[1] ?? '').length, text: (m[2] ?? '').trim() });
  }
  return out;
}

const isBlank = (s: string | undefined): boolean => (s ?? '').trim() === '';

export interface InsertResult {
  readonly content: string;
  /** Línea (0-based) donde quedó la tarea. */
  readonly line: number;
}

/** Devuelve el nuevo contenido con `line` insertada. */
export function insertTask(content: string, heading: string, line: string): string {
  return insertTaskAt(content, heading, line).content;
}

/** Como `insertTask`, indicando además la línea donde quedó la tarea (para abrir la nota en ella). */
export function insertTaskAt(content: string, heading: string, line: string): InsertResult {
  const spec = parseHeadingSpec(heading);
  const crlf = content.includes('\r\n');
  const eol = crlf ? '\r\n' : '\n';
  if (content.trim() === '') return { content: `${spec.raw}${eol}${line}${eol}`, line: 1 };

  const lines = content.split('\n');
  const headings = scanHeadings(lines);
  const want = spec.text.toLowerCase();
  const target =
    headings.find((h) => h.level === spec.level && h.text.toLowerCase() === want) ??
    headings.find((h) => h.level === spec.level && h.text.toLowerCase().startsWith(want) && /^[\s:(-]/u.test(h.text.slice(want.length)));

  if (!target) {
    const base = content.trimEnd();
    const baseLines = base.split('\n').length;
    return { content: `${base}${eol}${eol}${spec.raw}${eol}${line}${eol}`, line: baseLines + 2 };
  }

  const next = headings.find((h) => h.idx > target.idx && h.level <= target.level);
  const end = next ? next.idx : lines.length;
  let at = target.idx + 1;
  for (let i = end - 1; i > target.idx; i--) {
    if (!isBlank(lines[i])) {
      at = i + 1;
      break;
    }
  }
  const atEnd = at >= lines.length;
  if (atEnd && crlf && !(lines[at - 1] ?? '').endsWith('\r')) lines[at - 1] = `${lines[at - 1] ?? ''}\r`;
  lines.splice(at, 0, crlf ? `${line}\r` : line);
  if (atEnd) lines.push('');
  return { content: lines.join('\n'), line: at };
}

export const DEFAULT_INBOX_PATH = '00 - Inbox/Bandeja de entrada.md';

/** Normaliza la ruta de la nota destino (sin `/` inicial, con `.md`). */
export function normalizeNotePath(path: string): string {
  let s = path.trim().replace(/\\/gu, '/').replace(/\/{2,}/gu, '/').replace(/^\/+|\/+$/gu, '');
  if (!s) s = DEFAULT_INBOX_PATH;
  if (!/\.md$/iu.test(s)) s += '.md';
  return s;
}

/** Carpetas ancestro de una ruta, de la más externa a la más interna (`a`, `a/b`). */
export function ancestorFolders(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
