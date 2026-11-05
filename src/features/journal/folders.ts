/** Creación segura de carpetas del Journal (sin Node: solo `vault.createFolder`). */
import type { App } from 'obsidian';
import { TFile, TFolder } from 'obsidian';
import type { PathKind } from '../../core/journal/validate';

export function pathKind(app: App, path: string): PathKind {
  const f = app.vault.getAbstractFileByPath(path);
  if (f instanceof TFolder) return 'folder';
  if (f instanceof TFile) return 'file';
  return f ? 'file' : null;
}

/**
 * Crea, en orden, las carpetas que falten de `chain` (de la raíz hacia abajo).
 * Si una ya existe se respeta; si es un archivo se lanza un error claro. Tolera que Sync
 * cree la carpeta a la vez (si `createFolder` falla pero la carpeta ya existe, sigue).
 */
export async function ensureFolders(app: App, chain: readonly string[]): Promise<void> {
  for (const path of chain) {
    const kind = pathKind(app, path);
    if (kind === 'folder') continue;
    if (kind === 'file') throw new Error(`"${path}" es un archivo, no una carpeta`);
    try {
      await app.vault.createFolder(path);
    } catch (e) {
      if (pathKind(app, path) !== 'folder') throw e;
    }
  }
}
