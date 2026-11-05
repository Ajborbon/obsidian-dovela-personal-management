/**
 * Feature `notes` (F9): motor de notas propio que sustituye a Templater para crear notas DOVELA,
 * comandos de notas de journal y selector de estado 🟡🟢🔵🔴.
 * `register` solo da de alta comandos, menús y el indicador; los modales se crean al usarlos.
 */
import { TFile, TFolder } from 'obsidian';
import type { Feature } from '../../context';
import { NOTE_SPECS } from '../../core/notes/specs';
import { activeMarkdown, runCreateNote } from './createNote';
import { changeEstado, registerEstadoStatusBar } from './estado';
import { JOURNAL_COMMANDS, openJournal } from './journalCommands';

export const notesFeature: Feature = {
  id: 'notes',
  register(ctx) {
    const { plugin, app } = ctx;

    plugin.addCommand({
      id: 'notes-nueva',
      name: 'Nueva nota DOVELA…',
      callback: () => void runCreateNote(ctx, { parent: activeMarkdown(ctx), folder: null }),
    });
    for (const spec of NOTE_SPECS) {
      plugin.addCommand({
        id: `notes-nueva-${spec.id.toLowerCase()}`,
        name: `Nueva nota DOVELA: ${spec.label}`,
        callback: () => void runCreateNote(ctx, { parent: activeMarkdown(ctx), folder: null }, spec),
      });
    }
    plugin.addRibbonIcon('file-plus-2', 'Nueva nota DOVELA', () => void runCreateNote(ctx, { parent: activeMarkdown(ctx), folder: null }));

    for (const c of JOURNAL_COMMANDS) {
      plugin.addCommand({ id: c.id, name: c.name, callback: () => void openJournal(ctx, c.kind, c.offsetDays) });
    }

    plugin.addCommand({
      id: 'notes-cambiar-estado',
      name: 'Cambiar estado de la nota',
      checkCallback: (checking) => {
        const f = activeMarkdown(ctx);
        if (!f) return false;
        if (!checking) void changeEstado(ctx, f);
        return true;
      },
    });

    plugin.registerEvent(app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFolder) {
        menu.addItem((i) => i.setTitle('Nueva nota DOVELA aquí…').setIcon('file-plus-2')
          .onClick(() => void runCreateNote(ctx, { parent: null, folder: file })));
      } else if (file instanceof TFile && file.extension === 'md') {
        menu.addItem((i) => i.setTitle('Cambiar estado de la nota').setIcon('circle-dot')
          .onClick(() => void changeEstado(ctx, file)));
        menu.addItem((i) => i.setTitle('Nueva nota DOVELA hija…').setIcon('file-plus-2')
          .onClick(() => void runCreateNote(ctx, { parent: file, folder: null })));
      }
    }));
    plugin.registerEvent(app.workspace.on('editor-menu', (menu, _editor, info) => {
      const f = info.file;
      if (!(f instanceof TFile) || f.extension !== 'md') return;
      menu.addItem((i) => i.setTitle('Cambiar estado de la nota').setIcon('circle-dot')
        .onClick(() => void changeEstado(ctx, f)));
    }));

    registerEstadoStatusBar(ctx);
  },
};
