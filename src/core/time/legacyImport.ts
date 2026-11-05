/**
 * Importador idempotente del historial v1 (`data.json.timeLogs` y `timelogs.json`) a eventos v2.
 * No modifica la fuente. Re-ejecutarlo no duplica (id `leg-<idViejo>` + deduplicación por ruta/inicio/fin).
 */
import type { LiveEvent, LogEvent, LogKind } from './events';

export const IMPORT_DEVICE = 'importado';

export interface LegacyReport {
  readonly read: number;
  readonly imported: number;
  readonly duplicates: number;
  readonly alreadyImported: number;
  readonly invalid: Array<{ readonly index: number; readonly reason: string }>;
  readonly incoherent: number; // fin < inicio (se importan marcados)
  readonly durationMismatch: number;
  /** Minutos por mes (YYYY-MM, por inicio en UTC-local) para verificar antes/después. */
  readonly minutesByMonth: Record<string, number>;
}

interface V1Log {
  id?: unknown;
  taskNotePath?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
  notes?: unknown;
  taskDescription?: unknown;
}

const POMODORO_RE = /^Sesión Pomodoro/;
const TASK_ID_RE = /🆔️?\s*([A-Za-z0-9_-]+)/u;

function monthOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface ImportResult {
  readonly events: LogEvent[];
  readonly report: LegacyReport;
}

/**
 * @param raw  arreglo `timeLogs` de v1 (o el contenido de `timelogs.json`)
 * @param existingIds ids de registros ya presentes (incluidos `leg-*` de importaciones anteriores)
 * @param existingKeys claves `ruta|inicioMs|finMs` ya presentes
 */
export function importLegacyLogs(
  raw: unknown,
  nowMs: number,
  existingIds: ReadonlySet<string> = new Set(),
  existingKeys: ReadonlySet<string> = new Set(),
): ImportResult {
  const arr = Array.isArray(raw) ? (raw as V1Log[]) : [];
  const events: LogEvent[] = [];
  const invalid: Array<{ index: number; reason: string }> = [];
  const seenKeys = new Set(existingKeys);
  const seenIds = new Set(existingIds);
  let duplicates = 0;
  let alreadyImported = 0;
  let incoherent = 0;
  let mismatch = 0;
  const minutesByMonth: Record<string, number> = {};

  arr.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      invalid.push({ index, reason: 'no es un objeto' });
      return;
    }
    const path = typeof item.taskNotePath === 'string' ? item.taskNotePath : '';
    const a = typeof item.startTime === 'string' ? Date.parse(item.startTime) : NaN;
    const b = typeof item.endTime === 'string' ? Date.parse(item.endTime) : NaN;
    if (!path || Number.isNaN(a) || Number.isNaN(b)) {
      invalid.push({ index, reason: 'faltan ruta, inicio o fin válidos' });
      return;
    }
    const oldId = item.id === undefined || item.id === null ? `${a}-${index}` : String(item.id);
    const id = `leg-${oldId}`;
    if (seenIds.has(id)) {
      alreadyImported++;
      return;
    }
    const key = `${path}|${a}|${b}`;
    if (seenKeys.has(key)) {
      duplicates++;
      return;
    }
    seenIds.add(id);
    seenKeys.add(key);
    const notes = typeof item.notes === 'string' ? item.notes : '';
    const desc = typeof item.taskDescription === 'string' ? item.taskDescription : '';
    const computed = Math.max(0, Math.floor((b - a) / 60000));
    const stored = typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined;
    const bad = b < a;
    if (bad) incoherent++;
    if (stored !== undefined && stored !== computed) mismatch++;
    const kind: LogKind = POMODORO_RE.test(notes) ? 'pomodoro' : 'import';
    const taskId = TASK_ID_RE.exec(desc)?.[1];
    events.push({
      t: 'log',
      id,
      u: nowMs,
      dev: IMPORT_DEVICE,
      a: new Date(a).toISOString(),
      b: new Date(b).toISOString(),
      p: path,
      ...(desc ? { d: desc } : {}),
      ...(notes ? { n: notes } : {}),
      k: kind,
      ...(taskId ? { i: taskId } : {}),
      ...(bad ? { bad: 1 as const } : {}),
      legacyId: oldId,
      ...(stored !== undefined && stored !== computed ? { legacyMinutes: stored } : {}),
    });
    const month = monthOf(a);
    minutesByMonth[month] = (minutesByMonth[month] ?? 0) + (bad ? 0 : computed);
  });

  return {
    events,
    report: {
      read: arr.length,
      imported: events.length,
      duplicates,
      alreadyImported,
      invalid,
      incoherent,
      durationMismatch: mismatch,
      minutesByMonth,
    },
  };
}

/** Minutos por mes de un arreglo v1 (para la verificación posterior). */
export function legacyMinutesByMonth(raw: unknown): Record<string, number> {
  return importLegacyLogs(raw, 0).report.minutesByMonth;
}

/**
 * Convierte el `activeTimer` / `activePomodoroSession` de v1 en una sesión en vivo si es reciente.
 * Devuelve null si no hay sesión, si es inválida o si supera `maxAgeHours` (el usuario decide).
 */
export function legacyLiveSession(raw: unknown, kind: 'timer' | 'pomodoro', nowMs: number, maxAgeHours: number, dev: string, id: string): LiveEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const start = typeof o['startTime'] === 'string' ? Date.parse(o['startTime']) : NaN;
  const path = kind === 'timer' ? o['taskNotePath'] : o['taskPath'];
  if (Number.isNaN(start) || typeof path !== 'string' || !path) return null;
  if (nowMs - start > maxAgeHours * 3_600_000 || start > nowMs) return null;
  const desc = typeof o['taskDescription'] === 'string' ? o['taskDescription'] : undefined;
  const notes = typeof o['notes'] === 'string' ? o['notes'] : undefined;
  const line = typeof o['lineNumber'] === 'number' ? o['lineNumber'] : undefined;
  const ev: LiveEvent = {
    t: 'live', id, u: nowMs, dev, k: kind, a: new Date(start).toISOString(), p: path,
    ...(desc ? { d: desc } : {}),
    ...(notes ? { n: notes } : {}),
    ...(line !== undefined ? { l: line } : {}),
    ...(kind === 'pomodoro'
      ? {
        ph: (['work', 'shortBreak', 'longBreak'].includes(String(o['type'])) ? o['type'] : 'work') as 'work' | 'shortBreak' | 'longBreak',
        pl: typeof o['duration'] === 'number' ? o['duration'] : 25,
        cy: typeof o['completedCycles'] === 'number' ? o['completedCycles'] : 0,
        ...(o['isOvertime'] === true && typeof o['overtimeStartTime'] === 'string' ? { ota: new Date(Date.parse(o['overtimeStartTime'])).toISOString() } : {}),
      }
      : {}),
  };
  return ev;
}
