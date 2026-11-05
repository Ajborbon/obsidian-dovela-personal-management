/** Tipos de nota del vault DOVELA y su detección (frontmatter `type` o prefijo del nombre). */

export const NOTE_TYPES = [
  'GrupoAV', 'AV', 'AI', 'PQ', 'PGTD', 'Cp', 'EMkt', 'RR', 'RC', 'Ax', 'Btx', 'Cmt', 'Tx', 'Reu',
  'Ref', 'Rf', 'Sue', 'Vx', 'Podx', 'Prx', 'RT', 'RL', 'Dly', 'Wly', 'Mly', 'Qly', 'Hly', 'Yly',
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

/** Alias de v1 (parser) → vocabulario de las plantillas del vault. */
const TYPE_ALIASES: Readonly<Record<string, NoteType>> = {
  Wk: 'Wly', M: 'Mly', Q: 'Qly', H: 'Hly', Y: 'Yly',
};

/** Prefijos de nombre en el orden de v1 (+ tipos del vault que v1 no conocía). */
const PREFIXES: readonly NoteType[] = [
  'AV', 'AI', 'PGTD', 'PQ', 'RR', 'RC', 'Tx', 'Vx', 'Reu', 'Rf', 'Ref', 'Sue', 'Cp', 'EMkt', 'RT', 'RL',
  'Btx', 'Cmt', 'Podx', 'Prx', 'Ax',
];

const KNOWN = new Set<string>(NOTE_TYPES);

export function normalizeType(value: unknown): NoteType | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (KNOWN.has(v)) return v as NoteType;
  return TYPE_ALIASES[v] ?? null;
}

/** 1) `type` del frontmatter si es conocido; 2) prefijo `TIPO␠`; 3) `Ax`. */
export function detectNoteType(basename: string, fmType: unknown): NoteType {
  const fromFm = normalizeType(fmType);
  if (fromFm) return fromFm;
  for (const p of PREFIXES) if (basename.startsWith(`${p} `)) return p;
  return 'Ax';
}

/** Orden por tipo en la jerarquía (v1 `TYPE_ORDER`, ampliado). */
export const TYPE_ORDER: Readonly<Record<string, number>> = {
  Root: 0, GrupoAV: 1, AV: 2, AI: 3, PQ: 4, PGTD: 5, Cp: 6, EMkt: 7, RR: 8, RC: 8, Ax: 9, Btx: 9, Cmt: 9,
  Podx: 9, Prx: 9, Tx: 10, Reu: 11, Rf: 12, Ref: 12, Sue: 13, Vx: 14, RT: 15, RL: 16, Dly: 17, Wly: 18,
  Mly: 19, Qly: 20, Hly: 21, Yly: 22,
};

/** Notas contenedor donde viven tareas según las reglas del vault. */
export const TASK_CONTAINER_TYPES: ReadonlySet<NoteType> = new Set<NoteType>(['PGTD', 'RR', 'Reu', 'AV', 'AI', 'PQ']);

export const ESTADOS = ['🟡', '🟢', '🔵', '🔴'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABELS: Readonly<Record<Estado, string>> = {
  '🟡': 'Captura / borrador / pausa',
  '🟢': 'Activo / en proceso',
  '🔵': 'Revisado / archivado / procesado',
  '🔴': 'Bloqueado / error',
};

/** Normaliza el valor de `estado:` (quita selector de variación y espacios). */
export function normalizeEstado(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/️/g, '').trim();
}

export function isActiveEstado(value: unknown): boolean {
  return normalizeEstado(value) === '🟢';
}
