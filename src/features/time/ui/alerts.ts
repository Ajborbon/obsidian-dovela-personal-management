/**
 * Avisos de Pomodoro: Notice, notificación del sistema (pide permiso solo si están activadas),
 * sonido WebAudio (800/600/800 Hz como v1) y vibración. Sin APIs de Node/Electron.
 */
import { Notice } from 'obsidian';
import type { PomodoroSettings } from '../../../core/settings';
import { logger } from '../../../host/logger';

type AudioCtor = typeof AudioContext;

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (audio) return audio;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audio = new Ctor();
  } catch (e) {
    logger.debug('WebAudio no disponible', e);
    audio = null;
  }
  return audio;
}

export function chime(): void {
  const ac = audioContext();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') void ac.resume();
    const t0 = ac.currentTime;
    [800, 600, 800].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.21);
    });
  } catch (e) {
    logger.debug('No se pudo reproducir el sonido', e);
  }
}

export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Sin vibración en este dispositivo.
  }
}

/** Notificación del sistema. Solo pide permiso si el usuario activó las notificaciones. */
export async function systemNotify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined') return;
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body, silent: true });
  } catch (e) {
    logger.debug('Notificación del sistema no disponible', e);
  }
}

/** Aviso completo según los ajustes de Pomodoro. */
export function alertUser(p: Pick<PomodoroSettings, 'soundEnabled' | 'notificationsEnabled'>, title: string, body: string, noticeMs = 8000): void {
  new Notice(`${title} — ${body}`, noticeMs);
  if (p.notificationsEnabled) void systemNotify(title, body);
  if (p.soundEnabled) chime();
  vibrate();
}

export function disposeAudio(): void {
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
}
