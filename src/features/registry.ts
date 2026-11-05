/** Lista de funcionalidades en orden de registro. Cada una vive en `features/<id>/`. */
import type { Feature } from '../context';
import { diagnosticsFeature } from './diagnostics';
import { settingsFeature } from './settings';
import { timeFeature } from './time';

export const FEATURES: readonly Feature[] = [
  settingsFeature,
  diagnosticsFeature,
  timeFeature,
];
