import assert from 'node:assert/strict';
import { HashAlgorithm } from '@parity/bulletin-sdk';
import { verifyBlock, MAX_BLOCK_BYTES } from './graph.mjs';

/** Explicitly supplied SDK client; this module never creates/chooses a signer. */
export function sdkBlockStore(client) {
  return async block => {
    const cid = await verifyBlock(block.cid, block.bytes);
    assert.ok(block.bytes.length <= MAX_BLOCK_BYTES);
    // Do not call withChunkSize: it forces a new file/chunk manifest. Each
    // block is already formed and below the SDK's default single-store limit.
    const result = await client.store(block.bytes).withCodec(cid.code).withHashAlgorithm(HashAlgorithm.Sha2_256).withWaitFor('finalized').send();
    assert.equal(result.cid?.toString(), block.cid, 'SDK changed block identity');
    assert.equal(result.size, block.bytes.length, 'SDK returned a different size');
    assert.ok(!result.chunks, 'SDK re-chunked an existing block');
    assert.ok(Number.isSafeInteger(result.blockNumber) && result.blockNumber >= 0, 'Missing finalized storage coordinates');
    assert.ok(Number.isSafeInteger(result.extrinsicIndex) && result.extrinsicIndex >= 0, 'Missing storage index');
    return { cid: block.cid, bytes: block.bytes.length, block: result.blockNumber, index: result.extrinsicIndex };
  };
}
