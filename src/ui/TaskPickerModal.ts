/**
 * Selector de tareas/notas (sustituye a los selectores de v1 que reparseaban el vault).
 * Fuentes: notas abiertas, tareas en progreso o todas las tareas abiertas; busca en texto, contextos, personas y etiquetas.
 */
import type { App } from 'obsidian';
import { SuggestModal, TFile } from 'obsidian';
import type { IndexStore } from '../core/index/store';
import type { Task } from '../core/tasks/model';
import { isOpen } from '../core/tasks/model';

export type PickSource = 'open-notes' | 'in-progress' | 'all';

export type Pick =
  | { readonly kind: 'task'; readonly task: Task }
  | { readonly kind: 'note'; readonly path: string; readonly basename: string };

function openNotePaths(app: App): string[] {
  const paths = new Set<string>();
  app.workspace.iterateAllLeaves((leaf) => {
    const f = (leaf.view as { file?: unknown }).file;
    if (f instanceof TFile && f.extension === 'md') paths.add(f.path);
  });
  return [...paths];
}

export function candidates(app: App, store: IndexStore, source: PickSource): Pick[] {
  if (source === 'in-progress') return store.allTasks().filter((t) => t.status === 'in-progress').map((task) => ({ kind: 'task', task }));
  if (source === 'all') return store.allTasks().filter(isOpen).map((task) => ({ kind: 'task', task }));
  const out: Pick[] = [];
  for (const p of openNotePaths(app)) {
    out.push({ kind: 'note', path: p, basename: p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/, '') });
    for (const t of store.tasksOf(p)) if (isOpen(t)) out.push({ kind: 'task', task: t });
  }
  return out;
}

function haystack(p: Pick): string {
  if (p.kind === 'note') return p.basename.toLowerCase();
  const t = p.task;
  return [t.text, ...t.contexts, ...t.people, ...t.gtdTags, ...t.otherTags, t.path].join(' ').toLowerCase();
}

export class TaskPickerModal extends SuggestModal<Pick> {
  private source: PickSource;

  constructor(
    app: App,
    private readonly store: IndexStore,
    private readonly onPick: (p: Pick) => void,
    initial: PickSource = 'open-notes',
  ) {
    super(app);
    this.source = initial;
    this.setPlaceholder('Busca una tarea o nota (texto, #cx, #px, etiquetas)… · Tab cambia la fuente');
    this.limit = 200;
    this.scope.register([], 'Tab', (e) => {
      e.preventDefault();
      this.source = this.source === 'open-notes' ? 'in-progress' : this.source === 'in-progress' ? 'all' : 'open-notes';
      this.setInstructions([{ command: 'Tab', purpose: `Fuente: ${this.label()}` }]);
      this.inputEl.dispatchEvent(new Event('input'));
      return false;
    });
    this.setInstructions([{ command: 'Tab', purpose: `Fuente: ${this.label()}` }]);
  }

  private label(): string {
    return this.source === 'open-notes' ? 'notas abiertas' : this.source === 'in-progress' ? 'en progreso' : 'todas las abiertas';
  }

  getSuggestions(query: string): Pick[] {
    const q = query.trim().toLowerCase();
    const all = candidates(this.app, this.store, this.source);
    return q ? all.filter((p) => q.split(/\s+/).every((w) => haystack(p).includes(w))) : all;
  }

  renderSuggestion(p: Pick, el: HTMLElement): void {
    if (p.kind === 'note') {
      el.createDiv({ text: `📄 ${p.basename}` });
      el.createEl('small', { text: 'Nota completa', cls: 'dovela-muted' });
      return;
    }
    const t = p.task;
    el.createDiv({ text: `${t.status === 'in-progress' ? '🔄' : '☐'} ${t.text}` });
    const meta = [t.path.replace(/\.md$/, ''), ...t.contexts.map((c) => `#cx-${c}`), ...t.people.map((x) => `#px-${x}`)].join(' · ');
    el.createEl('small', { text: meta, cls: 'dovela-muted' });
  }

  onChooseSuggestion(p: Pick): void {
    this.onPick(p);
  }
}
