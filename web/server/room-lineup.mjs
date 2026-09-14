// The host curates intent, never access or playback. Only these public fields
// cross the room boundary; the server cannot resolve catalog/source material.
const TRACK_KEYS = ['id', 'title', 'artist'];
export function createLineup() {
  return { revision: 0, tracks: [] };
}

export function validLineupMutation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).some(key => !['operationId', 'revision', 'tracks', 'acceptedRequestId'].includes(key))) return false;
  if (typeof value.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(value.operationId)) return false;
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.tracks) || value.tracks.length > 12) return false;
  if (value.acceptedRequestId !== undefined && (typeof value.acceptedRequestId !== 'string' || value.acceptedRequestId.length > 64)) return false;
  const ids = new Set();
  return value.tracks.every(track => {
    if (!track || typeof track !== 'object' || Object.keys(track).length !== 3 || Object.keys(track).some(key => !TRACK_KEYS.includes(key))) return false;
    // Catalog identity is opaque: no URL, manifest or arbitrary payload.
    if (typeof track.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,200}$/.test(track.id) || ids.has(track.id)) return false;
    ids.add(track.id);
    // Reject control characters rather than normalizing identity-bearing edits.
    return ['title', 'artist'].every(
      // eslint-disable-next-line no-control-regex
      key => typeof track[key] === 'string' && track[key].trim().length > 0 && track[key].length <= 120 && !/[\x00-\x1f\x7f]/.test(track[key])
    );
  });
}
