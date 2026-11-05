/**
 * Controlador de la UI de tiempo: barra de estado única, reloj de 1 s compartido (barra + vistas
 * visibles), vigilancia del Pomodoro (fin de fase, overtime, auto‑inicio), avisos de sesiones
 * abandonadas o simultáneas y acciones comunes que usan comandos, ribbons y vistas.
 */
import { MarkdownView, Notice, TFile } from 'obsidian';
import type { DovelaContext } from '../../../context';
import { analyzeSelection } from '../../../core/tasks/edit';
import { expiredAction, noteName, runOf, statusBarInfo, type SessionMode } from '../../../core/time/display';
import { isStale, type LiveSession, type TimeLog } from '../../../core/time/merge';
import {
  isExpired, overtimeAlertDue, overtimeSeconds, phaseEnd, type PomodoroRun,
} from '../../../core/time/pomodoro';
import { logger } from '../../../host/logger';
import type { StopInput, TaskTarget, TimeService } from '../../../host/time/TimeService';
import type { Pick as TaskPick } from '../../../ui/TaskPickerModal';
import { alertUser, disposeAudio } from './alerts';
import { confirmAction, PomodoroEndModal, StaleSessionModal, TimeLogModal } from './modals';
import type { TimeTab } from './tabs';

export const TIME_UI = 'time-ui';

export type Ticker = (now: number) => void;

export function getTimeUi(ctx: DovelaContext): TimeUi | undefined {
  const ui = ctx.services.get(TIME_UI);
  return ui instanceof TimeUi ? ui : undefined;
}

export class TimeUi {
  private bar: HTMLElement | null = null;
  private barMode: SessionMode | null = null;
  private readonly tickers = new Set<Ticker>();
  private readonly expiredHandled = new Set<string>();
  private readonly lastAlert = new Map<string, number>();
  private readonly staleHandled = new Set<string>();
  private concurrentKey = '';
  private decision: { id: string; modal: PomodoroEndModal } | null = null;
  /** Abre la vista de tiempo (se inyecta desde `index.ts` para evitar dependencias circulares). */
  openView: (tab?: TimeTab) => Promise<void> = async () => undefined;

  constructor(
    readonly ctx: DovelaContext,
    readonly service: TimeService,
  ) {}

  get app(): DovelaContext['app'] {
    return this.ctx.app;
  }

  now(): number {
    return this.ctx.now().getTime();
  }

  start(): void {
    const plugin = this.ctx.plugin;
    const bar = plugin.addStatusBarItem();
    bar.addClass('dovela-time-bar', 'mod-clickable');
    bar.hide();
    plugin.registerDomEvent(bar, 'click', () => this.onBarClick());
    this.bar = bar;
    plugin.registerInterval(window.setInterval(() => this.tick(), 1000));
    const off = this.service.onChange(() => this.tick());
    plugin.register(() => {
      off();
      this.decision?.modal.close();
      disposeAudio();
    });
    this.service.ready().then(() => this.tick()).catch((e: unknown) => logger.error("Registro de tiempo no disponible", e));
  }

  /** Suscribe una vista al reloj de 1 s. */
  onTick(fn: Ticker): () => void {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  isOwner(s: LiveSession): boolean {
    return s.dev === this.service.store.deviceId;
  }

  liveById(id: string): LiveSession | undefined {
    return this.service.state.live.find((l) => l.id === id);
  }

  isLive(id: string): boolean {
    return this.liveById(id) !== undefined;
  }

  run(s: LiveSession): PomodoroRun {
    return runOf(s, this.ctx.settings.value.pomodoro.workDuration);
  }

  mode(s: LiveSession, now = this.now()): SessionMode {
    const info = statusBarInfo(s, now, this.ctx.settings.value.pomodoro.workDuration, this.ctx.settings.value.pomodoro.cyclesBeforeLongBreak);
    return info.mode;
  }

  // ───────────── Reloj ─────────────

  private tick(): void {
    const now = this.now();
    try {
      this.updateBar(now);
      this.watch(now);
    } catch (e) {
      logger.error('Error en el reloj de tiempo', e);
    }
    for (const fn of this.tickers) {
      try {
        fn(now);
      } catch (e) {
        logger.error('Error al refrescar una vista de tiempo', e);
      }
    }
  }

  private updateBar(now: number): void {
    const bar = this.bar;
    if (!bar) return;
    const s = this.service.current();
    if (!s) {
      if (this.barMode !== null) {
        bar.hide();
        bar.setText('');
        bar.removeClass('is-overtime', 'is-decide', 'is-break');
        this.barMode = null;
      }
      return;
    }
    const p = this.ctx.settings.value.pomodoro;
    const info = statusBarInfo(s, now, p.workDuration, p.cyclesBeforeLongBreak, {
      stale: isStale(s, now, this.ctx.settings.value.time.staleLiveHours),
      concurrent: this.service.concurrent().length,
    });
    bar.setText(info.text);
    bar.setAttr('aria-label', info.tooltip);
    bar.setAttr('data-tooltip-position', 'top');
    if (info.mode !== this.barMode) {
      bar.toggleClass('is-overtime', info.mode === 'overtime');
      bar.toggleClass('is-decide', info.mode === 'decide');
      bar.toggleClass('is-break', info.mode === 'break');
      bar.show();
      this.barMode = info.mode;
    }
  }

  private onBarClick(): void {
    const s = this.service.current();
    if (s && this.mode(s) === 'decide') {
      this.openDecision(s, 'expired');
      return;
    }
    void this.openView('tracker');
  }

  private watch(now: number): void {
    if (!this.service.store.loaded) return;
    const live = this.service.state.live;
    const p = this.ctx.settings.value.pomodoro;
    // 1) Sesiones abandonadas: tienen prioridad sobre el fin de fase (registrar "hasta…" es lo correcto).
    const staleHours = this.ctx.settings.value.time.staleLiveHours;
    for (const l of live) {
      if (!this.staleHandled.has(l.id) && isStale(l, now, staleHours)) {
        this.staleHandled.add(l.id);
        this.expiredHandled.add(l.id);
        new StaleSessionModal(this, l).open();
      }
    }
    // 2) Pomodoro: fin de fase y alertas de overtime.
    const s = this.service.current();
    if (s?.kind === 'pomodoro') {
      const r = this.run(s);
      if (isExpired(r, now) && !this.expiredHandled.has(s.id)) {
        this.expiredHandled.add(s.id);
        this.onExpired(s, r, now);
      }
      if (r.overtimeStart !== undefined) {
        // La primera alerta llega un intervalo después de ver el overtime (no al instante tras decidir).
        if (!this.lastAlert.has(s.id)) this.lastAlert.set(s.id, Math.max(r.overtimeStart, now - 1000));
        if (overtimeAlertDue(r, now, this.lastAlert.get(s.id), p.overtimeAlertInterval)) {
          this.lastAlert.set(s.id, now);
          const min = Math.floor(overtimeSeconds(r, now) / 60);
          alertUser(p, '🔴 Overtime', `Llevas ${min} min de overtime en «${noteName(s.path) || 'la sesión'}». ¿Un descanso?`);
        }
      }
    }
    // 3) Sesiones simultáneas (dos dispositivos que no se vieron a tiempo).
    const key = live.length > 1 ? live.map((l) => l.id).sort().join('|') : '';
    if (key && key !== this.concurrentKey) {
      new Notice(`Dovela: hay ${live.length} sesiones de tiempo abiertas a la vez (probablemente en distintos dispositivos). Revísalas en Tiempo → Seguimiento.`, 10_000);
    }
    this.concurrentKey = key;
  }

  private onExpired(s: LiveSession, r: PomodoroRun, now: number): void {
    const p = this.ctx.settings.value.pomodoro;
    const sinceEnd = now - phaseEnd(r);
    const name = noteName(s.path) || 'la sesión';
    const title = r.phase === 'work' ? '🍅 ¡Pomodoro completado!' : '☕ Descanso terminado';
    const action = expiredAction(r.phase, p, sinceEnd, this.isOwner(s));
    if (sinceEnd < 5 * 60_000) {
      const body = action === 'auto'
        ? (r.phase === 'work' ? `Empieza el descanso (${name}).` : `De vuelta al trabajo: ${name}.`)
        : `«${name}»: decide cómo seguir.`;
      alertUser(p, title, body);
    }
    if (action === 'auto') void this.autoContinue(s, r);
    else if (action === 'modal') this.openDecision(s, 'expired');
    else new Notice(`Dovela: ${title} (sesión iniciada en otro dispositivo). Toca la barra o abre Seguimiento para decidir.`, 8000);
  }

  private async autoContinue(s: LiveSession, r: PomodoroRun): Promise<void> {
    try {
      if (r.phase === 'work') {
        const cycles = await this.service.finishPhase(s, '', false);
        await this.service.startBreak(s, cycles);
      } else {
        await this.service.finishPhase(s, '', false);
        await this.service.startNextWork(s, r.cycles);
      }
    } catch (e) {
      logger.error('No se pudo continuar el Pomodoro automáticamente', e);
      new Notice('Dovela: no se pudo continuar el Pomodoro automáticamente.');
    }
  }

  // ───────────── Objetivo (nota/tarea) ─────────────

  /**
   * Objetivo desde el editor activo (v1 `startTrackingWithSelectionDetection`):
   * selección vacía → nota; una línea de tarea abierta → tarea; multilínea o no‑tarea → error.
   */
  targetFromActive(): TaskTarget | { error: string } | null {
    const ws = this.app.workspace;
    const view = ws.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? ws.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') return null;
    const note: TaskTarget = { path: file.path, desc: file.basename };
    if (!view || view.file !== file || view.getMode() !== 'source') return note;
    const ed = view.editor;
    const from = ed.getCursor('from');
    const to = ed.getCursor('to');
    // Seleccionar una línea entera con triple clic deja el cursor al inicio de la siguiente.
    const toLine = to.line > from.line && to.ch === 0 ? to.line - 1 : to.line;
    const a = analyzeSelection(ed.getSelection(), from.line, toLine, ed.getLine(from.line));
    if (a.kind === 'note') return note;
    if (a.kind === 'error') return { error: a.message };
    return { path: file.path, desc: a.text, line: a.line, raw: a.raw, ...(a.id ? { taskId: a.id } : {}) };
  }

  activeNoteTarget(): TaskTarget | null {
    const f = this.app.workspace.getActiveFile();
    return f instanceof TFile && f.extension === 'md' ? { path: f.path, desc: f.basename } : null;
  }

  targetFromPick(p: TaskPick): TaskTarget {
    if (p.kind === 'note') return { path: p.path, desc: p.basename };
    const t = p.task;
    return { path: t.path, desc: t.text, line: t.line, raw: t.raw, ...(t.id ? { taskId: t.id } : {}) };
  }

  private resolveActive(): TaskTarget | null {
    const t = this.targetFromActive();
    if (t === null) {
      new Notice('Dovela: abre una nota (o selecciona una tarea) para iniciar el registro.');
      return null;
    }
    if ('error' in t) {
      new Notice(`Dovela: ${t.error}`);
      return null;
    }
    return t;
  }

  // ───────────── Acciones ─────────────

  async startTimer(target: TaskTarget | null = this.resolveActive()): Promise<void> {
    if (!target) return;
    const s = await this.service.startTimer(target);
    if (s) new Notice(`⏱️ Temporizador iniciado: ${target.desc || noteName(target.path)}`);
  }

  async startPomodoro(target: TaskTarget | null = this.resolveActive()): Promise<void> {
    if (!target) return;
    const s = await this.service.startPomodoro(target);
    if (s) new Notice(`🍅 Pomodoro de ${s.plannedMin ?? this.ctx.settings.value.pomodoro.workDuration} min: ${target.desc || noteName(target.path)}`);
  }

  /** Iniciar descanso: tras un trabajo en curso lo cierra y empieza el descanso sugerido. */
  async startBreak(): Promise<void> {
    const s = this.service.current();
    if (s?.kind === 'timer') {
      new Notice('Dovela: detén el temporizador antes de iniciar un descanso.');
      return;
    }
    if (s && (s.phase ?? 'work') !== 'work') {
      new Notice('Dovela: ya estás en un descanso.');
      return;
    }
    if (s) {
      const cycles = await this.service.finishPhase(s, '', false);
      await this.service.startBreak(s, cycles);
      return;
    }
    const t = this.activeNoteTarget() ?? { path: '', desc: 'Descanso' };
    await this.service.startPomodoro(t, 'shortBreak', 0);
  }

  /** Detener: temporizador → modal de registro; Pomodoro → modal de fin (registra el trabajo). */
  requestStop(s: LiveSession | undefined = this.service.current()): void {
    if (!s) {
      new Notice('Dovela: no hay ninguna sesión en curso.');
      return;
    }
    if (s.kind === 'pomodoro') this.openDecision(s, this.mode(s) === 'decide' ? 'expired' : 'stop');
    else new TimeLogModal(this, { kind: 'stop', session: s }).open();
  }

  requestCancel(s: LiveSession | undefined = this.service.current()): void {
    if (!s) {
      new Notice('Dovela: no hay ninguna sesión en curso.');
      return;
    }
    const what = s.kind === 'timer' ? 'el temporizador' : 'el Pomodoro';
    confirmAction(this.app, 'Cancelar sesión', `¿Descartar ${what} de «${noteName(s.path) || 'sin nota'}» sin registrar el tiempo transcurrido?`, 'Descartar sin registrar', async () => {
      if (!this.isLive(s.id)) return;
      await this.service.cancel(s);
      new Notice('Dovela: sesión descartada sin registro.');
    });
  }

  editLive(s: LiveSession | undefined = this.service.current()): void {
    if (!s) {
      new Notice('Dovela: no hay ninguna sesión en curso.');
      return;
    }
    new TimeLogModal(this, { kind: 'live', session: s }).open();
  }

  openManual(prefill: { target?: TaskTarget; start?: number; end?: number } = {}): void {
    const target = prefill.target ?? this.activeNoteTarget() ?? undefined;
    new TimeLogModal(this, {
      kind: 'manual',
      ...(target ? { target } : {}),
      ...(prefill.start !== undefined ? { start: prefill.start } : {}),
      ...(prefill.end !== undefined ? { end: prefill.end } : {}),
    }).open();
  }

  editLog(log: TimeLog): void {
    new TimeLogModal(this, { kind: 'edit', log }).open();
  }

  openStopUntil(s: LiveSession, end: number): void {
    new TimeLogModal(this, { kind: 'stop', session: s, end }).open();
  }

  openDecision(s: LiveSession, reason: 'expired' | 'stop'): void {
    if (this.decision?.id === s.id) return;
    this.decision?.modal.close();
    const modal = new PomodoroEndModal(this, s, reason, () => {
      if (this.decision?.modal === modal) this.decision = null;
    });
    this.decision = { id: s.id, modal };
    modal.open();
  }

  /** Cierra una sesión con un registro (un único evento `log`; TimeService conserva el tipo). */
  stopSession(s: LiveSession, input: StopInput): Promise<boolean> {
    return this.service.stopTimer(s, input);
  }
}
