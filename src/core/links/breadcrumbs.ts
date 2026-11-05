/**
 * Breadcrumbs de carpeta (puros). Sustituye a `BreadcrumbRenderer` de v1 (RI-D §2.7).
 *
 * v1 tenía una recursión mutua `createBreadcrumb → createCompactBreadcrumb → createPathBreadcrumbs →
 * createBreadcrumb` que, con estilo compacto (o inteligente con ruta larga) y ≤ 2 segmentos, terminaba en
 * "Maximum call stack size exceeded" (bug de julio de 2026). Aquí hay UNA sola función de decisión, sin
 * llamadas a sí misma ni a otras funciones de decisión: los segmentos se calculan una vez y el estilo solo
 * elige cómo presentarlos. El DOM lo construye la UI a partir de este modelo.
 */

export type BreadcrumbStyle = 'full' | 'smart' | 'compact';

export const BREADCRUMB_STYLES: readonly BreadcrumbStyle[] = ['full', 'smart', 'compact'];

export const BREADCRUMB_STYLE_LABELS: Readonly<Record<BreadcrumbStyle, string>> = {
  full: 'Completo',
  smart: 'Inteligente',
  compact: 'Compacto',
};

export interface CrumbSegment {
  /** Nombre visible (un segmento de la ruta). */
  readonly name: string;
  /** Ruta acumulada hasta este segmento (`A`, `A/B`, …). */
  readonly path: string;
}

export type Breadcrumb =
  /** Ruta vacía (raíz del vault). `label` = `📁 Root` (completo/inteligente) o `📁` (compacto). */
  | { readonly kind: 'root'; readonly label: string }
  /** Todos los segmentos. */
  | { readonly kind: 'full'; readonly segments: readonly CrumbSegment[] }
  /** `primero › … › último` con la ruta completa en `title`. */
  | { readonly kind: 'elided'; readonly first: CrumbSegment; readonly last: CrumbSegment; readonly hidden: number; readonly title: string };

export const CRUMB_SEPARATOR = '›';
export const CRUMB_ELLIPSIS = '…';

/** `'/A//B/'` → `[A ('A'), B ('A/B')]`. */
export function parsePathSegments(path: string): CrumbSegment[] {
  const names = path.split('/').filter(Boolean);
  const out: CrumbSegment[] = [];
  let acc = '';
  for (const name of names) {
    acc = acc ? `${acc}/${name}` : name;
    out.push({ name, path: acc });
  }
  return out;
}

/**
 * Decide el breadcrumb de `path` para `style` con longitud máxima `maxLength` (límite inclusivo).
 * - `full`: siempre todos los segmentos.
 * - `smart` y `compact` (idénticos en v1 salvo la raíz): si `segmentos.join('/')` cabe en `maxLength` → completo;
 *   si no y hay más de 2 segmentos → `primero › … › último`; con ≤ 2 segmentos → completo (nunca se trunca).
 * No es recursiva: termina en O(segmentos) para cualquier entrada.
 */
export function computeBreadcrumb(path: string, style: BreadcrumbStyle, maxLength: number): Breadcrumb {
  const segments = parsePathSegments(path);
  if (segments.length === 0) {
    return { kind: 'root', label: style === 'compact' ? '📁' : '📁 Root' };
  }
  if (style === 'full') return { kind: 'full', segments };

  const max = Number.isFinite(maxLength) ? maxLength : Number.POSITIVE_INFINITY;
  const joined = segments.map((s) => s.name).join('/');
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (joined.length <= max || segments.length <= 2 || !first || !last) return { kind: 'full', segments };
  return { kind: 'elided', first, last, hidden: segments.length - 2, title: joined };
}

/** Texto plano del breadcrumb (accesibilidad, pruebas, `title`). */
export function breadcrumbText(b: Breadcrumb): string {
  switch (b.kind) {
    case 'root':
      return b.label;
    case 'full':
      return b.segments.map((s) => s.name).join(` ${CRUMB_SEPARATOR} `);
    case 'elided':
      return `${b.first.name} ${CRUMB_SEPARATOR} ${CRUMB_ELLIPSIS} ${CRUMB_SEPARATOR} ${b.last.name}`;
  }
}

/** Siguiente estilo del ciclo del botón 📁 (completo → inteligente → compacto → completo). */
export function nextBreadcrumbStyle(style: BreadcrumbStyle): BreadcrumbStyle {
  const i = BREADCRUMB_STYLES.indexOf(style);
  return BREADCRUMB_STYLES[(i + 1) % BREADCRUMB_STYLES.length] ?? 'full';
}

/**
 * Nota que se abre al pulsar un segmento de carpeta. v1 abría "el primer `.md` de la carpeta" (orden del
 * vault); v2 prefiere la *nota de carpeta* `Carpeta/Carpeta.md` (modelo de fusión de la jerarquía) y, si no
 * existe, la primera nota directa por nombre. `null` si la carpeta no tiene notas.
 */
export function folderTargetNote(folderPath: string, notesInFolder: readonly string[]): string | null {
  const segs = parsePathSegments(folderPath);
  const name = segs[segs.length - 1]?.name;
  const prefix = folderPath ? `${folderPath}/` : '';
  if (name) {
    const folderNote = `${prefix}${name}.md`;
    if (notesInFolder.includes(folderNote)) return folderNote;
  }
  const direct = notesInFolder
    .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .sort((a, b) => a.localeCompare(b));
  return direct[0] ?? null;
}
