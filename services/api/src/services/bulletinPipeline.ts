// Bounded wave planning and observations; durable writes stay with their owner.
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as dagPB from '@ipld/dag-pb';
import type { BulletinBlock, BulletinGraph } from './bulletinGraph.js';

export const pipelineSchema = z
  .object({
    concurrency: z.number().int().min(1).max(4),
    maxInFlightBytes: z
      .number()
      .int()
      .min(1)
      .max(1024 * 1024)
  })
  .strict();
export type BulletinPipelineLimits = z.infer<typeof pipelineSchema>;
export const publicationError = (error: unknown): Error => (error instanceof Error ? error : new Error('Unknown Bulletin publication failure'));

/** Stop admitting reads on failure, and observe every already-started task. */
export async function observeBulletinBlocks<T>(blocks: BulletinBlock[], concurrency: number, read: (block: BulletinBlock) => Promise<T>): Promise<T[]> {
  const outcomes = new Array<T>(blocks.length);
  let cursor = 0,
    failure: Error | undefined;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, blocks.length) }, async () => {
      while (!failure && cursor < blocks.length) {
        const index = cursor++;
        try {
          outcomes[index] = await read(blocks[index]);
        } catch (error) {
          failure ??= publicationError(error);
        }
      }
    })
  );
  if (failure) throw failure;
  return outcomes;
}

export function bulletinDependencies(graph: BulletinGraph): Map<string, string[]> {
  const blocks = new Set(graph.blocks.map(block => block.cid));
  return new Map(
    graph.blocks.map(block => {
      const children = block.codec === dagPB.code ? dagPB.decode(block.bytes).Links.map(link => link.Hash.toString()) : [];
      assert.ok(
        children.every(cid => blocks.has(cid)),
        'Missing graph dependency'
      );
      return [block.cid, children];
    })
  );
}

/** A wave contains only independent blocks. Parents wait for verified receipts;
 * the root additionally waits for the entire graph, including archival data. */
export function bulletinWave(
  graph: BulletinGraph,
  receipts: Readonly<Record<string, unknown>>,
  dependencies: Map<string, string[]>,
  limits: BulletinPipelineLimits
): BulletinBlock[] {
  const wave: BulletinBlock[] = [];
  let bytes = 0;
  for (const block of graph.blocks) {
    if (receipts[block.cid] || !dependencies.get(block.cid)!.every(cid => receipts[cid])) continue;
    if (block.cid === graph.root && Object.keys(receipts).length !== graph.blocks.length - 1) continue;
    if (bytes + block.bytes.length > limits.maxInFlightBytes) continue;
    wave.push(block);
    bytes += block.bytes.length;
    if (wave.length === limits.concurrency) break;
  }
  assert.ok(wave.length, 'No dependency-ready block fits the Bulletin pipeline');
  return wave;
}
