import { it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicClient } from 'viem';
import { ViemCatalogChainGateway } from './chain.js';

it('indexes a metadata-only correction as a canonical release change', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  const hash = `0x${'11'.repeat(32)}` as const;
  const events: string[] = [];
  const client = {
    getLogs: async ({ event }: { event: { name: string } }) => {
      events.push(event.name);
      return event.name === 'TrackMetadataUpdated' ? [{ address: runtime, args: { contentHash: hash }, blockNumber: 12n }] : [];
    }
  } as unknown as PublicClient;
  const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
  const changes = await gateway.getChanges(10, 15, [runtime]);
  assert.ok(events.includes('TrackMetadataUpdated'));
  assert.deepEqual(changes, { directoryChanged: false, releases: [{ runtimeAddress: runtime, contentHash: hash, sourceBlock: 12 }] });
});

it('bounds block ranges and runtime address batches, deduplicating the newest event across chunks', async () => {
  const runtimes = Array.from({ length: 205 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}` as const);
  const hash = `0x${'aa'.repeat(32)}` as const;
  const ranges = new Set<string>();
  let peak = 0,
    active = 0;
  const client = {
    getLogs: async ({ fromBlock, toBlock, address, event }: { fromBlock: bigint; toBlock: bigint; address: string | string[]; event: { name: string } }) => {
      assert.ok(toBlock - fromBlock < 1000n);
      if (Array.isArray(address)) assert.ok(address.length <= 100);
      ranges.add(`${fromBlock}:${toBlock}`);
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      return event.name === 'TrackMetadataUpdated' && Array.isArray(address) && address[0] === runtimes[0]
        ? [{ address: runtimes[0], args: { contentHash: hash }, blockNumber: toBlock }]
        : [];
    }
  } as unknown as PublicClient;
  const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtimes[0]!, client, concurrency: 3 });
  assert.deepEqual(await gateway.getChanges(1, 2505, runtimes), {
    directoryChanged: false,
    releases: [{ runtimeAddress: runtimes[0], contentHash: hash, sourceBlock: 2505 }]
  });
  assert.deepEqual([...ranges], ['1:1000', '1001:2000', '2001:2505']);
  assert.ok(peak <= 3);
});

it('shares one RPC budget across nested track/split reads and pins every read to the checkpoint', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  const hash = `0x${'11'.repeat(32)}` as const;
  let active = 0,
    peak = 0,
    calls = 0;
  const client = {
    readContract: async ({ functionName, blockNumber }: { functionName: string; blockNumber: bigint }) => {
      assert.equal(blockNumber, 100n);
      active++;
      peak = Math.max(peak, active);
      calls++;
      await new Promise(resolve => setImmediate(resolve));
      active--;
      if (functionName === 'musicRegTrackCount' || functionName === 'musicRoySplitCount') return 20n;
      if (functionName === 'musicRegTrackHashAtIndex') return hash;
      if (functionName === 'musicRoySplitAt') return [runtime, 500];
      if (functionName === 'musicRegGetTrack')
        return [
          {
            artist: runtime,
            tokenId: 1n,
            title: 'Track',
            artistName: 'Artist',
            description: '',
            imageRef: '',
            audioRef: '',
            metadataRef: '',
            artistContractRef: '',
            royaltyBps: 10000,
            accessMode: 2,
            pricePlanck: 0n,
            requiredPersonhood: 1,
            registeredAtBlock: 1n,
            active: true
          },
          runtime
        ];
      throw new Error(`Unexpected ${functionName}`);
    }
  } as unknown as PublicClient;
  const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
  const [hashes, ...releases] = await Promise.all([
    gateway.listTrackHashes(runtime, 100),
    ...Array.from({ length: 8 }, () => gateway.readRelease(runtime, runtime, hash, 100))
  ]);
  assert.equal(hashes.length, 20);
  assert.equal(releases.length, 8);
  assert.equal(calls, 197);
  assert.equal(peak, 8);
});
