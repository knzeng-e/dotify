export const LISTENING_CHECKPOINT_KEY = 'dotify:listening-checkpoint:v1';
export type ListeningCheckpoint = { version: 1; savedAt: number; scope: string; trackId: string; hash: string; position: number; queue: string[] };

export function parseListeningCheckpoint(raw: string | null, now = Date.now()): ListeningCheckpoint | null {
  if (!raw || raw.length > 8192) return null;
  try {
    const value = JSON.parse(raw) as ListeningCheckpoint;
    const id = (text: unknown) => typeof text === 'string' && text.length > 0 && text.length <= 256 && text !== 'draft-upload';
    if (
      value.version !== 1 ||
      typeof value.scope !== 'string' ||
      value.scope.length > 160 ||
      !id(value.trackId) ||
      !/^0x[0-9a-f]{64}$/i.test(value.hash) ||
      !Number.isFinite(value.position) ||
      value.position < 0 ||
      value.position > 900 ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt > 7 * 86400_000 ||
      !Array.isArray(value.queue) ||
      value.queue.length > 24 ||
      !value.queue.every(id)
    )
      return null;
    // Whitelist fields: URLs, keys or arbitrary additions never survive.
    return {
      version: 1,
      savedAt: value.savedAt,
      scope: value.scope,
      trackId: value.trackId,
      hash: value.hash,
      position: value.position,
      queue: [...new Set(value.queue)]
    };
  } catch {
    return null;
  }
}
