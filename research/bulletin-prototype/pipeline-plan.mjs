import assert from 'node:assert/strict';
import * as dagPB from '@ipld/dag-pb';
import { verifyGraph } from './graph.mjs';
import { pipelineLimits } from './pipeline.mjs';

/** Equal-duration waves are a scheduling model, never a wall-clock estimate. */
export async function planPipeline(graph, options = {}) {
  await verifyGraph(graph, options);
  const limits = pipelineLimits(options);
  assert.ok(
    graph.blocks.every(b => b.bytes.length <= limits.maxInFlightBytes),
    'A block exceeds the in-flight byte bound'
  );
  const remaining = new Set(graph.blocks.map(b => b.cid)),
    done = new Set(),
    waves = [];
  while (remaining.size) {
    const selected = [];
    let bytes = 0;
    for (const block of graph.blocks) {
      if (!remaining.has(block.cid)) continue;
      const children = block.codec === dagPB.code ? dagPB.decode(block.bytes).Links.map(l => l.Hash.toString()) : [];
      if (!children.every(cid => done.has(cid)) || (block.cid === graph.root && done.size !== graph.blocks.length - 1)) continue;
      if (selected.length >= limits.concurrency || bytes + block.bytes.length > limits.maxInFlightBytes) continue;
      selected.push(block.cid);
      bytes += block.bytes.length;
    }
    assert.ok(selected.length, 'No schedulable wave');
    waves.push({ cids: selected, bytes });
    for (const cid of selected) {
      remaining.delete(cid);
      done.add(cid);
    }
  }
  return {
    schema: 'dotify.bulletin.pipeline-plan.v1',
    root: graph.root,
    blocks: graph.blocks.length,
    bytes: graph.bytes,
    ...limits,
    serialFinalityWaves: graph.blocks.length,
    modeledFinalityWaves: waves.length,
    waves,
    model: 'all blocks take one equal-duration stage; no network or time prediction',
    networkWrites: 0
  };
}
