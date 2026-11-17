// Cross-boundary offline rehearsal. Real custody/jobs/crypto/signatures/access
// resolution; simulated RPC/catalog/Bulletin. Never an artist or live wallet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Socket } from 'node:net';
import { generatedWav } from './generated-source.mjs';
import { buildDirectory, readPath } from './graph.mjs';
import { blakeGraph } from './readdress-aac.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { initializeBulletinPublisher } from '../../services/api/src/services/bulletinPublisherProfile.ts';
import { createStreamingPublicationStore } from '../../services/api/src/services/streamingPublicationStore.ts';
import { buildBulletinMediaGraph } from '../../services/api/src/services/bulletinGraph.ts';
import { StreamingJobs } from '../../services/api/src/services/streamingJobs.ts';
import { transcodeStreamingAudio } from '../../services/api/src/services/streamingTranscoder.ts';
import { deriveContentKey, deriveContentKeyBytes } from '../../services/api/src/services/keyVault.ts';
import { catalogSnapshotSchema } from '../../services/api/src/services/catalog/types.ts';
import { createChainAccessService } from '../../services/api/src/services/chainAccess.ts';
import { createKeyRoutes } from '../../services/api/src/routes/keys.ts';
import { createMediaRoutes } from '../../services/api/src/routes/media.ts';
import { createMediaDeliveryReader } from '../../services/api/src/services/mediaDelivery.ts';
import { BULLETIN_MEDIA_GENESIS } from '../../services/api/src/services/bulletinHttpReader.ts';
import { createBulletinHostMediaReader } from '../../web/src/features/catalog/bulletinHostMedia.ts';
import {
  buildSignedRequestMessage,
  createWalletNonceChallenge,
  verifySignedRequest,
  deriveProductAccountH160
} from '../../services/api/src/services/signatures.ts';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';

const apiRequire = createRequire(new URL('../../services/api/package.json', import.meta.url));
const { default: Fastify } = await import(apiRequire.resolve('fastify'));
const { generatePrivateKey, privateKeyToAccount } = await import(apiRequire.resolve('viem/accounts'));
const { getPublicKey, secretFromSeed, sign } = await import(apiRequire.resolve('@scure/sr25519'));
const { blake2b } = await import(apiRequire.resolve('@noble/hashes/blake2'));
const hex = bytes => `0x${Buffer.from(bytes).toString('hex')}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const CHAIN = 420420417;
const ARTIST = `0x${'11'.repeat(20)}`,
  RUNTIME = `0x${'22'.repeat(20)}`,
  DIRECTORY = `0x${'33'.repeat(20)}`;
const budget = { maxBytes: 1024 * 1024, maxTransactions: 64 };

async function ledgerSnapshot(directory) {
  const result = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    result[entry.name] = entry.isDirectory() ? await ledgerSnapshot(join(directory, entry.name)) : hash(await readFile(join(directory, entry.name)));
  }
  return result;
}

// Only RPC responses are replaced; the canonical-release and entitlement
// decisions are made by the application's unchanged access service.
function runtimeModel() {
  let candidate;
  let block = 102;
  let unavailable = false;
  let active = true;
  let registeredRef;
  let stale = false;
  const entitled = new Set();
  const client = {
    async getBlock() {
      if (unavailable) throw new Error('simulated RPC unavailable');
      return { number: BigInt(block), hash: `0x${block.toString(16).padStart(64, '0')}` };
    },
    async readContract(input) {
      if (unavailable) throw new Error('simulated RPC unavailable');
      if (input.functionName === 'runtimeOf') {
        assert.equal(input.address, DIRECTORY);
        return input.args[0].toLowerCase() === ARTIST ? RUNTIME : `0x${'00'.repeat(20)}`;
      }
      assert.ok(input.blockHash && input.requireCanonical, 'Access must read a canonical block');
      assert.equal(input.address, RUNTIME);
      assert.equal(input.args[0], candidate.hash);
      if (input.functionName === 'musicRegGetTrack') return [{ artist: ARTIST, audioRef: registeredRef, active }, ARTIST];
      if (input.functionName === 'musicAccCanAccess') return entitled.has(input.args[1].toLowerCase());
      throw new Error('Unexpected RPC read');
    }
  };
  const catalog = {
    getMetadata: () => ({
      state: stale ? 'stale-cache' : 'fresh',
      cacheAvailable: true,
      indexedAt: new Date().toISOString(),
      lastIndexedBlock: block,
      chainHeadBlock: block,
      blockLag: 0,
      staleAfterMs: 60_000,
      lastErrorCode: null
    }),
    getSnapshot: () =>
      candidate
        ? catalogSnapshotSchema.parse({
            schemaVersion: 1,
            chainId: CHAIN,
            directoryAddress: DIRECTORY,
            lastIndexedBlock: block,
            lastIndexedBlockHash: `0x${block.toString(16).padStart(64, '0')}`,
            chainHeadBlock: block,
            indexedAt: new Date().toISOString(),
            reconciledAt: new Date().toISOString(),
            artists: [
              {
                artistAddress: ARTIST,
                runtimeAddress: RUNTIME,
                name: 'Generated artist model',
                releaseCount: 1,
                activeReleaseCount: 1,
                latestReleaseBlock: 100
              }
            ],
            releases: [candidate]
          })
        : null
  };
  const access = createChainAccessService({ getClient: () => client, getDirectoryAddress: () => DIRECTORY, getChainId: () => CHAIN, catalog });
  return {
    access,
    catalog,
    register(scope, ref) {
      registeredRef = ref;
      candidate = {
        id: `${RUNTIME}:${scope.contentHash}`,
        hash: scope.contentHash,
        runtimeAddress: RUNTIME,
        artistAddress: ARTIST,
        audioRef: ref,
        active: true,
        encrypted: true,
        sourceBlock: block,
        accessMode: 'classic',
        tokenId: '1',
        title: 'Generated protected chord',
        artist: 'Generated artist model',
        description: 'Offline synthetic rehearsal',
        imageRef: '',
        coverVariants: [],
        metadataRef: '',
        bulletinRef: '',
        artistContractRef: '',
        priceWei: '1',
        priceDot: '0.000000000000000001',
        personhoodLevel: 'DIM1',
        royaltyBps: 10000,
        royaltySplits: [{ label: 'Artist', recipient: ARTIST, bps: 10000 }],
        registeredAtBlock: 100
      };
      return { releaseId: candidate.id, runtimeAddress: RUNTIME, artistAddress: ARTIST, audioRef: ref, keyVersion: scope.keyVersion };
    },
    grant(address) {
      entitled.add(address.toLowerCase());
      block++;
    },
    revoke(address) {
      entitled.delete(address.toLowerCase());
      block++;
    },
    outage(value) {
      unavailable = value;
      block++;
    },
    deactivate() {
      active = false;
      block++;
    },
    replaceRef(value) {
      registeredRef = value;
      block++;
    },
    stale(value) {
      stale = value;
      block++;
    }
  };
}

async function fixture(t) {
  assert.equal(process.env.DOTIFY_PROTECTED_REHEARSAL, 'isolated-offline', 'Use npm run test:protected for credential isolation');
  for (const name of ['DATABASE_URL', 'MNEMONIC', 'PINATA_JWT', 'CONTENT_KEY_MASTER_SECRET', 'CONTENT_KEY_MASTER_SECRETS', 'NODE_OPTIONS'])
    assert.equal(process.env[name], undefined, `${name} must not enter the rehearsal`);
  const master = generatedWav(8);
  const custodySecret = randomBytes(32);
  const vault = {
    contentKeyMasterSecret: custodySecret.toString('hex'),
    contentKeyMasterSecrets: '',
    contentKeyActiveVersion: 'dotify-content-key-v2',
    chainId: CHAIN
  };
  const scope = { chainId: CHAIN, runtimeAddress: RUNTIME, contentHash: hex(blake2b(master, { dkLen: 32 })), keyVersion: 'dotify-content-key-v2' };
  const key = deriveContentKeyBytes(scope, vault);
  assert.ok(key);
  t.after(() => {
    master.fill(0);
    key.fill(0);
    custodySecret.fill(0);
    vault.contentKeyMasterSecret = '';
  });
  const directory = join(process.cwd(), 'custody');
  const chain = new SimulatedChain();
  chain.account = '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca'; // Public identity only; storage signatures remain offline models.
  let nextNonce = 10;
  const submissions = new Map();
  const storeBlock = chain.store.bind(chain);
  chain.nextNonce = async () => ({ nonce: nextNonce, head: chain.head });
  chain.lookupSubmission = async ({ nonce }) => submissions.get(nonce) ?? null;
  chain.store = async (block, { nonce }) => {
    assert.ok(!submissions.has(nonce), 'No duplicate model nonce');
    chain.advance(1);
    const receipt = { ...(await storeBlock(block)), nonce, account: chain.account };
    submissions.set(nonce, receipt);
    while (submissions.has(nextNonce)) nextNonce++;
    return receipt;
  };
  const model = runtimeModel();
  const storageDirectory = join(process.cwd(), 'bulletin-publications');
  const identity = { genesis: chain.genesis, account: chain.account };
  const profile = {
    schema: 'dotify.bulletin.publisher.v1',
    ...identity,
    endpoint: 'wss://offline-bulletin.example',
    directory: storageDirectory,
    seedFile: join(process.cwd(), 'never-opened-storage.seed'),
    budget: { ...budget, minimumLifetimeBlocks: 100 },
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    priorRenewalReserve: { transactions: 0, bytes: 0 }
  };
  const profileFile = join(process.cwd(), 'publisher-profile.json');
  await writeFile(profileFile, JSON.stringify(profile), { mode: 0o600 });
  await initializeBulletinPublisher(directory, profile);
  const storage = await createStreamingPublicationStore(
    { provider: 'bulletin', queue: directory, profileFile },
    {
      loadSigner: async () => ({
        account: identity.account,
        createTransaction: () => {
          throw new Error('Offline rehearsal must never sign a storage transaction');
        },
        dispose() {}
      }),
      openSession: (_profile, _signer, reserve) => {
        assert.deepEqual(reserve, { transactions: 0, bytes: 0 });
        return { transport: chain, close() {} };
      }
    }
  );
  t.after(() => storage.close());
  let encodes = 0,
    graph,
    files,
    attempts = 0;
  const deps = {
    directory,
    deriveKey: scope => deriveContentKeyBytes(scope, vault),
    authority: async (owner, runtime, chainId) => {
      const result = await model.access.checkArtistAuthority(owner);
      return chainId === CHAIN && result.allowed && result.runtime === runtime;
    },
    transcode: async (bytes, signal) => {
      encodes++;
      return transcodeStreamingAudio({ master: bytes, signal });
    },
    canDiscard: storage.canDiscard,
    pin: async (value, name, signal) => {
      signal.throwIfAborted();
      files = value;
      graph = await buildBulletinMediaGraph(files, signal);
      const prototype = await blakeGraph(await buildDirectory(files));
      assert.equal(graph.root, prototype.root, 'Server adapter must preserve the physically tested BLAKE2b directory identity');
      attempts++;
      const root = await storage.pin(files, name, signal);
      signal.throwIfAborted();
      return root;
    }
  };
  return {
    master,
    key,
    custodySecret,
    scope,
    vault,
    chain,
    model,
    deps,
    directory,
    get graph() {
      return graph;
    },
    get files() {
      return files;
    },
    get encodes() {
      return encodes;
    },
    get attempts() {
      return attempts;
    }
  };
}

async function signedRequest(account, scope, release, purpose = 'individual') {
  const challenge = await createWalletNonceChallenge({ address: account.address, chainId: CHAIN });
  const payload = {
    action: 'REQUEST_CONTENT_KEY',
    purpose,
    contentHash: scope.contentHash,
    requester: account.address,
    chainId: CHAIN,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    release
  };
  const signature = await account.signMessage({ message: buildSignedRequestMessage(payload) });
  return {
    requester: payload.requester,
    chainId: CHAIN,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
    purpose,
    ...release,
    signature,
    ...(account.proof ?? {})
  };
}

function productAccount() {
  const secret = secretFromSeed(randomBytes(32));
  const pub = getPublicKey(secret);
  return {
    address: deriveProductAccountH160(pub),
    proof: { signatureScheme: 'product-sr25519-v1', productPublicKey: hex(pub) },
    signMessage: async ({ message }) => hex(sign(secret, new TextEncoder().encode(message))),
    dispose: () => secret.fill(0)
  };
}

async function keyApi(c, t) {
  const app = Fastify({ logger: false });
  t.after(() => app.close());
  let derivations = 0;
  await app.register(
    createKeyRoutes({
      verifySignedRequest,
      verifySessionToken: () => ({ valid: false, code: 'NO_SESSION', reason: 'This rehearsal uses signed requests' }),
      checkTrackAccess: c.model.access.checkTrackAccess,
      checkPublicAccess: c.model.access.checkPublicAccess,
      deriveContentKey: scope => {
        derivations++;
        return deriveContentKey(scope, c.vault);
      }
    }),
    { prefix: '/api/tracks' }
  );
  await app.register(
    createMediaRoutes({
      catalog: c.model.catalog,
      reader: createMediaDeliveryReader({
        bulletinRpcUrl: 'https://bulletin.offline.example',
        fetchImpl: async (url, init) => {
          assert.equal(url, 'https://bulletin.offline.example');
          assert.equal(init.credentials, 'omit');
          assert.equal(init.redirect, 'error');
          const body = JSON.parse(init.body);
          assert.ok(['chain_getBlockHash', 'bitswap_v1_get'].includes(body.method));
          const result = body.method === 'chain_getBlockHash' ? BULLETIN_MEDIA_GENESIS : hex(await c.chain.readBlock(body.params[0]));
          return Response.json({ jsonrpc: '2.0', id: 1, result });
        }
      })
    })
  );
  return {
    app,
    get derivations() {
      return derivations;
    },
    request: body => app.inject({ method: 'POST', url: `/api/tracks/${c.scope.contentHash}/key-request`, payload: body })
  };
}

async function assertPlayable(c, deliveredKey, api) {
  c.chain.reads.length = 0;
  const host = createBulletinHostMediaReader({
    insideHost: () => true,
    queryBytes: async (cid, options) => {
      assert.deepEqual(options, { noReassemble: true, lookupTimeoutMs: 10_000 });
      return { ok: true, value: await c.chain.readBlock(cid) };
    }
  });
  // Both actual application adapters must deliver identical ciphertext. The
  // private key comes only from the separately signed canonical access route.
  const read = async (path, maximum) => {
    const native = await host(c.graph.root, path, maximum, new AbortController().signal);
    const web = await api.app.inject(`/api/media/${c.graph.root}/stream/${path}`);
    assert.equal(web.statusCode, 200);
    assert.equal(web.headers['cache-control'], 'no-store');
    assert.deepEqual(Buffer.from(native), web.rawPayload, 'Host and Web must read the same Bulletin ciphertext');
    return native;
  };
  const manifest = parseStreamingManifest(await read('manifest.json', 256 * 1024));
  verifyStreamingManifest(manifest, deliveredKey, c.scope);
  const archiveDependencies = new Set();
  await readPath(
    async cid => {
      archiveDependencies.add(cid);
      return c.graph.blocks.find(b => b.cid === cid).bytes;
    },
    c.graph.root,
    'archive/master.bin'
  );
  for (const rendition of manifest.renditions) {
    const clear = [];
    for (const object of [rendition.init, ...rendition.segments]) {
      const bytes = await read(object.path, object.encryptedLength);
      clear.push(decryptStreamingObject(bytes, deliveredKey, manifest, object));
    }
    const media = join(process.cwd(), `decoded-${rendition.bitrateKbps}.mp4`);
    await writeFile(media, Buffer.concat(clear), { mode: 0o600 });
    clear.forEach(bytes => bytes.fill(0));
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-show_entries', 'format=duration', '-of', 'json', media], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
      timeout: 10_000
    });
    assert.equal(probe.status, 0, 'Decrypted AAC must retain its media metadata');
    const info = JSON.parse(probe.stdout);
    assert.equal(info.streams[0].codec_name, 'aac');
    assert.ok(Math.abs(Number(info.format.duration) - 8) < 0.1);
    const decode = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-i', media, '-f', 'null', '-'], {
      env: { PATH: process.env.PATH },
      timeout: 30_000
    });
    assert.equal(decode.status, 0, 'Every decrypted AAC frame must decode');
  }
  const masterOnly = c.graph.blocks.filter(b => b.codec === 0x55 && archiveDependencies.has(b.cid));
  assert.ok(masterOnly.length > 0);
  assert.ok(
    masterOnly.every(b => !c.chain.reads.includes(b.cid)),
    'Playback must never fetch archival raw blocks'
  );
  return manifest;
}

test('protected release: custody retry, canonical signed access, selective Bulletin decryption and denial', { timeout: 120_000 }, async t => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network fetch forbidden in offline rehearsal');
  });
  t.mock.method(Socket.prototype, 'connect', () => {
    throw new Error('Network socket forbidden in offline rehearsal');
  });
  const c = await fixture(t);
  const store = c.chain.store.bind(c.chain);
  c.chain.store = async (block, intent) => {
    const receipt = await store(block, intent);
    if (c.chain.stores.length === 3) throw new Error('simulated lost storage acknowledgement');
    return receipt;
  };
  let jobs = new StreamingJobs(c.deps);
  await jobs.start(false);
  t.after(() => jobs.stop());
  const input = { owner: ARTIST, scope: c.scope, master: c.master };
  const job = await jobs.enqueue(input);
  await jobs.runNext();
  assert.equal(jobs.get(job.id, ARTIST, CHAIN).state, 'failed');
  assert.equal(c.encodes, 1);
  const before = await ledgerSnapshot(join(c.directory, 'nonces'));
  const firstRoot = c.graph.root;
  const firstFiles = c.files.map(f => [f.path, hash(f.bytes)]);
  const ledger = await readFile(join(process.cwd(), 'bulletin-publications', `stream-${job.id}.json`), 'utf8');
  assert.ok(Object.keys(JSON.parse(ledger).pending).length, 'Uncertain submission must remain journalled');
  assert.ok(!ledger.includes(c.key.toString('hex')) && !ledger.includes(c.vault.contentKeyMasterSecret));
  await jobs.stop();
  c.chain.store = store;
  jobs = new StreamingJobs(c.deps);
  await jobs.start(false);
  await jobs.retry(job.id, ARTIST, CHAIN);
  await jobs.runNext();
  const ready = jobs.get(job.id, ARTIST, CHAIN);
  assert.equal(ready.state, 'ready');
  assert.equal(c.encodes, 1, 'Retry must reuse encrypted outputs, never encrypt again');
  assert.equal(c.attempts, 2);
  assert.equal(c.graph.root, firstRoot);
  assert.deepEqual(
    c.files.map(f => [f.path, hash(f.bytes)]),
    firstFiles
  );
  assert.deepEqual(await ledgerSnapshot(join(c.directory, 'nonces')), before);
  assert.equal(new Set(c.chain.stores).size, c.chain.stores.length, 'Reconcile the lost acknowledgement without duplicate stores');
  assert.equal(c.chain.stores.length, c.graph.blocks.length);
  assert.equal(c.chain.renewals.length, 0);
  assert.equal(ready.result.ref, `dotify:enc:v3:key-v2:ipfs://${c.graph.root}`);
  assert.deepEqual(await readdir(join(c.directory, 'jobs')), [], 'Ready ciphertext staging is cleaned, nonce ledger retained');
  const release = c.model.register(c.scope, ready.result.ref);
  const api = await keyApi(c, t);
  const wallet = privateKeyToAccount(generatePrivateKey());
  const product = productAccount();
  t.after(() => product.dispose());
  const denial = await api.request(await signedRequest(wallet, c.scope, release));
  assert.equal(denial.statusCode, 200, denial.statusCode !== 200 ? denial.body : '');
  assert.equal(denial.json().access, 'denied');
  assert.equal(denial.json().reason, 'LISTENER_ACCESS_REQUIRED');
  assert.equal('contentKey' in denial.json(), false);
  assert.equal(api.derivations, 0);
  for (const account of [wallet, product]) {
    c.model.grant(account.address);
    const body = await signedRequest(account, c.scope, release);
    const response = await api.request(body);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.json().access, 'allowed');
    const key = Buffer.from(response.json().contentKey.slice(2), 'hex');
    try {
      await assertPlayable(c, key, api);
    } finally {
      key.fill(0);
    }
    const replay = await api.request(body);
    assert.equal(replay.statusCode, 401);
    assert.equal(replay.json().code, 'NONCE_REUSED');
  }
  assert.equal(api.derivations, 2);
  const none = (response, expectedStatus) => {
    assert.equal(response.statusCode, expectedStatus);
    assert.equal('contentKey' in response.json(), false);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(api.derivations, 2);
  };
  await t.test('public lookup of the Classic release gives no key', async () => {
    const free = await api.app.inject({ method: 'POST', url: `/api/tracks/${c.scope.contentHash}/free-key`, payload: release });
    none(free, 200);
    assert.equal(free.json().reason, 'NOT_FREE');
  });
  await t.test('room guest cannot request a content key', async () => {
    none(await api.request({ ...(await signedRequest(wallet, c.scope, release)), purpose: 'room_listener' }), 400);
  });
  await t.test('forged signature and changed signed reference give no key', async () => {
    const forged = await signedRequest(wallet, c.scope, release);
    forged.signature = `0x${'00'.repeat(65)}`;
    none(await api.request(forged), 401);
    const rebound = await signedRequest(wallet, c.scope, release);
    rebound.audioRef = `${release.audioRef}a`;
    none(await api.request(rebound), 401);
  });
  await t.test('valid signature cannot override the canonical audio reference', async () => {
    const wrongIdentity = await api.request(await signedRequest(wallet, c.scope, { ...release, audioRef: `${release.audioRef}a` }));
    none(wrongIdentity, 200);
    assert.equal(wrongIdentity.json().reason, 'RELEASE_IDENTITY_MISMATCH');
    c.model.replaceRef(`${release.audioRef}a`);
    const replaced = await api.request(await signedRequest(product, c.scope, release));
    none(replaced, 200);
    assert.equal(replaced.json().reason, 'RELEASE_IDENTITY_MISMATCH');
    c.model.replaceRef(release.audioRef);
  });
  await t.test('revocation denies a previously authorized listener and room host', async () => {
    c.model.revoke(wallet.address);
    const listener = await api.request(await signedRequest(wallet, c.scope, release));
    none(listener, 200);
    assert.equal(listener.json().reason, 'LISTENER_ACCESS_REQUIRED');
    const host = await api.request(await signedRequest(wallet, c.scope, release, 'room_host'));
    none(host, 200);
    assert.equal(host.json().reason, 'HOST_ACCESS_REQUIRED');
  });
  await t.test('RPC outage and stale catalog fail closed after a successful grant', async () => {
    c.model.outage(true);
    const outage = await api.request(await signedRequest(product, c.scope, release));
    none(outage, 200);
    assert.equal(outage.json().reason, 'RPC_UNAVAILABLE');
    c.model.outage(false);
    c.model.stale(true);
    const stale = await api.request(await signedRequest(product, c.scope, release));
    none(stale, 200);
    assert.equal(stale.json().reason, 'CATALOG_UNAVAILABLE');
    c.model.stale(false);
  });
  await t.test('inactive runtime release gives no key', async () => {
    c.model.deactivate();
    const inactive = await api.request(await signedRequest(product, c.scope, release));
    none(inactive, 200);
    assert.equal(inactive.json().reason, 'RELEASE_INACTIVE');
  });
});
