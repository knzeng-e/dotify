// ── Living Light aura engine ──────────────────────────────────────────────────
// Each track casts its own colored light into the whole room. Real catalog tracks
// carry no hand-authored palette, so the aura is derived deterministically from a
// hue hash of the track (stable, distinct per work, no image decoding required).

import type { CatalogTrack, TrackInfo } from '../types';

export type Aura = {
  hue: number;
  a: string;
  b: string;
  accent: string;
};

// Calm deep-blue light shown when nothing is playing.
export const RESTING_AURA: Aura = {
  hue: 222,
  a: 'hsl(150 80% 58%)',
  b: 'hsl(196 78% 52%)',
  accent: 'hsl(150 84% 60%)'
};

export function hashHue(value: string): number {
  let hash = 0;
  const valueLength = value.length;
  for (let index = 0; index < valueLength; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

export function auraFromHue(hue: number): Aura {
  return {
    hue,
    a: `hsl(${hue} 86% 64%)`,
    b: `hsl(${(hue + 54) % 360} 78% 54%)`,
    accent: `hsl(${hue} 90% 62%)`
  };
}

// Accepts either a CatalogTrack or a TrackInfo (room/player can carry either shape).
export function auraForTrack(track: { id?: string; title?: string; artist?: string } | null | undefined): Aura {
  if (!track) return RESTING_AURA;
  const key = track.id || `${track.title ?? ''}::${track.artist ?? ''}`;
  if (!key.trim()) return RESTING_AURA;
  return auraFromHue(hashHue(key));
}

export function auraForName(name: string | null | undefined): Aura {
  if (!name || !name.trim()) return RESTING_AURA;
  return auraFromHue(hashHue(name));
}

// Writes the aura onto :root so every aura-aware surface lights up at once.
export function applyAura(aura: Aura): void {
  const root = document.documentElement;
  root.style.setProperty('--aura-a', aura.a);
  root.style.setProperty('--aura-b', aura.b);
  root.style.setProperty('--aura-accent', aura.accent);
  root.style.setProperty('--aura-hue', String(aura.hue));
}

// Convenience for components that style a single element with a track's light.
export function auraStyleForTrack(track: CatalogTrack | TrackInfo | null | undefined): Record<string, string | number> {
  const aura = auraForTrack(track ?? null);
  return {
    '--aura-a': aura.a,
    '--aura-b': aura.b,
    '--aura-accent': aura.accent,
    '--aura-hue': aura.hue
  };
}
