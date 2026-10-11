import { it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicClient } from 'viem';
import { ViemCatalogChainGateway } from './chain.js';

it('indexes a metadata-only correction as a canonical release change', async () => {
  const runtime = '0x0000000000000000000000000000000000000001' as const;
  const hash = `0x${'11'.repeat(32)}` as const;
  const events: string[] = [];
  const client = { getLogs: async ({ event }: { event: { name: string } }) => {
    events.push(event.name);
    return event.name === 'TrackMetadataUpdated' ? [{ address: runtime, args: { contentHash: hash }, blockNumber: 12n }] : [];
  } } as unknown as PublicClient;
  const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
  const changes = await gateway.getChanges(10, 15, [runtime]);
  assert.ok(events.includes('TrackMetadataUpdated'));
  assert.deepEqual(changes, { directoryChanged: false, releases: [{ runtimeAddress: runtime, contentHash: hash, sourceBlock: 12 }] });
});
