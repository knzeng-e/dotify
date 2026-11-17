// Decode the direct signed store and its own events using the execution runtime.
// The selected RPC supplies canonical/finalized data; this is not a light client.
import assert from 'node:assert/strict';
import { z } from 'zod';
import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders';
import { AccountId, Tuple, compactNumber, decAnyMetadata, extrinsicFormat, unifyMetadata } from '@polkadot-api/substrate-bindings';
import { verifyBulletinBlock } from './bulletinGraph.js';
import type { BulletinSubmissionReceipt, BulletinSubmissionQuery } from './bulletinMedia.js';

export const bulletinHex = (value: unknown): string => {
  if (typeof value === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(value)) return value.toLowerCase();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString('hex')}`;
  if (value && typeof value === 'object' && 'asHex' in value && typeof value.asHex === 'function') return bulletinHex(value.asHex());
  throw new Error('Unreadable Bulletin binary value');
};
export function bulletinBytes(value: unknown, max: number): Uint8Array {
  const hex = bulletinHex(value);
  assert.ok(hex.length <= 2 + max * 2, 'Bulletin binary response exceeds bound');
  // SCALE decoders must receive an owned byte view, not a pooled Node Buffer.
  return Uint8Array.from(Buffer.from(hex.slice(2), 'hex'));
}
const accountBytes = (account: string) => Buffer.from(AccountId().enc(account));

export function createBulletinCodecs(bytes: Uint8Array) {
  assert.ok(bytes.length > 0 && bytes.length <= 1024 * 1024, 'Bulletin metadata exceeds bound');
  const metadata = unifyMetadata(decAnyMetadata(Uint8Array.from(bytes)));
  assert.ok('address' in metadata.extrinsic && metadata.extrinsic.version.includes(4), 'Bulletin receipt requires v15+ metadata with signed v4 support');
  const lookup = getLookupFn(metadata),
    builder = getDynamicBuilder(lookup);
  const extensions = metadata.extrinsic.signedExtensions[0];
  assert.ok(extensions && extensions.filter(e => e.identifier === 'CheckNonce').length === 1, 'Unsupported Bulletin nonce extension');
  const nonceIndex = extensions.findIndex(e => e.identifier === 'CheckNonce');
  assert.ok(lookup.call !== null && lookup.call !== undefined, 'Missing Bulletin call metadata');
  const payload = Tuple(
    extrinsicFormat,
    builder.buildDefinition(metadata.extrinsic.address),
    builder.buildDefinition(metadata.extrinsic.signature),
    Tuple(...extensions.map(e => builder.buildDefinition(e.type))),
    builder.buildDefinition(lookup.call)
  );
  const envelope = Tuple(compactNumber, payload),
    prefix = Tuple(compactNumber, extrinsicFormat);
  const events = builder.buildStorage('System', 'Events');
  return {
    builder,
    /** Each SCALE codec must consume exactly its canonical encoding. */
    decodeEvents(encoded: Uint8Array) {
      encoded = Uint8Array.from(encoded);
      assert.ok(compactNumber.dec(encoded) <= 8192, 'Too many Bulletin events');
      const value = events.value.dec(encoded);
      assert.deepEqual(Buffer.from(events.value.enc(value)), Buffer.from(encoded), 'Malformed Bulletin events encoding');
      assert.ok(Array.isArray(value) && value.length <= 8192, 'Too many Bulletin events');
      return value;
    },
    decodeSigned(encoded: Uint8Array): { account: string; nonce: number; call: unknown } | null {
      encoded = Uint8Array.from(encoded);
      const [, format] = prefix.dec(encoded);
      if (format.type === 'bare') return null;
      assert.ok(format.version === 4 && format.type === 'signed', 'Unsupported signed Bulletin extrinsic format');
      const [size, decoded] = envelope.dec(encoded);
      assert.equal(size, encoded.length - compactNumber.enc(size).length, 'Invalid Bulletin extrinsic length');
      assert.deepEqual(Buffer.from(envelope.enc([size, decoded])), Buffer.from(encoded), 'Malformed Bulletin extrinsic encoding');
      const [, address, , extra, call] = decoded;
      const account = typeof address === 'string' ? address : address?.type === 'Id' ? address.value : null;
      assert.ok(typeof account === 'string', 'Unsupported Bulletin sender encoding');
      accountBytes(account);
      const nonce = extra[nonceIndex];
      assert.ok(Number.isSafeInteger(nonce) && nonce >= 0 && nonce <= 0xffffffff, 'Invalid Bulletin signed nonce');
      return { account, nonce, call };
    }
  };
}
export type BulletinCodecs = ReturnType<typeof createBulletinCodecs>;

/** The caller has already established the canonical candidate block and its
 * retained CID metadata. Only a direct store by this sender+nonce can match. */
export function verifyBulletinSubmission(input: {
  codecs: BulletinCodecs;
  extrinsics: Uint8Array[];
  events: Uint8Array;
  query: BulletinSubmissionQuery;
  account: string;
  receipt: Omit<BulletinSubmissionReceipt, 'account' | 'nonce'>;
}): BulletinSubmissionReceipt | null {
  const expected = accountBytes(input.account);
  const matches = input.extrinsics.flatMap((encoded, index) => {
    const decoded = input.codecs.decodeSigned(encoded);
    return decoded && decoded.nonce === input.query.nonce && accountBytes(decoded.account).equals(expected) ? [{ ...decoded, index }] : [];
  });
  assert.ok(matches.length <= 1, 'Duplicate Bulletin sender/nonce extrinsics');
  if (!matches.length) return null;
  const tx = matches[0];
  const call = z
    .object({
      type: z.literal('TransactionStorage'),
      value: z.object({
        type: z.literal('store_with_cid_config'),
        value: z.object({
          data: z.unknown(),
          cid: z.object({ codec: z.union([z.bigint(), z.number().int().nonnegative()]), hashing: z.object({ type: z.string() }) })
        })
      })
    })
    .parse(tx.call);
  const args = call.value.value;
  const raw = bulletinBytes(args.data, 512 * 1024);
  const cid = verifyBulletinBlock(input.query.cid, raw);
  assert.equal(raw.length, input.receipt.bytes, 'Store payload size differs from CID metadata');
  assert.equal(BigInt(args.cid?.codec), BigInt(cid.code), 'Store codec differs from CID');
  assert.equal(args.cid?.hashing?.type, 'Blake2b256', 'Store hash algorithm differs from CID');
  const rows = input.codecs.decodeEvents(input.events).filter(row => row.phase?.type === 'ApplyExtrinsic' && row.phase.value === tx.index);
  const dispatch = rows.filter(row => row.event?.type === 'System' && ['ExtrinsicSuccess', 'ExtrinsicFailed'].includes(row.event.value?.type));
  assert.ok(dispatch.length === 1 && dispatch[0].event.value.type === 'ExtrinsicSuccess', 'Bulletin store has no successful dispatch proof');
  const stored = rows.filter(row => row.event?.type === 'TransactionStorage' && row.event.value?.type === 'Stored');
  assert.equal(stored.length, 1, 'Expected one direct Bulletin storage event');
  assert.equal(stored[0].event.value.value.index, input.receipt.index, 'Storage index differs from event; it is not the extrinsic index');
  assert.equal(bulletinHex(stored[0].event.value.value.content_hash), bulletinHex(cid.multihash.digest), 'Storage event hash differs from CID');
  assert.ok(input.receipt.block > input.query.afterBlock, 'Submission predates its durable intent');
  return { ...input.receipt, account: input.account, nonce: input.query.nonce };
}
