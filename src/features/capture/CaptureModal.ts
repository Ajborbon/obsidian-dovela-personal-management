/**
 * Smart Inbox (F6): captura rápida sobre un `Modal` nativo (foco, Esc, scrim y teclado móvil de Obsidian).
 * Un input + un panel único bajo él (menú `@`/`#` o calendario `!`) + vista previa en vivo de la línea
 * que se guardará + avisos + ayuda de sintaxis.
 *
 * Teclado: ↑↓ mueven, Enter/Tab eligen, Esc cierra el panel (y luego la ventana), Enter envía si el
 * menú no tiene opciones. Backspace sobre `#cx-` vuelve al menú principal.
 */
import type { App } from 'obsidian';
import { Modal, Notice, Platform } from 'obsidian';
import type { DovelaContext } from '../../context';
import { addDays, compareYmd, toLocalHm, toLocalYmd } from '../../core/dates';
import { parseLegacyDate } from '../../core/capture/dates';
import { normalizeNotePath } from '../../core/capture/insert';
import {
  applyInsert,
  buildMenu,
  collapsePrefixOnBackspace,
  findTrigger,
  projectQueryAlive,
  type ActiveTrigger,
  type MenuData,
  type MenuModel,
  type TextEdit,
} from '../../core/capture/menu';
import { buildMenuData, projectRefs, type ActiveNoteInfo } from '../../core/capture/sources';
import {
  DATE_ICON,
  DATE_KINDS,
  DATE_LABEL,
  buildTaskLine,
  parseCapture,
  type CaptureWarning,
  type DateKind,
  type ParsedCapture,
  type ProjectRef,
} from '../../core/capture/tokenize';
import { logger } from '../../host/logger';
import { openNote } from '../../host/navigation';
import { DatePanel, isPastBlocked } from './DatePanel';
import { MenuPanel } from './MenuPanel';
import { appendTaskToNote } from './write';

const HELP_OPEN_KEY = 'capture.helpOpen';

/** Avisos que no tiene sentido mostrar mientras se está escribiendo ese mismo token. */
const QUIET_WHILE: Readonly<Record<string, ReadonlyArray<CaptureWarning['code']>>> = {
  '@': ['project-not-found'],
  '#': ['tag-incomplete', 'gtd-unknown'],
  '!': ['date-unknown'],
};

interface CalState {
  start: number;
  kind: DateKind;
  focus: string;
  month: string;
  error: string;
}

let modalSeq = 0;

export class CaptureModal extends Modal {
  private inputEl!: HTMLInputElement;
  private panelEl!: HTMLElement;
  private menu!: MenuPanel;
  private cal!: DatePanel;
  private destEl!: HTMLElement;
  private lineEl!: HTMLElement;
  private warnEl!: HTMLElement;
  private saveBtn!: HTMLButtonElement;

  private data: MenuData = { projects: [], contexts: [], people: [] };
  private refs: ProjectRef[] = [];
  private trigger: ActiveTrigger | null = null;
  private dismissedStart: number | null = null;
  private model: MenuModel | null = null;
  private selected = 0;
  private calState: CalState | null = null;
  private saving = false;
  private closing = false;
  private readonly disposers: Array<() => void> = [];
  private readonly listId = `dovela-capture-list-${++modalSeq}`;

  constructor(
    app: App,
    private readonly ctx: DovelaContext,
    private readonly active: ActiveNoteInfo | null,
  ) {
    super(app);
  }

  // ───────────────────────── ciclo de vida

  override onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('dovela-capture-modal');
    if (Platform.isMobile) modalEl.addClass('is-mobile');
    this.setTitle('Smart Inbox');
    contentEl.addClass('dovela-capture');

    this.inputEl = contentEl.createEl('input', {
      cls: 'dovela-capture-input',
      type: 'text',
      attr: {
        placeholder: 'Escribe una tarea… (@ proyecto, # etiquetas, ! fecha)',
        autocomplete: 'off',
        autocapitalize: 'sentences',
        spellcheck: 'true',
        enterkeyhint: 'send',
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
        'aria-controls': this.listId,
        'aria-label': 'Tarea a capturar',
      },
    });
    contentEl.createDiv({
      cls: 'dovela-capture-hint',
      text: '@ proyecto · # etiqueta (#cx- #px- #GTD-) · ! fecha (calendario, o escribe !mañana, !viernes, !261120)',
    });

    this.panelEl = contentEl.createDiv({ cls: 'dovela-capture-panel is-hidden' });
    // El input conserva el foco al tocar/pulsar el panel (no se cierra el teclado móvil).
    this.panelEl.addEventListener('mousedown', (e) => e.preventDefault());
    this.menu = new MenuPanel(this.panelEl, this.listId, (i) => this.pick(i), (i) => this.hover(i));
    this.cal = new DatePanel(this.panelEl, {
      onKind: (k) => this.setCal({ kind: k, error: '' }),
      onPick: (d) => this.confirmDate(d),
      onMonth: (m) => this.setCal({ month: m }),
    });

    const preview = contentEl.createDiv({ cls: 'dovela-capture-preview' });
    this.destEl = preview.createDiv({ cls: 'dovela-capture-dest' });
    this.lineEl = preview.createEl('code', { cls: 'dovela-capture-line' });
    this.warnEl = contentEl.createEl('ul', { cls: 'dovela-capture-warnings', attr: { 'aria-live': 'polite' } });

    this.renderHelp(contentEl);

    const buttons = contentEl.createDiv({ cls: 'dovela-capture-buttons' });
    const cancel = buttons.createEl('button', { text: 'Cancelar', attr: { type: 'button' } });
    cancel.addEventListener('click', () => this.forceClose());
    this.saveBtn = buttons.createEl('button', { cls: 'mod-cta', text: 'Guardar', attr: { type: 'button' } });
    this.saveBtn.addEventListener('click', () => void this.submit());

    this.inputEl.addEventListener('input', () => this.refresh());
    this.inputEl.addEventListener('keydown', (e) => this.onKeyDown(e));
    // Movimientos del cursor sin cambiar el texto (clic, flechas laterales sin panel, Inicio/Fin).
    this.inputEl.addEventListener('click', () => this.refresh());
    this.inputEl.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !this.panelOpen()) this.refresh();
    });

    this.loadData();
    if (!this.ctx.index.loaded) {
      void this.ctx.index.ready.then(() => {
        if (!this.closing) {
          this.loadData();
          this.refresh();
        }
      });
    }
    this.disposers.push(this.ctx.index.onChange(() => {
      this.loadData();
      this.refresh();
    }));
    this.watchViewport();

    this.refresh();
    this.inputEl.focus();
    // En móvil el foco a veces se pierde durante la animación de apertura.
    const t = window.setTimeout(() => this.inputEl.focus(), 60);
    this.disposers.push(() => window.clearTimeout(t));
  }

  override onClose(): void {
    this.closing = true;
    for (const d of this.disposers.splice(0)) {
      try {
        d();
      } catch (e) {
        logger.error('Smart Inbox: error al limpiar', e);
      }
    }
    this.contentEl.empty();
  }

  /** Esc / scrim / botón ✕: primero cierra el panel abierto; la segunda vez, la ventana. */
  override close(): void {
    if (!this.closing && this.panelOpen()) {
      this.dismissPanel();
      return;
    }
    this.closing = true;
    super.close();
  }

  private forceClose(): void {
    this.closing = true;
    super.close();
  }

  // ───────────────────────── datos

  private loadData(): void {
    const store = this.ctx.index.store;
    const active = this.active ? { ...this.active, type: this.active.type ?? store.get(this.active.path)?.type ?? '' } : null;
    this.data = buildMenuData(store.all(), store.allTasks(), active);
    this.refs = projectRefs(store.all(), this.data.projects);
  }

  /** Ajusta el alto disponible al teclado virtual (visualViewport) para que no tape el panel. */
  private watchViewport(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = (): void => {
      // El panel puede estar oculto (rect vacío): se mide desde el borde inferior del campo.
      const panelTop = this.panelEl.getBoundingClientRect().top;
      const top = panelTop > 0 ? panelTop : this.inputEl.getBoundingClientRect().bottom + 28;
      const avail = Math.max(140, Math.floor(vv.height + vv.offsetTop - top - 12));
      this.modalEl.style.setProperty('--dovela-capture-panel-max', `${avail}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    this.disposers.push(() => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    });
    update();
  }

  // ───────────────────────── estado derivado del texto

  private cursor(): number {
    return this.inputEl.selectionStart ?? this.inputEl.value.length;
  }

  private panelOpen(): boolean {
    return this.trigger !== null;
  }

  private refresh(): void {
    const text = this.inputEl.value;
    const raw = findTrigger(text, this.cursor(), (q) => projectQueryAlive(q, this.data.projects));
    if (!raw) this.dismissedStart = null;
    this.trigger = raw && raw.start !== this.dismissedStart ? raw : null;

    const t = this.trigger;
    if (!t) {
      this.model = null;
      this.calState = null;
      this.showPanel(null);
    } else if (t.kind === '!') {
      this.model = null;
      this.syncCalendar(t);
      this.showPanel('cal');
    } else {
      this.calState = null;
      // La mejor coincidencia queda arriba: la selección vuelve a la primera en cada cambio.
      const model = buildMenu(t, this.data);
      this.model = !this.ctx.index.loaded && model.options.length === 0
        ? { ...model, emptyText: 'Cargando el índice del vault… las sugerencias aparecerán en un momento.' }
        : model;
      this.selected = 0;
      this.menu.render(this.model, this.selected);
      this.showPanel('menu');
    }
    this.renderPreview();
  }

  private showPanel(which: 'menu' | 'cal' | null): void {
    this.panelEl.toggleClass('is-hidden', which === null);
    this.menu.el.toggleClass('is-hidden', which !== 'menu');
    this.cal.el.toggleClass('is-hidden', which !== 'cal');
    this.inputEl.setAttr('aria-expanded', String(which === 'menu'));
    const active = which === 'menu' ? this.menu.activeId() : null;
    if (active) this.inputEl.setAttr('aria-activedescendant', active);
    else this.inputEl.removeAttribute('aria-activedescendant');
  }

  private dismissPanel(): void {
    if (this.trigger) this.dismissedStart = this.trigger.start;
    this.trigger = null;
    this.model = null;
    this.calState = null;
    this.showPanel(null);
    this.renderPreview();
    this.inputEl.focus();
  }

  private setText(edit: TextEdit): void {
    this.inputEl.value = edit.text;
    this.inputEl.focus();
    this.inputEl.setSelectionRange(edit.cursor, edit.cursor);
    this.refresh();
  }

  // ───────────────────────── menú

  private hover(i: number): void {
    this.selected = i;
    this.menu.setSelected(i);
  }

  private pick(i: number): void {
    const t = this.trigger;
    const opt = this.model?.options[i];
    if (!t || !opt) return;
    this.setText(applyInsert(this.inputEl.value, t, opt.insert, opt.keepOpen));
  }

  // ───────────────────────── calendario

  private syncCalendar(t: ActiveTrigger): void {
    const today = this.ctx.today();
    const typed = t.query.trim();
    const parsed = typed ? parseLegacyDate(typed, today) : null;
    if (!this.calState || this.calState.start !== t.start) {
      const focus = parsed ?? today;
      this.calState = { start: t.start, kind: 'due', focus, month: focus, error: '' };
    } else if (parsed) {
      this.calState.focus = parsed;
      this.calState.month = parsed;
    }
    this.renderCalendar(typed, parsed !== null);
  }

  private renderCalendar(typed: string, typedOk: boolean): void {
    const s = this.calState;
    if (!s) return;
    this.cal.render({ kind: s.kind, focus: s.focus, month: s.month, today: this.ctx.today(), typed, typedOk, error: s.error });
  }

  private setCal(patch: Partial<CalState>): void {
    if (!this.calState || !this.trigger) return;
    Object.assign(this.calState, patch);
    const typed = this.trigger.query.trim();
    this.renderCalendar(typed, typed ? parseLegacyDate(typed, this.ctx.today()) !== null : false);
    this.inputEl.focus();
  }

  private moveFocus(days: number): void {
    const s = this.calState;
    if (!s) return;
    const focus = addDays(s.focus, days);
    this.setCal({ focus, month: focus, error: '' });
  }

  private confirmDate(day: string): void {
    const t = this.trigger;
    const s = this.calState;
    if (!t || t.kind !== '!' || !s) return;
    const today = this.ctx.today();
    if (isPastBlocked(s.kind, day, today)) {
      this.setCal({ focus: day, month: day, error: `${DATE_ICON[s.kind]} ${DATE_LABEL[s.kind]} no admite fechas pasadas (solo 📅 Vence).` });
      return;
    }
    this.setText(applyInsert(this.inputEl.value, t, `${DATE_ICON[s.kind]} ${day}`, false));
  }

  private onCalendarKey(e: KeyboardEvent, t: ActiveTrigger): boolean {
    const s = this.calState;
    if (!s) return false;
    switch (e.key) {
      case 'Tab': {
        const i = DATE_KINDS.indexOf(s.kind);
        const n = DATE_KINDS.length;
        this.setCal({ kind: DATE_KINDS[(i + (e.shiftKey ? n - 1 : 1)) % n] ?? 'due', error: '' });
        return true;
      }
      case 'ArrowLeft': this.moveFocus(-1); return true;
      case 'ArrowRight': this.moveFocus(1); return true;
      case 'ArrowUp': this.moveFocus(-7); return true;
      case 'ArrowDown': this.moveFocus(7); return true;
      case 'Enter': {
        const typed = t.query.trim();
        if (typed && parseLegacyDate(typed, this.ctx.today()) === null) return false; // no es fecha → enviar
        this.confirmDate(s.focus);
        return true;
      }
      default:
        return false;
    }
  }

  // ───────────────────────── teclado

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const t = this.trigger;
    if (t?.kind === '!' && !e.altKey && !e.ctrlKey && !e.metaKey && this.onCalendarKey(e, t)) {
      e.preventDefault();
      return;
    }
    if (t && t.kind !== '!' && this.model) {
      const n = this.model.options.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (n) this.hover((this.selected + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        const id = this.menu.activeId();
        if (id) this.inputEl.setAttr('aria-activedescendant', id);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && n > 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.pick(this.selected);
        return;
      }
      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey && this.inputEl.selectionStart === this.inputEl.selectionEnd) {
        const edit = collapsePrefixOnBackspace(this.inputEl.value, this.cursor(), t);
        if (edit) {
          e.preventDefault();
          this.setText(edit);
          return;
        }
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void this.submit();
    }
  }

  // ───────────────────────── vista previa y guardado

  private parse(): ParsedCapture {
    return parseCapture(this.inputEl.value, { today: this.ctx.today(), projects: this.refs });
  }

  private stamp(): { date: string; time?: string } {
    const now = this.ctx.now();
    return this.ctx.settings.value.general.createdStampWithTime ? { date: toLocalYmd(now), time: toLocalHm(now) } : { date: toLocalYmd(now) };
  }

  private destination(p: ParsedCapture): string {
    return p.project?.path ?? normalizeNotePath(this.ctx.settings.value.general.inboxPath);
  }

  private renderPreview(): void {
    const text = this.inputEl.value;
    this.warnEl.empty();
    if (!text.trim()) {
      this.destEl.setText(`→ ${this.destName(normalizeNotePath(this.ctx.settings.value.general.inboxPath))} (sin @ va a la Bandeja de entrada)`);
      this.lineEl.setText('La línea que se guardará aparecerá aquí.');
      this.lineEl.addClass('is-placeholder');
      return;
    }
    const p = this.parse();
    this.lineEl.removeClass('is-placeholder');
    this.lineEl.setText(buildTaskLine(p, this.stamp()));
    const dest = this.destination(p);
    this.destEl.setText(`→ ${this.destName(dest)}${p.project ? '' : ' (Bandeja de entrada)'}`);
    const quiet = this.trigger ? QUIET_WHILE[this.trigger.kind] ?? [] : [];
    for (const w of p.warnings) {
      if (quiet.includes(w.code)) continue;
      if (w.code === 'empty' && this.trigger) continue;
      this.warnEl.createEl('li', { cls: `dovela-capture-warning is-${w.code}`, text: `⚠️ ${w.message}` });
    }
    const today = this.ctx.today();
    for (const k of ['start', 'scheduled'] as const) {
      const d = p.dates[k];
      if (d && compareYmd(d, today) < 0) {
        this.warnEl.createEl('li', { cls: 'dovela-capture-warning is-info', text: `ℹ️ ${DATE_ICON[k]} ${DATE_LABEL[k]} (${d}) es anterior a hoy.` });
      }
    }
  }

  private destName(path: string): string {
    return `[[${path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/iu, '')}]]`;
  }

  private async submit(): Promise<void> {
    if (this.saving) return;
    const p = this.parse();
    if (!p.description) {
      new Notice('Smart Inbox: la descripción está vacía; no se guardó nada.');
      this.renderPreview();
      this.inputEl.focus();
      return;
    }
    this.saving = true;
    this.saveBtn.disabled = true;
    const line = buildTaskLine(p, this.stamp());
    const heading = this.ctx.settings.value.general.tasksHeading;
    try {
      const r = await appendTaskToNote(this.app, this.destination(p), heading, line);
      showAddedNotice(this.app, r.file.path, r.file.basename, r.line);
      this.forceClose();
    } catch (e) {
      logger.error('Smart Inbox: no se pudo guardar la tarea', e);
      new Notice(`Smart Inbox: no se pudo guardar la tarea (${e instanceof Error ? e.message : String(e)}). El texto sigue en la ventana.`);
    } finally {
      this.saving = false;
      if (!this.closing) this.saveBtn.disabled = false;
    }
  }

  private renderHelp(parent: HTMLElement): void {
    const details = parent.createEl('details', { cls: 'dovela-capture-help' });
    details.open = this.ctx.cache.get<boolean>(HELP_OPEN_KEY, false);
    details.addEventListener('toggle', () => this.ctx.cache.set(HELP_OPEN_KEY, details.open));
    details.createEl('summary', { text: 'Ayuda de sintaxis' });
    const ul = details.createEl('ul');
    const rows: Array<[string, string]> = [
      ['@', 'Proyecto o área activa (🟢). La nota abierta sale primero. Sin @ la tarea va a la Bandeja de entrada. `@[[Nota]]` acepta cualquier nota.'],
      ['#', '`#cx-` contexto, `#px-` persona, `#GTD-AlgunDia`, `#GTD-EstaSemanaNo`. Otras etiquetas se conservan. Sin cx/px/GTD se añade `#inbox`.'],
      ['!', 'Abre el calendario: Tab cambia 🛫 Inicio / ⏳ Programada / 📅 Vence; flechas mueven el día; Enter confirma.'],
      ['!texto', '`!hoy` `!mañana` `!ayer` `!pasado mañana` `!viernes` (el próximo, hoy incluido) `!próximo lunes` (semana siguiente) `!today` `!monday` `!2026-11-20` `!261120` → 📅 Vence.'],
      ['Orden', 'Se avisa si 🛫 Inicio > ⏳ Programada > 📅 Vence (la tarea iría a la Bandeja de entrada del Dashboard).'],
      ['Teclas', 'Enter guarda (o elige en el menú) · Esc cierra el menú y luego la ventana · Backspace sobre `#cx-` vuelve a las categorías.'],
    ];
    for (const [k, v] of rows) {
      const li = ul.createEl('li');
      li.createEl('code', { text: k });
      li.appendText(` ${v}`);
    }
  }
}

/** Notice “Tarea añadida a [[x]]” con enlace que abre la nota en la línea insertada. */
export function showAddedNotice(app: App, path: string, basename: string, line: number): void {
  const frag = createFragment((f) => {
    f.appendText('Tarea añadida a ');
    const a = f.createEl('a', { text: `[[${basename}]]`, href: '#', cls: 'dovela-capture-notice-link' });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      void openNote(app, path, line);
    });
  });
  new Notice(frag, 6000);
}
