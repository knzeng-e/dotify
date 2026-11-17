import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptedFixture } from './fixture.mjs';
import { buildDirectory, hostBlockReader, readPath } from './graph.mjs';
import { publish, requestRenewal, verifyRenewal } from './publication.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';

const directory = await mkdtemp(join(tmpdir(), 'dotify-bulletin-measure-'));
let fixture;
try {
  fixture = await encryptedFixture(directory);
  const graph = await buildDirectory(fixture.files);
  const chain = new SimulatedChain();
  const checkpoint = join(directory, 'checkpoint');
  const budget = { maxTransactions: 64, maxBytes: 4 * 1024 * 1024 };
  await publish(graph, chain, checkpoint, budget);
  const restart = await publish(graph, chain, checkpoint, budget);
  chain.reads.length = 0;
  const reader = hostBlockReader({ fetchBytes: async cid => ({ ok: true, value: await chain.readBlock(cid) }) });
  const started = performance.now();
  const manifestRead = await readPath(reader, graph.root, 'manifest.json');
  const manifest = parseStreamingManifest(manifestRead.bytes);
  verifyStreamingManifest(manifest, fixture.key, fixture.scope);
  let fetchedBytes = manifestRead.fetchedBytes;
  for (const object of [manifest.renditions[0].init, manifest.renditions[0].segments[0]]) {
    const read = await readPath(reader, graph.root, object.path);
    fetchedBytes += read.fetchedBytes;
    assert.deepEqual(decryptStreamingObject(read.bytes, fixture.key, manifest, object), fixture.originals.get(object.path));
  }
  const localReadAndDecryptMs = performance.now() - started;
  assert.ok(fetchedBytes < fixture.originals.get('archive/master.bin').length);
  const renewal = await requestRenewal(graph, chain, checkpoint, budget);
  assert.equal(renewal.retained, false);
  chain.advance(100);
  chain.settleRenewals();
  const confirmed = await verifyRenewal(graph, chain, checkpoint);
  const result = {
    observedAt: new Date().toISOString(),
    synthetic: true,
    networkWrites: 0,
    model: 'in-memory finalized block/expiry simulation; not a Bulletin node',
    encryption: 'actual Dotify v3 encryptor, nonce reservation, manifest verification and AEAD decoder',
    files: fixture.files.length,
    blocks: graph.blocks.length,
    graphBytes: graph.bytes,
    maxBlockBytes: Math.max(...graph.blocks.map(b => b.bytes.length)),
    startup: { fetchedBytes, localReadAndDecryptMs, fullMasterFetched: false, validAac: false, audibleFirstSoundMeasured: false },
    checkpointReopen: { reusedBlocks: restart.reusedBlocks, extraStoreCalls: restart.storedBlocks },
    renewal: { requested: renewal.requested, acknowledgedIsRetention: renewal.retained, verifiedBlocks: confirmed.verifiedBlocks },
    canaryBudget: { maxStoredBytes: graph.bytes, maxStoreAndOneRenewalTransactions: graph.blocks.length * 2 },
    liveReadWriteVerified: false,
    nativeHostVerified: false
  };
  await writeFile(new URL('./results.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  fixture?.key.fill(0);
  await rm(directory, { recursive: true, force: true });
}
