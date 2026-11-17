import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { buildBulletinDirectoryGraph } from './bulletinGraph.js';
import { bulletinDependencies, bulletinWave, legacyPipelineSchema, pipelineSchema, planBulletinWaves, scheduleBulletinGraph } from './bulletinPipeline.js';

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

test('dependency priority removes a trailing stage without changing graph bytes, bounds or parent/root barriers', async () => {
  const file = (path: string, size: number) => ({ path, bytes: createHash('shake256', { outputLength: size }).update(path).digest() });
  const files = [file('archive/master.bin', 2_302_881), file('manifest.json', 11_080)];
  for (const [quality, size] of [
    [96, 48_000],
    [160, 84_000],
    [320, 156_000]
  ]) {
    files.push(file(`${quality}/init.bin`, 800));
    for (let i = 0; i < 23; i++) files.push(file(`${quality}/segment-${String(i).padStart(3, '0')}.bin`, size));
  }
  const graph = {
    ...(await buildBulletinDirectoryGraph(files, new AbortController().signal)),
    scope: { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v2' },
    generation: 'synthetic'
  };
  const original = [...graph.blocks],
    dependencies = bulletinDependencies(graph);
  const pipeline = { concurrency: 2, maxInFlightBytes: 524288, writeWindow: { concurrency: 16, maxInFlightBytes: 4194304 } };
  const plan = planBulletinWaves(graph, pipeline);
  assert.equal(graph.blocks.length, 88);
  assert.equal(plan.legacyWaveCount, 9);
  assert.equal(plan.waveCount, 8);
  assert.equal(plan.ordering, 'dependency');
  for (const count of [0, 1, 17, 40]) {
    const receipts: Record<string, true> = Object.fromEntries(original.slice(0, count).map(b => [b.cid, true]));
    const selected = scheduleBulletinGraph(graph, receipts, dependencies, pipeline);
    assert(selected.waves.length <= selected.legacyWaveCount);
    while (Object.keys(receipts).length < original.length) {
      const wave = bulletinWave(selected.graph, receipts, dependencies, pipeline.writeWindow);
      assert(wave.length <= 16 && wave.reduce((n, b) => n + b.bytes.length, 0) <= 4194304);
      for (const block of wave) {
        assert(dependencies.get(block.cid)!.every(cid => receipts[cid]));
        if (block.cid === graph.root) assert.equal(Object.keys(receipts).length, original.length - 1);
      }
      for (const block of wave) receipts[block.cid] = true;
    }
  }
  assert.deepEqual(graph.blocks, original, 'The journal graph order and every CID/byte view are unchanged');
  assert.equal(planBulletinWaves(graph, { concurrency: 2, maxInFlightBytes: 524288 }).ordering, 'file');
  for (const bytes of [262144, 524288, 1048576]) {
    const bounded = planBulletinWaves(graph, { ...pipeline, writeWindow: { concurrency: 16, maxInFlightBytes: bytes } });
    assert(bounded.waveCount <= bounded.legacyWaveCount);
    assert(bounded.waves.every(w => w.bytes <= bytes));
  }
});
