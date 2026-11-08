// Explicit offline staging only: old state stays intact and no runtime selector
// is changed. An exact inspected hash binds the source bytes and proposed cap.
import assert from 'node:assert/strict';
import { mkdir, readdir, lstat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import {
  assertPublicationBinding,
  initializeBulletinPublisher,
  publicationBinding,
  publisherProfileSchema,
  readBulletinPublisherProfile
} from './bulletinPublisherProfile.js';
import { integer, jobSchema, load, ownerSchema, save, sync } from './bulletinMediaState.js';
import { streamingJobsSchema } from './streamingJobs.js';
import { createReleaseAdmission } from './bulletinReleaseAdmission.js';
import { nonceHistoryHash } from './streamingNonceHistory.js';
import { canonicalPrivate, copySnapshot, exclusiveBytes, privateSnapshotBytes, sha256, snapshotTree, type SnapshotEntry } from './bulletinMigrationSnapshot.js';
const absolute = z.string().refine(p => isAbsolute(p) && resolve(p) === p);
const reserve = z.object({ transactions: integer, bytes: integer }).strict();
export const generationMigrationSchema = z
  .object({
    schema: z.literal('dotify.bulletin.generation-migration.v1'),
    sources: z
      .array(z.object({ profileFile: absolute, queue: absolute }).strict())
      .min(1)
      .max(32),
    // Include pre-Bulletin and discarded/retired queues using the same content keys.
    additionalNonceQueues: z.array(absolute).max(32),
    externalRenewalReserve: reserve,
    destination: absolute,
    targetProfile: publisherProfileSchema
  })
  .strict();
const marker = { schema: 'dotify.streaming.nonce-ledger.v1' };
const fingerprint = /^[0-9a-f]{64}$/;
const generation = /^[0-9a-f]{16}\.json$/;
const absent = async (file: string) => {
  await lstat(file).then(
    () => {
      throw new Error('Fresh absent migration destination required');
    },
    e => {
      if (e.code !== 'ENOENT') throw e;
    }
  );
};
async function nonceReservations(queue: string) {
  const directory = join(queue, 'nonces');
  await canonicalPrivate(directory);
  assert.deepEqual(await load(join(directory, 'ledger.json')), marker, 'Nonce marker missing or changed');
  const reservations = new Map<string, Buffer>();
  for (const key of (await readdir(directory)).sort()) {
    if (key === 'ledger.json') continue;
    assert.match(key, fingerprint, 'Invalid nonce fingerprint');
    await canonicalPrivate(join(directory, key));
    for (const name of (await readdir(join(directory, key))).sort()) {
      assert.match(name, generation, 'Invalid nonce generation');
      const file = join(directory, key, name),
        bytes = await privateSnapshotBytes(file);
      assert.deepEqual(JSON.parse(bytes.toString()), { ...marker, fingerprint: key, generation: name.slice(0, 16) }, 'Invalid nonce reservation');
      reservations.set(`${key}/${name}`, bytes);
    }
  }
  return reservations;
}
export async function inspectGenerationMigration(input: unknown) {
  const request = generationMigrationSchema.parse(input),
    profile = request.targetProfile;
  assert.ok(!profile.nonceHistorySha256, 'Migration derives its nonce baseline; do not supply one');
  assert.ok(profile.releasePolicy && !profile.pilotScope, 'Fresh multi-release target required');
  assert.equal(profile.directory, join(request.destination, 'next', 'publications'), 'Target inventories must be inside new package');
  assert.ok(!profile.seedFile.startsWith(`${request.destination}/`), 'Keep installed signer outside package');
  await canonicalPrivate(dirname(request.destination));
  await absent(request.destination);
  const roots: string[] = [],
    snapshots: Array<{ source: string; archive: string; entries: SnapshotEntry[] }> = [];
  const addTree = async (source: string, archive: string) => {
    assert.ok(!roots.some(p => p === source || source.startsWith(`${p}/`) || p.startsWith(`${source}/`)), 'Duplicate/overlapping source roots');
    assert.ok(!source.startsWith(`${request.destination}/`) && !request.destination.startsWith(`${source}/`), 'Source/destination overlap');
    assert.ok(profile.seedFile !== source && !profile.seedFile.startsWith(`${source}/`), 'Signer must be outside snapshot roots');
    roots.push(source);
    const entries = await snapshotTree(source);
    snapshots.push({ source, archive, entries });
    snapshotBytes += entries.reduce((n, entry) => n + entry.bytes, 0);
    snapshotEntries += entries.length;
    assert.ok(snapshotBytes <= 1024 ** 3 && snapshotEntries <= 6000, 'Combined migration snapshot bound exceeded');
    return entries;
  };
  let snapshotBytes = 0,
    snapshotEntries = 0;
  const nonces = new Map<string, Buffer>();
  const mergeNonces = async (queue: string) => {
    for (const [name, bytes] of await nonceReservations(queue)) {
      const old = nonces.get(name);
      assert.ok(!old || old.equals(bytes), 'Conflicting permanent nonce reservation');
      nonces.set(name, bytes);
    }
  };
  const requiredReserve = { ...request.externalRenewalReserve };
  let nextNonce: number | null = null,
    attemptedStores = 0,
    attemptedBytes = 0,
    incompleteInventories = 0;
  const sourceProfiles: Buffer[] = [];
  for (const [index, source] of request.sources.entries()) {
    assert.notEqual(source.profileFile, profile.seedFile, 'Profile cannot be signer');
    await canonicalPrivate(dirname(source.profileFile));
    const raw = await privateSnapshotBytes(source.profileFile),
      old = await readBulletinPublisherProfile(source.profileFile);
    sourceProfiles.push(raw);
    assert.equal(old.genesis, profile.genesis, 'Source network differs');
    assert.equal(old.account, profile.account, 'Source account differs');
    assert.equal(old.seedFile, profile.seedFile, 'Installed signer location changed');
    const queueEntries = await addTree(source.queue, `history/${index}/queue`);
    const publicationEntries = await addTree(old.directory, `history/${index}/publications`);
    assert.ok(!roots.some(p => old.seedFile === p || old.seedFile.startsWith(`${p}/`)), 'Signer must be outside snapshot roots');
    await assertPublicationBinding(source.queue, old);
    const queue = streamingJobsSchema.parse(await load(join(source.queue, 'jobs.json')));
    assert.ok(
      queue.jobs.every(j => ['ready', 'failed', 'expired'].includes(j.state)),
      'Quiesce queued/active preparation first'
    );
    const owner = ownerSchema.parse(await load(join(old.directory, 'owner.json')));
    assert.equal(owner.genesis, profile.genesis);
    assert.equal(owner.account, profile.account);
    assert.equal(owner.activeJob, null, 'Unresolved account barrier requires reconciliation');
    assert.equal(new Set(owner.jobs).size, owner.jobs.length, 'Duplicate inventory ownership');
    const listed = publicationEntries
      .filter(e => /^stream-.*\.json$/.test(e.path))
      .map(e => e.path.slice(0, -5))
      .sort();
    assert.deepEqual(listed, [...owner.jobs].sort(), 'Missing/orphaned publication inventory');
    nextNonce = owner.nextNonce === null ? nextNonce : Math.max(nextNonce ?? 0, owner.nextNonce);
    // Sum is deliberately conservative: declared old floors may overlap each
    // other or graphs. Never deduct a known obligation based on that assumption.
    requiredReserve.transactions += old.priorRenewalReserve.transactions;
    requiredReserve.bytes += old.priorRenewalReserve.bytes;
    const inventories = [];
    for (const name of owner.jobs) {
      const job = jobSchema.parse(await load(join(old.directory, `${name}.json`)));
      assert.equal(job.job, name);
      assert.equal(job.account, profile.account);
      assert.equal(job.genesis, profile.genesis);
      assert.equal(Object.keys(job.pending).length, 0, 'Pending submission requires reconciliation');
      assert.ok(job.nextNonce === null || (owner.nextNonce !== null && job.nextNonce <= owner.nextNonce), 'Invalid account nonce cursor');
      assert.ok(job.attemptedStores <= job.budget.maxTransactions && job.attemptedBytes <= job.budget.maxBytes, 'Invalid attempted-store history');
      const blocks = new Map(job.blocks.map(b => [b.cid, b.bytes]));
      assert.equal(blocks.size, job.blocks.length, 'Duplicate inventory block');
      for (const [cid, receipt] of Object.entries(job.receipts))
        assert.ok(cid === receipt.cid && blocks.get(cid) === receipt.bytes, 'Invalid retained receipt');
      if (job.ready) assert.equal(Object.keys(job.receipts).length, blocks.size, 'Ready inventory has missing receipts');
      if (!job.ready) incompleteInventories++;
      attemptedStores += job.attemptedStores;
      attemptedBytes += job.attemptedBytes;
      if (job.ready || job.attemptedStores || Object.keys(job.receipts).length) {
        requiredReserve.transactions += job.blocks.length;
        requiredReserve.bytes += job.blocks.reduce((n, b) => n + b.bytes, 0);
      }
      inventories.push(job);
    }
    if (old.releasePolicy)
      await createReleaseAdmission({
        directory: old.directory,
        policy: old.releasePolicy,
        audio: old.budget,
        profileSha256: publicationBinding(old).profileSha256
      }).validateInventories(inventories);
    assert.ok(
      queueEntries.some(e => e.path === 'nonces/ledger.json'),
      'Missing permanent nonce history'
    );
    await mergeNonces(source.queue);
    for (const job of queue.jobs)
      assert.ok(
        [...nonces.keys()].some(name => name.endsWith(`/${job.sourceGeneration}.json`)),
        'Saved source generation lacks permanent reservation'
      );
  }
  for (const [index, queue] of request.additionalNonceQueues.entries()) {
    await addTree(queue, `nonce-history/${index}`);
    const oldQueue = streamingJobsSchema.parse(await load(join(queue, 'jobs.json')));
    assert.ok(
      oldQueue.jobs.every(j => ['ready', 'failed', 'expired'].includes(j.state)),
      'Quiesce additional queue first'
    );
    await mergeNonces(queue);
  }
  for (const value of [...Object.values(requiredReserve), attemptedStores, attemptedBytes])
    assert.ok(Number.isSafeInteger(value), 'Migration accounting overflow');
  assert.ok(
    profile.priorRenewalReserve.transactions >= requiredReserve.transactions && profile.priorRenewalReserve.bytes >= requiredReserve.bytes,
    'Target lowers carried renewal obligations'
  );
  const reservationHashes = [...nonces].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, sha256(bytes)]);
  assert.ok(snapshotEntries + nonces.size * 2 + 256 <= 8192, 'Candidate file bound exceeded');
  const nonceHistory = {
    schema: 'dotify.streaming.nonce-history.v1' as const,
    reservations: [...nonces]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, bytes]) => ({ path, sha256: sha256(JSON.stringify(JSON.parse(bytes.toString()))) }))
  };
  const targetProfile = publisherProfileSchema.parse({ ...profile, nonceHistorySha256: nonceHistoryHash(nonceHistory) });
  const report = {
    schema: 'dotify.bulletin.generation-inspection.v1',
    sourceCount: request.sources.length,
    nonceReservations: nonces.size,
    nextNonce,
    attemptedStores,
    attemptedBytes,
    incompleteInventories,
    requiredReserve,
    targetProfileSha256: publicationBinding(targetProfile).profileSha256,
    // This digest is a change detector for a trusted local review, not a signature.
    planSha256: sha256(JSON.stringify({ request, snapshots, sourceProfiles: sourceProfiles.map(sha256), reservationHashes })),
    scope: 'declared-sources',
    contentAuthenticationTested: false,
    offVolumeRestoreTested: false,
    networkWrites: 0,
    activationReady: false
  };
  return { request, report, snapshots, sourceProfiles, nonces, nonceHistory, targetProfile };
}
export async function stageGenerationMigration(input: unknown, inspectedSha256: string) {
  assert.match(inspectedSha256, /^[0-9a-f]{64}$/);
  const prepared = await inspectGenerationMigration(input);
  assert.equal(prepared.report.planSha256, inspectedSha256, 'Migration plan changed; inspect again');
  const { request, snapshots, sourceProfiles, nonces, report, nonceHistory, targetProfile } = prepared;
  await mkdir(request.destination, { mode: 0o700 }); // Exclusive; never clean up a partial candidate automatically.
  await mkdir(join(request.destination, 'history'), { mode: 0o700 });
  for (let i = 0; i < request.sources.length; i++) {
    const directory = join(request.destination, 'history', String(i));
    await mkdir(directory, { mode: 0o700 });
    await exclusiveBytes(join(directory, 'profile.json'), sourceProfiles[i]);
  }
  await mkdir(join(request.destination, 'nonce-history'), { mode: 0o700 });
  for (const snapshot of snapshots) await copySnapshot(snapshot.source, join(request.destination, snapshot.archive), snapshot.entries);
  const next = join(request.destination, 'next');
  await mkdir(next, { mode: 0o700 });
  await initializeBulletinPublisher(join(next, 'queue'), targetProfile);
  for (const [name, bytes] of nonces) {
    const directory = join(next, 'queue', 'nonces', name.split('/')[0]);
    await mkdir(directory, { mode: 0o700, recursive: true });
    await exclusiveBytes(join(next, 'queue', 'nonces', name), bytes);
  }
  await sync(join(next, 'queue', 'nonces'));
  const owner = ownerSchema.parse(await load(join(targetProfile.directory, 'owner.json')));
  await save(targetProfile.directory, 'owner.json', { ...owner, nextNonce: report.nextNonce });
  await exclusiveBytes(join(next, 'profile.json'), Buffer.from(JSON.stringify(targetProfile)));
  for (const snapshot of snapshots) assert.deepEqual(await snapshotTree(snapshot.source), snapshot.entries, 'Source changed during staging');
  for (const [index, source] of request.sources.entries())
    assert.ok((await privateSnapshotBytes(source.profileFile)).equals(sourceProfiles[index]), 'Source profile changed during staging');
  // Publish the boot-required baseline only after all copied history and source
  // bytes have been rechecked. An earlier partial target fails before signer.
  await exclusiveBytes(join(next, 'queue', 'nonce-history.json'), Buffer.from(JSON.stringify(nonceHistory)));
  await exclusiveBytes(join(request.destination, 'inspection.json'), Buffer.from(JSON.stringify(report)));
  const entries = await snapshotTree(request.destination);
  const completion = Buffer.from(JSON.stringify({ schema: 'dotify.bulletin.generation-package.v1', planSha256: inspectedSha256, entries }));
  await exclusiveBytes(join(request.destination, 'complete.json'), completion);
  await sync(dirname(request.destination));
  return { ...report, packageSha256: sha256(completion) };
}
export async function verifyGenerationPackage(directory: string, expectedPackageSha256?: string) {
  await canonicalPrivate(directory);
  const bytes = await privateSnapshotBytes(join(directory, 'complete.json'));
  if (expectedPackageSha256 !== undefined) {
    assert.match(expectedPackageSha256, /^[0-9a-f]{64}$/);
    assert.equal(sha256(bytes), expectedPackageSha256, 'Package differs from trusted review digest');
  }
  const complete = z
    .object({
      schema: z.literal('dotify.bulletin.generation-package.v1'),
      planSha256: z.string().regex(/^[0-9a-f]{64}$/),
      entries: z
        .array(
          z
            .object({
              path: z.string(),
              bytes: integer,
              sha256: z
                .string()
                .regex(/^[0-9a-f]{64}$/)
                .nullable()
            })
            .strict()
        )
        .max(8192)
    })
    .strict()
    .parse(JSON.parse(bytes.toString()));
  const entries = (await snapshotTree(directory)).filter(e => e.path !== 'complete.json');
  assert.deepEqual(entries, complete.entries, 'Candidate package missing/changed state');
  return {
    schema: complete.schema,
    packageSha256: sha256(bytes),
    trustedDigestMatched: expectedPackageSha256 !== undefined,
    planSha256: complete.planSha256,
    verifiedFiles: entries.filter(e => e.sha256 !== null).length,
    activationReady: false,
    networkWrites: 0
  };
}
