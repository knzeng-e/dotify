// Synthetic geometry only: no artist files, key, RPC or transaction.
import { randomBytes } from 'node:crypto';
import { buildBulletinDirectoryGraph } from '../dist/services/bulletinGraph.js';
import { planBulletinWaves } from '../dist/services/bulletinPipeline.js';

const files = [
  { path: 'archive/master.bin', bytes: randomBytes(17_045_866) },
  { path: 'manifest.json', bytes: randomBytes(11_080) }
];
for (const [quality, size] of [
  [96, 48_000],
  [160, 84_000],
  [320, 156_000]
]) {
  files.push({ path: `${quality}/init.bin`, bytes: randomBytes(800) });
  for (let i = 0; i < 25; i++) files.push({ path: `${quality}/segment-${String(i).padStart(3, '0')}.bin`, bytes: randomBytes(size) });
}
const graph = {
  ...(await buildBulletinDirectoryGraph(files, new AbortController().signal)),
  scope: { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v2' },
  generation: 'synthetic-geometry'
};
const schedules = [2, 4, 8, 16].map(concurrency => {
  const result = planBulletinWaves(graph, {
    concurrency: 2,
    maxInFlightBytes: 512 * 1024,
    ...(concurrency === 2 ? {} : { writeWindow: { concurrency, maxInFlightBytes: concurrency * 256 * 1024 } })
  });
  return {
    writeConcurrency: concurrency,
    readConcurrency: 2,
    maxInFlightBytes: result.writeLimits.maxInFlightBytes,
    waves: result.waveCount,
    peakWaveBlocks: Math.max(...result.waves.map(w => w.blocks)),
    peakWaveBytes: Math.max(...result.waves.map(w => w.bytes))
  };
});
console.log(
  JSON.stringify(
    {
      schema: 'dotify.bulletin.window-model.v1',
      synthetic: true,
      artistDataUsed: false,
      graph: { blocks: graph.blocks.length, bytes: graph.bytes },
      schedules,
      model: 'equal-duration finalized waves; not an ETA or evidence of inclusion capacity/throughput',
      networkWrites: 0
    },
    null,
    2
  )
);
