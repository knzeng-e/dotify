import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loopbackUrl } from './boundary.mjs';
test('load generators cannot target hosted services or credential-bearing URLs', () => {
  for (const url of [
    'https://dotify-signal.fly.dev',
    'redis://localhost:6379',
    'ws://127.0.0.1.attacker.invalid',
    'redis://secret@127.0.0.1',
    'http://127.0.0.1?token=secret'
  ])
    assert.throws(() => loopbackUrl(url));
  assert.equal(loopbackUrl('http://127.0.0.1:1234').hostname, '127.0.0.1');
});
