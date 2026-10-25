import type { ContentKeyReleaseIdentity, ContentKeyResponse, KeyRequestPurpose } from './keyService';

export type PreparedTrack = { contentHash: `0x${string}`; release: ContentKeyReleaseIdentity };
export function preparedTrackKey(track: PreparedTrack, purpose: KeyRequestPurpose): string {
  const r = track.release;
  return JSON.stringify([
    purpose,
    track.contentHash.toLowerCase(),
    r.releaseId.toLowerCase(),
    r.runtimeAddress.toLowerCase(),
    r.artistAddress.toLowerCase(),
    r.audioRef,
    r.keyVersion
  ]);
}

/** Page memory only, bounded and short-lived. Epochs prevent late replies from
 * restoring a grant after cancellation, sign-out, identity or chain changes. */
export function createPreparedKeys(now = Date.now) {
  let scope: string | null = null;
  let epoch = 0;
  const grants = new Map<string, { response: Extract<ContentKeyResponse, { access: 'allowed' }>; until: number }>();
  function clear() {
    grants.clear();
    scope = null;
    epoch++;
  }
  return {
    clear,
    bind(next: string) {
      if (scope !== next) {
        clear();
        scope = next;
      }
      return epoch;
    },
    current: (candidate: string, generation: number) => scope === candidate && epoch === generation,
    read(candidate: string, track: PreparedTrack, purpose: KeyRequestPurpose, minimumRemainingMs = 0) {
      if (candidate !== scope) return null;
      const key = preparedTrackKey(track, purpose);
      const grant = grants.get(key);
      if (!grant || grant.until <= now()) {
        grants.delete(key);
        return null;
      }
      if (grant.until - now() <= minimumRemainingMs) return null;
      return grant.response;
    },
    store(candidate: string, generation: number, track: PreparedTrack, purpose: KeyRequestPurpose, response: ContentKeyResponse, until: number) {
      if (scope !== candidate || epoch !== generation || response.access !== 'allowed' || until <= now()) return;
      const key = preparedTrackKey(track, purpose);
      grants.delete(key);
      grants.set(key, { response, until: Math.min(until, now() + 30_000) });
      while (grants.size > 5) grants.delete(grants.keys().next().value!);
    }
  };
}
