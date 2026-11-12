// Generated-only disk-loss rehearsal. No production backup/import interface.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { CID } from 'multiformats/cid';
import { fixture, owner, signal, tree } from './bulletinPreparedRecovery.fixture.js';
import { recoveryPublisherFixture, type RecoveryChainCheckpoint } from './bulletinRecoveryTransport.fixture.js';
import { publisherProfileSchema } from './bulletinPublisherProfile.js';
import { load, save, receiptSchema } from './bulletinMediaState.js';
import { recoverPreparedBulletinJob } from './bulletinPreparedRecovery.js';
import { deriveContentKeyBytes } from './keyVault.js';
import { parseStreamingReference } from './streamingReference.js';
import { StreamingJobs } from './streamingJobs.js';
import { readBulletinMediaPath } from './bulletinGraph.js';
import { readAuthenticatedCompactObject } from './bulletinCompactReader.js';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from './streamingFormat.js';

const MAX = 4 * 1024 * 1024;
const hex = z
  .string()
  .regex(/^(?:[0-9a-f]{2})+$/)
  .max(MAX * 2);
const checkpointSchema = z
  .object({
    head: z.number().int().min(1000).max(2000),
    nonce: z.number().int().min(10).max(1000),
    stored: z
      .array(
        z
          .object({
            cid: z.string().max(128),
            bytes: z.string().max(MAX * 2),
            receipt: receiptSchema.extend({ account: z.string(), nonce: z.number().int().nonnegative() }).strict()
          })
          .strict()
      )
      .max(128)
  })
  .strict();
const snapshotSchema = z
  .object({
    mode: z.enum(['standard', 'compact']),
    rootName: z.string().regex(/^dotify-prepared-recovery-[a-zA-Z0-9]{6}$/),
    jobId: z.string().uuid(),
    graphRoot: z.string().max(128),
    files: z.record(hex),
    directories: z.array(z.string().max(256)).min(1).max(128),
    chain: checkpointSchema
  })
  .strict();
const bundleSchema = z
  .object({ schema: z.literal('dotify.generated-bulletin-backup.v1'), syntheticOnly: z.literal(true), snapshots: z.array(snapshotSchema).length(2) })
  .strict();
type Snapshot = z.infer<typeof snapshotSchema>;
export const backupDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const restoreFixtureVault = {
  contentKeyMasterSecret: '',
  contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': '43'.repeat(32) }),
  contentKeyActiveVersion: 'dotify-content-key-v3',
  chainId: 420420417
};
const vault = restoreFixtureVault;

async function directories(root: string, prefix = ''): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true }))
    if (entry.isDirectory()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      found.push(path, ...(await directories(root, path)));
    }
  return found.sort();
}
const safePath = (path: string) =>
  /^(profile\.json|(?:queue|publisher)(?:\/[a-zA-Z0-9._-]+)*)$/.test(path) && path.split('/').every(part => part !== '.' && part !== '..' && part.length > 0);
export async function prepareRestoreRehearsal() {
  const cleanup: Array<() => Promise<unknown>> = [];
  const snapshots: Snapshot[] = [];
  try {
    for (const mode of ['standard', 'compact'] as const) {
      const c = await fixture(
        {
          after: callback => {
            cleanup.push(callback as () => Promise<unknown>);
          }
        },
        mode,
        await realpath('/tmp')
      );
      c.loseAck = true;
      await assert.rejects(c.execute((await c.inspect()).planSha256));
      assert.ok(c.writes.length > 0);
      const files = await tree(c.root);
      assert.ok(!Object.keys(files).some(path => path.startsWith('keys/')));
      snapshots.push(
        snapshotSchema.parse({
          mode,
          rootName: basename(c.root),
          jobId: c.options.jobId,
          graphRoot: c.graph.root,
          files,
          directories: await directories(c.root),
          chain: c.checkpoint()
        })
      );
      // Producer discards the only original before the independent restore job.
      await rm(c.root, { recursive: true });
    }
    const bytes = Buffer.from(JSON.stringify(bundleSchema.parse({ schema: 'dotify.generated-bulletin-backup.v1', syntheticOnly: true, snapshots })));
    assert.ok(bytes.length <= MAX);
    return { bytes, sha256: backupDigest(bytes) };
  } finally {
    for (const remove of cleanup) await remove();
  }
}

async function bundleBytes(file: string) {
  assert.ok(isAbsolute(file));
  const fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await fd.stat();
    assert.ok(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= MAX);
    return await fd.readFile();
  } finally {
    await fd.close();
  }
}
export async function readRestoreBundle(file: string, sha256: string) {
  assert.match(sha256, /^[0-9a-f]{64}$/);
  const bytes = await bundleBytes(file);
  assert.equal(backupDigest(bytes), sha256, 'Backup differs from the separately retained producer digest');
  const bundle = bundleSchema.parse(JSON.parse(bytes.toString('utf8')));
  assert.deepEqual(
    bundle.snapshots.map(s => s.mode),
    ['standard', 'compact']
  );
  assert.equal(new Set(bundle.snapshots.map(s => s.rootName)).size, 2);
  for (const snapshot of bundle.snapshots) {
    const paths = Object.keys(snapshot.files);
    assert.ok(paths.length > 0 && paths.length <= 128);
    let total = 0;
    for (const path of paths) {
      assert.ok(safePath(path), 'Unsafe synthetic backup path');
      total += snapshot.files[path].length / 2;
    }
    assert.ok(total <= MAX);
    const dirs = new Set(snapshot.directories);
    assert.equal(dirs.size, snapshot.directories.length);
    for (const dir of dirs) assert.ok(safePath(dir) && dir !== 'profile.json' && !paths.includes(dir), 'Unsafe synthetic backup directory');
    for (const required of ['queue', 'queue/incoming', 'queue/jobs', 'queue/nonces', 'publisher'])
      assert.ok(dirs.has(required), 'Missing required empty directory');
    for (const path of [...paths, ...dirs]) if (dirname(path) !== '.') assert.ok(dirs.has(dirname(path)), 'Missing directory ancestry');
  }
  return bundle;
}

export async function materializeRestoreSnapshot(snapshot: Snapshot) {
  const root = join(await realpath('/tmp'), snapshot.rootName);
  // Refuse an existing destination; never clear another run or live state.
  await mkdir(root, { mode: 0o700 });
  try {
    for (const dir of [...snapshot.directories].sort((a, b) => a.split('/').length - b.split('/').length)) await mkdir(join(root, dir), { mode: 0o700 });
    for (const [path, bytes] of Object.entries(snapshot.files)) {
      const target = join(root, path);
      await writeFile(target, Buffer.from(bytes, 'hex'), { flag: 'wx', mode: 0o600 });
    }
    const profile = publisherProfileSchema.parse(await load(join(root, 'profile.json')));
    assert.equal(profile.directory, join(root, 'publisher'));
    assert.equal(profile.seedFile, join(root, 'keys', 'test.seed'));
    assert.equal(profile.endpoint, 'wss://bulletin.example:8443');
    assert.equal(profile.freshContentKey?.version, vault.contentKeyActiveVersion);
    assert.deepEqual(profile.releasePolicy?.artists, [
      { owner, chainId: vault.chainId, runtimeAddress: `0x${'34'.repeat(20)}`, keyVersion: vault.contentKeyActiveVersion }
    ]);
    const queue = join(root, 'queue');
    const wire = recoveryPublisherFixture(profile, snapshot.chain as RecoveryChainCheckpoint);
    const options = { queue, profileFile: join(root, 'profile.json'), jobId: snapshot.jobId, owner, signal: signal() };
    const deps = {
      contentKeyVault: vault,
      deriveKey: (scope: Parameters<typeof deriveContentKeyBytes>[0]) => deriveContentKeyBytes(scope, vault),
      authority: async () => true,
      publisher: wire.publisher
    };
    return {
      root,
      profile,
      queue,
      wire,
      options,
      deps,
      inspect: () => recoverPreparedBulletinJob(options, deps),
      execute: (executePlan: string) => recoverPreparedBulletinJob({ ...options, executePlan }, deps)
    };
  } catch (error) {
    await rm(root, { recursive: true });
    throw error;
  }
}

export const restoreFixtureReaders = {
  parseStreamingReference,
  readBulletinMediaPath,
  readAuthenticatedCompactObject,
  deriveContentKeyBytes,
  parseStreamingManifest,
  verifyStreamingManifest,
  decryptStreamingObject
};
export async function verifyRestoredAudio(c: Awaited<ReturnType<typeof materializeRestoreSnapshot>>, ref: string, readers = restoreFixtureReaders) {
  const parsed = readers.parseStreamingReference(ref, value => CID.parse(value));
  assert.ok(parsed);
  const read = async (cid: string) => {
    const item = c.wire.stored.get(cid);
    assert.ok(item);
    return item.bytes;
  };
  const bytes = await readers.readBulletinMediaPath(read, parsed.root, 'manifest.json', 256 * 1024, signal());
  const manifest = readers.parseStreamingManifest(bytes);
  const scope = { chainId: manifest.chainId, runtimeAddress: manifest.runtimeAddress, contentHash: manifest.contentHash, keyVersion: manifest.keyVersion };
  const key = readers.deriveContentKeyBytes(scope, vault);
  assert.ok(key);
  try {
    readers.verifyStreamingManifest(manifest, key, scope);
    let objects = 0;
    for (const rendition of manifest.renditions)
      for (const object of [rendition.init, ...rendition.segments]) {
        const encrypted =
          parsed.layout === 'rendition-pack-v1'
            ? await readers.readAuthenticatedCompactObject({
                readBlock: read,
                root: parsed.root,
                manifestBytes: bytes,
                key,
                scope,
                objectPath: object.path,
                maxBytes: object.encryptedLength,
                signal: signal()
              })
            : await readers.readBulletinMediaPath(read, parsed.root, object.path, object.encryptedLength, signal());
        const plain = readers.decryptStreamingObject(encrypted, key, manifest, object);
        if (object.kind === 'init') assert.deepEqual(plain, Buffer.from('structural init'));
        else assert.deepEqual(plain, Buffer.alloc(64, object.index + 1));
        plain.fill(0);
        objects++;
      }
    return objects;
  } finally {
    key.fill(0);
  }
}

export async function restoreRehearsal(file: string, digest: string) {
  const bundle = await readRestoreBundle(file, digest);
  const results = [];
  for (const snapshot of bundle.snapshots) {
    const cases = [
      'coherent',
      'missing-reservation',
      'mixed-ciphertext',
      'missing-admission',
      'mixed-binding',
      'stale-active-cursor',
      'unknown-submission'
    ] as const;
    for (const scenario of cases) {
      const c = await materializeRestoreSnapshot(snapshot);
      try {
        if (scenario === 'missing-reservation') {
          const path = Object.keys(snapshot.files).find(p => /^queue\/nonces\/.+\/.+\.json$/.test(p));
          assert.ok(path);
          await rm(join(c.root, path));
        } else if (scenario === 'mixed-ciphertext') {
          const path = join(c.queue, 'jobs', snapshot.jobId, 'source.bin');
          const bytes = await readFile(path);
          bytes[0] ^= 1;
          await writeFile(path, bytes);
        } else if (scenario === 'missing-admission') await rm(join(c.profile.directory, 'release-admission.json'));
        else if (scenario === 'mixed-binding') await save(c.queue, 'publication-store.json', { schema: 'different-checkpoint' });
        if (['missing-reservation', 'mixed-ciphertext', 'missing-admission', 'mixed-binding'].includes(scenario)) {
          const before = await tree(c.root);
          await assert.rejects(c.inspect());
          assert.deepEqual(await tree(c.root), before);
          assert.equal(c.wire.signerLoads, 0);
        } else {
          if (scenario === 'stale-active-cursor') c.wire.externalNonce = snapshot.chain.nonce + 1;
          if (scenario === 'unknown-submission') c.wire.hideSubmission = true;
          const plan = await c.inspect();
          assert.equal(plan.plan.root, snapshot.graphRoot);
          if (scenario !== 'coherent') {
            await assert.rejects(c.execute(plan.planSha256));
            assert.deepEqual(c.wire.writes, []);
          } else {
            await c.execute(plan.planSha256);
            const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
            const job = index.jobs.find((j: { id: string }) => j.id === snapshot.jobId);
            assert.equal(job.state, 'ready');
            assert.equal(job.attempts, 3);
            const expected = snapshot.mode === 'compact' ? 'rendition-pack-v1' : 'unixfs-files-v1';
            assert.equal(parseStreamingReference(job.ref, value => CID.parse(value))?.layout, expected);
            const after = await tree(c.root);
            for (const [path, value] of Object.entries(snapshot.files))
              if (/^queue\/(nonces|jobs)\//.test(path) || /admission/.test(path))
                assert.equal(after[path], value, 'Restore must preserve ciphertext, reservations and admission lineage');
            const objects = await verifyRestoredAudio(c, job.ref);
            assert.equal(objects, 12);
            const writes = c.wire.writes.length;
            // Compatible restart consumes the committed result, not an encoder or signer.
            const queue = new StreamingJobs({
              directory: c.queue,
              deriveKey: () => {
                throw new Error('no key after ready commit');
              },
              authority: async () => {
                throw new Error('no authority after ready commit');
              },
              transcode: async () => {
                throw new Error('no encoding after restore');
              },
              pin: async () => {
                throw new Error('no publication after ready commit');
              }
            });
            await queue.start(false);
            try {
              assert.equal(queue.get(snapshot.jobId, owner, vault.chainId)?.state, 'ready');
            } finally {
              await queue.stop();
            }
            assert.equal(c.wire.writes.length, writes);
            assert.equal(c.wire.stored.size, snapshot.chain.stored.length + writes);
          }
        }
        assert.equal(c.wire.signerLoads, c.wire.closed);
        results.push({ mode: snapshot.mode, scenario, outcome: scenario === 'coherent' ? 'recovered-and-authenticated' : 'refused-without-new-stores' });
      } finally {
        await rm(c.root, { recursive: true });
      }
    }
  }
  return {
    schema: 'dotify.generated-bulletin-restore-report.v1',
    syntheticOnly: true,
    cases: results,
    historicalBinaryRollbackTested: false,
    productionTouched: false
  };
}
