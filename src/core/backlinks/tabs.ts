/**
 * Agrupación del visor de pestañas abiertas (puro). RI-D §2.4 y §6.3 (S21).
 *
 * La UI describe cada pestaña con su área (`main`, `left`, `right`, `floating`) y un identificador de su grupo
 * de pestañas (split). v1 comparaba `leaf.parent` con los docks (casi nunca acertaba); v2 usa la raíz de la
 * hoja y el contenedor de pestañas, así que dos splits del panel central salen como grupos distintos.
 */

export type TabArea = 'main' | 'left' | 'right' | 'floating';

export interface TabInfo<T> {
  readonly area: TabArea;
  /** Identificador estable del contenedor de pestañas dentro del área (orden de aparición). */
  readonly groupKey: string;
  readonly item: T;
}

export interface TabGroup<T> {
  readonly area: TabArea;
  readonly groupKey: string;
  readonly label: string;
  readonly items: T[];
}

export interface TabGrouping<T> {
  readonly groups: TabGroup<T>[];
  /** Solo se pintan encabezados si hay más de un grupo con pestañas (como v1). */
  readonly showHeaders: boolean;
  readonly total: number;
}

const AREA_ORDER: readonly TabArea[] = ['main', 'left', 'right', 'floating'];

const AREA_LABELS: Readonly<Record<TabArea, string>> = {
  main: '📄 Panel central',
  left: '◀️ Panel izquierdo',
  right: '▶️ Panel derecho',
  floating: '🪟 Ventana',
};

export function groupOpenTabs<T>(tabs: readonly TabInfo<T>[]): TabGrouping<T> {
  const byKey = new Map<string, { area: TabArea; groupKey: string; items: T[] }>();
  for (const t of tabs) {
    const k = `${t.area}\u0000${t.groupKey}`;
    let g = byKey.get(k);
    if (!g) byKey.set(k, (g = { area: t.area, groupKey: t.groupKey, items: [] }));
    g.items.push(t.item);
  }
  const raw = [...byKey.values()].filter((g) => g.items.length > 0);
  // Orden: por área; dentro del área, orden de aparición (Map conserva inserción y sort es estable).
  raw.sort((a, b) => AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area));
  const perArea = new Map<TabArea, number>();
  for (const g of raw) perArea.set(g.area, (perArea.get(g.area) ?? 0) + 1);
  const seen = new Map<TabArea, number>();
  const groups = raw.map((g) => {
    const n = (seen.get(g.area) ?? 0) + 1;
    seen.set(g.area, n);
    const label = (perArea.get(g.area) ?? 0) > 1 ? `${AREA_LABELS[g.area]} · ${n}` : AREA_LABELS[g.area];
    return { area: g.area, groupKey: g.groupKey, label, items: g.items };
  });
  return { groups, showHeaders: groups.length > 1, total: tabs.length };
}
