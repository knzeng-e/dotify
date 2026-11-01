import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import sharp from 'sharp';
import { getTxCreator } from 'polkadot-api/tx-creator';
import { initializeBulletinPublisher, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { initializePublicAssetPolicy, type PublicAssetPolicy } from './bulletinPublicAssets.js';
import { createResponsiveCover } from './coverVariants.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';
import type { BulletinBlock } from './bulletinGraph.js';
import type { BulletinMediaTransport, BulletinReceipt, BulletinSubmissionReceipt } from './bulletinMedia.js';
import type { PublisherDependencies } from './streamingPublicationStore.js';
export async function assetFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'dotify-public-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scope = { chainId: 420420417, runtimeAddress: `0x${'22'.repeat(20)}`, contentHash: `0x${'33'.repeat(32)}`, keyVersion: 'dotify-content-key-v2' };
  const owner = { address: `0x${'11'.repeat(20)}`, runtimeAddress: scope.runtimeAddress, chainId: scope.chainId };
  const budget = { maxBytes: 512 * 1024, maxTransactions: 16, minimumLifetimeBlocks: 100 };
  const profile: BulletinPublisherProfile = {
    schema: 'dotify.bulletin.publisher.v1',
    genesis: BULLETIN_MEDIA_GENESIS,
    endpoint: 'wss://bulletin.example',
    account: '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca',
    directory: join(root, 'inventories'),
    seedFile: join(root, 'key/storage.seed'),
    budget,
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    priorRenewalReserve: { transactions: 10, bytes: 1000 },
    pilotScope: scope
  };
  const queue = join(root, 'queue'),
    profileFile = join(root, 'profile.json'),
    policyFile = join(root, 'assets.json');
  const policy: PublicAssetPolicy = { schema: 'dotify.bulletin.public-assets.v1', owner: owner.address, scope, cover: budget, metadata: budget };
  await writeFile(profileFile, JSON.stringify(profile), { mode: 0o600 });
  await writeFile(policyFile, JSON.stringify(policy), { mode: 0o600 });
  await initializeBulletinPublisher(queue, profile);
  await initializePublicAssetPolicy(profile, policy);
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#123456' } })
    .png()
    .toBuffer();
  const cover = await createResponsiveCover(png, 'png');
  const metadata = {
    schema: 'dotify.track.v2',
    createdAt: '2026-11-01T12:00:00.000Z',
    assets: { audioCID: 'dotify:enc:v3:key-v2:ipfs://synthetic', coverCID: 'ipfs://synthetic/cover/640.webp', encrypted: true, keyVersion: scope.keyVersion },
    track: {
      contentHash: scope.contentHash,
      title: 'Synthetic',
      artistName: 'Test',
      description: '',
      durationSeconds: 8,
      accessMode: 'classic',
      priceDot: '1',
      requiredPersonhood: '',
      zone: ''
    },
    editorial: {
      releaseKind: 'single',
      projectTitle: '',
      version: '',
      releaseDate: '',
      genres: [],
      languages: [],
      credits: [],
      label: '',
      productionLocation: '',
      explicitContent: false,
      isrc: '',
      copyrightNotice: '',
      masterNotice: ''
    },
    royalties: [],
    settlement: { target: 'evm', royaltyBps: 0, pricePlanck: '1' }
  };
  let nonce = 10,
    head = 1000,
    writes = 0,
    active = 0,
    peak = 0,
    allowed = true,
    fail = false;
  const stored = new Map<string, { bytes: Uint8Array; receipt: BulletinReceipt }>(),
    submissions = new Map<number, BulletinSubmissionReceipt>();
  const transport: BulletinMediaTransport = {
    genesis: profile.genesis,
    account: profile.account,
    status: async () => ({ head, authorization: { expiresAt: 100000, remainingTransactions: 10000, remainingBytes: 10000000, remainingRenewBytes: 10000000 } }),
    nextNonce: async () => ({ nonce, head }),
    lookupSubmission: async query => submissions.get(query.nonce) ?? null,
    lookup: async cid => stored.get(cid)?.receipt ?? null,
    readBlock: async cid => {
      const value = stored.get(cid);
      if (!value) throw new Error('Missing');
      return value.bytes;
    },
    store: async (block: BulletinBlock, intent) => {
      active++;
      peak = Math.max(peak, active);
      try {
        writes++;
        if (fail) throw new Error('synthetic uncertain store');
        const receipt: BulletinReceipt = { cid: block.cid, bytes: block.bytes.length, block: ++head, index: 0, expiresAt: 100000, finalized: true };
        nonce = Math.max(nonce, intent.nonce + 1);
        stored.set(block.cid, { bytes: block.bytes, receipt });
        const value = { ...receipt, account: profile.account, nonce: intent.nonce };
        submissions.set(intent.nonce, value);
        return value;
      } finally {
        active--;
      }
    }
  };
  const reserves: Array<{ transactions: number; bytes: number }> = [];
  const deps: PublisherDependencies = {
    loadSigner: async () => ({
      account: profile.account,
      createTransaction: getTxCreator(new Uint8Array(32), 'Sr25519', () => {
        throw new Error('No network signatures');
      }),
      dispose() {}
    }),
    openSession: (_profile, _signer, reserve) => {
      reserves.push(reserve);
      return { transport, close() {} };
    }
  };
  return {
    root,
    queue,
    profile,
    profileFile,
    policyFile,
    policy,
    owner,
    cover,
    metadata,
    transport,
    stored,
    reserves,
    deps,
    options: { provider: 'bulletin' as const, queue, profileFile, assetPolicyFile: policyFile, assetAuthority: async () => allowed },
    get writes() {
      return writes;
    },
    get peak() {
      return peak;
    },
    set allowed(value: boolean) {
      allowed = value;
    },
    set fail(value: boolean) {
      fail = value;
    }
  };
}
