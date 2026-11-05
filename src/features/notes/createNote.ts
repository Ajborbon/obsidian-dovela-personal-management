/**
 * Flujo “Nueva nota DOVELA…”: tipo → preguntas de la plantilla → crear carpetas y nota → enlace en el
 * padre → abrir. Sustituye a las plantillas Templater de creación (02 §1).
 */
import { Notice, TFile, type TFolder } from 'obsidian';
import type { DovelaContext } from '../../context';
import { toLocalHm } from '../../core/dates';
import { inboxFolder, parentFolder } from '../../core/notes/folders';
import type { JournalKind } from '../../core/notes/journalNotes';
import { NOTE_SPECS, nextStep, NotePlanError, type NoteEnv, type NoteTypeSpec } from '../../core/notes/specs';
import { renderOverrideBody } from '../../core/notes/templateText';
import { logger } from '../../host/logger';
import { openNote } from '../../host/navigation';
import { openJournal } from './journalCommands';
import { askText, pick } from './modals';
import { createNoteFile, insertLinkInParent, noticeTemplaterCode, readOverride, vaultFolderPath } from './vaultOps';

/** Desde dónde se invoca: nota padre (activa o elegida en el explorador) y/o carpeta del explorador. */
export interface CreateOrigin {
  readonly parent: TFile | null;
  readonly folder: TFolder | null;
}

type PickerItem =
  | { readonly kind: 'spec'; readonly spec: NoteTypeSpec }
  | { readonly kind: 'journal'; readonly journal: JournalKind; readonly label: string; readonly description: string };

const JOURNAL_ITEMS: readonly PickerItem[] = [
  { kind: 'journal', journal: 'day', label: 'Nota diaria de hoy (Dly)', description: 'YYYY-MM-DD día' },
  { kind: 'journal', journal: 'week', label: 'Nota semanal (Wly)', description: 'YYYY-Www (año ISO)' },
  { kind: 'journal', journal: 'month', label: 'Nota mensual (Mly)', description: 'YYYY-MM' },
  { kind: 'journal', journal: 'quarter', label: 'Nota trimestral (Qly)', description: 'YYYY-Qn' },
  { kind: 'journal', journal: 'year', label: 'Nota anual (Yly)', description: 'YYYY' },
];

export function buildEnv(ctx: DovelaContext, origin: CreateOrigin): NoteEnv {
  const { app } = ctx;
  const parent = origin.parent;
  const context = origin.folder ?? app.fileManager.getNewFileParent(parent?.path ?? '');
  return {
    date: ctx.today(),
    time: toLocalHm(ctx.now()),
    parent: parent ? { path: parent.path, basename: parent.basename, folder: parentFolder(parent.path) } : null,
    contextFolder: vaultFolderPath(context),
    inboxFolder: inboxFolder(ctx.settings.value.general.inboxPath),
    exists: (p) => app.vault.getAbstractFileByPath(p) !== null,
  };
}

/** Elige el tipo (incluye accesos a las notas de journal). */
async function chooseType(ctx: DovelaContext): Promise<PickerItem | null> {
  const items: PickerItem[] = [...NOTE_SPECS.map((spec): PickerItem => ({ kind: 'spec', spec })), ...JOURNAL_ITEMS];
  return pick(ctx.app, items, {
    prompt: 'Nueva nota DOVELA: ¿qué tipo?',
    text: (i) => (i.kind === 'spec' ? i.spec.label : i.label),
    description: (i) => (i.kind === 'spec' ? i.spec.description : i.description),
  });
}

export async function runCreateNote(ctx: DovelaContext, origin: CreateOrigin, preset?: NoteTypeSpec): Promise<void> {
  let spec = preset;
  if (!spec) {
    const item = await chooseType(ctx);
    if (!item) return;
    if (item.kind === 'journal') {
      await openJournal(ctx, item.journal);
      return;
    }
    spec = item.spec;
  }
  const env = buildEnv(ctx, origin);
  const answers: Record<string, string> = {};
  for (let step = nextStep(spec, env, answers); step; step = nextStep(spec, env, answers)) {
    let value: string | null;
    if (step.kind === 'text') {
      value = await askText(ctx.app, step);
    } else {
      const opt = await pick(ctx.app, step.options, { prompt: step.prompt, text: (o) => o.label });
      value = opt ? opt.value : null;
    }
    if (value === null) {
      new Notice('Dovela: creación cancelada.');
      return;
    }
    answers[step.id] = value;
  }
  try {
    const plan = spec.plan(env, answers);
    let content = plan.content;
    const override = await readOverride(ctx, spec.id);
    if (override !== null) {
      const r = renderOverrideBody(override, plan.vars);
      content = plan.frontmatter + r.body;
      if (r.hasCode) noticeTemplaterCode(`Plt - ${spec.id}.md`);
    }
    const file = await createNoteFile(ctx.app, plan.folder, plan.path, content);
    if (!file) return;
    // El enlace va ANTES de abrir la nota nueva: así el editor activo sigue siendo el del padre.
    if (plan.parentLink && origin.parent) {
      await insertLinkInParent(ctx.app, origin.parent, plan.parentLink);
      new Notice(`Dovela: enlace insertado en “${origin.parent.basename}”.`);
    }
    await openNote(ctx.app, file.path, undefined, 'tab');
    new Notice(`Dovela: creada “${plan.title}”.`);
  } catch (e) {
    if (e instanceof NotePlanError) {
      new Notice(e.message);
      return;
    }
    logger.error('No se pudo crear la nota', e);
    new Notice(`Dovela: no se pudo crear la nota (${e instanceof Error ? e.message : String(e)}).`);
  }
}

/** Nota padre por defecto: la nota Markdown activa. */
export function activeMarkdown(ctx: DovelaContext): TFile | null {
  const f = ctx.app.workspace.getActiveFile();
  return f instanceof TFile && f.extension === 'md' ? f : null;
}
