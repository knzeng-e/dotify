import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { StreamingEncryptor, decryptStreamingObject } from '../services/streamingFormat.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from '../services/streamingNonces.js';
import {
  RELEASE_BOUND_CONTENT_KEY_VERSION,
  deriveContentKey,
  deriveContentKeyBytes,
  getActiveContentKeyVersion,
  getContentKeyVaultStatus,
  type ContentKeyVersion
} from '../services/keyVault.js';
import { createKeyRoutes, type KeyRouteDeps } from '../routes/keys.js';
import type { CanonicalRelease } from '../services/chainAccess.js';

const CHAIN_ID = 420420417;
const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const REQUESTER = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const ARTIST = '0x3333333333333333333333333333333333333333' as const;
const RELEASE_ID = `${RUNTIME}:${CONTENT_HASH}`;
const ACTIVE_VERSION = 'dotify-content-key-v3' satisfies ContentKeyVersion;

const RETAINED_SECRET = '11'.repeat(32);
const ROTATED_SECRET = '22'.repeat(32);
const PLAINTEXT = Buffer.from('synthetic W07 media access rehearsal');

type SyntheticBackup = {
  schema: 'dotify.content-key-custody-backup.synthetic.v1';
  activeVersion: ContentKeyVersion;
  versions: Record<string, string>;
};

function release(audioRef: string, keyVersion: ContentKeyVersion): CanonicalRelease {
  return {
    releaseId: RELEASE_ID.toLowerCase(),
    contentHash: CONTENT_HASH,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    audioRef,
    keyVersion,
    sourceBlock: 1
  };
}

async function writeSyntheticBackup(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dotify-key-custody-'));
  const path = join(dir, 'content-key-backup.synthetic.json');
  const backup: SyntheticBackup = {
    schema: 'dotify.content-key-custody-backup.synthetic.v1',
    activeVersion: ACTIVE_VERSION,
    versions: {
      [RELEASE_BOUND_CONTENT_KEY_VERSION]: RETAINED_SECRET,
      [ACTIVE_VERSION]: ROTATED_SECRET
    }
  };
  await writeFile(path, JSON.stringify(backup, null, 2), { mode: 0o600 });
  return path;
}

async function readSyntheticBackup(path: string): Promise<SyntheticBackup> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as SyntheticBackup;
  assert.equal(parsed.schema, 'dotify.content-key-custody-backup.synthetic.v1');
  assert.equal(parsed.activeVersion, ACTIVE_VERSION);
  return parsed;
}

async function main(): Promise<void> {
  const backupPath = await writeSyntheticBackup();
  const backup = await readSyntheticBackup(backupPath);
  const restoredConfig = {
    contentKeyMasterSecrets: JSON.stringify(backup.versions),
    contentKeyActiveVersion: backup.activeVersion,
    chainId: CHAIN_ID
  };

  const status = getContentKeyVaultStatus(restoredConfig);
  assert.equal(status.configured, true);
  assert.equal(status.activeVersion, ACTIVE_VERSION);
  assert.deepEqual(status.configuredVersions, [RELEASE_BOUND_CONTENT_KEY_VERSION, ACTIVE_VERSION]);

  const activeVersion = getActiveContentKeyVersion(restoredConfig);
  const activeKey = deriveContentKeyBytes({ contentHash: CONTENT_HASH, keyVersion: activeVersion, chainId: CHAIN_ID, runtimeAddress: RUNTIME }, restoredConfig);
  const oldReleaseBoundKey = deriveContentKeyBytes(
    { contentHash: CONTENT_HASH, keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION, chainId: CHAIN_ID, runtimeAddress: RUNTIME },
    restoredConfig
  );
  assert.ok(activeKey);
  assert.ok(oldReleaseBoundKey);

  const ledgerPath = join(backupPath, '..', 'nonces');
  await initializeStreamingNonceLedger(ledgerPath);
  const reservation = await new StreamingNonceLedger(ledgerPath).reserve(activeKey);
  const scope = { contentHash: CONTENT_HASH, chainId: CHAIN_ID, runtimeAddress: RUNTIME, keyVersion: activeVersion };
  const encryptor = new StreamingEncryptor(activeKey, reservation, scope);
  const encrypted = encryptor.object(PLAINTEXT, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
  const identity = {
    ...scope,
    schema: 'dotify.audio.v3' as const,
    version: 1 as const,
    nonceScheme: 'dotify.gcm.high-counter.v1' as const,
    generation: reservation.generation
  };
  assert.deepEqual(decryptStreamingObject(encrypted.bytes, activeKey, identity, encrypted.descriptor), PLAINTEXT);
  assert.throws(() => decryptStreamingObject(encrypted.bytes, oldReleaseBoundKey, identity, encrypted.descriptor));
  const audioRef = `dotify:enc:v3:key-v3:ipfs://Qm${'a'.repeat(44)}`;
  let deriveCalls = 0;
  const deps: KeyRouteDeps = {
    verifySignedRequest: async () => ({ valid: true }),
    verifySessionToken: () => ({ valid: false, code: 'SESSION_INVALID', reason: 'Session path not used by this rehearsal.' }),
    checkTrackAccess: async request => {
      if (request.release?.audioRef !== audioRef || request.release.keyVersion !== activeVersion) {
        return { allowed: false, code: 'RELEASE_IDENTITY_MISMATCH', reason: 'Synthetic release identity mismatch.' };
      }
      return {
        allowed: true,
        runtime: RUNTIME,
        release: release(audioRef, activeVersion),
        keyScope: { contentHash: CONTENT_HASH, keyVersion: activeVersion, chainId: CHAIN_ID, runtimeAddress: RUNTIME }
      };
    },
    checkPublicAccess: async () => ({ allowed: false, code: 'NOT_FREE', reason: 'Synthetic release was changed from Free to protected.' }),
    deriveContentKey: input => {
      deriveCalls += 1;
      return deriveContentKey(input, restoredConfig);
    }
  };

  const app = Fastify();
  await app.register(createKeyRoutes(deps), { prefix: '/api/tracks' });
  const releaseFields = {
    releaseId: RELEASE_ID,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    audioRef,
    keyVersion: activeVersion
  };

  const allowed = await app.inject({
    method: 'POST',
    url: `/api/tracks/${CONTENT_HASH}/key-request`,
    payload: {
      requester: REQUESTER,
      signature: `0x${'11'.repeat(65)}`,
      nonce: 'a'.repeat(48),
      chainId: CHAIN_ID,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      purpose: 'individual',
      ...releaseFields
    }
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.json().access, 'allowed');
  const expectedKey = deriveContentKey({ contentHash: CONTENT_HASH, keyVersion: activeVersion, chainId: CHAIN_ID, runtimeAddress: RUNTIME }, restoredConfig);
  assert.equal(expectedKey.ok, true);
  if (expectedKey.ok) {
    assert.equal(allowed.json().contentKey, expectedKey.contentKey);
  }

  deriveCalls = 0;
  const deniedFree = await app.inject({
    method: 'POST',
    url: `/api/tracks/${CONTENT_HASH}/free-key`,
    payload: releaseFields
  });
  assert.equal(deniedFree.statusCode, 200);
  assert.equal(deniedFree.json().access, 'denied');
  assert.equal(deniedFree.json().contentKey, undefined);
  assert.equal(deriveCalls, 0);
  await app.close();

  console.log(
    JSON.stringify({
      status: 'passed',
      backupPath,
      activeVersion: status.activeVersion,
      configuredVersions: status.configuredVersions
    })
  );
}

await main();
