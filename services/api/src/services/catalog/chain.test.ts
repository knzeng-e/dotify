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
      if (functionName === 'musicRegTrackCount') return 20n;
      if (functionName === 'musicRoySplitCount') return 16n;
      if (functionName === 'musicRegTrackHashesPage') return Array(20).fill(hash);
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
  assert.equal(calls, 146);
  assert.equal(peak, 8);
});

it('reads 205 hashes in three bounded pages at one checkpoint', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  const hashes = Array.from({ length: 205 }, (_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}`);
  const pages: unknown[] = [];
  const client = {
    readContract: async ({ functionName, args, blockNumber }: { functionName: string; args: bigint[]; blockNumber: bigint }) => {
      assert.equal(blockNumber, 100n);
      if (functionName === 'musicRegTrackCount') return 205n;
      assert.equal(functionName, 'musicRegTrackHashesPage');
      pages.push(args);
      return hashes.slice(Number(args[0]), Number(args[0] + args[1]));
    }
  } as unknown as PublicClient;
  const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
  assert.deepEqual(await gateway.listTrackHashes(runtime, 100), hashes);
  assert.deepEqual(pages, [
    [0n, 100n],
    [100n, 100n],
    [200n, 5n]
  ]);
});

it('does not amplify a failing page into legacy per-track requests', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  for (const failure of ['musicRegTrackHashesPage']) {
    const client = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'musicRegTrackCount') return 200n;
        if (functionName === failure) throw new Error('RPC unavailable');
        assert.fail('No legacy fallback on an ambiguous error');
      }
    } as unknown as PublicClient;
    const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
    await assert.rejects(gateway.listTrackHashes(runtime, 100), /RPC unavailable/);
  }
});

it('rejects excessive splits and UTF-8 metadata before requesting any split entries', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  const hash = `0x${'11'.repeat(32)}` as const;
  for (const excess of ['splits', 'title']) {
    const client = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'musicRoySplitCount') return excess === 'splits' ? 17n : 1n;
        if (functionName === 'musicRegGetTrack')
          return [{ title: 'é'.repeat(401), artistName: 'A', description: '', imageRef: '', audioRef: '', metadataRef: '', artistContractRef: '' }, runtime];
        assert.fail('No split enumeration for an out-of-bounds release');
      }
    } as unknown as PublicClient;
    const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
    await assert.rejects(gateway.readRelease(runtime, runtime, hash, 100), excess === 'splits' ? /16-recipient/ : /title byte/);
  }
});
