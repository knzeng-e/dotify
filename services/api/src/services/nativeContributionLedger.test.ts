import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { encodeAbiParameters, encodeEventTopics, zeroAddress, zeroHash } from 'viem';
import { contributionsAbi } from '../generated/contributions.js';
import { NativeContributionLedger } from './nativeContributionLedger.js';
import { createContributionHistoryRoutes } from '../routes/contributionHistory.js';
import { PASEO_ASSET_HUB_GENESIS, type NativeReceiptResponse } from './nativeReceipts.js';
const runtime = `0x${'11'.repeat(20)}` as const;
const sender = `0x${'22'.repeat(20)}` as const;
const id = `0x${'33'.repeat(32)}` as const;
function receipt(n = 1): NativeReceiptResponse {
  const hash = `0x${n.toString(16).padStart(64, '0')}` as const;
  return {
    hash,
    genesisHash: PASEO_ASSET_HUB_GENESIS,
    status: 'success',
    block: { number: 123, hash: id },
    logs: [
      {
        address: runtime,
        transactionHash: hash,
        logIndex: 1,
        topics: encodeEventTopics({ abi: contributionsAbi, eventName: 'ContributionReceived', args: { id, contentHash: zeroHash, sender } }) as `0x${string}`[],
        data: encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
          [42n, zeroAddress, zeroHash, zeroHash, zeroHash, 100n]
        )
      },
      {
        address: runtime,
        transactionHash: hash,
        logIndex: 2,
        topics: encodeEventTopics({ abi: contributionsAbi, eventName: 'ContributionShare', args: { id, recipient: sender } }) as `0x${string}`[],
        data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }, { type: 'bool' }], [42n, 0, true])
      }
    ]
  };
}
async function fixture(run: (ledger: NativeContributionLedger, path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'dotify-contributions-'));
  const path = join(dir, 'history.json');
  try {
    await run(new NativeContributionLedger(path), path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
it('persists verified receipts across restarts and shares them by runtime without duplication', async () =>
  fixture(async (ledger, path) => {
    await Promise.all([ledger.record(receipt()), ledger.record(receipt()), ledger.record(receipt(2))]);
    const restored = new NativeContributionLedger(path);
    const history = await restored.history([runtime.toUpperCase()]);
    assert.equal(history.receipts.length, 2);
    assert.equal(history.coverage, 'verified-receipts');
    assert.equal((await restored.history([sender])).receipts.length, 0);
  }));
it('does not store failed, wrong-network or incomplete payment distributions', async () =>
  fixture(async ledger => {
    await ledger.record({ ...receipt(), status: 'failed', logs: [] });
    await assert.rejects(ledger.record({ ...receipt(), genesisHash: zeroHash }));
    await assert.rejects(ledger.record({ ...receipt(), logs: receipt().logs.slice(0, 1) }));
    assert.equal((await ledger.history([runtime])).receipts.length, 0);
  }));
it('a damaged snapshot is unavailable, never an empty history or overwritten data', async () =>
  fixture(async (ledger, path) => {
    await writeFile(path, '{broken');
    await assert.rejects(ledger.history([runtime]));
    await assert.rejects(ledger.record(receipt()));
  }));
it('bounds pages and rejects a mixed snapshot revision', async () =>
  fixture(async (ledger, path) => {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        genesisHash: PASEO_ASSET_HUB_GENESIS,
        updatedAt: new Date(1000).toISOString(),
        receipts: Array.from({ length: 101 }, (_, i) => receipt(i + 1))
      })
    );
    const first = await ledger.history([runtime]);
    assert.equal(first.receipts.length, 100);
    assert.equal(first.nextOffset, 100);
    assert.equal((await ledger.history([runtime], 100, first.updatedAt)).receipts.length, 1);
    await assert.rejects(ledger.history([runtime], 100, new Date(0).toISOString()));
  }));
it('public history route accepts only bounded runtime queries, never submitted logs', async () =>
  fixture(async ledger => {
    await ledger.record(receipt());
    const app = Fastify();
    await app.register(createContributionHistoryRoutes(ledger, true));
    try {
      const response = await app.inject({ method: 'POST', url: '/api/contributions/history', payload: { runtimes: [runtime] } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().receipts.length, 1);
      assert.equal(response.headers['cache-control'], 'no-store');
      for (const payload of [
        { runtimes: [runtime], logs: receipt().logs },
        { runtimes: ['invalid'] },
        { runtimes: Array(101).fill(runtime) },
        { runtimes: [runtime], offset: -1 }
      ])
        assert.equal((await app.inject({ method: 'POST', url: '/api/contributions/history', payload })).statusCode, 400);
    } finally {
      await app.close();
    }
  }));

it('allows a maximum-size history at the refresh cadence while retaining an IP rate bound', async () =>
  fixture(async (ledger, path) => {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        genesisHash: PASEO_ASSET_HUB_GENESIS,
        updatedAt: new Date(1000).toISOString(),
        receipts: Array.from({ length: 10_000 }, (_, i) => receipt(i + 1))
      })
    );
    const app = Fastify();
    // Use the production plugin and default: route overrides must actually apply.
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(createContributionHistoryRoutes(ledger, true));
    try {
      // Four 15-second scheduled refreshes plus two manual refreshes, all from
      // one IP within the same minute. Every read must reach its final page.
      for (let refresh = 0; refresh < 6; refresh++) {
        let offset = 0;
        let revision: string | undefined;
        let count = 0;
        do {
          const response = await app.inject({ method: 'POST', url: '/api/contributions/history', payload: { runtimes: [runtime], offset, revision } });
          assert.equal(response.statusCode, 200, `refresh ${refresh}, offset ${offset}`);
          const page = response.json();
          revision ??= page.updatedAt;
          assert.equal(page.updatedAt, revision);
          count += page.receipts.length;
          offset = page.nextOffset;
        } while (offset !== null);
        assert.equal(count, 10_000);
      }
      const exhausted = await app.inject({ method: 'POST', url: '/api/contributions/history', payload: { runtimes: [runtime] } });
      assert.equal(exhausted.statusCode, 429);
    } finally {
      await app.close();
    }
  }));
