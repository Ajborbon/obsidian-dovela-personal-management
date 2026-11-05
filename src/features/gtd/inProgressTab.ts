/** Pestaña "En Progreso": métricas, agrupación (ninguno/contexto/persona/proyecto) y orden cíclico. */
import { processInProgress, type InProgressGrouping, type InProgressSorting } from '../../core/gtd/inprogress';
import { formatDuration } from '../../core/duration';
import type { Task } from '../../core/tasks/model';
import { lazyDetails, renderChunked, type RowFactory } from './render';

export interface InProgressEnv {
  readonly tasks: readonly Task[];
  readonly today: string;
  readonly grouping: InProgressGrouping;
  readonly sorting: InProgressSorting;
  readonly row: RowFactory;
  readonly shown: Map<string, number>;
  readonly closed: Set<string>;
  readonly setGrouping: (g: InProgressGrouping) => void;
  readonly setSorting: (s: InProgressSorting) => void;
}

const GROUPINGS: ReadonlyArray<[InProgressGrouping, string]> = [
  ['none', 'Ninguno'], ['context', 'Contexto'], ['person', 'Persona'], ['project', 'Proyecto'],
];

const SORT_CYCLE: Readonly<Record<InProgressSorting, InProgressSorting>> = {
  priority: 'duration-asc', 'duration-asc': 'duration-desc', 'duration-desc': 'priority',
};
const SORT_LABEL: Readonly<Record<InProgressSorting, string>> = {
  priority: '⏫ Prioridad', 'duration-asc': '⏱️ Duración ↑', 'duration-desc': '⏱️ Duración ↓',
};

function stat(parent: HTMLElement, label: string, value: string, cls = ''): void {
  const el = parent.createDiv({ cls: `dovela-gtd-stat ${cls}`.trim() });
  el.createDiv({ cls: 'dovela-gtd-stat-value', text: value });
  el.createDiv({ cls: 'dovela-gtd-stat-label', text: label });
}

export function renderInProgress(body: HTMLElement, env: InProgressEnv): void {
  const data = processInProgress(env.tasks, env.today, env.grouping, env.sorting);
  const s = data.stats;
  const metrics = body.createDiv({ cls: 'dovela-gtd-metrics' });
  stat(metrics, 'Tareas Activas', String(s.total));
  stat(metrics, 'Tiempo Definido', s.definedMinutes ? formatDuration(s.definedMinutes) : '0 min');
  stat(metrics, 'Tiempo Estimado', s.estimatedMinutes ? formatDuration(s.estimatedMinutes) : '0 min');
  if (s.overdue > 0) stat(metrics, 'Vencidas', String(s.overdue), 'is-overdue');

  const bar = body.createDiv({ cls: 'dovela-gtd-toolbar' });
  bar.createSpan({ cls: 'dovela-muted', text: 'Agrupar:' });
  const group = bar.createDiv({ cls: 'dovela-gtd-segmented' });
  for (const [g, label] of GROUPINGS) {
    const b = group.createEl('button', { text: label, attr: { 'aria-pressed': String(env.grouping === g) } });
    if (env.grouping === g) b.addClass('is-active');
    b.addEventListener('click', () => env.setGrouping(g));
  }
  const sortBtn = bar.createEl('button', {
    cls: 'dovela-gtd-sort', text: SORT_LABEL[env.sorting], attr: { 'aria-label': 'Cambiar orden (cíclico)' },
  });
  sortBtn.addEventListener('click', () => env.setSorting(SORT_CYCLE[env.sorting]));

  if (data.groups.length === 0) {
    body.createDiv({ cls: 'dovela-gtd-empty', text: 'No hay tareas en progreso. Marca una tarea con `- [/]` para verla aquí.' });
    return;
  }
  for (const g of data.groups) {
    const key = `ip:${env.grouping}:${g.name}`;
    const d = lazyDetails(
      body, 'dovela-gtd-list dovela-gtd-inprogress-group', !env.closed.has(key),
      (b) => renderChunked(b, g.tasks, key, env.shown, env.row),
      (open) => (open ? env.closed.delete(key) : env.closed.add(key)),
    );
    d.summary.addClass('dovela-gtd-list-title');
    d.summary.createSpan({ cls: 'dovela-gtd-list-name', text: g.name });
    d.summary.createSpan({ cls: 'dovela-count', text: String(g.tasks.length) });
  }
}
