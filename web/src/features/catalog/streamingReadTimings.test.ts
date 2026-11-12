import { expect, it } from 'vitest';
import { createStreamingReadTimings } from './streamingReadTimings';

it('counts overlapping work separately from wall time and returns detached snapshots', async () => {
  let now = 0;
  const timing = createStreamingReadTimings(() => now);
  let resolveA!: (bytes: Uint8Array) => void;
  let resolveB!: (bytes: Uint8Array) => void;
  const a = timing.read(
    () =>
      new Promise<Uint8Array>(resolve => {
        resolveA = resolve;
      }),
    () => ({ gatewayUrl: 'polkadot:bulletin' })
  );
  now = 10;
  const b = timing.read(
    () =>
      new Promise<Uint8Array>(resolve => {
        resolveB = resolve;
      }),
    () => ({ fromCache: true })
  );
  now = 30;
  resolveA(new Uint8Array(12));
  await a;
  const earlier = timing.snapshot();
  now = 40;
  resolveB(new Uint8Array(8));
  await b;
  expect(earlier.objectsRead).toBe(1);
  expect(timing.snapshot()).toMatchObject({ objectsRead: 2, encryptedBytes: 20, readWorkMs: 60, maxReadMs: 30, hostObjects: 1, cachedObjects: 1 });
});

it('includes failed work duration but counts only successfully read/authenticated objects', async () => {
  let now = 0;
  const timing = createStreamingReadTimings(() => now);
  await expect(
    timing.read(
      async () => {
        now = 12;
        throw new Error('private URL');
      },
      () => ({})
    )
  ).rejects.toThrow('private URL');
  await timing.read(
    async () => {
      now = 16;
      return new Uint8Array(32);
    },
    () => ({ gatewayUrl: 'https://private.invalid', gatewayRecovered: true })
  );
  await expect(
    timing.decrypt(async () => {
      now = 19;
      throw new Error('bad tag');
    })
  ).rejects.toThrow('bad tag');
  await timing.decrypt(async () => {
    now = 21;
    return 'clear';
  });
  expect(timing.snapshot()).toMatchObject({ objectsRead: 1, objectsDecrypted: 1, readWorkMs: 16, decryptWorkMs: 5, httpObjects: 1, recoveredObjects: 1 });
  expect(JSON.stringify(timing.snapshot())).not.toMatch(/private|clear/);
});
