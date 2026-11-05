/**
 * Interpolación de texto de plantilla SIN ejecutar código (02 §1, opción C).
 * Solo se sustituyen marcadores `{{variable}}` cuyo nombre exista en `vars`; el resto del texto
 * (incluidos `{{desconocido}}`, bloques `datacorejsx`/`base` y código Templater `<% … %>`) queda intacto.
 */

export type TemplateVars = Readonly<Record<string, string>>;

const VAR_RE = /\{\{([\p{L}\p{N}_]+)\}\}/gu;

export function interpolate(text: string, vars: TemplateVars): string {
  return text.replace(VAR_RE, (whole, name: string) => (Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] ?? '' : whole));
}

/** ¿Contiene código Templater (`<% … %>`)? Ese código NO se ejecuta: se deja tal cual y se avisa. */
export function hasTemplaterCode(text: string): boolean {
  return /<%[\s\S]*?%>/.test(text);
}

/** Quita un frontmatter inicial `---\n…\n---\n` (si lo hay) y devuelve el resto. */
export function stripFrontmatter(text: string): string {
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(t);
  return m ? t.slice(m[0].length) : t;
}

/**
 * Cuerpo personalizado a partir del texto de `Plt - <Tipo>.md` (carpeta de plantillas del usuario):
 * se descarta su frontmatter (el del motor es el exacto de las plantillas) y se interpolan las variables.
 */
export function renderOverrideBody(overrideText: string, vars: TemplateVars): { body: string; hasCode: boolean } {
  const raw = stripFrontmatter(overrideText);
  return { body: interpolate(raw, vars), hasCode: hasTemplaterCode(raw) };
}
