// RPC-backed Bulletin reads and exact receipt verification. No endpoint or signer
// is chosen here. The optional writer is supplied by the separately owned client.
import assert from 'node:assert/strict';
import { Bytes, Option, u32 } from '@polkadot-api/substrate-bindings';
import { CID } from 'multiformats/cid';
import { z } from 'zod';
import { identitySchema } from './bulletinMediaState.js';
import { verifyBulletinBlock, type BulletinBlock } from './bulletinGraph.js';
import { BULLETIN_RPC_READ_MS, BULLETIN_STORE_MS } from './bulletinLimits.js';
import { bulletinBytes, bulletinHex, createBulletinCodecs, verifyBulletinSubmission, type BulletinCodecs } from './bulletinReceipt.js';
import type {
  BulletinMediaTransport,
  BulletinReceipt,
  BulletinStoreIdentity,
  BulletinSubmissionQuery,
  BulletinSubmissionReceipt,
  BulletinWriteIntent
} from './bulletinMedia.js';

export type BulletinRpc = (method: string, params: unknown[], signal: AbortSignal) => Promise<unknown>;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/i);
const headerSchema = z.object({ number: z.string().regex(/^0x[0-9a-f]+$/i), parentHash: hash, stateRoot: hash, extrinsicsRoot: hash }).passthrough();
const RAW_MAX = 512 * 1024,
  BLOCK_MAX = 8 * 1024 * 1024;
const blockNumber = (value: string) => integer.parse(Number(BigInt(value)));
const opaqueMetadata = Option(Bytes());

export function createBulletinRpcTransport(options: {
  identity: BulletinStoreIdentity;
  request: BulletinRpc;
  submit?: (block: BulletinBlock, intent: BulletinWriteIntent, signal: AbortSignal) => Promise<BulletinSubmissionReceipt>;
}): BulletinMediaTransport {
  const identity = identitySchema.parse(options.identity);
  const codecs = new Map<string, Promise<BulletinCodecs>>();
  const rpc = async (method: string, params: unknown[], signal: AbortSignal) => {
    signal.throwIfAborted();
    return options.request(method, params, signal);
  };
  const atCodecs = async (at: string, signal: AbortSignal) => {
    const code = hash.parse(await rpc('state_getStorageHash', ['0x3a636f6465', at], signal));
    let value = codecs.get(code);
    if (!value) {
      value = (async () => {
        // V14 omits runtime APIs. Require V15 explicitly rather than silently
        // interpreting incomplete or mismatched runtime-call definitions.
        const encoded = bulletinBytes(await rpc('state_call', ['Metadata_metadata_at_version', bulletinHex(u32.enc(15)), at], signal), 1024 * 1024 + 8);
        const metadata = opaqueMetadata.dec(encoded);
        assert.ok(metadata, 'Bulletin runtime has no metadata v15');
        assert.deepEqual(Buffer.from(opaqueMetadata.enc(metadata)), Buffer.from(encoded), 'Malformed Bulletin metadata envelope');
        return createBulletinCodecs(metadata);
      })();
      if (codecs.size >= 2) codecs.delete(codecs.keys().next().value!);
      codecs.set(code, value);
      const selected = value;
      void value.catch(() => {
        if (codecs.get(code) === selected) codecs.delete(code);
      });
    }
    return value;
  };
  const snapshot = async (signal: AbortSignal) => {
    assert.equal(hash.parse(await rpc('chain_getBlockHash', [0], signal)).toLowerCase(), identity.genesis, 'Wrong Bulletin genesis');
    const at = hash.parse(await rpc('chain_getFinalizedHead', [], signal));
    const header = headerSchema.parse(await rpc('chain_getHeader', [at], signal));
    return { at, head: blockNumber(header.number), codecs: await atCodecs(at, signal) };
  };
  const storage = async (context: Awaited<ReturnType<typeof snapshot>>, pallet: string, name: string, args: unknown[], signal: AbortSignal) => {
    const entry = context.codecs.builder.buildStorage(pallet, name);
    const value = await rpc('state_getStorage', [entry.keys.enc(...args), context.at], signal);
    if (value === null) return null;
    const bytes = bulletinBytes(value, 2 * 1024 * 1024);
    const decoded = entry.value.dec(bytes);
    assert.deepEqual(Buffer.from(entry.value.enc(decoded)), Buffer.from(bytes), 'Malformed Bulletin storage encoding');
    return decoded;
  };
  const runtime = async (context: Awaited<ReturnType<typeof snapshot>>, api: string, method: string, args: unknown[], signal: AbortSignal) => {
    const entry = context.codecs.builder.buildRuntimeCall(api, method);
    const bytes = bulletinBytes(await rpc('state_call', [`${api}_${method}`, bulletinHex(entry.args.enc(args)), context.at], signal), 65536);
    const decoded = entry.value.dec(bytes);
    assert.deepEqual(Buffer.from(entry.value.enc(decoded)), Buffer.from(bytes), 'Malformed Bulletin runtime result');
    return decoded;
  };
  const lookupAt = async (context: Awaited<ReturnType<typeof snapshot>>, input: string, signal: AbortSignal): Promise<BulletinReceipt | null> => {
    const cid = CID.parse(input);
    assert.ok(
      cid.version === 1 && cid.multihash.code === 0xb220 && cid.multihash.digest.length === 32 && [0x55, 0x70].includes(cid.code),
      'Unsupported Bulletin media CID'
    );
    const digest = bulletinHex(cid.multihash.digest);
    const position = await storage(context, 'TransactionStorage', 'TransactionByContentHash', [digest], signal);
    if (position === null) return null;
    const [block, index] = z.tuple([integer, integer]).parse(position);
    assert.ok(block <= context.head, 'Storage position is not finalized');
    const entries = await storage(context, 'TransactionStorage', 'Transactions', [block], signal);
    const retention = integer.parse(await storage(context, 'TransactionStorage', 'RetentionPeriod', [], signal));
    const expiresAt = integer.parse(block + retention);
    if (expiresAt <= context.head) return null;
    assert.ok(Array.isArray(entries) && entries.length <= 4096 && entries[index], 'Missing Bulletin storage metadata');
    const info = entries[index];
    assert.equal(bulletinHex(info.content_hash), digest, 'Stored metadata hash differs from CID');
    assert.equal(info.hashing?.type, 'Blake2b256', 'Stored metadata hash algorithm differs from CID');
    assert.equal(BigInt(info.cid_codec), BigInt(cid.code), 'Stored metadata codec differs from CID');
    const bytes = integer.min(1).max(RAW_MAX).parse(info.size);
    return { cid: input, bytes, block, index, expiresAt, finalized: true };
  };
  const within = async <T>(owner: AbortSignal, read: (signal: AbortSignal) => Promise<T>, timeoutMs = BULLETIN_RPC_READ_MS): Promise<T> => {
    owner.throwIfAborted();
    const signal = AbortSignal.any([owner, AbortSignal.timeout(timeoutMs)]);
    let abort: () => void = () => undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          signal.throwIfAborted();
          return read(signal);
        }),
        new Promise<never>((_, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        })
      ]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  };
  return {
    ...identity,
    writable: Boolean(options.submit),
    status: signal =>
      within(signal, async s => {
        const context = await snapshot(s);
        const raw = await runtime(context, 'BulletinTransactionStorageApi', 'account_authorization', [identity.account], s);
        const auth = z
          .object({
            expires_at: integer,
            transactions_allowance: integer,
            transactions_used: integer,
            bytes_allowance: z.bigint().nonnegative(),
            bytes_used: z.bigint().nonnegative(),
            bytes_permanent_used: z.bigint().nonnegative()
          })
          .parse(raw);
        assert.ok(
          auth.transactions_used <= auth.transactions_allowance && auth.bytes_used <= auth.bytes_allowance && auth.bytes_permanent_used <= auth.bytes_allowance,
          'Invalid Bulletin authorization counters'
        );
        return {
          head: context.head,
          authorization: {
            expiresAt: auth.expires_at,
            remainingTransactions: auth.transactions_allowance - auth.transactions_used,
            remainingBytes: auth.bytes_allowance - auth.bytes_used,
            remainingRenewBytes: auth.bytes_allowance - auth.bytes_permanent_used
          }
        };
      }),
    nextNonce: signal =>
      within(signal, async s => {
        const context = await snapshot(s);
        return { head: context.head, nonce: integer.max(0xffffffff).parse(await runtime(context, 'AccountNonceApi', 'account_nonce', [identity.account], s)) };
      }),
    lookup: (cid, signal) => within(signal, async s => lookupAt(await snapshot(s), cid, s)),
    readBlock: (cid, signal) =>
      within(signal, async s => {
        // Even a raw-only Web client verifies network identity before reading.
        assert.equal(hash.parse(await rpc('chain_getBlockHash', [0], s)).toLowerCase(), identity.genesis, 'Wrong Bulletin genesis');
        const bytes = bulletinBytes(await rpc('bitswap_v1_get', [cid], s), RAW_MAX);
        verifyBulletinBlock(cid, bytes);
        return bytes;
      }),
    lookupSubmission: (query: BulletinSubmissionQuery, signal) =>
      within(signal, async s => {
        integer.max(0xffffffff).parse(query.nonce);
        integer.parse(query.afterBlock);
        const context = await snapshot(s);
        const receipt = await lookupAt(context, query.cid, s);
        if (!receipt || receipt.block <= query.afterBlock) return null;
        // The CID identifies one candidate block, not proof of its author. Check
        // that canonical block only; do not scan unbounded account history.
        const at = hash.parse(await rpc('chain_getBlockHash', [receipt.block], s));
        const header = headerSchema.parse(await rpc('chain_getHeader', [at], s));
        assert.equal(blockNumber(header.number), receipt.block, 'Candidate block number mismatch');
        const body = z
          .object({ block: z.object({ header: headerSchema, extrinsics: z.array(z.string()).max(4096) }) })
          .parse(await rpc('chain_getBlock', [at], s));
        assert.equal(body.block.header.parentHash, header.parentHash, 'Candidate parent mismatch');
        assert.equal(blockNumber(body.block.header.number), receipt.block, 'Candidate body number mismatch');
        assert.deepEqual(body.block.header, header, 'Candidate block header differs from canonical header');
        assert.ok(body.block.extrinsics.reduce((sum, value) => sum + value.length, 0) <= 2 * BLOCK_MAX + 2 * 4096, 'Bulletin block exceeds receipt byte bound');
        // Extrinsics/events were executed by the parent runtime. Decoding with
        // post-upgrade metadata can otherwise silently assign the wrong call.
        const execution = await atCodecs(header.parentHash, s);
        const entry = execution.builder.buildStorage('System', 'Events');
        const events = bulletinBytes(await rpc('state_getStorage', [entry.keys.enc(), at], s), 2 * 1024 * 1024);
        return verifyBulletinSubmission({
          codecs: execution,
          extrinsics: body.block.extrinsics.map(value => bulletinBytes(value, BLOCK_MAX)),
          events,
          query,
          account: identity.account,
          receipt
        });
      }),
    async store(block, intent, signal) {
      assert.ok(options.submit, 'Bulletin transport is read-only');
      verifyBulletinBlock(block.cid, block.bytes);
      integer.max(0xffffffff).parse(intent.nonce);
      integer.parse(intent.afterBlock);
      // The writer owns its exact session budget and cancellation. Its receipt
      // is independently checked through lookupSubmission by the custody store.
      return within(signal, s => options.submit!(block, intent, s), BULLETIN_STORE_MS);
    }
  };
}
