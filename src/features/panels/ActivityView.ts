/**
 * Panel de actividad (v1: `moduloActividad/activityView.ts`). Misma vista (`dovela-activity-view`),
 * métricas calculadas sobre el índice (sin leer el vault) y reactiva a sus cambios.
 */
import { setTooltip } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import { isValidYmd } from '../../core/dates';
import type { NoteRecord } from '../../core/index/store';
import {
  ACTIVITY_PERIODS, computeActivity, formatBalance, periodLabel, periodRange, rangeDays, seriesMax,
  type ActivityMetrics, type ActivityPeriod, type DayRange, type NoteHit, type SeriesPoint, type TaskHit,
} from '../../core/panels/activity';
import type { Task } from '../../core/tasks/model';
import { renderMonthGrid } from '../../ui/MonthGrid';
import { VirtualList } from '../../ui/VirtualList';
import { IndexedPanelView, formatInstant, openFromPanel } from './common';

export const ACTIVITY_VIEW_TYPE = 'dovela-activity-view';
export const ACTIVITY_VIEW_TITLE = 'Panel de Actividad';
export const ACTIVITY_VIEW_ICON = 'activity';

type Metric = 'captured' | 'completed' | 'notesCreated' | 'notesModified';
type SeriesMode = 'tasks' | 'notes';

interface ActivityPrefs {
  period: ActivityPeriod;
  from: string | null;
  to: string | null;
  series: SeriesMode;
}

const PREFS_KEY = 'panels.activity';
const DEFAULT_PREFS: ActivityPrefs = { period: 'week', from: null, to: null, series: 'tasks' };
const DETAIL_ROW_HEIGHT = 56;

const METRIC_TITLES: Record<Metric, string> = {
  captured: 'Tareas capturadas',
  completed: 'Tareas completadas',
  notesCreated: 'Notas creadas',
  notesModified: 'Notas modificadas',
};

const SYNC_HINT =
  'Fechas del sistema de archivos de este dispositivo. Con Obsidian Sync, la fecha de creación/modificación ' +
  'puede reflejar el momento en que el archivo llegó a este dispositivo y no cuándo se editó.';

type Metrics = ActivityMetrics<Task, NoteRecord>;

function loadPrefs(ctx: DovelaContext): ActivityPrefs {
  const raw = ctx.cache.get<Partial<ActivityPrefs> | null>(PREFS_KEY, null) ?? {};
  const period = ACTIVITY_PERIODS.some((p) => p.key === raw.period) ? (raw.period as ActivityPeriod) : DEFAULT_PREFS.period;
  return {
    period,
    from: typeof raw.from === 'string' && isValidYmd(raw.from) ? raw.from : null,
    to: typeof raw.to === 'string' && isValidYmd(raw.to) ? raw.to : null,
    series: raw.series === 'notes' ? 'notes' : 'tasks',
  };
}

export class ActivityView extends IndexedPanelView {
  protected readonly rootClass = 'dovela-activity';
  private prefs: ActivityPrefs;
  private screen: Metric | null = null;
  /** Primer día elegido en el calendario del rango personalizado (esperando el segundo). */
  private pickStart: string | null = null;
  private gridMonth: string | null = null;
  private memo: { key: string; metrics: Metrics } | null = null;
  private list: VirtualList<TaskHit<Task>> | VirtualList<NoteHit<NoteRecord>> | null = null;

  constructor(leaf: WorkspaceLeaf, ctx: DovelaContext) {
    super(leaf, ctx);
    this.prefs = loadPrefs(ctx);
  }

  override getViewType(): string {
    return ACTIVITY_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return ACTIVITY_VIEW_TITLE;
  }

  override getIcon(): string {
    return ACTIVITY_VIEW_ICON;
  }

  override async onClose(): Promise<void> {
    this.destroyList();
    await super.onClose();
  }

  private savePrefs(): void {
    this.ctx.cache.set(PREFS_KEY, this.prefs);
  }

  private range(): DayRange {
    return periodRange(this.prefs.period, this.ctx.today(), { from: this.prefs.from ?? undefined, to: this.prefs.to ?? undefined });
  }

  private metrics(range: DayRange): Metrics {
    const store = this.ctx.index.store;
    const timeFolder = this.ctx.settings.value.time.folder;
    const key = `${store.version}|${range.from}|${range.to}|${timeFolder}`;
    if (this.memo?.key === key) return this.memo.metrics;
    const metrics = computeActivity(store.all(), store.allTasks(), range, { excludeNotePrefixes: [timeFolder] });
    this.memo = { key, metrics };
    return metrics;
  }

  private destroyList(): void {
    this.list?.destroy();
    this.list = null;
  }

  protected draw(root: HTMLElement): void {
    this.destroyList();
    const range = this.range();
    const metrics = this.metrics(range);
    root.toggleClass('is-detail', this.screen !== null);
    if (this.screen) this.drawDetail(root, this.screen, metrics);
    else this.drawDashboard(root, range, metrics);
  }

  // ── Panel principal ────────────────────────────────────────────────────────────────

  private drawDashboard(root: HTMLElement, range: DayRange, m: Metrics): void {
    const head = root.createDiv({ cls: 'dovela-panels-head' });
    head.createEl('h2', { text: 'Panel de actividad' });
    const sub = head.createDiv({ cls: 'dovela-muted' });
    sub.setText(`${periodLabel(this.prefs.period, range)} · ${range.from === range.to ? range.from : `${range.from} → ${range.to}`}`);
    if (!this.ctx.index.loaded) root.createDiv({ cls: 'dovela-muted dovela-panels-loading', text: 'Construyendo el índice… los datos se completarán solos.' });

    this.drawPeriodButtons(root);
    if (this.prefs.period === 'custom') this.drawRangePicker(root, range);

    const grid = root.createDiv({ cls: 'dovela-activity-cards' });
    const tasksCard = this.card(grid, '📊 Balance de tareas');
    this.metric(tasksCard, 'captured', 'Capturadas (➕)', m.captured.length, 'Tareas con fecha de creación ➕ dentro del periodo (Smart Inbox, Tasks).');
    this.metric(tasksCard, 'completed', 'Completadas (✅)', m.completed.length, 'Tareas completadas con fecha ✅ dentro del periodo.');
    const bal = tasksCard.createDiv({ cls: 'dovela-activity-metric is-balance' });
    bal.createDiv({ cls: 'dovela-activity-label', text: 'Balance neto' });
    const v = bal.createDiv({ cls: 'dovela-activity-value', text: formatBalance(m.balance) });
    v.addClass(m.balance > 0 ? 'is-positive' : m.balance < 0 ? 'is-negative' : 'is-neutral');
    setTooltip(bal, 'Completadas − capturadas. Positivo: cerraste más de lo que capturaste.');

    const notesCard = this.card(grid, '📝 Actividad de notas');
    this.metric(notesCard, 'notesCreated', 'Creadas', m.notesCreated.length, SYNC_HINT);
    this.metric(notesCard, 'notesModified', 'Modificadas', m.notesModified.length, `Incluye las creadas en el periodo. ${SYNC_HINT}`);
    notesCard.createDiv({ cls: 'dovela-muted dovela-activity-hint', text: 'ⓘ Con Obsidian Sync, las fechas pueden reflejar la llegada del archivo a este dispositivo.' });

    this.drawSeries(root, m);
  }

  private drawPeriodButtons(root: HTMLElement): void {
    const bar = root.createDiv({ cls: 'dovela-panels-seg', attr: { role: 'tablist' } });
    for (const p of ACTIVITY_PERIODS) {
      const b = bar.createEl('button', { text: p.label, attr: { role: 'tab', 'aria-selected': String(p.key === this.prefs.period) } });
      if (p.key === this.prefs.period) b.addClass('is-active');
      b.addEventListener('click', () => {
        this.prefs.period = p.key;
        this.pickStart = null;
        if (p.key === 'custom' && !this.prefs.from) {
          const r = periodRange('custom', this.ctx.today());
          this.prefs.from = r.from;
          this.prefs.to = r.to;
        }
        this.savePrefs();
        this.refresh();
      });
    }
  }

  private drawRangePicker(root: HTMLElement, range: DayRange): void {
    const box = root.createDiv({ cls: 'dovela-activity-range' });
    const info = box.createDiv({ cls: 'dovela-activity-range-info' });
    info.createSpan({ text: this.pickStart ? `Desde ${this.pickStart} · elige el día final` : `Del ${range.from} al ${range.to} (${rangeDays(range)} días)` });
    if (this.pickStart) {
      const cancel = info.createEl('button', { text: 'Cancelar', cls: 'dovela-panels-link' });
      cancel.addEventListener('click', () => {
        this.pickStart = null;
        this.refresh();
      });
    } else {
      info.createSpan({ cls: 'dovela-muted', text: ' · toca el día inicial y luego el final' });
    }
    const month = this.gridMonth ?? range.to;
    renderMonthGrid(box, {
      month,
      today: this.ctx.today(),
      selected: this.pickStart,
      range: this.pickStart ? null : range,
      onPick: (day) => {
        if (!this.pickStart) {
          this.pickStart = day;
        } else {
          const [a, b] = this.pickStart <= day ? [this.pickStart, day] : [day, this.pickStart];
          this.prefs.from = a;
          this.prefs.to = b;
          this.pickStart = null;
          this.savePrefs();
        }
        this.gridMonth = day;
        this.refresh();
      },
      onMonthChange: (anchor) => {
        this.gridMonth = anchor;
        this.refresh();
      },
    });
  }

  private card(parent: HTMLElement, title: string): HTMLElement {
    const card = parent.createDiv({ cls: 'dovela-activity-card' });
    card.createEl('h4', { text: title });
    return card;
  }

  private metric(card: HTMLElement, key: Metric, label: string, value: number, tooltip: string): void {
    const el = card.createEl('button', { cls: 'dovela-activity-metric' });
    el.createDiv({ cls: 'dovela-activity-label', text: label });
    el.createDiv({ cls: 'dovela-activity-value', text: String(value) });
    setTooltip(el, value ? `${tooltip}\nToca para ver el detalle.` : tooltip);
    if (!value) {
      el.disabled = true;
      return;
    }
    el.addClass('is-clickable');
    el.addEventListener('click', () => {
      this.screen = key;
      this.contentEl.scrollTop = 0;
      this.refresh();
    });
  }

  private drawSeries(root: HTMLElement, m: Metrics): void {
    const box = root.createDiv({ cls: 'dovela-activity-series' });
    const head = box.createDiv({ cls: 'dovela-activity-series-head' });
    head.createEl('h4', { text: m.bucket === 'day' ? 'Por día' : m.bucket === 'week' ? 'Por semana' : 'Por mes' });
    const toggle = head.createDiv({ cls: 'dovela-panels-seg is-small' });
    const modes: [SeriesMode, string][] = [['tasks', 'Tareas'], ['notes', 'Notas']];
    for (const [mode, label] of modes) {
      const b = toggle.createEl('button', { text: label });
      if (mode === this.prefs.series) b.addClass('is-active');
      b.addEventListener('click', () => {
        this.prefs.series = mode;
        this.savePrefs();
        this.refresh();
      });
    }
    const keys: [keyof Pick<SeriesPoint, 'captured' | 'completed' | 'created' | 'modified'>, string, string][] =
      this.prefs.series === 'tasks'
        ? [['captured', 'capturadas', 'is-a'], ['completed', 'completadas', 'is-b']]
        : [['created', 'creadas', 'is-a'], ['modified', 'modificadas', 'is-b']];
    const legend = box.createDiv({ cls: 'dovela-activity-legend' });
    for (const [, label, cls] of keys) {
      const item = legend.createSpan({ cls: 'dovela-activity-legend-item' });
      item.createSpan({ cls: `dovela-activity-swatch ${cls}` });
      item.appendText(label);
    }
    const max = seriesMax(m.series, keys.map((k) => k[0]));
    const rows = box.createDiv({ cls: 'dovela-activity-bars' });
    for (const p of m.series) {
      const row = rows.createDiv({ cls: 'dovela-activity-bar-row' });
      if (p.to === this.ctx.today() || (p.from <= this.ctx.today() && p.to >= this.ctx.today())) row.addClass('is-current');
      row.createSpan({ cls: 'dovela-activity-bar-label', text: p.label });
      const bars = row.createDiv({ cls: 'dovela-activity-bar-group' });
      const tip: string[] = [p.from === p.to ? p.from : `${p.from} → ${p.to}`];
      for (const [k, label, cls] of keys) {
        const n = p[k];
        const line = bars.createDiv({ cls: 'dovela-activity-bar-line' });
        const bar = line.createDiv({ cls: `dovela-activity-bar ${cls}` });
        bar.style.width = `${(n / max) * 100}%`;
        line.createSpan({ cls: 'dovela-activity-bar-num', text: n ? String(n) : '' });
        tip.push(`${label}: ${n}`);
      }
      setTooltip(row, tip.join('\n'));
    }
  }

  // ── Detalle ────────────────────────────────────────────────────────────────────────

  private drawDetail(root: HTMLElement, key: Metric, m: Metrics): void {
    const head = root.createDiv({ cls: 'dovela-activity-detail-head' });
    const back = head.createEl('button', { text: '← Volver al panel' });
    back.addEventListener('click', () => {
      this.screen = null;
      this.refresh();
    });
    const items = m[key];
    head.createEl('h3', { text: `${METRIC_TITLES[key]} · ${periodLabel(this.prefs.period, m.range)} (${items.length})` });
    if (key === 'notesCreated' || key === 'notesModified') head.createDiv({ cls: 'dovela-muted', text: SYNC_HINT });
    if (!items.length) {
      root.createEl('p', { cls: 'dovela-muted', text: 'No hay datos para mostrar en este periodo.' });
      return;
    }
    const container = root.createDiv({ cls: 'dovela-activity-detail' });
    if (key === 'captured' || key === 'completed') {
      this.list = new VirtualList<TaskHit<Task>>({
        container, items: m[key], rowHeight: DETAIL_ROW_HEIGHT,
        render: (hit) => this.taskRow(hit, key),
      });
    } else {
      this.list = new VirtualList<NoteHit<NoteRecord>>({
        container, items: m[key], rowHeight: DETAIL_ROW_HEIGHT,
        render: (hit) => this.noteRow(hit, key),
      });
    }
  }

  private taskRow(hit: TaskHit<Task>, key: 'captured' | 'completed'): HTMLElement {
    const t = hit.task;
    const row = createDiv({ cls: 'dovela-activity-row' });
    const main = row.createDiv({ cls: 'dovela-activity-row-main' });
    main.createSpan({ cls: 'dovela-activity-row-status', text: t.status === 'done' ? '☑' : t.status === 'in-progress' ? '◐' : t.status === 'cancelled' ? '☒' : '☐' });
    main.createSpan({ cls: 'dovela-activity-row-text', text: t.text || t.raw.trim() });
    const meta = row.createDiv({ cls: 'dovela-activity-row-meta' });
    meta.createSpan({ text: `${key === 'captured' ? '➕' : '✅'} ${hit.day}` });
    meta.createSpan({ cls: 'dovela-activity-row-note', text: ` · ${t.path.slice(t.path.lastIndexOf('/') + 1).replace(/\.md$/, '')}` });
    setTooltip(row, `${t.raw.trim()}\n${t.path}`);
    row.addEventListener('click', (ev) => void openFromPanel(this.app, this, t.path, t.line, ev));
    return row;
  }

  private noteRow(hit: NoteHit<NoteRecord>, key: 'notesCreated' | 'notesModified'): HTMLElement {
    const n = hit.note;
    const row = createDiv({ cls: 'dovela-activity-row' });
    const main = row.createDiv({ cls: 'dovela-activity-row-main' });
    main.createSpan({ cls: 'dovela-activity-row-text', text: n.basename });
    const meta = row.createDiv({ cls: 'dovela-activity-row-meta' });
    meta.createSpan({ text: `${key === 'notesCreated' ? 'Creada' : 'Modificada'}: ${formatInstant(hit.at)}` });
    if (n.folder) meta.createSpan({ cls: 'dovela-activity-row-note', text: ` · ${n.folder}` });
    setTooltip(row, n.path);
    row.addEventListener('click', (ev) => void openFromPanel(this.app, this, n.path, undefined, ev));
    return row;
  }
}
