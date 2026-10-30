import test from 'node:test';
import assert from 'node:assert/strict';
import { admitRequest, fixturePayload } from './host-server.mjs';
import { addressingFixture } from './addressing.mjs';
import { prepare } from './canary.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('local server refuses foreign origins, DNS rebinding, cross-site and writes', () => {
  const request = { method: 'GET', headers: { host: 'localhost:5278', origin: 'http://localhost:5278' } };
  assert.ok(admitRequest(request));
  assert.ok(admitRequest({ method: 'HEAD', headers: { host: '127.0.0.1:5278' } }));
  for (const bad of [
    { ...request, method: 'POST' },
    { ...request, headers: { ...request.headers, host: 'attacker.example:5278' } },
    { ...request, headers: { ...request.headers, origin: 'https://attacker.example' } },
    { ...request, headers: { ...request.headers, 'sec-fetch-site': 'cross-site' } }
  ])
    assert.equal(admitRequest(bad), false);
});

test('Host harness refuses the earlier non-AAC fixture', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-host-input-'));
  try {
    const dir = join(parent, 'old');
    await prepare(dir);
    await assert.rejects(fixturePayload(dir), /generated AAC canary/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('public marker session contains only proof metadata and never an audio key', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-marker-host-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const dir = join(parent, 'marker');
  await prepare(dir, addressingFixture);
  const payload = await fixturePayload(dir);
  assert.equal(payload.session, undefined);
  assert.equal(payload.addressingSession.schema, 'dotify.bulletin.addressing.v1');
  assert.equal(payload.blocks.size, 3);
  assert.ok(!JSON.stringify(payload.addressingSession).includes('"key"'));
});
