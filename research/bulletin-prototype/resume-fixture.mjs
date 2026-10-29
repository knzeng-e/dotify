// Test-only subprocess: all remote state is a serialized in-memory model.
// No network transport, credential loader, encoder or key is available here.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { publish } from './publication.mjs';
import { SimulatedChain } from './simulated-chain.mjs';

const bytes = await readFile(process.argv[2]);
assert.ok(bytes.length <= 8 * 1024 * 1024, 'Serialized fixture exceeds budget');
const saved = JSON.parse(bytes.toString());
const graph = { ...saved.graph, blocks: saved.graph.blocks.map(block => ({ ...block, bytes: Buffer.from(block.bytes, 'base64') })) };
const chain = new SimulatedChain();
chain.stores = saved.stores;
chain.blocks = new Map(saved.blocks.map(([cid, block]) => [cid, { ...block, bytes: Buffer.from(block.bytes, 'base64') }]));
const result = await publish(graph, chain, process.argv[3], { maxTransactions: 64, maxBytes: 4 * 1024 * 1024 });
console.log(JSON.stringify({ ...result, totalStoreCalls: chain.stores.length, networkWrites: 0 }));
