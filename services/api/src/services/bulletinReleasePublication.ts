// Multi-release composition over the existing graph writer and nonce journal.
import assert from 'node:assert/strict';
import { buildPublicAssetGraph, preservePublicMetadata, type PublicAssetOwner, type PublicAssetKind, type PublicAssetPolicy } from './bulletinPublicAssets.js';
import { createReleaseAdmission, releaseIdentity, releaseJob } from './bulletinReleaseAdmission.js';
import { publicationBinding, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { dotifyManifestSchema } from './releaseManifest.js';
import { integer, receiptSchema, type BulletinMediaInventory } from './bulletinMediaState.js';
import type { BulletinMediaTransport } from './bulletinMedia.js';
import type { PinataFile } from './pinata.js';
import type { StreamingScope } from './streamingFormat.js';
import { PublicationAdmissionError } from './publicationAdmission.js';

export function createReleasePublication(profile: BulletinPublisherProfile, inventories: () => Promise<BulletinMediaInventory[]>) {
  assert.ok(profile.releasePolicy);
  const policy = profile.releasePolicy;
  const admission = createReleaseAdmission({
    directory: profile.directory,
    profileSha256: publicationBinding(profile).profileSha256,
    policy,
    audio: profile.budget
  });
  const validate = async () => {
    const jobs = await inventories();
    await admission.validateInventories(jobs);
    return jobs;
  };
  const check = async (scope: StreamingScope, name?: string, owner?: string) => {
    await admission.check(scope, owner);
    const jobs = await validate();
    // Ready/uncertain storage with a missing queue is operator recovery, not a
    // fresh generation under an already-used allowance.
    if ((!name && jobs.some(j => j.job === releaseJob(scope, 'audio'))) || (name && name !== releaseJob(scope, 'audio'))) throw new PublicationAdmissionError();
  };
  return {
    validate,
    check,
    async admit(scope: StreamingScope, owner: string) {
      await check(scope, undefined, owner);
      return (await admission.claim(scope, 'audio', '', owner)).slice('stream-'.length);
    },
    async audio(scope: StreamingScope, name: string) {
      await check(scope, name);
      assert.equal(await admission.claim(scope, 'audio'), name, 'Audio job lacks release admission');
    },
    async asset(files: PinataFile[], kind: PublicAssetKind, owner: PublicAssetOwner, signal: AbortSignal, activeJob: string | null) {
      const metadata = kind === 'metadata' ? dotifyManifestSchema.parse(JSON.parse(Buffer.from(files[0]?.bytes ?? []).toString('utf8'))) : null;
      const scope: StreamingScope = {
        chainId: owner.chainId,
        runtimeAddress: owner.runtimeAddress.toLowerCase(),
        contentHash: (metadata?.track.contentHash ?? owner.contentHash ?? '').toLowerCase(),
        keyVersion: metadata?.assets.keyVersion ?? owner.keyVersion ?? ''
      };
      const artist = admission.artistFor(scope, owner.address);
      await admission.check(scope, owner.address);
      const jobs = await validate();
      const dependencies: BulletinMediaInventory[] = [];
      if (metadata) {
        const audio = jobs.find(j => j.job === releaseJob(scope, 'audio') && j.ready && !Object.keys(j.pending).length);
        assert.ok(audio, 'Release audio is not ready');
        dependencies.push(audio);
        const expected = `dotify:enc:v3:${scope.keyVersion.replace('dotify-content-', '')}:ipfs://${audio.root}`;
        assert.ok(
          metadata.assets.encrypted === true && [audio.root, `ipfs://${audio.root}`, expected].includes(metadata.assets.audioCID),
          'Metadata audio differs from the admitted release'
        );
        if (metadata.assets.coverCID) {
          const cover = jobs.find(
            j =>
              j.ready &&
              j.generation === 'public-cover-v1' &&
              releaseIdentity(j.scope) === releaseIdentity(scope) &&
              [`${j.root}/cover/640.webp`, `ipfs://${j.root}/cover/640.webp`].includes(metadata.assets.coverCID) &&
              !Object.keys(j.pending).length
          );
          assert.ok(cover, 'Metadata cover is not ready for this release');
          dependencies.push(cover);
        }
      }
      const assetPolicy: PublicAssetPolicy = {
        schema: 'dotify.bulletin.public-assets.v1',
        owner: artist.owner,
        scope,
        cover: policy.cover,
        metadata: policy.metadata
      };
      // Validate before preserving metadata or charging its durable slot.
      await buildPublicAssetGraph(files, kind, assetPolicy, signal);
      if (metadata) files = await preservePublicMetadata(profile.directory, files, releaseIdentity(scope));
      const graph = await buildPublicAssetGraph(files, kind, assetPolicy, signal);
      signal.throwIfAborted();
      assert.ok(!activeJob || activeJob === releaseJob(scope, kind, graph.root), 'Previous publication requires reconciliation');
      const name = await admission.claim(scope, kind, graph.root, owner.address);
      return { files, name, graph, dependencies, budget: policy[kind] };
    }
  };
}

/** Ready is a past observation. Refuse metadata storage if its previously
 * verified immutable audio/cover graph no longer has sufficient canonical
 * retention. This performs no renewal or store, and does not redownload audio. */
export async function verifyReleaseDependencies(
  transport: BulletinMediaTransport,
  jobs: readonly Pick<BulletinMediaInventory, 'blocks' | 'budget'>[],
  signal: AbortSignal
) {
  if (!jobs.length) return;
  const stop = new AbortController();
  const bounded = AbortSignal.any([signal, stop.signal, AbortSignal.timeout(30_000)]);
  let abort = () => {};
  try {
    await Promise.race([
      (async () => {
        bounded.throwIfAborted();
        const first = await transport.status(bounded);
        integer.parse(first.head);
        const expiries: { expiresAt: number; lifetime: number }[] = [];
        for (const job of jobs) {
          let next = 0;
          const read = async () => {
            while (next < job.blocks.length) {
              bounded.throwIfAborted();
              const block = job.blocks[next++];
              const receipt = receiptSchema.parse(await transport.lookup(block.cid, bounded));
              assert.ok(receipt.cid === block.cid && receipt.bytes === block.bytes && receipt.block <= first.head, 'Release dependency receipt differs');
              expiries.push({ expiresAt: receipt.expiresAt, lifetime: job.budget.minimumLifetimeBlocks });
            }
          };
          await Promise.all([read(), read()]);
        }
        const final = await transport.status(bounded);
        integer.parse(final.head);
        assert.ok(
          final.head >= first.head && expiries.every(r => r.expiresAt > final.head + r.lifetime),
          'Release dependency retention needs operator attention'
        );
        bounded.throwIfAborted();
      })(),
      new Promise<never>((_, reject) => {
        abort = () => reject(bounded.reason);
        bounded.addEventListener('abort', abort, { once: true });
        if (bounded.aborted) abort();
      })
    ]);
  } finally {
    bounded.removeEventListener('abort', abort);
    stop.abort();
  }
}
