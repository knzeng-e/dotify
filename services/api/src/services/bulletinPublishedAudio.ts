// Explicit offline authentication. No application config, vault, RPC or startup.
import assert from 'node:assert/strict';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { blake2b } from '@noble/hashes/blake2';
import { checkpointHash, checkpointMetadata, canonicalCheckpointDirectory } from './bulletinCheckpointFiles.js';
import { withVerifiedPublishedBulletinArchive } from './bulletinPublishedArchive.js';
import { readArchivedBulletinMaster } from './bulletinArchivedMaster.js';
import { recoveredContentKeySchema } from './recoveredContentKeySchema.js';
import { deriveReleaseKeyMaterial } from './contentKeyMaterial.js';
import { parseStreamingReference } from './streamingReference.js';
import { readBulletinMediaPath, BULLETIN_GRAPH_MAX } from './bulletinGraph.js';
import { readAuthenticatedCompactObject } from './bulletinCompactReader.js';
import { parseStreamingManifest, verifyStreamingManifest, validateStreamingScope, decryptStreamingObject } from './streamingFormat.js';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const planSchema = z
  .object({
    schema: z.literal('dotify.bulletin.published-audio-check.v1'),
    archiveManifestSha256: digest,
    registeredReference: z.string().max(256),
    scope: z
      .object({
        chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        runtimeAddress: z.string().regex(/^0x[0-9a-f]{40}$/),
        contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
        keyVersion: z
          .string()
          .max(80)
          .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      })
      .strict(),
    masterSha256: digest
  })
  .strict();
const within = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);
async function privateInput(path: string, directory: string) {
  assert.ok(isAbsolute(path) && resolve(path) === path, 'Canonical private input required');
  assert.ok(!within(directory, path) && !within(path, directory), 'Private input overlaps published archive');
  await canonicalCheckpointDirectory(dirname(path));
}

export async function authenticatePublishedBulletinAudio(options: {
  directory: string;
  planFile: string;
  expectedPlanSha256: string;
  keyFile: string;
  signal: AbortSignal;
}) {
  const { directory, planFile, keyFile, expectedPlanSha256 } = options;
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(360_000)]);
  signal.throwIfAborted();
  assert.match(expectedPlanSha256, /^[a-f0-9]{64}$/);
  await canonicalCheckpointDirectory(directory);
  await privateInput(planFile, directory);
  await privateInput(keyFile, directory);
  assert.notEqual(planFile, keyFile, 'Keys and trust plan must be separate');
  const rawPlan = await checkpointMetadata(planFile, 64 * 1024, signal);
  assert.equal(checkpointHash(rawPlan), expectedPlanSha256, 'Published audio trust plan changed');
  const plan = planSchema.parse(JSON.parse(rawPlan.toString('utf8')));
  validateStreamingScope(plan.scope);
  const reference = parseStreamingReference(plan.registeredReference, value => CID.parse(value));
  assert.ok(reference && reference.keyVersion === plan.scope.keyVersion, 'Expected release reference differs from scope');
  const rawKeys = await checkpointMetadata(keyFile, 64 * 1024, signal);
  const keysDigest = checkpointHash(rawKeys);
  let master: Buffer | undefined, key: Buffer | undefined;
  try {
    const recovered = recoveredContentKeySchema.parse(JSON.parse(rawKeys.toString('utf8')));
    const secret = recovered.masters[plan.scope.keyVersion];
    assert.ok(secret, 'Expected recovered key version is missing');
    master = Buffer.from(secret, 'hex');
    assert.equal(checkpointHash(master), plan.masterSha256, 'Recovered master differs from trusted commitment');
    key = deriveReleaseKeyMaterial(master, plan.scope);
    master.fill(0);
    rawKeys.fill(0);
    const releaseKey = key;
    const result = await withVerifiedPublishedBulletinArchive(directory, plan.archiveManifestSha256, signal, async archive => {
      assert.equal(archive.root, reference.root, 'Published archive differs from expected release root');
      let calls = 0,
        bytes = 0;
      const readBlock = async (cid: string, owner: AbortSignal) => {
        assert.ok(++calls <= 32768, 'Published audio read-count bound exceeded');
        const block = await archive.readBlock(cid, owner);
        bytes += block.length;
        assert.ok(bytes <= 4 * BULLETIN_GRAPH_MAX, 'Published audio read-byte bound exceeded');
        return block;
      };
      const rootNode = dagPB.decode(await readBlock(archive.root, signal));
      assert.deepEqual(
        rootNode.Links.map(link => link.Name).sort(),
        ['96', '160', '320', 'archive', 'manifest.json', ...(reference.layout === 'rendition-pack-v1' ? ['layout.json'] : [])].sort(),
        'Published audio physical layout differs from expected reference'
      );
      const manifestBytes = await readBulletinMediaPath(readBlock, archive.root, 'manifest.json', 256 * 1024, signal);
      const manifest = parseStreamingManifest(manifestBytes);
      verifyStreamingManifest(manifest, releaseKey, plan.scope);
      let authenticatedObjects = 0;
      const encryptedMaster = await readArchivedBulletinMaster({ root: archive.root, encryptedLength: manifest.master.encryptedLength, readBlock, signal });
      try {
        const plain = decryptStreamingObject(encryptedMaster, releaseKey, manifest, manifest.master);
        try {
          assert.equal(`0x${Buffer.from(blake2b(plain, { dkLen: 32 })).toString('hex')}`, plan.scope.contentHash, 'Published original content hash differs');
          authenticatedObjects++;
        } finally {
          plain.fill(0);
        }
      } finally {
        encryptedMaster.fill(0);
      }
      for (const object of manifest.renditions.flatMap(r => [r.init, ...r.segments])) {
        signal.throwIfAborted();
        const encrypted =
          reference.layout === 'unixfs-files-v1'
            ? await readBulletinMediaPath(readBlock, archive.root, object.path, object.encryptedLength, signal)
            : await readAuthenticatedCompactObject({
                readBlock,
                root: archive.root,
                manifestBytes,
                key: releaseKey,
                scope: plan.scope,
                objectPath: object.path,
                maxBytes: object.encryptedLength,
                signal
              });
        try {
          decryptStreamingObject(encrypted, releaseKey, manifest, object).fill(0);
          authenticatedObjects++;
        } finally {
          encrypted.fill(0);
        }
      }
      return { authenticatedObjects, originalBytes: manifest.master.plainLength };
    });
    await privateInput(planFile, directory);
    await privateInput(keyFile, directory);
    assert.equal(checkpointHash(await checkpointMetadata(planFile, 64 * 1024, signal)), expectedPlanSha256, 'Trust plan changed during authentication');
    const finalKeys = await checkpointMetadata(keyFile, 64 * 1024, signal);
    try {
      assert.equal(checkpointHash(finalKeys), keysDigest, 'Recovered keys changed during authentication');
    } finally {
      finalKeys.fill(0);
    }
    return {
      schema: 'dotify.bulletin.published-audio-report.v1',
      planSha256: expectedPlanSha256,
      archiveManifestSha256: plan.archiveManifestSha256,
      layout: reference.layout,
      ...result,
      ciphertextAuthenticated: true,
      originalContentHashVerified: true,
      expectedReferenceMatched: true,
      registrationVerified: false,
      canonicalHistoryChecked: false,
      independentStorageVerified: false,
      keyBackupOriginVerified: false,
      decodedOrAudibleAudioVerified: false,
      writerActivationAllowed: false,
      signerLoaded: false,
      serviceStarted: false
    };
  } finally {
    rawKeys.fill(0);
    master?.fill(0);
    key?.fill(0);
  }
}
