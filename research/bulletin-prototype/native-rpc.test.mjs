import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeRpcReader, NATIVE_GENESIS, bounded } from './native-rpc.mjs';
import { GENESIS, buildDirectory } from './graph.mjs';

test('native RPC binds genesis and verifies exact raw bytes without another transport', async () => {
  assert.equal(NATIVE_GENESIS, GENESIS);
  const graph = await buildDirectory([{ path:'a', bytes:new Uint8Array([1,2,3]) }]);
  const block = graph.blocks[0];
  const calls=[];
  const client={async _request(method,args) {
    calls.push([method,args]);
    return method==='chain_getBlockHash' ? GENESIS : `0x${Buffer.from(block.bytes).toString('hex')}`;
  }};
  const read=await nativeRpcReader(client,new AbortController().signal);
  assert.deepEqual(await read(block.cid),new Uint8Array(block.bytes));
  assert.deepEqual(calls.map(c=>c[0]),['chain_getBlockHash','bitswap_v1_get']);
  await assert.rejects(nativeRpcReader({_request:async()=> 'wrong'},new AbortController().signal),/approved Bulletin/);
  const bad=await nativeRpcReader({_request:async method=>method==='chain_getBlockHash'?GENESIS:'0x00'},new AbortController().signal);
  await assert.rejects(bad(block.cid),/does not match/);
  const unsupported=await nativeRpcReader({_request:async method=> {if(method==='chain_getBlockHash')return GENESIS;throw new Error('Method not available in Host');}},new AbortController().signal);
  await assert.rejects(unsupported(block.cid),/not available/);
});

test('native RPC cancellation and deadline remain bounded', async () => {
  const control=new AbortController();
  const read=bounded(new Promise(()=>{}),control.signal,1000); control.abort(new Error('Stopped'));
  await assert.rejects(read,/Stopped/);
  await assert.rejects(bounded(new Promise(()=>{}),new AbortController().signal,5),/deadline/);
});
