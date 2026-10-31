// Local generated-only custody package. No provider, signer or environment keys.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, mkdir, readdir, lstat, access } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { blake2b } from '@noble/hashes/blake2.js';
import { generatedWav } from './generated-source.mjs';
import { GENESIS } from './graph.mjs';
import { CANARY_ACCOUNT, ENDPOINT } from './live-transport.mjs';
import { encodeStreamingRelease } from '../../services/api/src/services/streamingEncoder.ts';
import { deriveContentKeyBytes } from '../../services/api/src/services/keyVault.ts';
import { initializeStreamingNonceLedger, StreamingNonceLedger, streamingKeyFingerprint } from '../../services/api/src/services/streamingNonces.ts';
import {
  parseStreamingManifest,
  verifyStreamingManifest,
  decryptStreamingObject,
  streamingCanonicalJson
} from '../../services/api/src/services/streamingFormat.ts';
import { buildBulletinMediaGraph } from '../../services/api/src/services/bulletinGraph.ts';
import { initializeBulletinMediaStore } from '../../services/api/src/services/bulletinMedia.ts';
import { privateDirectory, sync, ownerSchema, jobSchema } from '../../services/api/src/services/bulletinMediaState.ts';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Buffer.from(streamingCanonicalJson(value));
export const IDENTITY = Object.freeze({ genesis: GENESIS, account: CANARY_ACCOUNT });
// Conservative byte floor, not a measured inventory: preserve the previous
// 91 lab renewal slots and 20 MiB of renewable bytes until separately reviewed.
export const PRIOR_RESERVE = Object.freeze({ transactions: 91, bytes: 20 * 1024 * 1024 });
const MAX_PACKAGE_BYTES = 4 * 1024 * 1024;
const scopeFor = master => ({
  chainId: 420420417,
  runtimeAddress: `0x${'11'.repeat(20)}`, // generated model identity, never a live runtime
  contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
  keyVersion: 'dotify-content-key-v2'
});
export async function privateBytes(path, max = MAX_PACKAGE_BYTES) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await handle.stat();
    assert.ok(
      st.isFile() && st.nlink === 1 && st.uid === process.getuid() && !(st.mode & 0o077) && st.size > 0 && st.size <= max,
      'Unsafe or oversized private package file'
    );
    const bytes = Buffer.alloc(st.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    assert.equal(length, st.size, 'Package file changed while reading');
    return bytes.subarray(0, length);
  } finally {
    await handle.close();
  }
}
export async function writeNew(path, bytes) {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}
async function absent(path) {
  try {
    await lstat(path);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  throw new Error('Backup is inspection-only; never publish from a restored snapshot');
}
async function nonceSnapshot(directory) {
  const result = {};
  async function visit(dir, prefix = '') {
    await privateDirectory(dir);
    const entries = await readdir(dir, { withFileTypes: true });
    assert.ok(entries.length <= 8, 'Unexpected canary nonce ledger size');
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix + e.name;
      if (e.isDirectory() && !prefix && /^[0-9a-f]{64}$/.test(e.name)) await visit(join(dir, e.name), `${path}/`);
      else {
        assert.ok(e.isFile() && (/^[0-9a-f]{64}\/[0-9a-f]{16}\.json$/.test(path) || path === 'ledger.json'), 'Unexpected nonce custody entry');
        result[path] = hash(await privateBytes(join(dir, e.name), 1024));
      }
    }
  }
  await visit(directory);
  return result;
}
function vault(secret) {
  return { contentKeyMasterSecret: secret.toString('hex'), contentKeyMasterSecrets: '', contentKeyActiveVersion: 'dotify-content-key-v2', chainId: 420420417 };
}
function describe(graph) {
  return {
    root: graph.root,
    bytes: graph.bytes,
    blocks: graph.blocks.map(b => ({ cid: b.cid, bytes: b.bytes.length })),
    scope: graph.scope,
    generation: graph.generation
  };
}
function planFor({ graph, bundleHash, nonceHash, implementation, job }) {
  const n = graph.blocks.length;
  assert.ok(n <= 32 && graph.bytes <= 2 * 1024 * 1024, 'Fixed short canary ceiling exceeded');
  assert.match(implementation, /^[0-9a-f]{40}$/);
  return {
    schema: 'dotify.bulletin.protected-plan.v1',
    implementation,
    identity: IDENTITY,
    endpoint: ENDPOINT,
    job,
    fixture: { kind: 'generated-protected-chord', durationSeconds: 8, runtimeRegistration: false, publicKey: false },
    ...describe(graph),
    bundleSha256: bundleHash,
    nonceLedgerSha256: nonceHash,
    send: { maxStores: n, maxBytes: graph.bytes },
    reserve: { transactions: n, bytes: graph.bytes },
    priorReserve: PRIOR_RESERVE,
    budget: { maxBytes: graph.bytes, maxTransactions: 2 * n, minimumLifetimeBlocks: 100 },
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    renewalsSubmitted: false,
    dotnsChanges: false,
    productionProviderSelected: false
  };
}
export function reviewText(plan) {
  return `# Generated protected Bulletin canary\n\nApproval digest: ${hash(canonical(plan))}\n\n- Account: ${plan.identity.account}\n- Network: Bulletin DevNet (${plan.identity.genesis})\n- Root: ${plan.root}\n- Maximum new stores: ${plan.send.maxStores}\n- Maximum uploaded bytes: ${plan.send.maxBytes}\n- New renewal reserve: ${plan.reserve.transactions} transactions / ${plan.reserve.bytes} bytes (not submitted)\n- Previous reserve kept: ${plan.priorReserve.transactions} transactions / ${plan.priorReserve.bytes} renewable bytes (conservative floor)\n\nOnly an eight-second generated chord, encrypted with a private derived key. No artist audio, public key distribution, runtime registration, DotNS update or production switch. Approval is still required; this digest is a binding, not permission.\n\nPreserve this entire private directory and a quiescent backup, including the secret, encrypted bundle, permanent nonce ledger and current publication journals. Never restore an old nonce cursor over newer or uncertain submissions. See docs/operations/bulletin-protected-canary.md.\n`;
}
export async function prepareProtected(directory, { implementation }) {
  await mkdir(directory, { mode: 0o700 }); // deliberate refusal to replace custody
  await privateDirectory(directory);
  const secret = randomBytes(32),
    master = generatedWav(8),
    scope = scopeFor(master);
  const config = vault(secret),
    key = deriveContentKeyBytes(scope, config);
  try {
    await writeNew(join(directory, 'custody-secret.bin'), secret);
    await initializeStreamingNonceLedger(join(directory, 'nonces'));
    const result = await encodeStreamingRelease({ master, key, scope, ledger: new StreamingNonceLedger(join(directory, 'nonces')) });
    const files = result.files.map(({ name, bytes }) => ({ path: name, bytes }));
    const bundle = canonical(files.map(f => ({ path: f.path, base64: f.bytes.toString('base64') })));
    assert.ok(bundle.length <= MAX_PACKAGE_BYTES, 'Protected bundle exceeds local limit');
    await writeNew(join(directory, 'bundle.json'), bundle);
    const graph = await buildBulletinMediaGraph(files, new AbortController().signal);
    const plan = planFor({
      graph,
      bundleHash: hash(bundle),
      nonceHash: hash(canonical(await nonceSnapshot(join(directory, 'nonces')))),
      implementation,
      job: `stream-${randomUUID()}`
    });
    await initializeBulletinMediaStore(join(directory, 'publications'), IDENTITY);
    await writeNew(join(directory, 'plan.json'), canonical(plan));
    await writeNew(join(directory, 'REVIEW.md'), reviewText(plan));
    await sync(directory);
    await sync(join(directory, '..'));
    return { digest: hash(canonical(plan)), plan };
  } finally {
    secret.fill(0);
    master.fill(0);
    key?.fill(0);
    config.contentKeyMasterSecret = '';
  }
}
export async function loadProtected(directory, { allowBackup = false } = {}) {
  await privateDirectory(directory);
  if (!allowBackup) await absent(join(directory, 'BACKUP_ONLY'));
  const planBytes = await privateBytes(join(directory, 'plan.json'), 64 * 1024);
  const plan = JSON.parse(planBytes);
  const bytes = await privateBytes(join(directory, 'bundle.json'));
  assert.equal(hash(bytes), plan.bundleSha256, 'Encrypted package changed');
  const raw = JSON.parse(bytes);
  assert.ok(Array.isArray(raw) && raw.length <= 32, 'Invalid short canary files');
  const files = raw.map(f => {
    assert.deepEqual(Object.keys(f).sort(), ['base64', 'path']);
    assert.equal(typeof f.base64, 'string');
    const bytes = Buffer.from(f.base64, 'base64');
    assert.equal(bytes.toString('base64'), f.base64, 'Noncanonical bundle encoding');
    return { path: f.path, bytes };
  });
  const graph = await buildBulletinMediaGraph(files, new AbortController().signal);
  assert.match(plan.job, /^stream-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const nonceFiles = await nonceSnapshot(join(directory, 'nonces'));
  const expected = planFor({ graph, bundleHash: hash(bytes), nonceHash: hash(canonical(nonceFiles)), implementation: plan.implementation, job: plan.job });
  assert.deepEqual(plan, expected, 'Plan, identity, budget or nonce custody changed');
  assert.ok(planBytes.equals(canonical(plan)), 'Plan must use canonical encoding');
  const secret = await privateBytes(join(directory, 'custody-secret.bin'), 32);
  assert.equal(secret.length, 32, 'Custody secret must be exactly 32 bytes');
  const config = vault(secret),
    key = deriveContentKeyBytes(graph.scope, config),
    source = generatedWav(8);
  try {
    assert.deepEqual(graph.scope, scopeFor(source), 'Only the fixed generated source is allowed');
    const fingerprint = streamingKeyFingerprint(key);
    assert.equal(Object.keys(nonceFiles).length, 2, 'Keep the complete original nonce custody');
    assert.ok(nonceFiles[`${fingerprint}/${graph.generation}.json`], 'Encryption reservation missing');
    const manifest = parseStreamingManifest(files.find(f => f.path === 'manifest.json').bytes);
    verifyStreamingManifest(manifest, key, graph.scope);
    for (const object of [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])]) {
      const plain = decryptStreamingObject(files.find(f => f.path === object.path).bytes, key, manifest, object);
      try {
        if (object.kind === 'master') assert.ok(plain.equals(source), 'Artist data is forbidden in this canary');
      } finally {
        plain.fill(0);
      }
    }
  } finally {
    secret.fill(0);
    key?.fill(0);
    source.fill(0);
    config.contentKeyMasterSecret = '';
  }
  await privateDirectory(join(directory, 'publications'));
  // This is existence validation, not permission to reset/recreate state.
  await access(join(directory, 'publications', 'owner.json'));
  return { plan, files, graph, digest: hash(planBytes) };
}

// Coherent, private inspection copy. It intentionally cannot serve as a writer
// package: rollback of mutable account nonces requires independent recovery.
export async function snapshotChecksums(directory) {
  const checksums = {};
  async function visit(dir, prefix = '') {
    await privateDirectory(dir);
    const entries = await readdir(dir, { withFileTypes: true });
    assert.ok(entries.length <= 32 && prefix.split('/').length <= 4, 'Unexpected snapshot tree');
    for (const e of entries) {
      if (!prefix && ['operator.lock', 'BACKUP_ONLY', 'SNAPSHOT.json'].includes(e.name)) continue;
      assert.match(e.name, /^[a-zA-Z0-9.-]{1,100}$/);
      const path = prefix + e.name;
      if (e.isDirectory()) await visit(join(dir, e.name), `${path}/`);
      else {
        assert.ok(Object.keys(checksums).length < 32, 'Snapshot inventory limit exceeded');
        checksums[path] = hash(await privateBytes(join(dir, e.name)));
      }
    }
  }
  await visit(directory);
  return checksums;
}
export async function backupProtected(directory, destination) {
  const loaded = await loadProtected(directory);
  const publications = join(directory, 'publications');
  const owner = ownerSchema.parse(JSON.parse(await privateBytes(join(publications, 'owner.json'), 2 * 1024 * 1024)));
  assert.equal(owner.account, IDENTITY.account);
  assert.equal(owner.genesis, IDENTITY.genesis);
  assert.equal(owner.activeJob, null, 'Cannot back up an unresolved publication');
  await absent(join(publications, 'writer.lock'));
  for (const job of owner.jobs) {
    assert.equal(job, loaded.plan.job, 'Unexpected publication ownership');
    const inventory = jobSchema.parse(JSON.parse(await privateBytes(join(publications, `${job}.json`), 2 * 1024 * 1024)));
    assert.equal(inventory.job, job);
    assert.equal(Object.keys(inventory.pending).length, 0, 'Cannot back up pending broadcasts');
  }
  const relation = relative(resolve(directory), resolve(destination));
  assert.ok(
    relation && (relation === '..' || relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relation)),
    'Backup must be outside the live package'
  );
  await mkdir(destination, { mode: 0o700 });
  // Burn the writer capability before copying the first custody byte. Even an
  // interrupted copy must be refused as a live operator directory.
  await writeNew(join(destination, 'BACKUP_ONLY'), 'Inspection-only custody snapshot; never a writer directory.');
  await sync(destination);
  const checksums = await snapshotChecksums(directory);
  async function copy(from, to, prefix = '') {
    await privateDirectory(from);
    for (const e of await readdir(from, { withFileTypes: true })) {
      if (!prefix && e.name === 'operator.lock') continue; // held by caller
      const relative = prefix + e.name;
      if (e.isDirectory()) {
        await mkdir(join(to, e.name), { mode: 0o700 });
        await copy(join(from, e.name), join(to, e.name), `${relative}/`);
      } else {
        const bytes = await privateBytes(join(from, e.name));
        await writeNew(join(to, e.name), bytes);
        assert.equal(hash(bytes), checksums[relative], 'Custody changed during snapshot');
      }
    }
    await sync(to);
  }
  await copy(directory, destination);
  await writeNew(join(destination, 'SNAPSHOT.json'), canonical({ schema: 'dotify.bulletin.custody-snapshot.v1', digest: loaded.digest, checksums }));
  await sync(destination);
  await sync(join(destination, '..'));
  return { digest: loaded.digest, files: Object.keys(checksums).length, writable: false };
}
