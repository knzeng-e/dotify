// Offline authentication of an already guarded reconstruction. No application
// config, signer, RPC, transport, service startup or key/cleartext export.
import assert from 'node:assert/strict';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { blake2b } from '@noble/hashes/blake2';
import { verifyIsolatedBulletinRestore } from './bulletinIsolatedRestore.js';
import { readCheckpointManifest } from './bulletinCheckpoint.js';
import { canonicalCheckpointDirectory, checkpointCiphertext, checkpointMetadata } from './bulletinCheckpointFiles.js';
import { publisherProfileSchema } from './bulletinPublisherProfile.js';
import { jobSchema } from './bulletinMediaState.js';
import { streamingJobsSchema } from './streamingJobState.js';
import { releaseJob } from './bulletinReleaseAdmission.js';
import { contentMasterDigest } from './freshContentKeyBinding.js';
import { deriveReleaseKeyMaterial } from './contentKeyMaterial.js';
import { decryptStreamingObject, parseStreamingManifest, validateStreamingScope, verifyStreamingManifest, type StreamingScope } from './streamingFormat.js';
import { STREAM_NONCE_SCHEME, streamingKeyFingerprint } from './streamingNonces.js';

const version = /^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/;
const recoveredSchema = z
  .object({
    schema: z.literal('dotify.content-key-recovery.v1'),
    masters: z.record(
      z.string().max(80).regex(version),
      z
        .string()
        .min(64)
        .max(1024)
        .regex(/^(?:[0-9a-fA-F]{2})+$/)
    )
  })
  .strict()
  .refine(value => Object.keys(value.masters).length > 0 && Object.keys(value.masters).length <= 64);
const within = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);

export async function verifyRecoveredBulletinKeys(options: { directory: string; expectedManifestSha256: string; keyFile: string; signal: AbortSignal }) {
  const { directory, expectedManifestSha256: digest, keyFile, signal } = options;
  const restored = await verifyIsolatedBulletinRestore(directory, digest, signal);
  const { manifest } = await readCheckpointManifest(join(directory, 'checkpoint.json'), digest, signal);
  const entries = new Map(manifest.plan.files.map(entry => [entry.path, entry]));
  const pathFor = (logical: string) => join(directory, 'data', logical);
  const metadata = async (logical: string) => {
    signal.throwIfAborted();
    assert.ok(entries.has(logical.replace(/\.checkpoint$/, '')), 'Missing restored metadata');
    return JSON.parse((await checkpointMetadata(pathFor(logical), 2 * 1024 * 1024, signal)).toString('utf8'));
  };
  const profile = publisherProfileSchema.parse(await metadata('profile.json.checkpoint'));
  assert.ok(isAbsolute(keyFile) && resolve(keyFile) === keyFile, 'Canonical recovered-key file required');
  for (const source of [directory, ...Object.values(manifest.plan.sources), resolve(profile.seedFile)])
    assert.ok(!within(source, keyFile) && !within(keyFile, source), 'Recovered keys overlap state or configured signer');
  await canonicalCheckpointDirectory(dirname(keyFile));
  const rawKeys = await checkpointMetadata(keyFile, 64 * 1024, signal);
  const masters = new Map<string, Buffer>();
  const authenticatedVersions = new Set<string>();
  let authenticatedObjects = 0,
    retainedAudioInventories = 0,
    prunedAudioInventories = 0,
    nonceReservationsChecked = 0;
  try {
    const recovered = recoveredSchema.parse(JSON.parse(rawKeys.toString('utf8')));
    for (const [keyVersion, secret] of Object.entries(recovered.masters)) masters.set(keyVersion, Buffer.from(secret, 'hex'));
    for (const required of manifest.plan.requiredKeyVersions) assert.ok(masters.has(required), 'Required recovered version is missing');
    if (profile.freshContentKey)
      assert.equal(
        contentMasterDigest(masters.get(profile.freshContentKey.version)!.toString('hex')),
        profile.freshContentKey.masterSha256,
        'Recovered master differs from profile commitment'
      );
    const keyFor = (scope: StreamingScope) => {
      validateStreamingScope(scope);
      const master = masters.get(scope.keyVersion);
      assert.ok(master, 'Recovered scope key is missing');
      return deriveReleaseKeyMaterial(master, scope);
    };
    const reservation = async (key: Buffer, generation: string) => {
      const fingerprint = streamingKeyFingerprint(key);
      assert.deepEqual(await metadata(`queue/nonces/${fingerprint}/${generation}.json`), {
        schema: 'dotify.streaming.nonce-ledger.v1',
        fingerprint,
        generation
      });
      nonceReservationsChecked++;
    };
    const inventories = manifest.plan.files.filter(entry => /^publisher\/stream-/.test(entry.path));
    const jobs = streamingJobsSchema.parse(await metadata('queue/jobs.json')).jobs;
    for (const entry of inventories) {
      signal.throwIfAborted();
      const inventory = jobSchema.parse(await metadata(entry.path));
      if (inventory.job !== releaseJob(inventory.scope, 'audio')) continue;
      const key = keyFor(inventory.scope);
      try {
        await reservation(key, inventory.generation);
        const job = jobs.find(job => `stream-${job.id}` === inventory.job);
        if (job) await reservation(key, job.sourceGeneration);
        const folder = job ? `queue/jobs/${job.id}` : '';
        if (!folder || !manifest.plan.directories.includes(folder)) {
          prunedAudioInventories++;
          continue;
        }
        const readCiphertext = async (logical: string) => {
          const expected = entries.get(logical);
          assert.ok(expected, 'Missing retained object');
          return checkpointCiphertext(pathFor(logical), expected, signal);
        };
        const verifyPlain = (plain: Buffer) =>
          assert.equal(`0x${Buffer.from(blake2b(plain, { dkLen: 32 })).toString('hex')}`, inventory.scope.contentHash, 'Recovered original audio hash differs');
        const source = await readCiphertext(`${folder}/source.bin`);
        try {
          const plain = decryptStreamingObject(
            source,
            key,
            { ...inventory.scope, schema: 'dotify.audio.v3', version: 1, nonceScheme: STREAM_NONCE_SCHEME, generation: job!.sourceGeneration },
            {
              rendition: 'archive',
              kind: 'master',
              index: 0,
              path: 'archive/master.bin',
              counter: 0,
              plainLength: job!.sourceBytes,
              encryptedLength: job!.sourceBytes + 16
            }
          );
          try {
            verifyPlain(plain);
          } finally {
            plain.fill(0);
          }
          authenticatedObjects++;
        } finally {
          source.fill(0);
        }
        const stream = parseStreamingManifest(await checkpointMetadata(pathFor(`${folder}/output/manifest.json`), 256 * 1024, signal));
        verifyStreamingManifest(stream, key, inventory.scope);
        for (const object of [stream.master, ...stream.renditions.flatMap(rendition => [rendition.init, ...rendition.segments])]) {
          signal.throwIfAborted();
          const encrypted = await readCiphertext(`${folder}/output/${object.path}`);
          try {
            const plain = decryptStreamingObject(encrypted, key, stream, object);
            try {
              if (object.kind === 'master') verifyPlain(plain);
            } finally {
              plain.fill(0);
            }
            authenticatedObjects++;
          } finally {
            encrypted.fill(0);
          }
        }
        authenticatedVersions.add(inventory.scope.keyVersion);
        retainedAudioInventories++;
      } finally {
        key.fill(0);
      }
    }
    // Recheck the complete original digest/tree and refusal controls after reads.
    await verifyIsolatedBulletinRestore(directory, digest, signal);
    return {
      schema: 'dotify.bulletin.recovered-key-check.v1',
      manifestSha256: digest,
      requiredVersionsPresent: manifest.plan.requiredKeyVersions.length,
      authenticatedKeyVersions: [...authenticatedVersions].sort(),
      retainedAudioInventories,
      prunedAudioInventories,
      authenticatedObjects,
      nonceReservationsChecked,
      ciphertextAuthenticated: authenticatedObjects > 0,
      allAudioCiphertextRetained: retainedAudioInventories > 0 && prunedAudioInventories === 0,
      writerActivationAllowed: false,
      canonicalHistoryChecked: false,
      independentStorageVerified: false,
      keyBackupOriginVerified: false,
      signerLoaded: false,
      serviceStarted: false
    };
  } finally {
    rawKeys.fill(0);
    for (const master of masters.values()) master.fill(0);
  }
}
