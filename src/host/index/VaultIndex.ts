/**
 * Índice incremental único (02 §3). Sustituye a todos los `parseVault` de v1.
 * - Solo lee (`cachedRead`) los archivos cuyo `metadataCache.listItems` contiene tareas.
 * - Se actualiza por eventos (`changed`, `deleted`, `rename`, `resolved`), nunca reescanea el vault.
 * - Construcción inicial en lotes cediendo el hilo; notifica cambios con debounce.
 */
import type { App, CachedMetadata, Component, TAbstractFile } from 'obsidian';
import { TFile, debounce } from 'obsidian';
import { IndexStore, basenameOf, folderOf, sameContent, sameList, type NoteRecord } from '../../core/index/store';
import { detectNoteType, normalizeEstado } from '../../core/notes/types';
import { isExcludedPath, type GeneralSettings } from '../../core/settings';
import { parseTasksInNote } from '../../core/tasks/parse';
import { logger } from '../logger';

export type IndexListener = (changedPaths: ReadonlySet<string>) => void;

const FM_KEYS = ['type', 'estado', 'moneda', 'monto', 'origen', 'fecha', 'tags'] as const;
const BATCH = 40;

const yieldToMain = (): Promise<void> => new Promise((r) => window.setTimeout(r, 0));

function hasTasks(cache: CachedMetadata | null): boolean {
  return !!cache?.listItems?.some((li) => li.task !== undefined);
}

function toLinkTexts(v: unknown): string[] {
  const vals = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const x of vals) {
    if (typeof x !== 'string') continue;
    for (const m of x.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) if (m[1]) out.push(m[1].trim());
    if (!x.includes('[[') && x.trim()) out.push(x.trim());
  }
  return out;
}

export class VaultIndex {
  readonly store = new IndexStore();
  private readonly listeners = new Set<IndexListener>();
  private readonly pending = new Set<string>();
  private readonly changed = new Set<string>();
  private building = false;
  private buildDone: Promise<void> | null = null;
  private rebuildRequested = false;
  private relinkFull = false;
  private readonly relinkPaths = new Set<string>();
  private readyResolve!: () => void;
  readonly ready: Promise<void> = new Promise((r) => (this.readyResolve = r));
  private isReady = false;

  private readonly flushPending = debounce(() => void this.processPending(), 120, true);
  private readonly emitSoon = debounce(() => this.emit(), 250, true);
  private readonly relinkSoon = debounce(() => this.relinkAll(), 1000, true);

  constructor(
    private readonly app: App,
    private readonly general: () => GeneralSettings,
  ) {}

  get loaded(): boolean {
    return this.isReady;
  }

  /** Registra eventos en `owner` y programa la construcción tras `onLayoutReady`. */
  start(owner: Component): void {
    const { metadataCache, vault, workspace } = this.app;
    owner.registerEvent(metadataCache.on('changed', (file) => this.enqueue(file.path)));
    owner.registerEvent(metadataCache.on('deleted', (file) => {
      this.relinkFull = true;
      this.drop(file.path);
    }));
    owner.registerEvent(vault.on('create', () => {
      // Una nota nueva puede resolver enlaces pendientes de otras notas.
      this.relinkFull = true;
    }));
    owner.registerEvent(
      vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        this.relinkFull = true;
        if (oldPath.endsWith('.md')) {
          // Nota renombrada (también a otra extensión: el registro viejo no debe quedar, revisión #14).
          this.drop(oldPath);
          if (file instanceof TFile) this.enqueue(file.path);
        } else {
          // Carpeta renombrada: reindexar sus notas.
          for (const n of this.store.inFolder(oldPath, true)) this.drop(n.path);
          for (const f of vault.getMarkdownFiles()) if (f.path.startsWith(`${file.path}/`)) this.enqueue(f.path);
        }
      }),
    );
    owner.registerEvent(metadataCache.on('resolved', () => this.relinkSoon()));
    workspace.onLayoutReady(() => void this.buildAll());
  }

  onChange(fn: IndexListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Reconstrucción completa (comando de diagnóstico o cambio de exclusiones). */
  async rebuild(): Promise<void> {
    if (this.building) {
      // Revisión #6: no vaciar el índice mientras otra construcción está en curso; se repite al terminar.
      this.rebuildRequested = true;
      return this.buildDone ?? Promise.resolve();
    }
    this.store.clear();
    await this.buildAll();
  }

  private async buildAll(): Promise<void> {
    if (this.building) return;
    this.building = true;
    let resolveDone!: () => void;
    this.buildDone = new Promise((r) => (resolveDone = r));
    const t0 = performance.now();
    let read = 0;
    let files: TFile[] = [];
    try {
      files = this.app.vault.getMarkdownFiles();
      for (let i = 0; i < files.length; i += BATCH) {
        for (const f of files.slice(i, i + BATCH)) {
          try {
            if ((await this.indexFile(f)).read) read++;
          } catch (e) {
            logger.error(`No se pudo indexar ${f.path}`, e);
          }
        }
        await yieldToMain();
      }
    } finally {
      this.building = false;
      logger.debug(`Índice: ${files.length} notas, ${read} leídas, ${Math.round(performance.now() - t0)} ms`);
      if (!this.isReady) {
        this.isReady = true;
        this.readyResolve();
      }
      this.changed.add('*');
      this.emitSoon();
      resolveDone();
    }
    if (this.rebuildRequested) {
      this.rebuildRequested = false;
      await this.rebuild();
    }
  }

  private enqueue(path: string): void {
    if (!path.endsWith('.md')) return;
    this.pending.add(path);
    this.flushPending();
  }

  private drop(path: string): void {
    if (this.store.remove(path)) {
      this.changed.add(path);
      this.emitSoon();
    }
  }

  private async processPending(): Promise<void> {
    const paths = [...this.pending];
    this.pending.clear();
    for (const p of paths) {
      try {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (f instanceof TFile) {
          // Solo se notifica si cambió algo visible (tareas, tipo, estado, enlaces…), revisión #9.
          if ((await this.indexFile(f)).changed) this.changed.add(p);
        } else this.drop(p);
      } catch (e) {
        logger.error(`No se pudo indexar ${p}`, e);
      }
      this.relinkPaths.add(p);
    }
    if (this.changed.size) this.emitSoon();
  }

  /** Indexa un archivo. `read`: tuvo que leer el contenido; `changed`: el registro cambió de forma relevante. */
  private async indexFile(file: TFile): Promise<{ read: boolean; changed: boolean }> {
    if (file.extension !== 'md') return { read: false, changed: false };
    if (isExcludedPath(file.path, this.general())) {
      return { read: false, changed: this.store.remove(file.path) };
    }
    const cache = this.app.metadataCache.getFileCache(file);
    let tasks: NoteRecord['tasks'] = [];
    let read = false;
    if (hasTasks(cache)) {
      try {
        tasks = parseTasksInNote(await this.app.vault.cachedRead(file), file.path);
        read = true;
      } catch (e) {
        logger.error(`No se pudo leer ${file.path}`, e);
      }
    }
    const rec = this.makeRecord(file, cache, tasks);
    const prev = this.store.get(file.path);
    if (prev && sameContent(prev, rec)) {
      this.store.replaceQuiet(rec); // solo cambian fechas de archivo: sin invalidar ni notificar
      return { read, changed: false };
    }
    this.store.upsert(rec);
    return { read, changed: true };
  }

  private makeRecord(file: TFile, cache: CachedMetadata | null, tasks: NoteRecord['tasks']): NoteRecord {
    const fmRaw = cache?.frontmatter ?? {};
    const fm: Record<string, unknown> = {};
    for (const k of FM_KEYS) if (fmRaw[k] !== undefined) fm[k] = fmRaw[k];
    return {
      path: file.path,
      basename: basenameOf(file.path),
      folder: folderOf(file.path),
      ctime: file.stat.ctime,
      mtime: file.stat.mtime,
      type: detectNoteType(file.basename, fmRaw['type']),
      estado: normalizeEstado(fmRaw['estado']),
      fm,
      outLinks: this.resolvedOut(file.path),
      originLinks: this.resolveOrigin(fmRaw['origen'], file.path),
      tasks,
    };
  }

  private resolvedOut(path: string): string[] {
    const dests = this.app.metadataCache.resolvedLinks[path];
    return dests ? Object.keys(dests).filter((d) => d.endsWith('.md') && d !== path) : [];
  }

  private resolveOrigin(value: unknown, from: string): string[] {
    const out: string[] = [];
    for (const t of toLinkTexts(value)) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(t, from);
      if (dest && dest.extension === 'md') out.push(dest.path);
    }
    return out;
  }

  /**
   * Tras `resolved`, actualiza enlaces que se resolvieron tarde (sin releer contenido).
   * Pasada completa solo si se crearon/borraron/renombraron notas; si no, solo las notas
   * reindexadas desde la última pasada (revisión #9). Incluye `origen` (revisión #10).
   */
  private relinkAll(): void {
    const full = this.relinkFull;
    const targets = full ? [...this.store.all()] : [...this.relinkPaths].map((p) => this.store.get(p)).filter((r): r is NoteRecord => !!r);
    this.relinkFull = false;
    this.relinkPaths.clear();
    let n = 0;
    for (const rec of targets) {
      const out = this.resolvedOut(rec.path);
      const origin = rec.fm['origen'] !== undefined ? this.resolveOrigin(rec.fm['origen'], rec.path) : rec.originLinks;
      if (!sameList(out, rec.outLinks) || !sameList(origin, rec.originLinks)) {
        this.store.upsert({ ...rec, outLinks: out, originLinks: origin });
        this.changed.add(rec.path);
        n++;
      }
    }
    if (n) this.emitSoon();
  }

  private emit(): void {
    if (this.changed.size === 0) return;
    const set = new Set(this.changed);
    this.changed.clear();
    for (const fn of this.listeners) {
      try {
        fn(set);
      } catch (e) {
        logger.error('Error en suscriptor del índice', e);
      }
    }
  }
}
