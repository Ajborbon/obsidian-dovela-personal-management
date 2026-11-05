/** Escrituras seguras sobre tareas en notas (`vault.process`, localización verificada). */
import type { App } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import { applyTaskEdit, markDone, markInProgress, markOpen, type EditOutcome, type TaskLocator } from '../core/tasks/edit';
import { logger } from './logger';

export interface TaskRef extends TaskLocator {
  readonly path: string;
}

const REASONS: Record<string, string> = {
  'not-found': 'no se encontró la tarea (¿se editó o movió?)',
  ambiguous: 'hay varias tareas idénticas; añade un 🆔 para distinguirlas',
  'not-applicable': 'la tarea no está en un estado que permita el cambio',
  'no-file': 'la nota ya no existe',
};

export class TaskWriter {
  constructor(
    private readonly app: App,
    private readonly today: () => string,
  ) {}

  async edit(ref: TaskRef, fn: (line: string) => string | null, quiet = false): Promise<EditOutcome | { ok: false; reason: 'no-file' }> {
    const file = this.app.vault.getAbstractFileByPath(ref.path);
    if (!(file instanceof TFile)) {
      if (!quiet) new Notice(`Dovela: ${REASONS['no-file']}: ${ref.path}`);
      return { ok: false, reason: 'no-file' };
    }
    let outcome: EditOutcome = { ok: false, reason: 'not-found' };
    await this.app.vault.process(file, (data) => {
      outcome = applyTaskEdit(data, ref, fn);
      return outcome.ok ? outcome.content : data;
    });
    if (!outcome.ok && !quiet) {
      new Notice(`Dovela: no se modificó la tarea: ${REASONS[outcome.reason] ?? outcome.reason}`);
      logger.warn('Edición de tarea rechazada', ref, outcome.reason);
    }
    return outcome;
  }

  markDone(ref: TaskRef, quiet = false): ReturnType<TaskWriter['edit']> {
    const today = this.today();
    return this.edit(ref, (l) => markDone(l, today), quiet);
  }

  markInProgress(ref: TaskRef, quiet = false): ReturnType<TaskWriter['edit']> {
    return this.edit(ref, markInProgress, quiet);
  }

  markOpen(ref: TaskRef, quiet = false): ReturnType<TaskWriter['edit']> {
    return this.edit(ref, markOpen, quiet);
  }
}
