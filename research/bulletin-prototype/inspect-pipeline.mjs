// Read-only capability inventory. Never signs or submits a transaction.
import assert from 'node:assert/strict';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { decAnyMetadata, unifyMetadata } from '@polkadot-api/substrate-bindings';
import { ENDPOINT, hex } from './live-transport.mjs';
import { GENESIS } from './graph.mjs';
const client = createClient(getWsProvider(ENDPOINT));
let timeout;
try {
  const inspect = async () => {
    const head = await client.getFinalizedBlock();
    const release = client.hodlBlock(head.hash);
    try {
      const api = client.getUnsafeApi(),
        at = { at: head.hash };
      assert.equal(hex(await api.query.System.BlockHash.getValue(0, at)), GENESIS);
      const md = unifyMetadata(decAnyMetadata(await client.getMetadata(head.hash)));
      const pallet = md.pallets.find(p => p.name === 'Utility');
      const type = pallet && md.lookup.find(t => t.id === pallet.calls?.type);
      const finalizedAccountNonce = await api.apis.AccountNonceApi.account_nonce('5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca', at);
      assert.ok(Number.isSafeInteger(finalizedAccountNonce) && finalizedAccountNonce >= 0);
      const calls = type?.def.tag === 'variant' ? type.def.value.map(c => c.name) : [];
      return {
        observedAt: new Date().toISOString(),
        endpoint: ENDPOINT,
        genesis: GENESIS,
        finalized: head,
        finalizedAccountNonce,
        utilityCalls: calls,
        utilityBatchCallPresent: calls.includes('batch_all'),
        metadataOnly: true,
        storageBatchCompatibility: 'not proven; inspected upstream storage validation rejects nested store calls',
        networkWrites: 0
      };
    } finally {
      release();
    }
  };
  const result = await Promise.race([
    inspect(),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Inspection timeout')), 30000);
    })
  ]);
  console.log(JSON.stringify(result, null, 2));
} finally {
  clearTimeout(timeout);
  client.destroy();
}
