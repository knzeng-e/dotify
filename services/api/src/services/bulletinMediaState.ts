// Versioned private inventory. No transport, content key or signer lives here.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, mkdir, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BULLETIN_GRAPH_MAX, BULLETIN_BLOCK_COUNT_MAX } from './bulletinGraph.js';
import { pipelineSchema } from './bulletinPipeline.js';
import type { BulletinStoreIdentity } from './bulletinMedia.js';

export const jobId = z.string().regex(/^stream-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const budgetSchema = z
  .object({ maxBytes: integer.min(1).max(BULLETIN_GRAPH_MAX * 2), maxTransactions: integer.min(1).max(8192), minimumLifetimeBlocks: integer.min(100) })
  .strict();
export const identitySchema = z.object({ genesis: z.string().regex(/^0x[0-9a-f]{64}$/), account: z.string().min(1).max(128) }).strict();
export const ownerSchema = identitySchema
  .extend({
    schema: z.literal('dotify.bulletin.media-owner.v2'),
    activeJob: jobId.nullable(),
    nextNonce: integer.max(0x100000000).nullable(),
    jobs: z.array(jobId).max(4096)
  })
  .strict();
export const receiptSchema = z
  .object({ cid: z.string(), bytes: integer.min(1), block: integer, index: integer, expiresAt: integer, finalized: z.literal(true) })
  .strict();
export const jobSchema = z
  .object({
    schema: z.literal('dotify.bulletin.media-job.v2'),
    genesis: z.string(),
    account: z.string(),
    job: jobId,
    root: z.string(),
    scope: z.object({ chainId: integer.min(1), runtimeAddress: z.string(), contentHash: z.string(), keyVersion: z.string() }).strict(),
    generation: z.string(),
    blocks: z
      .array(z.object({ cid: z.string(), bytes: integer.min(1) }).strict())
      .min(1)
      .max(BULLETIN_BLOCK_COUNT_MAX),
    budget: budgetSchema,
    attemptedBytes: integer,
    attemptedStores: integer,
    receipts: z.record(receiptSchema),
    pending: z.record(z.object({ nonce: integer.max(0xffffffff), afterBlock: integer }).strict()),
    nextNonce: integer.max(0x100000000).nullable(),
    pipeline: pipelineSchema,
    ready: z.boolean()
  })
  .strict();
export type BulletinMediaInventory = z.infer<typeof jobSchema>;

export async function sync(directory: string) {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function privateDirectory(directory: string) {
  const info = await lstat(directory);
  assert.ok(
    info.isDirectory() && !info.isSymbolicLink() && !(info.mode & 0o077) && info.uid === process.getuid?.(),
    'Bulletin state must be an owned private directory'
  );
}
export async function load(file: string): Promise<unknown> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    assert.ok(
      info.isFile() && info.nlink === 1 && info.size <= 2 * 1024 * 1024 && !(info.mode & 0o077) && info.uid === process.getuid?.(),
      'Invalid Bulletin state file'
    );
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}
export async function save(directory: string, name: string, data: unknown) {
  const temporary = `${name}.${randomUUID()}.tmp`;
  const file = await open(join(directory, temporary), 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(data));
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(join(directory, temporary), join(directory, name));
    await sync(directory);
  } finally {
    await rm(join(directory, temporary), { force: true });
  }
}

/** Explicit first provisioning only; missing custody state is never recreated. */
export async function initializeBulletinMediaStore(directory: string, selected: BulletinStoreIdentity): Promise<void> {
  const identity = identitySchema.parse(selected);
  await mkdir(directory, { mode: 0o700 });
  await privateDirectory(directory);
  await save(directory, 'owner.json', { nextNonce: null, schema: 'dotify.bulletin.media-owner.v2', ...identity, activeJob: null, jobs: [] });
  await sync(join(directory, '..'));
}
