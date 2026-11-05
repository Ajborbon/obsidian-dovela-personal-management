/**
 * Inserción del enlace al hijo en la nota padre cuando el editor activo NO es el padre (02 §1):
 * al final de la sección `## Historial` si existe; si no, al final de la nota.
 */

export const HISTORY_HEADING = '## Historial';

/** Normaliza el texto a insertar como una o más líneas (sin salto final). */
function asLines(insert: string): string {
  return insert.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

export function insertChildLink(text: string, insert: string, heading = HISTORY_HEADING): string {
  const add = asLines(insert);
  if (!add) return text;
  const lines = text.split('\n');
  const level = /^(#+)\s/.exec(heading)?.[1]?.length ?? 2;
  const start = lines.findIndex((l) => l.trimEnd() === heading);
  if (start >= 0) {
    let end = lines.length;
    let fence = false;
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i] ?? '';
      if (/^\s*(```|~~~)/.test(l)) fence = !fence;
      if (fence) continue;
      const m = /^(#+)\s/.exec(l);
      if (m && (m[1]?.length ?? 99) <= level) {
        end = i;
        break;
      }
    }
    // Tras la última línea con contenido de la sección.
    let at = end;
    while (at > start + 1 && (lines[at - 1] ?? '').trim() === '') at--;
    lines.splice(at, 0, add);
    return lines.join('\n');
  }
  if (text === '') return `${add}\n`;
  const sep = text.endsWith('\n') ? '' : '\n';
  return `${text}${sep}${add}\n`;
}
