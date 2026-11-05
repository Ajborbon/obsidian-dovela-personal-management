/**
 * Ajustes persistidos en `data.json` (v2, `schemaVersion: 2`) y migración desde v1.
 * Solo configuración pequeña: los registros de tiempo viven en el vault (02 §2) y
 * las preferencias de UI por dispositivo en la caché local (02 §6).
 */

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  cyclesBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  overtimeAlertInterval: number;
  /** Minutos entre pomodoros para considerarlos la misma sesión (backlog v0.9). */
  sessionGapMinutes: number;
}

export interface JournalSettings {
  baseFolderPath: string;
  yearSubfolder: boolean;
  quarterSubfolder: boolean;
  monthSubfolder: boolean;
  weekFolderPattern: string;
  /** Carpeta (relativa a la base) para semanales/mensuales/trimestrales/anuales. `{YYYY}` admitido. */
  periodFolderPattern: string;
}

export interface GeneralSettings {
  /** Prefijos de ruta excluidos del índice (v1: carpeta de plantillas). */
  excludedPathPrefixes: string[];
  /** Nombres de carpeta excluidos en cualquier nivel (v1: `99 - Adjuntos`). */
  excludedFolderNames: string[];
  inboxPath: string;
  tasksHeading: string;
  /** `➕ YYYY-MM-DD HH:mm` (v1) o solo fecha (compatible con Tasks). */
  createdStampWithTime: boolean;
  /** Carpeta de plantillas `Plt - <Tipo>.md` para personalizar cuerpos (opcional). */
  templatesFolder: string;
  /** Contar `origen` como enlace entrante en Backlinks. */
  backlinksIncludeOrigin: boolean;
}

export interface TimeSettings {
  /** Carpeta del vault con los archivos de eventos `YYYY-MM · <dispositivo>.md`. */
  folder: string;
  /** Horas tras las que una sesión en vivo se marca como posiblemente abandonada. */
  staleLiveHours: number;
  csvSeparator: ';' | ',';
  exportFolder: string;
  /** "Cerrar tarea" marcado por defecto al detener un temporizador (v1: sí). */
  closeTaskByDefault: boolean;
}

/** Datos de v1 conservados sin modificar hasta la verificación del importador (03 §migración). */
export interface LegacyData {
  timeLogs?: unknown[];
  activeTimer?: unknown;
  activePomodoroSession?: unknown;
  pomodoroStats?: unknown;
  /** Claves desconocidas de v1, conservadas tal cual. */
  extra?: Record<string, unknown>;
}

export interface MigrationState {
  v1BackupWritten: boolean;
  importedAt?: string;
  importedCount?: number;
  verifiedAt?: string;
  archivedAt?: string;
}

export interface DovelaSettings {
  schemaVersion: 2;
  general: GeneralSettings;
  time: TimeSettings;
  pomodoro: PomodoroSettings;
  journal: JournalSettings;
  legacy?: LegacyData;
  migration: MigrationState;
}

export const DEFAULT_POMODORO: Readonly<PomodoroSettings> = Object.freeze({
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  cyclesBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  notificationsEnabled: true,
  overtimeAlertInterval: 5,
  sessionGapMinutes: 30,
});

/** Defaults alineados con el vault real (`AI - Journals/YYYY/MM/`), ver 02 §9.2. */
export const DEFAULT_JOURNAL: Readonly<JournalSettings> = Object.freeze({
  baseFolderPath: '03 - Gestion Personal/AV - Gerente de Vida/AI - Journals',
  yearSubfolder: true,
  quarterSubfolder: false,
  monthSubfolder: true,
  weekFolderPattern: '{YYYY}/Q{Q}',
  periodFolderPattern: '{YYYY}',
});

export function defaultSettings(): DovelaSettings {
  return {
    schemaVersion: 2,
    general: {
      excludedPathPrefixes: ['03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas'],
      excludedFolderNames: ['99 - Adjuntos'],
      inboxPath: '00 - Inbox/Bandeja de entrada.md',
      tasksHeading: '## Tareas',
      createdStampWithTime: true,
      templatesFolder: '',
      backlinksIncludeOrigin: true,
    },
    time: {
      folder: 'Dovela/Registro de tiempo',
      staleLiveHours: 12,
      csvSeparator: ';',
      exportFolder: 'Dovela/Exportaciones',
      closeTaskByDefault: true,
    },
    pomodoro: { ...DEFAULT_POMODORO },
    journal: { ...DEFAULT_JOURNAL },
    migration: { v1BackupWritten: false },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Copia los campos de `src` cuyo tipo coincide con el del default (merge profundo, sin compartir referencias). */
function mergeInto<T extends object>(base: T, src: unknown): T {
  if (!isObj(src)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, defVal] of Object.entries(base)) {
    const v = src[k];
    if (v === undefined) continue;
    if (Array.isArray(defVal)) {
      if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string');
    } else if (isObj(defVal)) {
      out[k] = mergeInto(defVal, v);
    } else if (typeof v === typeof defVal) {
      out[k] = v;
    }
  }
  return out as T;
}

const V1_KEYS = new Set(['timeLogs', 'activeTimer', 'activePomodoroSession', 'pomodoroStats', 'pomodoroSettings', 'journalSettings']);

export interface LoadResult {
  readonly settings: DovelaSettings;
  /** El archivo era de v1 (sin schemaVersion) y hay que respaldarlo. */
  readonly wasV1: boolean;
}

/** Interpreta el contenido de `data.json` (v1, v2 o vacío). Nunca descarta datos de v1. */
export function loadSettings(raw: unknown): LoadResult {
  const base = defaultSettings();
  if (!isObj(raw)) return { settings: base, wasV1: false };
  if (raw['schemaVersion'] === 2) {
    const s = mergeInto(base, raw);
    if (isObj(raw['legacy'])) s.legacy = raw['legacy'] as LegacyData;
    return { settings: s, wasV1: false };
  }
  // v1
  const s = base;
  s.pomodoro = mergeInto(s.pomodoro, raw['pomodoroSettings']);
  if (isObj(raw['journalSettings'])) s.journal = mergeInto(s.journal, raw['journalSettings']);
  const legacy: LegacyData = {};
  if (Array.isArray(raw['timeLogs'])) legacy.timeLogs = raw['timeLogs'];
  if (raw['activeTimer'] !== undefined) legacy.activeTimer = raw['activeTimer'];
  if (raw['activePomodoroSession'] !== undefined) legacy.activePomodoroSession = raw['activePomodoroSession'];
  if (raw['pomodoroStats'] !== undefined) legacy.pomodoroStats = raw['pomodoroStats'];
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!V1_KEYS.has(k)) extra[k] = v;
  if (Object.keys(extra).length) legacy.extra = extra;
  const hasLegacy = Object.keys(legacy).length > 0;
  if (hasLegacy) s.legacy = legacy;
  return { settings: s, wasV1: hasLegacy || isObj(raw['pomodoroSettings']) || isObj(raw['journalSettings']) };
}

/** ¿La ruta está excluida del índice? */
export function isExcludedPath(path: string, g: Pick<GeneralSettings, 'excludedPathPrefixes' | 'excludedFolderNames'>): boolean {
  if (g.excludedPathPrefixes.some((p) => p && (path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`)))) return true;
  const segs = path.split('/').slice(0, -1);
  return segs.some((s) => g.excludedFolderNames.includes(s));
}
