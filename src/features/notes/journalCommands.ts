/** Comandos “Abrir/crear nota diaria|semanal|mensual|trimestral|anual” (sin nombrar la nota a mano). */
import { Notice, TFile } from 'obsidian';
import type { DovelaContext } from '../../context';
import { addDays } from '../../core/dates';
import { journalNoteFor, JOURNAL_TYPE, type JournalKind } from '../../core/notes/journalNotes';
import { renderOverrideBody } from '../../core/notes/templateText';
import { logger } from '../../host/logger';
import { openNote } from '../../host/navigation';
import { createNoteFile, noticeTemplaterCode, readOverride } from './vaultOps';

export interface JournalCommand {
  readonly id: string;
  readonly name: string;
  readonly kind: JournalKind;
  readonly offsetDays: number;
}

export const JOURNAL_COMMANDS: readonly JournalCommand[] = [
  { id: 'notes-journal-dia-hoy', name: 'Abrir/crear nota diaria de hoy', kind: 'day', offsetDays: 0 },
  { id: 'notes-journal-dia-manana', name: 'Abrir/crear nota diaria de mañana', kind: 'day', offsetDays: 1 },
  { id: 'notes-journal-dia-ayer', name: 'Abrir/crear nota diaria de ayer', kind: 'day', offsetDays: -1 },
  { id: 'notes-journal-semana', name: 'Abrir/crear nota semanal (esta semana)', kind: 'week', offsetDays: 0 },
  { id: 'notes-journal-mes', name: 'Abrir/crear nota mensual (este mes)', kind: 'month', offsetDays: 0 },
  { id: 'notes-journal-trimestre', name: 'Abrir/crear nota trimestral (este trimestre)', kind: 'quarter', offsetDays: 0 },
  { id: 'notes-journal-anio', name: 'Abrir/crear nota anual (este año)', kind: 'year', offsetDays: 0 },
];

/**
 * Abre la nota del periodo que contiene hoy (+ desplazamiento). Si existe en la ruta calculada, o con
 * el mismo nombre en otra carpeta (p. ej. semanales creadas por v1 en `YYYY/Qn/`), solo se abre.
 */
export async function openJournal(ctx: DovelaContext, kind: JournalKind, offsetDays = 0): Promise<void> {
  const { app } = ctx;
  const date = addDays(ctx.today(), offsetDays);
  try {
    const type = JOURNAL_TYPE[kind];
    const plain = journalNoteFor(kind, date, ctx.settings.value.journal);
    const atPath = app.vault.getAbstractFileByPath(plain.path);
    const byName = atPath instanceof TFile ? atPath : app.metadataCache.getFirstLinkpathDest(plain.title, '');
    if (byName instanceof TFile && byName.basename === plain.title) {
      await openNote(app, byName.path);
      return;
    }
    const override = await readOverride(ctx, type);
    let content = plain.content;
    if (override !== null) {
      const r = renderOverrideBody(override, plain.vars);
      content = plain.frontmatter + r.body;
      if (r.hasCode) noticeTemplaterCode(`Plt - ${type}.md`);
    }
    const file = await createNoteFile(app, plain.folder, plain.path, content);
    if (file) await openNote(app, file.path);
  } catch (e) {
    logger.error('No se pudo abrir/crear la nota de journal', e);
    new Notice(`Dovela: no se pudo crear la nota (${e instanceof Error ? e.message : String(e)}).`);
  }
}
