/**
 * Contenedores PGTD / AV / AI / RR / RR Transacciones / RC (reglas de carpeta RI-E §5.5) y el caso fijo
 * `RR - Sesiones de trabajo` (RR Bitácoras).
 *
 * 1. Carpeta base = carpeta de la nota padre (o la del explorador / ubicación por defecto); “Bandeja de
 *    Entrada” la sustituye por `00 - Inbox`.
 * 2. Si la carpeta ya es del tipo (`AV - …`, `PGTD - …`, `PGTD YYMMDD - …`) y le falta su nota índice
 *    homónima, se ofrece crearla (`carpeta/carpeta.md`).
 * 3. Si no: con carpeta (`base/Título/Título.md`) o sin carpeta (`base/Título.md`).
 * 4. En el padre se inserta `[[ruta-sin-md|Título]]`.
 */
import { fm, type FmLine } from '../frontmatter';
import { folderName, joinPath, notePath, withoutMd } from '../folders';
import { containerTitle, datedTitle } from '../naming';
import type { NoteType } from '../types';
import { BODY_AI, BODY_AV, BODY_PGTD, BODY_RC, BODY_RR, BODY_RR_BTX, BODY_RR_TX } from './bodies';
import { baseVars, makePlan, requiredName } from './common';
import type { Answers, ChoiceOption, NoteEnv, NoteSpecId, NoteTypeSpec, Step } from './types';

interface ContainerDef {
  readonly id: NoteSpecId;
  readonly type: NoteType;
  readonly label: string;
  readonly description: string;
  readonly template: string;
  /** ¿La carpeta ya es de este tipo? */
  readonly isTypeFolder: (name: string) => boolean;
  /** Nombre visible de la carpeta en la pregunta “crear la nota principal”. */
  readonly displayName: (name: string) => string;
  readonly titleFor: (env: NoteEnv, name: string) => string;
  readonly inboxPrompt: string;
  readonly mainPrompt: string;
  readonly mainYes: (display: string) => string;
  readonly mainNo: string;
  readonly subModePrompt: string;
  readonly subModeLabels: readonly [string, string];
  readonly subNamePrompt: string;
  readonly newModePrompt: string;
  readonly newModeLabels: readonly [string, string];
  readonly newNamePrompt: string;
  readonly frontmatter: (env: NoteEnv) => readonly FmLine[];
  readonly body: string;
}

const INBOX_OPTIONS: readonly ChoiceOption[] = [
  { label: 'No, usar carpeta actual', value: 'no' },
  { label: 'Sí, crear en Bandeja de Entrada', value: 'si' },
];

function modeOptions(labels: readonly [string, string]): readonly ChoiceOption[] {
  return [{ label: labels[0], value: 'folder' }, { label: labels[1], value: 'file' }];
}

/** Carpeta de trabajo según el contexto y la respuesta “Bandeja de Entrada”. */
export function containerBaseFolder(env: NoteEnv, a: Answers): string {
  if (a['inbox'] === 'si') return env.inboxFolder;
  return env.parent ? env.parent.folder : env.contextFolder;
}

/** ¿Hay que ofrecer crear la nota índice de la carpeta actual? */
function needsMainQuestion(d: ContainerDef, env: NoteEnv, base: string): boolean {
  const name = folderName(base);
  return d.isTypeFolder(name) && !env.exists(notePath(base, name));
}

function containerSpec(d: ContainerDef): NoteTypeSpec {
  return {
    id: d.id, type: d.type, label: d.label, description: d.description, template: d.template,
    steps(env, a) {
      const steps: Step[] = [{ kind: 'choice', id: 'inbox', prompt: d.inboxPrompt, options: INBOX_OPTIONS }];
      if (a['inbox'] === undefined) return steps;
      const base = containerBaseFolder(env, a);
      const name = folderName(base);
      const typeFolder = d.isTypeFolder(name);
      if (needsMainQuestion(d, env, base)) {
        steps.push({
          kind: 'choice', id: 'principal', prompt: d.mainPrompt,
          options: [{ label: d.mainYes(d.displayName(name)), value: 'si' }, { label: d.mainNo, value: 'no' }],
        });
        if (a['principal'] === undefined || a['principal'] === 'si') return steps;
      }
      steps.push(
        {
          kind: 'choice', id: 'modo', prompt: typeFolder ? d.subModePrompt : d.newModePrompt,
          options: modeOptions(typeFolder ? d.subModeLabels : d.newModeLabels),
        },
        { kind: 'text', id: 'nombre', prompt: typeFolder ? d.subNamePrompt : d.newNamePrompt, required: true },
      );
      return steps;
    },
    plan(env, a) {
      const base = containerBaseFolder(env, a);
      let title: string;
      let folder: string;
      if (a['principal'] === 'si' && needsMainQuestion(d, env, base)) {
        title = folderName(base);
        folder = base;
      } else {
        title = d.titleFor(env, requiredName(a, 'nombre'));
        folder = a['modo'] === 'folder' ? joinPath(base, title) : base;
      }
      const path = notePath(folder, title);
      return makePlan({
        specId: d.id, title, folder, frontmatter: d.frontmatter(env), bodyTemplate: d.body,
        vars: baseVars(env, d.type, title, folder),
        parentLink: env.parent ? `[[${withoutMd(path)}|${title}]]` : null,
      });
    },
  };
}

const PGTD_FOLDER_RE = /^PGTD\s\d{6}\s-\s/;
const origen = (env: NoteEnv): FmLine => fm.origen(env.parent?.basename ?? null);
const standardFm = (type: string) => (env: NoteEnv): readonly FmLine[] =>
  [fm.value('type', type), fm.value('estado', '🟢'), origen(env), fm.empty('tags')];

function prefixed(prefix: string): Pick<ContainerDef, 'isTypeFolder' | 'displayName' | 'titleFor'> {
  return {
    isTypeFolder: (name) => name.startsWith(`${prefix} - `),
    displayName: (name) => name.replace(`${prefix} - `, '').trim(),
    titleFor: (_env, name) => containerTitle(prefix, name),
  };
}

const SUB_ITEM: readonly [string, string] = ['Crear Sub-item con Carpeta', 'Crear Sub-item sin Carpeta (solo archivo)'];

export const PGTD_SPEC = containerSpec({
  id: 'PGTD', type: 'PGTD', label: 'Proyecto GTD (PGTD)', description: 'PGTD YYMMDD - Nombre (con o sin carpeta propia)',
  template: 'Plt - PGTD Fecha.md',
  isTypeFolder: (name) => !!name && (name.startsWith('PGTD - ') || PGTD_FOLDER_RE.test(name)),
  displayName: (name) => name.replace(/^PGTD - /, '').replace(PGTD_FOLDER_RE, '').trim(),
  titleFor: (env, name) => datedTitle('PGTD', env.date, name),
  inboxPrompt: '¿Deseas crear el proyecto en la Bandeja de Entrada?',
  mainPrompt: '¿Crear el proyecto principal para esta carpeta?',
  mainYes: (n) => `Sí, crear el proyecto principal "${n}"`,
  mainNo: 'No, crear un sub-proyecto dentro de la carpeta',
  subModePrompt: '¿Cómo deseas crear el nuevo sub-proyecto PGTD?',
  subModeLabels: ['Crear Sub-proyecto con Carpeta', 'Crear Sub-proyecto sin Carpeta (solo archivo)'],
  subNamePrompt: '¿Cuál es el nombre del nuevo sub-proyecto?',
  newModePrompt: '¿Cómo deseas crear el nuevo proyecto PGTD?',
  newModeLabels: ['Crear Proyecto con Carpeta', 'Crear Proyecto sin Carpeta (solo archivo)'],
  newNamePrompt: '¿Cuál es el nombre del proyecto?',
  frontmatter: (env) => [fm.value('type', 'PGTD'), fm.value('estado', '🟢'), fm.value('fecha', env.date), origen(env), fm.empty('tags')],
  body: BODY_PGTD,
});

export const AV_SPEC = containerSpec({
  id: 'AV', type: 'AV', label: 'Área de Vida (AV)', description: 'AV - Nombre (con o sin carpeta propia)',
  template: 'Plt - Area Vida.md', ...prefixed('AV'),
  inboxPrompt: '¿Deseas crear el Area de Vida en la Bandeja de Entrada?',
  mainPrompt: '¿Crear la nota de Area de Vida para esta carpeta?',
  mainYes: (n) => `Sí, crear el Area de Vida de la carpeta "${n}"`,
  mainNo: 'No, crear un sub-item dentro de la carpeta',
  subModePrompt: '¿Cómo deseas crear el nuevo sub-item AV?', subModeLabels: SUB_ITEM,
  subNamePrompt: '¿Cuál es el nombre del nuevo sub-item?',
  newModePrompt: '¿Cómo deseas crear la nueva Area de Vida?',
  newModeLabels: ['Crear Area de Vida con Carpeta', 'Crear Area de Vida sin Carpeta (solo archivo)'],
  newNamePrompt: '¿Cuál es el nombre del Area de Vida?',
  frontmatter: standardFm('AV'), body: BODY_AV,
});

export const AI_SPEC = containerSpec({
  id: 'AI', type: 'AI', label: 'Área de Interés (AI)', description: 'AI - Nombre (con o sin carpeta propia)',
  template: 'Plt - Area Interes.md', ...prefixed('AI'),
  inboxPrompt: '¿Deseas crear el Area de Interés en la Bandeja de Entrada?',
  mainPrompt: '¿Crear la nota de Area de Interés para esta carpeta?',
  mainYes: (n) => `Sí, crear el Area de Interés de la carpeta "${n}"`,
  mainNo: 'No, crear un sub-item dentro de la carpeta',
  subModePrompt: '¿Cómo deseas crear el nuevo sub-item AI?', subModeLabels: SUB_ITEM,
  subNamePrompt: '¿Cuál es el nombre del nuevo sub-item?',
  newModePrompt: '¿Cómo deseas crear la nueva Area de Interés?',
  newModeLabels: ['Crear Area de Interés con Carpeta', 'Crear Area de Interés sin Carpeta (solo archivo)'],
  newNamePrompt: '¿Cuál es el nombre del Area de Interés?',
  frontmatter: standardFm('AI'), body: BODY_AI,
});

const RR_TEXTS = {
  ...prefixed('RR'),
  inboxPrompt: '¿Deseas crear el proyecto en la Bandeja de Entrada?',
  mainPrompt: '¿Crear la nota del Recurso principal para esta carpeta?',
  mainYes: (n: string) => `Sí, crear la nota del recurso principal "${n}"`,
  mainNo: 'No, crear un sub-item dentro de la carpeta',
  // v1 decía “sub-item PGTD” (copia de la plantilla de proyectos); se corrige el texto.
  subModePrompt: '¿Cómo deseas crear el nuevo sub-item RR?', subModeLabels: SUB_ITEM,
  subNamePrompt: '¿Cuál es el nombre del nuevo sub-item?',
  newModePrompt: '¿Cómo deseas crear el nuevo Recurso Recurrente?',
  newModeLabels: ['Crear Recurso con Carpeta', 'Crear Recurso sin Carpeta (solo archivo)'] as const,
  newNamePrompt: '¿Cuál es el nombre del Recurso?',
  frontmatter: standardFm('RR'),
};

export const RR_SPEC = containerSpec({
  id: 'RR', type: 'RR', label: 'Recurso Recurrente (RR)', description: 'RR - Nombre/RR - Nombre.md',
  template: 'Plt - Recurso Recurrente.md', ...RR_TEXTS, body: BODY_RR,
});

export const RR_TX_SPEC = containerSpec({
  id: 'RR-Tx', type: 'RR', label: 'Recurso Recurrente de transacciones (RR)',
  description: 'RR - Nombre con tabla de Tx de la carpeta', template: 'Plt - Recurso Recurrente Transacciones.md',
  ...RR_TEXTS, body: BODY_RR_TX,
});

export const RC_SPEC = containerSpec({
  id: 'RC', type: 'RC', label: 'Registro de commits (RC)', description: 'RC - Nombre (con o sin carpeta propia)',
  template: 'Plt - Registro Commits.md', ...prefixed('RC'),
  inboxPrompt: '¿Deseas crear el Registro en la Bandeja de Entrada?',
  mainPrompt: '¿Crear la nota del Recurso principal para esta carpeta?',
  mainYes: (n) => `Sí, crear la nota del recurso principal "${n}"`,
  mainNo: 'No, crear un sub-item dentro de la carpeta',
  subModePrompt: '¿Cómo deseas crear el nuevo Registro de Commits?',
  subModeLabels: ['Crear Registro de Commits con Carpeta', 'Crear Registro de Commits sin Carpeta (solo archivo)'],
  subNamePrompt: '¿Cuál es el nombre del nuevo Registro de Commits?',
  newModePrompt: '¿Cómo deseas crear el nuevo Registro de Commits?',
  newModeLabels: ['Crear Registro con Carpeta', 'Crear Registro sin Carpeta (solo archivo)'],
  newNamePrompt: '¿Cuál es el nombre del Registro?',
  frontmatter: (_env) => [fm.value('type', 'RC'), fm.value('estado', '🟢'), fm.empty('tags')],
  body: BODY_RC,
});

export const RR_BTX_TITLE = 'RR - Sesiones de trabajo';

/**
 * RR de bitácoras: sin preguntas; carpeta fija `RR - Sesiones de trabajo/` dentro de la carpeta del padre.
 * La plantilla v1 empezaba con `---\n---\n` (frontmatter vacío + propiedades como texto); aquí se escribe
 * un frontmatter válido con las mismas claves.
 */
export const RR_BTX_SPEC: NoteTypeSpec = {
  id: 'RR-Btx', type: 'RR', label: 'Recurso Recurrente de bitácoras (RR - Sesiones de trabajo)',
  description: 'RR - Sesiones de trabajo/RR - Sesiones de trabajo.md', template: 'Plt - Recurso Recurrente Bitacoras.md',
  steps: () => [],
  plan(env) {
    const folder = joinPath(env.parent ? env.parent.folder : env.contextFolder, RR_BTX_TITLE);
    const path = notePath(folder, RR_BTX_TITLE);
    return makePlan({
      specId: 'RR-Btx', title: RR_BTX_TITLE, folder,
      frontmatter: [fm.value('type', 'RR'), fm.value('estado', '🟢'), origen(env), fm.list('tags', ['"#cx-SesionesTrabajo"'])],
      bodyTemplate: BODY_RR_BTX,
      vars: baseVars(env, 'RR', RR_BTX_TITLE, folder),
      parentLink: env.parent ? `- [[${withoutMd(path)}|${RR_BTX_TITLE}]] — Repositorio de sesiones de trabajo del proyecto.\n` : null,
    });
  },
};
