/**
 * Tipos “simples” (RI-E §5.2): Ax, Podx, Prx, Tx, Vx, Btx y Cmt. Sin carpeta propia.
 * Con nota padre: “Misma carpeta” (y enlace `[[título|título]]` en el padre) o “Inbox”.
 * Sin padre: la carpeta donde se invoca (explorador / ubicación por defecto de notas nuevas).
 */
import { fm, type FmLine } from '../frontmatter';
import { btxDescription, btxTitle, commitTitle, datedTitle } from '../naming';
import type { NoteType } from '../types';
import { BODY_AX, BODY_BTX, BODY_CMT, BODY_PODX, BODY_PRX, BODY_TX, BODY_VX } from './bodies';
import { aliasLink, answer, baseVars, makePlan, requiredName } from './common';
import type { Answers, NoteEnv, NotePlan, NoteSpecId, NoteTypeSpec, Step } from './types';

interface Dest {
  readonly folder: string;
  readonly linkInParent: boolean;
}

/** Pregunta de destino de las plantillas simples (solo si hay nota padre). */
function destStep(same: string, inbox: string): Step {
  return {
    kind: 'choice', id: 'destino', prompt: '¿Dónde guardar?',
    options: [{ label: same, value: 'misma' }, { label: inbox, value: 'inbox' }],
  };
}

function resolveDest(env: NoteEnv, a: Answers): Dest {
  if (!env.parent) return { folder: env.contextFolder, linkInParent: false };
  return a['destino'] === 'misma'
    ? { folder: env.parent.folder, linkInParent: true }
    : { folder: env.inboxFolder, linkInParent: false };
}

interface SimpleDef {
  readonly id: NoteSpecId;
  readonly type: NoteType;
  readonly label: string;
  readonly description: string;
  readonly template: string;
  readonly namePrompt: string;
  readonly sameLabel?: string;
  readonly inboxLabel?: string;
  readonly frontmatter: (env: NoteEnv) => readonly FmLine[];
  readonly body: string;
}

const SAME = 'Misma carpeta de nota actual';
const INBOX = 'Inbox - Creado desde Carpeta';

function simpleSpec(d: SimpleDef): NoteTypeSpec {
  return {
    id: d.id, type: d.type, label: d.label, description: d.description, template: d.template,
    steps(env) {
      const steps: Step[] = [{ kind: 'text', id: 'nombre', prompt: d.namePrompt, required: true }];
      if (env.parent) steps.push(destStep(d.sameLabel ?? SAME, d.inboxLabel ?? INBOX));
      return steps;
    },
    plan(env, a): NotePlan {
      const title = datedTitle(d.type, env.date, requiredName(a, 'nombre'));
      const dest = resolveDest(env, a);
      return makePlan({
        specId: d.id, title, folder: dest.folder, frontmatter: d.frontmatter(env), bodyTemplate: d.body,
        vars: baseVars(env, d.type, title, dest.folder), parentLink: dest.linkInParent ? aliasLink(title) : null,
      });
    },
  };
}

const origen = (env: NoteEnv): FmLine => fm.origen(env.parent?.basename ?? null);

export const AX_SPEC = simpleSpec({
  id: 'Ax', type: 'Ax', label: 'Anotación (Ax)', description: 'Ax YYMMDD - Nombre', template: 'Plt - Anotacion.md',
  namePrompt: 'Como se llama la nota?',
  frontmatter: (env) => [fm.value('type', 'Ax'), fm.value('fecha', env.date), fm.value('estado', '🟢'), origen(env), fm.value('tags', '')],
  body: BODY_AX,
});

export const PODX_SPEC = simpleSpec({
  id: 'Podx', type: 'Podx', label: 'Podcast (Podx)', description: 'Podx YYMMDD - Tema', template: 'Plt - Podcast.md',
  namePrompt: 'Cual es el tema del podcast?',
  frontmatter: (env) => [fm.value('type', 'Podx'), fm.value('fecha', env.date), fm.value('estado', '🟢'), origen(env), fm.value('tags', '')],
  body: BODY_PODX,
});

export const PRX_SPEC = simpleSpec({
  id: 'Prx', type: 'Prx', label: 'Prompt (Prx)', description: 'Prx YYMMDD - Para qué sirve', template: 'Plt - Prompt.md',
  namePrompt: '¿Para que sirve este prompt?',
  frontmatter: (env) => [fm.value('type', 'Prx'), fm.value('estado', '🟢'), origen(env), fm.empty('tags')],
  body: BODY_PRX,
});

export const TX_SPEC = simpleSpec({
  id: 'Tx', type: 'Tx', label: 'Transacción (Tx)', description: 'Tx YYMMDD - Nombre', template: 'Plt - Transacción.md',
  namePrompt: 'Nombre de la Transacción?', sameLabel: 'Misma carpeta', inboxLabel: 'Inbox',
  frontmatter: (env) => [
    fm.value('type', 'Tx'), fm.value('estado', '🟢'), fm.value('tags', ''), fm.value('monto', ''), fm.value('moneda', 'COP'),
    fm.value('tipoTransaccion', 'Crédito'), fm.value('cuenta', 'Bancolombia Ahorros'), origen(env),
  ],
  body: BODY_TX,
});

export const VX_SPEC = simpleSpec({
  id: 'Vx', type: 'Vx', label: 'Video (Vx)', description: 'Vx YYMMDD - Título', template: 'Plt - Video.md',
  namePrompt: '¿Título del video?',
  frontmatter: (env) => [fm.value('type', 'Vx'), fm.value('estado', '🟢'), origen(env), fm.empty('destacado'), fm.empty('tags')],
  body: BODY_VX,
});

/** Bitácora de sesión: siempre en la carpeta del padre; en el padre `- [[título]] — fecha | desc`. */
export const BTX_SPEC: NoteTypeSpec = {
  id: 'Btx', type: 'Btx', label: 'Bitácora de sesión (Btx)', description: 'Btx YYMMDD - Sesión NN - Descripción',
  template: 'Plt - Bitacora.md',
  steps: () => [
    { kind: 'text', id: 'sesion', prompt: 'Número de sesión (ej. 01, 02, 15):', defaultValue: '01', required: true },
    { kind: 'text', id: 'descripcion', prompt: 'Descripción corta de la sesión (máx 50 caracteres):', required: true },
  ],
  plan(env, a) {
    const session = requiredName(a, 'sesion', '❌ Creación cancelada: el número de sesión no puede estar vacío.');
    requiredName(a, 'descripcion', '❌ Creación cancelada: la descripción no puede estar vacía.');
    const desc = btxDescription(env.date, session, a['descripcion'] ?? '');
    const title = btxTitle(env.date, session, a['descripcion'] ?? '');
    const folder = env.parent ? env.parent.folder : env.contextFolder;
    return makePlan({
      specId: 'Btx', title, folder,
      frontmatter: [
        fm.value('type', 'Btx'), fm.value('fecha', env.date), fm.value('estado', '🟢'), origen(env),
        fm.list('tags', ['"#cx-SesionesTrabajo"']),
      ],
      bodyTemplate: BODY_BTX,
      vars: { ...baseVars(env, 'Btx', title, folder), sesion: session, descripcion: desc },
      parentLink: env.parent ? `- [[${title}]] — ${env.date} | ${desc}\n` : null,
    });
  },
};

/** Commit: `Cmt YYMMDD HHmm - nombre` (nombre saneado), `origen::` en línea en el cuerpo. */
export const CMT_SPEC: NoteTypeSpec = {
  id: 'Cmt', type: 'Cmt', label: 'Commit (Cmt)', description: 'Cmt YYMMDD HHmm - Nombre', template: 'Plt - Commit.md',
  steps(env) {
    const steps: Step[] = [
      { kind: 'text', id: 'nombre', prompt: '¿Cómo se llama el commit?', required: true },
      { kind: 'text', id: 'hash', prompt: '¿Ingresa el hash del commit?', required: false },
    ];
    if (env.parent) steps.push(destStep(SAME, INBOX));
    return steps;
  },
  plan(env, a) {
    const title = commitTitle(env.date, env.time, requiredName(a, 'nombre'));
    const dest = resolveDest(env, a);
    const hash = answer(a, 'hash');
    return makePlan({
      specId: 'Cmt', title, folder: dest.folder,
      frontmatter: [
        fm.value('type', 'Cmt'), fm.value('commit', hash), fm.value('branch', 'main'), fm.value('tagVersion', ''),
        fm.value('estado', '🟢'), fm.empty('tags'),
      ],
      bodyTemplate: BODY_CMT,
      vars: { ...baseVars(env, 'Cmt', title, dest.folder), commit: hash },
      parentLink: dest.linkInParent ? aliasLink(title) : null,
    });
  },
};
