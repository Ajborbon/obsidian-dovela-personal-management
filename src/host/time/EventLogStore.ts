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
  /** Archivos de registro que no se pudieron leer en la última carga. */
  unreadable: string[] = [];
  private readonly generation = new Map<string, number>();

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
    if (!this.loading) {
      this.loading = this.loadAll().catch((e: unknown) => {
        this.loading = null; // permite reintentar
        throw e;
      });
    }
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

  /**
   * Añade eventos al archivo de este dispositivo. El estado se actualiza al instante (optimista);
   * si la escritura falla, los eventos se retiran del estado y el error se propaga (revisión #1).
   */
  append(events: readonly TimeEvent[], opts: { device?: string; month?: string } = {}): Promise<void> {
    const fileDevice = opts.device ?? this.deviceId;
    if (events.length === 0) return Promise.resolve();
    this.pendingLocal.push(...events);
    this.refold();
    const removePending = (): void => {
      for (const e of events) {
        const i = this.pendingLocal.indexOf(e);
        if (i >= 0) this.pendingLocal.splice(i, 1);
      }
    };
    const job = async (): Promise<void> => {
      const month = opts.month ?? this.monthKey();
      const path = normalizePath(`${this.folder()}/${logFileName(month, fileDevice)}`);
      try {
        await this.ensureFolder();
        await this.writeEvents(path, month, fileDevice, events);
        const file = this.app.vault.getAbstractFileByPath(path);
        this.generation.set(path, (this.generation.get(path) ?? 0) + 1);
        if (file instanceof TFile) this.files.set(path, parseLogFile(await this.app.vault.read(file)).events);
        removePending();
        this.refold();
      } catch (e) {
        removePending();
        this.refold();
        logger.error('No se pudo escribir el registro de tiempo', e);
        throw e;
      }
    };
    const p = this.queue.then(job, job);
    this.queue = p.catch(() => undefined);
    return p;
  }

  /** `process` sobre el archivo existente; si no existe se crea, y si `create` choca con un archivo recién llegado por Sync, se reintenta con `process`. */
  private async writeEvents(path: string, month: string, device: string, events: readonly TimeEvent[]): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (c) => appendEvents(c, events));
      return;
    }
    try {
      await this.app.vault.create(path, appendEvents(newLogFileContent(month, device), events));
    } catch (e) {
      const again = this.app.vault.getAbstractFileByPath(path);
      if (!(again instanceof TFile)) throw e;
      await this.app.vault.process(again, (c) => appendEvents(c, events));
    }
  }

  /** Recarga completa (p. ej. tras cambiar la carpeta de registros). */
  async reloadAll(): Promise<void> {
    this.files.clear();
    this.loadedOnce = false;
    this.loading = null;
    await this.ensureLoaded();
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
    this.unreadable = [];
    for (const f of files) {
      try {
        const parsed = parseLogFile(await this.app.vault.cachedRead(f));
        invalid += parsed.invalidLines;
        this.files.set(f.path, parsed.events);
      } catch (e) {
        // Un archivo ilegible no debe dejar el módulo de tiempo inutilizable (revisión #5).
        this.unreadable.push(f.path);
        logger.error(`No se pudo leer el registro ${f.path}`, e);
      }
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
      try {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (!(f instanceof TFile)) {
          this.files.delete(p);
          continue;
        }
        const gen = this.generation.get(p) ?? 0;
        const events = parseLogFile(await this.app.vault.read(f)).events;
        // Si una escritura propia terminó mientras leíamos, este resultado es más viejo (revisión #12).
        if ((this.generation.get(p) ?? 0) === gen) this.files.set(p, events);
      } catch (e) {
        logger.error(`No se pudo recargar ${p}`, e);
        this.dirty.add(p);
      }
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
