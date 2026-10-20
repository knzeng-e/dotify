import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../config.js';
import { pinFilesToPinata } from './pinata.js';

test('directory transport retains cover paths below Pinata’s returned folder root', async t => {
  const previous = config.PINATA_JWT;
  config.PINATA_JWT = 'test-only-not-a-credential';
  t.after(() => {
    config.PINATA_JWT = previous;
  });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    calls++;
    // Serialize the actual multipart body: the provider consumes the common
    // outer directory. The remaining names must equal our published paths.
    const body = await new Request('https://upload.test', { method: 'POST', body: init.body }).text();
    const names = [...body.matchAll(/filename="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(
      names.map(name => name.split('/').slice(1).join('/')),
      ['cover/640.webp', 'cover/160.webp']
    );
    return Response.json({ IpfsHash: 'test-directory' });
  });
  assert.equal(
    await pinFilesToPinata(
      [
        { path: 'cover/640.webp', bytes: new Uint8Array([1]), mime: 'image/webp' },
        { path: 'cover/160.webp', bytes: new Uint8Array([2]), mime: 'image/webp' }
      ],
      'cover'
    ),
    'test-directory'
  );
  await assert.rejects(pinFilesToPinata([{ path: '../640.webp', bytes: new Uint8Array() }], 'bad'), /Invalid relative/);
  assert.equal(calls, 1);
});
