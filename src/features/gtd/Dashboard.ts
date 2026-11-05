/**
 * Dashboard GTD reutilizable (02 §8 "Foco = GTD con otro scope"): la vista `gtd-view` lo usa sobre todo
 * el vault y `foco-gtd-view` sobre el ámbito calculado por `expandNeighborhood`. Sin fork.
 *
 * - Datos: `ctx.index.store` + `classifyTasks` (memoizado por versión del índice, día, modo de vencidas y ámbito).
 * - Reactivo: `ctx.index.onChange` con debounce; solo redibuja si está visible; conserva scroll,
 *   secciones abiertas, filtros (que viven en la cabecera y no se reconstruyen) y la búsqueda jerárquica.
 * - Estado por dispositivo en `ctx.cache` (pestaña, filtros, modo de vencidas, agrupación…).
 */
import { Component, Notice, Platform, TFile, debounce } from 'obsidian';
import type { ItemView } from 'obsidian';
import type { DovelaContext } from '../../context';
import { classifyTasks, type Classification } from '../../core/gtd/classify';
import { EMPTY_FILTER, activeFilterCount, filterLists, isFilterActive, totalLabel, type GtdFilter } from '../../core/gtd/filters';
import { tasksInScope } from '../../core/gtd/focus';
import { buildSections, noteInfosFromRecords, taskBreadcrumb, type GtdSection } from '../../core/gtd/viewmodel';
import type { NoteRecord } from '../../core/index/store';
import { originBadge, type NeighborInfo } from '../../core/links/expand';
import { buildHierarchy, type TreeNode } from '../../core/notes/hierarchy';
import type { Task } from '../../core/tasks/model';
import { logger } from '../../host/logger';
import { openNote, wantsNewLeaf } from '../../host/navigation';
import { renderTaskRow, type TaskRowOptions } from '../../ui/taskRow';
import { mountTimeTab, type TimeTab } from '../time/ui/tabs';
import { HierarchyPanel } from './hierarchyTab';
import { renderInProgress } from './inProgressTab';
import { jumpTo, renderNav, renderSections, type ListsEnv } from './listsTab';
import type { LazyDetails } from './render';
import { TABS, loadDashboardState, saveDashboardState, type DashboardState, type DashboardTab } from './state';

/** Ámbito del Foco en un instante. */
export interface ScopeSnapshot {
  /** Cambia cuando cambia el conjunto (nota fijada, ajustes o versión del índice). */
  readonly key: string;
  readonly notes: ReadonlyMap<string, NeighborInfo>;
  readonly showBadges: boolean;
}

export interface DashboardOptions {
  /** Clave de la caché por dispositivo para el estado de UI. */
  readonly stateKey: string;
  /** Ámbito. Sin función = vault completo; si devuelve `null` no hay nota fijada. */
  readonly scope?: () => ScopeSnapshot | null;
  readonly noScopeMessage?: string;
  /** Cabecera adicional (Foco). Se vuelve a pintar con cada actualización de datos. */
  readonly renderHeaderExtras?: (el: HTMLElement, scope: ScopeSnapshot | null) => void;
}

interface Data {
  readonly key: string;
  readonly today: string;
  readonly scope: ScopeSnapshot | null;
  readonly tasks: readonly Task[];
  readonly cls: Classification;
  tree?: TreeNode;
  sections?: { readonly filterKey: string; readonly value: GtdSection[]; readonly filtered: Classification['lists'] };
}

const TIME_TABS: Readonly<Partial<Record<DashboardTab, TimeTab>>> = {
  tracker: 'tracker', statistics: 'statistics', timeline: 'timeline',
};

let uid = 0;

export class Dashboard extends Component {
  private state: DashboardState;
  private readonly root: HTMLElement;
  private readonly id = ++uid;
  private headerEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private extrasEl!: HTMLElement;
  private totalEl!: HTMLElement;
  private filtersEl: HTMLElement | null = null;
  private filterInputs: { context: HTMLInputElement; person: HTMLInputElement; text: HTMLInputElement } | null = null;
  private datalists: { context: HTMLDataListElement; person: HTMLDataListElement } | null = null;
  private filterToggle: HTMLButtonElement | null = null;
  private navEl!: HTMLDetailsElement;
  private bodyEl!: HTMLElement;

  private data: Data | null = null;
  private dirty = true;
  private alive = false;
  private lastToday = '';
  private timeTab: { tab: DashboardTab; host: HTMLElement; dispose: () => void } | null = null;
  private hierarchy: HierarchyPanel | null = null;
  private readonly shown = new Map<string, number>();
  private readonly ipClosed = new Set<string>();
  private readonly listsEnvAnchors = new Map<string, HTMLElement>();
  private readonly listsEnvSections = new Map<string, LazyDetails>();
  private readonly crumbs = new Map<string, string>();

  private readonly scheduleRender = debounce(() => this.renderIfVisible(), 300, true);
  private readonly scheduleFilter = debounce(() => this.renderGtdBody(true), 150, true);

  constructor(private readonly view: ItemView, private readonly ctx: DovelaContext, private readonly opts: DashboardOptions) {
    super();
    this.root = view.contentEl;
    this.state = loadDashboardState(ctx.cache, opts.stateKey, Platform.isMobile);
  }

  override onload(): void {
    this.alive = true;
    const root = this.root;
    root.empty();
    root.addClass('dovela', 'dovela-gtd');
    root.toggleClass('is-mobile', Platform.isMobile);
    this.headerEl = root.createDiv({ cls: 'dovela-gtd-header' });
    this.buildTabs();
    this.extrasEl = this.headerEl.createDiv({ cls: 'dovela-gtd-extras' });
    this.totalEl = this.headerEl.createDiv({ cls: 'dovela-gtd-total' });
    this.navEl = this.headerEl.createEl('details', { cls: 'dovela-gtd-nav' });
    this.navEl.open = !Platform.isMobile;
    this.bodyEl = root.createDiv({ cls: 'dovela-gtd-body' });

    this.register(this.ctx.index.onChange(() => this.invalidate()));
    const onLayout = (): void => {
      if (this.dirty) this.scheduleRender();
    };
    this.registerEvent(this.view.app.workspace.on('active-leaf-change', onLayout));
    this.registerEvent(this.view.app.workspace.on('layout-change', onLayout));
    // Cambio de día (medianoche): las listas dependen de "hoy".
    this.lastToday = this.ctx.today();
    this.registerInterval(window.setInterval(() => {
      const t = this.ctx.today();
      if (t !== this.lastToday) {
        this.lastToday = t;
        this.invalidate();
      }
    }, 60_000));
    if (!this.ctx.index.loaded) void this.ctx.index.ready.then(() => this.invalidate());
    this.refresh();
  }

  override onunload(): void {
    this.alive = false;
    this.scheduleRender.cancel();
    this.scheduleFilter.cancel();
    this.disposeTimeTab();
    this.hierarchy?.dispose();
    this.hierarchy = null;
    this.root.empty();
    this.root.removeClass('dovela-gtd', 'is-mobile');
  }

  /** Pestaña activa (p. ej. desde la barra de estado del temporizador → Seguimiento). */
  setTab(tab: DashboardTab): void {
    if (this.state.tab === tab) return;
    this.state.tab = tab;
    this.save();
    this.refresh();
    this.root.scrollTop = 0;
  }

  get tab(): DashboardTab {
    return this.state.tab;
  }

  /** Datos desactualizados: redibuja con debounce y solo si la vista está visible. */
  invalidate(): void {
    this.dirty = true;
    this.scheduleRender();
  }

  /** Redibujo inmediato (botón Refrescar, cambio de ámbito). */
  refresh(): void {
    if (!this.alive) return;
    this.dirty = false;
    try {
      this.renderAll();
    } catch (e) {
      logger.error('Error al dibujar el Dashboard GTD', e);
      this.bodyEl.empty();
      this.bodyEl.createDiv({ cls: 'dovela-gtd-empty', text: 'Error al dibujar la vista. Activa la depuración para ver detalles.' });
    }
  }

  private renderIfVisible(): void {
    if (!this.dirty || !this.root.isShown()) return;
    this.refresh();
  }

  private save(): void {
    saveDashboardState(this.ctx.cache, this.opts.stateKey, this.state);
  }

  // ───────────────────────── datos ─────────────────────────

  /** `undefined`: índice en construcción; `null`: sin nota fijada (Foco). */
  private getData(): Data | null | undefined {
    if (!this.ctx.index.loaded) return undefined;
    let scope: ScopeSnapshot | null = null;
    if (this.opts.scope) {
      scope = this.opts.scope();
      if (!scope) return null;
    }
    const store = this.ctx.index.store;
    const today = this.ctx.today();
    const key = `${store.version}|${today}|${this.state.overdueMode}|${scope?.key ?? 'vault'}`;
    if (this.data?.key === key) return this.data;
    const tasks = scope ? tasksInScope(store, scope.notes.keys()) : store.allTasks();
    // Las dependencias se resuelven contra TODO el vault (en v1 Foco las daba por resueltas).
    const cls = classifyTasks(tasks, { today, overdueMode: this.state.overdueMode, taskById: store.taskById() });
    this.data = { key, today, scope, tasks, cls };
    return this.data;
  }

  private sectionsOf(d: Data): { value: GtdSection[]; filtered: Classification['lists'] } {
    const f = this.state.filter;
    const filterKey = `${f.context}\u0000${f.person}\u0000${f.text}`;
    if (d.sections?.filterKey !== filterKey) {
      const filtered = filterLists(d.cls.lists, f);
      d.sections = { filterKey, filtered, value: buildSections(filtered) };
    }
    return d.sections;
  }

  private treeOf(d: Data): TreeNode {
    if (!d.tree) {
      const store = this.ctx.index.store;
      let records: Iterable<NoteRecord>;
      if (d.scope) {
        const recs: NoteRecord[] = [];
        for (const p of d.scope.notes.keys()) {
          const r = store.get(p);
          if (r) recs.push(r);
        }
        records = recs;
      } else records = store.all();
      d.tree = buildHierarchy(noteInfosFromRecords(records));
    }
    return d.tree;
  }

  // ───────────────────────── cabecera ─────────────────────────

  private buildTabs(): void {
    this.tabsEl = this.headerEl.createDiv({ cls: 'dovela-gtd-tabs', attr: { role: 'tablist' } });
    for (const t of TABS) {
      const b = this.tabsEl.createEl('button', {
        cls: 'dovela-gtd-tab', text: Platform.isMobile ? t.short : t.label,
        attr: { role: 'tab', 'aria-label': t.label, 'data-tab': t.id },
      });
      b.addEventListener('click', () => this.setTab(t.id));
    }
    const refresh = this.tabsEl.createEl('button', { cls: 'dovela-gtd-refresh', text: '🔄', attr: { 'aria-label': 'Refrescar' } });
    refresh.addEventListener('click', () => {
      this.data = null;
      this.refresh();
    });
  }

  private updateTabs(): void {
    this.tabsEl.querySelectorAll<HTMLElement>('.dovela-gtd-tab').forEach((b) => {
      const active = b.dataset['tab'] === this.state.tab;
      b.toggleClass('is-active', active);
      b.setAttr('aria-selected', String(active));
    });
  }

  private ensureFilters(): void {
    if (this.filtersEl) return;
    const el = this.headerEl.createDiv({ cls: 'dovela-gtd-filters' });
    this.headerEl.insertBefore(el, this.navEl);
    this.filtersEl = el;
    const toggle = el.createEl('button', { cls: 'dovela-gtd-filters-toggle' });
    this.filterToggle = toggle;
    toggle.addEventListener('click', () => {
      this.state.filtersCollapsed = !this.state.filtersCollapsed;
      this.save();
      this.updateFilterChrome();
    });
    const content = el.createDiv({ cls: 'dovela-gtd-filters-content' });
    const field = (label: string, key: keyof GtdFilter, listId?: string): HTMLInputElement => {
      const group = content.createDiv({ cls: 'dovela-gtd-filter' });
      group.createEl('label', { text: label });
      const input = group.createEl('input', {
        type: key === 'text' ? 'search' : 'text',
        cls: 'dovela-gtd-input',
        attr: {
          placeholder: key === 'text' ? 'Texto de la tarea…' : 'Escribe o elige…',
          autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': label,
          ...(listId ? { list: listId } : {}),
        },
      });
      input.value = this.state.filter[key];
      input.addEventListener('input', () => {
        this.state.filter = { ...this.state.filter, [key]: input.value };
        this.save();
        this.updateFilterChrome();
        this.scheduleFilter();
      });
      return input;
    };
    const cxId = `dovela-gtd-cx-${this.id}`;
    const pxId = `dovela-gtd-px-${this.id}`;
    this.filterInputs = {
      context: field('Contexto', 'context', cxId),
      person: field('Persona', 'person', pxId),
      text: field('Tarea', 'text'),
    };
    this.datalists = { context: content.createEl('datalist', { attr: { id: cxId } }), person: content.createEl('datalist', { attr: { id: pxId } }) };
    const clear = content.createEl('button', { cls: 'dovela-gtd-filters-clear', text: 'Limpiar' });
    clear.addEventListener('click', () => {
      this.state.filter = EMPTY_FILTER;
      if (this.filterInputs) for (const i of Object.values(this.filterInputs)) i.value = '';
      this.save();
      this.updateFilterChrome();
      this.renderGtdBody(true);
    });
    this.updateFilterChrome();
  }

  private updateFilterChrome(): void {
    if (!this.filtersEl || !this.filterToggle) return;
    const n = activeFilterCount(this.state.filter);
    const collapsed = this.state.filtersCollapsed;
    this.filtersEl.toggleClass('is-collapsed', collapsed);
    this.filtersEl.toggleClass('has-active', n > 0);
    this.filterToggle.setText(`🔍 Filtros${n ? ` (${n} activo${n > 1 ? 's' : ''})` : ''} ${collapsed ? '▸' : '▾'}`);
    this.filterToggle.setAttr('aria-expanded', String(!collapsed));
    if (this.filterInputs) {
      for (const [k, input] of Object.entries(this.filterInputs) as Array<[keyof GtdFilter, HTMLInputElement]>) {
        input.parentElement?.toggleClass('has-value', this.state.filter[k].trim() !== '');
      }
    }
  }

  private updateDatalists(d: Data): void {
    if (!this.datalists) return;
    const fill = (dl: HTMLDataListElement, values: readonly string[]): void => {
      dl.empty();
      for (const v of values) dl.createEl('option', { attr: { value: v } });
    };
    fill(this.datalists.context, d.cls.contexts);
    fill(this.datalists.person, d.cls.people);
  }

  // ───────────────────────── render ─────────────────────────

  private renderAll(): void {
    this.updateTabs();
    const tab = this.state.tab;
    const isGtd = tab === 'gtd';
    const d = this.getData();
    this.extrasEl.empty();
    if (this.opts.renderHeaderExtras) this.opts.renderHeaderExtras(this.extrasEl, d ? d.scope : null);
    if (isGtd) this.ensureFilters();
    this.filtersEl?.toggleClass('is-hidden', !isGtd || !d);
    this.navEl.toggleClass('is-hidden', !isGtd || !d);

    if (d === undefined || d === null) {
      this.disposeTimeTab();
      this.totalEl.setText('');
      this.bodyEl.empty();
      this.bodyEl.createDiv({
        cls: 'dovela-gtd-empty',
        text: d === undefined ? '⏳ Construyendo índice…' : (this.opts.noScopeMessage ?? 'Sin datos.'),
      });
      return;
    }

    // Fuera de "Listas GTD" los filtros no aplican: total de abiertas únicas del ámbito.
    this.totalEl.setText(isGtd
      ? totalLabel(this.sectionsOf(d).filtered, d.cls.openTasks.length, this.state.filter)
      : totalLabel(d.cls.lists, d.cls.openTasks.length, EMPTY_FILTER));

    const timeTab = TIME_TABS[tab];
    if (timeTab) {
      if (this.timeTab?.tab === tab && this.timeTab.host.isConnected) return; // la UI de tiempo se refresca sola
      this.disposeTimeTab();
      this.bodyEl.empty();
      const host = this.bodyEl.createDiv({ cls: 'dovela-gtd-timetab' });
      try {
        this.timeTab = { tab, host, dispose: mountTimeTab(host, this.ctx, timeTab) };
      } catch (e) {
        logger.error('No se pudo montar la pestaña de tiempo', e);
        host.createDiv({ cls: 'dovela-gtd-empty', text: 'No se pudo cargar esta pestaña.' });
      }
      return;
    }
    this.disposeTimeTab();

    const scroll = this.root.scrollTop;
    if (tab === 'hierarchy') {
      if (!this.hierarchy) this.hierarchy = this.createHierarchy();
      if (this.hierarchy.el.parentElement !== this.bodyEl) {
        this.bodyEl.empty();
        this.bodyEl.appendChild(this.hierarchy.el);
      }
      this.hierarchy.update(this.treeOf(d));
    } else if (tab === 'inProgress') {
      this.bodyEl.empty();
      renderInProgress(this.bodyEl, {
        tasks: d.tasks, today: d.today, grouping: this.state.grouping, sorting: this.state.sorting,
        row: (p, t) => this.row(p, t, d), shown: this.shown, closed: this.ipClosed,
        setGrouping: (g) => {
          this.state.grouping = g;
          this.save();
          this.refresh();
        },
        setSorting: (s) => {
          this.state.sorting = s;
          this.save();
          this.refresh();
        },
      });
    } else {
      this.updateDatalists(d);
      this.renderGtdBody(false);
    }
    this.root.scrollTop = scroll;
  }

  /** Cuerpo de "Listas GTD" + navegación + contador (también tras cambiar filtros). */
  private renderGtdBody(fromFilter: boolean): void {
    const d = this.data;
    if (!d || this.state.tab !== 'gtd') return;
    const scroll = this.root.scrollTop;
    const { value: sections, filtered } = this.sectionsOf(d);
    this.totalEl.setText(totalLabel(filtered, d.cls.openTasks.length, this.state.filter));
    const env = this.listsEnv(d);

    this.navEl.empty();
    const sum = this.navEl.createEl('summary', { text: '🧭 Navegación rápida' });
    sum.createSpan({ cls: 'dovela-count', text: String(sections.length) });
    renderNav(this.navEl, sections, (sectionAnchor, anchor) => {
      jumpTo(this.root, this.headerEl, env, sectionAnchor, anchor);
      if (Platform.isMobile) this.navEl.open = false;
    });

    this.bodyEl.empty();
    if (sections.length === 0) {
      this.bodyEl.createDiv({
        cls: 'dovela-gtd-empty',
        text: isFilterActive(this.state.filter) ? 'Ninguna tarea coincide con los filtros.' : 'No hay tareas abiertas. 🎉',
      });
    } else renderSections(this.bodyEl, sections, env);
    if (!fromFilter) this.root.scrollTop = scroll;
  }

  private listsEnv(d: Data): ListsEnv {
    return {
      row: (p, t) => this.row(p, t, d),
      overdueMode: this.state.overdueMode,
      onToggleOverdue: () => {
        this.state.overdueMode = this.state.overdueMode === 'date-first' ? 'context-first' : 'date-first';
        this.save();
        this.refresh();
      },
      isClosed: (a) => this.state.closedSections.includes(a),
      setClosed: (a, closed) => {
        const has = this.state.closedSections.includes(a);
        if (closed === has) return;
        this.state.closedSections = closed ? [...this.state.closedSections, a] : this.state.closedSections.filter((x) => x !== a);
        this.save();
      },
      shown: this.shown,
      anchors: this.listsEnvAnchors,
      sections: this.listsEnvSections,
    };
  }

  private createHierarchy(): HierarchyPanel {
    const app = this.view.app;
    return new HierarchyPanel({
      openPath: (path, ev) => void openNote(app, path, undefined, wantsNewLeaf(ev)),
      badge: (path) => {
        const s = this.data?.scope;
        return s?.showBadges ? originBadge(s.notes.get(path)) : '';
      },
      readContent: async (path) => {
        const f = app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return null;
        try {
          return (await app.vault.cachedRead(f)).toLocaleLowerCase('es');
        } catch {
          return null;
        }
      },
    });
  }

  private disposeTimeTab(): void {
    if (!this.timeTab) return;
    const { dispose } = this.timeTab;
    this.timeTab = null;
    try {
      dispose();
    } catch (e) {
      logger.error('Error al desmontar la pestaña de tiempo', e);
    }
  }

  // ───────────────────────── filas ─────────────────────────

  private crumb(path: string): string {
    let c = this.crumbs.get(path);
    if (c === undefined) {
      c = taskBreadcrumb(path);
      this.crumbs.set(path, c);
    }
    return c;
  }

  private row(parent: HTMLElement, t: Task, d: Data): HTMLElement {
    const app = this.view.app;
    const info = d.scope?.notes.get(t.path);
    const opts: TaskRowOptions = {
      displayStatus: d.cls.displayStatus.get(t.key) ?? null,
      onToggleDone: (task) => void this.complete(task),
      onOpen: (task, ev) => void openNote(app, task.path, task.line, wantsNewLeaf(ev)),
      onOpenLink: (linktext, source, ev) => void app.workspace.openLinkText(linktext, source, wantsNewLeaf(ev)),
      onDependency: (id, ev) => this.openDependency(id, ev),
      missingDeps: d.cls.missingDependencies.get(t.key) ?? [],
      breadcrumb: this.crumb(t.path),
      badge: d.scope?.showBadges ? originBadge(info) : '',
      today: d.today,
    };
    const el = renderTaskRow(parent, t, opts);
    const ds = opts.displayStatus;
    if (ds) el.addClass(`dovela-ds-${ds}`);
    return el;
  }

  private async complete(task: Task): Promise<void> {
    const res = await this.ctx.tasks.markDone({ path: task.path, line: task.line, raw: task.raw, ...(task.id ? { id: task.id } : {}) });
    // Si no se escribió, se redibuja para desmarcar la casilla; si se escribió, el índice avisará.
    if (!res.ok) this.refresh();
  }

  private openDependency(id: string, ev: MouseEvent): void {
    const t = this.ctx.index.store.taskById().get(id);
    if (!t) {
      new Notice(`Dovela: no existe ninguna tarea con id "${id}".`);
      return;
    }
    void openNote(this.view.app, t.path, t.line, wantsNewLeaf(ev));
  }
}
