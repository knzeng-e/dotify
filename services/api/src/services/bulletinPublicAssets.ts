// Public files only. Shares the audio publisher's nonce journal and signer.
import assert from 'node:assert/strict';
import { dotifyManifestSchema } from './releaseManifest.js';
import { createHash } from 'node:crypto';
import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { budgetSchema, load, privateDirectory, sync } from './bulletinMediaState.js';
import { publicationBinding, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { buildBulletinDirectoryGraph, readBulletinDirectoryPath, type BulletinGraph } from './bulletinGraph.js';
import { detectImageMedia } from './mediaValidation.js';
import type { PinataFile } from './pinata.js';
export class PublicAssetStorageError extends Error {
  constructor() {
    super('Public asset storage needs operator attention');
  }
}
export type PublicAssetKind = 'cover' | 'metadata';
export type PublicAssetOwner = { address: string; runtimeAddress: string; chainId: number };
export const publicAssetPolicySchema = z
  .object({
    schema: z.literal('dotify.bulletin.public-assets.v1'),
    owner: z.string().regex(/^0x[0-9a-f]{40}$/),
    // An explicit one-release pilot. It does not open storage to arbitrary artists.
    scope: z
      .object({
        chainId: z.number().int().positive(),
        runtimeAddress: z.string().regex(/^0x[0-9a-f]{40}$/),
        contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
        keyVersion: z.string().regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      })
      .strict(),
    cover: budgetSchema,
    metadata: budgetSchema
  })
  .strict();
export type PublicAssetPolicy = z.infer<typeof publicAssetPolicySchema>;
export const publicAssetGeneration = (kind: PublicAssetKind) => `public-${kind}-v1`;
export const isPublicAssetGeneration = (value: string) => value === publicAssetGeneration('cover') || value === publicAssetGeneration('metadata');
const binding = (profile: BulletinPublisherProfile, policy: PublicAssetPolicy) => ({ ...publicationBinding(profile), policy });
export async function readPublicAssetPolicy(file: string, profile: BulletinPublisherProfile): Promise<PublicAssetPolicy> {
  assert.ok(file.startsWith('/'), 'Absolute public asset policy required');
  const policy = publicAssetPolicySchema.parse(await load(file));
  if (profile.pilotScope) assert.deepEqual(policy.scope, profile.pilotScope, 'Asset scope differs from audio pilot');
  assert.deepEqual(await load(join(profile.directory, 'public-assets.json')), binding(profile, policy), 'Public asset policy changed or was not initialized');
  return policy;
}
/** Explicit additive provisioning. Never rewrites the audio binding or queues. */
export async function initializePublicAssetPolicy(profile: BulletinPublisherProfile, input: PublicAssetPolicy) {
  const policy = publicAssetPolicySchema.parse(input);
  if (profile.pilotScope) assert.deepEqual(policy.scope, profile.pilotScope, 'Asset scope differs from audio pilot');
  await privateDirectory(profile.directory);
  assert.deepEqual(await load(join(profile.directory, 'publisher.json')), publicationBinding(profile), 'Publisher binding differs');
  const lock = await open(join(profile.directory, 'publisher.lock'), 'wx', 0o600);
  try {
    const file = await open(join(profile.directory, 'public-assets.json'), 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(binding(profile, policy)));
      await file.sync();
    } finally {
      await file.close();
    }
    await sync(profile.directory);
  } finally {
    await lock.close();
    await rm(join(profile.directory, 'publisher.lock'));
    await sync(profile.directory);
  }
}
export function assertPublicAssetOwner(policy: PublicAssetPolicy, owner: PublicAssetOwner) {
  assert.ok(
    owner.address.toLowerCase() === policy.owner &&
      owner.runtimeAddress.toLowerCase() === policy.scope.runtimeAddress &&
      owner.chainId === policy.scope.chainId,
    'Public asset is outside the approved pilot'
  );
}
export function publicAssetPath(path: string): { kind: PublicAssetKind; maxBytes: number; mime?: string } | null {
  if (path === 'release.json') return { kind: 'metadata', maxBytes: 50 * 1024, mime: 'application/json' };
  if (/^cover\/(?:placeholder|64|160|320|640)\.webp$/.test(path)) return { kind: 'cover', maxBytes: 1024 * 1024, mime: 'image/webp' };
  if (/^cover\/original\.(?:jpg|png|webp|gif)$/.test(path)) return { kind: 'cover', maxBytes: 5 * 1024 * 1024 };
  return null;
}
export async function buildPublicAssetGraph(
  files: PinataFile[],
  kind: PublicAssetKind,
  policy: PublicAssetPolicy,
  signal: AbortSignal
): Promise<BulletinGraph> {
  const expected = kind === 'metadata' ? ['release.json'] : ['cover/placeholder.webp', 'cover/64.webp', 'cover/160.webp', 'cover/320.webp', 'cover/640.webp'];
  assert.equal(files.length, kind === 'metadata' ? 1 : 6, 'Invalid public asset file count');
  assert.ok(
    expected.every(path => files.some(file => file.path === path)),
    'Public asset layout missing'
  );
  let total = 0;
  for (const file of files) {
    const limits = publicAssetPath(file.path);
    assert.ok(limits?.kind === kind && file.bytes.length > 0 && file.bytes.length <= limits.maxBytes, 'Invalid public asset path or size');
    if (kind === 'cover') {
      const image = detectImageMedia(file.bytes);
      assert.ok(image && (!limits.mime || image.mime === limits.mime), 'Public artwork is not a supported image');
      if (!limits.mime) assert.equal(file.path.split('.').pop(), image.extension, 'Original artwork extension differs');
    }
    total += file.bytes.length;
  }
  assert.ok(total <= policy[kind].maxBytes, 'Public asset exceeds approved byte cap');
  if (kind === 'metadata') {
    const manifest = dotifyManifestSchema.parse(JSON.parse(Buffer.from(files[0].bytes).toString('utf8')));
    assert.equal(manifest.track.contentHash.toLowerCase(), policy.scope.contentHash, 'Metadata is outside the approved release');
  }
  const graph = await buildBulletinDirectoryGraph(files, signal);
  assert.ok(graph.bytes <= policy[kind].maxBytes && graph.blocks.length <= policy[kind].maxTransactions, 'Public asset graph exceeds approved cap');
  return { ...graph, scope: policy.scope, generation: publicAssetGeneration(kind) };
}
export function publicAssetJob(kind: PublicAssetKind, root: string): string {
  const hex = createHash('sha256').update(`dotify-public-asset-v1:${kind}:${root}`).digest('hex').slice(0, 32);
  return `stream-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function readPublicAsset(read: (cid: string, signal: AbortSignal) => Promise<Uint8Array>, root: string, path: string, signal: AbortSignal) {
  const limits = publicAssetPath(path);
  assert.ok(limits, 'Unsupported public asset path');
  const bytes = await readBulletinDirectoryPath(read, root, path, limits.maxBytes, signal, 64);
  if (limits.kind === 'cover') {
    const image = detectImageMedia(bytes);
    assert.ok(image && (!limits.mime || image.mime === limits.mime), 'Invalid public artwork');
    return { bytes, mime: image.mime };
  }
  // Public metadata never contains content keys or a protected audio object.
  dotifyManifestSchema.parse(JSON.parse(bytes.toString('utf8')));
  return { bytes, mime: 'application/json' };
}

/** Keep the first metadata bytes for response-loss recovery. The client currently
 * rebuilds createdAt on retry; that alone must not claim a second allowance. */
export async function preservePublicMetadata(directory: string, files: PinataFile[]): Promise<PinataFile[]> {
  assert.ok(files.length === 1 && files[0].path === 'release.json' && files[0].bytes.length <= 50 * 1024, 'Invalid metadata input');
  const input = dotifyManifestSchema.parse(JSON.parse(Buffer.from(files[0].bytes).toString('utf8')));
  const file = join(directory, 'public-metadata-input.json');
  let original;
  try {
    original = dotifyManifestSchema.parse(await load(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const handle = await open(file, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(input));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await sync(directory);
    original = input;
  }
  const { createdAt: _previous, ...previousContent } = original;
  const { createdAt: _current, ...currentContent } = input;
  assert.deepEqual(currentContent, previousContent, 'Public metadata pilot already owns different release details');
  return [{ path: 'release.json', bytes: Buffer.from(JSON.stringify(original)) }];
}
