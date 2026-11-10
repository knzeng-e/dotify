// Explicit fresh development setup. Does not open an old queue, migrate state,
// contact the chain, read a storage signer, or change the running configuration.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { integer, ownerSchema, privateDirectory, load, save, sync } from './bulletinMediaState.js';
import { initializeBulletinPublisher, publicationBinding, publisherProfileSchema } from './bulletinPublisherProfile.js';
import { contentMasterDigest } from './freshContentKeyBinding.js';
const keyVersion = z
  .string()
  .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
  .max(80);
export const freshDevelopmentSchema = z
  .object({
    schema: z.literal('dotify.bulletin.fresh-development.v1'),
    destination: z.string().refine(p => isAbsolute(p) && resolve(p) === p),
    retiredKeyVersions: z.array(keyVersion).min(1).max(128),
    accountNonceFloor: integer.max(0x100000000),
    profile: publisherProfileSchema
  })
  .strict();
export async function initializeFreshBulletinDevelopment(input: unknown) {
  const request = freshDevelopmentSchema.parse(input),
    base = request.profile;
  assert.ok(base.releasePolicy && !base.pilotScope && !base.freshContentKey, 'Fresh multi-release profile without an existing key binding required');
  const versions = new Set(base.releasePolicy.artists.map(a => a.keyVersion));
  assert.equal(versions.size, 1, 'Use one fresh active key version');
  const version = [...versions][0],
    revision = (v: string) => BigInt(v.slice('dotify-content-key-v'.length));
  assert.ok(
    request.retiredKeyVersions.every(v => revision(v) < revision(version)),
    'Fresh key version must follow every retired version'
  );
  assert.equal(base.directory, join(request.destination, 'publications'), 'New inventories must belong to the fresh directory');
  assert.ok(
    base.seedFile !== request.destination && !base.seedFile.startsWith(`${request.destination}/`),
    'Keep the installed storage signer outside the fresh directory'
  );
  const parent = dirname(request.destination);
  assert.equal(await realpath(parent), parent, 'Canonical destination parent required');
  await privateDirectory(parent);
  await lstat(request.destination).then(
    () => {
      throw new Error('Fresh absent destination required');
    },
    e => {
      if (e.code !== 'ENOENT') throw e;
    }
  );
  const master = randomBytes(32);
  try {
    const profile = publisherProfileSchema.parse({ ...base, freshContentKey: { version, masterSha256: contentMasterDigest(master.toString('hex')) } });
    await mkdir(request.destination, { mode: 0o700 });
    const file = await open(join(request.destination, 'content-key.json'), 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify({ [version]: master.toString('hex') }));
      await file.sync();
    } finally {
      await file.close();
    }
    const queue = join(request.destination, 'queue');
    await initializeBulletinPublisher(queue, profile);
    const owner = ownerSchema.parse(await load(join(profile.directory, 'owner.json')));
    await save(profile.directory, 'owner.json', { ...owner, nextNonce: request.accountNonceFloor });
    await save(request.destination, 'profile.json', profile);
    const report = {
      schema: 'dotify.bulletin.fresh-development-report.v1',
      keyVersion: version,
      profileSha256: publicationBinding(profile).profileSha256,
      accountNonceFloor: request.accountNonceFloor,
      priorRenewalReserve: profile.priorRenewalReserve,
      maxReleases: Math.min(
        profile.releasePolicy!.maxReleases,
        Math.floor(
          profile.releasePolicy!.total.maxBytes / (profile.budget.maxBytes + profile.releasePolicy!.cover.maxBytes + profile.releasePolicy!.metadata.maxBytes)
        ),
        Math.floor(
          profile.releasePolicy!.total.maxTransactions /
            (profile.budget.maxTransactions + profile.releasePolicy!.cover.maxTransactions + profile.releasePolicy!.metadata.maxTransactions)
        )
      ),
      networkWrites: 0,
      activated: false,
      accountStateVerified: false
    };
    await save(request.destination, 'ready.json', report);
    await sync(parent);
    return report; // Never return the new secret in routine CLI output.
  } finally {
    master.fill(0);
  }
}
