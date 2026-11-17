// Read-only network inventory. Uses the web lockfile's dependencies; no signer,
// authorization grant, upload, renewal, or production configuration is loaded.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const { createClient } = await load('polkadot-api');
const { getWsProvider } = await load('polkadot-api/ws-provider/node');
const { decAnyMetadata, unifyMetadata } = await load('@polkadot-api/substrate-bindings');
const endpoint = 'wss://bulletin-paseo.tservices.es:8443';
const expectedGenesis = '0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59';
const client = createClient(getWsProvider(endpoint));
let timer;

async function inspect() {
  const block = await client.getFinalizedBlock();
  const md = unifyMetadata(decAnyMetadata(await client.getMetadata(block.hash)));
  const api = client.getUnsafeApi();
  const genesisHash = (await api.query.System.BlockHash.getValue(0, { at: block.hash })).asHex();
  assert.equal(genesisHash, expectedGenesis, 'Endpoint is not the pinned Product DevNet Bulletin chain');
  const retentionBlocks = await api.query.TransactionStorage.RetentionPeriod.getValue({ at: block.hash });
  const previousHash = (await api.query.System.BlockHash.getValue(block.number - 100, { at: block.hash })).asHex();
  const [timestamp, previousTimestamp] = await Promise.all([
    api.query.Timestamp.Now.getValue({ at: block.hash }),
    api.query.Timestamp.Now.getValue({ at: previousHash })
  ]);
  const calls = pallet => {
    const type = md.lookup.find(entry => entry.id === pallet.calls?.type);
    assert.equal(type?.def.tag, 'variant', `Unreadable calls for ${pallet.name}`);
    return type.def.value.map(entry => entry.name);
  };
  const version = await api.constants.System.Version();
  const storage = md.pallets.find(pallet => pallet.name === 'TransactionStorage');
  const renewal = md.pallets.find(pallet => pallet.name === 'DataRenewal');
  assert.ok(storage && renewal, 'Required storage/renewal pallets are absent');
  return {
    observedAt: new Date().toISOString(),
    readOnly: true,
    endpoint,
    genesisHash,
    finalized: { number: block.number, hash: block.hash },
    metadataVersion: md.version,
    observedRuntimeVersion: { specName: version.spec_name, specVersion: version.spec_version, transactionVersion: version.transaction_version },
    // Decode limits directly from the pinned block's metadata, not best-head
    // constants that could come from a concurrent runtime upgrade.
    limits: Object.fromEntries(
      storage.constants
        .filter(entry => ['MaxTransactionSize', 'MaxBlockTransactions', 'AuthorizationPeriod'].includes(entry.name))
        .map(entry => [entry.name, decodeUnsigned(entry.value)])
    ),
    retentionBlocks,
    observedBlockTimeMs: Number(timestamp - previousTimestamp) / 100,
    renewalCapacityBytes: decodeUnsigned(renewal.constants.find(entry => entry.name === 'MaxPermanentStorageSize').value),
    renewedBytesCounter: await api.query.DataRenewal.PermanentStorageUsed.getValue({ at: block.hash }),
    storageCalls: calls(storage),
    renewalCalls: calls(renewal)
  };
}

function decodeUnsigned(hex) {
  const bytes = Buffer.from(hex.slice(2), 'hex');
  assert.ok(bytes.length > 0 && bytes.length <= 16, 'Unexpected scalar constant encoding');
  return bytes.reduceRight((value, byte) => (value << 8n) + BigInt(byte), 0n);
}

try {
  const result = await Promise.race([
    inspect(),
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Bulletin inspection timed out')), 45_000);
    })
  ]);
  console.log(JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
} finally {
  clearTimeout(timer);
  client.destroy();
}
