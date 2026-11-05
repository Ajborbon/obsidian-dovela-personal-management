/**
 * Intérprete MÍNIMO de la sintaxis Templater, solo para pruebas: permite renderizar las plantillas
 * reales del vault (docs/contexto-vault/reglas-vault/plantillas) y compararlas con la salida del
 * motor propio. No ejecuta JavaScript: cada interpolación `<% expr %>` se resuelve con un mapa
 * expresión → valor y cada bloque `<%* … %>` se interpreta así:
 *   - control de flujo simple: `if (cond) {`, `} else {`, `}`, `} if (cond) {`, `tR += "…"; }`
 *     (las condiciones se buscan en `flags`);
 *   - cualquier otro bloque: se pide su salida a `block(code)` (por defecto: no emite nada, y si el
 *     bloque escribe en `tR` hay que decir explícitamente qué emite).
 * Respeta el recorte de espacios: `-%>` quita un salto de línea posterior y `_%>` todos los espacios.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TEMPLATES_DIR = join(process.cwd(), 'docs/contexto-vault/reglas-vault/plantillas');

export function readTemplate(name: string): string {
  return readFileSync(join(TEMPLATES_DIR, name), 'utf8');
}

export interface TemplaterInput {
  readonly exprs: Readonly<Record<string, string>>;
  readonly flags?: Readonly<Record<string, boolean>>;
  /** Salida de un bloque `<%* … %>` que no es de control. `undefined` = no emite (si usa `tR`, error). */
  readonly block?: (code: string) => string | undefined;
}

const TAG_RE = /<%([*_-]?)([\s\S]*?)([-_]?)%>/g;

function unescapeJs(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function renderTemplater(text: string, input: TemplaterInput): string {
  const stack: boolean[] = [];
  const active = (): boolean => stack.every(Boolean);
  const flag = (cond: string): boolean => {
    const v = input.flags?.[cond];
    if (v === undefined) throw new Error(`Condición sin valor en la prueba: ${cond}`);
    return v;
  };
  let out = '';
  let last = 0;
  let trimNext: '' | '-' | '_' = '';
  const emitText = (s: string): void => {
    let t = s;
    if (trimNext === '-') t = t.replace(/^\r?\n/, '');
    else if (trimNext === '_') t = t.replace(/^\s+/, '');
    trimNext = '';
    if (active()) out += t;
  };
  for (const m of text.matchAll(TAG_RE)) {
    emitText(text.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const kind = m[1] ?? '';
    const code = (m[2] ?? '').trim();
    trimNext = (m[3] ?? '') as '' | '-' | '_';
    if (kind === '*') {
      let mm: RegExpExecArray | null;
      if ((mm = /^if \((.+)\) \{$/.exec(code))) stack.push(flag(mm[1]!));
      else if (/^\} else \{$/.test(code)) stack.push(!stack.pop());
      else if (code === '}') stack.pop();
      else if ((mm = /^\} if \((.+)\) \{$/.exec(code))) {
        stack.pop();
        stack.push(flag(mm[1]!));
      } else if ((mm = /^tR \+= "((?:[^"\\]|\\.)*)"; \}$/.exec(code))) {
        if (active()) out += unescapeJs(mm[1]!);
        stack.pop();
      } else {
        const emitted = input.block?.(code);
        if (emitted === undefined && /\btR\b/.test(code)) throw new Error(`Bloque con tR sin salida definida: ${code.slice(0, 80)}…`);
        if (active()) out += emitted ?? '';
      }
    } else {
      const v = input.exprs[code];
      if (v === undefined) throw new Error(`Expresión sin valor en la prueba: ${code}`);
      if (active()) out += v;
    }
  }
  emitText(text.slice(last));
  return out;
}

/** Separa `---\n…\n---\n` del resto. */
export function splitFm(content: string): { fm: string; body: string } {
  const m = /^---\n[\s\S]*?\n---\n/.exec(content);
  if (!m) return { fm: '', body: content };
  return { fm: m[0], body: content.slice(m[0].length) };
}
