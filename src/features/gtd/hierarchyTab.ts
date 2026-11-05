/**
 * Pestaña "Vista Jerárquica": árbol carpeta↔nota sobre el índice, con hijos construidos al abrir
 * cada `<details>`, búsqueda por título (síncrona) y por contenido (debounce 300 ms, cancelable).
 * El panel conserva su propio elemento para que un redibujado no quite el foco del buscador.
 */
import { debounce } from 'obsidian';
import type { TreeNode } from '../../core/notes/hierarchy';
import {
  defaultOpenIds, expandableIds, searchTree, treePaths, typeIcon, type TreeSearchResult,
} from '../../core/gtd/viewmodel';
import { lazyDetails } from './render';

export interface HierarchyHost {
  openPath(path: string, ev: MouseEvent): void;
  /** Badge de origen (Foco) para una ruta; '' si no aplica. */
  badge(path: string): string;
  /** Contenido de la nota en minúsculas, o null si no se puede leer. */
  readContent(path: string): Promise<string | null>;
}

const yieldToMain = (): Promise<void> => new Promise((r) => window.setTimeout(r, 0));

export class HierarchyPanel {
  readonly el: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly contentToggle: HTMLButtonElement;
  private readonly summaryEl: HTMLElement;
  private readonly treeEl: HTMLElement;
  private root: TreeNode | null = null;
  private openIds: Set<string> | null = null;
  private term = '';
  private includeContent = false;
  private contentMatches: Set<string> | null = null;
  private searching = false;
  private generation = 0;
  private readonly scheduleContent = debounce(() => void this.searchContent(), 300, true);
  private readonly scheduleTitle = debounce(() => this.renderTree(), 120, true);

  constructor(private readonly host: HierarchyHost) {
    this.el = createDiv({ cls: 'dovela-gtd-hierarchy' });
    const bar = this.el.createDiv({ cls: 'dovela-gtd-toolbar dovela-gtd-hier-toolbar' });
    this.input = bar.createEl('input', {
      type: 'search',
      cls: 'dovela-gtd-input',
      attr: { placeholder: 'Buscar notas por título…', 'aria-label': 'Buscar en la jerarquía', autocomplete: 'off', spellcheck: 'false' },
    });
    this.input.addEventListener('input', () => {
      this.term = this.input.value;
      this.contentMatches = null;
      this.searching = false;
      this.scheduleTitle();
      if (this.includeContent) this.scheduleContent();
      else this.generation++;
    });
    this.contentToggle = bar.createEl('button', {
      cls: 'dovela-gtd-content-toggle', text: '📝 Incluir contenido', attr: { 'aria-pressed': 'false' },
    });
    this.contentToggle.addEventListener('click', () => {
      this.includeContent = !this.includeContent;
      this.contentToggle.setAttr('aria-pressed', String(this.includeContent));
      this.contentToggle.toggleClass('is-active', this.includeContent);
      this.input.placeholder = this.includeContent ? 'Buscar en título y contenido…' : 'Buscar notas por título…';
      this.contentMatches = null;
      this.searching = false;
      this.generation++;
      if (this.includeContent && this.term.trim()) this.scheduleContent();
      else this.renderTree();
    });
    const expand = bar.createEl('button', { text: '⊞ Expandir todo' });
    expand.addEventListener('click', () => {
      if (!this.root) return;
      this.openIds = new Set(expandableIds(this.root));
      this.renderTree();
    });
    const collapse = bar.createEl('button', { text: '⊟ Colapsar todo' });
    collapse.addEventListener('click', () => {
      this.openIds = new Set();
      this.renderTree();
    });
    this.summaryEl = this.el.createDiv({ cls: 'dovela-gtd-hier-summary dovela-muted' });
    this.treeEl = this.el.createDiv({ cls: 'dovela-gtd-tree' });
  }

  /** Nuevo árbol (cambio del índice o del ámbito): conserva apertura y búsqueda. */
  update(root: TreeNode): void {
    this.root = root;
    if (this.openIds === null) this.openIds = new Set(defaultOpenIds(root));
    this.renderTree();
  }

  dispose(): void {
    this.generation++;
    this.scheduleContent.cancel();
    this.scheduleTitle.cancel();
  }

  private searchActive(): boolean {
    return this.term.trim().length > 0;
  }

  private async searchContent(): Promise<void> {
    const root = this.root;
    const q = this.term.trim().toLocaleLowerCase('es');
    if (!root || !q || !this.includeContent) return;
    const gen = ++this.generation;
    this.searching = true;
    this.renderSummary(null);
    const found = new Set<string>();
    const paths = treePaths(root);
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (p === undefined) continue;
      const text = await this.host.readContent(p);
      if (gen !== this.generation) return; // búsqueda obsoleta: otra la reemplazó
      if (text?.includes(q)) found.add(p);
      if (i % 25 === 24) {
        await yieldToMain();
        if (gen !== this.generation) return;
      }
    }
    this.searching = false;
    this.contentMatches = found;
    this.renderTree();
  }

  private renderSummary(res: TreeSearchResult | null): void {
    this.summaryEl.empty();
    if (!this.searchActive()) return;
    if (this.searching) {
      this.summaryEl.setText('🔎 Buscando en el contenido…');
      return;
    }
    if (!res) return;
    const t = res.titleMatches.size;
    const c = res.contentMatches.size;
    this.summaryEl.setText(`${t + c}: 📄 ${t} títulos${this.includeContent ? ` 📝 ${c} contenido` : ''}`);
  }

  private renderTree(): void {
    const root = this.root;
    this.treeEl.empty();
    if (!root) return;
    const search = this.searchActive() ? searchTree(root, this.term, this.contentMatches ?? undefined) : null;
    this.renderSummary(search);
    if (root.children.length === 0) {
      this.treeEl.createDiv({ cls: 'dovela-gtd-empty', text: 'No hay notas en este ámbito.' });
      return;
    }
    if (search && search.visible.size === 0 && !this.searching) {
      this.treeEl.createDiv({ cls: 'dovela-gtd-empty', text: 'Sin resultados.' });
      return;
    }
    for (const c of root.children) if (!search || search.visible.has(c.id)) this.renderNode(this.treeEl, c, search);
  }

  private renderNode(parent: HTMLElement, node: TreeNode, search: TreeSearchResult | null): void {
    const kids = search ? node.children.filter((c) => search.visible.has(c.id)) : node.children;
    const open = this.openIds ?? new Set<string>();
    if (kids.length === 0) {
      const leaf = parent.createDiv({ cls: 'dovela-tree-node is-leaf' });
      this.header(leaf.createDiv({ cls: 'dovela-tree-header' }), node, search);
      this.decorate(leaf, node, search);
      return;
    }
    const d = lazyDetails(
      parent, 'dovela-tree-node', open.has(node.id) || (search?.expand.has(node.id) ?? false),
      (body) => {
        body.addClass('dovela-tree-children');
        for (const k of kids) this.renderNode(body, k, search);
      },
      (isOpen) => {
        if (isOpen) open.add(node.id);
        else open.delete(node.id);
      },
    );
    d.summary.addClass('dovela-tree-header');
    this.header(d.summary, node, search);
    this.decorate(d.details, node, search);
  }

  private decorate(el: HTMLElement, node: TreeNode, search: TreeSearchResult | null): void {
    if (node.missing) el.addClass('is-missing');
    if (node.inProgress > 0) el.addClass('has-in-progress');
    if (search?.titleMatches.has(node.id)) el.addClass('is-match-title');
    if (search?.contentMatches.has(node.id)) el.addClass('is-match-content');
  }

  private header(el: HTMLElement, node: TreeNode, search: TreeSearchResult | null): void {
    el.createSpan({ cls: 'dovela-tree-icon', text: node.inProgress > 0 ? '⚡' : typeIcon(node.type, node.missing) });
    const path = node.path;
    if (path) {
      const a = el.createEl('a', { cls: 'dovela-tree-name', text: node.name, href: '#' });
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.host.openPath(path, ev);
      });
    } else {
      el.createSpan({ cls: 'dovela-tree-name', text: node.name });
    }
    if (node.estado) el.createSpan({ cls: 'dovela-tree-estado', text: node.estado });
    if (path) {
      const b = this.host.badge(path);
      if (b) el.createSpan({ cls: 'dovela-task-badge', text: b });
    }
    if (search?.contentMatches.has(node.id)) el.createSpan({ cls: 'dovela-tree-match', text: '📝' });
    const counts = el.createSpan({ cls: 'dovela-tree-counts' });
    counts.createSpan({ cls: 'dovela-tree-own', text: `(${node.own})`, attr: { 'aria-label': 'Tareas abiertas en esta nota', title: 'Tareas en esta nota' } });
    counts.appendText(' - ');
    counts.createSpan({
      cls: 'dovela-tree-total', text: String(node.own + node.total),
      attr: { 'aria-label': 'Tareas abiertas en toda la jerarquía', title: 'Tareas totales en la jerarquía' },
    });
  }
}
