/**
 * Pestaña Seguimiento: cronómetro de la sesión en curso con sus acciones, tarea actual con
 * “ir a la tarea”, sesiones simultáneas y selector de tarea (notas abiertas / en progreso / todas)
 * leído del índice (v1 reparseaba el vault en cada render).
 */
import { Notice, setIcon } from 'obsidian';
import { toLocalHm } from '../../../core/dates';
import { formatDuration } from '../../../core/duration';
import { clockInfo, noteName } from '../../../core/time/display';
import { isStale } from '../../../core/time/merge';
import { minutesInRange, pomodoroStats } from '../../../core/time/stats';
import { openNote } from '../../../host/navigation';
import type { TaskTarget } from '../../../host/time/TimeService';
import { candidates, type Pick as TaskPick, type PickSource } from '../../../ui/TaskPickerModal';
import { VirtualList } from '../../../ui/VirtualList';
import type { TimeUi } from './controller';
import { Refresher } from './refresher';

const SOURCE_KEY = 'time.tracker.source';
const SOURCES: ReadonlyArray<{ id: PickSource; label: string }> = [
  { id: 'open-notes', label: 'Notas abiertas' },
  { id: 'in-progress', label: 'En progreso' },
  { id: 'all', label: 'Todas' },
];

function pickKey(p: TaskPick): string {
  return p.kind === 'note' ? `n:${p.path}` : `t:${p.task.key}`;
}

function haystack(p: TaskPick): string {
  if (p.kind === 'note') return `${p.basename} ${p.path}`.toLowerCase();
  const t = p.task;
  return [t.text, ...t.contexts.map((c) => `#cx-${c}`), ...t.people.map((x) => `#px-${x}`), ...t.gtdTags, ...t.otherTags, t.path].join(' ').toLowerCase();
}

function button(parent: HTMLElement, icon: string, text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = parent.createEl('button', { cls: `dovela-time-btn ${cls}`.trim() });
  setIcon(b.createSpan({ cls: 'dovela-time-btn-icon' }), icon);
  b.createSpan({ text });
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

export function mountTracker(root: HTMLElement, ui: TimeUi): () => void {
  const ctx = ui.ctx;
  const svc = ui.service;
  const savedSource = ctx.cache.get<unknown>(SOURCE_KEY, 'open-notes');
  let source: PickSource = SOURCES.some((s) => s.id === savedSource) ? (savedSource as PickSource) : 'open-notes';
  let query = '';
  let selected: TaskPick | null = null;
  let renderedId = '';
  let renderedMode = '';
  let clockEl: HTMLElement | null = null;

  const control = root.createDiv({ cls: 'dovela-time-card dovela-time-control' });
  const concurrentEl = root.createDiv({ cls: 'dovela-time-card dovela-time-concurrent' });
  const picker = root.createDiv({ cls: 'dovela-time-card dovela-time-picker' });

  const currentTarget = (): TaskTarget | null => (selected ? ui.targetFromPick(selected) : ui.activeNoteTarget());
  const withTarget = (fn: (t: TaskTarget) => void): void => {
    const t = currentTarget();
    if (t) fn(t);
    else new Notice('Dovela: elige una tarea abajo o abre una nota.');
  };

  // ───── Control ─────
  const renderControl = (): void => {
    const s = svc.current();
    const now = ui.now();
    const p = ctx.settings.value.pomodoro;
    control.empty();
    control.removeClass('is-overtime', 'is-decide', 'is-break', 'is-running');
    const head = control.createDiv({ cls: 'dovela-time-clock-wrap' });
    const label = head.createDiv({ cls: 'dovela-time-state' });
    clockEl = head.createDiv({ cls: 'dovela-time-clock' });
    if (!s) {
      label.setText('Sin sesión en curso');
      clockEl.setText('00:00:00');
      clockEl.addClass('is-idle');
      renderedId = '';
      renderedMode = '';
    } else {
      const info = clockInfo(s, now, p.workDuration, p.cyclesBeforeLongBreak);
      label.setText(info.label);
      clockEl.setText(info.clock);
      control.addClass('is-running');
      if (info.mode === 'overtime') control.addClass('is-overtime');
      if (info.mode === 'decide') control.addClass('is-decide');
      if (info.mode === 'break') control.addClass('is-break');
      renderedId = s.id;
      renderedMode = info.mode;

      const cur = control.createDiv({ cls: 'dovela-time-current' });
      const name = noteName(s.path);
      if (s.desc && s.desc !== name) cur.createDiv({ cls: 'dovela-time-current-task', text: `📌 ${s.desc}` });
      if (name) {
        const noteRow = cur.createDiv({ cls: 'dovela-time-current-note' });
        noteRow.createSpan({ text: `📄 ${name}` });
        const go = noteRow.createEl('button', { cls: 'dovela-time-link', text: s.raw !== undefined || s.taskId ? '↗ Ir a la tarea' : '↗ Ir a la nota' });
        go.addEventListener('click', () => void openNote(ui.app, s.path, s.line));
      }
      const start = new Date(s.start);
      cur.createDiv({ cls: 'dovela-muted', text: `Inicio: ${toLocalHm(start)}${s.start < now - 86_400_000 ? ` del ${start.toLocaleDateString()}` : ''}${ui.isOwner(s) ? '' : ` · iniciada en otro dispositivo (${s.dev})`}` });
      if (s.notes) cur.createDiv({ cls: 'dovela-time-current-notes', text: `📝 ${s.notes}` });
      if (isStale(s, now, ctx.settings.value.time.staleLiveHours)) {
        cur.createDiv({ cls: 'dovela-time-warning', text: '⚠️ Esta sesión lleva demasiado tiempo abierta. Detén y ajusta el fin, o cancélala.' });
      }
    }

    const buttons = control.createDiv({ cls: 'dovela-time-buttons' });
    if (!s) {
      button(buttons, 'play', 'Iniciar', () => withTarget((t) => void ui.startTimer(t)), 'mod-cta');
      button(buttons, 'timer', 'Pomodoro', () => withTarget((t) => void ui.startPomodoro(t)));
      button(buttons, 'coffee', 'Descanso', () => void ui.startBreak());
    } else {
      if (renderedMode === 'decide') button(buttons, 'alarm-clock', 'Decidir…', () => ui.openDecision(s, 'expired'), 'mod-cta');
      else button(buttons, 'square', 'Detener', () => ui.requestStop(s), 'mod-cta');
      button(buttons, 'pencil', s.kind === 'timer' ? 'Modificar' : 'Notas', () => ui.editLive(s));
      button(buttons, 'x', 'Cancelar', () => ui.requestCancel(s), 'mod-warning');
      if (s.kind === 'pomodoro' && (s.phase ?? 'work') === 'work' && renderedMode !== 'decide') {
        button(buttons, 'coffee', 'Descanso', () => void ui.startBreak());
      }
    }
    button(buttons, 'plus', 'Manual', () => {
      const t = currentTarget();
      ui.openManual(t ? { target: t } : {});
    });

    const today = ctx.today();
    const logs = svc.logs();
    let todayMin = 0;
    for (const l of logs) if (!l.bad) todayMin += minutesInRange(l, { from: today, to: today });
    const ps = pomodoroStats(logs, today);
    control.createDiv({
      cls: 'dovela-time-today dovela-muted',
      text: `Hoy: ⏱️ ${formatDuration(todayMin)} registrados · 🍅 ${ps.todaySessions} pomodoro${ps.todaySessions === 1 ? '' : 's'} (${formatDuration(ps.todayMinutes)})`,
    });
  };

  // ───── Sesiones simultáneas ─────
  const renderConcurrent = (): void => {
    concurrentEl.empty();
    const live = svc.concurrent();
    concurrentEl.toggle(live.length > 1);
    if (live.length <= 1) return;
    concurrentEl.createDiv({ cls: 'dovela-time-card-title', text: `⚠️ ${live.length} sesiones abiertas a la vez` });
    concurrentEl.createDiv({ cls: 'dovela-muted', text: 'Suele pasar si se inició tiempo en dos dispositivos antes de sincronizar. Detén o cancela las que sobren.' });
    for (const l of live) {
      const row = concurrentEl.createDiv({ cls: 'dovela-time-row' });
      row.createSpan({ cls: 'dovela-time-row-text', text: `${l.kind === 'timer' ? '⏱️' : '🍅'} ${noteName(l.path) || 'sin nota'} · desde ${toLocalHm(new Date(l.start))} · ${l.dev}` });
      button(row, 'square', 'Detener', () => ui.requestStop(l));
      button(row, 'x', 'Cancelar', () => ui.requestCancel(l), 'mod-warning');
    }
  };

  // ───── Selector de tarea ─────
  picker.createDiv({ cls: 'dovela-time-card-title', text: 'Seleccionar tarea' });
  const targetLine = picker.createDiv({ cls: 'dovela-time-target' });
  const renderTargetLine = (): void => {
    targetLine.empty();
    const t = currentTarget();
    targetLine.createSpan({ cls: 'dovela-muted', text: selected ? 'Iniciar sobre: ' : 'Sin selección; se usará la nota activa: ' });
    targetLine.createSpan({ cls: 'dovela-time-target-name', text: t ? (t.desc || noteName(t.path)) : '— ninguna nota abierta —' });
    if (selected) {
      const clear = targetLine.createEl('button', { cls: 'dovela-time-link', text: 'Quitar' });
      clear.addEventListener('click', () => {
        selected = null;
        renderTargetLine();
        renderResults();
      });
    }
  };
  const sourcesEl = picker.createDiv({ cls: 'dovela-time-sources' });
  const sourceBtns = new Map<PickSource, HTMLButtonElement>();
  for (const s of SOURCES) {
    const b = sourcesEl.createEl('button', { cls: 'dovela-time-chip', text: s.label });
    sourceBtns.set(s.id, b);
    b.addEventListener('click', () => {
      source = s.id;
      ctx.cache.set(SOURCE_KEY, source);
      renderResults();
    });
  }
  const search = picker.createEl('input', {
    cls: 'dovela-time-search',
    attr: { type: 'search', placeholder: 'Buscar por texto, #cx, #px, etiquetas o ruta…', 'aria-label': 'Buscar tarea' },
  });
  const resultsWrap = picker.createDiv({ cls: 'dovela-time-results' });
  const countEl = picker.createDiv({ cls: 'dovela-muted dovela-time-results-count' });
  let list: VirtualList<TaskPick> | null = null;

  const renderRow = (p: TaskPick): HTMLElement => {
    const row = createDiv({ cls: 'dovela-time-pick' });
    if (selected && pickKey(selected) === pickKey(p)) row.addClass('is-selected');
    const main = row.createDiv({ cls: 'dovela-time-pick-main' });
    if (p.kind === 'note') {
      main.createDiv({ cls: 'dovela-time-pick-text', text: `📄 ${p.basename}` });
      main.createDiv({ cls: 'dovela-muted dovela-time-pick-meta', text: 'Nota completa' });
    } else {
      const t = p.task;
      main.createDiv({ cls: 'dovela-time-pick-text', text: `${t.status === 'in-progress' ? '🔄' : '☐'} ${t.text}` });
      main.createDiv({ cls: 'dovela-muted dovela-time-pick-meta', text: [noteName(t.path), ...t.contexts.map((c) => `#cx-${c}`), ...t.people.map((x) => `#px-${x}`)].join(' · ') });
    }
    main.addEventListener('click', () => {
      selected = p;
      renderTargetLine();
      renderResults();
    });
    const acts = row.createDiv({ cls: 'dovela-time-pick-actions' });
    const start = acts.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Iniciar temporizador' } });
    setIcon(start, 'play');
    start.addEventListener('click', (e) => {
      e.stopPropagation();
      void ui.startTimer(ui.targetFromPick(p));
    });
    const pomo = acts.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Iniciar Pomodoro' } });
    setIcon(pomo, 'timer');
    pomo.addEventListener('click', (e) => {
      e.stopPropagation();
      void ui.startPomodoro(ui.targetFromPick(p));
    });
    return row;
  };

  const renderResults = (): void => {
    for (const [id, b] of sourceBtns) b.toggleClass('is-active', id === source);
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = candidates(ui.app, ctx.index.store, source);
    const items = words.length ? all.filter((p) => words.every((w) => haystack(p).includes(w))) : all;
    if (!ctx.index.loaded) countEl.setText('Índice construyéndose…');
    else countEl.setText(items.length ? `${items.length} resultado${items.length === 1 ? '' : 's'}` : 'Sin resultados.');
    if (list) list.setItems(items);
    else list = new VirtualList({ container: resultsWrap, items, rowHeight: 56, render: (p) => renderRow(p), maxHeight: 420, threshold: 120 });
  };

  let searchTimer = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      query = search.value;
      renderResults();
    }, 150);
  });

  // ───── Reactividad ─────
  const controlR = new Refresher(root, () => {
    renderControl();
    renderConcurrent();
  });
  const resultsR = new Refresher(root, () => {
    renderTargetLine();
    renderResults();
  }, 300);

  const offs: Array<() => void> = [];
  offs.push(svc.onChange(() => controlR.invalidate()));
  offs.push(ctx.index.onChange(() => resultsR.invalidate()));
  offs.push(ui.onTick((now) => {
    const s = svc.current();
    if (!s) {
      if (renderedId) controlR.invalidate();
    } else {
      const p = ctx.settings.value.pomodoro;
      const info = clockInfo(s, now, p.workDuration, p.cyclesBeforeLongBreak);
      if (s.id !== renderedId || info.mode !== renderedMode) controlR.invalidate();
      else clockEl?.setText(info.clock);
    }
    controlR.flush();
    resultsR.flush();
  }));
  const ws = ui.app.workspace;
  const leafRef = ws.on('file-open', () => {
    if (!selected) renderTargetLine();
    if (source === 'open-notes') resultsR.invalidate();
  });
  offs.push(() => ws.offref(leafRef));
  void ctx.index.ready.then(() => resultsR.invalidate());

  renderControl();
  renderConcurrent();
  renderTargetLine();
  renderResults();

  return () => {
    offs.forEach((f) => f());
    controlR.dispose();
    resultsR.dispose();
    window.clearTimeout(searchTimer);
    list?.destroy();
    root.empty();
  };
}
