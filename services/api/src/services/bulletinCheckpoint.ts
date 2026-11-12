// Stopped-writer, settled multi-release DATA only. No configuration, vault,
// signer, network, queue startup, restore or directory initialization imports.
import assert from 'node:assert/strict';
import { mkdir, open, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { CID } from 'multiformats/cid';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { assertPublicationBinding, publicationBinding, publisherProfileSchema } from './bulletinPublisherProfile.js';
import { load, ownerSchema, jobSchema, bulletinInventoryLayout, sync, type BulletinMediaInventory } from './bulletinMediaState.js';
import { streamingJobsSchema, streamingJobSchema } from './streamingJobState.js';
import { admissionExtensions, createReleaseAdmission, releaseIdentity, releaseJob, releasePipeline, releaseAudioLayout } from './bulletinReleaseAdmission.js';
import { formatStreamingReference } from './streamingReference.js';
import { parseStreamingManifest } from './streamingFormat.js';
import {
  CHECKPOINT_MAX_BYTES,
  CHECKPOINT_MAX_FILES,
  canonicalCheckpointDirectory,
  checkpointFile,
  checkpointHash,
  checkpointMetadata,
  checkpointPath,
  checkpointTree,
  type CheckpointEntry
} from './bulletinCheckpointFiles.js';

const hex = z.string().regex(/^[0-9a-f]{64}$/);
const planSchema = z
  .object({
    schema: z.literal('dotify.bulletin.checkpoint-plan.v1'),
    sources: z.object({ queue: z.string(), publisher: z.string(), profile: z.string() }).strict(),
    profileSha256: hex,
    requiredKeyVersions: z
      .array(
        z
          .string()
          .max(80)
          .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      )
      .max(64),
    queueJobs: z.number().int().min(0).max(64),
    inventories: z.number().int().min(0).max(192),
    totalBytes: z.number().int().min(1).max(CHECKPOINT_MAX_BYTES),
    directories: z.array(z.string().max(256)).max(CHECKPOINT_MAX_FILES),
    files: z
      .array(
        z
          .object({
            path: z.string().max(256),
            bytes: z
              .number()
              .int()
              .min(1)
              .max(50 * 1024 * 1024 + 16),
            sha256: hex
          })
          .strict()
      )
      .min(1)
      .max(CHECKPOINT_MAX_FILES)
  })
  .strict();
type Plan = z.infer<typeof planSchema>;
type Options = { queue: string; profileFile: string; signal: AbortSignal };
const manifestSchema = z
  .object({
    schema: z.literal('dotify.bulletin.data-checkpoint.v1'),
    writerActivationAllowed: z.literal(false),
    secretsIncluded: z.literal(false),
    createdAt: z.string().datetime(),
    planSha256: hex,
    plan: planSchema
  })
  .strict();
const within = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);
const report = (plan: Plan) => ({
  planSha256: checkpointHash(JSON.stringify(plan)),
  files: plan.files.length,
  directories: plan.directories.length,
  totalBytes: plan.totalBytes,
  queueJobs: plan.queueJobs,
  inventories: plan.inventories,
  requiredKeyVersions: plan.requiredKeyVersions,
  secretsIncluded: false,
  writerActivationAllowed: false,
  canonicalHistoryChecked: false,
  independentStorageVerified: false
});

async function sourcePaths(options: Options) {
  options.signal.throwIfAborted();
  await canonicalCheckpointDirectory(options.queue);
  assert.ok(isAbsolute(options.profileFile) && resolve(options.profileFile) === options.profileFile, 'Canonical profile path required');
  await canonicalCheckpointDirectory(dirname(options.profileFile));
  const profile = publisherProfileSchema.parse(JSON.parse((await checkpointMetadata(options.profileFile, 2 * 1024 * 1024, options.signal)).toString('utf8')));
  assert.ok(profile.releasePolicy && !profile.pilotScope, 'Checkpoint supports the settled multi-release store only');
  await canonicalCheckpointDirectory(profile.directory);
  assert.ok(!within(options.queue, profile.directory) && !within(profile.directory, options.queue), 'Checkpoint roots must be separate');
  assert.ok(!within(options.queue, options.profileFile) && !within(profile.directory, options.profileFile), 'Keep the profile outside state roots');
  assert.ok(!within(options.queue, resolve(profile.seedFile)), 'Keep the signer outside checkpoint roots');
  return profile;
}

async function inspectLocked(options: Options, profile: Awaited<ReturnType<typeof sourcePaths>>): Promise<Plan> {
  const { queue, profileFile, signal } = options;
  const profileData = await checkpointFile(profileFile, undefined, signal);
  const budget = { files: 1, directories: 0, bytes: profileData.bytes };
  const roots = [await checkpointTree(queue, 'queue', signal, budget), await checkpointTree(profile.directory, 'publisher', signal, budget)];
  const files: CheckpointEntry[] = [...roots[0].files, ...roots[1].files, { path: 'profile.json', ...profileData }].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
  const directories = roots.flatMap(root => root.directories).sort();
  assert.ok(files.length <= CHECKPOINT_MAX_FILES && directories.length <= CHECKPOINT_MAX_FILES, 'Checkpoint exceeds entry bound');
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(totalBytes <= CHECKPOINT_MAX_BYTES, 'Checkpoint exceeds total byte bound');
  for (const required of ['queue/incoming', 'queue/jobs', 'queue/nonces', 'publisher'])
    assert.ok(directories.includes(required), 'Required state directory missing');
  await assertPublicationBinding(queue, profile);
  assert.deepEqual(publisherProfileSchema.parse(await load(profileFile)), profile, 'Checkpoint profile changed');
  const state = streamingJobsSchema.parse(await load(join(queue, 'jobs.json')));
  assert.equal(new Set(state.jobs.map(job => job.id)).size, state.jobs.length, 'Duplicate queue job');
  assert.ok(
    state.jobs.every(job => job.state === 'ready'),
    'Unsettled queue must finish or reconcile before checkpoint'
  );
  const owner = ownerSchema.parse(await load(join(profile.directory, 'owner.json')));
  assert.equal(owner.account, profile.account);
  assert.equal(owner.genesis, profile.genesis);
  assert.equal(owner.activeJob, null, 'Active publisher must finish or reconcile before checkpoint');
  assert.ok(owner.jobs.length <= 192 && new Set(owner.jobs).size === owner.jobs.length, 'Invalid checkpoint inventory count');
  const inventoryNames = files
    .filter(file => /^publisher\/stream-/.test(file.path))
    .map(file => file.path.slice('publisher/'.length))
    .sort();
  assert.deepEqual(inventoryNames, owner.jobs.map(id => `${id}.json`).sort(), 'Orphan or missing inventory');
  const inventories: BulletinMediaInventory[] = [];
  for (const id of owner.jobs) {
    signal.throwIfAborted();
    const inventory = jobSchema.parse(await load(join(profile.directory, `${id}.json`)));
    assert.equal(inventory.job, id);
    assert.equal(inventory.account, profile.account);
    assert.equal(inventory.genesis, profile.genesis);
    assert.ok(inventory.ready && !Object.keys(inventory.pending).length, 'Unsettled inventory must reconcile before checkpoint');
    const blocks = new Map(inventory.blocks.map(block => [block.cid, block.bytes]));
    assert.equal(blocks.size, inventory.blocks.length, 'Duplicate inventory block');
    assert.ok(blocks.has(inventory.root), 'Inventory root missing');
    assert.deepEqual(Object.keys(inventory.receipts).sort(), [...blocks.keys()].sort(), 'Incomplete ready receipts');
    for (const [cid, receipt] of Object.entries(inventory.receipts)) {
      assert.equal(receipt.cid, cid);
      assert.equal(receipt.bytes, blocks.get(cid));
    }
    inventories.push(inventory);
  }
  const admission = createReleaseAdmission({
    directory: profile.directory,
    profileSha256: publicationBinding(profile).profileSha256,
    policy: profile.releasePolicy!,
    audio: profile.budget
  });
  const ledger = await admission.validate();
  await admission.validateInventories(inventories);
  const archives = files
    .filter(file => /^publisher\/admission-before-/.test(file.path))
    .map(file => file.path)
    .sort();
  assert.deepEqual(
    archives,
    admissionExtensions(ledger)
      .map(extension => `publisher/admission-before-${extension.previousAdmissionSha256}.json`)
      .sort(),
    'Unbound admission archive'
  );
  for (const inventory of inventories)
    assert.deepEqual(inventory.pipeline, releasePipeline(profile.pipeline, ledger, inventory.scope), 'Inventory pipeline changed');
  await load(join(queue, 'nonces', 'ledger.json')).then(marker => assert.deepEqual(marker, { schema: 'dotify.streaming.nonce-ledger.v1' }));
  const generations = new Set<string>();
  for (const file of files.filter(file => /^queue\/nonces\/[0-9a-f]{64}\//.test(file.path))) {
    const [, , fingerprint, generationFile] = file.path.split('/');
    const generation = generationFile.slice(0, -5);
    assert.deepEqual(await load(join(queue, file.path.slice('queue/'.length))), { schema: 'dotify.streaming.nonce-ledger.v1', fingerprint, generation });
    generations.add(generation);
  }
  // Ready queue entries and their ciphertext are routinely pruned. The permanent
  // audio inventory still binds the output generation, so its reservation must
  // survive independently of either temporary representation. Public assets
  // are unencrypted and use non-nonce generation labels.
  for (const inventory of inventories)
    if (inventory.job === releaseJob(inventory.scope, 'audio')) assert.ok(generations.has(inventory.generation), 'Output nonce reservation missing');
  const jobIds = new Set(state.jobs.map(job => job.id));
  for (const directory of directories.filter(path => /^queue\/jobs\/[^/]+$/.test(path)))
    assert.ok(jobIds.has(directory.split('/')[2]), 'Orphan queue directory');
  for (const job of state.jobs) {
    admission.artistFor(job.scope, job.owner);
    const inventory = inventories.find(item => item.job === `stream-${job.id}`);
    assert.ok(inventory && inventory.job === releaseJob(job.scope, 'audio'), 'Ready queue lacks its admitted audio inventory');
    assert.deepEqual(inventory.scope, job.scope);
    assert.equal(
      job.ref,
      formatStreamingReference(inventory.root, job.scope.keyVersion, releaseAudioLayout(ledger, job.scope), value => CID.parse(value))
    );
    assert.equal(bulletinInventoryLayout(inventory), releaseAudioLayout(ledger, job.scope));
    assert.ok(generations.has(job.sourceGeneration), 'Source nonce reservation missing');
    if (directories.includes(`queue/jobs/${job.id}`)) {
      const folder = join(queue, 'jobs', job.id);
      const envelope = streamingJobSchema.parse(await load(join(folder, 'job.json')));
      for (const key of ['id', 'owner', 'scope', 'sourceGeneration', 'sourceBytes'] as const)
        assert.deepEqual(envelope[key], job[key], 'Admission envelope changed');
      const manifest = parseStreamingManifest(await checkpointMetadata(join(folder, 'output', 'manifest.json'), 256 * 1024, signal));
      for (const key of ['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'] as const)
        assert.equal(manifest[key], job.scope[key], 'Manifest scope changed');
      assert.equal(manifest.generation, inventory.generation, 'Manifest output generation changed');
      const expected = new Map<string, number | undefined>([
        [`queue/jobs/${job.id}/job.json`, undefined],
        [`queue/jobs/${job.id}/source.bin`, job.sourceBytes + 16],
        [`queue/jobs/${job.id}/output/manifest.json`, undefined],
        ...[manifest.master, ...manifest.renditions.flatMap(rendition => [rendition.init, ...rendition.segments])].map(
          object => [`queue/jobs/${job.id}/output/${object.path}`, object.encryptedLength] as const
        )
      ]);
      const retained = files.filter(file => file.path.startsWith(`queue/jobs/${job.id}/`));
      assert.deepEqual(retained.map(file => file.path).sort(), [...expected.keys()].sort(), 'Incomplete retained ciphertext');
      for (const file of retained) if (expected.get(file.path) !== undefined) assert.equal(file.bytes, expected.get(file.path));
    }
  }
  const metadata = files.filter(file => /^publisher\/public-metadata-/.test(file.path)).map(file => file.path);
  for (const path of metadata)
    assert.ok(
      ledger.releases.some(entry => path === `publisher/public-metadata-${releaseIdentity(entry.scope)}.json`),
      'Unbound public metadata'
    );
  const plan = planSchema.parse({
    schema: 'dotify.bulletin.checkpoint-plan.v1',
    sources: { queue, publisher: profile.directory, profile: profileFile },
    profileSha256: publicationBinding(profile).profileSha256,
    requiredKeyVersions: [
      ...new Set([
        ...profile.releasePolicy!.artists.map(artist => artist.keyVersion),
        ...ledger.releases.map(entry => entry.scope.keyVersion),
        ...inventories.map(item => item.scope.keyVersion)
      ])
    ].sort(),
    queueJobs: state.jobs.length,
    inventories: inventories.length,
    totalBytes,
    directories,
    files
  });
  validatePlan(plan);
  return plan;
}

/** Structural envelope checks only; source semantics are checked while holding the lease. */
function validatePlan(plan: Plan) {
  const names = new Set(plan.files.map(file => file.path));
  const directories = new Set(plan.directories);
  assert.equal(names.size, plan.files.length);
  assert.equal(directories.size, plan.directories.length);
  assert.equal(
    plan.totalBytes,
    plan.files.reduce((sum, file) => sum + file.bytes, 0)
  );
  for (const path of plan.directories) {
    assert.ok(checkpointPath(path, true));
    if (dirname(path) !== '.') assert.ok(directories.has(dirname(path)), 'Missing checkpoint ancestry');
  }
  for (const path of ['queue', 'publisher', 'queue/incoming', 'queue/jobs', 'queue/nonces']) assert.ok(directories.has(path), 'Required directory missing');
  for (const path of [
    'profile.json',
    'queue/jobs.json',
    'queue/publication-store.json',
    'queue/nonces/ledger.json',
    'publisher/owner.json',
    'publisher/publisher.json',
    'publisher/release-admission.json'
  ])
    assert.ok(names.has(path), 'Required file missing');
  for (const file of plan.files) {
    assert.ok(checkpointPath(file.path, false));
    if (dirname(file.path) !== '.') assert.ok(directories.has(dirname(file.path)), 'Missing checkpoint ancestry');
  }
}
async function verifyObjects(plan: Plan, objects: string, signal: AbortSignal) {
  await canonicalCheckpointDirectory(objects);
  assert.deepEqual(
    (await readdir(objects)).sort(),
    [...new Set(plan.files.map(file => `${file.sha256}.bin`))].sort(),
    'Missing or unexpected checkpoint object'
  );
  const seen = new Map<string, number>();
  for (const file of plan.files) {
    signal.throwIfAborted();
    if (seen.has(file.sha256)) {
      assert.equal(seen.get(file.sha256), file.bytes);
      continue;
    }
    const object = await checkpointFile(join(objects, `${file.sha256}.bin`), undefined, signal);
    assert.deepEqual(object, { bytes: file.bytes, sha256: file.sha256 }, 'Checkpoint object differs from its plan');
    seen.set(file.sha256, file.bytes);
  }
  return seen.size;
}

export async function inspectBulletinCheckpoint(options: Options) {
  const profile = await sourcePaths(options);
  const release = await acquireBulletinPublisherLock(profile);
  try {
    const plan = await inspectLocked(options, profile);
    return { plan, report: report(plan) };
  } finally {
    await release();
  }
}

export async function copyBulletinCheckpoint(options: Options & { destination: string; expectedPlanSha256: string }) {
  assert.match(options.expectedPlanSha256, /^[0-9a-f]{64}$/);
  const profile = await sourcePaths(options);
  assert.ok(isAbsolute(options.destination) && resolve(options.destination) === options.destination, 'Canonical checkpoint destination required');
  await canonicalCheckpointDirectory(dirname(options.destination));
  for (const source of [options.queue, profile.directory, options.profileFile])
    assert.ok(!within(source, options.destination) && !within(options.destination, source), 'Checkpoint destination overlaps source');
  assert.ok(!within(options.destination, resolve(profile.seedFile)), 'Checkpoint destination contains the signer');
  const release = await acquireBulletinPublisherLock(profile);
  try {
    const plan = await inspectLocked(options, profile);
    assert.equal(report(plan).planSha256, options.expectedPlanSha256, 'Checkpoint plan changed; inspect again');
    await mkdir(options.destination, { mode: 0o700 }); // Exclusive; never overwrite/delete an existing copy.
    await writeFile(join(options.destination, 'INCOMPLETE'), 'data-only checkpoint in progress\n', { flag: 'wx', mode: 0o600 });
    await sync(options.destination);
    const objects = join(options.destination, 'objects');
    await mkdir(objects, { mode: 0o700 });
    const copied = new Set<string>();
    for (const file of plan.files) {
      options.signal.throwIfAborted();
      const path =
        file.path === 'profile.json'
          ? options.profileFile
          : join(file.path.startsWith('queue/') ? options.queue : profile.directory, file.path.slice(file.path.indexOf('/') + 1));
      const data = await checkpointFile(path, copied.has(file.sha256) ? undefined : join(objects, `${file.sha256}.bin`), options.signal);
      assert.deepEqual(data, { bytes: file.bytes, sha256: file.sha256 }, 'Checkpoint source changed during copy');
      copied.add(file.sha256);
    }
    assert.deepEqual(await inspectLocked(options, profile), plan, 'Checkpoint source changed during copy');
    await sync(objects);
    // Read the destination back before making a completed checkpoint visible.
    await verifyObjects(plan, objects, options.signal);
    options.signal.throwIfAborted();
    const manifest = manifestSchema.parse({
      schema: 'dotify.bulletin.data-checkpoint.v1',
      writerActivationAllowed: false,
      secretsIncluded: false,
      createdAt: new Date().toISOString(),
      planSha256: options.expectedPlanSha256,
      plan
    });
    const bytes = Buffer.from(JSON.stringify(manifest));
    assert.ok(bytes.length <= 4 * 1024 * 1024, 'Checkpoint manifest exceeds bound');
    const manifestFile = await open(join(options.destination, 'checkpoint.json'), 'wx', 0o600);
    try {
      await manifestFile.writeFile(bytes);
      await manifestFile.sync();
    } finally {
      await manifestFile.close();
    }
    await sync(options.destination);
    await rm(join(options.destination, 'INCOMPLETE'));
    await sync(options.destination);
    await sync(dirname(options.destination));
    return { ...report(plan), manifestSha256: checkpointHash(bytes), objects: copied.size };
  } finally {
    await release();
  }
}

export async function verifyBulletinCheckpoint(destination: string, expectedManifestSha256: string, signal: AbortSignal) {
  assert.match(expectedManifestSha256, /^[0-9a-f]{64}$/);
  await canonicalCheckpointDirectory(destination);
  assert.deepEqual((await readdir(destination)).sort(), ['checkpoint.json', 'objects'], 'Incomplete or unexpected checkpoint contents');
  const manifestFile = join(destination, 'checkpoint.json');
  const data = await checkpointMetadata(manifestFile, 4 * 1024 * 1024, signal);
  assert.equal(checkpointHash(data), expectedManifestSha256, 'Checkpoint differs from separately retained digest');
  const manifest = manifestSchema.parse(JSON.parse(data.toString('utf8')));
  assert.equal(manifest.planSha256, report(manifest.plan).planSha256, 'Checkpoint plan digest changed');
  const plan = manifest.plan;
  validatePlan(plan);
  const objects = await verifyObjects(plan, join(destination, 'objects'), signal);
  return { ...report(plan), manifestSha256: expectedManifestSha256, objects };
}
