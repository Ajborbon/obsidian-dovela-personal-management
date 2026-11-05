/** Utilidades compartidas por las especificaciones de tipos de nota. */
import { toYymmdd } from '../../dates';
import { renderFrontmatter, type FmLine } from '../frontmatter';
import { notePath } from '../folders';
import { sanitizeName } from '../naming';
import { interpolate, type TemplateVars } from '../templateText';
import type { Answers, NoteEnv, NotePlan, NoteSpecId, NoteTypeSpec, Step } from './types';
import { NotePlanError } from './types';

export const EMPTY_NAME = '❌ Creación cancelada: el nombre no puede estar vacío.';

/** Primera pregunta aún sin respuesta (o null si ya se puede planificar). */
export function nextStep(spec: NoteTypeSpec, env: NoteEnv, answers: Answers): Step | null {
  return spec.steps(env, answers).find((s) => !Object.prototype.hasOwnProperty.call(answers, s.id)) ?? null;
}

/** Respuesta obligatoria (saneada como nombre de archivo); lanza `NotePlanError` si queda vacía. */
export function requiredName(answers: Answers, id: string, message = EMPTY_NAME): string {
  const v = sanitizeName(answers[id] ?? '');
  if (!v) throw new NotePlanError(message);
  return v;
}

export function answer(answers: Answers, id: string): string {
  return (answers[id] ?? '').trim();
}

/** Variables comunes para cuerpos (por defecto o personalizados). */
export function baseVars(env: NoteEnv, specType: string, title: string, folder: string): Record<string, string> {
  const padre = env.parent?.basename ?? '';
  return {
    titulo: title,
    tipo: specType,
    fecha: env.date,
    fechaNombre: toYymmdd(env.date),
    hora: env.time,
    fechaHora: `${env.date} ${env.time}`,
    padre,
    enlacePadre: padre ? `[[${padre}]]` : '',
    origen: padre ? `"[[${padre}]]"` : '""',
    origenInline: padre ? `origen:: [[${padre}]]` : '',
    carpeta: folder,
  };
}

export interface PlanParts {
  readonly specId: NoteSpecId;
  readonly title: string;
  readonly folder: string;
  readonly frontmatter: readonly FmLine[];
  /** Cuerpo con marcadores `{{…}}`. */
  readonly bodyTemplate: string;
  readonly vars: TemplateVars;
  readonly parentLink: string | null;
}

export function makePlan(p: PlanParts): NotePlan {
  const frontmatter = renderFrontmatter(p.frontmatter);
  const body = interpolate(p.bodyTemplate, p.vars);
  return {
    specId: p.specId,
    title: p.title,
    folder: p.folder,
    path: notePath(p.folder, p.title),
    frontmatter,
    body,
    content: frontmatter + body,
    parentLink: p.parentLink,
    vars: p.vars,
  };
}

/** Enlace que las plantillas simples insertaban con `cursor_append`: `[[título|título]]`. */
export function aliasLink(title: string): string {
  return `[[${title}|${title}]]`;
}
