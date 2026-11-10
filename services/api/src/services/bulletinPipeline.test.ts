import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBulletinDirectoryGraph } from './bulletinGraph.js';
import { legacyPipelineSchema, pipelineSchema, planBulletinWaves } from './bulletinPipeline.js';

test('the opt-in window reduces synthetic finalized stages while byte and root barriers remain', async () => {
  const graph = {
    ...(await buildBulletinDirectoryGraph(
      Array.from({ length: 33 }, (_, i) => ({ path: `part-${i}.bin`, bytes: Buffer.alloc(250 * 1024, i) })),
      new AbortController().signal
    )),
    scope: { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v2' },
    generation: 'synthetic'
  };
  const legacy = { concurrency: 2, maxInFlightBytes: 512 * 1024 };
  const counts = [2, 4, 8, 16].map(concurrency => {
    const plan = planBulletinWaves(graph, { ...legacy, writeWindow: { concurrency, maxInFlightBytes: 4 * 1024 * 1024 } });
    assert(plan.waves.every(w => w.blocks <= concurrency && w.bytes <= 4 * 1024 * 1024));
    assert.equal(plan.waves.at(-1)!.blocks, 1);
    return plan.waveCount;
  });
  assert.deepEqual(counts, [18, 10, 6, 4]);
  assert.equal(planBulletinWaves(graph, legacy).waveCount, 18);
  assert.equal(planBulletinWaves(graph, { ...legacy, writeWindow: { concurrency: 16, maxInFlightBytes: 512 * 1024 } }).waveCount, 18);
  assert.deepEqual(legacyPipelineSchema.parse(legacy), legacy);
  assert.throws(() => legacyPipelineSchema.parse({ ...legacy, writeWindow: { concurrency: 16, maxInFlightBytes: 4 * 1024 * 1024 } }));
  for (const window of [
    { concurrency: 17, maxInFlightBytes: 1 },
    { concurrency: 1, maxInFlightBytes: 4 * 1024 * 1024 + 1 }
  ])
    assert.throws(() => pipelineSchema.parse({ ...legacy, writeWindow: window }));
});
