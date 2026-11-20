import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { it } from 'node:test';
import { encodeFunctionResult, parseAbi, toFunctionSelector, type PublicClient } from 'viem';
import { ViemCatalogChainGateway } from './chain.js';
import { CatalogRuntimeReadError, fetchRuntimeRpc, mapRuntimeReads, runtimeReadPolicy } from './runtimePolicy.js';

const runtime = `0x${'12'.repeat(20)}` as const;
const abi = parseAbi(['function musicRegTrackCount() view returns (uint256)']);
async function rpcStub(run: (url: string, setReply: (reply: (response: ServerResponse, id: number, data: string) => void) => void) => Promise<void>) {
  let reply: (res: ServerResponse, id: number, data: string) => void = (res, id) => {
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result: encodeFunctionResult({ abi, functionName: 'musicRegTrackCount', result: 0n }) }));
  };
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    assert.equal(request.method, 'eth_call');
    assert.equal(request.params[0].gas, `0x${runtimeReadPolicy.gas.toString(16)}`);
    assert.equal(request.params[1], '0x64');
    res.setHeader('content-type', 'application/json');
    reply(res, request.id, request.params[0].data);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`, value => {
      reply = value;
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

it('classifies real Viem revert, missing-selector/zero-data and malformed ABI failures without hiding RPC outages', async () => {
  await rpcStub(async (rpcUrl, setReply) => {
    const gateway = new ViemCatalogChainGateway({ rpcUrl, chainId: 42, directoryAddress: runtime });
    assert.deepEqual(await gateway.listTrackHashes(runtime, 100), []);
    for (const [payload, code] of [
      [{ error: { code: 3, message: 'execution reverted', data: '0x' } }, 'execution-failed'],
      [{ result: '0x' }, 'invalid-output'],
      [{ result: '0x01' }, 'invalid-output'],
      [{ result: `0x${'ff'.repeat(32)}` }, 'track-limit']
    ] as const) {
      setReply((res, id) => {
        res.end(JSON.stringify({ jsonrpc: '2.0', id, ...payload }));
      });
      await assert.rejects(
        gateway.listTrackHashes(runtime, 100),
        error => error instanceof CatalogRuntimeReadError && error.code === code && error.runtimeAddress === runtime
      );
    }
    for (const kind of ['quota', '500', '429', '500-revert', 'malformed-json', 'socket']) {
      setReply((res, id) => {
        if (kind === 'socket') {
          res.destroy();
          return;
        }
        if (kind === '500-revert') res.statusCode = 500;
        if (kind === '500' || kind === '429') res.statusCode = Number(kind);
        res.end(
          kind === 'malformed-json'
            ? '{'
            : JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: kind === '500-revert' ? { code: 3, message: 'execution reverted', data: '0x' } : { code: -32005, message: 'provider quota' }
              })
        );
      });
      await assert.rejects(gateway.listTrackHashes(runtime, 100), error => error instanceof Error && !(error instanceof CatalogRuntimeReadError));
    }
  });
});

it('bounds chunked RPC bytes before ABI decoding, and keeps large HTTP failures global', async () => {
  await rpcStub(async (rpcUrl, setReply) => {
    const gateway = new ViemCatalogChainGateway({ rpcUrl, chainId: 42, directoryAddress: runtime });
    setReply(res => {
      res.write('{"result":"0x');
      res.end('a'.repeat(runtimeReadPolicy.maxResponseBytes));
    });
    await assert.rejects(gateway.listTrackHashes(runtime, 100), error => error instanceof CatalogRuntimeReadError && error.code === 'response-limit');
    setReply(res => {
      res.statusCode = 500;
      res.end('a'.repeat(runtimeReadPolicy.maxResponseBytes + 1));
    });
    await assert.rejects(gateway.listTrackHashes(runtime, 100), error => error instanceof Error && !(error instanceof CatalogRuntimeReadError));
  });
});

it('cancels a stalled real response body on the owner deadline and drains before return', async () => {
  await rpcStub(async (rpcUrl, setReply) => {
    let response: ServerResponse | undefined;
    setReply(res => {
      response = res;
      res.write('{"result":"0x');
    });
    const controller = new AbortController();
    const gateway = new ViemCatalogChainGateway({ rpcUrl, chainId: 42, directoryAddress: runtime });
    const operation = gateway.listTrackHashes(runtime, 100, controller.signal);
    while (!response) await new Promise(resolve => setImmediate(resolve));
    const closed = once(response, 'close');
    controller.abort();
    await assert.rejects(operation, error => error instanceof CatalogRuntimeReadError && error.code === 'scan-deadline');
    await closed;
    assert.equal(response.destroyed, true);
  });
});

it('covers the post-header body with the per-call deadline without classifying a network timeout as an artist fault', async () => {
  await rpcStub(async (rpcUrl, setReply) => {
    setReply(res => {
      res.write('{');
    });
    await assert.rejects(
      fetchRuntimeRpc(
        rpcUrl,
        { method: 'POST', body: JSON.stringify({ method: 'eth_call', params: [{ gas: '0x4c4b40' }, '0x64'] }) },
        new AbortController().signal,
        40
      ),
      error => error instanceof Error && !(error instanceof CatalogRuntimeReadError)
    );
  });
});

it('stops excessive enumeration before pages, and rejects inconsistent or duplicate inventories', async () => {
  for (const kind of ['count', 'page', 'duplicate']) {
    const client = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'musicRegTrackCount') return kind === 'count' ? 1001n : 2n;
        assert.notEqual(kind, 'count');
        return kind === 'page' ? [] : [`0x${'ab'.repeat(32)}`, `0x${'ab'.repeat(32)}`];
      }
    } as unknown as PublicClient;
    const gateway = new ViemCatalogChainGateway({ rpcUrl: 'https://example.invalid', chainId: 42, directoryAddress: runtime, client });
    await assert.rejects(
      gateway.listTrackHashes(runtime, 100),
      error => error instanceof CatalogRuntimeReadError && error.code === (kind === 'count' ? 'track-limit' : 'invalid-output')
    );
  }
});

it('never masks a concurrent global failure with a later local error, and drains started work', async () => {
  let drained = false;
  await assert.rejects(
    mapRuntimeReads([1, 2], 2, async n => {
      if (n === 1) throw new Error('provider unavailable');
      await new Promise(resolve => setImmediate(resolve));
      drained = true;
      throw new CatalogRuntimeReadError(runtime, 'execution-failed');
    }),
    /provider unavailable/
  );
  assert.equal(drained, true);
});

it('decodes the real release ABI at maximum metadata/split bounds and excludes malformed semantic values', async () => {
  const registry = parseAbi([
    'function musicRegGetTrack(bytes32) view returns ((address artist, string title, string artistName, string description, string imageRef, string audioRef, string metadataRef, string artistContractRef, uint16 royaltyBps, uint8 accessMode, uint128 pricePlanck, uint8 requiredPersonhood, uint64 registeredAtBlock, bool active) track)'
  ]);
  const royalty = parseAbi([
    'function musicRoySplitCount(bytes32) view returns (uint256)',
    'function musicRoySplitAt(bytes32,uint256) view returns (address,uint16)'
  ]);
  const hash = `0x${'ab'.repeat(32)}` as const;
  const track = {
    artist: runtime,

    title: 'é'.repeat(400),
    artistName: 'a'.repeat(800),
    description: 'd'.repeat(8000),
    imageRef: 'i'.repeat(512),
    audioRef: 'a'.repeat(512),
    metadataRef: 'm'.repeat(512),
    artistContractRef: 'c'.repeat(512),
    royaltyBps: 10000,
    accessMode: 2,
    pricePlanck: 0n,
    requiredPersonhood: 0,
    registeredAtBlock: 1n,
    active: true
  };
  await rpcStub(async (rpcUrl, setReply) => {
    setReply((res, id, data) => {
      const selector = data.slice(0, 10);
      const result =
        selector === toFunctionSelector(registry[0])
          ? encodeFunctionResult({ abi: registry, functionName: 'musicRegGetTrack', result: track })
          : selector === toFunctionSelector(royalty[0])
            ? encodeFunctionResult({ abi: royalty, functionName: 'musicRoySplitCount', result: 16n })
            : encodeFunctionResult({ abi: royalty, functionName: 'musicRoySplitAt', result: [runtime, 625] });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
    });
    const gateway = new ViemCatalogChainGateway({ rpcUrl, chainId: 42, directoryAddress: runtime });
    const release = await gateway.readRelease(runtime, runtime, hash, 100);
    assert.equal(release.description.length, 8000);
    assert.equal(release.royaltySplits.length, 16);
    for (const invalid of [{ accessMode: 3 }, { royaltyBps: 10001 }, { registeredAtBlock: BigInt(Number.MAX_SAFE_INTEGER) + 1n }]) {
      const previous = { ...track };
      Object.assign(track, invalid);
      await assert.rejects(
        gateway.readRelease(runtime, runtime, hash, 100),
        error => error instanceof CatalogRuntimeReadError && error.code === 'invalid-output'
      );
      Object.assign(track, previous);
    }
  });
});
