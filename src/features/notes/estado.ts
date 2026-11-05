/**
 * Selector de estado de nota 🟡🟢🔵🔴 (no existía en v1; 02 §9.12): comando, menú de archivo/editor e
 * indicador en la barra de estado. Escribe `estado:` con `processFrontMatter` (atómico).
 * La transición 🟢→🔵 de journals sigue siendo decisión del usuario: aquí solo se ofrece el selector.
 */
import { Notice, TFile } from 'obsidian';
import type { DovelaContext } from '../../context';
import { ESTADOS, ESTADO_LABELS, normalizeEstado, type Estado } from '../../core/notes/types';
import { logger } from '../../host/logger';
import { pick } from './modals';

function isEstado(v: string): v is Estado {
  return (ESTADOS as readonly string[]).includes(v);
}

export function currentEstado(ctx: DovelaContext, file: TFile): string {
  return normalizeEstado(ctx.app.metadataCache.getFileCache(file)?.frontmatter?.['estado']);
}

/** Etiqueta corta (`Activo`) a partir de `ESTADO_LABELS`. */
export function shortLabel(e: Estado): string {
  return ESTADO_LABELS[e].split(' / ')[0] ?? '';
}

export async function changeEstado(ctx: DovelaContext, file: TFile): Promise<void> {
  const current = currentEstado(ctx, file);
  const choice = await pick(ctx.app, ESTADOS, {
    prompt: `Estado de “${file.basename}”`,
    text: (e) => `${e} ${ESTADO_LABELS[e]}`,
    description: (e) => (e === current ? 'Estado actual' : ''),
    isCurrent: (e) => e === current,
  });
  if (!choice || choice === current) return;
  try {
    await ctx.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm['estado'] = choice;
    });
    new Notice(`Dovela: estado ${choice} ${shortLabel(choice)}`);
  } catch (e) {
    logger.error('No se pudo cambiar el estado', e);
    new Notice('Dovela: no se pudo cambiar el estado (¿frontmatter inválido?).');
  }
}

/** Indicador en la barra de estado: solo para notas con `type` en el frontmatter; clic → selector. */
export function registerEstadoStatusBar(ctx: DovelaContext): void {
  const { app, plugin } = ctx;
  const item = plugin.addStatusBarItem();
  item.addClass('dovela-estado-status', 'mod-clickable');
  let file: TFile | null = null;
  const update = (): void => {
    const f = app.workspace.getActiveFile();
    file = f instanceof TFile && f.extension === 'md' ? f : null;
    const fm = file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
    if (!file || !fm || fm['type'] === undefined || fm['type'] === null) {
      item.hide();
      return;
    }
    const e = normalizeEstado(fm['estado']);
    item.empty();
    if (isEstado(e)) {
      item.setText(`${e} ${shortLabel(e)}`);
      item.setAttr('aria-label', `Estado: ${ESTADO_LABELS[e]} (clic para cambiar)`);
    } else {
      item.setText('⚪ Sin estado');
      item.setAttr('aria-label', 'La nota no tiene `estado` (clic para asignarlo)');
    }
    item.show();
  };
  item.addEventListener('click', () => {
    if (file) void changeEstado(ctx, file);
  });
  plugin.registerEvent(app.workspace.on('file-open', update));
  plugin.registerEvent(app.workspace.on('active-leaf-change', update));
  plugin.registerEvent(app.metadataCache.on('changed', (f) => {
    if (file && f.path === file.path) update();
  }));
  plugin.registerEvent(app.vault.on('rename', () => update()));
  app.workspace.onLayoutReady(update);
}
