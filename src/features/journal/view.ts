/**
 * Vista viva de tareas para Journal/Weekly: pinta grupos `<details>` con `renderTaskRow` y se
 * re-renderiza cuando cambia el índice.
 *
 * Ciclo de vida:
 * - `owned: true` (bloques ```dovela-dia/semana```): el llamador llama `dispose()` (MarkdownRenderChild).
 * - `owned: false` (API pública invocada desde `datacorejsx`): nadie avisa al desmontar, así que en
 *   cada cambio del índice se comprueba `isConnected`; si el elemento estuvo en el DOM y ya no lo está
 *   (o nunca llegó a insertarse en `ORPHAN_MS`), se desuscribe solo. Sin fugas de listeners.
 */
import { Notice } from 'obsidian';
import type { DovelaContext } from '../../context';
import type { DisplayStatus } from '../../core/gtd/classify';
import { groupsSignature, reopenDoneLine, type GroupTone, type TaskGroup, type TaskSubgroup } from '../../core/journal/common';
import type { Task } from '../../core/tasks/model';
import { logger } from '../../host/logger';
import { openNote, wantsNewLeaf } from '../../host/navigation';
import type { TaskRef } from '../../host/taskWriter';
import { renderTaskRow } from '../../ui/taskRow';

/** Un elemento devuelto por la API que nunca se inserta en el DOM se suelta pasado este tiempo. */
const ORPHAN_MS = 60_000;

export interface ViewModel {
  readonly header: { readonly title: string; readonly subtitle?: string };
  readonly groups: readonly TaskGroup[];
  readonly missingDeps: ReadonlyMap<string, readonly string[]>;
  /** Fecha objetivo (Journal) para decidir si una bloqueada está además vencida. */
  readonly targetDate?: string;
  readonly emptyText: string;
}

export interface ViewConfig {
  readonly kind: 'journal' | 'weekly';
  /** Calcula el modelo desde el índice (puede lanzar: se muestra el error). */
  compute(): ViewModel;
  /** v1: Journal abría en la misma pestaña; Weekly en una nueva. */
  readonly newLeafDefault: boolean;
  readonly quickActions: boolean;
  readonly showContexts: boolean;
  readonly owned: boolean;
}

export interface ViewHandle {
  dispose(): void;
  refresh(force?: boolean): void;
}

export function taskRef(t: Task): TaskRef {
  return { path: t.path, line: t.line, raw: t.raw, ...(t.id ? { id: t.id } : {}) };
}

/** Elemento de error de v1 (`Error Journal: …` / `Error Weekly: …`): nunca se lanza excepción. */
export function errorElement(kind: 'journal' | 'weekly', message: string): HTMLElement {
  const el = createDiv({ cls: `${kind}-error dovela-jw-error` });
  el.setText(`Error ${kind === 'journal' ? 'Journal' : 'Weekly'}: ${message}`);
  return el;
}

function rowStatus(tone: GroupTone | undefined, t: Task, targetDate: string | undefined): DisplayStatus | undefined {
  if (tone === 'overdue') return 'overdue';
  if (tone === 'blocked') return targetDate && t.date && t.date < targetDate ? 'overdue' : 'paused-dep';
  return undefined;
}

interface RowEnv {
  readonly ctx: DovelaContext;
  readonly cfg: ViewConfig;
  readonly model: ViewModel;
  readonly today: string;
  readonly busy: Set<string>;
  readonly refresh: (force?: boolean) => void;
}

async function runEdit(env: RowEnv, t: Task, op: () => Promise<{ ok: boolean }>): Promise<void> {
  if (env.busy.has(t.key)) return;
  env.busy.add(t.key);
  try {
    const res = await op();
    // Si no se escribió, se redibuja para devolver la casilla a su estado real.
    if (!res.ok) env.refresh(true);
  } catch (e) {
    logger.error('Journal: no se pudo modificar la tarea', e);
    new Notice('Dovela: no se pudo modificar la tarea.');
    env.refresh(true);
  } finally {
    env.busy.delete(t.key);
  }
}

function toggleDone(env: RowEnv, t: Task): void {
  const { ctx } = env;
  const ref = taskRef(t);
  void runEdit(env, t, () => (t.status === 'done' ? ctx.tasks.edit(ref, reopenDoneLine) : ctx.tasks.markDone(ref)));
}

function addQuickActions(env: RowEnv, row: HTMLElement, t: Task): void {
  if (t.status !== 'open' && t.status !== 'in-progress') return;
  const main = row.querySelector<HTMLElement>('.dovela-task-main') ?? row;
  const box = main.createSpan({ cls: 'dovela-jw-actions' });
  const btn = (text: string, label: string, run: () => Promise<{ ok: boolean }>): void => {
    const b = box.createEl('button', { cls: 'clickable-icon dovela-jw-action', text });
    b.setAttr('aria-label', label);
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void runEdit(env, t, run);
    });
  };
  const ref = taskRef(t);
  if (t.status === 'open') btn('🔄', 'Marcar en progreso', () => env.ctx.tasks.markInProgress(ref));
  else btn('⏸', 'Volver a pendiente', () => env.ctx.tasks.markOpen(ref));
}

function renderRows(env: RowEnv, parent: HTMLElement, tasks: readonly Task[], tone: GroupTone | undefined): void {
  const { ctx, cfg, model } = env;
  for (const t of tasks) {
    const status = rowStatus(tone, t, model.targetDate);
    const missing = model.missingDeps.get(t.key);
    const row = renderTaskRow(parent, t, {
      ...(status ? { displayStatus: status } : {}),
      ...(missing ? { missingDeps: missing } : {}),
      today: env.today,
      showContexts: cfg.showContexts,
      showPeople: cfg.showContexts,
      onToggleDone: (task) => toggleDone(env, task),
      onOpen: (task, ev) => {
        const leaf = wantsNewLeaf(ev) || (cfg.newLeafDefault ? 'tab' : false);
        void openNote(ctx.app, task.path, task.line, leaf);
      },
      onOpenLink: (linktext, sourcePath, ev) => {
        void ctx.app.workspace.openLinkText(linktext, sourcePath, wantsNewLeaf(ev));
      },
      onDependency: (id, ev) => {
        const dep = ctx.index.store.taskById().get(id);
        if (!dep) {
          new Notice(`Dovela: no se encontró la tarea dependiente «${id}».`);
          return;
        }
        void openNote(ctx.app, dep.path, dep.line, wantsNewLeaf(ev));
      },
    });
    row.addClass('dovela-jw-task');
    if (cfg.quickActions) addQuickActions(env, row, t);
  }
}

/** `<details>` con relleno perezoso: el contenido de un grupo plegado se crea al abrirlo. */
function renderDetails(
  parent: HTMLElement, id: string, title: string, open: boolean, cls: string,
  openState: Map<string, boolean>, fill: (body: HTMLElement) => void,
): HTMLDetailsElement {
  const det = parent.createEl('details', { cls });
  det.dataset['group'] = id;
  det.createEl('summary', { cls: 'dovela-jw-summary', text: title });
  const body = det.createDiv({ cls: 'dovela-jw-group-body' });
  let filled = false;
  const ensure = (): void => {
    if (filled) return;
    filled = true;
    fill(body);
  };
  const isOpen = openState.get(id) ?? open;
  if (isOpen) {
    det.open = true;
    ensure();
  }
  det.addEventListener('toggle', () => {
    openState.set(id, det.open);
    if (det.open) ensure();
  });
  return det;
}

function renderGroup(env: RowEnv, parent: HTMLElement, g: TaskGroup, openState: Map<string, boolean>): void {
  const cls = `dovela-jw-group${g.tone ? ` is-${g.tone}` : ''}`;
  renderDetails(parent, g.id, g.title, g.open, cls, openState, (body) => {
    if (g.note) body.createDiv({ cls: 'dovela-muted dovela-jw-note', text: g.note });
    if (g.subgroups) {
      if (g.subgroups.length === 0) body.createDiv({ cls: 'dovela-muted dovela-jw-note', text: 'Sin tareas.' });
      for (const s of g.subgroups) renderSubgroup(env, body, s, g.tone, openState);
    }
    renderRows(env, body, g.tasks, g.tone);
    if (g.hidden > 0) body.createDiv({ cls: 'dovela-muted dovela-jw-more', text: `… y ${g.hidden} tareas más` });
  });
}

function renderSubgroup(env: RowEnv, parent: HTMLElement, s: TaskSubgroup, tone: GroupTone | undefined, openState: Map<string, boolean>): void {
  const cls = `dovela-jw-subgroup${s.highlight ? ' is-today' : ''}`;
  renderDetails(parent, s.id, s.title, true, cls, openState, (body) => renderRows(env, body, s.tasks, tone));
}

/** Monta la vista en `root` y devuelve el manejador. Muestra "Cargando tareas…" hasta que el índice esté listo. */
export function mountTaskView(ctx: DovelaContext, root: HTMLElement, cfg: ViewConfig): ViewHandle {
  const openState = new Map<string, boolean>();
  const busy = new Set<string>();
  const created = Date.now();
  let disposed = false;
  let wasConnected = false;
  let lastSig: string | null = null;
  let current: HTMLElement = root.createDiv({ cls: 'dovela-muted dovela-jw-loading', text: 'Cargando tareas…' });

  const swap = (next: HTMLElement): void => {
    current.replaceWith(next);
    current = next;
  };

  const draw = (force = false): void => {
    if (disposed || !ctx.index.loaded) return;
    if (root.isConnected) wasConnected = true;
    let model: ViewModel;
    try {
      model = cfg.compute();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Journal/Weekly: error al calcular la vista`, e);
      lastSig = null;
      swap(errorElement(cfg.kind, msg));
      return;
    }
    const today = ctx.today();
    const missingSig = [...model.missingDeps].map(([k, v]) => `${k}:${v.join(',')}`).join(';');
    const sig = groupsSignature(model.groups, `${today}|${model.header.title}|${missingSig}`);
    if (!force && sig === lastSig) return;
    lastSig = sig;

    const next = createDiv({ cls: 'dovela-jw-body' });
    const head = next.createDiv({ cls: 'dovela-jw-header' });
    head.createEl('h2', { cls: 'dovela-jw-title', text: model.header.title });
    if (model.header.subtitle) head.createEl('p', { cls: 'dovela-muted dovela-jw-range', text: model.header.subtitle });
    const content = next.createDiv({ cls: 'dovela-jw-content' });
    const env: RowEnv = { ctx, cfg, model, today, busy, refresh: (f) => draw(f ?? false) };
    if (model.groups.length === 0) content.createDiv({ cls: 'dovela-muted dovela-jw-empty', text: model.emptyText });
    for (const g of model.groups) renderGroup(env, content, g, openState);
    swap(next);
  };

  let unsub: (() => void) | null = null;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    unsub?.();
    unsub = null;
  };

  unsub = ctx.index.onChange(() => {
    if (disposed) return;
    if (!cfg.owned && !root.isConnected) {
      // Desmontado por Datacore (o nunca insertado): soltar la suscripción.
      if (wasConnected || Date.now() - created > ORPHAN_MS) {
        dispose();
        return;
      }
    }
    draw();
  });

  if (ctx.index.loaded) draw(true);
  else {
    void ctx.index.ready.then(() => draw(true)).catch((e: unknown) => logger.error('Journal: el índice no se pudo cargar', e));
  }

  return { dispose, refresh: (force = false) => draw(force) };
}
