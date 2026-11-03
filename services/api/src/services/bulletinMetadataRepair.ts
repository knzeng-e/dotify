// One additive, exact-manifest repair of the pre-registration Unknown artist bug.
// No signer, network store, queue reset or mutable metadata alias lives here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { jobSchema, ownerSchema, load, sync, budgetSchema } from './bulletinMediaState.js';
import { assertPublicationBinding, publicationBinding, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import {
  buildPublicAssetGraph,
  publicAssetGeneration,
  publicAssetJob,
  publicAssetPolicySchema,
  readPublicAssetPolicy,
  type PublicAssetPolicy
} from './bulletinPublicAssets.js';
import { dotifyManifestSchema } from './releaseManifest.js';
import type { PinataFile } from './pinata.js';

const permitFile = 'metadata-name-repair.json';
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const manifestFiles = (manifest: z.infer<typeof dotifyManifestSchema>): PinataFile[] => [
  { path: 'release.json', bytes: Buffer.from(JSON.stringify(manifest)) }
];
const content = ({ createdAt: _time, ...rest }: z.infer<typeof dotifyManifestSchema>) => rest;
const repairSchema = z
  .object({
    schema: z.literal('dotify.bulletin.metadata-name-repair.v1'),
    profileSha256: z.string().regex(/^[0-9a-f]{64}$/),
    policy: publicAssetPolicySchema,
    oldRoot: z.string(),
    newRoot: z.string(),
    originalSha256: z.string().regex(/^[0-9a-f]{64}$/),
    manifest: dotifyManifestSchema,
    budget: budgetSchema
  })
  .strict();
type Repair = z.infer<typeof repairSchema>;

async function deriveRepair(profile: BulletinPublisherProfile, policy: PublicAssetPolicy, name: string, signal: AbortSignal): Promise<Repair> {
  assert.ok(profile.pilotScope, 'Metadata repair requires the existing one-release pilot');
  assert.equal(name, name.trim(), 'Use the exact trimmed artist name');
  assert.ok(name && name !== 'Unknown artist' && name.length <= 200 && Buffer.byteLength(name) <= 800, 'Invalid replacement artist name');
  const original = dotifyManifestSchema.parse(await load(join(profile.directory, 'public-metadata-input.json')));
  assert.equal(original.track.artistName, 'Unknown artist', 'Only the Unknown artist publication defect is repairable');
  assert.ok(original.track.title.trim() && original.track.description.trim(), 'Other required release text must already be valid');
  const previous = await buildPublicAssetGraph(manifestFiles(original), 'metadata', policy, signal);
  const manifest = { ...original, track: { ...original.track, artistName: name } };
  const next = await buildPublicAssetGraph(manifestFiles(manifest), 'metadata', policy, signal);
  return {
    schema: 'dotify.bulletin.metadata-name-repair.v1',
    profileSha256: publicationBinding(profile).profileSha256,
    policy,
    oldRoot: previous.root,
    newRoot: next.root,
    originalSha256: sha(original),
    manifest,
    budget: { maxTransactions: next.blocks.length, maxBytes: next.bytes, minimumLifetimeBlocks: policy.metadata.minimumLifetimeBlocks }
  };
}

async function verifyRepair(profile: BulletinPublisherProfile, policy: PublicAssetPolicy, input: unknown, signal: AbortSignal) {
  const repair = repairSchema.parse(input);
  const derived = await deriveRepair(profile, policy, repair.manifest.track.artistName, signal);
  assert.deepEqual(repair, derived, 'Metadata repair binding, bytes or allowance changed');
  return repair;
}

/** Caller owns publisher.lock. Missing means the original one-graph policy. */
export async function readMetadataRepair(profile: BulletinPublisherProfile, policy: PublicAssetPolicy, signal: AbortSignal): Promise<Repair | null> {
  let value: unknown;
  try {
    value = await load(join(profile.directory, permitFile));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  return verifyRepair(profile, policy, value, signal);
}

/** Only this exact new graph is admitted; old metadata stays in its own inventory. */
export function repairedMetadataFiles(repair: Repair, files: PinataFile[]): PinataFile[] {
  assert.ok(files.length === 1 && files[0].path === 'release.json' && files[0].bytes.length <= 50 * 1024, 'Invalid repaired metadata input');
  const input = dotifyManifestSchema.parse(JSON.parse(Buffer.from(files[0].bytes).toString('utf8')));
  assert.deepEqual(content(input), content(repair.manifest), 'Release details differ from the exact approved metadata repair');
  return manifestFiles(repair.manifest);
}

export function assertRepairInventories(repair: Repair, jobs: Array<z.infer<typeof jobSchema>>) {
  const metadata = jobs.filter(job => job.generation === publicAssetGeneration('metadata'));
  const original = metadata.find(job => job.root === repair.oldRoot);
  assert.ok(original && original.ready && !Object.keys(original.pending).length, 'Original metadata inventory must remain ready');
  assert.deepEqual(original.scope, repair.policy.scope, 'Original metadata scope changed');
  assert.deepEqual(original.budget, repair.policy.metadata, 'Original metadata allowance changed');
  assert.equal(Object.keys(original.receipts).length, original.blocks.length, 'Original metadata receipts incomplete');
  assert.ok(
    metadata.length <= 2 && metadata.every(job => job.job === publicAssetJob('metadata', job.root) && [repair.oldRoot, repair.newRoot].includes(job.root)),
    'Metadata repair cannot admit another graph'
  );
  return original;
}

/** Inspection/admission takes the same exclusive lease as normal custody.
 * Admission adds one immutable permit only, and never opens a Bulletin signer. */
export async function prepareMetadataNameRepair(
  options: {
    profile: BulletinPublisherProfile;
    queue: string;
    policyFile: string;
    artistName: string;
    signal: AbortSignal;
    admitPlan?: string;
  },
  unpublished: (policy: PublicAssetPolicy) => Promise<boolean>
) {
  const { profile, signal } = options;
  const release = await acquireBulletinPublisherLock(profile);
  try {
    signal.throwIfAborted();
    await assertPublicationBinding(options.queue, profile);
    await lstat(join(profile.directory, 'writer.lock')).then(
      () => {
        throw new Error('Existing writer lock requires reconciliation');
      },
      error => {
        if (error.code !== 'ENOENT') throw error;
      }
    );
    const policy = await readPublicAssetPolicy(options.policyFile, profile);
    const repair = await deriveRepair(profile, policy, options.artistName, signal);
    const owner = ownerSchema.parse(await load(join(profile.directory, 'owner.json')));
    assert.equal(owner.account, profile.account);
    assert.equal(owner.genesis, profile.genesis);
    assert.equal(new Set(owner.jobs).size, owner.jobs.length, 'Duplicate publication inventory');
    assert.equal(owner.activeJob, null, 'Pending account publication requires reconciliation');
    const jobs = [];
    for (const name of owner.jobs) {
      const job = jobSchema.parse(await load(join(profile.directory, `${name}.json`)));
      assert.equal(job.job, name);
      assert.equal(job.account, profile.account);
      assert.equal(job.genesis, profile.genesis);
      assert.ok(!Object.keys(job.pending).length, 'Uncertain submissions require reconciliation');
      jobs.push(job);
    }
    const original = assertRepairInventories(repair, jobs);
    assert.equal(jobs.filter(j => j.generation === publicAssetGeneration('metadata')).length, 1, 'Repair has already started');
    const previous = await buildPublicAssetGraph(
      manifestFiles(dotifyManifestSchema.parse(await load(join(profile.directory, 'public-metadata-input.json')))),
      'metadata',
      policy,
      signal
    );
    assert.deepEqual(
      original.blocks,
      previous.blocks.map(block => ({ cid: block.cid, bytes: block.bytes.length })),
      'Original metadata graph differs'
    );
    assert.equal(Object.keys(original.receipts).length, original.blocks.length, 'Original metadata receipts incomplete');
    for (const block of original.blocks) {
      const receipt = original.receipts[block.cid];
      assert.ok(receipt && receipt.cid === block.cid && receipt.bytes === block.bytes && receipt.finalized, 'Original metadata receipt mismatch');
    }
    assert.ok(await unpublished(policy), 'Canonical artist authority or unregistered release check failed');
    signal.throwIfAborted();
    const plan = { repair, snapshotSha256: sha({ owner, jobs }) };
    const planSha256 = sha(plan);
    if (options.admitPlan) {
      assert.equal(options.admitPlan, planSha256, 'Metadata repair plan changed; inspect again');
      // Check immediately before the additive commit as well. This is an
      // observation, not a reservation against an independent artist wallet.
      assert.ok(await unpublished(policy), 'Canonical release changed before admission');
      signal.throwIfAborted();
      const handle = await open(join(profile.directory, permitFile), 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(repair));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await sync(profile.directory);
    }
    return { mode: options.admitPlan ? 'admitted' : 'inspect', planSha256, plan };
  } finally {
    await release();
  }
}
