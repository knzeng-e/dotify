import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { GENESIS, MAX_BLOCK_BYTES, verifyBlock } from './graph.mjs';
import { sdkBlockStore } from './sdk-store.mjs';

export const ENDPOINT = 'wss://bulletin-paseo.tservices.es:8443';
export const CANARY_ACCOUNT = '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca';
export const CANARY_BUDGET = Object.freeze({ maxBytes: 1024 * 1024, maxTransactions: 40 });

export function hex(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value?.asHex === 'function') return value.asHex().toLowerCase();
  assert.ok(value instanceof Uint8Array, 'Unrecognized binary chain value');
  return `0x${Buffer.from(value).toString('hex')}`;
}

function integer(value, label) {
  assert.ok(Number.isSafeInteger(value) && value >= 0, `Invalid ${label}`);
  return value;
}

export function authorization(raw, head) {
  assert.ok(raw && raw.expires_at > head + 100, 'No live storage authorization with sufficient lifetime');
  const tx = integer(raw.transactions_allowance, 'transaction allowance') - integer(raw.transactions_used, 'transactions used');
  const remaining = (cap, used) => {
    assert.equal(typeof cap, 'bigint', 'Unsupported byte allowance');
    assert.equal(typeof used, 'bigint', 'Unsupported used byte counter');
    assert.ok(cap >= 0n && used >= 0n && used <= cap, 'Invalid byte counters');
    return cap - used;
  };
  assert.ok(tx >= 0, 'Invalid transaction counters');
  return {
    expiresAt: raw.expires_at,
    remainingTransactions: tx,
    remainingBytes: remaining(raw.bytes_allowance, raw.bytes_used),
    remainingRenewBytes: remaining(raw.bytes_allowance, raw.bytes_permanent_used)
  };
}

/** Injected PAPI/SDK instances. No signer selection, fallback or authorization grant. */
export function liveTransport(client, sdk, account, { timeoutMs = 30_000 } = {}) {
  assert.equal(account, CANARY_ACCOUNT, 'This canary is bound to the owner-selected account');
  const api = client.getUnsafeApi();
  const store = sdk && sdkBlockStore(sdk);
  let writes = 0;
  let writtenBytes = 0;
  const reads = [];
  async function bounded(promise) {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Bulletin read timed out; no retry was submitted')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }
  async function snapshot() {
    const head = await bounded(client.getFinalizedBlock());
    const release = client.hodlBlock(head.hash);
    try {
      const genesis = hex(await bounded(api.query.System.BlockHash.getValue(0, { at: head.hash })));
      assert.equal(genesis, GENESIS, 'Wrong Bulletin genesis');
      return { head, at: { at: head.hash }, release };
    } catch (error) { release(); throw error; }
  }
  async function status() {
    const { head, at, release } = await snapshot();
    try {
      // The runtime API supplies stable named counters; PAPI unwraps the raw
      // storage record's single-field `extra` differently between versions.
      const raw = await bounded(api.apis.BulletinTransactionStorageApi.account_authorization(account, at));
      return { head: head.number, hash: head.hash, authorization: authorization(raw, head.number) };
    } finally { release(); }
  }
  async function lookup(input) {
    const cid = CID.parse(input);
    assert.equal(cid.multihash.code, 0x12, 'Only SHA-256 lookup is supported');
    assert.ok([0x55, 0x70].includes(cid.code), 'Unsupported block codec');
    const digest = hex(cid.multihash.digest);
    const { head, at, release } = await snapshot();
    try {
      const position = await bounded(api.query.TransactionStorage.TransactionByContentHash.getValue(digest, at));
      if (position == null) return null;
      assert.ok(Array.isArray(position) && position.length === 2, 'Unsupported storage position');
      const [block, index] = position.map(v => integer(v, 'storage coordinate'));
      assert.ok(block <= head.number, 'Storage position is not finalized');
      const [entries, retention] = await Promise.all([
        bounded(api.query.TransactionStorage.Transactions.getValue(block, at)),
        bounded(api.query.TransactionStorage.RetentionPeriod.getValue(at))
      ]);
      const expiresAt = block + integer(retention, 'retention period');
      if (expiresAt <= head.number) return null;
      const info = entries?.[index];
      assert.ok(info, 'Storage index has no transaction metadata');
      assert.equal(hex(info.content_hash), digest, 'Storage metadata has a different hash');
      assert.equal(info.hashing.type, 'Sha2_256', 'Storage metadata has a different hash algorithm');
      assert.equal(BigInt(info.cid_codec), BigInt(cid.code), 'Storage metadata has a different codec');
      const bytes = integer(info.size, 'stored byte count');
      assert.ok(bytes > 0 && bytes <= MAX_BLOCK_BYTES, 'Stored block exceeds canary budget');
      return { cid: input, bytes, block, index, expiresAt, finalized: true };
    } finally { release(); }
  }
  async function readBlock(cid) {
    const encoded = await bounded(client._request('bitswap_v1_get', [cid]));
    assert.ok(typeof encoded === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(encoded), 'Invalid raw block RPC response');
    assert.ok(encoded.length <= 2 + MAX_BLOCK_BYTES * 2, 'Raw block exceeds canary read budget');
    const bytes = Buffer.from(encoded.slice(2), 'hex');
    await verifyBlock(cid, bytes);
    reads.push({ cid, bytes: bytes.length });
    return bytes;
  }
  async function reserve(bytes, renewal) {
    assert.ok(sdk, 'A local signer is required for writes');
    assert.ok(writes < CANARY_BUDGET.maxTransactions && writtenBytes + (renewal ? 0 : bytes) <= CANARY_BUDGET.maxBytes, 'Live session budget exceeded');
    const { authorization: auth } = await status();
    assert.ok(auth.remainingTransactions >= 1 && (renewal ? auth.remainingRenewBytes : auth.remainingBytes) >= BigInt(bytes), 'Live quota exhausted');
    // Count attempts before submission. Uncertain outcomes never release budget.
    writes++;
    if (!renewal) writtenBytes += bytes;
  }
  return {
    genesis: GENESIS, account, status, lookup, readBlock, reads,
    async store(block) {
      try {
        await verifyBlock(block.cid, block.bytes);
        await reserve(block.bytes.length, false);
      } catch (error) {
        error.definitelyNotSubmitted = true;
        throw error;
      }
      return store(block);
    },
    async requestRenewal(receipt) {
      const current = await lookup(receipt.cid);
      assert.ok(current && current.block === receipt.block && current.index === receipt.index && current.bytes === receipt.bytes, 'Renewal target is absent or changed');
      await reserve(receipt.bytes, true);
      // This is intentionally immediate, one-off renewal, not recurring registration.
      await sdk.forceRenew({ block: receipt.block, index: receipt.index }).withWaitFor('finalized').send();
    },
    get attemptedTransactions() { return writes; }
  };
}
