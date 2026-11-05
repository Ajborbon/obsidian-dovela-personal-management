/**
 * Almacén de eventos de tiempo en el vault (02 §2).
 * - Lee TODOS los archivos `YYYY-MM · <dispositivo>.md` de la carpeta configurada.
 * - Escribe SOLO en el archivo del mes actual de ESTE dispositivo (append con `vault.process`, cola serializada).
 * - Reacciona a archivos que llegan por Sync (`create`/`modify`/`delete`/`rename`) sin sondeo.
 */
import type { App, Component, TAbstractFile } from 'obsidian';
import { TFile, normalizePath, debounce } from 'obsidian';
import { appendEvents, logFileName, newLogFileContent, parseLogFile, parseLogFileName, type TimeEvent } from '../../core/time/events';
import { foldEvents, type TimeState } from '../../core/time/merge';
import { logger } from '../logger';

export type TimeStoreListener = (state: TimeState) => void;

export class EventLogStore {
  private readonly files = new Map<string, TimeEvent[]>();
  private readonly pendingLocal: TimeEvent[] = [];
  private _state: TimeState = { logs: new Map(), live: [] };
  private readonly listeners = new Set<TimeStoreListener>();
  private queue: Promise<void> = Promise.resolve();
  private lastU = 0;
  private loadedOnce = false;
  private loading: Promise<void> | null = null;
  invalidLines = 0;

  private readonly reloadDirty = debounce(() => void this.reloadPending(), 300, true);
  private readonly dirty = new Set<string>();

  constructor(
    private readonly app: App,
    private readonly folder: () => string,
    readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  get state(): TimeState {
    return this._state;
  }

  get loaded(): boolean {
    return this.loadedOnce;
  }

  start(owner: Component): void {
    const v = this.app.vault;
    const watch = (f: TAbstractFile): void => {
      if (this.isLogFile(f.path)) {
        this.dirty.add(f.path);
        this.reloadDirty();
      }
    };
    owner.registerEvent(v.on('create', watch));
    owner.registerEvent(v.on('modify', watch));
    owner.registerEvent(v.on('delete', (f) => {
      if (this.files.delete(f.path)) this.refold();
    }));
    owner.registerEvent(v.on('rename', (f, old) => {
      if (this.files.delete(old)) this.refold();
      watch(f);
    }));
  }

  onChange(fn: TimeStoreListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Carga perezosa (primera vez que una feature necesita tiempo). */
  ensureLoaded(): Promise<void> {
    if (this.loadedOnce) return Promise.resolve();
    if (!this.loading) this.loading = this.loadAll();
    return this.loading;
  }

  allEvents(): TimeEvent[] {
    const out: TimeEvent[] = [];
    for (const evs of this.files.values()) out.push(...evs);
    out.push(...this.pendingLocal);
    return out;
  }

  /** Siguiente versión `u` monótona para este dispositivo. */
  nextU(): number {
    this.lastU = Math.max(this.now().getTime(), this.lastU + 1);
    return this.lastU;
  }

  /** Añade eventos al archivo de este dispositivo. El estado se actualiza al instante (optimista). */
  append(events: readonly TimeEvent[], opts: { device?: string; month?: string } = {}): Promise<void> {
    const fileDevice = opts.device ?? this.deviceId;
    if (events.length === 0) return Promise.resolve();
    this.pendingLocal.push(...events);
    this.refold();
    const job = async (): Promise<void> => {
      const month = opts.month ?? this.monthKey();
      const path = normalizePath(`${this.folder()}/${logFileName(month, fileDevice)}`);
      try {
        await this.ensureFolder();
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
          await this.app.vault.process(existing, (c) => appendEvents(c, events));
        } else {
          await this.app.vault.create(path, appendEvents(newLogFileContent(month, fileDevice), events));
        }
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) this.files.set(path, parseLogFile(await this.app.vault.read(file)).events);
        for (const e of events) {
          const i = this.pendingLocal.indexOf(e);
          if (i >= 0) this.pendingLocal.splice(i, 1);
        }
        this.refold();
      } catch (e) {
        logger.error('No se pudo escribir el registro de tiempo', e);
        throw e;
      }
    };
    const p = this.queue.then(job, job);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private monthKey(): string {
    const d = this.now();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private isLogFile(path: string): boolean {
    const folder = normalizePath(this.folder());
    if (!path.startsWith(`${folder}/`)) return false;
    const rest = path.slice(folder.length + 1);
    return !rest.includes('/') && parseLogFileName(rest) !== null;
  }

  private async ensureFolder(): Promise<void> {
    const folder = normalizePath(this.folder());
    if (this.app.vault.getAbstractFileByPath(folder)) return;
    try {
      await this.app.vault.createFolder(folder);
    } catch {
      // Ya existe (carrera con Sync): seguimos.
    }
  }

  private async loadAll(): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => this.isLogFile(f.path));
    let invalid = 0;
    for (const f of files) {
      const parsed = parseLogFile(await this.app.vault.cachedRead(f));
      invalid += parsed.invalidLines;
      this.files.set(f.path, parsed.events);
    }
    this.invalidLines = invalid;
    this.loadedOnce = true;
    for (const e of this.allEvents()) this.lastU = Math.max(this.lastU, e.dev === this.deviceId ? e.u : 0);
    this.refold();
  }

  private async reloadPending(): Promise<void> {
    if (!this.loadedOnce) return;
    const paths = [...this.dirty];
    this.dirty.clear();
    for (const p of paths) {
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) this.files.set(p, parseLogFile(await this.app.vault.read(f)).events);
      else this.files.delete(p);
    }
    this.refold();
  }

  private refold(): void {
    this._state = foldEvents(this.allEvents());
    for (const fn of this.listeners) {
      try {
        fn(this._state);
      } catch (e) {
        logger.error('Error en suscriptor de tiempo', e);
      }
    }
  }
}
