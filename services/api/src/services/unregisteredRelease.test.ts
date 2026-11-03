import assert from 'node:assert/strict';
import { it } from 'node:test';
import { verifyUnregisteredRelease } from './unregisteredRelease.js';
const scope = { chainId: 420420417, runtimeAddress: `0x${'22'.repeat(20)}`, contentHash: `0x${'33'.repeat(32)}` };
const owner = `0x${'11'.repeat(20)}`;
const directory = `0x${'44'.repeat(20)}` as const;
const hash = `0x${'55'.repeat(32)}` as const;
function fixture() {
  const calls: Array<Record<string, unknown>> = [];
  let registered = false,
    runtime = scope.runtimeAddress,
    chainId = scope.chainId,
    failed = false,
    latestRegistered = false;
  const client = {
    getChainId: async () => chainId,
    getBlock: async ({ blockTag }: { blockTag: string }) => ({ hash: blockTag === 'latest' ? `0x${'66'.repeat(32)}` : hash }),
    readContract: async (args: Record<string, unknown>) => {
      calls.push(args);
      if (failed) throw Error('unreachable');
      return args.functionName === 'runtimeOf' ? runtime : registered || (latestRegistered && args.blockHash !== hash);
    }
  };
  return {
    calls,
    client: client as unknown as Parameters<typeof verifyUnregisteredRelease>[0],
    set registered(v: boolean) {
      registered = v;
    },
    set runtime(v: string) {
      runtime = v;
    },
    set chainId(v: number) {
      chainId = v;
    },
    set failed(v: boolean) {
      failed = v;
    },
    set latestRegistered(v: boolean) {
      latestRegistered = v;
    }
  };
}
it('requires canonical directory and explicit false registration at finalized and latest heads', async () => {
  const c = fixture();
  assert.equal(await verifyUnregisteredRelease(c.client, directory, { owner, scope }), true);
  assert.equal(c.calls.length, 4);
  assert.ok(c.calls.every(call => call.requireCanonical === true && [hash, `0x${'66'.repeat(32)}`].includes(String(call.blockHash))));
  c.latestRegistered = true;
  assert.equal(await verifyUnregisteredRelease(c.client, directory, { owner, scope }), false);
});
it('denies registered, remapped, wrong-network and unreachable states', async () => {
  for (const changed of [{ registered: true }, { runtime: owner }, { chainId: 1 }, { failed: true }]) {
    const c = fixture();
    Object.assign(c, changed);
    assert.equal(await verifyUnregisteredRelease(c.client, directory, { owner, scope }), false);
  }
});
