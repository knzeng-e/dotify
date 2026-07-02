// Player status - pure playback status model and label/progress helpers.
//
// Extracted from usePlayback (status type + label) and PlayerView (transport
// progress math) so the presentational mapping is testable without React.

import type { Mode } from '../../types';

export type AudioStatus =
  | 'idle' //            nothing selected yet
  | 'preparing' //       source set, decoding / loading metadata
  | 'autoplay-blocked' // play() was rejected; a tap is needed
  | 'ready' //           host source loaded and capturable ("Hosting")
  | 'playing' //         sound is actually playing
  | 'joining' //         room listener waiting for the live stream
  | 'no-audio'; //       genuine failure or missing source

/** Human label for a playback status, phrased for the host or the listener. */
export function playbackStatusLabel(status: AudioStatus, mode: Mode): string {
  switch (status) {
    case 'preparing':
      return 'Preparing audio';
    case 'autoplay-blocked':
      return 'Tap play to start';
    case 'joining':
      return 'Joining live audio';
    case 'no-audio':
      return 'No audio available';
    case 'playing':
      return mode === 'host' ? 'Playing' : 'In sync';
    case 'ready':
      return mode === 'host' ? 'Hosting' : 'Connected';
    case 'idle':
      return '';
    default:
      return mode === 'host' ? 'Hosting' : 'Ready';
  }
}

/** Transport progress as a clamped 0-100 percentage; 0 when duration is unknown. */
export function transportProgressPercent(currentTime: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}
