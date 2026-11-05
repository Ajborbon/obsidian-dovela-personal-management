/**
 * Lista de funcionalidades en orden de registro. Cada una vive en `features/<id>/` y solo
 * se comunica con el resto a través de `DovelaContext` (índice, servicios, ajustes).
 */
import type { Feature } from '../context';
import { backlinksFeature } from './backlinks';
import { captureFeature } from './capture';
import { diagnosticsFeature } from './diagnostics';
import { gtdFeature } from './gtd';
import { journalFeature } from './journal';
import { notesFeature } from './notes';
import { panelsFeature } from './panels';
import { settingsFeature } from './settings';
import { timeFeature } from './time';

export const FEATURES: readonly Feature[] = [
  settingsFeature,
  diagnosticsFeature,
  timeFeature,
  gtdFeature, // Dashboard GTD + Foco
  captureFeature, // Smart Inbox
  panelsFeature, // Panel de actividad + Panel de revisión
  backlinksFeature,
  journalFeature, // journalAPI / weeklyAPI
  notesFeature, // motor de notas + selector de estado
];
