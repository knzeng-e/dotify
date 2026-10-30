// A quiet, generated chord. No artist recording, account signer or production key.
import { randomBytes, createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeStreamingRelease } from '../../services/api/src/services/streamingEncoder.ts';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from '../../services/api/src/services/streamingNonces.ts';
import { decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';
import { blake2b } from '../../services/api/node_modules/@noble/hashes/blake2.js';
import { prepare } from './canary.mjs';
import { generatedWav } from './generated-source.mjs';
export { generatedWav } from './generated-source.mjs';
import { fixtureProfile } from './fixture-profile.mjs';

/** Real encoder: loudness, FFmpeg, nonce reservation and v3 AEAD. */
export async function encryptedAacFixture(directory) {
  return encodeGenerated(directory, fixtureProfile());
}
export async function encryptedContinuityFixture(directory) {
  return encodeGenerated(directory, fixtureProfile('continuity'));
}
async function encodeGenerated(directory, profile) {
  const master = generatedWav(profile.durationSeconds);
  const key = randomBytes(32);
  const scope = {
    chainId: 420420417,
    runtimeAddress: `0x${'11'.repeat(20)}`,
    contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
    keyVersion: 'dotify-content-key-v2'
  };
  const ledgerPath = join(directory, 'nonces');
  await initializeStreamingNonceLedger(ledgerPath);
  try {
    const result = await encodeStreamingRelease({
      master,
      key,
      scope,
      ledger: new StreamingNonceLedger(ledgerPath)
    });
    const files = result.files.map(({ name, bytes }) => ({ path: name, bytes }));
    const byPath = new Map(files.map(file => [file.path, file.bytes]));
    const originals = new Map();
    for (const rendition of result.manifest.renditions)
      for (const object of [rendition.init, ...rendition.segments])
        originals.set(object.path, decryptStreamingObject(byPath.get(object.path), key, result.manifest, object));
    return {
      key,
      files,
      scope,
      manifest: result.manifest,
      originals,
      audioProof: {
        kind: profile.kind,
        durationSeconds: result.manifest.durationSeconds,
        sourceSha256: createHash('sha256').update(master).digest('hex'),
        encoder: 'services/api/src/services/streamingEncoder.ts',
        renditions: result.manifest.renditions.map(r => ({ bitrateKbps: r.bitrateKbps, segments: r.segments.length }))
      }
    };
  } catch (error) {
    key.fill(0);
    throw error;
  } finally {
    master.fill(0);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node --import tsx aac-fixture.mjs NEW_PRIVATE_DIRECTORY');
    console.log(JSON.stringify(await prepare(resolve(process.argv[2]), encryptedAacFixture), null, 2));
  } catch (error) {
    console.error(String(error.message).slice(0, 500));
    process.exitCode = 1;
  }
}
