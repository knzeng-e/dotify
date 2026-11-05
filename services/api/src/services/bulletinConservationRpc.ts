// One finalized, read-only metadata snapshot. The chosen RPC is trusted for
// canonical chain data; this is not a light client or a payload availability test.
import assert from 'node:assert/strict';
import { Bytes, Option, u32 } from '@polkadot-api/substrate-bindings';
import { CID } from 'multiformats/cid';
import { z } from 'zod';
import { bulletinBytes, bulletinHex, createBulletinCodecs } from './bulletinReceipt.js';
import { conservationPlanSchema, conservationSnapshotSchema, type ConservationSnapshot } from './bulletinConservation.js';
import type { BulletinRpc } from './bulletinTransport.js';

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const opaque = Option(Bytes());
const methods = new Set(['chain_getBlockHash', 'chain_getFinalizedHead', 'chain_getHeader', 'state_call', 'state_getStorage']);

export async function readBulletinConservation(input: unknown, request: BulletinRpc, signal: AbortSignal): Promise<ConservationSnapshot> {
  const plan = conservationPlanSchema.parse(input);
  const rpc = async (method: string, params: unknown[]) => {
    assert.ok(methods.has(method), 'Conservation RPC method is not read-only');
    signal.throwIfAborted();
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
    let abort: () => void = () => undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          deadline.throwIfAborted();
          return request(method, params, deadline);
        }),
        new Promise<never>((_, reject) => {
          abort = () => reject(deadline.reason);
          deadline.addEventListener('abort', abort, { once: true });
          if (deadline.aborted) abort();
        })
      ]);
    } finally {
      deadline.removeEventListener('abort', abort);
    }
  };
  assert.equal(hash.parse(await rpc('chain_getBlockHash', [0])), plan.identity.genesis, 'Wrong conservation genesis');
  const at = hash.parse(await rpc('chain_getFinalizedHead', []));
  const header = z.object({ number: z.string().regex(/^0x[0-9a-f]+$/) }).parse(await rpc('chain_getHeader', [at]));
  const head = integer.parse(Number(BigInt(header.number)));
  const encoded = bulletinBytes(await rpc('state_call', ['Metadata_metadata_at_version', bulletinHex(u32.enc(15)), at]), 1024 * 1024 + 8);
  const metadata = opaque.dec(encoded);
  assert.ok(metadata, 'Conservation requires metadata v15');
  assert.deepEqual(opaque.enc(metadata), encoded, 'Malformed metadata envelope');
  const { builder } = createBulletinCodecs(metadata);
  const storage = async (name: string, args: unknown[]) => {
    const entry = builder.buildStorage('TransactionStorage', name);
    const value = await rpc('state_getStorage', [entry.keys.enc(...args), at]);
    if (value === null) return null;
    const bytes = bulletinBytes(value, 2 * 1024 * 1024);
    const decoded = entry.value.dec(bytes);
    assert.deepEqual(entry.value.enc(decoded), bytes, 'Malformed conservation storage');
    return decoded;
  };
  // Failure to establish retention/runtime metadata invalidates the whole run.
  const retention = integer.min(1).parse(await storage('RetentionPeriod', []));
  let authorization: ConservationSnapshot['authorization'] = null;
  try {
    const entry = builder.buildRuntimeCall('BulletinTransactionStorageApi', 'account_authorization');
    const bytes = bulletinBytes(
      await rpc('state_call', ['BulletinTransactionStorageApi_account_authorization', bulletinHex(entry.args.enc([plan.identity.account])), at]),
      65536
    );
    const value = entry.value.dec(bytes);
    assert.deepEqual(entry.value.enc(value), bytes, 'Malformed conservation authorization');
    const auth = z
      .object({
        expires_at: integer,
        transactions_allowance: integer,
        transactions_used: integer,
        bytes_allowance: z.bigint().nonnegative(),
        bytes_used: z.bigint().nonnegative(),
        bytes_permanent_used: z.bigint().nonnegative()
      })
      .parse(value);
    assert.ok(
      auth.transactions_used <= auth.transactions_allowance && auth.bytes_used <= auth.bytes_allowance && auth.bytes_permanent_used <= auth.bytes_allowance
    );
    authorization = {
      expiresAt: auth.expires_at,
      remainingTransactions: auth.transactions_allowance - auth.transactions_used,
      remainingRenewBytes: (auth.bytes_allowance - auth.bytes_permanent_used).toString()
    };
  } catch {
    signal.throwIfAborted(); /* Missing or unreadable permission is critical, never healthy. */
  }

  const observations: ConservationSnapshot['observations'] = {};
  const cids = [...new Set(plan.sources.flatMap(source => source.blocks.map(block => block.cid)))];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, cids.length) }, async () => {
      while (next < cids.length) {
        signal.throwIfAborted();
        const cid = cids[next++];
        try {
          const parsed = CID.parse(cid),
            digest = bulletinHex(parsed.multihash.digest);
          const position = await storage('TransactionByContentHash', [digest]);
          if (position === null) {
            observations[cid] = { state: 'missing' };
            continue;
          }
          const [block, index] = z.tuple([integer, integer]).parse(position);
          assert.ok(block <= head, 'Unfinalized position');
          const entries = await storage('Transactions', [block]);
          assert.ok(Array.isArray(entries) && entries.length <= 4096 && entries[index], 'Missing storage metadata');
          const info = entries[index];
          assert.equal(bulletinHex(info.content_hash), digest);
          assert.equal(info.hashing?.type, parsed.multihash.code === 0x12 ? 'Sha2_256' : 'Blake2b256');
          assert.equal(BigInt(info.cid_codec), BigInt(parsed.code));
          observations[cid] = {
            state: 'present',
            cid,
            bytes: integer
              .min(1)
              .max(1024 * 1024)
              .parse(info.size),
            block,
            index,
            expiresAt: integer.parse(block + retention)
          };
        } catch {
          signal.throwIfAborted();
          observations[cid] = { state: 'unavailable' };
        }
      }
    })
  );
  return conservationSnapshotSchema.parse({
    schema: 'dotify.bulletin.conservation-snapshot.v1',
    identity: plan.identity,
    head,
    blockHash: at,
    authorization,
    observations
  });
}
