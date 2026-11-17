import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { blake2b } from '@noble/hashes/blake2';
import { StreamingJobs } from './streamingJobs.js';
import { initializeBulletinPublisher, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { recoverPreparedBulletinJob } from './bulletinPreparedRecovery.js';
import { buildBulletinMediaGraph } from './bulletinGraph.js';
import { buildBulletinCompactMediaGraph } from './bulletinCompactGraph.js';
import { createReleaseAdmission, admissionDigest, releasePipeline, type ReleaseAdmissionLedger } from './bulletinReleaseAdmission.js';
import { publicationBinding } from './bulletinPublisherProfile.js';
import { extendBulletinAdmission } from './bulletinAdmissionExtension.js';
import { contentMasterDigest } from './freshContentKeyBinding.js';
import { deriveContentKeyBytes, type ContentKeyVaultConfigInput } from './keyVault.js';
import type { PinataFile } from './pinata.js';
import { load, save } from './bulletinMediaState.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';

import { recoveryPublisherFixture } from './bulletinRecoveryTransport.fixture.js';
export const owner = `0x${'12'.repeat(20)}`;
export const signal = () => new AbortController().signal;
export type RecoveryMode = 'pilot' | 'standard' | 'compact';
export async function fixture(t: Pick<TestContext, 'after'>, mode: RecoveryMode = 'pilot', parent = tmpdir()) {
  const root = await mkdtemp(join(parent, 'dotify-prepared-recovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const queue = join(root, 'queue');
  const master = Buffer.from('generated fixture only');
  const scope = {
    chainId: 420420417,
    runtimeAddress: `0x${'34'.repeat(20)}`,
    contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
    keyVersion: mode === 'pilot' ? 'dotify-content-key-v2' : 'dotify-content-key-v3'
  };
  const secret = '43'.repeat(32);
  const vault: ContentKeyVaultConfigInput | undefined =
    mode === 'pilot'
      ? undefined
      : {
          contentKeyMasterSecret: '',
          contentKeyMasterSecrets: JSON.stringify({ [scope.keyVersion]: secret }),
          contentKeyActiveVersion: scope.keyVersion,
          chainId: scope.chainId
        };
  const key = vault ? deriveContentKeyBytes(scope, vault)! : Buffer.alloc(32, 43);
  const profile: BulletinPublisherProfile = {
    schema: 'dotify.bulletin.publisher.v1',
    genesis: BULLETIN_MEDIA_GENESIS,
    account: '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca',
    endpoint: 'wss://bulletin.example:8443',
    directory: join(root, 'publisher'),
    seedFile: join(root, 'keys', 'test.seed'),
    budget: { maxBytes: 1024 * 1024, maxTransactions: mode === 'pilot' ? 16 : 64, minimumLifetimeBlocks: 100 },
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    priorRenewalReserve: { transactions: 107, bytes: 20 * 1024 * 1024 },
    ...(mode === 'pilot'
      ? { pilotScope: scope }
      : {
          freshContentKey: { version: scope.keyVersion, masterSha256: contentMasterDigest(secret) },
          releasePolicy: {
            schema: 'dotify.bulletin.release-policy.v1',
            artists: [{ owner, chainId: scope.chainId, runtimeAddress: scope.runtimeAddress, keyVersion: scope.keyVersion }],
            maxReleases: 2,
            cover: { maxBytes: 1024 * 1024, maxTransactions: 16, minimumLifetimeBlocks: 100 },
            metadata: { maxBytes: 1024 * 1024, maxTransactions: 16, minimumLifetimeBlocks: 100 },
            total: { maxBytes: 6 * 1024 * 1024, maxTransactions: 192 }
          }
        })
  };
  const profileFile = join(root, 'profile.json');
  await writeFile(profileFile, JSON.stringify(profile), { mode: 0o600 });
  await initializeBulletinPublisher(queue, profile);
  if (mode === 'compact')
    await extendBulletinAdmission(
      {
        schema: 'dotify.bulletin.release-extension.v2',
        profileFile,
        queue,
        expectedProfileSha256: publicationBinding(profile).profileSha256,
        expectedAdmissionSha256: admissionDigest((await load(join(profile.directory, 'release-admission.json'))) as ReleaseAdmissionLedger),
        owner,
        scope,
        audioLayout: 'rendition-pack-v1',
        writeWindow: { concurrency: 4, maxInFlightBytes: 1024 * 1024 }
      },
      true
    );
  const admission = profile.releasePolicy
    ? createReleaseAdmission({
        directory: profile.directory,
        profileSha256: publicationBinding(profile).profileSha256,
        policy: profile.releasePolicy,
        audio: profile.budget
      })
    : undefined;
  let encodes = 0;
  let files: PinataFile[] = [];
  const jobs = new StreamingJobs({
    directory: queue,
    deriveKey: () => Buffer.from(key),
    authority: async () => true,
    ...(admission
      ? {
          assertCanPrepare: async (s, _name, o) => admission.check(s, o),
          admitPreparation: async (s, o) => (await admission.claim(s, 'audio', '', o)).slice('stream-'.length)
        }
      : {}),
    transcode: async () => {
      encodes++;
      return {
        durationSeconds: 8,
        integratedLufs: -18,
        gainDb: 2,
        renditions: ([96, 160, 320] as const).map(bitrateKbps => ({
          bitrateKbps,
          init: Buffer.from('structural init'),
          segments: mode === 'pilot' ? [Buffer.from('structural segment')] : [1, 2, 3].map(i => Buffer.alloc(64, i))
        }))
      };
    },
    pin: async prepared => {
      files = prepared;
      throw new Error('reproduce pre-store admission failure');
    }
  });
  await jobs.start(false);
  const admitted = await jobs.enqueue({ owner, scope, master });
  for (let i = 0; i < 3; i++) {
    if (i) await jobs.retry(admitted.id, owner, scope.chainId);
    await jobs.runNext();
  }
  await assert.rejects(jobs.retry(admitted.id, owner, scope.chainId), /STREAMING_RETRY_LIMIT/);
  await jobs.stop();
  const graph = await (mode === 'compact' ? buildBulletinCompactMediaGraph : buildBulletinMediaGraph)(files, signal());
  const name = `stream-${admitted.id}`;
  const inventory = {
    schema: mode === 'compact' ? 'dotify.bulletin.media-job.v3' : 'dotify.bulletin.media-job.v2',
    ...(mode === 'compact' ? { layout: 'rendition-pack-v1' } : {}),
    genesis: profile.genesis,
    account: profile.account,
    job: name,
    root: graph.root,
    scope,
    generation: graph.generation,
    blocks: graph.blocks.map(b => ({ cid: b.cid, bytes: b.bytes.length })),
    budget: profile.budget,
    pipeline: admission ? releasePipeline(profile.pipeline, await admission.validate(), scope) : profile.pipeline,
    attemptedStores: 0,
    attemptedBytes: 0,
    receipts: {},
    pending: {},
    nextNonce: null,
    ready: false
  };
  await save(profile.directory, `${name}.json`, inventory);
  await save(profile.directory, 'owner.json', {
    schema: 'dotify.bulletin.media-owner.v2',
    genesis: profile.genesis,
    account: profile.account,
    jobs: [name],
    activeJob: null,
    nextNonce: null
  });
  const wire = recoveryPublisherFixture(profile);
  const { publisher, stored, writes, transport } = wire;
  let authority = true;
  const options = { queue, profileFile, jobId: admitted.id, owner, signal: signal() };
  const deps = { deriveKey: () => Buffer.from(key), authority: async () => authority, publisher, contentKeyVault: vault };
  const inspect = () => recoverPreparedBulletinJob(options, deps);
  const execute = (executePlan: string) => recoverPreparedBulletinJob({ ...options, executePlan }, deps);
  const snapshot = async () => ({
    queue: await readFile(join(queue, 'jobs.json'), 'utf8'),
    nonce: await tree(join(queue, 'nonces')),
    files: await tree(join(queue, 'jobs')),
    publisher: await tree(profile.directory)
  });
  return {
    root,
    queue,
    key,
    profile,
    profileFile,
    options,
    deps,
    inspect,
    execute,
    snapshot,
    stored,
    writes,
    graph,
    scope,
    vault,
    admission,
    name,
    transport,
    checkpoint: wire.checkpoint,
    get encodes() {
      return encodes;
    },
    get signerLoads() {
      return wire.signerLoads;
    },
    get closed() {
      return wire.closed;
    },
    set loseAck(value: boolean) {
      wire.loseAck = value;
    },
    set hideSubmission(value: boolean) {
      wire.hideSubmission = value;
    },
    set authority(value: boolean) {
      authority = value;
    }
  };
}
export async function tree(directory: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const [file, value] of Object.entries(await tree(join(directory, entry.name)))) entries[`${entry.name}/${file}`] = value;
    } else entries[entry.name] = (await readFile(join(directory, entry.name))).toString('hex');
  }
  return entries;
}
