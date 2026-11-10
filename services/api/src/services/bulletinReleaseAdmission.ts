// Durable storage admission, not listening authority or an on-chain reservation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { budgetSchema, integer, jobId, load, privateDirectory, save, sync, type BulletinMediaInventory } from './bulletinMediaState.js';
import { PublicationAdmissionError } from './publicationAdmission.js';
import type { StreamingScope } from './streamingFormat.js';

const address = z.string().regex(/^0x[0-9a-f]{40}$/);
const keyVersion = z
  .string()
  .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
  .max(80);
const artistSchema = z.object({ owner: address, chainId: integer.min(1), runtimeAddress: address, keyVersion }).strict();
export const releaseScopeSchema = artistSchema
  .omit({ owner: true })
  .extend({ contentHash: z.string().regex(/^0x[0-9a-f]{64}$/) })
  .strict();
export const releasePolicySchema = z
  .object({
    schema: z.literal('dotify.bulletin.release-policy.v1'),
    artists: z.array(artistSchema).min(1).max(16),
    maxReleases: integer.min(1).max(64),
    cover: budgetSchema,
    metadata: budgetSchema,
    total: z.object({ maxBytes: integer.min(1), maxTransactions: integer.min(1) }).strict()
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.artists.map(a => `${a.chainId}:${a.runtimeAddress}:${a.keyVersion}`);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Duplicate release artist scope' });
  });
export type ReleasePolicy = z.infer<typeof releasePolicySchema>;
export type ReleasePart = 'audio' | 'cover' | 'metadata';
const entrySchema = z
  .object({
    scope: releaseScopeSchema,
    audio: jobId.optional(),
    cover: jobId.optional(),
    metadata: jobId.optional()
  })
  .strict();
const legacyLedgerSchema = z
  .object({
    schema: z.literal('dotify.bulletin.release-admission.v1'),
    profileSha256: z.string().regex(/^[0-9a-f]{64}$/),
    releases: z.array(entrySchema).max(64)
  })
  .strict();
export const admissionExtensionSchema = z
  .object({
    owner: address,
    scope: releaseScopeSchema,
    previousAdmissionSha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict();
export const releaseAdmissionLedgerSchema = z.discriminatedUnion('schema', [
  legacyLedgerSchema,
  legacyLedgerSchema
    .extend({ schema: z.literal('dotify.bulletin.release-admission.v2'), extensions: z.array(admissionExtensionSchema).min(1).max(63) })
    .strict()
]);
export type ReleaseAdmissionLedger = z.infer<typeof releaseAdmissionLedgerSchema>;
export const admissionExtensions = (state: ReleaseAdmissionLedger) => ('extensions' in state ? state.extensions : []);
// A normalized JSON digest binds the reviewed checkpoint without trusting file whitespace.
export const admissionDigest = (state: ReleaseAdmissionLedger) => createHash('sha256').update(JSON.stringify(state)).digest('hex');
export const admissionArchive = (digest: string) => {
  assert.match(digest, /^[0-9a-f]{64}$/);
  return `admission-before-${digest}.json`;
};
const FILE = 'release-admission.json';
export const releaseIdentity = (input: StreamingScope): string => {
  const s = releaseScopeSchema.parse(input);
  return createHash('sha256')
    .update(JSON.stringify([s.chainId, s.runtimeAddress, s.contentHash, s.keyVersion]))
    .digest('hex');
};
export function releaseJob(scope: StreamingScope, part: ReleasePart, root = ''): string {
  const bytes = createHash('sha256')
    .update(`dotify-release-v1:${releaseIdentity(scope)}:${part}:${root}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex');
  return `stream-${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Only called by fresh-state provisioning. Startup must never recreate this file. */
export async function initializeReleaseAdmission(directory: string, profileSha256: string) {
  await privateDirectory(directory);
  const state = releaseAdmissionLedgerSchema.parse({ schema: 'dotify.bulletin.release-admission.v1', profileSha256, releases: [] });
  const file = await open(join(directory, FILE), 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(state));
    await file.sync();
  } finally {
    await file.close();
  }
  await sync(directory);
}

/** The owning publisher lifetime lease excludes other processes. This local tail
 * also serializes audio admission with cover/metadata claims in this process. */
export function createReleaseAdmission(input: { directory: string; profileSha256: string; policy: ReleasePolicy; audio: z.infer<typeof budgetSchema> }) {
  const policy = releasePolicySchema.parse(input.policy);
  const perRelease = {
    bytes: input.audio.maxBytes + policy.cover.maxBytes + policy.metadata.maxBytes,
    transactions: input.audio.maxTransactions + policy.cover.maxTransactions + policy.metadata.maxTransactions
  };
  const allowedCount = Math.min(
    policy.maxReleases,
    Math.floor(policy.total.maxBytes / perRelease.bytes),
    Math.floor(policy.total.maxTransactions / perRelease.transactions)
  );
  assert.ok(
    Number.isSafeInteger(perRelease.bytes) && Number.isSafeInteger(perRelease.transactions) && allowedCount > 0,
    'Release policy cannot reserve a complete release'
  );
  let tail: Promise<unknown> = Promise.resolve();
  const artistFor = (scope: StreamingScope, owner?: string) => {
    releaseScopeSchema.parse(scope);
    const artist = policy.artists.find(a => a.chainId === scope.chainId && a.runtimeAddress === scope.runtimeAddress && a.keyVersion === scope.keyVersion);
    if (!artist || (owner !== undefined && artist.owner !== owner.toLowerCase())) throw new PublicationAdmissionError();
    return artist;
  };
  let expectedExtensions: string | undefined;
  const read = async () => {
    await privateDirectory(input.directory);
    const state = releaseAdmissionLedgerSchema.parse(await load(join(input.directory, FILE)));
    assert.equal(state.profileSha256, input.profileSha256, 'Release admission profile changed');
    const ids = state.releases.map(e => releaseIdentity(e.scope));
    assert.equal(new Set(ids).size, ids.length, 'Duplicate release admission');
    const extensions = admissionExtensions(state);
    const extensionIds = extensions.map(e => releaseIdentity(e.scope));
    assert.equal(new Set(extensionIds).size, extensionIds.length, 'Duplicate release extension');
    assert.ok(allowedCount + extensions.length <= 64, 'Release extensions exceed capacity bound');
    const observedExtensions = JSON.stringify(extensions);
    if (expectedExtensions !== undefined)
      assert.equal(observedExtensions, expectedExtensions, 'Release extensions changed; restart after reviewed maintenance');
    for (const [index, extension] of extensions.entries()) {
      artistFor(extension.scope, extension.owner);
      const previous = releaseAdmissionLedgerSchema.parse(await load(join(input.directory, admissionArchive(extension.previousAdmissionSha256))));
      assert.equal(admissionDigest(previous), extension.previousAdmissionSha256, 'Release extension archive changed');
      assert.equal(previous.profileSha256, input.profileSha256, 'Release extension profile changed');
      assert.deepEqual(admissionExtensions(previous), extensions.slice(0, index), 'Release extension history changed');
      assert.ok(!previous.releases.some(e => releaseIdentity(e.scope) === extensionIds[index]), 'Extension cannot refund an existing release');
      for (const entry of previous.releases) {
        const retained = state.releases.find(e => releaseIdentity(e.scope) === releaseIdentity(entry.scope));
        assert.ok(retained, 'Release extension lost a prior reservation');
        assert.deepEqual(retained.scope, entry.scope, 'Release extension changed a prior scope');
        for (const part of ['audio', 'cover', 'metadata'] as const)
          if (entry[part]) assert.equal(retained[part], entry[part], 'Release extension changed a prior claim');
      }
    }
    assert.ok(state.releases.filter(e => !extensionIds.includes(releaseIdentity(e.scope))).length <= allowedCount, 'Release admission exceeds aggregate cap');
    assert.ok(state.releases.length <= allowedCount + extensions.length, 'Release admission exceeds aggregate cap');
    const jobs = state.releases.flatMap(e => [e.audio, e.cover, e.metadata].filter((j): j is string => Boolean(j)));
    assert.equal(new Set(jobs).size, jobs.length, 'Duplicate release job claim');
    for (const entry of state.releases) {
      artistFor(entry.scope);
      if (entry.audio) assert.equal(entry.audio, releaseJob(entry.scope, 'audio'), 'Audio admission identity changed');
    }
    expectedExtensions ??= observedExtensions;
    return state;
  };
  // A replaced file can have nlink=0 between open() and stat(). Keep strict
  // file validation; serialize every public snapshot with atomic claim writes.
  // claim() already holds this tail and therefore calls read() directly.
  const snapshot = () => {
    const task = tail.then(read);
    tail = task.catch(() => undefined);
    return task;
  };
  const check = async (scope: StreamingScope, owner?: string) => {
    artistFor(scope, owner);
    const state = await snapshot();
    const entry = state.releases.find(e => releaseIdentity(e.scope) === releaseIdentity(scope));
    const extended = new Set(admissionExtensions(state).map(e => releaseIdentity(e.scope)));
    if (!entry && !extended.has(releaseIdentity(scope)) && state.releases.filter(e => !extended.has(releaseIdentity(e.scope))).length >= allowedCount)
      throw new PublicationAdmissionError();
  };
  return {
    check,
    validate: snapshot,
    artistFor,
    async validateInventories(jobs: BulletinMediaInventory[]) {
      const state = await snapshot();
      assert.ok(jobs.length <= (allowedCount + admissionExtensions(state).length) * 3, 'Too many release inventories');
      for (const job of jobs) {
        const entry = state.releases.find(e => releaseIdentity(e.scope) === releaseIdentity(job.scope));
        const part: ReleasePart = job.generation === 'public-cover-v1' ? 'cover' : job.generation === 'public-metadata-v1' ? 'metadata' : 'audio';
        assert.ok(entry && entry[part] === job.job, 'Publication inventory lacks its durable release claim');
        assert.equal(job.job, releaseJob(job.scope, part, part === 'audio' ? '' : job.root), 'Release inventory job changed');
        assert.deepEqual(job.budget, part === 'audio' ? input.audio : policy[part], 'Release inventory allowance changed');
        assert.ok(
          job.blocks.length <= job.budget.maxTransactions &&
            job.blocks.reduce((sum, block) => sum + block.bytes, 0) <= job.budget.maxBytes &&
            job.attemptedStores <= job.budget.maxTransactions &&
            job.attemptedBytes <= job.budget.maxBytes,
          'Release inventory exceeds its allowance'
        );
      }
    },
    async claim(scope: StreamingScope, part: ReleasePart, root = '', owner?: string) {
      const task = tail.then(async () => {
        artistFor(scope, owner);
        const state = await read();
        let entry = state.releases.find(e => releaseIdentity(e.scope) === releaseIdentity(scope));
        if (!entry) {
          const extended = new Set(admissionExtensions(state).map(e => releaseIdentity(e.scope)));
          if (!extended.has(releaseIdentity(scope)) && state.releases.filter(e => !extended.has(releaseIdentity(e.scope))).length >= allowedCount)
            throw new PublicationAdmissionError();
          entry = { scope: releaseScopeSchema.parse(scope) };
          state.releases.push(entry);
        }
        const name = releaseJob(scope, part, root);
        if (entry[part] && entry[part] !== name) throw new PublicationAdmissionError();
        if (entry[part]) return name;
        entry[part] = name;
        // The whole release allowance remains charged, even if nothing is stored
        // or a queue entry is later pruned. There is deliberately no refund/reset.
        await save(input.directory, FILE, state);
        return name;
      });
      tail = task.catch(() => undefined);
      return task;
    }
  };
}
