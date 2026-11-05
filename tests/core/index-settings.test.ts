import { describe, expect, it } from 'vitest';
import { IndexStore, type NoteRecord } from '../../src/core/index/store';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import { defaultSettings, isExcludedPath, loadSettings } from '../../src/core/settings';

function rec(path: string, opts: Partial<NoteRecord> & { body?: string } = {}): NoteRecord {
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return {
    path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), folder,
    ctime: 0, mtime: 0, type: 'Ax', estado: '', fm: {}, outLinks: [], originLinks: [],
    tasks: opts.body ? parseTasksInNote(opts.body, path) : [],
    ...opts,
  };
}

describe('IndexStore', () => {
  it('altas, bajas, carpeta y hermanas', () => {
    const s = new IndexStore();
    s.upsert(rec('A/x.md'));
    s.upsert(rec('A/y.md'));
    s.upsert(rec('A/B/z.md'));
    expect(s.inFolder('A', false).map((n) => n.path).sort()).toEqual(['A/x.md', 'A/y.md']);
    expect(s.inFolder('A', true)).toHaveLength(3);
    expect(s.siblings('A/x.md').map((n) => n.path)).toEqual(['A/y.md']);
    expect(s.remove('A/y.md')).toBe(true);
    expect(s.remove('A/y.md')).toBe(false);
    expect(s.size).toBe(2);
  });

  it('enlaces entrantes incrementales (cuerpo y origen)', () => {
    const s = new IndexStore();
    s.upsert(rec('p.md'));
    s.upsert(rec('h1.md', { outLinks: ['p.md'] }));
    s.upsert(rec('h2.md', { originLinks: ['p.md'] }));
    expect(s.inLinks('p.md')).toEqual(['h1.md']);
    expect(s.inLinks('p.md', { includeOrigin: true }).sort()).toEqual(['h1.md', 'h2.md']);
    s.upsert(rec('h1.md', { outLinks: [] }));
    expect(s.inLinks('p.md')).toEqual([]);
    s.remove('h2.md');
    expect(s.inLinks('p.md', { includeOrigin: true })).toEqual([]);
  });

  it('tareas memoizadas, por id, duplicados y versión', () => {
    const s = new IndexStore();
    const v0 = s.version;
    s.upsert(rec('b.md', { body: '- [ ] b 🆔 x\n- [x] c' }));
    s.upsert(rec('a.md', { body: '- [/] a 🆔 x' }));
    expect(s.version).toBeGreaterThan(v0);
    expect(s.allTasks().map((t) => t.text)).toEqual(['a', 'b', 'c']);
    expect(s.allTasks()).toBe(s.allTasks());
    expect(s.openTasks()).toHaveLength(2);
    expect(s.taskById().get('x')?.path).toBe('a.md');
    expect(s.duplicateIds().get('x')).toHaveLength(2);
  });
});

describe('ajustes v2 y migración desde v1', () => {
  it('vacío → defaults; los defaults no se comparten entre llamadas', () => {
    const a = loadSettings(undefined).settings;
    const b = loadSettings(null).settings;
    a.pomodoro.workDuration = 99;
    a.general.excludedFolderNames.push('X');
    expect(b.pomodoro.workDuration).toBe(25);
    expect(defaultSettings().general.excludedFolderNames).toEqual(['99 - Adjuntos']);
  });

  it('v1 → v2: copia ajustes, conserva legado intacto y pide respaldo', () => {
    const v1 = {
      timeLogs: [{ id: '1', taskNotePath: 'a.md', startTime: 'x', endTime: 'y', durationMinutes: 3, notes: '' }],
      activeTimer: { taskNotePath: 'a.md', startTime: '2025-01-01T00:00:00Z' },
      pomodoroSettings: { workDuration: 50, shortBreakDuration: 10 },
      pomodoroStats: { totalWorkSessions: 3 },
      journalSettings: { baseFolderPath: 'J', yearSubfolder: true, quarterSubfolder: true, monthSubfolder: false, weekFolderPattern: '{YYYY}/Q{Q}' },
      algoRaro: 1,
    };
    const { settings, wasV1 } = loadSettings(v1);
    expect(wasV1).toBe(true);
    expect(settings.schemaVersion).toBe(2);
    expect(settings.pomodoro).toMatchObject({ workDuration: 50, shortBreakDuration: 10, longBreakDuration: 15, overtimeAlertInterval: 5 });
    expect(settings.journal).toMatchObject({ baseFolderPath: 'J', quarterSubfolder: true, monthSubfolder: false, periodFolderPattern: '{YYYY}' });
    expect(settings.legacy?.timeLogs).toBe(v1.timeLogs);
    expect(settings.legacy?.activeTimer).toBe(v1.activeTimer);
    expect(settings.legacy?.pomodoroStats).toBe(v1.pomodoroStats);
    expect(settings.legacy?.extra).toEqual({ algoRaro: 1 });
  });

  it('v2 → v2: merge profundo tolerante a tipos erróneos y conserva legacy', () => {
    const { settings, wasV1 } = loadSettings({
      schemaVersion: 2,
      pomodoro: { workDuration: '30' },
      time: { staleLiveHours: 6 },
      general: { excludedFolderNames: ['A', 3] },
      legacy: { timeLogs: [1] },
    });
    expect(wasV1).toBe(false);
    expect(settings.pomodoro.workDuration).toBe(25);
    expect(settings.time.staleLiveHours).toBe(6);
    expect(settings.general.excludedFolderNames).toEqual(['A']);
    expect(settings.legacy?.timeLogs).toEqual([1]);
  });

  it('exclusiones con límite de carpeta', () => {
    const g = { excludedPathPrefixes: ['X/Plantillas'], excludedFolderNames: ['99 - Adjuntos'] };
    expect(isExcludedPath('X/Plantillas/t.md', g)).toBe(true);
    expect(isExcludedPath('X/Plantillas viejas/t.md', g)).toBe(false);
    expect(isExcludedPath('a/99 - Adjuntos/b.md', g)).toBe(true);
    expect(isExcludedPath('a/99 - Adjuntos.md', g)).toBe(false);
  });
});
