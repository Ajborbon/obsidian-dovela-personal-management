/**
 * Estado de UI por dispositivo del Dashboard / Foco (02 §6: caché local, no `data.json`).
 * Toda lectura se valida: una caché corrupta nunca rompe la vista.
 */
import type { OverdueMode } from '../../core/gtd/classify';
import type { GtdFilter } from '../../core/gtd/filters';
import { EMPTY_FILTER } from '../../core/gtd/filters';
import { validateFocusSettings, type FocusSettings } from '../../core/gtd/focus';
import type { InProgressGrouping, InProgressSorting } from '../../core/gtd/inprogress';
import type { DeviceCache } from '../../host/deviceCache';

export type DashboardTab = 'gtd' | 'inProgress' | 'hierarchy' | 'tracker' | 'statistics' | 'timeline';

export const TABS: ReadonlyArray<{ readonly id: DashboardTab; readonly label: string; readonly short: string }> = [
  { id: 'hierarchy', label: '📊 Vista Jerárquica', short: '📊' },
  { id: 'gtd', label: '📋 Listas GTD', short: '📋' },
  { id: 'inProgress', label: '⚡ En Progreso', short: '⚡' },
  { id: 'tracker', label: '⏱️ Seguimiento', short: '⏱️' },
  { id: 'statistics', label: '📈 Estadísticas', short: '📈' },
  { id: 'timeline', label: '📅 Cronograma', short: '📅' },
];

export interface DashboardState {
  tab: DashboardTab;
  overdueMode: OverdueMode;
  filter: GtdFilter;
  grouping: InProgressGrouping;
  sorting: InProgressSorting;
  /** Filtros plegados (por defecto en móvil). */
  filtersCollapsed: boolean;
  /** Secciones de listas cerradas por el usuario (anclas). En v1 todas empiezan abiertas. */
  closedSections: string[];
}

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));
const GROUPINGS = new Set<string>(['none', 'context', 'person', 'project']);
const SORTINGS = new Set<string>(['priority', 'duration-asc', 'duration-desc']);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function loadDashboardState(cache: DeviceCache, key: string, mobile: boolean): DashboardState {
  const raw = cache.get<unknown>(key, null);
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const f = o['filter'] && typeof o['filter'] === 'object' ? (o['filter'] as Record<string, unknown>) : {};
  return {
    tab: TAB_IDS.has(str(o['tab'])) ? (o['tab'] as DashboardTab) : 'gtd',
    overdueMode: o['overdueMode'] === 'context-first' ? 'context-first' : 'date-first',
    filter: { ...EMPTY_FILTER, context: str(f['context']), person: str(f['person']), text: str(f['text']) },
    grouping: GROUPINGS.has(str(o['grouping'])) ? (o['grouping'] as InProgressGrouping) : 'none',
    sorting: SORTINGS.has(str(o['sorting'])) ? (o['sorting'] as InProgressSorting) : 'priority',
    filtersCollapsed: typeof o['filtersCollapsed'] === 'boolean' ? o['filtersCollapsed'] : mobile,
    closedSections: Array.isArray(o['closedSections']) ? o['closedSections'].filter((x): x is string => typeof x === 'string') : [],
  };
}

export function saveDashboardState(cache: DeviceCache, key: string, s: DashboardState): void {
  cache.set(key, s);
}

// ───────────── Foco ─────────────

export const FOCUS_SETTINGS_KEY = 'gtd:foco:settings';
export const FOCUS_HEADER_KEY = 'gtd:foco:headerCollapsed';
const FOCUS_MIGRATED_KEY = 'gtd:foco:v1migrated';

export function loadFocusSettings(cache: DeviceCache): FocusSettings {
  return validateFocusSettings(cache.get<unknown>(FOCUS_SETTINGS_KEY, null));
}

export function saveFocusSettings(cache: DeviceCache, s: FocusSettings): void {
  cache.set(FOCUS_SETTINGS_KEY, s);
}

/**
 * Migración única de las claves `localStorage` de v1 (plan de migración, punto 6):
 * `dovela-foco-expansion-settings` y `dovela-focus-header-collapsed`. No borra las originales.
 */
export function migrateLegacyFocus(cache: DeviceCache): void {
  if (cache.get<boolean>(FOCUS_MIGRATED_KEY, false)) return;
  const rawSettings = cache.readLegacyLocalStorage('dovela-foco-expansion-settings');
  if (rawSettings && cache.get<unknown>(FOCUS_SETTINGS_KEY, null) === null) {
    try {
      const parsed: unknown = JSON.parse(rawSettings);
      saveFocusSettings(cache, validateFocusSettings(parsed));
    } catch {
      // JSON inválido en v1: se usan los valores por defecto.
    }
  }
  const header = cache.readLegacyLocalStorage('dovela-focus-header-collapsed');
  if (header !== null && cache.get<unknown>(FOCUS_HEADER_KEY, null) === null) cache.set(FOCUS_HEADER_KEY, header === 'true');
  cache.set(FOCUS_MIGRATED_KEY, true);
}
