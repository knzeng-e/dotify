// Explicit operator configuration and fresh-state provisioning. No credentials,
// network access, directory repair or account selection happen here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { BULLETIN_MEDIA_GENESIS, validBulletinMediaRpc } from './bulletinHttpReader.js';
import { budgetSchema, initializeBulletinMediaStore, integer, load, privateDirectory, save } from './bulletinMediaState.js';
import { pipelineSchema } from './bulletinPipeline.js';
import { initializeStreamingJobs } from './streamingJobs.js';
const absolute = z.string().refine(isAbsolute);
// A one-release operator pilot, not an alternative source of access authority.
const pilotScope = z
  .object({
    chainId: integer.min(1),
    runtimeAddress: z.string().regex(/^0x[0-9a-f]{40}$/),
    contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    keyVersion: z
      .string()
      .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      .max(80)
  })
  .strict();
export const publisherProfileSchema = z
  .object({
    schema: z.literal('dotify.bulletin.publisher.v1'),
    genesis: z.literal(BULLETIN_MEDIA_GENESIS),
    endpoint: z.string().refine(value => value.startsWith('wss://') && validBulletinMediaRpc(value.replace(/^wss:/, 'https:'))),
    account: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{47,50}$/),
    directory: absolute,
    seedFile: absolute,
    budget: budgetSchema,
    pipeline: pipelineSchema,
    // Operator-declared obligations outside this publisher's own inventories.
    priorRenewalReserve: z.object({ transactions: integer, bytes: integer }).strict(),
    // When present, the immutable profile admits this scope and one durable job
    // for its entire lifetime, including after restart/discard/completion.
    pilotScope: pilotScope.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (resolve(value.seedFile).startsWith(`${resolve(value.directory)}/`) || resolve(value.seedFile) === resolve(value.directory))
      ctx.addIssue({ code: 'custom', message: 'Keep the signing key separate from publication inventories' });
  });
export type BulletinPublisherProfile = z.infer<typeof publisherProfileSchema>;
export async function readBulletinPublisherProfile(file: string) {
  assert.ok(isAbsolute(file), 'Absolute publication profile path required');
  await privateDirectory(resolve(file, '..'));
  return publisherProfileSchema.parse(await load(file));
}
export const publicationBinding = (input: BulletinPublisherProfile) => ({
  schema: 'dotify.streaming.publication-binding.v1',
  provider: 'bulletin',
  profileSha256: createHash('sha256')
    .update(JSON.stringify(publisherProfileSchema.parse(input)))
    .digest('hex')
});
export async function assertPublicationBinding(queue: string, profile?: BulletinPublisherProfile) {
  const file = join(queue, 'publication-store.json');
  if (profile) {
    assert.notEqual(resolve(queue), resolve(profile.directory), 'Queue and publication inventories must be separate');
    assert.deepEqual(await load(file), publicationBinding(profile), 'Streaming publication profile changed');
    assert.deepEqual(await load(join(profile.directory, 'publisher.json')), publicationBinding(profile), 'Bulletin publication profile changed');
  } else {
    try {
      await load(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    throw new Error('A Bulletin queue cannot be opened with Pinata');
  }
}
export async function initializeBulletinPublisher(queue: string, input: BulletinPublisherProfile) {
  const profile = publisherProfileSchema.parse(input);
  assert.ok(isAbsolute(queue), 'Absolute fresh queue path required');
  assert.notEqual(resolve(queue), resolve(profile.directory), 'Queue and inventories must be separate');
  // Both initializers use exclusive creation. A partial operation remains a
  // visible provisioning failure, never an invitation to recreate lost state.
  await initializeBulletinMediaStore(profile.directory, { genesis: profile.genesis, account: profile.account });
  await initializeStreamingJobs(queue);
  await save(profile.directory, 'publisher.json', publicationBinding(profile));
  await save(queue, 'publication-store.json', publicationBinding(profile));
}
