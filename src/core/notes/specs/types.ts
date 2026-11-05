/**
 * Especificación declarativa de un tipo de nota DOVELA (02 §1, opción C): preguntas (equivalentes a
 * `tp.system.prompt/suggester`), nombre, carpeta destino, frontmatter exacto, cuerpo y enlace al padre.
 * Todo puro: la UI solo pregunta, crea el archivo y abre la nota.
 */
import type { NoteType } from '../types';
import type { TemplateVars } from '../templateText';

/** Identificador de especificación (también nombre del archivo de personalización `Plt - <id>.md`). */
export type NoteSpecId =
  | 'Ax' | 'Btx' | 'Cmt' | 'Podx' | 'Prx' | 'Tx' | 'Vx' | 'Ref' | 'Sue' | 'Reu'
  | 'PGTD' | 'AV' | 'AI' | 'RR' | 'RR-Tx' | 'RR-Btx' | 'RC';

export interface ChoiceOption {
  readonly label: string;
  readonly value: string;
}

export type Step =
  | {
    readonly kind: 'text';
    readonly id: string;
    readonly prompt: string;
    readonly defaultValue?: string;
    readonly placeholder?: string;
    /** Vacío no permitido (la plantilla cancelaba con “el nombre no puede estar vacío”). */
    readonly required: boolean;
  }
  | {
    readonly kind: 'choice';
    readonly id: string;
    readonly prompt: string;
    readonly options: readonly ChoiceOption[];
  };

/** Nota padre (equivale a `tp.config.active_file` / nota sobre la que se invoca el comando). */
export interface ParentNote {
  readonly path: string;
  readonly basename: string;
  /** Carpeta del padre (`''` = raíz). */
  readonly folder: string;
}

export interface NoteEnv {
  /** Fecha local `YYYY-MM-DD` y hora local `HH:mm` del momento de creación. */
  readonly date: string;
  readonly time: string;
  readonly parent: ParentNote | null;
  /**
   * Carpeta “donde se creó” cuando no hay padre: la carpeta elegida en el explorador o la ubicación
   * por defecto de notas nuevas de Obsidian (equivale a `tp.file.folder(true)`).
   */
  readonly contextFolder: string;
  /** Carpeta de la Bandeja de Entrada (`00 - Inbox`). */
  readonly inboxFolder: string;
  /** ¿Existe un archivo o carpeta en esta ruta? (consulta síncrona al vault). */
  exists(path: string): boolean;
}

export type Answers = Readonly<Record<string, string>>;

export interface NotePlan {
  readonly specId: NoteSpecId;
  readonly title: string;
  readonly folder: string;
  /** Ruta completa con `.md`. */
  readonly path: string;
  readonly frontmatter: string;
  readonly body: string;
  /** frontmatter + body */
  readonly content: string;
  /** Texto a insertar en el padre (o null si la plantilla no lo hacía en este caso). */
  readonly parentLink: string | null;
  /** Variables disponibles para un cuerpo personalizado (`{{titulo}}`, `{{fecha}}`, …). */
  readonly vars: TemplateVars;
}

export interface NoteTypeSpec {
  readonly id: NoteSpecId;
  readonly type: NoteType;
  /** Nombre visible en el selector. */
  readonly label: string;
  readonly description: string;
  /** Plantilla Templater de v1 que reemplaza (referencia). */
  readonly template: string;
  /** Preguntas aplicables con las respuestas dadas hasta ahora (el flujo pide la primera sin respuesta). */
  steps(env: NoteEnv, answers: Answers): readonly Step[];
  plan(env: NoteEnv, answers: Answers): NotePlan;
}

/** Error de validación (respuesta obligatoria vacía, etc.). La UI lo muestra y no crea nada. */
export class NotePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotePlanError';
  }
}
