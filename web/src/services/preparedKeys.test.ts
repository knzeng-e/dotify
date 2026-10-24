import { expect, it } from 'vitest';
import { createPreparedKeys } from './preparedKeys';
const track = {
  contentHash: `0x${'ab'.repeat(32)}` as const,
  release: {
    releaseId: 'release-a',
    runtimeAddress: `0x${'12'.repeat(20)}` as const,
    artistAddress: `0x${'34'.repeat(20)}` as const,
    audioRef: 'dotify:enc:v3:key-v2:ipfs://cid',
    keyVersion: 'dotify-content-key-v2' as const
  }
};
const response = {
  access: 'allowed' as const,
  playbackMode: 'full' as const,
  contentKey: `0x${'56'.repeat(32)}` as const,
  runtime: track.release.runtimeAddress
};
it('expires a prepared key without sliding its lifetime on read', () => {
  let now = 100;
  const keys = createPreparedKeys(() => now);
  const generation = keys.bind('account:chain:token');
  keys.store('account:chain:token', generation, track, 'individual', response, 30_100);
  now = 30_099;
  expect(keys.read('account:chain:token', track, 'individual')).toEqual(response);
  expect(keys.read('account:chain:token', track, 'room_host')).toBeNull();
  expect(keys.read('account:chain:token', { ...track, release: { ...track.release, audioRef: 'another-object' } }, 'individual')).toBeNull();
  now++;
  expect(keys.read('account:chain:token', track, 'individual')).toBeNull();
});
it('cannot restore a cleared account, chain or token with a late reply', () => {
  const keys = createPreparedKeys(() => 100);
  for (const scope of ['account:chain-a:token', 'account-b:chain-a:token', 'account-b:chain-b:token-2']) {
    const generation = keys.bind(scope);
    keys.clear();
    keys.bind(scope);
    keys.store(scope, generation, track, 'individual', response, 1000);
    expect(keys.read(scope, track, 'individual')).toBeNull();
  }
});

it('never reuses equal content hashes from a different artist runtime', () => {
  const keys = createPreparedKeys(() => 100);
  const generation = keys.bind('session');
  keys.store('session', generation, track, 'individual', response, 1000);
  const otherRuntime = `0x${'78'.repeat(20)}` as const;
  expect(
    keys.read(
      'session',
      { ...track, release: { ...track.release, runtimeAddress: otherRuntime, releaseId: `${otherRuntime}:${track.contentHash}` } },
      'individual'
    )
  ).toBeNull();
  expect(keys.read('session', track, 'individual')).toEqual(response);
});
