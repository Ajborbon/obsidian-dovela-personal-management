/**
 * Fila de tarea común (Dashboard, Foco, Journal, Weekly, selector de tareas).
 * DOM construido con `createEl` (sin innerHTML): el texto del vault nunca se interpreta como HTML.
 */
import type { DisplayStatus } from '../core/gtd/classify';
import { formatMinutesOfDay } from '../core/dates';
import { formatDuration } from '../core/duration';
import type { Task } from '../core/tasks/model';

export interface TaskRowOptions {
  readonly displayStatus?: DisplayStatus;
  /** Muestra casilla; al marcarla llama `onToggleDone`. */
  readonly onToggleDone?: (task: Task) => void;
  readonly onOpen?: (task: Task, ev: MouseEvent) => void;
  readonly onOpenLink?: (linktext: string, sourcePath: string, ev: MouseEvent) => void;
  readonly onDependency?: (id: string, ev: MouseEvent) => void;
  /** Ids de dependencia inexistentes (se marcan con ⚠️). */
  readonly missingDeps?: readonly string[];
  readonly showContexts?: boolean;
  readonly showPeople?: boolean;
  readonly showDates?: boolean;
  /** Texto de origen (breadcrumb) plegable. */
  readonly breadcrumb?: string;
  /** Etiqueta adicional (p. ej. badge de origen en Foco). */
  readonly badge?: string;
  readonly today?: string;
}

const STATUS_CLASS: Record<string, string> = {
  overdue: 'is-overdue',
  today: 'is-today',
  'paused-start': 'is-future',
  'paused-dep': 'is-paused',
};

/** Pinta el texto con `[[enlaces]]` como enlaces internos navegables. */
export function renderTaskText(parent: HTMLElement, text: string, sourcePath: string, onOpenLink?: TaskRowOptions['onOpenLink']): void {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parent.appendText(text.slice(last, idx));
    const target = m[1] ?? '';
    const a = parent.createEl('a', { cls: 'internal-link', text: m[2] ?? target, href: target });
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onOpenLink?.(target, sourcePath, ev);
    });
    last = idx + m[0].length;
  }
  if (last < text.length) parent.appendText(text.slice(last));
}

export function timeRangeLabel(t: Task): string | null {
  if (t.startMinutes === undefined) return null;
  const end = t.endMinutes ?? t.startMinutes + (t.durationMinutes ?? 30);
  return `⏰ ${formatMinutesOfDay(t.startMinutes)}-${formatMinutesOfDay(end)}`;
}

export function renderTaskRow(parent: HTMLElement, task: Task, opts: TaskRowOptions = {}): HTMLElement {
  const row = parent.createDiv({ cls: 'dovela-task' });
  row.dataset['path'] = task.path;
  row.dataset['line'] = String(task.line);
  const cls = opts.displayStatus ? STATUS_CLASS[opts.displayStatus] : undefined;
  if (cls) row.addClass(cls);
  if (task.status === 'in-progress') row.addClass('is-in-progress');
  if (task.hasConflict) row.addClass('has-conflict');

  const main = row.createDiv({ cls: 'dovela-task-main' });
  if (opts.onToggleDone) {
    const cb = main.createEl('input', { type: 'checkbox', cls: 'task-list-item-checkbox' });
    cb.checked = task.status === 'done';
    if (task.status === 'in-progress') cb.dataset['task'] = '/';
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => opts.onToggleDone?.(task));
  }
  if (task.priority.symbol) main.createSpan({ cls: 'dovela-task-priority', text: task.priority.symbol });
  const range = timeRangeLabel(task);
  if (range) main.createSpan({ cls: 'dovela-task-time', text: range });
  const text = main.createSpan({ cls: 'dovela-task-text' });
  renderTaskText(text, task.text || task.raw, task.path, opts.onOpenLink);
  if (opts.badge) main.createSpan({ cls: 'dovela-task-badge', text: opts.badge });

  const meta = row.createDiv({ cls: 'dovela-task-meta' });
  if (opts.showDates !== false) {
    for (const d of task.dates) {
      const chip = meta.createSpan({ cls: 'dovela-chip dovela-chip-date', text: `${d.symbol} ${d.date}` });
      if (opts.today && d.symbol !== '🛫' && d.date < opts.today) chip.addClass('is-overdue');
    }
  }
  if (task.durationMinutes) meta.createSpan({ cls: 'dovela-chip', text: `⏱ ${formatDuration(task.durationMinutes)}` });
  if (task.week) meta.createSpan({ cls: 'dovela-chip', text: `📊 ${task.week}` });
  if (opts.showContexts !== false) for (const c of task.contexts) meta.createSpan({ cls: 'dovela-chip dovela-chip-ctx', text: `📋 ${c}` });
  if (opts.showPeople !== false) for (const p of task.people) meta.createSpan({ cls: 'dovela-chip dovela-chip-px', text: `👤 ${p}` });
  for (const dep of task.dependencies) {
    const missing = opts.missingDeps?.includes(dep);
    const chip = meta.createSpan({ cls: 'dovela-chip dovela-chip-dep', text: `⛔ ${dep} ${missing ? '⚠️' : '🔗'}` });
    if (missing) chip.setAttr('aria-label', 'La tarea de la que depende no existe');
    else chip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      opts.onDependency?.(dep, ev);
    });
  }
  if (task.hasConflict) meta.createSpan({ cls: 'dovela-chip is-conflict', text: `⚠️ ${task.conflicts.join('; ')}` });
  if (opts.breadcrumb) {
    const toggle = meta.createSpan({ cls: 'dovela-chip dovela-crumb-toggle', text: '📄' });
    const crumb = row.createDiv({ cls: 'dovela-task-crumb', text: `└─ ${opts.breadcrumb}` });
    crumb.hide();
    toggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      crumb.toggle(crumb.isShown() === false);
    });
  }
  if (meta.childElementCount === 0) meta.remove();
  if (opts.onOpen) row.addEventListener('click', (ev) => opts.onOpen?.(task, ev));
  return row;
}
