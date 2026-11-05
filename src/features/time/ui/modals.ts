/**
 * Modales nativos de tiempo:
 * - `TimeLogModal`: detener y registrar, registro manual, editar registro, modificar sesión en curso.
 * - `PomodoroEndModal`: fin (o detención) de una fase de Pomodoro.
 * - `StaleSessionModal`: sesión abierta demasiado tiempo.
 * - `confirmAction`: confirmación para acciones destructivas.
 */
import { Modal, Notice, Platform, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { formatDuration } from '../../../core/duration';
import { pomodoroEndPlan, noteName } from '../../../core/time/display';
import { checkLiveStart, checkRange, resolveField, splitLocal, type RangeCheck } from '../../../core/time/forms';
import { durationMinutes, type LiveSession, type TimeLog } from '../../../core/time/merge';
import { phaseEnd } from '../../../core/time/pomodoro';
import { pomodoroStats } from '../../../core/time/stats';
import { toLocalHm, toLocalYmd } from '../../../core/dates';
import { logger } from '../../../host/logger';
import { openNote } from '../../../host/navigation';
import type { TaskTarget } from '../../../host/time/TimeService';
import { TaskPickerModal } from '../../../ui/TaskPickerModal';
import type { TimeUi } from './controller';

// ───────────── Confirmación ─────────────

class ConfirmModal extends Modal {
  private done = false;

  constructor(
    app: App,
    private readonly titleText: string,
    private readonly message: string,
    private readonly confirmText: string,
    private readonly onConfirm: () => void | Promise<void>,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.titleText);
    this.contentEl.addClass('dovela-time-modal');
    this.contentEl.createEl('p', { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText('Volver').onClick(() => this.close()))
      .addButton((b) => b.setButtonText(this.confirmText).setWarning().onClick(() => {
        if (this.done) return;
        this.done = true;
        this.close();
        void Promise.resolve(this.onConfirm()).catch((e: unknown) => {
          logger.error('Acción confirmada fallida', e);
          new Notice('Dovela: no se pudo completar la acción.');
        });
      }));
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

export function confirmAction(app: App, title: string, message: string, confirmText: string, onConfirm: () => void | Promise<void>): void {
  new ConfirmModal(app, title, message, confirmText, onConfirm).open();
}

// ───────────── Registro / detención / edición ─────────────

export type LogModalInit =
  | { readonly kind: 'stop'; readonly session: LiveSession; readonly end?: number }
  | { readonly kind: 'manual'; readonly target?: TaskTarget; readonly start?: number; readonly end?: number }
  | { readonly kind: 'edit'; readonly log: TimeLog }
  | { readonly kind: 'live'; readonly session: LiveSession };

interface DateTimeInputs {
  readonly date: HTMLInputElement;
  readonly time: HTMLInputElement;
}

function hasTask(t: { raw?: string | undefined; taskId?: string | undefined } | null | undefined): boolean {
  return !!t && (t.raw !== undefined || !!t.taskId);
}

export class TimeLogModal extends Modal {
  private target: TaskTarget | null;
  private readonly origStart: number | undefined;
  private readonly origEnd: number | undefined;
  private start: DateTimeInputs | null = null;
  private end: DateTimeInputs | null = null;
  private notesEl!: HTMLTextAreaElement;
  private statusEl!: HTMLElement;
  private taskDescEl: HTMLElement | null = null;
  private closeRow: Setting | null = null;
  private closeTask: boolean;
  private busy = false;

  constructor(
    private readonly ui: TimeUi,
    private readonly init: LogModalInit,
  ) {
    super(ui.app);
    const now = ui.now();
    switch (init.kind) {
      case 'stop':
        this.target = init.session;
        this.origStart = init.session.start;
        this.origEnd = init.end ?? now;
        break;
      case 'manual':
        this.target = init.target ?? null;
        this.origStart = init.start ?? now - 30 * 60_000;
        this.origEnd = init.end ?? now;
        break;
      case 'edit':
        this.target = { path: init.log.path, desc: init.log.desc, ...(init.log.taskId ? { taskId: init.log.taskId } : {}) };
        this.origStart = init.log.start;
        this.origEnd = init.log.end;
        break;
      case 'live':
        this.target = init.session;
        this.origStart = init.session.start;
        this.origEnd = undefined;
        break;
    }
    this.closeTask = ui.ctx.settings.value.time.closeTaskByDefault;
  }

  override onOpen(): void {
    const { contentEl } = this;
    const k = this.init.kind;
    this.setTitle(k === 'stop' ? '⏹️ Detener y registrar' : k === 'manual' ? '➕ Registrar tiempo' : k === 'edit' ? '✏️ Editar registro' : '✏️ Modificar sesión en curso');
    contentEl.addClass('dovela', 'dovela-time-modal');

    this.renderTask(contentEl);

    const isPomodoroLive = k === 'live' && this.init.session.kind === 'pomodoro';
    if (!isPomodoroLive) {
      this.start = this.dateTimeRow(contentEl, 'Inicio', this.origStart);
    }
    if (k !== 'live') this.end = this.dateTimeRow(contentEl, 'Fin', this.origEnd, 'Puede ser otro día (cruza medianoche).');
    this.statusEl = contentEl.createDiv({ cls: 'dovela-time-modal-status' });

    contentEl.createEl('label', { cls: 'dovela-time-modal-label', text: 'Notas' });
    this.notesEl = contentEl.createEl('textarea', { cls: 'dovela-time-notes', attr: { rows: '4', placeholder: 'Qué hiciste, avances, bloqueos…' } });
    this.notesEl.value = k === 'edit' ? this.init.log.notes : k === 'manual' ? '' : this.init.session.notes;

    if (k === 'stop' || k === 'manual') {
      this.closeRow = new Setting(contentEl)
        .setName('Cerrar tarea')
        .setDesc('Marca la tarea como hecha (✅ fecha de hoy). No lo uses en tareas recurrentes 🔁.')
        .addToggle((t) => t.setValue(this.closeTask).onChange((v) => (this.closeTask = v)));
      this.updateCloseVisibility();
    }

    const buttons = new Setting(contentEl).setClass('dovela-time-modal-buttons');
    if (k === 'stop') {
      buttons.addButton((b) => b.setButtonText('Cancelar registro').setWarning().setTooltip('Descarta el tiempo sin registrarlo').onClick(() => this.cancelSession()));
    }
    if (k === 'edit') {
      buttons.addButton((b) => b.setButtonText('Eliminar').setWarning().onClick(() => this.deleteLog()));
    }
    buttons.addButton((b) => b.setButtonText('Cancelar').setTooltip(k === 'stop' ? 'Cierra; la sesión sigue en curso' : '').onClick(() => this.close()));
    buttons.addButton((b) => b.setButtonText('Guardar').setCta().onClick(() => void this.save()));

    this.validate();
    if (!Platform.isMobile) window.setTimeout(() => this.notesEl.focus(), 0);
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private renderTask(el: HTMLElement): void {
    const row = new Setting(el).setName(this.init.kind === 'manual' ? 'Tarea o nota' : 'Tarea');
    row.settingEl.addClass('dovela-time-modal-task');
    this.taskDescEl = row.descEl;
    this.renderTaskDesc();
    if (this.init.kind === 'manual') {
      row.addButton((b) => b.setButtonText(this.target ? 'Cambiar…' : 'Elegir…').onClick(() => {
        new TaskPickerModal(this.app, this.ui.ctx.index.store, (p) => {
          this.target = this.ui.targetFromPick(p);
          b.setButtonText('Cambiar…');
          this.renderTaskDesc();
          this.updateCloseVisibility();
          this.validate();
        }).open();
      }));
    } else if (this.target?.path) {
      const t = this.target;
      row.addExtraButton((b) => b.setIcon('arrow-up-right').setTooltip('Ir a la nota').onClick(() => {
        void openNote(this.app, t.path, t.line);
      }));
    }
  }

  private renderTaskDesc(): void {
    const el = this.taskDescEl;
    if (!el) return;
    el.empty();
    const t = this.target;
    if (!t) {
      el.createSpan({ cls: 'dovela-time-error', text: 'Sin tarea: elige una tarea o nota.' });
      return;
    }
    const name = noteName(t.path);
    if (t.desc && t.desc !== name) el.createDiv({ text: `📌 ${t.desc}` });
    el.createDiv({ cls: 'dovela-muted', text: `📄 ${name || '(sin nota)'}` });
  }

  private updateCloseVisibility(): void {
    if (!this.closeRow) return;
    this.closeRow.settingEl.toggle(hasTask(this.target));
  }

  private dateTimeRow(el: HTMLElement, name: string, value: number | undefined, desc = ''): DateTimeInputs {
    const parts = value !== undefined ? splitLocal(value) : { date: '', time: '' };
    let date!: HTMLInputElement;
    let time!: HTMLInputElement;
    new Setting(el).setName(name).setDesc(desc).setClass('dovela-time-dt')
      .addText((t) => {
        date = t.inputEl;
        date.type = 'date';
        t.setValue(parts.date).onChange(() => this.validate());
      })
      .addText((t) => {
        time = t.inputEl;
        time.type = 'time';
        t.setValue(parts.time).onChange(() => this.validate());
      });
    return { date, time };
  }

  private values(): { start: number | null; end: number | null } {
    const start = this.start ? resolveField(this.origStart, this.start.date.value, this.start.time.value) : this.origStart ?? null;
    const end = this.end ? resolveField(this.origEnd, this.end.date.value, this.end.time.value) : null;
    return { start, end };
  }

  private validate(): RangeCheck {
    const { start, end } = this.values();
    const now = this.ui.now();
    const r = this.init.kind === 'live' ? checkLiveStart(start, now) : checkRange(start, end, now);
    this.statusEl.empty();
    this.statusEl.removeClass('is-error');
    if (!r.ok) {
      this.statusEl.addClass('is-error');
      this.statusEl.setText(r.error ?? 'Datos no válidos.');
    } else {
      this.statusEl.createSpan({ text: `${this.init.kind === 'live' ? 'Transcurrido' : 'Duración'}: ${r.duration ?? ''}` });
      if (r.warning) this.statusEl.createSpan({ cls: 'dovela-time-warning', text: ` · ⚠️ ${r.warning}` });
    }
    return r;
  }

  private async save(): Promise<void> {
    if (this.busy) return;
    const check = this.validate();
    if (!check.ok) return;
    const { start, end } = this.values();
    const notes = this.notesEl.value.trim();
    this.busy = true;
    try {
      const ok = await this.persist(start, end, notes);
      if (ok) this.close();
    } catch (e) {
      logger.error('No se pudo guardar el registro de tiempo', e);
      new Notice('Dovela: no se pudo guardar el registro (revisa la consola).');
    } finally {
      this.busy = false;
    }
  }

  private async persist(start: number | null, end: number | null, notes: string): Promise<boolean> {
    const svc = this.ui.service;
    const init = this.init;
    switch (init.kind) {
      case 'stop': {
        if (start === null || end === null) return false;
        if (!this.ui.isLive(init.session.id)) {
          new Notice('Dovela: la sesión ya se cerró (quizá en otro dispositivo).');
          return true;
        }
        const ok = await this.ui.stopSession(init.session, { start, end, notes, closeTask: this.closeTask && hasTask(init.session) });
        if (ok) new Notice(`Dovela: registrado ${formatDuration(Math.floor((end - start) / 60_000))}.`);
        return ok;
      }
      case 'manual': {
        if (start === null || end === null) return false;
        const t = this.target;
        if (!t) {
          new Notice('Dovela: elige una tarea o nota.');
          return false;
        }
        const ok = await svc.addManual(t, start, end, notes);
        if (ok && this.closeTask && hasTask(t)) await svc.closeTaskOf(t);
        if (ok) new Notice(`Dovela: registrado ${formatDuration(Math.floor((end - start) / 60_000))}.`);
        return ok;
      }
      case 'edit': {
        if (start === null || end === null) return false;
        return svc.updateLog(init.log, { start, end, notes });
      }
      case 'live': {
        const s = this.ui.liveById(init.session.id);
        if (!s) {
          new Notice('Dovela: la sesión ya se cerró (quizá en otro dispositivo).');
          return true;
        }
        await svc.editLive(s, { ...(this.start && start !== null && start !== s.start ? { start } : {}), notes });
        return true;
      }
    }
  }

  private cancelSession(): void {
    if (this.init.kind !== 'stop') return;
    const s = this.init.session;
    confirmAction(this.app, 'Cancelar registro', `¿Descartar el tiempo de «${noteName(s.path)}» sin registrarlo? No se puede deshacer.`, 'Descartar', async () => {
      if (this.ui.isLive(s.id)) await this.ui.service.cancel(s);
      new Notice('Dovela: sesión descartada sin registro.');
      this.close();
    });
  }

  private deleteLog(): void {
    if (this.init.kind !== 'edit') return;
    const log = this.init.log;
    confirmAction(this.app, 'Eliminar registro', `¿Eliminar el registro de ${formatDuration(durationMinutes(log))} del ${toLocalYmd(new Date(log.start))} (${noteName(log.path)})?`, 'Eliminar', async () => {
      await this.ui.service.deleteLog(log);
      new Notice('Dovela: registro eliminado.');
      this.close();
    });
  }
}

// ───────────── Fin de Pomodoro ─────────────

export class PomodoroEndModal extends Modal {
  private decided = false;
  private notesEl: HTMLTextAreaElement | null = null;
  private closeTask = false;
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(
    private readonly ui: TimeUi,
    private readonly session: LiveSession,
    private readonly reason: 'expired' | 'stop',
    private readonly onClosed: () => void,
  ) {
    super(ui.app);
  }

  override onOpen(): void {
    const s = this.session;
    const ui = this.ui;
    const p = ui.ctx.settings.value.pomodoro;
    const now = ui.now();
    const r = ui.run(s);
    const plan = pomodoroEndPlan(r, now, p.cyclesBeforeLongBreak);
    const isWork = r.phase === 'work';
    const { contentEl } = this;
    contentEl.addClass('dovela', 'dovela-time-modal', 'dovela-pomodoro-modal');

    if (isWork) {
      this.setTitle(this.reason === 'stop' ? '⏹️ Detener Pomodoro'
        : r.overtimeStart !== undefined ? '🔴 Fin del overtime' : '🍅 ¡Pomodoro completado!');
    } else {
      this.setTitle(this.reason === 'stop' ? '⏹️ Detener descanso' : '☕ Descanso terminado');
    }

    const info = contentEl.createDiv({ cls: 'dovela-pomodoro-info' });
    const name = noteName(s.path);
    if (name) {
      const noteRow = info.createDiv();
      noteRow.createSpan({ text: `📄 ${name} ` });
      const link = noteRow.createEl('a', { text: 'abrir', href: '#' });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        void openNote(this.app, s.path, s.line);
      });
    }
    if (s.desc && s.desc !== name) info.createDiv({ text: `📌 ${s.desc}` });
    const today = ui.ctx.today();
    const todayCount = pomodoroStats(ui.service.logs(), today).todaySessions;
    if (isWork) {
      const elapsed = Math.floor((Math.min(now, r.overtimeStart !== undefined ? now : phaseEnd(r)) - r.start) / 60_000);
      info.createDiv({ text: `Pomodoro ${plan.round.current} de ${plan.round.of} · ${formatDuration(elapsed)} de ${r.plannedMin} min` });
      info.createDiv({ cls: 'dovela-muted', text: `Ciclos completados en esta sesión: ${plan.completedCycles} · Pomodoros registrados hoy: ${todayCount}` });
      contentEl.createEl('label', { cls: 'dovela-time-modal-label', text: 'Notas de la sesión' });
      this.notesEl = contentEl.createEl('textarea', { cls: 'dovela-time-notes', attr: { rows: '3' } });
      this.notesEl.value = s.notes;
      if (hasTask(s)) {
        new Setting(contentEl).setName('Cerrar tarea')
          .setDesc('Marca la tarea como hecha al registrar.')
          .addToggle((t) => t.setValue(false).onChange((v) => (this.closeTask = v)));
      }
    } else {
      info.createDiv({ text: `${r.phase === 'longBreak' ? 'Descanso largo' : 'Descanso corto'} · ${r.plannedMin} min · ciclos completados: ${r.cycles}` });
    }

    const actions = contentEl.createDiv({ cls: 'dovela-pomodoro-actions' });
    const btn = (text: string, fn: () => Promise<unknown>, cls?: 'mod-cta' | 'mod-warning'): void => {
      const b = actions.createEl('button', { text, cls: cls ?? '' });
      this.buttons.push(b);
      b.addEventListener('click', () => void this.act(fn));
    };
    const svc = ui.service;
    const label = (t: 'shortBreak' | 'longBreak'): string => t === 'longBreak' ? `🌴 Descanso largo (${p.longBreakDuration} min)` : `☕ Descanso corto (${p.shortBreakDuration} min)`;
    if (isWork) {
      const other = plan.suggestedBreak === 'longBreak' ? 'shortBreak' : 'longBreak';
      btn(label(plan.suggestedBreak), async () => svc.startBreak(s, await svc.finishPhase(s, this.notes(), this.closeTask), plan.suggestedBreak), 'mod-cta');
      btn(label(other), async () => svc.startBreak(s, await svc.finishPhase(s, this.notes(), this.closeTask), other));
      btn(`🍅 Otro pomodoro (${p.workDuration} min)`, async () => svc.startNextWork(s, await svc.finishPhase(s, this.notes(), this.closeTask)));
      if (plan.canOvertime) {
        btn('🔴 Seguir trabajando (overtime)', async () => {
          const notes = this.notes();
          if (notes !== s.notes) await svc.editLive(s, { notes });
          await svc.enterOvertime(ui.liveById(s.id) ?? s);
        });
      }
      btn('⏹️ Finalizar sesión', async () => svc.finishPhase(s, this.notes(), this.closeTask), 'mod-warning');
    } else {
      btn(`🍅 Volver al trabajo (${p.workDuration} min)`, async () => {
        await svc.finishPhase(s, '', false);
        return svc.startNextWork(s, r.cycles);
      }, 'mod-cta');
      btn(label('shortBreak'), async () => {
        await svc.finishPhase(s, '', false);
        return svc.startBreak(s, r.cycles, 'shortBreak');
      });
      btn(label('longBreak'), async () => {
        await svc.finishPhase(s, '', false);
        return svc.startBreak(s, r.cycles, 'longBreak');
      });
      btn('⏹️ Finalizar', async () => svc.finishPhase(s, '', false), 'mod-warning');
    }
    if (this.reason === 'stop') {
      const keep = actions.createEl('button', { text: 'Seguir con la sesión' });
      keep.addEventListener('click', () => this.close());
    }
    contentEl.createDiv({
      cls: 'dovela-muted',
      text: this.reason === 'expired'
        ? 'Si cierras esta ventana la sesión queda en “⏰ decidir”: toca la barra de estado o abre Seguimiento para volver aquí.'
        : 'El trabajo se registra hasta ahora (o hasta el fin planificado si ya se cumplió).',
    });
  }

  private notes(): string {
    return this.notesEl?.value.trim() ?? '';
  }

  private async act(fn: () => Promise<unknown>): Promise<void> {
    if (this.decided) return;
    if (!this.ui.isLive(this.session.id)) {
      new Notice('Dovela: la sesión ya se cerró (quizá en otro dispositivo).');
      this.close();
      return;
    }
    this.decided = true;
    this.buttons.forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (e) {
      logger.error('Acción de Pomodoro fallida', e);
      new Notice('Dovela: no se pudo completar la acción del Pomodoro.');
    }
    this.close();
  }

  override onClose(): void {
    this.contentEl.empty();
    this.onClosed();
  }
}

// ───────────── Sesión abandonada ─────────────

export class StaleSessionModal extends Modal {
  constructor(
    private readonly ui: TimeUi,
    private readonly session: LiveSession,
  ) {
    super(ui.app);
  }

  override onOpen(): void {
    const s = this.session;
    const ui = this.ui;
    const hours = Math.floor((ui.now() - s.start) / 3_600_000);
    const startDate = new Date(s.start);
    this.setTitle('⚠️ Sesión abierta hace mucho');
    const { contentEl } = this;
    contentEl.addClass('dovela', 'dovela-time-modal');
    contentEl.createEl('p', {
      text: `${s.kind === 'timer' ? 'El temporizador' : 'El Pomodoro'} de «${noteName(s.path) || 'sin nota'}» está abierto desde el ${toLocalYmd(startDate)} a las ${toLocalHm(startDate)} (${hours} h). ` +
        `Puede que lo olvidaras o que otro dispositivo no llegara a cerrarlo. Nada se descarta sin tu confirmación.`,
    });
    if (!ui.isOwner(s)) contentEl.createEl('p', { cls: 'dovela-muted', text: `Se inició en otro dispositivo (${s.dev}).` });
    const actions = contentEl.createDiv({ cls: 'dovela-pomodoro-actions' });
    const reg = actions.createEl('button', { text: '⏹️ Registrar hasta…', cls: 'mod-cta' });
    reg.addEventListener('click', () => {
      this.close();
      const end = s.kind === 'pomodoro' ? Math.min(ui.now(), phaseEnd(ui.run(s))) : ui.now();
      ui.openStopUntil(s, end);
    });
    const drop = actions.createEl('button', { text: '🗑️ Descartar', cls: 'mod-warning' });
    drop.addEventListener('click', () => {
      this.close();
      ui.requestCancel(s);
    });
    const keep = actions.createEl('button', { text: 'Dejarla abierta' });
    keep.addEventListener('click', () => this.close());
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
