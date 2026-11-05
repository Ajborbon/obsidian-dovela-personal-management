/**
 * Rutas y reglas de carpeta (RI-E §5.5) como funciones puras. Las rutas del vault usan `/` y no
 * empiezan ni terminan en `/`; la raíz del vault es `''`.
 */

export function joinPath(...parts: string[]): string {
  return parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

/** Carpeta que contiene `path` (`''` para la raíz). */
export function parentFolder(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** Último segmento de una carpeta (`''` para la raíz). */
export function folderName(folder: string): string {
  const f = folder.replace(/\/+$/, '');
  return f.slice(f.lastIndexOf('/') + 1);
}

/** `carpeta/Título.md` */
export function notePath(folder: string, title: string): string {
  return `${joinPath(folder, title)}.md`;
}

/** Ruta sin `.md` (forma que usan los enlaces `[[ruta|título]]` de las plantillas contenedor). */
export function withoutMd(path: string): string {
  return path.replace(/\.md$/, '');
}

/** Carpetas a crear, de la más externa a la más interna (`a`, `a/b`, `a/b/c`). */
export function folderChain(folder: string): string[] {
  const segs = joinPath(folder).split('/').filter(Boolean);
  return segs.map((_, i) => segs.slice(0, i + 1).join('/'));
}

/** Carpeta de la Bandeja de Entrada a partir de `general.inboxPath` (una nota o una carpeta). */
export function inboxFolder(inboxPath: string): string {
  const p = joinPath(inboxPath.trim());
  if (!p) return '00 - Inbox';
  return p.endsWith('.md') ? parentFolder(p) || '00 - Inbox' : p;
}
