import { expect, it } from 'vitest';
import { parseListeningCheckpoint } from './listeningCheckpoint';
const value = { version: 1, scope: 'anonymous:devnet', trackId: 'runtime:release', hash: `0x${'a'.repeat(64)}`, position: 12, queue: ['next'], savedAt: 10000 };
it('keeps only bounded local playback facts, never a key or source URL', () => {
  expect(parseListeningCheckpoint(JSON.stringify({ ...value, contentKey: 'secret', url: 'blob:private' }), 10000)).toEqual(value);
});
it('rejects stale, corrupt, oversized, draft and impossible checkpoints', () => {
  for (const changed of [{ savedAt: 10001 }, { position: NaN }, { position: -1 }, { trackId: 'draft-upload' }, { queue: Array(25).fill('x') }, { version: 2 }])
    expect(parseListeningCheckpoint(JSON.stringify({ ...value, ...changed }), 10000)).toBeNull();
  expect(parseListeningCheckpoint(JSON.stringify(value), 8 * 86400_000)).toBeNull();
  expect(parseListeningCheckpoint('{')).toBeNull();
});
