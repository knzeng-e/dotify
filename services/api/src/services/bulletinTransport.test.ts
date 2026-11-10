import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactNumber } from '@polkadot-api/substrate-bindings';
import { createBulletinRpcTransport, BULLETIN_RECEIPT_BLOCK_MAX, type BulletinRpc } from './bulletinTransport.js';
import { bulletinBytes, bulletinHex, verifyBulletinSubmission } from './bulletinReceipt.js';
import { fixture, codecs, proof, rpcFixture } from './bulletinTransport.fixture.js';
import { createBulletinProofCache, BULLETIN_PROOF_CACHE_BYTES, type BulletinProofBlock } from './bulletinProofCache.js';
const signal = () => new AbortController().signal;

test('completed block proof reuse still refreshes canonical mapping, retention and each nonce query', async () => {
  const f = rpcFixture();
  const eventsKey = codecs.builder.buildStorage('System', 'Events').keys.enc();
  for (let i = 0; i < 16; i++) assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 1);
  assert.equal(f.calls.filter(c => c.method === 'state_getStorage' && c.params[0] === eventsKey).length, 1);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlockHash' && c.params[0] === fixture.receipt.block).length, 16);
  assert.equal(f.calls.filter(c => c.method === 'chain_getFinalizedHead').length, 16);
  assert.equal(await f.transport.lookupSubmission({ ...fixture.query, nonce: fixture.query.nonce + 1 }, signal()), null);
  const metadata = codecs.builder.buildStorage('TransactionStorage', 'Transactions');
  const key = metadata.keys.enc(fixture.receipt.block),
    original = f.state.values.get(key)!;
  const changed = metadata.value.dec(bulletinBytes(original, 65536));
  changed[0].size++;
  f.state.values.set(key, bulletinHex(metadata.value.enc(changed)));
  await assert.rejects(f.transport.lookupSubmission(fixture.query, signal()), /size differs/);
  f.state.values.set(key, original);
  f.state.head = fixture.receipt.expiresAt;
  assert.equal(await f.transport.lookupSubmission(fixture.query, signal()), null, 'A cached proof cannot resurrect expired storage');
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 1);
  f.state.genesis = `0x${'ff'.repeat(32)}`;
  await assert.rejects(f.transport.lookupSubmission(fixture.query, signal()), /genesis/);
});

test('changed canonical hash and a new transport never inherit a completed block bundle', async () => {
  const f = rpcFixture();
  let canonical = fixture.blockHash;
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: (method, params, s) =>
      method === 'chain_getBlockHash' && params[0] === fixture.receipt.block ? Promise.resolve(canonical) : f.request(method, params, s)
  });
  assert.deepEqual(await transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  canonical = `0x${'bc'.repeat(32)}`;
  f.state.body.block.header.extrinsicsRoot = `0x${'77'.repeat(32)}`;
  await assert.rejects(transport.lookupSubmission(fixture.query, signal()), /header differs/);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 2);
  f.state.body.block.header.extrinsicsRoot = fixture.header.extrinsicsRoot;
  assert.deepEqual(await transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 3, 'Failed loads do not enter the cache');
  const separate = createBulletinRpcTransport({ identity: fixture.identity, request: f.request });
  assert.deepEqual(await separate.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 4);
});

test('one cancelled cold body load cannot cancel or poison another caller', { timeout: 5000 }, async () => {
  const f = rpcFixture();
  const releases: (() => void)[] = [];
  let loads = 0,
    both!: () => void;
  const started = new Promise<void>(r => {
    both = r;
  });
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: async (method, params, s) => {
      if (method !== 'chain_getBlock') return f.request(method, params, s);
      loads++;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          s.removeEventListener('abort', abort);
          reject(s.reason);
        };
        releases.push(() => {
          s.removeEventListener('abort', abort);
          resolve();
        });
        s.addEventListener('abort', abort, { once: true });
        if (s.aborted) abort();
        if (loads === 2) both();
      });
      return f.request(method, params, s);
    }
  });
  const a = new AbortController(),
    b = new AbortController();
  const cancelled = assert.rejects(transport.lookupSubmission(fixture.query, a.signal), /cancel-first/);
  const surviving = transport.lookupSubmission(fixture.query, b.signal);
  await started;
  // Parent execution metadata has independently settled; the body loads remain cold.
  await new Promise<void>(r => setImmediate(r));
  a.abort(new Error('cancel-first'));
  await cancelled;
  releases[1]();
  assert.deepEqual(await surviving, fixture.receipt);
  assert.deepEqual(await transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(loads, 2, 'Only the surviving verified load is reusable');
});

test('completed proof payloads have both an entry cap and a total byte cap', () => {
  const input = proof();
  const value: BulletinProofBlock = { block: fixture.receipt.block, execution: codecs, extrinsics: input.extrinsics, events: input.events };
  const cache = createBulletinProofCache();
  cache.retain('a', value);
  cache.retain('b', value);
  assert.equal(cache.get('a'), value);
  cache.retain('c', value);
  assert.equal(cache.get('b'), undefined);
  const large = { ...value, extrinsics: [new Uint8Array(BULLETIN_PROOF_CACHE_BYTES / 2 + 1)] };
  cache.retain('large-a', large);
  cache.retain('large-b', large);
  assert.equal(cache.get('large-a'), undefined, 'Two half-capacity-plus payloads cannot coexist');
  assert.equal(cache.get('large-b'), large);
  cache.retain('too-large', { ...value, extrinsics: [new Uint8Array(BULLETIN_PROOF_CACHE_BYTES + 1)] });
  assert.equal(cache.get('too-large'), undefined);
});

test('captured public marker binds sender/nonce/direct payload and the storage event, not the extrinsic index', () => {
  const input = proof();
  delete input.receipt.account;
  delete input.receipt.nonce;
  assert.deepEqual(verifyBulletinSubmission(input), fixture.receipt);
  assert.equal(codecs.decodeSigned(input.extrinsics[2])!.nonce, 927);
  assert.equal(fixture.receipt.index, 0, 'Storage index and extrinsic index differ in the real fixture');
  assert.equal(fixture.networkWrites, 0);
  assert.equal(fixture.signerUsed, false);
});

test('a different sender or nonce never inherits an existing CID receipt', () => {
  const input = proof();
  assert.equal(verifyBulletinSubmission({ ...input, query: { ...input.query, nonce: 928 } }), null);
  assert.equal(verifyBulletinSubmission({ ...input, account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }), null);
});

test('corrupt payload, changed storage index/hash, failed or misattributed events cannot prove publication', () => {
  const input = proof();
  const corrupt = input.extrinsics.map((bytes: Uint8Array) => Uint8Array.from(bytes));
  corrupt[2][corrupt[2].length - 1] ^= 1;
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: corrupt }));
  assert.throws(() => verifyBulletinSubmission({ ...input, receipt: { ...input.receipt, index: 2 } }), /Storage index/);
  const eventCodec = codecs.builder.buildStorage('System', 'Events').value;
  for (const change of [
    (rows: any[]) => rows.filter(row => row.event.type !== 'System' || row.event.value.type !== 'ExtrinsicSuccess'),
    (rows: any[]) =>
      rows.map(row => ({ ...row, phase: row.phase.type === 'ApplyExtrinsic' && row.phase.value === 2 ? { type: 'ApplyExtrinsic', value: 1 } : row.phase })),
    (rows: any[]) => rows.flatMap(row => (row.event.type === 'TransactionStorage' ? [row, row] : [row])),
    (rows: any[]) =>
      rows.map(row =>
        row.event.type === 'TransactionStorage'
          ? { ...row, event: { ...row.event, value: { ...row.event.value, value: { ...row.event.value.value, content_hash: `0x${'00'.repeat(32)}` } } } }
          : row
      )
  ]) {
    const rows = change(codecs.decodeEvents(input.events));
    assert.throws(() => verifyBulletinSubmission({ ...input, events: eventCodec.enc(rows) }));
  }
  assert.throws(() => verifyBulletinSubmission({ ...input, query: { ...input.query, afterBlock: fixture.receipt.block } }), /predates/);
});

test('pooled Buffer views, trailing bytes and duplicate signed nonce records are handled safely', () => {
  const input = proof();
  const pooled = Buffer.allocUnsafe(input.extrinsics[2].length + 16);
  pooled.set(input.extrinsics[2], 8);
  assert.equal(codecs.decodeSigned(pooled.subarray(8, -8))!.nonce, 927);
  assert.throws(() => codecs.decodeSigned(Uint8Array.from([...input.extrinsics[2], 0])), /length|encoding/);
  assert.throws(() => codecs.decodeEvents(Uint8Array.from([...input.events, 0])), /encoding/);
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: [...input.extrinsics, input.extrinsics[2]] }), /Duplicate/);
});

test('RPC transport verifies the captured receipt using one canonical candidate block and parent metadata', async () => {
  const f = rpcFixture();
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 1);
  assert.ok(f.calls.some(c => c.method === 'state_call' && c.params[0] === 'Metadata_metadata_at_version' && c.params[2] === fixture.header.parentHash));
  assert.equal(f.transport.writable, false);
  await assert.rejects(
    f.transport.store({ cid: fixture.query.cid, bytes: bulletinBytes(fixture.raw, 512), codec: 0x70 }, fixture.query, signal()),
    /read-only/
  );
  const status = await f.transport.status(signal());
  assert.equal(status.authorization.remainingTransactions, 290);
  assert.equal(status.authorization.remainingBytes, 19999000n);
  assert.deepEqual(await f.transport.nextNonce(signal()), { head: f.state.head, nonce: 928 });
  assert.deepEqual(await f.transport.readBlock(fixture.query.cid, signal()), bulletinBytes(fixture.raw, 512));
});

test('wrong genesis, candidate header/body disagreement and stale or missing CID metadata fail closed', async () => {
  const a = rpcFixture();
  a.state.genesis = `0x${'ff'.repeat(32)}`;
  await assert.rejects(a.transport.status(signal()), /genesis/);
  assert.ok(!a.calls.some(c => c.method === 'state_call'));
  const b = rpcFixture();
  b.state.body.block.header.number = '0x1';
  await assert.rejects(b.transport.lookupSubmission(fixture.query, signal()), /number mismatch/);
  const c = rpcFixture();
  c.state.header.parentHash = `0x${'77'.repeat(32)}`;
  await assert.rejects(c.transport.lookupSubmission(fixture.query, signal()), /parent mismatch/);
  const d = rpcFixture();
  d.state.values.clear();
  assert.equal(await d.transport.lookupSubmission(fixture.query, signal()), null);
  const e = rpcFixture();
  assert.equal(await e.transport.lookupSubmission({ ...fixture.query, afterBlock: fixture.receipt.block }, signal()), null);
  assert.ok(!e.calls.some(c => c.method === 'chain_getBlock'));
});

test('RPC reads bound raw bytes, block size, cancellation and unrecognized encodings', async () => {
  const f = rpcFixture();
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(f.transport.status(abort.signal), { name: 'AbortError' });
  assert.equal(f.calls.length, 0);
  const hung = createBulletinRpcTransport({ identity: fixture.identity, request: () => new Promise(() => {}) });
  const controller = new AbortController();
  const result = assert.rejects(hung.status(controller.signal), { name: 'AbortError' });
  controller.abort();
  await result;
  const large = rpcFixture();
  large.state.body.block.extrinsics = ['0x' + '00'.repeat(BULLETIN_RECEIPT_BLOCK_MAX + 1)];
  await assert.rejects(large.transport.lookupSubmission(fixture.query, signal()), /bound/);
  const corrupt = createBulletinRpcTransport({
    identity: fixture.identity,
    request: (method, params, s) => (method === 'bitswap_v1_get' ? Promise.resolve('0x00') : f.request(method, params, s))
  });
  await assert.rejects(corrupt.readBlock(fixture.query.cid, signal()), /CID does not match/);
});

test('a full canonical body above the old 8-MiB cap retains exact own-store proof within the runtime 10-MiB bound', async () => {
  const f = rpcFixture();
  // Bare extrinsics are opaque unrelated content at this trusted-RPC boundary;
  // their dispatch validity is not inferred by our own sender/nonce verifier.
  const payload = Buffer.alloc(1800 * 1024);
  payload[0] = 4;
  const bare = '0x' + Buffer.concat([Buffer.from(compactNumber.enc(payload.length)), payload]).toString('hex');
  f.state.body.block.extrinsics.push(...Array(5).fill(bare));
  const size = f.state.body.block.extrinsics.reduce((n: number, s: string) => n + (s.length - 2) / 2, 0);
  assert(size > 8 * 1024 * 1024 && size < BULLETIN_RECEIPT_BLOCK_MAX);
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  f.state.body.block.extrinsics.push(bare);
  // A block hash is immutable. Use a cold session for the oversized RPC body;
  // mutating the fixture must not mutate bytes already owned by a warm cache.
  const cold = createBulletinRpcTransport({ identity: fixture.identity, request: f.request });
  await assert.rejects(cold.lookupSubmission(fixture.query, signal()), /bound/);
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
});

test('wrapped stores and nonce-reused unrelated calls cannot masquerade as a direct store', () => {
  const input = proof();
  const decoded = codecs.decodeSigned(input.extrinsics[2])!;
  const direct = codecs.builder.buildCall('TransactionStorage', 'store_with_cid_config');
  const args = (decoded.call as { value: { value: unknown } }).value.value;
  const callBytes = Uint8Array.from([...direct.location, ...direct.codec.enc(args)]);
  const encoded = input.extrinsics[2];
  assert.deepEqual(encoded.slice(-callBytes.length), callBytes);
  const batch = codecs.builder.buildCall('Utility', 'batch');
  const wrapped = Uint8Array.from([...batch.location, ...batch.codec.enc({ calls: [decoded.call] })]);
  const prefixBytes = compactNumber.enc(compactNumber.dec(encoded)).length;
  const payload = Uint8Array.from([...encoded.slice(prefixBytes, -callBytes.length), ...wrapped]);
  const replacement = Uint8Array.from([...compactNumber.enc(payload.length), ...payload]);
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: [...input.extrinsics.slice(0, 2), replacement] }));
});

test('event count and missing metadata are refused before unbounded decoding', async () => {
  assert.throws(() => codecs.decodeEvents(compactNumber.enc(8193)), /Too many/);
  const f = rpcFixture();
  const missing = createBulletinRpcTransport({
    identity: fixture.identity,
    request: (method, params, s) =>
      method === 'state_call' && params[0] === 'Metadata_metadata_at_version' ? Promise.resolve('0x00') : f.request(method, params, s)
  });
  await assert.rejects(missing.nextNonce(signal()), /no metadata/);
});

test('a stale proxy body with the same height/parent but different roots is not a canonical receipt', async () => {
  for (const field of ['stateRoot', 'extrinsicsRoot']) {
    const f = rpcFixture();
    f.state.body.block.header[field] = `0x${'77'.repeat(32)}`;
    await assert.rejects(f.transport.lookupSubmission(fixture.query, signal()), /header differs/);
  }
});

/** A serial implementation cannot open this barrier: both independent requests
 * must start before either response is released. No wall-clock speed assertion. */
function overlapRequired(request: BulletinRpc, select: (method: string, params: unknown[]) => string | undefined) {
  const reached = new Set<string>();
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  return {
    reached,
    request: (async (method, params, s) => {
      const branch = select(method, params);
      if (branch) {
        reached.add(branch);
        if (reached.size === 2) release();
        let abort = () => {};
        try {
          await Promise.race([
            gate,
            new Promise<never>((_, reject) => {
              abort = () => reject(s.reason);
              s.addEventListener('abort', abort, { once: true });
              if (s.aborted) abort();
            })
          ]);
        } finally {
          s.removeEventListener('abort', abort);
        }
      }
      return request(method, params, s);
    }) satisfies BulletinRpc
  };
}

test('snapshot header and runtime reads overlap only after genesis and finalized hash selection', { timeout: 2000 }, async t => {
  const f = rpcFixture();
  const gate = overlapRequired(f.request, method => (method === 'chain_getHeader' ? 'header' : method === 'state_getStorageHash' ? 'runtime' : undefined));
  const transport = createBulletinRpcTransport({ identity: fixture.identity, request: gate.request });
  assert.deepEqual(await transport.nextNonce(t.signal), { head: f.state.head, nonce: 928 });
  assert.equal(gate.reached.size, 2);
  assert.deepEqual(
    f.calls.slice(0, 2).map(c => c.method),
    ['chain_getBlockHash', 'chain_getFinalizedHead']
  );
  const pinned = f.calls.filter(c => c.method === 'chain_getHeader' || c.method === 'state_getStorageHash');
  assert.equal(pinned[0].params[0], pinned[1].params[1]);
});

test('CID metadata and retention reads overlap at the same finalized snapshot', { timeout: 2000 }, async t => {
  const f = rpcFixture();
  const transactions = codecs.builder.buildStorage('TransactionStorage', 'Transactions').keys.enc(fixture.receipt.block);
  const retention = codecs.builder.buildStorage('TransactionStorage', 'RetentionPeriod').keys.enc();
  const gate = overlapRequired(f.request, (method, params) =>
    method !== 'state_getStorage' ? undefined : params[0] === transactions ? 'metadata' : params[0] === retention ? 'retention' : undefined
  );
  const transport = createBulletinRpcTransport({ identity: fixture.identity, request: gate.request });
  const { account: _account, nonce: _nonce, ...receipt } = fixture.receipt;
  assert.deepEqual(await transport.lookup(fixture.query.cid, t.signal), receipt);
  assert.equal(gate.reached.size, 2);
  const reads = f.calls.filter(c => c.method === 'state_getStorage' && [transactions, retention].includes(String(c.params[0])));
  assert.equal(reads.length, 2);
  assert.equal(reads[0].params[1], reads[1].params[1]);
});

test('canonical body and parent-runtime event reads overlap without changing the exact submission proof', { timeout: 2000 }, async t => {
  const f = rpcFixture();
  const gate = overlapRequired(f.request, (method, params) =>
    method === 'chain_getBlock' ? 'body' : method === 'state_getStorageHash' && params[1] === fixture.header.parentHash ? 'execution' : undefined
  );
  const transport = createBulletinRpcTransport({ identity: fixture.identity, request: gate.request });
  assert.deepEqual(await transport.lookupSubmission(fixture.query, t.signal), fixture.receipt);
  assert.equal(gate.reached.size, 2);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 1);
});

test('a failed read observes its already-started sibling before propagating the original error', { timeout: 2000 }, async t => {
  const f = rpcFixture(),
    failure = new Error('synthetic header failure');
  let release!: () => void,
    arrived!: () => void,
    settled = false,
    siblingFinished = false;
  const pause = new Promise<void>(resolve => (release = resolve));
  const siblingStarted = new Promise<void>(resolve => (arrived = resolve));
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: async (method, params, s) => {
      if (method === 'chain_getHeader') throw failure;
      if (method === 'state_getStorageHash') {
        arrived();
        await pause;
        siblingFinished = true;
      }
      return f.request(method, params, s);
    }
  });
  const operation = transport.nextNonce(t.signal);
  void operation.then(
    () => (settled = true),
    () => (settled = true)
  );
  const rejected = assert.rejects(operation, error => error === failure);
  try {
    await siblingStarted;
    assert.equal(settled, false);
  } finally {
    release();
  }
  await rejected;
  assert.equal(siblingFinished, true);
  assert.ok(!f.calls.some(c => c.method === 'state_call' && c.params[0] === 'AccountNonceApi_account_nonce'));
});

test('cancelling paired reads aborts both branches and retains the caller error', { timeout: 2000 }, async () => {
  const f = rpcFixture(),
    owner = new AbortController(),
    failure = new Error('synthetic cancellation');
  let active = 0,
    started = 0;
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: async (method, params, s) => {
      if (!['chain_getHeader', 'state_getStorageHash'].includes(method)) return f.request(method, params, s);
      active++;
      started++;
      let abort = () => {};
      try {
        if (started === 2) owner.abort(failure);
        return await new Promise<never>((_, reject) => {
          abort = () => reject(s.reason);
          s.addEventListener('abort', abort, { once: true });
          if (s.aborted) abort();
        });
      } finally {
        active--;
        s.removeEventListener('abort', abort);
      }
    }
  });
  await assert.rejects(transport.nextNonce(owner.signal), error => error === failure);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, 2);
  assert.equal(active, 0);
});

test('parallel confirmations remain bounded for four independent receipt reads', { timeout: 3000 }, async t => {
  const f = rpcFixture();
  let active = 0,
    peak = 0;
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: async (method, params, s) => {
      peak = Math.max(peak, ++active);
      try {
        await new Promise(resolve => setImmediate(resolve));
        return await f.request(method, params, s);
      } finally {
        active--;
      }
    }
  });
  const receipts = await Promise.all(Array.from({ length: 4 }, () => transport.lookupSubmission(fixture.query, t.signal)));
  receipts.forEach(receipt => assert.deepEqual(receipt, fixture.receipt));
  assert.ok(peak >= 2 && peak <= 8, 'At most two in-flight RPC reads per caller, below the dedicated-client limit of sixteen');
  assert.equal(active, 0);
});

test('parallel reads still refresh genesis and CID retention rather than caching eligibility', async () => {
  const f = rpcFixture();
  assert.ok(await f.transport.lookup(fixture.query.cid, signal()));
  f.state.values.clear();
  assert.equal(await f.transport.lookup(fixture.query.cid, signal()), null);
  assert.equal(f.calls.filter(c => c.method === 'chain_getFinalizedHead').length, 2);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlockHash' && c.params[0] === 0).length, 2);
  f.state.genesis = `0x${'ff'.repeat(32)}`;
  await assert.rejects(f.transport.nextNonce(signal()), /genesis/);
});

test('proof reuse removes immutable block reads while retaining fresh eligibility and canonical mapping calls', async () => {
  const f = rpcFixture();
  const count = (calls: typeof f.calls) =>
    Object.fromEntries([...new Set(calls.map(c => c.method))].sort().map(method => [method, calls.filter(c => c.method === method).length]));
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.deepEqual(count(f.calls), {
    chain_getBlock: 1,
    chain_getBlockHash: 2,
    chain_getFinalizedHead: 1,
    chain_getHeader: 2,
    state_call: 2,
    state_getStorage: 4,
    state_getStorageHash: 2
  });
  const offset = f.calls.length;
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.deepEqual(count(f.calls.slice(offset)), {
    chain_getBlockHash: 2,
    chain_getFinalizedHead: 1,
    chain_getHeader: 1,
    state_getStorage: 3,
    state_getStorageHash: 1
  });
});

test('a fresh finalized head can expire a previously successful CID lookup', async () => {
  const f = rpcFixture();
  assert.ok(await f.transport.lookup(fixture.query.cid, signal()));
  f.state.head = fixture.receipt.expiresAt;
  assert.equal(await f.transport.lookup(fixture.query.cid, signal()), null);
});
