/**
 * Feature `capture`: Smart Inbox (F6). Comando `smart-inbox` (mismo id que v1, conserva el atajo
 * del usuario) y icono `plus-circle` en la cinta. No instancia nada en `onload`: el modal se crea al usarlo.
 */
import { TFile } from 'obsidian';
import type { DovelaContext, Feature } from '../../context';
import type { ActiveNoteInfo } from '../../core/capture/sources';
import { folderOf } from '../../core/index/store';
import { CaptureModal } from './CaptureModal';

const NAME = 'Smart Inbox: captura rápida';

/** Nota activa al invocar (se captura antes de que el foco pase al modal). Solo `.md`. */
function activeNote(ctx: DovelaContext): ActiveNoteInfo | null {
  const f = ctx.app.workspace.getActiveFile();
  if (!(f instanceof TFile) || f.extension !== 'md') return null;
  const rec = ctx.index.store.get(f.path);
  return rec
    ? { path: f.path, basename: f.basename, folder: folderOf(f.path), type: rec.type }
    : { path: f.path, basename: f.basename, folder: folderOf(f.path) };
}

export function openSmartInbox(ctx: DovelaContext): void {
  new CaptureModal(ctx.app, ctx, activeNote(ctx)).open();
}

export const captureFeature: Feature = {
  id: 'capture',
  register(ctx) {
    ctx.plugin.addCommand({ id: 'smart-inbox', name: NAME, callback: () => openSmartInbox(ctx) });
    ctx.plugin.addRibbonIcon('plus-circle', NAME, () => openSmartInbox(ctx));
  },
};
