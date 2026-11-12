// Read-only binding of one existing audio job. Never claims a release slot,
// selects a new layout, creates an inventory or changes an allowance.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ownerSchema, jobSchema, bulletinInventoryLayout } from './bulletinMediaState.js';
import { assertStandardBulletinLayout, STANDARD_BULLETIN_LAYOUT } from './bulletinStorageLayout.js';
import {
  createReleaseAdmission,
  releaseIdentity,
  releaseJob,
  releasePipeline,
  admissionDigest,
  admissionExtensions,
  admissionArchive,
  releaseAdmissionLedgerSchema
} from './bulletinReleaseAdmission.js';
import { publicationBinding, publisherProfileSchema, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import type { StreamingJob } from './streamingJobState.js';

type Read = (name: string, file: string, maximum?: number) => Promise<Buffer>;
export async function readPreparedPublicationBinding(profile: BulletinPublisherProfile, job: StreamingJob, read: Read) {
  const name = `stream-${job.id}`;
  const owner = ownerSchema.parse(JSON.parse((await read('publisher-owner', join(profile.directory, 'owner.json'))).toString('utf8')));
  assert.equal(owner.account, profile.account);
  assert.equal(owner.genesis, profile.genesis);
  assert.equal(new Set(owner.jobs).size, owner.jobs.length, 'Duplicate publisher jobs');
  assert.ok(owner.jobs.includes(name) && (!owner.activeJob || owner.activeJob === name), 'Existing publication ownership unavailable');
  assert.ok(owner.jobs.length <= 64 * 3, 'Too many recovery inventories');
  const diskJobs = (await readdir(profile.directory)).filter(file => /^stream-.*\.json$/.test(file)).sort();
  assert.deepEqual(diskJobs, owner.jobs.map(id => `${id}.json`).sort(), 'Orphan or missing publication inventory');
  const inventories = [];
  // Hash the target first, followed by each retained inventory in owner order.
  for (const id of [name, ...owner.jobs.filter(id => id !== name)]) {
    const inventory = jobSchema.parse(
      JSON.parse((await read(id === name ? 'publication' : `retained-${id}`, join(profile.directory, `${id}.json`))).toString('utf8'))
    );
    assert.equal(inventory.job, id);
    assert.equal(inventory.account, profile.account);
    assert.equal(inventory.genesis, profile.genesis);
    if (id !== name)
      assert.ok(
        !Object.keys(inventory.pending).length && (inventory.ready || (!inventory.attemptedStores && !Object.keys(inventory.receipts).length)),
        'Another publication requires reconciliation'
      );
    if (!profile.releasePolicy) assertStandardBulletinLayout(bulletinInventoryLayout(inventory));
    if (id === name || profile.releasePolicy) inventories.push(inventory);
  }
  const inventory = inventories[0];
  if (!profile.releasePolicy) {
    assert.ok(profile.pilotScope, 'Recovery requires an immutable pilot or release admission');
    assert.deepEqual(job.scope, profile.pilotScope, 'Recovery scope differs from the pilot');
    return { name, inventory, layout: STANDARD_BULLETIN_LAYOUT, pipeline: profile.pipeline, admissionSha256: undefined };
  }
  const admission = createReleaseAdmission({
    directory: profile.directory,
    profileSha256: publicationBinding(profile).profileSha256,
    policy: profile.releasePolicy,
    audio: profile.budget
  });
  admission.artistFor(job.scope, job.owner);
  const state = await admission.validate();
  await admission.validateInventories(inventories);
  const entry = state.releases.find(item => releaseIdentity(item.scope) === releaseIdentity(job.scope));
  assert.ok(entry?.audio === name && name === releaseJob(job.scope, 'audio'), 'Recovery requires its original durable audio claim');
  const raw = releaseAdmissionLedgerSchema.parse(JSON.parse((await read('admission', join(profile.directory, 'release-admission.json'))).toString('utf8')));
  assert.equal(admissionDigest(raw), admissionDigest(state), 'Admission changed during recovery inspection');
  for (const extension of admissionExtensions(state)) {
    const previous = releaseAdmissionLedgerSchema.parse(
      JSON.parse(
        (await read(`admission-${extension.previousAdmissionSha256}`, join(profile.directory, admissionArchive(extension.previousAdmissionSha256)))).toString(
          'utf8'
        )
      )
    );
    assert.equal(admissionDigest(previous), extension.previousAdmissionSha256, 'Admission archive changed during recovery inspection');
  }
  for (const item of inventories)
    assert.deepEqual(item.pipeline, releasePipeline(profile.pipeline, state, item.scope), 'Admitted publication pipeline changed');
  return {
    name,
    inventory,
    layout: await admission.audioLayout(job.scope),
    pipeline: releasePipeline(profile.pipeline, state, job.scope),
    admissionSha256: admissionDigest(state)
  };
}

export async function readRecoveryProfileBinding(profile: BulletinPublisherProfile, file: string, queue: string, read: Read) {
  if (!profile.releasePolicy) return;
  assert.deepEqual(publisherProfileSchema.parse(JSON.parse((await read('profile', file)).toString('utf8'))), profile, 'Recovery profile changed');
  for (const [label, file] of [
    ['queue-binding', join(queue, 'publication-store.json')],
    ['publisher-binding', join(profile.directory, 'publisher.json')]
  ]) {
    assert.deepEqual(JSON.parse((await read(label, file)).toString('utf8')), publicationBinding(profile), 'Recovery profile binding changed');
  }
}
