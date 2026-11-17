import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Bytes, Option } from '@polkadot-api/substrate-bindings';
import { CID } from 'multiformats/cid';
import { createBulletinRpcTransport, type BulletinRpc } from './bulletinTransport.js';
import { bulletinBytes, bulletinHex, createBulletinCodecs } from './bulletinReceipt.js';
const fixtureRoot = new URL('../../../../research/bulletin-prototype/fixtures/', import.meta.url);
export const fixture = JSON.parse(await readFile(new URL('bulletin-receipt.json', fixtureRoot), 'utf8'));
export const metadata = Uint8Array.from(await readFile(new URL('bulletin-receipt-v15.scale', fixtureRoot)));
assert.equal(createHash('sha256').update(metadata).digest('hex'), fixture.metadataSha256);
export const codecs = createBulletinCodecs(metadata);
export const proof = () => ({
  codecs,
  account: fixture.identity.account,
  query: { ...fixture.query },
  receipt: { ...fixture.receipt, account: undefined, nonce: undefined },
  extrinsics: fixture.body.block.extrinsics.map((value: string) => bulletinBytes(value, 8 * 1024 * 1024)),
  events: bulletinBytes(fixture.events, 2 * 1024 * 1024)
});

export function rpcFixture() {
  const calls: { method: string; params: unknown[] }[] = [];
  const head = fixture.receipt.block + 10,
    at = `0x${'aa'.repeat(32)}`;
  const storage = (name: string, value: unknown, args: unknown[] = []) => {
    const entry = codecs.builder.buildStorage('TransactionStorage', name);
    return [entry.keys.enc(...args), bulletinHex(entry.value.enc(value))] as const;
  };
  const digest = bulletinHex(CID.parse(fixture.query.cid).multihash.digest);
  const info = {
    content_hash: digest,
    chunk_root: `0x${'22'.repeat(32)}`,
    size: 117,
    cid_codec: 0x70n,
    hashing: { type: 'Blake2b256', value: undefined },
    extrinsic_index: 2,
    block_chunks: 1,
    meta: { type: 'Store', value: undefined }
  };
  const values = new Map([
    storage('TransactionByContentHash', [fixture.receipt.block, 0], [digest]),
    storage('Transactions', [info], [fixture.receipt.block]),
    storage('RetentionPeriod', fixture.receipt.expiresAt - fixture.receipt.block),
    [codecs.builder.buildStorage('System', 'Events').keys.enc(), fixture.events]
  ]);
  const state = { genesis: fixture.identity.genesis, body: structuredClone(fixture.body), header: { ...fixture.header }, head, events: fixture.events, values };
  const request: BulletinRpc = async (method, params, s) => {
    s.throwIfAborted();
    calls.push({ method, params });
    switch (method) {
      case 'chain_getBlockHash':
        return params[0] === 0 ? state.genesis : params[0] === fixture.receipt.block ? fixture.blockHash : assert.fail('Unbounded history lookup');
      case 'chain_getFinalizedHead':
        return at;
      case 'chain_getHeader':
        return params[0] === at ? { ...fixture.header, number: `0x${state.head.toString(16)}` } : state.header;
      case 'state_getStorageHash':
        return params[1] === fixture.header.parentHash ? `0x${'33'.repeat(32)}` : `0x${'44'.repeat(32)}`;
      case 'state_call': {
        if (params[0] === 'Metadata_metadata_at_version') return bulletinHex(Option(Bytes()).enc(metadata));
        const api =
          params[0] === 'AccountNonceApi_account_nonce' ? ['AccountNonceApi', 'account_nonce'] : ['BulletinTransactionStorageApi', 'account_authorization'];
        const entry = codecs.builder.buildRuntimeCall(...(api as [string, string]));
        assert.deepEqual(params[1], bulletinHex(entry.args.enc([fixture.identity.account])));
        const value =
          api[0] === 'AccountNonceApi'
            ? 928
            : {
                expires_at: head + 10000,
                transactions_allowance: 300,
                transactions_used: 10,
                bytes_allowance: 20000000n,
                bytes_used: 1000n,
                bytes_permanent_used: 2000n
              };
        return bulletinHex(entry.value.enc(value));
      }
      case 'state_getStorage':
        return params[0] === codecs.builder.buildStorage('System', 'Events').keys.enc() ? state.events : (values.get(String(params[0])) ?? null);
      case 'chain_getBlock':
        return state.body;
      case 'bitswap_v1_get':
        return fixture.raw;
      default:
        return assert.fail(`Unexpected RPC ${method}`);
    }
  };
  const transport = createBulletinRpcTransport({ identity: fixture.identity, request });
  return { transport, request, calls, state };
}
