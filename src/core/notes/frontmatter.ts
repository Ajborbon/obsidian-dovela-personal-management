/**
 * Frontmatter EXACTO de las plantillas del vault (RI-E §5.3), escrito como texto: mismas claves, mismo
 * orden y mismos valores vacíos. `key:` (sin valor) y `key: ` (con espacio final, como en algunas
 * plantillas) se distinguen a propósito para que la salida sea idéntica byte a byte.
 */

export type FmLine =
  | { readonly kind: 'value'; readonly key: string; readonly value: string | null }
  | { readonly kind: 'list'; readonly key: string; readonly items: readonly string[] }
  | { readonly kind: 'blank' };

export const fm = {
  /** `key: value`. Con `''` produce `key: ` (espacio final, como `tags: ` en Ax). */
  value: (key: string, value: string): FmLine => ({ kind: 'value', key, value }),
  /** `key:` sin valor. */
  empty: (key: string): FmLine => ({ kind: 'value', key, value: null }),
  /** `key: "texto"` con comillas dobles (escapa `\` y `"`). */
  quoted: (key: string, text: string): FmLine => ({ kind: 'value', key, value: yamlQuote(text) }),
  /** `key: "[[destino]]"`. */
  link: (key: string, target: string): FmLine => ({ kind: 'value', key, value: yamlQuote(`[[${target}]]`) }),
  /** `origen: "[[padre]]"` o `origen: ""` (cadena vacía entre comillas, idéntico a las plantillas). */
  origen: (parentBasename: string | null): FmLine =>
    ({ kind: 'value', key: 'origen', value: parentBasename ? yamlQuote(`[[${parentBasename}]]`) : '""' }),
  /** `key:` + `  - item` por elemento (los ítems se escriben tal cual). Sin ítems: `  - `. */
  list: (key: string, items: readonly string[]): FmLine => ({ kind: 'list', key, items }),
  blank: (): FmLine => ({ kind: 'blank' }),
} as const;

export function yamlQuote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renderLine(l: FmLine): string {
  switch (l.kind) {
    case 'blank':
      return '';
    case 'value':
      return l.value === null ? `${l.key}:` : `${l.key}: ${l.value}`;
    case 'list':
      return [`${l.key}:`, ...(l.items.length ? l.items.map((i) => `  - ${i}`) : ['  - '])].join('\n');
  }
}

/** `---\n…\n---\n` */
export function renderFrontmatter(lines: readonly FmLine[]): string {
  return `---\n${lines.map(renderLine).join('\n')}\n---\n`;
}
