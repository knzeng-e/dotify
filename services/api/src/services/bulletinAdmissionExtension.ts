// Explicit stopped-writer maintenance. No network, vault, signer or nonce import.
import assert from 'node:assert/strict';
import { lstat, open, readdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import {
  admissionArchive,
  admissionDigest,
  admissionExtensions,
  createReleaseAdmission,
  releaseAdmissionLedgerSchema,
  releaseIdentity,
  releaseJob,
  releaseScopeSchema
} from './bulletinReleaseAdmission.js';
import { assertPublicationBinding, publicationBinding, readBulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { jobSchema, load, ownerSchema, privateDirectory, save, sync, type BulletinMediaInventory } from './bulletinMediaState.js';
import { streamingJobsSchema } from './streamingJobState.js';

export const admissionExtensionRequestSchema = z
  .object({
    schema: z.literal('dotify.bulletin.release-extension.v1'),
    profileFile: z.string().refine(isAbsolute),
    queue: z.string().refine(isAbsolute),
    expectedProfileSha256: z.string().regex(/^[0-9a-f]{64}$/),
    expectedAdmissionSha256: z.string().regex(/^[0-9a-f]{64}$/),
    owner: z.string().regex(/^0x[0-9a-f]{40}$/),
    scope: releaseScopeSchema
  })
  .strict();

export async function extendBulletinAdmission(input: unknown, apply = false) {
  const request = admissionExtensionRequestSchema.parse(input);
  const profile = await readBulletinPublisherProfile(request.profileFile);
  assert.ok(profile.releasePolicy && !profile.pilotScope, 'Multi-release profile required');
  assert.equal(publicationBinding(profile).profileSha256, request.expectedProfileSha256, 'Reviewed publication profile changed');
  // The same lease used by the runtime excludes a running custody publisher.
  const unlock = apply ? await acquireBulletinPublisherLock(profile) : undefined;
  try {
    await privateDirectory(request.queue);
    await privateDirectory(join(request.queue, 'nonces'));
    await assertPublicationBinding(request.queue, profile);
    const admission = createReleaseAdmission({
      directory: profile.directory,
      profileSha256: request.expectedProfileSha256,
      policy: profile.releasePolicy,
      audio: profile.budget
    });
    admission.artistFor(request.scope, request.owner);
    const before = await admission.validate();
    assert.equal(admissionDigest(before), request.expectedAdmissionSha256, 'Reviewed admission checkpoint changed');
    assert.ok(!before.releases.some(e => releaseIdentity(e.scope) === releaseIdentity(request.scope)), 'Cannot extend an existing admitted release');
    const extensions = admissionExtensions(before);
    assert.ok(!extensions.some(e => releaseIdentity(e.scope) === releaseIdentity(request.scope)), 'Release already has an extension');
    const baseCapacity = Math.min(
      profile.releasePolicy.maxReleases,
      Math.floor(
        profile.releasePolicy.total.maxBytes / (profile.budget.maxBytes + profile.releasePolicy.cover.maxBytes + profile.releasePolicy.metadata.maxBytes)
      ),
      Math.floor(
        profile.releasePolicy.total.maxTransactions /
          (profile.budget.maxTransactions + profile.releasePolicy.cover.maxTransactions + profile.releasePolicy.metadata.maxTransactions)
      )
    );
    assert.ok(baseCapacity + extensions.length < 64, 'Release extensions exceed capacity bound');
    const writer = await lstat(join(profile.directory, 'writer.lock')).then(
      () => true,
      error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    );
    assert.ok(!writer, 'Writer lock must be absent; never remove it to extend admission');
    const owner = ownerSchema.parse(await load(join(profile.directory, 'owner.json')));
    assert.equal(owner.genesis, profile.genesis);
    assert.equal(owner.account, profile.account);
    assert.equal(owner.activeJob, null, 'Active publication must finish or reconcile first');
    assert.equal(new Set(owner.jobs).size, owner.jobs.length, 'Duplicate publication inventory');
    const ownedFiles = (await readdir(profile.directory)).filter(f => /^stream-.*\.json$/.test(f)).sort();
    assert.deepEqual(ownedFiles, owner.jobs.map(id => `${id}.json`).sort(), 'Orphan or missing publication inventory');
    const inventories: BulletinMediaInventory[] = [];
    for (const id of owner.jobs) {
      const job = jobSchema.parse(await load(join(profile.directory, `${id}.json`)));
      assert.equal(job.job, id);
      assert.equal(job.genesis, profile.genesis);
      assert.equal(job.account, profile.account);
      assert.ok(job.ready && !Object.keys(job.pending).length, 'Unfinished or uncertain publication must reconcile first');
      inventories.push(job);
    }
    await admission.validateInventories(inventories);
    const queue = streamingJobsSchema.parse(await load(join(request.queue, 'jobs.json')));
    assert.ok(
      queue.jobs.every(j => j.state === 'ready'),
      'Unfinished queue must reconcile first'
    );
    assert.equal(new Set(queue.jobs.map(j => j.id)).size, queue.jobs.length, 'Duplicate queue job');
    for (const job of queue.jobs) {
      admission.artistFor(job.scope, job.owner);
      const audio = inventories.find(i => i.job === `stream-${job.id}`);
      assert.ok(audio && audio.job === releaseJob(job.scope, 'audio'), 'Ready queue lacks its publication inventory');
      assert.deepEqual(audio.scope, job.scope, 'Ready queue scope differs from its inventory');
      assert.equal(
        job.ref,
        `dotify:enc:v3:${job.scope.keyVersion.replace('dotify-content-', '')}:ipfs://${audio.root}`,
        'Ready queue reference differs from its inventory'
      );
    }
    // Check the permanent marker, never initialize or rewrite nonce state.
    assert.deepEqual(await load(join(request.queue, 'nonces', 'ledger.json')), { schema: 'dotify.streaming.nonce-ledger.v1' });
    const after = releaseAdmissionLedgerSchema.parse({
      ...before,
      schema: 'dotify.bulletin.release-admission.v2',
      extensions: [
        ...extensions,
        {
          owner: request.owner,
          scope: request.scope,
          previousAdmissionSha256: request.expectedAdmissionSha256
        }
      ]
    });
    const budget = {
      maxBytes: profile.budget.maxBytes + profile.releasePolicy.cover.maxBytes + profile.releasePolicy.metadata.maxBytes,
      maxTransactions: profile.budget.maxTransactions + profile.releasePolicy.cover.maxTransactions + profile.releasePolicy.metadata.maxTransactions
    };
    assert.ok(Number.isSafeInteger(budget.maxBytes) && Number.isSafeInteger(budget.maxTransactions), 'Invalid extension budget');
    if (apply) {
      const archive = admissionArchive(request.expectedAdmissionSha256);
      // Archive first, then one atomic ledger replacement. An archive without
      // a committed extension grants nothing and is safe to inspect/reuse.
      let handle;
      try {
        handle = await open(join(profile.directory, archive), 'wx', 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        assert.deepEqual(await load(join(profile.directory, archive)), before, 'Existing extension archive differs');
      }
      if (handle) {
        try {
          await handle.writeFile(JSON.stringify(before));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await sync(profile.directory);
      }
      await save(profile.directory, 'release-admission.json', after);
      await createReleaseAdmission({
        directory: profile.directory,
        profileSha256: request.expectedProfileSha256,
        policy: profile.releasePolicy,
        audio: profile.budget
      }).validate();
    }
    return {
      schema: 'dotify.bulletin.release-extension-report.v1',
      applied: apply,
      previousAdmissionSha256: request.expectedAdmissionSha256,
      admissionSha256: admissionDigest(after),
      extensions: extensions.length + 1,
      capacity: baseCapacity + extensions.length + 1,
      addedWholeReleaseBudget: budget,
      networkWrites: 0,
      keysChanged: false,
      nonceStateChanged: false
    };
  } finally {
    await unlock?.();
  }
}
