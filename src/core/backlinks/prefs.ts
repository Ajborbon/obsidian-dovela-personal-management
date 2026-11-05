/**
 * Preferencias de Backlinks por dispositivo (caché local, no `data.json`) y migración única de las claves
 * `localStorage` de v1 (`dovela-backlink-settings`, ver legacy-v1 `backlinkSettings.ts`).
 */
import { BREADCRUMB_STYLES, type BreadcrumbStyle } from '../links/breadcrumbs';
import { DEFAULT_SORT, sanitizeSort, type SortState } from './sort';

/** Clave v1 en `window.localStorage`. */
export const LEGACY_BACKLINK_SETTINGS_KEY = 'dovela-backlink-settings';
/** Claves en la caché por dispositivo (`DeviceCache` añade su prefijo). */
export const PREFS_CACHE_KEY = 'backlinks.prefs';
export const LEGACY_MIGRATED_KEY = 'backlinks.legacyMigrated';

export const MIN_BREADCRUMB_LENGTH = 10;
export const MAX_BREADCRUMB_LENGTH = 200;

export interface BacklinkPrefs {
  readonly breadcrumbStyle: BreadcrumbStyle;
  readonly maxBreadcrumbLength: number;
  /** Modo detalle: fechas de creación/modificación y 💰 (v1 siempre las mostraba en la lista). */
  readonly detail: boolean;
  readonly sort: SortState;
}

export const DEFAULT_PREFS: BacklinkPrefs = {
  breadcrumbStyle: 'full',
  maxBreadcrumbLength: 60,
  detail: true,
  sort: DEFAULT_SORT,
};

function clampLength(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_BREADCRUMB_LENGTH, Math.max(MIN_BREADCRUMB_LENGTH, Math.round(n)));
}

function asStyle(v: unknown, fallback: BreadcrumbStyle): BreadcrumbStyle {
  return BREADCRUMB_STYLES.includes(v as BreadcrumbStyle) ? (v as BreadcrumbStyle) : fallback;
}

/** Normaliza lo leído de la caché (valores ajenos o corruptos → por defecto). Devuelve un objeto nuevo. */
export function sanitizePrefs(raw: unknown): BacklinkPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    breadcrumbStyle: asStyle(r['breadcrumbStyle'], DEFAULT_PREFS.breadcrumbStyle),
    maxBreadcrumbLength: clampLength(r['maxBreadcrumbLength'], DEFAULT_PREFS.maxBreadcrumbLength),
    detail: typeof r['detail'] === 'boolean' ? r['detail'] : DEFAULT_PREFS.detail,
    sort: r['sort'] === undefined ? DEFAULT_SORT : sanitizeSort(r['sort']),
  };
}

/** Lo que se guarda (sin el estado efímero de doble clic). */
export function serializePrefs(p: BacklinkPrefs): Record<string, unknown> {
  return {
    breadcrumbStyle: p.breadcrumbStyle,
    maxBreadcrumbLength: p.maxBreadcrumbLength,
    detail: p.detail,
    sort: { key: p.sort.key, dir: p.sort.dir, expandedTree: p.sort.expandedTree },
  };
}

/**
 * Convierte el JSON de v1 (`{breadcrumbStyle, maxBreadcrumbLength, maxSegmentLength, showFolderIcons,
 * clickBehavior}`) en preferencias parciales. Solo `breadcrumbStyle` y `maxBreadcrumbLength` tenían efecto en
 * v1; el resto se ignora. `null` si no hay nada válido que migrar.
 */
export function legacyToPrefs(raw: string | null): Partial<Pick<BacklinkPrefs, 'breadcrumbStyle' | 'maxBreadcrumbLength'>> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const r = parsed as Record<string, unknown>;
  const out: { breadcrumbStyle?: BreadcrumbStyle; maxBreadcrumbLength?: number } = {};
  if (BREADCRUMB_STYLES.includes(r['breadcrumbStyle'] as BreadcrumbStyle)) out.breadcrumbStyle = r['breadcrumbStyle'] as BreadcrumbStyle;
  if (r['maxBreadcrumbLength'] !== undefined) {
    const n = clampLength(r['maxBreadcrumbLength'], NaN);
    if (Number.isFinite(n)) out.maxBreadcrumbLength = n;
  }
  return Object.keys(out).length ? out : null;
}

/** Almacén mínimo (lo cumple `DeviceCache`). */
export interface PrefsStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  readLegacyLocalStorage(key: string): string | null;
}

/**
 * Carga las preferencias aplicando UNA vez la migración de v1: solo si aún no se migró en este dispositivo.
 * Las preferencias v2 ya guardadas tienen prioridad sobre las de v1. La clave v1 no se borra (permite volver a v1).
 */
export function loadPrefs(storage: PrefsStorage): BacklinkPrefs {
  const stored = storage.get<unknown>(PREFS_CACHE_KEY, null);
  let prefs = sanitizePrefs(stored);
  if (!storage.get<boolean>(LEGACY_MIGRATED_KEY, false)) {
    const legacy = legacyToPrefs(storage.readLegacyLocalStorage(LEGACY_BACKLINK_SETTINGS_KEY));
    if (legacy && (stored === null || stored === undefined)) {
      prefs = { ...prefs, ...legacy };
      storage.set(PREFS_CACHE_KEY, serializePrefs(prefs));
    }
    storage.set(LEGACY_MIGRATED_KEY, true);
  }
  return prefs;
}

export function savePrefs(storage: PrefsStorage, prefs: BacklinkPrefs): void {
  storage.set(PREFS_CACHE_KEY, serializePrefs(prefs));
}
