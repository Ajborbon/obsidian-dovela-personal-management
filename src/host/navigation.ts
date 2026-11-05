/** Apertura de notas (opcionalmente en una línea). Unifica las ~6 copias de `openLinkText(..., {eState:{line}})` de v1. */
import type { App, PaneType } from 'obsidian';
import { TFile } from 'obsidian';

export async function openNote(app: App, path: string, line?: number, newLeaf: PaneType | boolean = false): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    await app.workspace.openLinkText(path, '', newLeaf);
    return;
  }
  const leaf = app.workspace.getLeaf(newLeaf);
  await leaf.openFile(file, line !== undefined ? { eState: { line }, active: true } : { active: true });
}

/** Modificador de clic → abrir en pestaña nueva (Ctrl/Cmd o botón central). */
export function wantsNewLeaf(ev: MouseEvent): PaneType | false {
  if (ev.button === 1) return 'tab';
  if (ev.ctrlKey || ev.metaKey) return ev.altKey ? 'split' : 'tab';
  return false;
}
