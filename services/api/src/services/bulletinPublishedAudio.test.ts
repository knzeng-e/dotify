import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm, chmod, symlink, link, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { blake2b } from '@noble/hashes/blake2';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { create as digest } from 'multiformats/hashes/digest';
import { StreamingEncryptor, STREAM_MIME, type StreamingScope, type StreamingRendition } from './streamingFormat.js';
import { StreamingNonceLedger, initializeStreamingNonceLedger } from './streamingNonces.js';
import { deriveReleaseKeyMaterial } from './contentKeyMaterial.js';
import { buildBulletinMediaGraph, buildBulletinDirectoryGraph, readBulletinMediaPath } from './bulletinGraph.js';
import { buildBulletinCompactMediaGraph } from './bulletinCompactGraph.js';
import { formatStreamingReference } from './streamingReference.js';
import { capturePublishedBulletinArchive, withVerifiedPublishedBulletinArchive } from './bulletinPublishedArchive.js';
import { authenticatePublishedBulletinAudio as authenticate } from './bulletinPublishedAudio.js';
import { readArchivedBulletinMaster } from './bulletinArchivedMaster.js';
import { checkpointHash } from './bulletinCheckpointFiles.js';
import { recoveredContentKeySchema } from './recoveredContentKeySchema.js';
import { tree } from './bulletinPreparedRecovery.fixture.js';

const signal = () => new AbortController().signal;
type Mode = 'standard' | 'compact';
async function fixture(t: TestContext, mode: Mode = 'standard', size = 96, alter: 'none' | 'master' | 'media' | 'manifest' | 'hash' = 'none', segments = 3) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'dotify-published-audio-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = Buffer.alloc(size, 0x37),
    master = Buffer.alloc(32, 0x43);
  const scope: StreamingScope = {
    chainId: 420420417,
    runtimeAddress: '0x' + '12'.repeat(20),
    contentHash: '0x' + Buffer.from(blake2b(source, { dkLen: 32 })).toString('hex'),
    keyVersion: 'dotify-content-key-v3'
  };
  if (alter === 'hash') scope.contentHash = '0x' + '11'.repeat(32);
  const key = deriveReleaseKeyMaterial(master, scope),
    ledger = join(root, 'producer');
  await initializeStreamingNonceLedger(ledger);
  const encryptor = new StreamingEncryptor(key, await new StreamingNonceLedger(ledger).reserve(key), scope);
  const files: { path: string; bytes: Buffer }[] = [];
  const encrypted = (bytes: Buffer, context: Parameters<StreamingEncryptor['object']>[1]) => {
    const object = encryptor.object(bytes, context);
    files.push({ path: context.path, bytes: object.bytes });
    return object.descriptor;
  };
  const descriptor = encrypted(source, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
  const renditions: StreamingRendition[] = ([96, 160, 320] as const).map(bitrateKbps => ({
    bitrateKbps,
    mediaMime: STREAM_MIME,
    init: encrypted(Buffer.from('public structural init'), { rendition: String(bitrateKbps), kind: 'init', index: 0, path: `${bitrateKbps}/init.bin` }),
    segments: Array.from({ length: segments }, (_, index) =>
      encrypted(Buffer.alloc(80, index + 1), {
        rendition: String(bitrateKbps),
        kind: 'media',
        index,
        path: `${bitrateKbps}/segment-${String(index).padStart(3, '0')}.bin`
      })
    )
  }));
  const manifest = encryptor.manifest({ durationSeconds: 8, integratedLufs: -18, gainDb: 0, master: descriptor, renditions });
  if (alter === 'manifest') manifest.authentication.tag = '00'.repeat(16);
  if (alter === 'master') files[0].bytes[0] ^= 1;
  if (alter === 'media') files.find(f => f.path === '160/segment-002.bin')!.bytes[0] ^= 1;
  files.push({ path: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
  const graph = await (mode === 'compact' ? buildBulletinCompactMediaGraph : buildBulletinMediaGraph)(files, signal());
  const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  const directory = join(root, 'archive');
  const captured = await capturePublishedBulletinArchive({
    root: graph.root,
    destination: directory,
    signal: signal(),
    readBlock: async cid => {
      const b = blocks.get(cid);
      assert.ok(b);
      return b;
    }
  });
  const plan = {
    schema: 'dotify.bulletin.published-audio-check.v1',
    archiveManifestSha256: captured.manifestSha256,
    registeredReference: formatStreamingReference(graph.root, scope.keyVersion, mode === 'compact' ? 'rendition-pack-v1' : 'unixfs-files-v1', value =>
      CID.parse(value)
    ),
    scope,
    masterSha256: checkpointHash(master)
  };
  // Loss of the producer's source, nonce state and in-memory graph comes before
  // recovery keys are introduced. No synthetic source.bin is recreated.
  await rm(ledger, { recursive: true });
  blocks.clear();
  for (const f of files) f.bytes.fill(0);
  source.fill(0);
  key.fill(0);
  master.fill(0);
  const inputs = join(root, 'separate-inputs');
  await mkdir(inputs, { mode: 0o700 });
  const planFile = join(inputs, 'plan.json'),
    keyFile = join(inputs, 'keys.json');
  await writeFile(planFile, JSON.stringify(plan), { mode: 0o600 });
  await writeFile(
    keyFile,
    JSON.stringify({ schema: 'dotify.content-key-recovery.v1', masters: { [scope.keyVersion]: '43'.repeat(32), 'dotify-content-key-v2': 'AB'.repeat(512) } }),
    { mode: 0o600 }
  );
  const options = { directory, planFile, expectedPlanSha256: checkpointHash(JSON.stringify(plan)), keyFile, signal: signal() };
  const savePlan = async () => {
    const raw = JSON.stringify(plan);
    await writeFile(planFile, raw);
    options.expectedPlanSha256 = checkpointHash(raw);
  };
  return { root, graphRoot: graph.root, directory, plan, options, savePlan };
}

for (const mode of ['standard', 'compact'] as const) {
  test(`${mode}: offline authentication survives producer loss without changing data or exporting plaintext`, async t => {
    const c = await fixture(t, mode, 7 * 1024 * 1024),
      before = await tree(c.root);
    const result = await authenticate(c.options);
    assert.equal(result.authenticatedObjects, 13);
    assert.equal(result.originalBytes, 7 * 1024 * 1024);
    assert.equal(result.originalContentHashVerified, true);
    assert.equal(result.ciphertextAuthenticated, true);
    assert.equal(result.expectedReferenceMatched, true);
    for (const flag of [
      'registrationVerified',
      'canonicalHistoryChecked',
      'independentStorageVerified',
      'keyBackupOriginVerified',
      'decodedOrAudibleAudioVerified',
      'writerActivationAllowed',
      'signerLoaded',
      'serviceStarted'
    ] as const)
      assert.equal(result[flag], false);
    assert.equal(JSON.stringify(result).includes('43434343'), false);
    assert.deepEqual(await tree(c.root), before);
    await withVerifiedPublishedBulletinArchive(c.directory, c.plan.archiveManifestSha256, signal(), async a => {
      await assert.rejects(readBulletinMediaPath(a.readBlock, a.root, 'archive/master.bin', 1024, signal()), /Unsupported media path/);
    });
  });
  test(`${mode}: CID-correct but unauthentic manifest, master or rendition cannot pass`, async t => {
    for (const alter of ['manifest', 'master', 'media'] as const) {
      const c = await fixture(t, mode, 96, alter),
        before = await tree(c.root);
      await assert.rejects(authenticate(c.options), /authenticate|Unsupported state/i);
      assert.deepEqual(await tree(c.root), before);
    }
    const wrongHash = await fixture(t, mode, 96, 'hash');
    await assert.rejects(authenticate(wrongHash.options), /original content hash differs/);
  });
  test(`${mode}: expected root, wire layout and scope are authoritative, not inferred from the manifest`, async t => {
    const c = await fixture(t, mode);
    const original = structuredClone(c.plan);
    c.plan.scope.chainId++;
    await c.savePlan();
    await assert.rejects(authenticate(c.options), /identity mismatch/);
    c.plan.scope = original.scope;
    c.plan.registeredReference = original.registeredReference.replace(
      mode === 'compact' ? 'bulletin-pack-v1' : 'ipfs',
      mode === 'compact' ? 'ipfs' : 'bulletin-pack-v1'
    );
    await c.savePlan();
    await assert.rejects(authenticate(c.options), /physical layout/);
    const other = await fixture(t, mode, 128);
    c.plan.registeredReference = other.plan.registeredReference;
    await c.savePlan();
    await assert.rejects(authenticate(c.options), /expected release root/);
  });
}

test('compact startup-only graph still refuses a mislabeled standard reference', async t => {
  const c = await fixture(t, 'compact', 96, 'none', 1);
  assert.equal((await authenticate(c.options)).authenticatedObjects, 7);
  c.plan.registeredReference = c.plan.registeredReference.replace('bulletin-pack-v1', 'ipfs');
  await c.savePlan();
  await assert.rejects(authenticate(c.options), /physical layout/);
});
test('missing, malformed, wrong-version and wrong-master envelopes fail before authentication', async t => {
  const c = await fixture(t),
    { keyFile } = c.options;
  for (const masters of [
    {},
    { 'dotify-content-key-v2': '43'.repeat(32) },
    { 'dotify-content-key-v1': '43'.repeat(32) },
    { 'dotify-content-key-v3': '44'.repeat(32) },
    { 'dotify-content-key-v3': '43'.repeat(31) }
  ]) {
    await writeFile(keyFile, JSON.stringify({ schema: 'dotify.content-key-recovery.v1', masters }));
    await assert.rejects(authenticate(c.options));
  }
  await rm(keyFile);
  await assert.rejects(authenticate(c.options), /ENOENT/);
});
test('shared offline envelope accepts the existing bounds and rejects excess versions or secret sizes', () => {
  const value = (masters: Record<string, string>) => ({ schema: 'dotify.content-key-recovery.v1', masters });
  assert.equal(recoveredContentKeySchema.safeParse(value({ 'dotify-content-key-v3': 'AA'.repeat(512) })).success, true);
  for (const masters of [
    {},
    { 'dotify-content-key-v3': 'AA'.repeat(513) },
    Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`dotify-content-key-v${i + 2}`, '43'.repeat(32)]))
  ])
    assert.equal(recoveredContentKeySchema.safeParse(value(masters)).success, false);
});
test('trust-plan and archive digest mismatch, unexpected fields and reference/version mismatch refuse', async t => {
  const c = await fixture(t);
  await assert.rejects(authenticate({ ...c.options, expectedPlanSha256: '0'.repeat(64) }), /trust plan changed/);
  c.plan.masterSha256 = '0'.repeat(64);
  await c.savePlan();
  await assert.rejects(authenticate(c.options), /trusted commitment/);
  c.plan.masterSha256 = checkpointHash(Buffer.alloc(32, 0x43));
  c.plan.archiveManifestSha256 = '0'.repeat(64);
  await c.savePlan();
  await assert.rejects(authenticate(c.options), /archive manifest changed/i);
  const extra = { ...c.plan, unexpected: true },
    raw = JSON.stringify(extra);
  await writeFile(c.options.planFile, raw);
  await assert.rejects(authenticate({ ...c.options, expectedPlanSha256: checkpointHash(raw) }), /Unrecognized key/);
  c.plan.scope.keyVersion = 'dotify-content-key-v4';
  await c.savePlan();
  await assert.rejects(authenticate(c.options), /reference differs from scope/);
});
test('key/plan links, modes, aliases and overlap with the archive refuse; inputs stay unchanged', async t => {
  for (const kind of ['mode', 'hardlink', 'symlink', 'parent-mode', 'inside', 'alias'] as const) {
    const c = await fixture(t),
      input = c.options.keyFile;
    if (kind === 'mode') await chmod(input, 0o644);
    if (kind === 'hardlink') await link(input, join(c.root, 'linked'));
    if (kind === 'symlink') {
      const target = join(c.root, 'target');
      await writeFile(target, await readFile(input), { mode: 0o600 });
      await rm(input);
      await symlink(target, input);
    }
    if (kind === 'parent-mode') await chmod(join(c.root, 'separate-inputs'), 0o755);
    if (kind === 'inside') c.options.keyFile = join(c.directory, 'keys.json');
    if (kind === 'alias') c.options.keyFile = join(c.root, 'separate-inputs', '..', 'separate-inputs', 'keys.json') + '/..//keys.json';
    await assert.rejects(authenticate(c.options));
  }
  const c = await fixture(t);
  await assert.rejects(authenticate({ ...c.options, planFile: c.options.keyFile }), /must be separate/);
  const alias = join(c.root, 'alias');
  await symlink(c.directory, alias);
  await assert.rejects(authenticate({ ...c.options, directory: alias }), /aliases/);
});
test('cancellation and changed archive files refuse; verified consumer rechecks after reading', async t => {
  const c = await fixture(t),
    controller = new AbortController();
  controller.abort(new Error('public cancellation'));
  await assert.rejects(authenticate({ ...c.options, signal: controller.signal }), /public cancellation/);
  await assert.rejects(
    withVerifiedPublishedBulletinArchive(c.directory, c.plan.archiveManifestSha256, signal(), async a => {
      await a.readBlock(a.root, signal());
      const file = join(c.directory, 'objects', (await readdir(join(c.directory, 'objects')))[0]);
      await chmod(file, 0o644);
    }),
    /Unsafe/
  );
});
test('recovery-only original reader handles the 50-MiB source maximum and rejects over/underreported lengths', async () => {
  const size = 50 * 1024 * 1024 + 16;
  const graph = await buildBulletinDirectoryGraph([{ path: 'archive/master.bin', bytes: Buffer.alloc(size, 0x53) }], signal());
  const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  const options = {
    root: graph.root,
    encryptedLength: size,
    signal: signal(),
    readBlock: async (cid: string) => {
      const b = blocks.get(cid);
      assert.ok(b);
      return b;
    }
  };
  const result = await readArchivedBulletinMaster(options);
  assert.equal(result.length, size);
  assert.equal(result[0], 0x53);
  assert.equal(result[size - 1], 0x53);
  result.fill(0);
  await assert.rejects(readArchivedBulletinMaster({ ...options, encryptedLength: size + 1 }), /bound/);
  await assert.rejects(readArchivedBulletinMaster({ ...options, encryptedLength: size - 1 }), /bound|length/);
});
test('malformed original UnixFS sizes, missing paths, deep data and wrong CID bytes refuse', async () => {
  const id = (b: Uint8Array, codec = 0x55) => CID.createV1(codec, digest(0xb220, blake2b(b, { dkLen: 32 })));
  const encoded = (n: dagPB.PBNode) => {
    const b: unknown = dagPB.encode(dagPB.prepare(n));
    assert.ok(b instanceof Uint8Array);
    return Buffer.from(b);
  };
  for (const kind of ['size', 'depth', 'type', 'cid', 'missing'] as const) {
    const blocks = new Map<string, Uint8Array>();
    const put = (b: Uint8Array, codec = 0x55) => {
      const cid = id(b, codec);
      blocks.set(cid.toString(), b);
      return cid;
    };
    let leaf = put(Buffer.alloc(32, 1));
    if (kind === 'size') leaf = put(encoded({ Data: new UnixFS({ type: 'file', blockSizes: [31n] }).marshal(), Links: [{ Hash: leaf }] }), dagPB.code);
    if (kind === 'type') leaf = put(encoded({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [] }), dagPB.code);
    if (kind === 'depth')
      for (let i = 0; i < 10; i++)
        leaf = put(encoded({ Data: new UnixFS({ type: 'file', blockSizes: [32n] }).marshal(), Links: [{ Hash: leaf }] }), dagPB.code);
    const archive = put(
      encoded({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: kind === 'missing' ? 'other.bin' : 'master.bin', Hash: leaf }] }),
      dagPB.code
    );
    const root = put(encoded({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: 'archive', Hash: archive }] }), dagPB.code);
    await assert.rejects(
      readArchivedBulletinMaster({
        root: root.toString(),
        encryptedLength: 32,
        signal: signal(),
        readBlock: async cid => {
          const b = blocks.get(cid);
          assert.ok(b);
          return kind === 'cid' ? Buffer.alloc(24) : b;
        }
      }),
      /size|depth|file|CID|missing/i
    );
  }
});
test('original traversal read-count and fetched-byte budgets stop repeated empty subgraphs', async () => {
  const blocks = new Map<string, Uint8Array>();
  const put = (node: dagPB.PBNode) => {
    const bytes: unknown = dagPB.encode(dagPB.prepare(node));
    assert.ok(bytes instanceof Uint8Array);
    const cid = CID.createV1(dagPB.code, digest(0xb220, blake2b(bytes, { dkLen: 32 })));
    blocks.set(cid.toString(), bytes);
    return cid;
  };
  const leaf = put({ Data: new UnixFS({ type: 'file' }).marshal(), Links: [] });
  const fan = (child: CID, length: number) =>
    put({ Data: new UnixFS({ type: 'file', blockSizes: Array.from({ length }, () => 0n) }).marshal(), Links: Array.from({ length }, () => ({ Hash: child })) });
  for (const [kind, file] of [
    ['reads', fan(fan(leaf, 32), 64)],
    ['bytes', fan(leaf, 3000)]
  ] as const) {
    const archive = put({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: 'master.bin', Hash: file }] });
    const root = put({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: 'archive', Hash: archive }] });
    await assert.rejects(
      readArchivedBulletinMaster({
        root: root.toString(),
        encryptedLength: kind === 'reads' ? 1024 * 1024 : 17,
        signal: signal(),
        readBlock: async cid => {
          const b = blocks.get(cid);
          assert.ok(b);
          return b;
        }
      }),
      kind === 'reads' ? /read bound/ : /byte bound/
    );
  }
});
test('private plan and recovered-key file byte limits are enforced before parsing', async t => {
  for (const field of ['planFile', 'keyFile'] as const) {
    const c = await fixture(t);
    await writeFile(c.options[field], Buffer.alloc(64 * 1024 + 1, 0x20));
    await assert.rejects(authenticate(c.options), /exceeds bound/);
  }
});
test('CLI verifies offline with no fallback and emits only fixed refusal text for invalid private input', async t => {
  const c = await fixture(t);
  const args = [
    '--import',
    'tsx',
    'src/scripts/authenticatePublishedBulletin.ts',
    c.directory,
    c.options.planFile,
    c.options.expectedPlanSha256,
    c.options.keyFile
  ];
  const preload = join(c.root, 'no-network.mjs');
  await writeFile(preload, 'globalThis.fetch=()=>{throw Error("NETWORK_FORBIDDEN")};', { mode: 0o600 });
  const run = (a: string[]) =>
    spawnSync(process.execPath, ['--import', preload, ...a], {
      cwd: resolve('.'),
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, CONTENT_KEY_MASTER_SECRET: 'ff'.repeat(32), CONTENT_KEY_MASTER_SECRETS: '{}' }
    });
  const ok = run(args);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).authenticatedObjects, 13);
  await rm(c.options.keyFile);
  const bad = run(args);
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.equal(bad.stderr.trim(), 'BULLETIN_PUBLISHED_AUDIO_STOPPED: preserve the archive; review the separate trust plan and recovered key versions.');
  assert.equal(bad.stderr.includes(c.root), false);
});
