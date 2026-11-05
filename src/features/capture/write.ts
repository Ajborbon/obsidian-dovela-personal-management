/** Escritura de la tarea capturada en su nota destino (crea carpetas y archivo si faltan). */
import type { App } from 'obsidian';
import { TFile, TFolder } from 'obsidian';
import { ancestorFolders, insertTaskAt, normalizeNotePath } from '../../core/capture/insert';

export interface WriteResult {
  readonly file: TFile;
  /** Línea (0-based) donde quedó la tarea. */
  readonly line: number;
  readonly created: boolean;
}

async function ensureFolders(app: App, path: string): Promise<void> {
  for (const folder of ancestorFolders(path)) {
    const existing = app.vault.getAbstractFileByPath(folder);
    if (existing instanceof TFolder) continue;
    if (existing) throw new Error(`«${folder}» existe y no es una carpeta`);
    try {
      await app.vault.createFolder(folder);
    } catch (e) {
      // Puede haberla creado otro proceso (Sync) entre la comprobación y la creación.
      if (!(app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw e;
    }
  }
}

async function processExisting(app: App, file: TFile, heading: string, line: string): Promise<WriteResult> {
  let at = 0;
  await app.vault.process(file, (content) => {
    const r = insertTaskAt(content, heading, line);
    at = r.line;
    return r.content;
  });
  return { file, line: at, created: false };
}

/** Inserta `line` en la sección `heading` de la nota `path` (atómico con `vault.process`). */
export async function appendTaskToNote(app: App, rawPath: string, heading: string, line: string): Promise<WriteResult> {
  const path = normalizeNotePath(rawPath);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return processExisting(app, existing, heading, line);
  if (existing) throw new Error(`«${path}» no es una nota`);
  await ensureFolders(app, path);
  const r = insertTaskAt('', heading, line);
  try {
    const file = await app.vault.create(path, r.content);
    return { file, line: r.line, created: true };
  } catch (e) {
    const again = app.vault.getAbstractFileByPath(path);
    if (again instanceof TFile) return processExisting(app, again, heading, line);
    throw e;
  }
}
