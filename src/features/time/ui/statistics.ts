/**
 * Pestaña Estadísticas: árbol de tiempo por ruta (`buildTimeTree`) con %, barra, nº de registros,
 * nodos de tránsito atenuados y salto inteligente; periodos hoy/semana/mes/año/siempre/día/rango con
 * ‹ › y selector con mapa de calor; edición de registros; exportación CSV por nodo (menú contextual).
 * Render perezoso: los hijos de un nodo se crean al abrirlo.
 */
import { Menu, Modal, Notice, Platform, normalizePath } from 'obsidian';
import { MONTHS_ES, toLocalHm, toLocalYmd, weekdayNameEs } from '../../../core/dates';
import { formatDuration } from '../../../core/duration';
import { exportRangeText, heatLevel, noteName, percent, periodTitle } from '../../../core/time/display';
import { logsToCsv, safeFileName } from '../../../core/time/csv';
import { durationMinutes, type TimeLog } from '../../../core/time/merge';
import {
  buildTimeTree, collectLogs, dailyTotals, isTransitNode, periodRange, shiftAnchor, smartExpandChain,
  type DayRange, type PeriodKind, type TimeNode,
} from '../../../core/time/stats';
import { logger } from '../../../host/logger';
import { renderMonthGrid } from '../../../ui/MonthGrid';
import { VirtualList } from '../../../ui/VirtualList';
import type { TimeUi } from './controller';
import { Refresher } from './refresher';

const PERIOD_KEY = 'time.stats.period';

interface Period {
  kind: PeriodKind;
  anchor: string;
  custom?: DayRange;
}

const QUICK: ReadonlyArray<{ kind: PeriodKind; label: string }> = [
  { kind: 'today', label: 'Hoy' },
  { kind: 'week', label: 'Semana' },
  { kind: 'month', label: 'Mes' },
  { kind: 'year', label: 'Año' },
  { kind: 'all', label: 'Siempre' },
];

const KIND_ICON: Record<TimeNode['kind'], string> = {
  root: '🗂️', group: '📁', av: '📁', ai: '📁', project: '📁', folder: '📁', note: '📄',
};

const MONTHS_SHORT = MONTHS_ES.map((m) => m.slice(0, 3));

function loadPeriod(raw: unknown, today: string): Period {
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const kind = o['kind'];
    if (kind === 'day' && typeof o['anchor'] === 'string') return { kind, anchor: o['anchor'] };
    if (kind === 'custom' && typeof o['from'] === 'string' && typeof o['to'] === 'string') {
      return { kind, anchor: o['from'], custom: { from: o['from'], to: o['to'] } };
    }
    if (kind === 'today' || kind === 'week' || kind === 'month' || kind === 'year' || kind === 'all') return { kind, anchor: today };
  }
  return { kind: 'today', anchor: today };
}

function savePeriod(ui: TimeUi, p: Period): void {
  ui.ctx.cache.set(PERIOD_KEY, p.kind === 'custom' && p.custom
    ? { kind: p.kind, from: p.custom.from, to: p.custom.to }
    : p.kind === 'day' ? { kind: p.kind, anchor: p.anchor } : { kind: p.kind });
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const oy = getComputedStyle(cur).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// ───────────── Selector de periodo ─────────────

class PeriodPickerModal extends Modal {
  private from: string | null;
  private to: string | null;
  private month: string;
  private gridWrap!: HTMLElement;
  private applyBtn!: HTMLButtonElement;

  constructor(
    private readonly ui: TimeUi,
    current: Period,
    private readonly heat: ReadonlyMap<string, number>,
    private readonly onPick: (p: Period) => void,
  ) {
    super(ui.app);
    const r = periodRange(current.kind, current.anchor, current.custom);
    this.from = current.kind === 'day' || current.kind === 'custom' ? r?.from ?? null : null;
    this.to = current.kind === 'custom' ? r?.to ?? null : null;
    this.month = current.anchor;
  }

  override onOpen(): void {
    this.setTitle('Elegir periodo');
    const { contentEl } = this;
    contentEl.addClass('dovela', 'dovela-time-modal', 'dovela-period-modal');
    const layout = contentEl.createDiv({ cls: 'dovela-period-layout' });
    const quick = layout.createDiv({ cls: 'dovela-period-quick' });
    quick.createDiv({ cls: 'dovela-time-modal-label', text: 'Acciones rápidas' });
    const today = this.ui.ctx.today();
    for (const [kind, label] of [['today', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes'], ['year', 'Este año'], ['all', 'Siempre']] as const) {
      const b = quick.createEl('button', { text: label });
      b.addEventListener('click', () => this.finish({ kind, anchor: today }));
    }
    quick.createDiv({ cls: 'dovela-time-modal-label', text: 'Selección manual' });
    quick.createDiv({ cls: 'dovela-muted', text: 'Toca un día; toca otro para un rango.' });
    this.applyBtn = quick.createEl('button', { cls: 'mod-cta' });
    this.applyBtn.addEventListener('click', () => {
      if (this.from && this.to) this.finish({ kind: 'custom', anchor: this.from, custom: { from: this.from, to: this.to } });
      else if (this.from) this.finish({ kind: 'day', anchor: this.from });
    });
    this.gridWrap = layout.createDiv({ cls: 'dovela-period-grid' });
    this.renderGrid();
  }

  private renderGrid(): void {
    this.gridWrap.empty();
    renderMonthGrid(this.gridWrap, {
      month: this.month,
      today: this.ui.ctx.today(),
      selected: this.to ? null : this.from,
      range: this.from && this.to ? { from: this.from, to: this.to } : null,
      heat: (d) => heatLevel(this.heat.get(d) ?? 0),
      onPick: (d) => {
        if (!this.from || this.to) {
          this.from = d;
          this.to = null;
        } else if (d === this.from) {
          this.to = null;
        } else if (d < this.from) {
          this.to = this.from;
          this.from = d;
        } else this.to = d;
        this.renderGrid();
      },
      onMonthChange: (m) => {
        this.month = m;
        this.renderGrid();
      },
    });
    const short = (d: string): string => `${Number(d.slice(8, 10))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1] ?? ''}`;
    this.applyBtn.disabled = !this.from;
    this.applyBtn.setText(this.from && this.to ? `Aplicar rango (${short(this.from)} – ${short(this.to)})`
      : this.from ? `Aplicar día (${short(this.from)})` : 'Elige un día');
  }

  private finish(p: Period): void {
    this.close();
    this.onPick(p);
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

// ───────────── Pestaña ─────────────

export function mountStatistics(root: HTMLElement, ui: TimeUi): () => void {
  const ctx = ui.ctx;
  const svc = ui.service;
  let period = loadPeriod(ctx.cache.get<unknown>(PERIOD_KEY, null), ctx.today());
  const openPaths = new Set<string>();
  let initialized = false;
  let tree: TimeNode | null = null;
  const lists: Array<VirtualList<TimeLog>> = [];

  const header = root.createDiv({ cls: 'dovela-time-stats-header' });
  const summary = root.createDiv({ cls: 'dovela-time-summary' });
  const treeEl = root.createDiv({ cls: 'dovela-time-tree' });

  const range = (): DayRange | null => periodRange(period.kind, period.anchor, period.custom);

  const setPeriod = (p: Period): void => {
    period = p;
    savePeriod(ui, p);
    render();
  };

  const renderHeader = (): void => {
    header.empty();
    const nav = header.createDiv({ cls: 'dovela-time-nav' });
    const canShift = period.kind !== 'all' && period.kind !== 'custom';
    const prev = nav.createEl('button', { cls: 'dovela-time-nav-btn', text: '‹', attr: { 'aria-label': 'Periodo anterior' } });
    const title = nav.createEl('button', { cls: 'dovela-time-nav-title', text: periodTitle(period.kind, range(), ctx.today()), attr: { 'aria-label': 'Elegir periodo' } });
    const next = nav.createEl('button', { cls: 'dovela-time-nav-btn', text: '›', attr: { 'aria-label': 'Periodo siguiente' } });
    prev.disabled = !canShift;
    next.disabled = !canShift;
    const shift = (dir: 1 | -1): void => {
      const kind: PeriodKind = period.kind === 'today' ? 'day' : period.kind;
      const anchor = shiftAnchor(period.kind, period.anchor, dir);
      setPeriod({ kind: kind === 'day' && anchor === ctx.today() ? 'today' : kind, anchor });
    };
    prev.addEventListener('click', () => shift(-1));
    next.addEventListener('click', () => shift(1));
    title.addEventListener('click', () => {
      new PeriodPickerModal(ui, period, dailyTotals(svc.logs().filter((l) => !l.bad)), (p) => setPeriod(p)).open();
    });

    const chips = header.createDiv({ cls: 'dovela-time-chips' });
    for (const q of QUICK) {
      const b = chips.createEl('button', { cls: 'dovela-time-chip', text: q.label });
      if (period.kind === q.kind || (q.kind === 'today' && period.kind === 'day' && period.anchor === ctx.today())) b.addClass('is-active');
      b.addEventListener('click', () => setPeriod({ kind: q.kind, anchor: ctx.today() }));
    }
    const expand = chips.createEl('button', { cls: 'dovela-time-chip', text: '⊞', attr: { 'aria-label': 'Expandir todo' } });
    expand.addEventListener('click', () => expandAll());
    const collapse = chips.createEl('button', { cls: 'dovela-time-chip', text: '⊟', attr: { 'aria-label': 'Colapsar' } });
    collapse.addEventListener('click', () => {
      openPaths.clear();
      openPaths.add(keyOf(tree));
      renderTree();
    });
  };

  const keyOf = (n: TimeNode | null): string => (n ? `/${n.path}` : '/');

  interface Entry { readonly node: TimeNode; readonly details: HTMLDetailsElement; readonly level: number; rendered: boolean }
  const entries = new Map<string, Entry>();

  const openEntry = (e: Entry): void => {
    ensureChildren(e);
    e.details.open = true;
    openPaths.add(keyOf(e.node));
  };

  const ensureChildren = (e: Entry): void => {
    if (e.rendered) return;
    e.rendered = true;
    const body = e.details.createDiv({ cls: 'dovela-time-node-children' });
    for (const c of e.node.children) renderNode(body, c, e.level + 1);
    if (e.node.logs.length) renderLogs(body, e.node.logs);
  };

  const showMenu = (n: TimeNode, ev: MouseEvent): void => {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle('Exportar CSV (guardar en el vault)').setIcon('file-down').onClick(() => void exportCsv(n, false)));
    if (!Platform.isMobile) menu.addItem((i) => i.setTitle('Descargar CSV').setIcon('download').onClick(() => void exportCsv(n, true)));
    menu.showAtMouseEvent(ev);
  };

  const renderNode = (parent: HTMLElement, n: TimeNode, level: number): void => {
    const total = tree?.minutes ?? 0;
    const details = parent.createEl('details', { cls: 'dovela-time-node' });
    details.dataset['kind'] = n.kind;
    if (isTransitNode(n)) details.addClass('is-transit');
    const row = details.createEl('summary', { cls: 'dovela-time-node-row' });
    row.style.setProperty('--dovela-level', String(level));
    row.createSpan({ cls: 'dovela-time-node-icon', text: KIND_ICON[n.kind] });
    row.createSpan({ cls: 'dovela-time-node-name', text: n.name });
    const pct = percent(n.minutes, total);
    const stats = row.createSpan({ cls: 'dovela-time-node-stats' });
    const track = stats.createSpan({ cls: 'dovela-time-bar-track' });
    track.createSpan({ cls: 'dovela-time-bar-fill' }).style.width = `${Math.min(100, pct)}%`;
    stats.createSpan({ cls: 'dovela-time-node-pct', text: `${pct.toFixed(1)}%` });
    stats.createSpan({ cls: 'dovela-time-node-dur', text: formatDuration(Math.round(n.minutes)) });
    stats.createSpan({ cls: 'dovela-time-pill', text: String(n.records), attr: { 'aria-label': `${n.records} registro${n.records === 1 ? '' : 's'}` } });
    if (Platform.isMobile) {
      const more = row.createEl('button', { cls: 'clickable-icon dovela-time-node-more', text: '⋯', attr: { 'aria-label': 'Más acciones' } });
      more.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMenu(n, e);
      });
    }
    const entry: Entry = { node: n, details, level, rendered: false };
    entries.set(keyOf(n), entry);
    details.addEventListener('toggle', () => {
      if (details.open) {
        ensureChildren(entry);
        openPaths.add(keyOf(n));
      } else openPaths.delete(keyOf(n));
    });
    row.addEventListener('click', (e) => {
      if (details.open || !isTransitNode(n)) return;
      // Salto inteligente: abre toda la cadena de nodos de tránsito.
      e.preventDefault();
      openEntry(entry);
      for (const c of smartExpandChain(n)) {
        const ce = entries.get(keyOf(c));
        if (ce) openEntry(ce);
      }
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showMenu(n, e);
    });
    if (openPaths.has(keyOf(n))) openEntry(entry);
  };

  const logRow = (log: TimeLog): HTMLElement => {
    const row = createDiv({ cls: 'dovela-time-log', attr: { role: 'button', tabindex: '0' } });
    const start = new Date(log.start);
    const end = new Date(log.end);
    const day = toLocalYmd(start);
    const badge = row.createDiv({ cls: 'dovela-time-log-date' });
    badge.createSpan({ cls: 'dovela-time-log-day', text: String(start.getDate()) });
    badge.createSpan({ cls: 'dovela-time-log-month', text: MONTHS_SHORT[start.getMonth()] ?? '' });
    const main = row.createDiv({ cls: 'dovela-time-log-main' });
    const l1 = main.createDiv({ cls: 'dovela-time-log-line' });
    const icon = log.kind === 'pomodoro' ? '🍅 ' : log.kind === 'manual' ? '✍️ ' : log.kind === 'import' ? '📥 ' : '';
    l1.createSpan({ cls: 'dovela-muted', text: `${icon}${weekdayNameEs(day)} ${start.getFullYear()}` });
    const endDay = toLocalYmd(end);
    l1.createSpan({ text: `🕒 ${toLocalHm(start)} → ${toLocalHm(end)}${endDay !== day ? ` (${endDay})` : ''}` });
    l1.createSpan({ cls: 'dovela-time-pill', text: formatDuration(durationMinutes(log)) });
    if (log.desc && log.desc !== noteName(log.path)) main.createDiv({ cls: 'dovela-time-log-task', text: `📌 ${log.desc}` });
    if (log.notes) main.createDiv({ cls: 'dovela-time-log-notes', text: `📝 ${log.notes}` });
    const edit = (): void => ui.editLog(log);
    row.addEventListener('click', edit);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        edit();
      }
    });
    return row;
  };

  const renderLogs = (parent: HTMLElement, logs: readonly TimeLog[]): void => {
    const wrap = parent.createDiv({ cls: 'dovela-time-logs' });
    if (logs.length > 150) lists.push(new VirtualList({ container: wrap, items: logs, rowHeight: 72, render: logRow, maxHeight: 480 }));
    else for (const l of logs) wrap.appendChild(logRow(l));
  };

  const expandAll = (): void => {
    const visit = (n: TimeNode): void => {
      openPaths.add(keyOf(n));
      n.children.forEach(visit);
    };
    if (tree) visit(tree);
    renderTree();
  };

  const renderTree = (): void => {
    const sp = scrollParent(root);
    const top = sp?.scrollTop ?? 0;
    lists.splice(0).forEach((l) => l.destroy());
    entries.clear();
    treeEl.empty();
    if (!tree || tree.records === 0) {
      treeEl.createDiv({ cls: 'dovela-time-empty', text: svc.store.loaded ? 'No hay registros de tiempo para el período seleccionado.' : 'Cargando registros…' });
    } else {
      if (!initialized) {
        // Primera vez: abiertos los dos primeros niveles (como v1).
        openPaths.add(keyOf(tree));
        tree.children.forEach((c) => openPaths.add(keyOf(c)));
        initialized = true;
      }
      renderNode(treeEl, tree, 0);
    }
    if (sp) sp.scrollTop = top;
  };

  const render = (): void => {
    const r = range();
    tree = buildTimeTree(svc.logs(), r);
    renderHeader();
    summary.empty();
    const pomos = tree ? collectLogs(tree).filter((l) => l.kind === 'pomodoro').length : 0;
    summary.createDiv({ cls: 'dovela-time-summary-item', text: `⏱️ Tiempo total: ${formatDuration(Math.round(tree.minutes))}` });
    summary.createDiv({ cls: 'dovela-time-summary-item', text: `🧾 Registros: ${tree.records}` });
    if (pomos) summary.createDiv({ cls: 'dovela-time-summary-item', text: `🍅 Pomodoros: ${pomos}` });
    renderTree();
  };

  const exportCsv = async (n: TimeNode, download: boolean): Promise<void> => {
    const logs = collectLogs(n);
    if (!logs.length) {
      new Notice('Dovela: no hay registros de tiempo para exportar en este nodo.');
      return;
    }
    const t = ctx.settings.value.time;
    const csv = logsToCsv(logs, t.csvSeparator);
    const base = safeFileName(`Exportación - ${n.name} - ${exportRangeText(period.kind, range(), ctx.today())}`);
    try {
      if (download) {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.body.createEl('a', { href: url, attr: { download: `${base}.csv` } });
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        new Notice(`Dovela: descarga iniciada (${logs.length} registros).`);
        return;
      }
      const vault = ui.app.vault;
      const folder = normalizePath(t.exportFolder || 'Dovela/Exportaciones');
      if (!vault.getAbstractFileByPath(folder)) {
        try {
          await vault.createFolder(folder);
        } catch {
          // Puede existir ya (carrera con Sync).
        }
      }
      let path = normalizePath(`${folder}/${base}.csv`);
      for (let i = 2; vault.getAbstractFileByPath(path); i++) path = normalizePath(`${folder}/${base} (${i}).csv`);
      await vault.create(path, csv);
      new Notice(`Dovela: CSV guardado en «${path}» (${logs.length} registros).`, 8000);
    } catch (e) {
      logger.error('No se pudo exportar el CSV', e);
      new Notice('Dovela: no se pudo exportar el CSV.');
    }
  };

  const refresher = new Refresher(root, render);
  const offs: Array<() => void> = [];
  offs.push(svc.onChange(() => refresher.invalidate()));
  offs.push(ui.onTick(() => {
    if (period.kind === 'today' && period.anchor !== ctx.today()) {
      period = { kind: 'today', anchor: ctx.today() };
      refresher.invalidate();
    }
    refresher.flush();
  }));
  void svc.ready().then(() => refresher.invalidate());

  render();

  return () => {
    offs.forEach((f) => f());
    refresher.dispose();
    lists.splice(0).forEach((l) => l.destroy());
    root.empty();
  };
}
