export type TrackNeighbors = { previousId: string | null; nextId: string | null };

/** One plan drives both speculative preparation and the eventual button action. */
export function planTrackNeighbors(ids: readonly string[], selectedId: string, shuffle: boolean, random = Math.random): TrackNeighbors {
  if (ids.length < 2) return { previousId: null, nextId: null };
  // Preserve the catalog fallback for a local upload or a removed release.
  const index = Math.max(0, ids.indexOf(selectedId));
  const candidates = ids.filter(id => id !== selectedId);
  const sample = shuffle ? Math.max(0, Math.min(0.999999999, random())) : 0;
  return {
    previousId: ids[(index - 1 + ids.length) % ids.length],
    nextId: shuffle ? candidates[Math.floor(sample * candidates.length)] : ids[(index + 1) % ids.length]
  };
}

type ConnectionHint = { saveData?: boolean; effectiveType?: string };

export function allowNeighborPrefetch(online: boolean, visible: boolean, connection?: ConnectionHint): boolean {
  return online && visible && !connection?.saveData && connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
}

/** Give the playing track priority over speculative encrypted range downloads. */
export function hasPlaybackHeadroom(audio: Pick<HTMLAudioElement, 'paused' | 'seeking' | 'readyState' | 'currentTime' | 'duration' | 'buffered'>): boolean {
  if (audio.paused || audio.seeking || audio.readyState < 3 || !Number.isFinite(audio.duration)) return false;
  for (let i = 0; i < audio.buffered.length; i += 1) {
    if (audio.buffered.start(i) <= audio.currentTime && audio.buffered.end(i) >= audio.currentTime) {
      return audio.buffered.end(i) - audio.currentTime >= Math.min(10, Math.max(0, audio.duration - audio.currentTime));
    }
  }
  return false;
}
