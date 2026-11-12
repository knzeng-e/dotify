// Generated fixtures ONLY. Never run against live data or real keys.
// The consumer runs the unchanged compiled CLI in an offline/read-only-root
// container; the public constant below is only for external fixture readback.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { readCheckpointManifest } from '../dist/services/bulletinCheckpoint.js';
import { checkpointMetadata } from '../dist/services/bulletinCheckpointFiles.js';
import { publisherProfileSchema, assertPublicationBinding } from '../dist/services/bulletinPublisherProfile.js';
import { contentMasterDigest } from '../dist/services/freshContentKeyBinding.js';
import { deriveContentKeyBytes } from '../dist/services/keyVault.js';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../dist/services/streamingFormat.js';
import { streamingKeyFingerprint } from '../dist/services/streamingNonces.js';

const [mode, directory, ...args] = process.argv.slice(2);
const layouts = ['standard', 'compact'];
const signal = AbortSignal.timeout(5 * 60_000);
const publicSecret = '43'.repeat(32);
const vault = {
  contentKeyMasterSecret: '',
  contentKeyMasterSecrets: JSON.stringify({ 'dotify-content-key-v3': publicSecret }),
  contentKeyActiveVersion: 'dotify-content-key-v3',
  chainId: 420420417
};
const privateRoot = async root => {
  assert.ok(isAbsolute(root) && resolve(root) === root && (await realpath(root)) === root);
  const info = await lstat(root);
  assert.ok(info.isDirectory() && info.uid === process.getuid() && !(info.mode & 0o077));
};
const runCli = (...values) => {
  const result = spawnSync(process.execPath, ['dist/scripts/checkpointBulletinCustody.js', ...values], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
    timeout: 300_000
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
const sourceRoot = source => {
  assert.match(source, /^(?:\/private)?\/tmp\/dotify-prepared-recovery-[A-Za-z0-9]{6}\/(?:queue|publisher|profile\.json)$/);
};

if (mode === 'prepare') {
  assert.equal(args.length, 0);
  assert.equal(basename(directory), 'generated-isolated-checkpoints');
  await mkdir(directory, { mode: 0o700 }); // Exclusive generated artifact only.
  await privateRoot(directory);
  const { fixture } = await import('../src/services/bulletinPreparedRecovery.fixture.ts');
  const cleanup = [];
  const digests = {};
  try {
    for (const layout of layouts) {
      const c = await fixture({ after: fn => cleanup.push(fn) }, layout, await realpath('/tmp'));
      await c.execute((await c.inspect()).planSha256);
      const plan = runCli('inspect', c.queue, c.profileFile);
      const copy = runCli('copy', c.queue, c.profileFile, join(directory, layout), plan.planSha256);
      runCli('verify', join(directory, layout), copy.manifestSha256);
      digests[layout] = copy.manifestSha256;
      await rm(c.root, { recursive: true, force: true });
    }
  } finally {
    for (const remove of cleanup) await remove();
  }
  console.log(JSON.stringify({ schema: 'dotify.bulletin.generated-isolated-checkpoints.v1', syntheticOnly: true, ...digests }));
} else if (mode === 'receive') {
  // Actions artifact download intentionally loses Unix modes. Repair privacy
  // ONLY for this generated artifact, before invoking any production reader.
  assert.equal(args.length, 0);
  assert.equal(basename(directory), 'generated-isolated-checkpoints');
  assert.equal(await realpath(directory), directory);
  assert.deepEqual((await readdir(directory)).sort(), [...layouts].sort());
  const setMode = async (path, isDirectory) => {
    const info = await lstat(path);
    assert.ok(
      info.uid === process.getuid() &&
        !info.isSymbolicLink() &&
        (isDirectory ? info.isDirectory() : info.isFile() && info.nlink === 1 && info.size <= 2 * 1024 * 1024)
    );
    await chmod(path, isDirectory ? 0o700 : 0o600);
  };
  await setMode(directory, true);
  for (const layout of layouts) {
    const root = join(directory, layout);
    await setMode(root, true);
    assert.deepEqual((await readdir(root)).sort(), ['checkpoint.json', 'objects']);
    await setMode(join(root, 'checkpoint.json'), false);
    await setMode(join(root, 'objects'), true);
    const objects = await readdir(join(root, 'objects'));
    assert.ok(objects.length <= 128);
    let total = 0;
    for (const name of objects) {
      assert.match(name, /^[0-9a-f]{64}\.bin$/);
      const path = join(root, 'objects', name);
      await setMode(path, false);
      total += (await lstat(path)).size;
      assert.ok(total <= 8 * 1024 * 1024);
    }
  }
  console.log(JSON.stringify({ syntheticOnly: true, receivedLayouts: 2, privateModesRestored: true }));
} else if (mode === 'restore' || mode === 'verify') {
  assert.equal(args.length, mode === 'restore' ? 3 : 2);
  const output = mode === 'restore' ? args[0] : directory;
  const digests = mode === 'restore' ? args.slice(1) : args;
  await privateRoot(output);
  // Keep the explicitly public test key OUTSIDE the reconstructed artifact.
  // This exercises readback, not real independently recovered key custody.
  const keyDirectory = await mkdtemp('/tmp/dotify-generated-readback-key-');
  const keyFile = join(keyDirectory, 'versions.json');
  await writeFile(keyFile, JSON.stringify({ schema: 'dotify.content-key-recovery.v1', masters: { 'dotify-content-key-v3': publicSecret } }), { mode: 0o600 });
  const modules = new Set();
  const checkImports = async path => {
    if (modules.has(path)) return;
    modules.add(path);
    assert.ok(!/\/(config|keyVault|index|streamingJobs|streamingPublicationStore|bulletinTransport)\.js$/.test(path), 'Forbidden operational recovery import');
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+\.js)['"]/g)) await checkImports(resolve(dirname(path), match[1]));
  };
  await checkImports(resolve('dist/scripts/verifyRecoveredBulletinKeys.js'));
  const cases = [];
  for (const [index, layout] of layouts.entries()) {
    const digest = digests[index];
    assert.match(digest, /^[0-9a-f]{64}$/);
    const target = join(output, layout);
    const manifestPath = mode === 'restore' ? join(directory, layout, 'checkpoint.json') : join(target, 'checkpoint.json');
    const read = await readCheckpointManifest(manifestPath, digest, signal);
    for (const path of Object.values(read.manifest.plan.sources)) {
      sourceRoot(path);
      await assert.rejects(lstat(path), { code: 'ENOENT' });
    }
    const profileEntry = read.manifest.plan.files.find(file => file.path === 'profile.json');
    const profilePath = mode === 'restore' ? join(directory, layout, 'objects', `${profileEntry.sha256}.bin`) : join(target, 'data', 'profile.json.checkpoint');
    const profile = publisherProfileSchema.parse(JSON.parse((await checkpointMetadata(profilePath, 2 * 1024 * 1024, signal)).toString('utf8')));
    assert.equal(profile.endpoint, 'wss://bulletin.example:8443');
    assert.equal(profile.freshContentKey.masterSha256, contentMasterDigest(publicSecret));
    assert.deepEqual(profile.releasePolicy.artists, [
      { owner: `0x${'12'.repeat(20)}`, chainId: 420420417, runtimeAddress: `0x${'34'.repeat(20)}`, keyVersion: 'dotify-content-key-v3' }
    ]);
    const report = mode === 'restore' ? runCli('restore', join(directory, layout), target, digest) : runCli('verify-restored', target, digest);
    assert.equal(report.writerActivationAllowed, false);
    assert.equal(report.secretsIncluded, false);
    assert.equal(report.ciphertextAuthenticated, false);
    const queue = join(target, 'data', 'queue');
    await assert.rejects(assertPublicationBinding(queue, profile), /profile changed/);
    await assert.rejects(assertPublicationBinding(queue), /cannot be opened with Pinata/);
    const state = JSON.parse(await readFile(join(queue, 'jobs.json'), 'utf8'));
    assert.equal(state.jobs.length, 1);
    const job = state.jobs[0];
    const folder = join(queue, 'jobs', job.id, 'output');
    const manifest = parseStreamingManifest(await readFile(join(folder, 'manifest.json')));
    const key = deriveContentKeyBytes(job.scope, vault);
    assert.ok(key);
    verifyStreamingManifest(manifest, key, job.scope);
    const objects = [manifest.master, ...manifest.renditions.flatMap(rendition => [rendition.init, ...rendition.segments])];
    for (const object of objects) {
      const plain = decryptStreamingObject(await readFile(join(folder, object.path)), key, manifest, object);
      assert.deepEqual(
        plain,
        object.kind === 'master'
          ? Buffer.from('generated fixture only')
          : object.kind === 'init'
            ? Buffer.from('structural init')
            : Buffer.alloc(64, object.index + 1)
      );
    }
    const fingerprint = streamingKeyFingerprint(key);
    for (const generation of [job.sourceGeneration, manifest.generation])
      assert.deepEqual(JSON.parse(await readFile(join(queue, 'nonces', fingerprint, `${generation}.json`), 'utf8')), {
        schema: 'dotify.streaming.nonce-ledger.v1',
        fingerprint,
        generation
      });
    for (const path of Object.values(read.manifest.plan.sources)) await assert.rejects(lstat(path), { code: 'ENOENT' });
    const authenticated = spawnSync(process.execPath, ['dist/scripts/verifyRecoveredBulletinKeys.js', target, digest, keyFile], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
      timeout: 300_000
    });
    assert.equal(authenticated.status, 0, authenticated.stderr);
    const readback = JSON.parse(authenticated.stdout);
    assert.equal(readback.authenticatedObjects, 14);
    assert.equal(readback.retainedAudioInventories, 1);
    assert.equal(readback.prunedAudioInventories, 0);
    assert.equal(readback.nonceReservationsChecked, 2);
    assert.equal(readback.allAudioCiphertextRetained, true);
    for (const flag of [
      'writerActivationAllowed',
      'keyBackupOriginVerified',
      'canonicalHistoryChecked',
      'independentStorageVerified',
      'signerLoaded',
      'serviceStarted'
    ])
      assert.equal(readback[flag], false);
    cases.push({
      keyReadbackAuthenticatedObjects: readback.authenticatedObjects,
      layout,
      files: report.files,
      authenticatedSyntheticObjects: objects.length,
      originalSourcesAbsent: true,
      writerActivationAllowed: report.writerActivationAllowed
    });
  }
  await rm(keyDirectory, { recursive: true });
  console.log(
    JSON.stringify({
      schema: 'dotify.bulletin.generated-isolated-restore.v1',
      syntheticOnly: true,
      phase: mode,
      cases,
      realKeyRecoveryTested: false,
      serviceEntrypointTested: false
    })
  );
} else throw new Error('Generated isolated checkpoint rehearsal: prepare | receive | restore | verify');
