/** Registro de especificaciones de tipos de nota DOVELA (17 de creación; los 5 journals están en `journalNotes.ts`). */
import { REF_SPEC, REU_SPEC, SUE_SPEC } from './capture';
import { AI_SPEC, AV_SPEC, PGTD_SPEC, RC_SPEC, RR_BTX_SPEC, RR_SPEC, RR_TX_SPEC } from './containers';
import { AX_SPEC, BTX_SPEC, CMT_SPEC, PODX_SPEC, PRX_SPEC, TX_SPEC, VX_SPEC } from './simple';
import type { NoteSpecId, NoteTypeSpec } from './types';

export { nextStep } from './common';
export * from './types';

/** Orden del selector: los más frecuentes del vault primero (referencia-vault §tipos). */
export const NOTE_SPECS: readonly NoteTypeSpec[] = [
  AX_SPEC, BTX_SPEC, PGTD_SPEC, TX_SPEC, REU_SPEC, CMT_SPEC, REF_SPEC, SUE_SPEC, VX_SPEC, PODX_SPEC, PRX_SPEC,
  AV_SPEC, AI_SPEC, RR_SPEC, RR_TX_SPEC, RR_BTX_SPEC, RC_SPEC,
];

export function getNoteSpec(id: string): NoteTypeSpec | undefined {
  return NOTE_SPECS.find((s) => s.id === id);
}

/** Nombre del archivo de personalización del cuerpo en la carpeta de plantillas. */
export function overrideFileName(id: NoteSpecId | 'Dly' | 'Wly' | 'Mly' | 'Qly' | 'Yly'): string {
  return `Plt - ${id}.md`;
}
