/**
 * Vista lateral "Backlinks organizados" (`dovela-backlinks-view`, mismo id que v1).
 *
 * - Sigue la nota activa (`active-leaf-change` / `file-open`, con debounce).
 * - Se recalcula solo cuando el índice informa cambios que afectan a la nota activa o a sus backlinks
 *   (`isRelevantChange`), y solo se redibuja si está visible (si no, queda marcada y se pinta al mostrarse).
 * - Contenedores persistentes + delegación de eventos: un único manejador de clic/teclado para toda la vista.
 */
import { ItemView, debounce } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import {
  bareEntry, countReasons, entryFromRecord, findBacklinks, isRelevantChange, type BacklinkEntry,
} from '../../core/backlinks/detect';
import { nextBreadcrumbStyle, folderTargetNote, BREADCRUMB_STYLE_LABELS } from '../../core/links/breadcrumbs';
import { nextSortState, sortBacklinks, type SortKey } from '../../core/backlinks/sort';
import {
  assembleTreeEntries, buildFolderTree, shouldExpandFolder, treeFileOrder, type FolderNode, type TreeEntry,
} from '../../core/backlinks/tree';
import { groupOpenTabs, type TabArea, type TabInfo } from '../../core/backlinks/tabs';
import { folderOf } from '../../core/index/store';
import { openNote, wantsNewLeaf } from '../../host/navigation';
import { logger } from '../../host/logger';
import { VirtualList } from '../../ui/VirtualList';
import type { PrefsHolder } from './prefs';
import { renderBreadcrumb, renderEmpty, renderEntryRow, type CrumbOptions } from './render';

export const BACKLINKS_VIEW_TYPE = 'dovela-backlinks-view';

/** Tipos de hoja que el visor de pestañas considera "documentos". */
const DOC_VIEW_TYPES = new Set(['markdown', 'canvas', 'pdf', 'image', 'audio', 'video', 'bases']);
const TAB_ICONS: Readonly<Record<string, string>> = { markdown: '📄', canvas: '🎨', pdf: '📕', image: '🖼️', bases: '🗃️' };

/** Altura fija de fila en modo virtual (debe coincidir con 60-backlinks.css). */
const ROW_H_SIMPLE = 64;
const ROW_H_DETAIL = 120;

const SORT_BUTTONS: readonly { key: SortKey; icon: string; label: string }[] = [
  { key: 'name', icon: '📄', label: 'Archivo' },
  { key: 'type', icon: '🏷️', label: 'Tipo' },
  { key: 'estado', icon: '🟢', label: 'Estado' },
  { key: 'path', icon: '📁', label: 'Ruta' },
  { key: 'ctime', icon: '📅', label: 'Fecha de creación' },
  { key: 'mtime', icon: '📝', label: 'Fecha de modificación' },
];

/** `instanceof Element` falla en ventanas emergentes (otro `window`): se comprueba por forma. */
function asElement(t: EventTarget | null): HTMLElement | null {
  const el = t as HTMLElement | null;
  return el && typeof el.closest === 'function' ? el : null;
}

export class BacklinksView extends ItemView {
  private currentPath: string | null = null;
  private entries: BacklinkEntry[] = [];
  private shownPaths = new Set<string>();
  private extras: BacklinkEntry[] = [];
  private showingTabs = false;
  /** Datos pendientes de recalcular (la vista estaba oculta o hubo cambios). */
  private dirty = true;
  /** Apertura manual de carpetas del árbol (se reinicia al cambiar de nota). */
  private readonly folderOverrides = new Map<string, boolean>();
  private tabLeaves: WorkspaceLeaf[] = [];
  private vlist: VirtualList<BacklinkEntry> | null = null;
  private lastRenderedPath: string | null = null;
  private lastIncludeOrigin: boolean;

  private headerEl!: HTMLElement;
  private bodyEl!: HTMLElement;

  private readonly follow = debounce(() => this.followActive(), 80, true);
  private readonly refreshSoon = debounce(() => this.refresh(), 150, true);

  constructor(leaf: WorkspaceLeaf, private readonly ctx: DovelaContext, private readonly prefs: PrefsHolder) {
    super(leaf);
    this.lastIncludeOrigin = ctx.settings.value.general.backlinksIncludeOrigin;
  }

  override getViewType(): string {
    return BACKLINKS_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return 'Backlinks';
  }

  override getIcon(): string {
    return 'link';
  }

  override async onOpen(): Promise<void> {
    const { workspace, vault } = this.app;
    this.contentEl.empty();
    this.contentEl.addClass('dovela', 'dovela-bl');
    this.headerEl = this.contentEl.createDiv({ cls: 'dovela-bl-header' });
    this.bodyEl = this.contentEl.createDiv({ cls: 'dovela-bl-body' });

    this.registerDomEvent(this.contentEl, 'click', (ev) => this.onClick(ev));
    this.registerDomEvent(this.contentEl, 'auxclick', (ev) => {
      if (ev.button === 1) this.onClick(ev);
    });
    this.registerDomEvent(this.contentEl, 'keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const t = asElement(ev.target);
      if (t && t.matches('[data-path], [data-tab]')) {
        ev.preventDefault();
        t.click();
      }
    });

    this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
      if (leaf === this.leaf) {
        if (this.dirty) this.refreshSoon();
        return;
      }
      this.follow();
      if (this.showingTabs) this.refreshSoon();
    }));
    this.registerEvent(workspace.on('file-open', () => this.follow()));
    // Mostrar/ocultar paneles laterales (o el cajón en móvil): pinta lo pendiente al hacerse visible.
    this.registerEvent(workspace.on('resize', () => {
      if (this.dirty) this.refreshSoon();
    }));
    this.registerEvent(workspace.on('layout-change', () => {
      if (this.showingTabs) this.refreshSoon();
      else if (this.dirty) this.refreshSoon();
    }));
    this.registerEvent(vault.on('rename', (file, oldPath) => {
      if (oldPath === this.currentPath) {
        this.currentPath = file.path;
        this.markDirty();
      }
    }));
    this.registerEvent(vault.on('delete', (file) => {
      if (file.path === this.currentPath) {
        this.currentPath = null;
        this.markDirty();
      }
    }));

    const offIndex = this.ctx.index.onChange((changed) => {
      const expanded = this.prefs.value.sort.key === 'path' && this.prefs.value.sort.expandedTree;
      if (isRelevantChange(changed, this.currentPath, this.shownPaths, this.ctx.index.store, expanded)) this.markDirty();
    });
    const offSettings = this.ctx.settings.onChange((s) => {
      if (s.general.backlinksIncludeOrigin !== this.lastIncludeOrigin) {
        this.lastIncludeOrigin = s.general.backlinksIncludeOrigin;
        this.markDirty();
      }
    });
    const offPrefs = this.prefs.onChange(() => this.markDirty());
    this.register(() => {
      offIndex();
      offSettings();
      offPrefs();
    });

    this.currentPath = workspace.getActiveFile()?.path ?? null;
    this.markDirty();
  }

  override async onClose(): Promise<void> {
    this.follow.cancel();
    this.refreshSoon.cancel();
    this.vlist?.destroy();
    this.vlist = null;
    this.contentEl.empty();
  }

  override onResize(): void {
    // Obsidian llama a onResize al mostrar la hoja (p. ej. al abrir el panel lateral en móvil).
    if (this.dirty) this.refreshSoon();
  }

  /** Muestra los backlinks de `path` (menú de archivo) hasta que cambie la nota activa. */
  showFile(path: string): void {
    this.follow.cancel();
    if (path !== this.currentPath) this.setCurrent(path);
    this.showingTabs = false;
    this.markDirty();
  }

  // ───────────────────────── estado ─────────────────────────

  private followActive(): void {
    const file = this.app.workspace.getActiveFile();
    // Sin archivo activo (p. ej. foco en un panel sin nota) se conserva la nota mostrada.
    if (!file || file.path === this.currentPath) return;
    this.setCurrent(file.path);
    this.markDirty();
  }

  private setCurrent(path: string | null): void {
    this.currentPath = path;
    this.folderOverrides.clear();
  }

  private markDirty(): void {
    this.dirty = true;
    this.refreshSoon();
  }

  private isVisible(): boolean {
    return this.contentEl.isShown();
  }

  private refresh(): void {
    if (!this.bodyEl || !this.isVisible()) return; // se pintará al mostrarse (onResize / active-leaf-change)
    try {
      this.compute();
      this.render();
      this.dirty = false;
    } catch (e) {
      logger.error('Backlinks: error al pintar la vista', e);
      this.dirty = false; // evita reintentos en bucle; el siguiente cambio relevante vuelve a intentarlo
      this.bodyEl.empty();
      renderEmpty(this.bodyEl, '⚠️', 'No se pudieron mostrar los backlinks', 'Detalle en la consola de depuración.');
    }
  }

  private compute(): void {
    const path = this.currentPath;
    if (path && !this.app.vault.getAbstractFileByPath(path)) this.setCurrent(null);
    const store = this.ctx.index.store;
    if (!this.currentPath) {
      this.entries = [];
      this.extras = [];
      this.shownPaths = new Set();
      return;
    }
    const includeOrigin = this.ctx.settings.value.general.backlinksIncludeOrigin;
    this.entries = findBacklinks(store, this.currentPath, { includeOrigin });
    const sort = this.prefs.value.sort;
    this.extras = sort.key === 'path' && sort.expandedTree
      ? store.inFolder(folderOf(this.currentPath), true).map((r) => entryFromRecord(r, []))
      : [];
    this.shownPaths = new Set([...this.entries, ...this.extras].map((e) => e.path));
  }

  private currentEntry(): BacklinkEntry | null {
    if (!this.currentPath) return null;
    const rec = this.ctx.index.store.get(this.currentPath);
    return rec ? entryFromRecord(rec, []) : bareEntry(this.currentPath);
  }

  private crumbOpts(): CrumbOptions {
    const p = this.prefs.value;
    return { style: p.breadcrumbStyle, maxLength: p.maxBreadcrumbLength };
  }

  // ───────────────────────── pintado ─────────────────────────

  private render(): void {
    const samePath = this.lastRenderedPath === this.currentPath;
    const prevScroll = samePath ? this.scrollEl()?.scrollTop ?? 0 : 0;
    this.lastRenderedPath = this.currentPath;

    this.vlist?.destroy();
    this.vlist = null;
    this.headerEl.empty();
    this.bodyEl.empty();
    this.bodyEl.className = 'dovela-bl-body';
    if (this.prefs.value.detail) this.bodyEl.addClass('is-detail');

    this.renderHeader();
    if (this.showingTabs) this.renderTabs();
    else if (!this.currentPath) {
      renderEmpty(this.bodyEl, '📎', 'No hay nota activa', 'Abre una nota para ver sus backlinks organizados. El visor de pestañas 🗂️ sigue disponible.');
    } else if (this.prefs.value.sort.key === 'path') this.renderTree();
    else this.renderList();

    if (prevScroll) {
      const el = this.scrollEl();
      if (el) el.scrollTop = prevScroll;
    }
  }

  private scrollEl(): HTMLElement | null {
    return this.bodyEl.querySelector<HTMLElement>('.dovela-vlist') ?? this.bodyEl;
  }

  private renderHeader(): void {
    const h = this.headerEl;
    const prefs = this.prefs.value;
    const top = h.createDiv({ cls: 'dovela-bl-top' });
    const title = top.createDiv({ cls: 'dovela-bl-note' });
    if (this.currentPath) {
      const cur = this.currentEntry();
      title.setText(cur?.basename ?? '');
      title.setAttr('title', this.currentPath);
      title.setAttr('data-path', this.currentPath);
    } else {
      title.setText('Sin nota activa');
      title.addClass('dovela-muted');
    }

    const bar = top.createDiv({ cls: 'dovela-bl-toolbar' });
    const btn = (action: string, text: string, label: string, active = false): void => {
      const b = bar.createEl('button', { cls: 'dovela-bl-btn clickable-icon', text, attr: { 'data-action': action, 'aria-label': label, title: label } });
      if (active) b.addClass('is-active');
    };
    const styleLabel = BREADCRUMB_STYLE_LABELS[prefs.breadcrumbStyle];
    btn('crumb-style', '📁', `Estilo de rutas: ${styleLabel} (clic para cambiar: Completo → Inteligente → Compacto)`);
    btn('detail', prefs.detail ? '☰' : '≡', prefs.detail ? 'Vista detalle (clic: vista simple)' : 'Vista simple (clic: vista detalle)', prefs.detail);
    btn('tabs', this.showingTabs ? '📋' : '🗂️', this.showingTabs ? 'Volver a backlinks' : 'Ver pestañas abiertas', this.showingTabs);

    if (this.currentPath && !this.showingTabs) {
      const c = countReasons(this.entries);
      const counts = h.createDiv({ cls: 'dovela-bl-counts' });
      counts.createSpan({ cls: 'dovela-bl-count-total', text: `${c.total} enlace${c.total === 1 ? '' : 's'}` });
      const part = (icon: string, n: number, label: string): void => {
        if (n > 0) counts.createSpan({ cls: 'dovela-bl-count', text: `${icon} ${n}`, attr: { title: label } });
      };
      part('🔗', c.link, 'Enlazan a esta nota');
      part('🌱', c.origin, 'La declaran como origen');
      part('📁', c.folder, 'En la misma carpeta');
      if (!this.ctx.index.loaded) counts.createSpan({ cls: 'dovela-muted', text: 'Indexando…' });

      const folder = folderOf(this.currentPath);
      if (folder) {
        const pathRow = h.createDiv({ cls: 'dovela-bl-path' });
        renderBreadcrumb(pathRow, folder, this.crumbOpts());
      }
      this.renderSortControls(h);
    }
  }

  private renderSortControls(parent: HTMLElement): void {
    const sort = this.prefs.value.sort;
    const row = parent.createDiv({ cls: 'dovela-bl-sort' });
    for (const b of SORT_BUTTONS) {
      const active = sort.key === b.key;
      let label = `Ordenar por ${b.label}`;
      if (b.key === 'path') label += sort.expandedTree ? ' (modo expandido: doble clic para compactar)' : ' (doble clic: modo expandido)';
      const el = row.createEl('button', { cls: 'dovela-bl-sort-btn', attr: { 'data-action': 'sort', 'data-key': b.key, 'aria-label': label, title: label } });
      el.createSpan({ text: b.icon });
      if (b.key === 'path' && sort.expandedTree) el.createSpan({ cls: 'dovela-bl-expand-mark', text: '+' });
      if (active) {
        el.addClass('is-active');
        if (b.key !== 'path') el.createSpan({ cls: 'dovela-bl-sort-dir', text: sort.dir === 'asc' ? '↑' : '↓' });
      }
    }
  }

  private renderList(): void {
    const { key, dir } = this.prefs.value.sort;
    const sorted = sortBacklinks(this.entries, key, dir);
    if (sorted.length === 0) {
      renderEmpty(this.bodyEl, '🔍', 'No se encontraron backlinks', 'Ninguna nota enlaza a esta ni comparte su carpeta. Ordena por 📁 Ruta para ver la nota en el árbol.');
      return;
    }
    this.bodyEl.addClass('is-list');
    const detail = this.prefs.value.detail;
    const crumb = this.crumbOpts();
    this.vlist = new VirtualList<BacklinkEntry>({
      container: this.bodyEl,
      items: sorted,
      rowHeight: detail ? ROW_H_DETAIL : ROW_H_SIMPLE,
      render: (e) => renderEntryRow(e, { detail, crumb }),
    });
  }

  private renderTree(): void {
    const sort = this.prefs.value.sort;
    const items = assembleTreeEntries(this.entries, this.currentEntry(), this.extras);
    const root = buildFolderTree<TreeEntry>(items, (t) => t.entry.folder, treeFileOrder);
    this.bodyEl.addClass('is-tree');
    const currentFolder = this.currentPath ? folderOf(this.currentPath) : null;
    const detail = this.prefs.value.detail;

    const renderFiles = (parent: HTMLElement, node: FolderNode<TreeEntry>, level: number): void => {
      for (const f of node.files) {
        const row = renderEntryRow(f.entry, { detail, crumb: null, mark: f.mark });
        row.style.setProperty('--dovela-bl-level', String(level));
        parent.appendChild(row);
      }
    };
    const renderFolder = (parent: HTMLElement, node: FolderNode<TreeEntry>, level: number): void => {
      const details = parent.createEl('details', { cls: 'dovela-bl-folder' });
      const summary = details.createEl('summary', { cls: 'dovela-bl-folder-summary' });
      summary.style.setProperty('--dovela-bl-level', String(level));
      summary.createSpan({ text: '📁 ' });
      summary.createSpan({ cls: 'dovela-bl-folder-name', text: node.name, attr: { title: node.path } });
      summary.createSpan({ cls: 'dovela-muted', text: ` (${node.count})` });
      const body = details.createDiv({ cls: 'dovela-bl-folder-body' });
      let filled = false;
      const fill = (): void => {
        if (filled) return;
        filled = true;
        renderContents(body, node, level + 1);
      };
      const open = this.folderOverrides.get(node.path) ?? shouldExpandFolder(node.path, level, currentFolder, sort.expandedTree);
      if (open) {
        details.open = true;
        fill();
      }
      // Render perezoso: los hijos de una carpeta cerrada se crean al abrirla.
      details.addEventListener('toggle', () => {
        this.folderOverrides.set(node.path, details.open);
        if (details.open) fill();
      });
    };
    const renderContents = (parent: HTMLElement, node: FolderNode<TreeEntry>, level: number): void => {
      renderFiles(parent, node, level);
      for (const c of node.children) renderFolder(parent, c, level);
    };
    // La raíz del vault se aplana: sus archivos y carpetas en el nivel 0.
    renderContents(this.bodyEl, root, 0);
    if (this.entries.length === 0) {
      this.bodyEl.createDiv({ cls: 'dovela-muted dovela-bl-note-hint', text: 'Sin backlinks: solo se muestra la nota actual.' });
    }
  }

  private renderTabs(): void {
    const ws = this.app.workspace;
    const groupIds = new Map<unknown, string>();
    const infos: TabInfo<WorkspaceLeaf>[] = [];
    ws.iterateAllLeaves((leaf) => {
      if (leaf === this.leaf) return;
      // `getViewState` da el tipo real también para hojas diferidas (Obsidian ≥ 1.7).
      const type = leaf.getViewState().type;
      if (!DOC_VIEW_TYPES.has(type)) return;
      const root = leaf.getRoot();
      const area: TabArea = root === ws.rootSplit ? 'main' : root === ws.leftSplit ? 'left' : root === ws.rightSplit ? 'right' : 'floating';
      let gid = groupIds.get(leaf.parent);
      if (!gid) groupIds.set(leaf.parent, (gid = `g${groupIds.size + 1}`));
      infos.push({ area, groupKey: gid, item: leaf });
    });
    this.tabLeaves = infos.map((i) => i.item);
    this.bodyEl.addClass('is-tabs');
    if (infos.length === 0) {
      renderEmpty(this.bodyEl, '📑', 'No hay pestañas abiertas');
      return;
    }
    const grouping = groupOpenTabs(infos);
    const active = ws.getMostRecentLeaf();
    for (const g of grouping.groups) {
      if (grouping.showHeaders) {
        const head = this.bodyEl.createDiv({ cls: 'dovela-bl-tab-group' });
        head.createSpan({ text: g.label });
        head.createSpan({ cls: 'dovela-muted', text: ` (${g.items.length})` });
      }
      const list = this.bodyEl.createDiv({ cls: 'dovela-bl-tabs' });
      for (const leaf of g.items) this.renderTabItem(list, leaf, leaf === active);
    }
  }

  private renderTabItem(parent: HTMLElement, leaf: WorkspaceLeaf, isActive: boolean): void {
    const idx = this.tabLeaves.indexOf(leaf);
    const state = leaf.getViewState();
    const filePath = typeof state.state?.['file'] === 'string' ? state.state['file'] : null;
    const item = parent.createDiv({ cls: 'dovela-bl-tab', attr: { 'data-tab': String(idx), role: 'button', tabindex: '0' } });
    if (isActive) item.addClass('is-active');
    const head = item.createDiv({ cls: 'dovela-bl-item-head' });
    head.createSpan({ cls: 'dovela-bl-icons', text: TAB_ICONS[state.type] ?? '📋' });
    head.createSpan({ cls: 'dovela-bl-title', text: leaf.getDisplayText(), attr: { title: filePath ?? leaf.getDisplayText() } });
    if (filePath) {
      const rec = this.ctx.index.store.get(filePath);
      const meta = item.createDiv({ cls: 'dovela-bl-meta' });
      const t = rec?.fm['type'];
      if (typeof t === 'string' && t) meta.createSpan({ cls: 'dovela-chip', text: t });
      if (rec?.estado) meta.createSpan({ cls: 'dovela-chip', text: rec.estado });
      meta.createSpan({ cls: 'dovela-muted dovela-bl-tab-path', text: `📁 ${folderOf(filePath) || 'Raíz'}` });
    }
  }

  // ───────────────────────── eventos ─────────────────────────

  private onClick(ev: MouseEvent): void {
    const target = asElement(ev.target);
    if (!target) return;
    const middle = ev.type === 'auxclick';

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (actionEl && !middle) {
      ev.preventDefault();
      this.onAction(actionEl.dataset['action'] ?? '', actionEl.dataset['key']);
      return;
    }
    // Un clic en un segmento de breadcrumb no abre la fila que lo contiene.
    const folderEl = target.closest<HTMLElement>('[data-folder]');
    if (folderEl) {
      ev.preventDefault();
      ev.stopPropagation();
      this.openFolder(folderEl.dataset['folder'] ?? '', wantsNewLeaf(ev));
      return;
    }
    const tabEl = target.closest<HTMLElement>('[data-tab]');
    if (tabEl) {
      ev.preventDefault();
      this.focusTab(Number(tabEl.dataset['tab']), ev);
      return;
    }
    const pathEl = target.closest<HTMLElement>('[data-path]');
    if (pathEl) {
      ev.preventDefault();
      const path = pathEl.dataset['path'];
      if (path) void openNote(this.app, path, undefined, wantsNewLeaf(ev));
    }
  }

  private onAction(action: string, key: string | undefined): void {
    switch (action) {
      case 'crumb-style':
        this.prefs.update((p) => ({ ...p, breadcrumbStyle: nextBreadcrumbStyle(p.breadcrumbStyle) }));
        break;
      case 'detail':
        this.prefs.update((p) => ({ ...p, detail: !p.detail }));
        break;
      case 'tabs':
        this.showingTabs = !this.showingTabs;
        this.markDirty();
        break;
      case 'sort':
        if (key) this.prefs.update((p) => ({ ...p, sort: nextSortState(p.sort, key as SortKey, Date.now()) }));
        break;
      default:
        break;
    }
  }

  private openFolder(folder: string, newLeaf: ReturnType<typeof wantsNewLeaf>): void {
    const notes = this.ctx.index.store.inFolder(folder, false).map((n) => n.path);
    const target = folderTargetNote(folder, notes);
    if (target) {
      void openNote(this.app, target, undefined, newLeaf);
      return;
    }
    // Carpeta sin notas indexadas: se revela en el explorador si existe.
    this.app.workspace.trigger('reveal-active-file');
  }

  private focusTab(idx: number, ev: MouseEvent): void {
    const leaf = this.tabLeaves[idx];
    if (!leaf) return;
    const mode = wantsNewLeaf(ev);
    const state = leaf.getViewState();
    const file = typeof state.state?.['file'] === 'string' ? state.state['file'] : null;
    if (mode && file) {
      void openNote(this.app, file, undefined, mode);
      return;
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    void this.app.workspace.revealLeaf(leaf);
  }
}

/** Reutiliza la hoja existente o crea una en la barra lateral derecha (como v1). */
export async function activateBacklinksView(ctx: DovelaContext, path?: string): Promise<void> {
  const ws = ctx.app.workspace;
  let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(BACKLINKS_VIEW_TYPE)[0] ?? null;
  if (!leaf) {
    leaf = ws.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: BACKLINKS_VIEW_TYPE, active: true });
  }
  await ws.revealLeaf(leaf);
  if (path) {
    const view = leaf.view;
    if (view instanceof BacklinksView) view.showFile(path);
  }
}
