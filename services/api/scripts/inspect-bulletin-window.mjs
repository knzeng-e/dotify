// Explicit read-only runtime inventory. No account, signer or app configuration.
import assert from 'node:assert/strict';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { decAnyMetadata, unifyMetadata } from '@polkadot-api/substrate-bindings';

const endpoint = process.argv[2];
assert.ok(endpoint && new URL(endpoint).protocol === 'wss:', 'Supply an explicit WSS endpoint');
const client = createClient(getWsProvider(endpoint));
let timeout;
const inspect = async () => {
  const head = await client.getFinalizedBlock();
  const release = client.hodlBlock(head.hash);
  try {
    const api = client.getUnsafeApi();
    assert.equal(await api.query.System.BlockHash.getValue(0, { at: head.hash }), '0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59');
    const metadata = unifyMetadata(decAnyMetadata(await client.getMetadata(head.hash)));
    const selected = {};
    for (const pallet of metadata.pallets.filter(p => ['System', 'TransactionStorage'].includes(p.name))) {
      for (const entry of pallet.constants.filter(c => /^(BlockLength|BlockWeights|MaxBlockTransactions|MaxTransactionSize|MaxTotalDataSize)$/.test(c.name)))
        selected[`${pallet.name}.${entry.name}`] = await api.constants[pallet.name][entry.name]({ at: head.hash });
    }
    return {
      schema: 'dotify.bulletin.window-capabilities.v1',
      observedAt: new Date().toISOString(),
      head,
      constants: selected,
      transactionPoolCapacity: 'not exposed or established by runtime metadata',
      liveThroughputMeasured: false,
      networkWrites: 0
    };
  } finally {
    release();
  }
};
try {
  const result = await Promise.race([
    inspect(),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Read-only runtime inspection timed out')), 45000);
    })
  ]);
  console.log(JSON.stringify(result, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
} finally {
  clearTimeout(timeout);
  client.destroy();
}
