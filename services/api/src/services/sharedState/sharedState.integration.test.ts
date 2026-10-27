import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile, fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import Fastify from 'fastify';
import { privateKeyToAccount } from 'viem/accounts';
import { PostgresState, SharedStateUnavailableError } from './postgres.js';
import { initializeSharedNamespace } from './migration.js';
import { PostgresNonces } from './nonces.js';
import { PostgresSessions } from './sessions.js';
import { PostgresUploadAuthorizations } from './uploads.js';
import { PostgresCatalogSnapshotStore } from './catalog.js';
import { custodyTokenMatches, validateCustodyOrigin } from './custodyProxy.js';
import { createSessionTokenService, SESSION_TTL_MS, SESSION_MAX_AGE_MS } from '../sessionTokens.js';
import type { CatalogSnapshot } from '../catalog/types.js';
import { CatalogReadModel } from '../catalog/readModel.js';

const url = process.env.TEST_DATABASE_URL;
if (url && (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith('/dotify_w36_test')))
  throw new Error('Use a loopback database named dotify_w36_test; the outage rehearsal changes its schema.');
if (!url) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database; these tests never substitute an in-memory store.');
const namespace = `test_${randomUUID().replaceAll('-', '')}`;
const a = new PostgresState(namespace, url),
  b = new PostgresState(namespace, url);
const identity = { version: 1 as const, chainId: 420420417, directory: `0x${'11'.repeat(20)}`, sessionEpoch: 'w36-test-epoch-stable' };
const secret = 'ab'.repeat(32),
  rotatedSecret = 'cd'.repeat(32),
  custodyToken = 'private-test-only-'.repeat(3);
const signer = privateKeyToAccount(`0x${'12'.repeat(32)}`),
  address = signer.address.toLowerCase() as `0x${string}`;
const snapshot: CatalogSnapshot = {
  schemaVersion: 1,
  chainId: identity.chainId,
  directoryAddress: identity.directory,
  lastIndexedBlock: 10,
  lastIndexedBlockHash: `0x${'33'.repeat(32)}`,
  chainHeadBlock: 12,
  indexedAt: new Date().toISOString(),
  reconciledAt: new Date().toISOString(),
  artists: [],
  releases: []
};
const children: ChildProcess[] = [];
const tokens = (key = secret, previous?: string) =>
  createSessionTokenService({ epoch: identity.sessionEpoch, masterSecret: () => key, previousSecret: () => previous });
const post = (origin: string, path: string, body: unknown) =>
  fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function api(role: 'edge' | 'custody', custodyOrigin = 'http://127.0.0.1:1'): Promise<{ origin: string; stop: () => Promise<void> }> {
  const child = fork(new URL('./api.fixture.ts', import.meta.url), [], {
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      STATE_STORE: 'postgres',
      STATE_NAMESPACE: namespace,
      DATABASE_URL: url!,
      API_ROLE: role,
      CUSTODY_SERVICE_URL: custodyOrigin,
      CUSTODY_SERVICE_TOKEN: custodyToken,
      SESSION_SECRET: secret,
      SESSION_EPOCH: identity.sessionEpoch,
      DOTIFY_DIRECTORY_ADDRESS: identity.directory,
      DOTIFY_CHAIN_ID: String(identity.chainId),
      PASEO_ASSET_HUB_RPC: undefined,
      STREAMING_WORKER_URL: undefined,
      STREAMING_WORKER_TOKEN: undefined
    }
  });
  children.push(child);
  let errors = '';
  child.stderr?.on('data', chunk => {
    errors = (errors + String(chunk)).slice(-4096);
  });
  const message = await Promise.race([
    once(child, 'message'),
    once(child, 'exit').then(() => {
      throw new Error(`API fixture exited before ready: ${errors}`);
    }),
    new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => reject(new Error('API fixture start timed out')), 15_000);
      timeout.unref();
    })
  ]);
  const origin = (message[0] as { origin: string }).origin;
  return {
    origin,
    stop: async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.send('close');
        await once(child, 'exit');
      }
    }
  };
}
async function signIn(origin: string) {
  const challenge = (await (await post(origin, '/api/auth/nonce', { address, chainId: identity.chainId })).json()) as { nonce: string; expiresAt: string };
  const message = [
    'Dotify sign-in',
    'App: Dotify',
    'Action: SIGN_IN',
    `Requester: ${address}`,
    `Chain ID: ${identity.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Expires At: ${challenge.expiresAt}`
  ].join('\n');
  return { address, chainId: identity.chainId, ...challenge, signature: await signer.signMessage({ message }) };
}
before(async () => {
  await a.pool.query(await readFile(new URL('../../../migrations/001-shared-state.sql', import.meta.url), 'utf8'));
  await a.transaction(client =>
    initializeSharedNamespace(client, namespace, identity, { revocations: { epoch: identity.sessionEpoch, revoked: [] }, catalog: snapshot })
  );
});
after(async () => {
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  await a.pool.query('DELETE FROM dotify_state_documents WHERE namespace=$1', [namespace]);
  await a.pool.query('DELETE FROM dotify_state_nonces WHERE namespace=$1', [namespace]);
  await a.pool.query('DELETE FROM dotify_state_revocations WHERE namespace=$1', [namespace]);
  await a.pool.query('DELETE FROM dotify_state_identity WHERE namespace=$1', [namespace]);
  await Promise.all([a.close(), b.close()]);
});

describe('W36 real PostgreSQL / independent API processes', () => {
  it('imports identity and refuses a mismatched deployment or destructive reinitialization', async () => {
    await a.assertIdentity(identity);
    await assert.rejects(() => b.assertIdentity({ ...identity, sessionEpoch: 'wrong' }), SharedStateUnavailableError);
    await assert.rejects(() => a.transaction(client => initializeSharedNamespace(client, namespace, identity)), SharedStateUnavailableError);
    await a.assertIdentity(identity);
  });
  it('consumes a nonce exactly once across two connections, without burning it for the wrong owner', async () => {
    const x = new PostgresNonces(a),
      y = new PostgresNonces(b);
    const nonce = await x.issue(address, identity.chainId);
    assert.equal((await y.consume(nonce.nonce, identity.directory, identity.chainId)).ok, false);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? x : y).consume(nonce.nonce, address, identity.chainId)));
    assert.equal(results.filter(result => result.ok).length, 1);
    await a.pool.query('UPDATE dotify_state_nonces SET expires_at=0 WHERE namespace=$1 AND nonce=$2', [namespace, nonce.nonce]);
    assert.equal((await y.consume(nonce.nonce, address, identity.chainId)).ok, false);
  });
  it('checks nonce expiry after waiting for a competing transaction', async () => {
    const issued = await new PostgresNonces(a).issue(address, identity.chainId);
    const holder = await a.pool.connect();
    let committed = false;
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await holder.query('SELECT nonce FROM dotify_state_nonces WHERE namespace=$1 AND nonce=$2 FOR UPDATE', [namespace, issued.nonce]);
      const pending = new PostgresNonces(b).consume(issued.nonce, address, identity.chainId);
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const waiting = await a.pool.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid]);
        if (waiting.rowCount) {
          blocked = true;
          break;
        }
      }
      assert.ok(blocked, 'The contender must wait for the row lock');
      await holder.query('UPDATE dotify_state_nonces SET expires_at=floor(extract(epoch FROM clock_timestamp())*1000) WHERE namespace=$1 AND nonce=$2', [
        namespace,
        issued.nonce
      ]);
      await holder.query('COMMIT');
      committed = true;
      const result = await pending;
      assert.ok(!result.ok && result.code === 'NONCE_EXPIRED');
    } finally {
      if (!committed) await holder.query('ROLLBACK');
      holder.release();
    }
  });

  it('preserves quota and one-use capabilities across replicas and a restarted service', async () => {
    const options = {
      epoch: identity.sessionEpoch,
      masterSecret: () => secret,
      principalByteLimit: 100,
      globalByteLimit: 150,
      principalConcurrencyLimit: 2,
      globalConcurrencyLimit: 2
    };
    const x = new PostgresUploadAuthorizations(a, options),
      y = new PostgresUploadAuthorizations(b, options);
    const input = { address, runtimeAddress: identity.directory as `0x${string}`, chainId: identity.chainId, purpose: 'cover' as const, maxBytes: 60 };
    const results = await Promise.all([x.issue(input), y.issue(input)]);
    assert.equal(results.filter(value => value.ok).length, 1);
    const issued = results.find(value => value.ok)!;
    assert.ok(issued.ok);
    const begun = await Promise.all([x.begin(issued.token, 'cover'), y.begin(issued.token, 'cover')]);
    assert.equal(begun.filter(value => value.ok).length, 1);
    const lease = begun.find(value => value.ok)!;
    assert.ok(lease.ok);
    assert.equal(await lease.lease.complete(55), true);
    const restarted = new PostgresUploadAuthorizations(b, options);
    assert.equal((await restarted.issue({ ...input, maxBytes: 46 })).ok, false);
    assert.equal((await restarted.begin(issued.token, 'cover')).ok, false);
    // A crashed lease expires conservatively, charging its entire byte budget.
    await a.pool.query('UPDATE dotify_state_documents SET value=$3 WHERE namespace=$1 AND name=$2', [
      namespace,
      'uploads-v1',
      JSON.stringify({ reservations: [], usage: [] })
    ]);
    const crash = await x.issue(input);
    assert.ok(crash.ok);
    assert.ok((await y.begin(crash.token, 'cover')).ok);
    await a.document<any, void>(
      'uploads-v1',
      () => ({}),
      state => {
        state.reservations[0][1].leaseUntil = 0;
      }
    );
    assert.equal((await restarted.issue({ ...input, maxBytes: 41 })).ok, false);
    const saved = await a.pool.query('SELECT value FROM dotify_state_documents WHERE namespace=$1 AND name=$2', [namespace, 'uploads-v1']);
    await a.pool.query('DELETE FROM dotify_state_documents WHERE namespace=$1 AND name=$2', [namespace, 'uploads-v1']);
    await assert.rejects(() => restarted.issue(input), SharedStateUnavailableError);
    await a.pool.query('INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3)', [
      namespace,
      'uploads-v1',
      JSON.stringify({ reservations: [], usage: [{ address, bytes: 'corrupt', expiresAt: Date.now() + 60_000 }] })
    ]);
    await assert.rejects(() => restarted.issue(input), SharedStateUnavailableError);
    await a.pool.query('UPDATE dotify_state_documents SET value=$3 WHERE namespace=$1 AND name=$2', [
      namespace,
      'uploads-v1',
      JSON.stringify(saved.rows[0].value)
    ]);
  });
  it('rotates an independent session secret and revokes renewed descendants using an expired parent', async () => {
    const x = new PostgresSessions(a, tokens()),
      y = new PostgresSessions(b, tokens(rotatedSecret, secret));
    const issued = await x.issue(address, identity.chainId);
    assert.ok(issued.ok);
    assert.equal((await y.verify(issued.token)).valid, true);
    const renewed = await y.renew(issued.token);
    assert.ok('ok' in renewed && renewed.ok);
    assert.equal((await new PostgresSessions(a, tokens(rotatedSecret)).verify(renewed.token)).valid, true);
    assert.equal((await new PostgresSessions(a, tokens(rotatedSecret)).verify(issued.token)).valid, false);
    // Restored older signer plus overlap is the safe application rollback.
    assert.equal((await new PostgresSessions(a, tokens(secret, rotatedSecret)).verify(renewed.token)).valid, true);
    await x.revoke(issued.token);
    assert.equal((await y.verify(renewed.token)).valid, false);
    const now = Date.now(),
      old = tokens().issue(address, identity.chainId, now - SESSION_TTL_MS - 1000);
    assert.ok(old.ok);
    // Same signed family renewed just before parent expiry in a second tab.
    const next = tokens().renew(old.token, now - 2000);
    assert.ok('ok' in next && next.ok);
    assert.equal((await x.verify(old.token)).valid, false);
    assert.equal((await x.verify(next.token)).valid, true);
    assert.equal(await x.revoke(old.token), true);
    assert.equal((await x.verify(next.token)).valid, false);
    // After authentication overlap ends, retained A can verify delayed logout
    // only. It cannot authenticate/renew A tokens or sign new B sessions.
    let overlapping = true;
    const rotating = new PostgresSessions(
      b,
      createSessionTokenService({
        epoch: identity.sessionEpoch,
        masterSecret: () => rotatedSecret,
        previousSecret: () => (overlapping ? secret : undefined),
        previousRevocationSecret: () => secret
      })
    );
    const parent = await x.issue(address, identity.chainId);
    assert.ok(parent.ok);
    const child = await rotating.renew(parent.token);
    assert.ok('ok' in child && child.ok);
    overlapping = false;
    assert.equal((await rotating.verify(parent.token)).valid, false);
    assert.equal((await rotating.verify(child.token)).valid, true);
    assert.equal(await rotating.revoke(parent.token), true);
    assert.equal((await rotating.verify(child.token)).valid, false);
    const ancient = tokens().issue(address, identity.chainId, now - SESSION_MAX_AGE_MS - 1);
    assert.ok(ancient.ok);
    assert.equal(await x.revoke(ancient.token), false);
  });
  it('elects a single catalog writer and hands over after release; readers share one checkpoint', async () => {
    const x = new PostgresCatalogSnapshotStore(a),
      y = new PostgresCatalogSnapshotStore(b);
    const result = await x.asWriter(async () => {
      assert.equal(
        (
          await y.asWriter(async () => {
            throw new Error('A second writer was elected');
          })
        ).elected,
        false
      );
      await x.save(snapshot);
    });
    assert.equal(result.elected, true);
    assert.deepEqual(await y.load(), snapshot);
    assert.equal((await y.asWriter(async () => y.save({ ...snapshot, lastIndexedBlock: 11 }))).elected, true);
    assert.equal((await x.load())?.lastIndexedBlock, 11);
    await assert.rejects(() => x.save(snapshot), /election/);
    // Real reader models observe the stored checkpoint even when election is busy.
    await x.asWriter(async () => {
      const gateway = { identity: { chainId: identity.chainId, directoryAddress: identity.directory as `0x${string}` } } as any;
      const model = new CatalogReadModel({ gateway, store: y, pollIntervalMs: 1000, reconcileIntervalMs: 10_000, staleAfterMs: 60_000, confirmations: 2 });
      assert.equal((await model.sync()).lastIndexedBlock, 11);
    });
  });
  it('commits compact catalog progress without rewriting content; readers reuse arrays and reject stale sidecars', async () => {
    const x = new PostgresCatalogSnapshotStore(a),
      y = new PostgresCatalogSnapshotStore(b);
    await x.asWriter(async () => x.save(snapshot));
    const initial = await y.load();
    const raw = (await a.pool.query("SELECT value FROM dotify_state_documents WHERE namespace=$1 AND name='catalog-v1'", [namespace])).rows[0].value;
    const next = { ...snapshot, lastIndexedBlock: 20, lastIndexedBlockHash: `0x${'44'.repeat(32)}`, chainHeadBlock: 40, catchingUp: true };
    await x.asWriter(async () => {
      await x.load();
      await x.saveProgress(next);
    });
    const loaded = await y.load();
    assert.equal(loaded?.lastIndexedBlock, 20);
    assert.equal(loaded?.catchingUp, true);
    const reader = new CatalogReadModel({
      gateway: { identity: { chainId: identity.chainId, directoryAddress: identity.directory } } as any,
      store: y,
      pollIntervalMs: 1000,
      reconcileIntervalMs: 10000,
      staleAfterMs: 60000,
      confirmations: 2
    });
    await reader.refresh();
    assert.equal(reader.getMetadata().state, 'stale-cache');
    assert.strictEqual(loaded?.releases, initial?.releases);
    assert.strictEqual(loaded?.artists, initial?.artists);
    assert.deepEqual((await a.pool.query("SELECT value FROM dotify_state_documents WHERE namespace=$1 AND name='catalog-v1'", [namespace])).rows[0].value, raw);
    await assert.rejects(() => y.saveProgress(next), /election/);
    // A pre-W37 writer/rollback can replace catalog-v1 without touching sidecar.
    const legacy = { ...snapshot, indexedAt: '2026-10-01T00:00:00.000Z' };
    await a.pool.query("UPDATE dotify_state_documents SET value=$2 WHERE namespace=$1 AND name='catalog-v1'", [namespace, JSON.stringify(legacy)]);
    assert.deepEqual(await y.load(), legacy);
    await x.asWriter(async () => x.save(snapshot));
  });
  it('does not combine an older header with newer arrays when concurrent catalog reads finish out of order', async () => {
    const x = new PostgresCatalogSnapshotStore(a),
      y = new PostgresCatalogSnapshotStore(b);
    await x.asWriter(async () => x.save(snapshot));
    const initial = await y.load();
    const query = b.pool.query.bind(b.pool);
    let release!: () => void,
      ready!: () => void,
      pause = true;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      ready = resolve;
    });
    b.pool.query = (async (...args: any[]) => {
      const delay = pause;
      pause = false;
      const result = await (query as any)(...args);
      if (delay) {
        ready();
        await gate;
      }
      return result;
    }) as any;
    try {
      const oldRead = y.load();
      await started;
      const newer = {
        ...snapshot,
        artists: [
          {
            artistAddress: identity.directory,
            runtimeAddress: identity.directory,
            name: 'New artist',
            releaseCount: 0,
            activeReleaseCount: 0,
            latestReleaseBlock: 0
          }
        ]
      };
      await x.asWriter(async () => x.save(newer));
      const newRead = await y.load();
      assert.equal(newRead?.artists.length, 1);
      release();
      const old = await oldRead;
      assert.strictEqual(old?.artists, initial?.artists);
      assert.equal(old?.artists.length, 0);
      assert.strictEqual((await y.load())?.artists, newRead?.artists);
    } finally {
      release();
      b.pool.query = query as any;
    }
  });
  it('fences a disconnected catalog writer when another connection takes over', async () => {
    const oldStore = new PostgresCatalogSnapshotStore(a),
      replacement = new PostgresCatalogSnapshotStore(b);
    let proceed!: () => void, elected!: () => void;
    const gate = new Promise<void>(resolve => {
      proceed = resolve;
    });
    const ready = new Promise<void>(resolve => {
      elected = resolve;
    });
    const stale = oldStore.asWriter(async () => {
      const loaded = await oldStore.load();
      assert.ok(loaded);
      elected();
      await gate;
      await oldStore.saveProgress({ ...loaded, lastIndexedBlock: 123 });
    });
    const rejected = assert.rejects(() => stale, SharedStateUnavailableError);
    await ready;
    const owner = await b.pool.query(
      "SELECT pid FROM pg_locks WHERE locktype='advisory' AND objid=($1::bigint & 4294967295)::oid AND classid=(($1::bigint >> 32) & 4294967295)::oid",
      [a.lockId('catalog-writer')]
    );
    await b.pool.query('SELECT pg_terminate_backend($1)', [owner.rows[0].pid]);
    // Termination is asynchronous: observe lock cleanup before asserting takeover.
    let released = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const locks = await b.pool.query("SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory'", [owner.rows[0].pid]);
      if (!locks.rowCount) {
        released = true;
        break;
      }
    }
    assert.ok(released, 'The terminated backend must release its advisory locks');

    const takeover = await replacement.asWriter(async () => replacement.save({ ...snapshot, lastIndexedBlock: 12 }));
    assert.equal(takeover.elected, true);
    proceed();
    await rejected;
    assert.equal((await replacement.load())?.lastIndexedBlock, 12);
  });

  it('allows one custody writer and detects loss of its owning database connection', async () => {
    let lost!: () => void;
    const disconnected = new Promise<void>(resolve => {
      lost = resolve;
    });
    const release = await a.holdExclusive('test-custody', lost);
    await assert.rejects(() => b.holdExclusive('test-custody', () => {}), SharedStateUnavailableError);
    const lock = await b.pool.query(
      "SELECT pid FROM pg_locks WHERE locktype='advisory' AND objid=($1::bigint & 4294967295)::oid AND classid=(($1::bigint >> 32) & 4294967295)::oid",
      [a.lockId('test-custody')]
    );
    assert.equal(lock.rowCount, 1);
    await b.pool.query('SELECT pg_terminate_backend($1)', [lock.rows[0].pid]);
    await Promise.race([
      disconnected,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Lost custody lock was not detected')), 5000);
        timer.unref();
      })
    ]);
    await release();
    const takeover = await b.holdExclusive('test-custody', () => {});
    await takeover();
  });

  it('restores a real pg_dump backup without reopening used nonces or revoked sessions', async () => {
    const issued = await new PostgresNonces(a).issue(address, identity.chainId);
    await new PostgresNonces(b).consume(issued.nonce, address, identity.chainId);
    const session = await new PostgresSessions(a, tokens()).issue(address, identity.chainId);
    assert.ok(session.ok);
    await new PostgresSessions(b, tokens()).revoke(session.token);
    const directory = await mkdtemp(join(tmpdir(), 'dotify-w36-backup-'));
    const database = `dotify_w36_test_restore_${randomUUID().replaceAll('-', '')}`;
    const restoredUrl = new URL(url!);
    restoredUrl.pathname = `/${database}`;
    const restored = new PostgresState(namespace, restoredUrl.toString());
    const run = promisify(execFile);
    await a.pool.query(`CREATE DATABASE ${database}`);
    try {
      const file = join(directory, 'backup.dump');
      await run('pg_dump', ['--dbname', url!, '--format=custom', '--no-owner', '--no-acl', '--file', file]);
      await run('pg_restore', ['--dbname', restoredUrl.toString(), '--no-owner', '--no-acl', file]);
      await restored.assertIdentity(identity);
      assert.equal((await new PostgresNonces(restored).consume(issued.nonce, address, identity.chainId)).ok, false);
      assert.equal((await new PostgresSessions(restored, tokens()).verify(session.token)).valid, false);
      assert.deepEqual(await new PostgresCatalogSnapshotStore(restored).load(), await new PostgresCatalogSnapshotStore(a).load());
      // A stale backup can forget both consumption and logout. Epoch rotation
      // alone cannot invalidate wallet-signed nonce challenges (no epoch claim).
      await restored.pool.query('UPDATE dotify_state_nonces SET used=false WHERE namespace=$1', [namespace]);
      await restored.pool.query('DELETE FROM dotify_state_revocations WHERE namespace=$1', [namespace]);
      const recoveredIdentity = { ...identity, sessionEpoch: 'w36-after-stale-restore' };
      await restored.transaction(async client => {
        await client.query('UPDATE dotify_state_identity SET identity=$2 WHERE namespace=$1', [namespace, JSON.stringify(recoveredIdentity)]);
        await client.query('DELETE FROM dotify_state_nonces WHERE namespace=$1', [namespace]);
      });
      await restored.assertIdentity(recoveredIdentity);
      const recoveredSessions = new PostgresSessions(
        restored,
        createSessionTokenService({ epoch: recoveredIdentity.sessionEpoch, masterSecret: () => secret })
      );
      assert.equal((await recoveredSessions.verify(session.token)).valid, false);
      const challenge = await new PostgresNonces(restored).consume(issued.nonce, address, identity.chainId);
      assert.ok(!challenge.ok && challenge.code === 'NONCE_UNKNOWN');
    } finally {
      await restored.close();
      await a.pool.query(`DROP DATABASE ${database}`);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('runs a rolling API restart without sign-out, rejects concurrent replay, and fails closed during a schema outage', async () => {
    const custody = await api('custody');
    const edgeA = await api('edge', custody.origin),
      edgeB = await api('edge', custody.origin);
    const signed = await signIn(edgeA.origin);
    const responses = await Promise.all([post(edgeA.origin, '/api/auth/session', signed), post(edgeB.origin, '/api/auth/session', signed)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 401]);
    const { sessionToken } = (await responses.find(response => response.ok)!.json()) as { sessionToken: string };
    const who = (origin: string) => fetch(`${origin}/api/auth/identity`, { headers: { authorization: `Bearer ${sessionToken}` } });
    assert.equal((await who(edgeB.origin)).status, 200);
    const renewedResponse = await post(edgeB.origin, '/api/auth/renew', { sessionToken });
    assert.equal(renewedResponse.status, 200);
    const renewed = (await renewedResponse.json()) as { sessionToken: string };

    await edgeA.stop();
    const replacement = await api('edge', custody.origin);
    assert.equal((await who(replacement.origin)).status, 200);
    assert.equal((await post(replacement.origin, '/api/auth/logout', { sessionToken })).status, 200);
    assert.equal((await who(edgeB.origin)).status, 401);
    assert.equal((await who(replacement.origin)).status, 401);
    assert.equal((await fetch(`${edgeB.origin}/api/auth/identity`, { headers: { authorization: `Bearer ${renewed.sessionToken}` } })).status, 401);

    // The private service cannot be used to bypass public routing.
    assert.equal((await post(custody.origin, '/api/uploads/authorize', {})).status, 403);
    assert.equal((await post(edgeB.origin, '/api/uploads/authorize', {})).status, 401);
    await a.pool.query('ALTER TABLE dotify_state_identity RENAME TO dotify_state_identity_outage');
    try {
      for (const path of ['/api/auth/nonce', '/api/uploads/authorize', `/api/tracks/0x${'22'.repeat(32)}/free-key`]) {
        const response = await post(edgeB.origin, path, {});
        assert.equal(response.status, 503);
        assert.equal(((await response.json()) as { code: string }).code, 'SHARED_STATE_UNAVAILABLE');
      }
      const browser = await fetch(`${edgeB.origin}/api/auth/nonce`, {
        method: 'POST',
        headers: { origin: 'http://localhost:5273', 'content-type': 'application/json' },
        body: '{}'
      });
      assert.equal(browser.headers.get('access-control-allow-origin'), 'http://localhost:5273');
      assert.equal(browser.status, 503);
      assert.equal((await fetch(`${edgeB.origin}/health`)).status, 200);
    } finally {
      await a.pool.query('ALTER TABLE dotify_state_identity_outage RENAME TO dotify_state_identity');
    }
    assert.equal((await post(edgeB.origin, '/api/auth/nonce', { address })).status, 200);
    await Promise.all([edgeB.stop(), replacement.stop(), custody.stop()]);
  });
  it('shuts down the actual API entrypoint gracefully while owning the custody lock', async () => {
    const probe = Fastify();
    const origin = await probe.listen({ host: '127.0.0.1', port: 0 });
    await probe.close();
    const directory = await mkdtemp(join(tmpdir(), 'dotify-w36-entry-'));
    const child = fork(new URL('../../index.ts', import.meta.url), [], {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        STATE_STORE: 'postgres',
        STATE_NAMESPACE: namespace,
        DATABASE_URL: url!,
        API_ROLE: 'custody',
        API_PORT: new URL(origin).port,
        CUSTODY_SERVICE_TOKEN: custodyToken,
        SESSION_SECRET: secret,
        SESSION_EPOCH: identity.sessionEpoch,
        DOTIFY_DIRECTORY_ADDRESS: identity.directory,
        DOTIFY_CHAIN_ID: String(identity.chainId),
        PASEO_ASSET_HUB_RPC: undefined,
        STREAMING_WORKER_URL: undefined,
        STREAMING_WORKER_TOKEN: undefined,
        NATIVE_CONTRIBUTION_SNAPSHOT_PATH: join(directory, 'receipts.json')
      }
    });
    children.push(child);
    child.stdout?.resume();
    child.stderr?.resume();
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready = (await fetch(`${origin}/health`, { signal: AbortSignal.timeout(200) })).ok;
        } catch {
          /* startup */
        }
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.ok(ready, 'The real entrypoint must start before shutdown');
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      const result = await Promise.race([
        exit,
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Custody shutdown deadlocked on its pool connection')), 3000);
          timer.unref();
        })
      ]);
      assert.equal(result[0], 0);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await once(child, 'exit');
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('streams multipart through two edges to one custody process and returns an actionable failure if it is gone', async () => {
    assert.throws(() => validateCustodyOrigin('https://public.example', true));
    const custody = Fastify();
    custody.addContentTypeParser('*', (_request, payload, done) => done(null, payload));
    let calls = 0;
    custody.post('/api/uploads/audio', async (request, reply) => {
      assert.equal(custodyTokenMatches(request.headers['x-dotify-custody'], custodyToken), true);
      let size = 0;
      for await (const chunk of request.body as AsyncIterable<Buffer>) size += chunk.length;
      calls++;
      return reply.send({ size });
    });
    const origin = await custody.listen({ host: '127.0.0.1', port: 0 });
    const edge = await api('edge', origin);
    try {
      const payload = Buffer.alloc(2 * 1024 * 1024, 1);
      const response = await fetch(`${edge.origin}/api/uploads/audio`, {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=fixture', 'x-dotify-custody': 'spoofed' },
        body: payload
      });
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { size: number }).size, payload.length);
      assert.equal(calls, 1);
      await custody.close();
      for (const [path, contentType, body] of [
        ['/api/uploads/metadata', 'application/json', '{}'],
        ['/api/uploads/audio', 'multipart/form-data; boundary=fixture', 'x']
      ]) {
        const unavailable = await fetch(`${edge.origin}${path}`, { method: 'POST', headers: { 'content-type': contentType }, body });
        assert.equal(unavailable.status, 503);
        assert.equal(((await unavailable.json()) as { code: string }).code, 'CUSTODY_UNAVAILABLE');
      }
    } finally {
      await Promise.all([edge.stop(), custody.close()]);
    }
  });
});
