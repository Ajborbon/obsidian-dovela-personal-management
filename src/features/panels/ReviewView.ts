/**
 * Panel de revisión GTD (v1: `moduloGTDv3/reviewPanelView.ts`). Misma vista (`dovela-gtd-review-panel-view`).
 * Proyectos estancados calculados sobre el índice, acciones seguras (añadir tarea, archivar con confirmación,
 * abrir nota), botón de refrescar, resumen por nivel (backlog v0.9) y lint informativo de tareas en notas de conocimiento.
 */
import { Notice, TFile, setTooltip } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import { appendEmptyTask } from '../../core/panels/addTask';
import {
  collectProjects, findStalledProjects, knowledgeNotesWithTasks, summarizeProjects,
  type KnowledgeTaskNote, type LevelSummary, type ProjectInfo, type StalledProject,
} from '../../core/panels/stalled';
import { logger } from '../../host/logger';
import { ConfirmModal, IndexedPanelView, formatInstant, openAtCursor, openFromPanel } from './common';

export const REVIEW_VIEW_TYPE = 'dovela-gtd-review-panel-view';
export const REVIEW_VIEW_TITLE = 'Panel de Revisión GTD';
export const REVIEW_VIEW_ICON = 'clipboard-check';

interface ReviewPrefs {
  staleDays: number;
  showStale: boolean;
  showKnowledge: boolean;
}

const PREFS_KEY = 'panels.review';
const DEFAULT_PREFS: ReviewPrefs = { staleDays: 30, showStale: false, showKnowledge: false };

function loadPrefs(ctx: DovelaContext): ReviewPrefs {
  const raw = ctx.cache.get<Partial<ReviewPrefs> | null>(PREFS_KEY, null) ?? {};
  const days = Number(raw.staleDays);
  return {
    staleDays: Number.isFinite(days) && days >= 1 && days <= 3650 ? Math.round(days) : DEFAULT_PREFS.staleDays,
    showStale: raw.showStale === true,
    showKnowledge: raw.showKnowledge === true,
  };
}

const LEVEL_LABELS = ['1.er nivel', '2.º nivel', '3.er nivel o más'];
const ESTADO_COLUMNS: [keyof Pick<LevelSummary, 'active' | 'paused' | 'blocked' | 'archived' | 'none'>, string, string][] = [
  ['active', '🟢', 'Activos'],
  ['paused', '🟡', 'Pausados'],
  ['blocked', '🔴', 'Bloqueados'],
  ['archived', '🔵', 'Archivados'],
  ['none', '—', 'Sin estado'],
];

export class ReviewView extends IndexedPanelView {
  protected readonly rootClass = 'dovela-review';
  private prefs: ReviewPrefs;
  /** Rutas con una acción en curso (evita dobles toques). */
  private readonly busy = new Set<string>();
  private lastComputed = 0;

  constructor(leaf: WorkspaceLeaf, ctx: DovelaContext) {
    super(leaf, ctx);
    this.prefs = loadPrefs(ctx);
  }

  override getViewType(): string {
    return REVIEW_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return REVIEW_VIEW_TITLE;
  }

  override getIcon(): string {
    return REVIEW_VIEW_ICON;
  }

  private savePrefs(): void {
    this.ctx.cache.set(PREFS_KEY, this.prefs);
  }

  protected draw(root: HTMLElement): void {
    const store = this.ctx.index.store;
    const collected = collectProjects(store);
    const stalled = findStalledProjects(store, collected);
    this.lastComputed = this.ctx.now().getTime();

    const head = root.createDiv({ cls: 'dovela-panels-head dovela-review-head' });
    head.createEl('h2', { text: 'Panel de revisión GTD' });
    const refresh = head.createEl('button', { cls: 'dovela-review-refresh', text: '⟳ Refrescar' });
    setTooltip(refresh, 'Recalcula el panel. También se actualiza solo cuando cambian tus notas.');
    refresh.addEventListener('click', () => {
      this.refresh();
      new Notice('Panel de revisión actualizado', 1500);
    });
    head.createDiv({ cls: 'dovela-muted', text: `Actualizado ${formatInstant(this.lastComputed)}` });
    if (!this.ctx.index.loaded) root.createDiv({ cls: 'dovela-muted dovela-panels-loading', text: 'Construyendo el índice… el resultado puede estar incompleto.' });

    this.drawStalled(root, stalled);
    this.drawSummary(root, collected.projects);
    this.drawKnowledge(root);
  }

  // ── Estancados ─────────────────────────────────────────────────────────────────────

  private drawStalled(root: HTMLElement, stalled: readonly StalledProject[]): void {
    const sec = root.createDiv({ cls: 'dovela-review-section' });
    sec.createEl('h3', { text: 'Proyectos estancados' });
    if (!stalled.length) {
      sec.createDiv({
        cls: 'dovela-review-empty',
        text: '✅ ¡Excelente! Todos tus proyectos tienen próximas acciones definidas. ¡Sigue así!',
      });
      return;
    }
    sec.createEl('p', {
      cls: 'dovela-muted',
      text: `Se encontraron ${stalled.length} ${stalled.length === 1 ? 'proyecto activo (🟢) que no tiene' : 'proyectos activos (🟢) que no tienen'} próximas acciones definidas ` +
        '(ninguna tarea abierta en su carpeta ni en las notas enlazadas a 2 niveles).',
    });
    const list = sec.createEl('ul', { cls: 'dovela-review-list' });
    for (const p of stalled) this.stalledItem(list, p);
  }

  private stalledItem(list: HTMLElement, p: StalledProject): void {
    const li = list.createEl('li', { cls: 'dovela-review-item' });
    const info = li.createDiv({ cls: 'dovela-review-item-info' });
    const name = info.createEl('a', { cls: 'dovela-review-item-name', text: p.name, href: '#' });
    name.addEventListener('click', (ev) => {
      ev.preventDefault();
      void openFromPanel(this.app, this, p.path, undefined, ev);
    });
    info.createDiv({ cls: 'dovela-muted', text: `📂 ${p.folder} · ${p.filesChecked} notas revisadas · nivel ${p.level}` });

    const actions = li.createDiv({ cls: 'dovela-review-actions' });
    const busy = this.busy.has(p.path);
    const add = actions.createEl('button', { cls: 'mod-cta', text: '+ Añadir tarea' });
    setTooltip(add, `Añade «- [ ] » al final de «${this.tasksHeading()}» y coloca el cursor.`);
    add.addEventListener('click', () => void this.addTask(p));
    const archive = actions.createEl('button', { text: '🔵 Archivar' });
    setTooltip(archive, 'Cambia el estado del proyecto a 🔵 (pide confirmación).');
    archive.addEventListener('click', () => void this.archive(p));
    const open = actions.createEl('button', { text: 'Abrir nota' });
    open.addEventListener('click', (ev) => void openFromPanel(this.app, this, p.path, undefined, ev));
    if (busy) for (const b of [add, archive, open]) b.disabled = true;
  }

  private tasksHeading(): string {
    return this.ctx.settings.value.general.tasksHeading.trim() || '## Tareas';
  }

  private async withBusy(path: string, fn: () => Promise<void>): Promise<void> {
    if (this.busy.has(path)) return;
    this.busy.add(path);
    this.refresh();
    try {
      await fn();
    } catch (e) {
      logger.error('Acción del panel de revisión', e);
      new Notice(`Dovela: no se pudo completar la acción (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      this.busy.delete(path);
      this.invalidate();
    }
  }

  private async addTask(p: ProjectInfo): Promise<void> {
    await this.withBusy(p.path, async () => {
      const file = this.app.vault.getAbstractFileByPath(p.path);
      if (!(file instanceof TFile)) {
        new Notice(`Dovela: la nota ya no existe: ${p.path}`);
        return;
      }
      const heading = this.tasksHeading();
      let pos = { line: 0, ch: 0, createdHeading: false };
      await this.app.vault.process(file, (data) => {
        const r = appendEmptyTask(data, heading);
        pos = { line: r.line, ch: r.ch, createdHeading: r.createdHeading };
        return r.content;
      });
      await openAtCursor(this.app, this, p.path, pos.line, pos.ch, '- [ ] ');
      new Notice(pos.createdHeading ? `Sección «${heading}» creada en ${p.name}. Escribe la próxima acción.` : `Escribe la próxima acción de ${p.name}.`);
    });
  }

  private async archive(p: ProjectInfo): Promise<void> {
    const ok = await new ConfirmModal(
      this.app,
      'Archivar proyecto',
      `¿Cambiar el estado de «${p.name}» a 🔵 (archivado)? Se modifica la propiedad «estado» de ${p.path}.`,
      '🔵 Archivar',
    ).ask();
    if (!ok) return;
    await this.withBusy(p.path, async () => {
      const file = this.app.vault.getAbstractFileByPath(p.path);
      if (!(file instanceof TFile)) {
        new Notice(`Dovela: la nota ya no existe: ${p.path}`);
        return;
      }
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm['estado'] = '🔵';
      });
      new Notice(`Proyecto «${p.name}» archivado (🔵).`);
    });
  }

  // ── Resumen por nivel ──────────────────────────────────────────────────────────────

  private drawSummary(root: HTMLElement, projects: readonly ProjectInfo[]): void {
    const sec = root.createDiv({ cls: 'dovela-review-section' });
    sec.createEl('h3', { text: `Proyectos PGTD (${projects.length})` });
    const ctl = sec.createDiv({ cls: 'dovela-review-days' });
    const label = ctl.createEl('label', { text: 'Sin modificar hace más de ' });
    const input = label.createEl('input', { type: 'number', attr: { min: '1', max: '3650', inputmode: 'numeric', 'aria-label': 'Días sin modificar' } });
    input.value = String(this.prefs.staleDays);
    label.appendText(' días');
    input.addEventListener('change', () => {
      const v = Math.round(Number(input.value));
      if (!Number.isFinite(v) || v < 1 || v > 3650) {
        input.value = String(this.prefs.staleDays);
        return;
      }
      this.prefs.staleDays = v;
      this.savePrefs();
      this.refresh();
    });

    const summary = summarizeProjects(projects, this.ctx.now().getTime(), this.prefs.staleDays);
    const wrap = sec.createDiv({ cls: 'dovela-review-table-wrap' });
    const table = wrap.createEl('table', { cls: 'dovela-review-table' });
    const hr = table.createEl('thead').createEl('tr');
    hr.createEl('th', { text: 'Nivel' });
    for (const [, icon, title] of ESTADO_COLUMNS) {
      const th = hr.createEl('th', { text: icon });
      setTooltip(th, title);
      th.setAttr('aria-label', title);
    }
    const thStale = hr.createEl('th', { text: '⏳' });
    setTooltip(thStale, `No archivados sin modificar hace más de ${this.prefs.staleDays} días`);
    thStale.setAttr('aria-label', 'Sin modificar');
    hr.createEl('th', { text: 'Total' });
    const body = table.createEl('tbody');
    const totals = { active: 0, paused: 0, blocked: 0, archived: 0, none: 0, stale: 0, total: 0 };
    summary.levels.forEach((l, i) => {
      const tr = body.createEl('tr');
      tr.createEl('th', { text: LEVEL_LABELS[i] ?? `${l.level}` });
      for (const [k] of ESTADO_COLUMNS) {
        tr.createEl('td', { text: String(l[k]) });
        totals[k] += l[k];
      }
      tr.createEl('td', { text: String(l.stale), cls: l.stale ? 'is-warning' : '' });
      tr.createEl('td', { text: String(l.total) });
      totals.stale += l.stale;
      totals.total += l.total;
    });
    const tf = table.createEl('tfoot').createEl('tr');
    tf.createEl('th', { text: 'Total' });
    for (const [k] of ESTADO_COLUMNS) tf.createEl('td', { text: String(totals[k]) });
    tf.createEl('td', { text: String(totals.stale) });
    tf.createEl('td', { text: String(totals.total) });
    sec.createDiv({ cls: 'dovela-muted', text: '🟢 activos · 🟡 pausados · 🔴 bloqueados · 🔵 archivados · — sin estado · ⏳ sin modificar (fecha más reciente de cualquier nota de la carpeta del proyecto).' });

    this.lazyDetails(sec, `Proyectos sin modificar hace más de ${this.prefs.staleDays} días (${summary.staleProjects.length})`, this.prefs.showStale, (open) => {
      this.prefs.showStale = open;
      this.savePrefs();
    }, (el) => {
      if (!summary.staleProjects.length) {
        el.createDiv({ cls: 'dovela-muted', text: 'Ninguno.' });
        return;
      }
      const ul = el.createEl('ul', { cls: 'dovela-review-simple-list' });
      for (const p of summary.staleProjects) {
        const li = ul.createEl('li', { cls: 'dovela-review-simple-item' });
        li.createSpan({ cls: 'dovela-review-badge', text: p.estado || '—' });
        li.createSpan({ cls: 'dovela-review-simple-name', text: p.name });
        li.createSpan({ cls: 'dovela-muted', text: ` hace ${p.daysSince} días` });
        setTooltip(li, `${p.folder}\nÚltima modificación: ${formatInstant(p.lastModified)}`);
        li.addEventListener('click', (ev) => void openFromPanel(this.app, this, p.path, undefined, ev));
      }
    });
  }

  // ── Tareas en notas de conocimiento ────────────────────────────────────────────────

  private drawKnowledge(root: HTMLElement): void {
    const notes = knowledgeNotesWithTasks(this.ctx.index.store.all());
    const sec = root.createDiv({ cls: 'dovela-review-section' });
    this.lazyDetails(sec, `Tareas en notas de conocimiento (${notes.length})`, this.prefs.showKnowledge, (open) => {
      this.prefs.showKnowledge = open;
      this.savePrefs();
    }, (el) => this.knowledgeList(el, notes));
  }

  private knowledgeList(el: HTMLElement, notes: readonly KnowledgeTaskNote[]): void {
    el.createDiv({
      cls: 'dovela-muted',
      text: 'Solo informativo. Según las reglas del vault, las tareas viven en notas contenedor (PGTD, RR, Reu, AV, AI, PQ); ' +
        'estas notas de conocimiento (Ax, Btx, Vx, Ref, Sue, Podx, Prx, Cmt) tienen tareas abiertas.',
    });
    if (!notes.length) {
      el.createDiv({ cls: 'dovela-review-empty', text: '✅ Ninguna nota de conocimiento tiene tareas abiertas.' });
      return;
    }
    const ul = el.createEl('ul', { cls: 'dovela-review-simple-list' });
    for (const n of notes) {
      const li = ul.createEl('li', { cls: 'dovela-review-simple-item' });
      li.createSpan({ cls: 'dovela-review-badge', text: n.type });
      li.createSpan({ cls: 'dovela-review-simple-name', text: n.basename });
      li.createSpan({ cls: 'dovela-muted', text: ` · ${n.openTasks} ${n.openTasks === 1 ? 'abierta' : 'abiertas'}` });
      setTooltip(li, n.path);
      li.addEventListener('click', (ev) => {
        const first = this.ctx.index.store.tasksOf(n.path).find((t) => t.status === 'open' || t.status === 'in-progress');
        void openFromPanel(this.app, this, n.path, first?.line, ev);
      });
    }
  }

  /** `<details>` cuyo contenido se construye al abrirse (render perezoso, 02 §5). */
  private lazyDetails(parent: HTMLElement, title: string, open: boolean, onToggle: (open: boolean) => void, build: (el: HTMLElement) => void): void {
    const det = parent.createEl('details', { cls: 'dovela-review-details' });
    det.createEl('summary', { text: title });
    const body = det.createDiv({ cls: 'dovela-review-details-body' });
    let built = false;
    const ensure = (): void => {
      if (built) return;
      built = true;
      build(body);
    };
    if (open) {
      det.open = true;
      ensure();
    }
    det.addEventListener('toggle', () => {
      if (det.open) ensure();
      onToggle(det.open);
    });
  }
}
