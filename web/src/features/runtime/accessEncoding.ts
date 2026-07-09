// Artist runtime - access-policy encoding between the app model and the chain.
//
// Artist runtime track records store the access mode and required personhood as
// small uint8s. These pure codecs centralize that mapping, which was inline and
// duplicated across useArtistConsole (encode, on register) and useCatalog
// (decode, on catalog load).

import type { AccessMode, PersonhoodLevel } from '../../shared/types';

/** Access mode -> chain uint8 (human-free = 0, classic = 1, free = 2). */
export function encodeAccessMode(accessMode: AccessMode): number {
  if (accessMode === 'human-free') return 0;
  if (accessMode === 'classic') return 1;
  return 2;
}

/** Chain uint8 -> access mode (1 = classic, 2 = free, anything else = human-free). */
export function decodeAccessMode(value: number): AccessMode {
  if (value === 1) return 'classic';
  if (value === 2) return 'free';
  return 'human-free';
}

/** Personhood level -> chain uint8 (DIM2 = 2, DIM1 = 1). */
export function encodePersonhood(level: PersonhoodLevel): number {
  return level === 'DIM2' ? 2 : 1;
}

/** Chain uint8 -> personhood level (2 = DIM2, anything else = DIM1). */
export function decodePersonhood(value: number): PersonhoodLevel {
  return value === 2 ? 'DIM2' : 'DIM1';
}

/**
 * Required-personhood uint8 for a track: only human-free (human-verified) tracks
 * carry a personhood requirement; Classic tracks gate on payment, so 0.
 */
export function encodeRequiredPersonhood(accessMode: AccessMode, level: PersonhoodLevel): number {
  return accessMode === 'human-free' ? encodePersonhood(level) : 0;
}

/**
 * Required-personhood value for the off-chain manifest: the level for human-free
 * tracks, or the sentinel 'None' for Classic tracks.
 */
export function manifestRequiredPersonhood(accessMode: AccessMode, level: PersonhoodLevel): PersonhoodLevel | 'None' {
  return accessMode === 'human-free' ? level : 'None';
}
