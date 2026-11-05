/** Operaciones sobre el vault del motor de notas (crear carpetas, nota, enlace en el padre, plantillas del usuario). */
import type { App, TFile } from 'obsidian';
import { MarkdownView, Notice, TFile as TFileClass, TFolder } from 'obsidian';
import type { DovelaContext } from '../../context';
import { folderChain, joinPath } from '../../core/notes/folders';
import { insertChildLink } from '../../core/notes/parentLink';
import { overrideFileName } from '../../core/notes/specs';
import type { NoteSpecId } from '../../core/notes/specs';
import { logger } from '../../host/logger';
import { openNote } from '../../host/navigation';

/** Crea las carpetas que falten (de fuera hacia dentro). */
export async function ensureFolder(app: App, folder: string): Promise<void> {
  for (const f of folderChain(folder)) {
    const existing = app.vault.getAbstractFileByPath(f);
    if (existing instanceof TFolder) continue;
    if (existing) throw new Error(`“${f}” existe y no es una carpeta`);
    try {
      await app.vault.createFolder(f);
    } catch (e) {
      // Carrera con Sync u otra creación simultánea: si ya existe, seguimos.
      if (!(app.vault.getAbstractFileByPath(f) instanceof TFolder)) throw e;
    }
  }
}

/** Carpeta como ruta del vault (`''` para la raíz, que Obsidian expone como `/`). */
export function vaultFolderPath(folder: TFolder | null | undefined): string {
  if (!folder) return '';
  return folder.path === '/' ? '' : folder.path;
}

/** Texto de `Plt - <id>.md` en la carpeta de plantillas configurada (o null). */
export async function readOverride(ctx: DovelaContext, id: NoteSpecId | 'Dly' | 'Wly' | 'Mly' | 'Qly' | 'Yly'): Promise<string | null> {
  const folder = ctx.settings.value.general.templatesFolder.trim();
  if (!folder) return null;
  const f = ctx.app.vault.getAbstractFileByPath(joinPath(folder, overrideFileName(id)));
  if (!(f instanceof TFileClass)) return null;
  try {
    return await ctx.app.vault.cachedRead(f);
  } catch (e) {
    logger.warn('No se pudo leer la plantilla personalizada', f.path, e);
    return null;
  }
}

export function noticeTemplaterCode(name: string): void {
  new Notice(`Dovela: la plantilla “${name}” contiene código Templater (<% … %>). Se copió tal cual, sin ejecutarlo.`, 8000);
}

/**
 * Inserta el enlace al hijo en la nota padre: en el cursor si el editor activo (modo edición) es el
 * padre; si no, al final de `## Historial` o al final de la nota (escritura atómica con `vault.process`).
 */
export async function insertLinkInParent(app: App, parent: TFile, link: string): Promise<void> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view && view.file?.path === parent.path && view.getMode() === 'source') {
    // Inserta tras la selección sin reemplazarla (revisión #8) y deja el cursor al final del enlace.
    const editor = view.editor;
    const at = editor.getCursor('to');
    editor.replaceRange(link, at);
    editor.setCursor(editor.offsetToPos(editor.posToOffset(at) + link.length));
    return;
  }
  await app.vault.process(parent, (text) => insertChildLink(text, link));
}

/**
 * Crea la nota directamente en su ruta (sin “Sin título” + mover). Si ya existe no la toca: avisa,
 * la abre y devuelve null.
 */
export async function createNoteFile(app: App, folder: string, path: string, content: string): Promise<TFile | null> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFileClass) {
    new Notice(`Dovela: “${existing.basename}” ya existe; se abre sin modificarla.`);
    await openNote(app, existing.path);
    return null;
  }
  await ensureFolder(app, folder);
  return app.vault.create(path, content);
}
