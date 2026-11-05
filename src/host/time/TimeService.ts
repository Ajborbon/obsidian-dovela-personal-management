/**
 * Servicio único de tiempo: temporizador y Pomodoro (mutuamente excluyentes), registros
 * manuales, edición/borrado e importación del historial v1. Todas las escrituras son eventos.
 * La UI (barra de estado, modales, vistas) vive en `features/time/` y solo usa esta API.
 */
import type { App } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import type { DovelaSettings } from '../../core/settings';
import { newEventId, type LiveEvent, type LogEvent, type LogKind, type PomodoroPhase } from '../../core/time/events';
import { IMPORT_DEVICE, importLegacyLogs, legacyLiveSession, legacyMinutesByMonth, type LegacyReport } from '../../core/time/legacyImport';
import { durationMinutes, type LiveSession, type TimeLog, type TimeState } from '../../core/time/merge';
import { breakAfter, pomodoroNotes, workLogFor, type PomodoroRun } from '../../core/time/pomodoro';
import type { SettingsStore } from '../settingsStore';
import type { TaskWriter } from '../taskWriter';
import { EventLogStore } from './EventLogStore';

export interface TaskTarget {
  readonly path: string;
  /** Texto de la tarea o nombre de la nota. */
  readonly desc: string;
  readonly line?: number;
  /** Línea original de la tarea (si se trabaja sobre una tarea concreta). */
  readonly raw?: string;
  readonly taskId?: string;
}

export interface StopInput {
  readonly start: number;
  readonly end: number;
  readonly notes: string;
  readonly desc?: string;
  readonly path?: string;
  readonly closeTask: boolean;
}

export const TIME_SERVICE = 'time';

export class TimeService {
  readonly store: EventLogStore;

  constructor(
    private readonly app: App,
    private readonly settings: SettingsStore,
    private readonly tasks: TaskWriter,
    deviceId: string,
    private readonly now: () => Date,
    /** Carpeta del plugin (para leer el `timelogs.json` de versiones antiguas). */
    private readonly pluginDir: string,
  ) {
    this.store = new EventLogStore(app, () => settings.value.time.folder, deviceId, now);
  }

  get state(): TimeState {
    return this.store.state;
  }

  onChange(fn: (s: TimeState) => void): () => void {
    return this.store.onChange(fn);
  }

  ready(): Promise<void> {
    return this.store.ensureLoaded();
  }

  /** Sesión en vivo vigente (la más reciente si hubiera varias por dispositivos sin sincronizar). */
  current(): LiveSession | undefined {
    const live = this.state.live;
    return live[live.length - 1];
  }

  /** Sesiones simultáneas (conflicto entre dispositivos que no se vieron a tiempo). */
  concurrent(): readonly LiveSession[] {
    return this.state.live;
  }

  logs(): TimeLog[] {
    return [...this.state.logs.values()];
  }

  private id(): string {
    return newEventId(this.now().getTime());
  }

  private base(id: string): { id: string; u: number; dev: string } {
    return { id, u: this.store.nextU(), dev: this.store.deviceId };
  }

  private targetFields(t: TaskTarget): Pick<LiveEvent, 'p' | 'd' | 'l' | 'i' | 'raw'> {
    return {
      p: t.path,
      ...(t.desc ? { d: t.desc } : {}),
      ...(t.line !== undefined ? { l: t.line } : {}),
      ...(t.taskId ? { i: t.taskId } : {}),
      ...(t.raw ? { raw: t.raw } : {}),
    };
  }

  private busy(): boolean {
    if (this.current()) {
      new Notice('Dovela: ya hay un temporizador o Pomodoro en curso. Detenlo antes de iniciar otro.');
      return true;
    }
    return false;
  }

  private async putInProgress(t: TaskTarget): Promise<void> {
    if (t.raw === undefined) return;
    await this.tasks.markInProgress({ path: t.path, raw: t.raw, ...(t.line !== undefined ? { line: t.line } : {}), ...(t.taskId ? { id: t.taskId } : {}) }, true);
  }

  // ───────────── Temporizador ─────────────

  async startTimer(t: TaskTarget, notes = '', startMs?: number): Promise<LiveSession | null> {
    await this.ready();
    if (this.busy()) return null;
    const ev: LiveEvent = { t: 'live', ...this.base(this.id()), k: 'timer', a: new Date(startMs ?? this.now().getTime()).toISOString(), ...this.targetFields(t), ...(notes ? { n: notes } : {}) };
    await this.store.append([ev]);
    await this.putInProgress(t);
    return this.state.live.find((l) => l.id === ev.id) ?? null;
  }

  /** Modificar la sesión en curso (inicio y notas; v1). */
  async editLive(s: LiveSession, patch: { start?: number; notes?: string; desc?: string }): Promise<void> {
    if (patch.start !== undefined && patch.start > this.now().getTime()) {
      new Notice('Dovela: la hora de inicio no puede estar en el futuro.');
      return;
    }
    await this.store.append([this.liveEventFrom(s, patch)]);
  }

  private liveEventFrom(s: LiveSession, patch: { start?: number; notes?: string; desc?: string; phase?: PomodoroPhase; plannedMin?: number; cycles?: number; overtimeStart?: number | null }): LiveEvent {
    const overtime = patch.overtimeStart === null ? undefined : patch.overtimeStart ?? s.overtimeStart;
    return {
      t: 'live', ...this.base(s.id), k: s.kind, a: new Date(patch.start ?? s.start).toISOString(), p: s.path,
      ...((patch.desc ?? s.desc) ? { d: patch.desc ?? s.desc } : {}),
      ...((patch.notes ?? s.notes) ? { n: patch.notes ?? s.notes } : {}),
      ...(s.line !== undefined ? { l: s.line } : {}),
      ...(s.taskId ? { i: s.taskId } : {}),
      ...(s.raw ? { raw: s.raw } : {}),
      ...(s.kind === 'pomodoro'
        ? {
          ph: patch.phase ?? s.phase ?? 'work',
          pl: patch.plannedMin ?? s.plannedMin ?? this.settings.value.pomodoro.workDuration,
          cy: patch.cycles ?? s.cycles ?? 0,
          ...(overtime !== undefined ? { ota: new Date(overtime).toISOString() } : {}),
        }
        : {}),
    };
  }

  /**
   * Detener y registrar (un solo evento: el `log` con el mismo id cierra la sesión).
   * Conserva el tipo: una sesión Pomodoro se registra como `pomodoro` con sus notas automáticas.
   */
  async stopTimer(s: LiveSession, input: StopInput): Promise<boolean> {
    if (input.end < input.start) {
      new Notice('Dovela: la hora de fin es anterior a la de inicio.');
      return false;
    }
    const isPomo = s.kind === 'pomodoro';
    const planned = s.plannedMin ?? this.settings.value.pomodoro.workDuration;
    const total = Math.floor((input.end - input.start) / 60_000);
    const notes = isPomo ? pomodoroNotes(total, planned, 0, s.cycles ?? 0, input.notes) : input.notes;
    const ev: LogEvent = {
      t: 'log', ...this.base(s.id), a: new Date(input.start).toISOString(), b: new Date(input.end).toISOString(),
      p: input.path ?? s.path, k: isPomo ? 'pomodoro' : 'timer',
      ...((input.desc ?? s.desc) ? { d: input.desc ?? s.desc } : {}),
      ...(notes ? { n: notes } : {}),
      ...(s.line !== undefined ? { l: s.line } : {}),
      ...(s.taskId ? { i: s.taskId } : {}),
      ...(isPomo ? { pl: planned, cy: s.cycles ?? 0 } : {}),
    };
    await this.store.append([ev]);
    if (input.closeTask) await this.closeTaskOf(s);
    return true;
  }

  async cancel(s: LiveSession): Promise<void> {
    await this.store.append([{ t: 'cancel', ...this.base(s.id) }]);
  }

  async closeTaskOf(s: Pick<LiveSession, 'path' | 'raw' | 'line' | 'taskId'>): Promise<void> {
    if (s.raw === undefined && !s.taskId) return;
    await this.tasks.markDone({
      path: s.path,
      ...(s.raw !== undefined ? { raw: s.raw } : {}),
      ...(s.line !== undefined ? { line: s.line } : {}),
      ...(s.taskId ? { id: s.taskId } : {}),
    });
  }

  // ───────────── Registros ─────────────

  async addManual(t: TaskTarget, start: number, end: number, notes: string, kind: LogKind = 'manual'): Promise<boolean> {
    await this.ready();
    if (end < start) {
      new Notice('Dovela: la hora de fin es anterior a la de inicio.');
      return false;
    }
    await this.store.append([{
      t: 'log', ...this.base(this.id()), a: new Date(start).toISOString(), b: new Date(end).toISOString(),
      p: t.path, k: kind, ...(t.desc ? { d: t.desc } : {}), ...(notes ? { n: notes } : {}),
      ...(t.line !== undefined ? { l: t.line } : {}), ...(t.taskId ? { i: t.taskId } : {}),
    }]);
    return true;
  }

  async updateLog(log: TimeLog, patch: { start?: number; end?: number; notes?: string; desc?: string; path?: string }, duplicate = false): Promise<boolean> {
    const start = patch.start ?? log.start;
    const end = patch.end ?? log.end;
    if (end < start) {
      new Notice('Dovela: la hora de fin es anterior a la de inicio.');
      return false;
    }
    await this.store.append([this.logEventFrom(log, duplicate ? this.id() : log.id, { ...patch, start, end })]);
    return true;
  }

  async deleteLog(log: TimeLog): Promise<void> {
    await this.store.append([{ ...this.logEventFrom(log, log.id, {}), x: 1 }]);
  }

  private logEventFrom(log: TimeLog, id: string, patch: { start?: number; end?: number; notes?: string; desc?: string; path?: string }): LogEvent {
    const desc = patch.desc ?? log.desc;
    const notes = patch.notes ?? log.notes;
    return {
      t: 'log', ...this.base(id), a: new Date(patch.start ?? log.start).toISOString(), b: new Date(patch.end ?? log.end).toISOString(),
      p: patch.path ?? log.path, k: log.kind,
      ...(desc ? { d: desc } : {}), ...(notes ? { n: notes } : {}),
      ...(log.line !== undefined ? { l: log.line } : {}), ...(log.taskId ? { i: log.taskId } : {}),
      ...(log.plannedMin !== undefined ? { pl: log.plannedMin } : {}),
      ...(log.overtimeMin !== undefined ? { ot: log.overtimeMin } : {}),
      ...(log.cycle !== undefined ? { cy: log.cycle } : {}),
      ...(log.legacyId ? { legacyId: log.legacyId } : {}),
      ...(log.bad ? { bad: 1 as const } : {}),
    };
  }

  // ───────────── Pomodoro ─────────────

  run(s: LiveSession): PomodoroRun {
    return {
      phase: s.phase ?? 'work',
      start: s.start,
      plannedMin: s.plannedMin ?? this.settings.value.pomodoro.workDuration,
      cycles: s.cycles ?? 0,
      ...(s.overtimeStart !== undefined ? { overtimeStart: s.overtimeStart } : {}),
    };
  }

  private plannedFor(phase: PomodoroPhase): number {
    const p = this.settings.value.pomodoro;
    return phase === 'work' ? p.workDuration : phase === 'shortBreak' ? p.shortBreakDuration : p.longBreakDuration;
  }

  async startPomodoro(t: TaskTarget, phase: PomodoroPhase = 'work', cycles = 0): Promise<LiveSession | null> {
    await this.ready();
    if (this.busy()) return null;
    const ev: LiveEvent = {
      t: 'live', ...this.base(this.id()), k: 'pomodoro', a: this.now().toISOString(), ...this.targetFields(t),
      ph: phase, pl: this.plannedFor(phase), cy: cycles,
    };
    await this.store.append([ev]);
    if (phase === 'work') await this.putInProgress(t);
    return this.state.live.find((l) => l.id === ev.id) ?? null;
  }

  async enterOvertime(s: LiveSession): Promise<void> {
    const r = this.run(s);
    await this.store.append([this.liveEventFrom(s, { overtimeStart: r.start + r.plannedMin * 60_000 })]);
  }

  /**
   * Cierra la fase actual. Si es de trabajo, crea el registro (fin real según `workLogFor`).
   * Devuelve los ciclos completados tras cerrarla.
   */
  async finishPhase(s: LiveSession, userNotes: string, closeTask: boolean): Promise<number> {
    const r = this.run(s);
    const nowMs = this.now().getTime();
    if (r.phase !== 'work') {
      await this.store.append([{ t: 'cancel', ...this.base(s.id) }]);
      return r.cycles;
    }
    const plan = workLogFor(r, nowMs);
    if (!plan) return r.cycles;
    const total = Math.floor((plan.end - plan.start) / 60_000);
    if (total < 1) {
      await this.store.append([{ t: 'cancel', ...this.base(s.id) }]);
    } else {
      await this.store.append([{
        t: 'log', ...this.base(s.id), a: new Date(plan.start).toISOString(), b: new Date(plan.end).toISOString(),
        p: s.path, k: 'pomodoro', ...(s.desc ? { d: s.desc } : {}),
        n: pomodoroNotes(total, plan.plannedMin, plan.overtimeMin, plan.cycle, userNotes || s.notes),
        ...(s.line !== undefined ? { l: s.line } : {}), ...(s.taskId ? { i: s.taskId } : {}),
        pl: plan.plannedMin, ot: plan.overtimeMin, cy: plan.cycle,
      }]);
    }
    if (closeTask) await this.closeTaskOf(s);
    return plan.cycle;
  }

  /** Descanso tras un trabajo: conserva la tarea y los ciclos (defecto v1 4.7-2). */
  async startBreak(after: LiveSession, completedCycles: number, type?: 'shortBreak' | 'longBreak'): Promise<LiveSession | null> {
    const phase = type ?? breakAfter(completedCycles, this.settings.value.pomodoro.cyclesBeforeLongBreak);
    return this.startPomodoro({ path: after.path, desc: after.desc, ...(after.line !== undefined ? { line: after.line } : {}), ...(after.raw ? { raw: after.raw } : {}), ...(after.taskId ? { taskId: after.taskId } : {}) }, phase, completedCycles);
  }

  /** Nuevo trabajo con la misma tarea y los ciclos acumulados. */
  async startNextWork(after: LiveSession, completedCycles: number): Promise<LiveSession | null> {
    return this.startPomodoro({ path: after.path, desc: after.desc, ...(after.line !== undefined ? { line: after.line } : {}), ...(after.raw ? { raw: after.raw } : {}), ...(after.taskId ? { taskId: after.taskId } : {}) }, 'work', completedCycles);
  }

  // ───────────── Importación v1 ─────────────

  async importLegacy(): Promise<LegacyReport | null> {
    await this.ready();
    const s = this.settings.value;
    const sources: unknown[] = [];
    if (Array.isArray(s.legacy?.timeLogs)) sources.push(...s.legacy.timeLogs);
    const old = await this.readOldTimelogsJson();
    if (old) sources.push(...old);
    if (sources.length === 0) return null;
    const existingIds = new Set(this.state.logs.keys());
    const existingKeys = new Set(this.logs().map((l) => `${l.path}|${l.start}|${l.end}`));
    const { events, report } = importLegacyLogs(sources, this.now().getTime(), existingIds, existingKeys);
    // Un archivo por mes de inicio, propio del importador de este dispositivo.
    const byMonth = new Map<string, LogEvent[]>();
    for (const e of events) {
      const d = new Date(Date.parse(e.a));
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const arr = byMonth.get(m) ?? [];
      arr.push(e);
      byMonth.set(m, arr);
    }
    for (const [month, evs] of [...byMonth.entries()].sort()) await this.appendToMonth(month, evs);
    await this.importLegacyLive(s);
    this.settings.update((st) => {
      st.migration.importedAt = this.now().toISOString();
      st.migration.importedCount = (st.migration.importedCount ?? 0) + report.imported;
    });
    return report;
  }

  private async appendToMonth(month: string, events: LogEvent[]): Promise<void> {
    // Archivo dedicado al importador de este dispositivo: nadie más lo escribe.
    await this.store.append(events, { device: `${IMPORT_DEVICE}-${this.store.deviceId}`, month });
  }

  private async importLegacyLive(s: DovelaSettings): Promise<void> {
    if (this.current()) return;
    const nowMs = this.now().getTime();
    const hours = s.time.staleLiveHours;
    const timer = legacyLiveSession(s.legacy?.activeTimer, 'timer', nowMs, hours, this.store.deviceId, this.id());
    const pomo = timer ? null : legacyLiveSession(s.legacy?.activePomodoroSession, 'pomodoro', nowMs, hours, this.store.deviceId, this.id());
    const ev = timer ?? pomo;
    if (ev) await this.store.append([{ ...ev, u: this.store.nextU() }]);
  }

  private async readOldTimelogsJson(): Promise<unknown[] | null> {
    if (!this.pluginDir) return null;
    const path = `${this.pluginDir}/timelogs.json`;
    try {
      if (!(await this.app.vault.adapter.exists(path))) return null;
      const data: unknown = JSON.parse(await this.app.vault.adapter.read(path));
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  /** Compara minutos por mes del legado con los registros importados. */
  verifyImport(): { ok: boolean; rows: Array<{ month: string; legacy: number; imported: number }> } {
    const legacy = legacyMinutesByMonth(this.settings.value.legacy?.timeLogs ?? []);
    const imported: Record<string, number> = {};
    for (const l of this.logs()) {
      if (!l.legacyId || l.bad) continue;
      const d = new Date(l.start);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      imported[m] = (imported[m] ?? 0) + durationMinutes(l);
    }
    const months = [...new Set([...Object.keys(legacy), ...Object.keys(imported)])].sort();
    const rows = months.map((month) => ({ month, legacy: legacy[month] ?? 0, imported: imported[month] ?? 0 }));
    return { ok: rows.every((r) => r.imported >= r.legacy), rows };
  }

  /** Vacía `legacy.timeLogs` de data.json SOLO si la verificación es correcta (el respaldo v1 se conserva). */
  archiveLegacy(): boolean {
    if (!this.verifyImport().ok) return false;
    this.settings.update((s) => {
      if (s.legacy) {
        delete s.legacy.timeLogs;
        delete s.legacy.activeTimer;
        delete s.legacy.activePomodoroSession;
      }
      s.migration.archivedAt = this.now().toISOString();
    });
    return true;
  }

  /** Nota destino existe (para avisar de registros huérfanos). */
  pathExists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }
}
