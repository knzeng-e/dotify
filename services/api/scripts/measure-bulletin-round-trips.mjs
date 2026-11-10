// Offline only: deterministic synthetic geometry and a captured public receipt.
// No artist input, configuration, key, RPC endpoint or signing is loaded.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildBulletinDirectoryGraph } from '../dist/services/bulletinGraph.js';
import { planBulletinWaves } from '../dist/services/bulletinPipeline.js';
import { createBulletinRpcTransport } from '../dist/services/bulletinTransport.js';
// Run with node --import tsx; test fixtures are deliberately excluded from dist.
import { fixture, rpcFixture } from '../src/services/bulletinTransport.fixture.ts';

const file = (path, size) => ({ path, bytes: createHash('shake256', { outputLength: size }).update(path).digest() });
const pipeline = { concurrency: 2, maxInFlightBytes: 524288, writeWindow: { concurrency: 16, maxInFlightBytes: 4194304 } };
async function audio(masterBytes, segments) {
  const files = [file('archive/master.bin', masterBytes), file('manifest.json', 11080)];
  for (const [quality, size] of [
    [96, 48000],
    [160, 84000],
    [320, 156000]
  ]) {
    files.push(file(`${quality}/init.bin`, 800));
    for (let i = 0; i < segments; i++) files.push(file(`${quality}/segment-${String(i).padStart(3, '0')}.bin`, size));
  }
  return files;
}
const inputs = [
  ['small-archive-audio', await audio(2302881, 23)],
  ['large-archive-audio', await audio(17045866, 25)],
  ['cover', ['placeholder', '64', '160', '320', '640', 'original'].map((n, i) => file(`cover/${n}.bin`, [200, 800, 2000, 8000, 32000, 97000][i]))],
  ['metadata', [file('release.json', 1024)]]
];
const schedules = [];
for (const [name, files] of inputs) {
  const graph = {
    ...(await buildBulletinDirectoryGraph(files, new AbortController().signal)),
    scope: { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v2' },
    generation: 'synthetic-geometry'
  };
  const plan = planBulletinWaves(graph, pipeline);
  schedules.push({
    name,
    blocks: graph.blocks.length,
    bytes: graph.bytes,
    fileOrderWaves: plan.legacyWaveCount,
    selectedWaves: plan.waveCount,
    ordering: plan.ordering
  });
}
const f = rpcFixture();
const transport = createBulletinRpcTransport({ identity: fixture.identity, request: f.request });
const count = calls => Object.fromEntries([...new Set(calls.map(c => c.method))].sort().map(method => [method, calls.filter(c => c.method === method).length]));
assert.deepEqual(await transport.lookupSubmission(fixture.query, new AbortController().signal), fixture.receipt);
const cold = count(f.calls),
  offset = f.calls.length;
for (let i = 0; i < 15; i++) assert.deepEqual(await transport.lookupSubmission(fixture.query, new AbortController().signal), fixture.receipt);
console.log(
  JSON.stringify(
    {
      schema: 'dotify.bulletin.roundtrip-model.v1',
      synthetic: true,
      artistDataUsed: false,
      networkWrites: 0,
      signerUsed: false,
      schedules,
      proofReplay: {
        validations: 16,
        sameCapturedReceipt: true,
        total: count(f.calls),
        firstCold: cold,
        next15Warm: count(f.calls.slice(offset)),
        receiptsReverified: true
      },
      limitations: [
        'Equal-duration stages, not an ETA or live throughput evidence.',
        'Proof replay uses repeated validation of one public captured receipt, not sixteen funded stores.',
        'Concurrent cold proof misses remain independent; reuse does not promise one load for simultaneous callers.',
        'The public-asset path geometry is unchanged and retains its serial dependency tail.'
      ]
    },
    null,
    2
  )
);
