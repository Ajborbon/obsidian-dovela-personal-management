/**
 * Tipos con dos carriles (RI-E §5.2–5.3): Reflexión (Ref), Sueño (Sue) y Reunión (Reu).
 * Carril A: nota nombrada. Carril B: captura rápida (`Tipo YYMMDD-HHmm - Sin título`, estado 🟡 en
 * Ref/Sue, en la Bandeja de Entrada, con la tarea `#cx-procesar…`).
 */
import { fm, type FmLine } from '../frontmatter';
import { captureTitle, datedTitle, sanitizeName } from '../naming';
import {
  BODY_REF, BODY_REF_CAPTURA, BODY_REU, BODY_REU_CAPTURA, BODY_SUE, BODY_SUE_CAPTURA,
} from './bodies';
import { aliasLink, answer, baseVars, makePlan, requiredName, EMPTY_NAME } from './common';
import type { Answers, NoteEnv, NoteTypeSpec, Step } from './types';
import { NotePlanError } from './types';

interface TwoLaneDef {
  readonly id: 'Ref' | 'Sue';
  readonly label: string;
  readonly template: string;
  readonly modePrompt: string;
  readonly namedLabel: string;
  readonly namePrompt: string;
  readonly emptyMessage: string;
  readonly destPrompt: string;
  readonly captureSuffix: string;
  readonly rolAnalisis: string;
  readonly tags: FmLine;
  readonly body: string;
  readonly captureBody: string;
}

function twoLaneSpec(d: TwoLaneDef): NoteTypeSpec {
  return {
    id: d.id, type: d.id, label: d.label, template: d.template,
    description: `${d.id} YYMMDD - Nombre · captura: ${d.id} YYMMDD-HHmm - ${d.captureSuffix}`,
    steps(env, a) {
      const steps: Step[] = [{
        kind: 'choice', id: 'modo', prompt: d.modePrompt,
        options: [{ label: d.namedLabel, value: 'a' }, { label: '🎙️ No, captura rápida por voz', value: 'b' }],
      }];
      if (a['modo'] === 'a') {
        steps.push({ kind: 'text', id: 'nombre', prompt: d.namePrompt, required: true });
        if (env.parent) {
          steps.push({
            kind: 'choice', id: 'destino', prompt: d.destPrompt,
            options: [{ label: 'Misma carpeta que la nota actual', value: 'misma' }, { label: 'Inbox', value: 'inbox' }],
          });
        }
      }
      return steps;
    },
    plan(env, a) {
      const capture = a['modo'] === 'b';
      let title: string;
      let folder: string;
      let link = false;
      if (capture) {
        title = captureTitle(d.id, env.date, env.time, d.captureSuffix);
        folder = env.inboxFolder;
      } else {
        title = datedTitle(d.id, env.date, requiredName(a, 'nombre', d.emptyMessage));
        if (!env.parent) folder = env.contextFolder;
        else if (a['destino'] === 'misma') {
          folder = env.parent.folder;
          link = true;
        } else folder = env.inboxFolder;
      }
      const lines: FmLine[] = [fm.value('type', d.id), fm.value('fecha', env.date)];
      if (capture) lines.push(fm.value('fechaHora', `${env.date} ${env.time}`));
      lines.push(
        fm.origen(env.parent?.basename ?? null), fm.value('estado', capture ? '🟡' : '🟢'),
        fm.value('rol_analisis', d.rolAnalisis), fm.blank(), d.tags,
      );
      return makePlan({
        specId: d.id, title, folder, frontmatter: lines, bodyTemplate: capture ? d.captureBody : d.body,
        vars: { ...baseVars(env, d.id, title, folder), captura: capture ? 'sí' : '' },
        parentLink: link ? aliasLink(title) : null,
      });
    },
  };
}

export const REF_SPEC = twoLaneSpec({
  id: 'Ref', label: 'Reflexión (Ref)', template: 'Plt - Reflexión.md',
  modePrompt: '¿Cómo vas a crear esta reflexión?', namedLabel: '✅ Sí, ya sé el nombre',
  namePrompt: '¿Sobre qué reflexionas?', emptyMessage: EMPTY_NAME, destPrompt: '¿Dónde guardar la reflexión?',
  captureSuffix: 'Sin título', rolAnalisis: '""', tags: fm.empty('tags'), body: BODY_REF, captureBody: BODY_REF_CAPTURA,
});

export const SUE_SPEC = twoLaneSpec({
  id: 'Sue', label: 'Sueño (Sue)', template: 'Plt - Sueño.md',
  modePrompt: '¿Cómo vas a registrar este sueño?', namedLabel: '✅ Sí, recuerdo el sueño y puedo escribirlo',
  namePrompt: 'Título breve del sueño', emptyMessage: '❌ Creación cancelada: el título no puede estar vacío.',
  destPrompt: '¿Dónde guardar el sueño?', captureSuffix: 'Sueño sin título',
  rolAnalisis: '"[[Rol Análisis - Intérprete de Sueños]]"', tags: fm.list('tags', ['suenos']),
  body: BODY_SUE, captureBody: BODY_SUE_CAPTURA,
});

/** Participantes como en la plantilla: coma, sin `[[ ]]` ni `#` inicial, entre comillas con `"` escapadas. */
export function participantItems(raw: string): string[] {
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/^\[\[/, '').replace(/\]\]$/, '').replace(/^#/, '').trim())
    .map((p) => `"${p.replace(/"/g, '\\"')}"`);
}

function reuIsCapture(a: Answers): boolean {
  return a['modo'] === 'con_grabacion';
}

export const REU_SPEC: NoteTypeSpec = {
  id: 'Reu', type: 'Reu', label: 'Reunión (Reu)', template: 'Plt - Reunión.md',
  description: 'Reu YYMMDD - Nombre · con grabación sin nombre: Reu YYMMDD-HHmm - Sin título',
  steps(env, a) {
    const steps: Step[] = [{
      kind: 'choice', id: 'modo', prompt: '¿Cómo vas a registrar esta reunión?',
      options: [{ label: '📝 Reunión sin grabación', value: 'sin_grabacion' }, { label: '🎙️ Reunión con grabación', value: 'con_grabacion' }],
    }];
    if (a['modo'] === undefined) return steps;
    const capture = reuIsCapture(a);
    steps.push(
      {
        kind: 'text', id: 'nombre', required: !capture,
        prompt: capture ? '¿Qué nombre provisional tiene esta reunión?' : '¿Qué nombre tiene esta reunión?',
      },
      { kind: 'text', id: 'hora_inicio', prompt: 'Hora de inicio (HH:mm)', defaultValue: env.time, required: false },
      { kind: 'text', id: 'hora_fin', prompt: 'Hora de finalización (HH:mm)', defaultValue: env.time, required: false },
      {
        kind: 'text', id: 'participantes', required: false,
        prompt: 'Participantes separados por coma. Puedes usar [[wikilinks]] si aplica.',
      },
    );
    if (env.parent) {
      steps.push({
        kind: 'choice', id: 'destino', prompt: '¿Dónde guardar la reunión?',
        options: [
          { label: 'Misma carpeta que la nota actual', value: 'misma' },
          capture ? { label: 'Inbox', value: 'inbox' } : { label: 'Dejar aquí', value: 'aqui' },
        ],
      });
    }
    return steps;
  },
  plan(env: NoteEnv, a: Answers) {
    const capture = reuIsCapture(a);
    let nombre = sanitizeName(a['nombre'] ?? '');
    if (!nombre) {
      if (!capture) throw new NotePlanError(EMPTY_NAME);
      nombre = 'Sin título';
    }
    const title = capture && nombre === 'Sin título'
      ? captureTitle('Reu', env.date, env.time, 'Sin título')
      : datedTitle('Reu', env.date, nombre);
    const horaInicio = answer(a, 'hora_inicio') || env.time;
    const horaFin = answer(a, 'hora_fin') || env.time;
    let folder: string;
    let link = false;
    if (env.parent) {
      const d = a['destino'];
      if (d === 'misma') {
        folder = env.parent.folder;
        link = true;
      } else if (d === 'inbox') folder = env.inboxFolder;
      else folder = env.contextFolder;
    } else folder = capture ? env.inboxFolder : env.contextFolder;
    return makePlan({
      specId: 'Reu', title, folder,
      frontmatter: [
        fm.value('type', 'Reu'), fm.value('fecha', env.date), fm.value('hora_inicio', horaInicio), fm.value('hora_fin', horaFin),
        fm.value('modalidad', 'virtual'), fm.list('participantes', participantItems(a['participantes'] ?? '')),
        fm.origen(env.parent?.basename ?? null), fm.value('estado', '🟢'), fm.empty('tags'),
      ],
      bodyTemplate: capture ? BODY_REU_CAPTURA : BODY_REU,
      vars: { ...baseVars(env, 'Reu', title, folder), horaInicio, horaFin, captura: capture ? 'sí' : '' },
      parentLink: link ? aliasLink(title) : null,
    });
  },
};

