import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoomContributions } from './room-contributions.mjs';
import { zeroAddress, zeroHash, encodeAbiParameters, encodeEventTopics, parseAbi, keccak256, recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const address = account.address;
const hash = `0x${'22'.repeat(32)}`;
const config = { chainId: 42, directory: address, api: 'https://api.example/api' };
function setup() {
  const client = {
    getChainId: async () => 42,
    getBlock: async () => ({ timestamp: 1700000000n }),
    readContract: async ({ functionName }) =>
      functionName === 'musicGiftPolicy'
        ? { hostBps: 1000, startsAt: 0n, endsAt: 0n, roomAttestor: address }
        : functionName === 'runtimeOf'
          ? address
          : [{ artist: address, active: true, title: 'Work' }]
  };
  const service = createRoomContributions(config, { client, signer: account, fetch: async () => ({ ok: true, json: async () => ({ address, chainId: 42 }) }) });
  const room = { hostId: 'host', track: { hash, runtimeAddress: address } };
  const input = { runtime: address, contentHash: hash, sender: address, intentId: hash, amount: '10' };
  return { service, room, input, client };
}
test('a room proof binds chain, runtime, payer, work, host, unique room, amount and expiry', async () => {
  const { service, room, input } = setup();
  const unbound = await service.quote(room, input);
  assert.equal(unbound.host, zeroAddress);
  assert.equal(unbound.room, zeroHash);
  assert.equal(unbound.proof, '0x');
  await service.bind(room, 'valid-token');
  const proof = await service.quote(room, input);
  const context = { contentHash: hash, intentId: hash, host: address, room: proof.room, expiresAt: BigInt(proof.expiresAt) };
  const contextType = {
    type: 'tuple',
    components: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'intentId', type: 'bytes32' },
      { name: 'host', type: 'address' },
      { name: 'room', type: 'bytes32' },
      { name: 'expiresAt', type: 'uint64' }
    ]
  };
  const digest = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, contextType, { type: 'uint256' }],
      [42n, address, address, context, 10n]
    )
  );
  assert.equal(await recoverMessageAddress({ message: { raw: digest }, signature: proof.proof }), address);
  assert.notEqual(proof.room, zeroHash);
  await assert.rejects(() => service.quote(room, { ...input, contentHash: zeroHash }), /track changed/);
  await assert.rejects(() => service.quote(room, { ...input, runtime: zeroAddress }), /release could not/);
});
test('a claimed host identity requires a valid API session on the configured chain', async () => {
  const service = createRoomContributions(config, { fetch: async () => ({ ok: false, status: 401 }), signer: account });
  await assert.rejects(
    () => service.bind({}, 'bad-token'),
    error => error.code === 'SESSION_INVALID'
  );
});
test('an unavailable attestor cannot silently remove a connected host allocation', async () => {
  const { client, room, input } = setup();
  room.tipHost = address;
  const service = createRoomContributions(config, { client });
  await assert.rejects(() => service.quote(room, input), /cannot verify/);
});
test('a connected host without an active allocation never blocks a direct tip or needs a signer', async () => {
  for (const policy of [
    { hostBps: 0, startsAt: 0n, endsAt: 0n },
    { hostBps: 1000, startsAt: 0n, endsAt: 1n },
    { hostBps: 1000, startsAt: 1800000000n, endsAt: 0n }
  ]) {
    const { client, room, input } = setup();
    room.tipHost = address;
    const read = client.readContract;
    client.readContract = args => (args.functionName === 'musicGiftPolicy' ? { ...policy, roomAttestor: zeroAddress } : read(args));
    const service = createRoomContributions(config, { client });
    const quote = await service.quote(room, input);
    assert.equal(quote.host, zeroAddress);
    assert.equal(quote.room, zeroHash);
    assert.equal(quote.proof, '0x');
    assert.equal(room.tipIntents.size, 1);
  }
});
test('active host sharing fails closed for missing or mismatched authority and supports profile inheritance', async () => {
  for (const authority of [zeroAddress, '0x0000000000000000000000000000000000000001', address]) {
    const { client, service, room, input } = setup();
    room.tipHost = address;
    const read = client.readContract;
    client.readContract = args =>
      args.functionName === 'musicGiftPolicy'
        ? { hostBps: 1000, startsAt: 0n, endsAt: 0n, roomAttestor: args.args[0] === zeroHash ? authority : zeroAddress }
        : read(args);
    if (authority === address) assert.notEqual((await service.quote(room, input)).room, zeroHash);
    else {
      await assert.rejects(() => service.quote(room, input), /room verification/);
      assert.equal(room.tipIntents, undefined);
    }
  }
});
test('a fresh unique catalog release repairs missing room attribution before quoting', async () => {
  const client = {
    getChainId: async () => 42,
    getBlock: async () => ({ timestamp: 1700000000n }),
    readContract: async ({ functionName }) =>
      functionName === 'musicGiftPolicy'
        ? { hostBps: 1000, startsAt: 0n, endsAt: 0n, roomAttestor: address }
        : functionName === 'runtimeOf'
          ? address
          : [{ artist: address, active: true, title: 'Work' }]
  };
  const requests = [];
  const service = createRoomContributions(config, {
    client,
    signer: account,
    fetch: async url => {
      requests.push(url);
      if (url.endsWith('/auth/identity')) return { ok: true, json: async () => ({ address, chainId: 42 }) };
      return {
        ok: true,
        json: async () => ({ release: { hash, runtimeAddress: address, active: true }, meta: { state: 'fresh' } })
      };
    }
  });
  const room = { hostId: 'host', track: { hash } };
  const input = { runtime: address, contentHash: hash, sender: address, intentId: hash, amount: '10' };
  await service.bind(room, 'valid-token');

  const proof = await service.quote(room, input);

  assert.equal(room.track.runtimeAddress, address.toLowerCase());
  assert.match(proof.proof, /^0x[\da-f]+$/i);
  assert.deepEqual(requests, ['https://api.example/api/auth/identity', `https://api.example/api/catalog/releases/${hash}`]);
});
test('room attribution recovery fails closed for stale, inactive, mismatched and ambiguous catalog results', async () => {
  const rejectedResponses = [
    { ok: true, body: { release: { hash, runtimeAddress: address, active: true }, meta: { state: 'stale-cache' } } },
    { ok: true, body: { release: { hash, runtimeAddress: address, active: false }, meta: { state: 'fresh' } } },
    { ok: true, body: { release: { hash: zeroHash, runtimeAddress: address, active: true }, meta: { state: 'fresh' } } },
    { ok: false, body: { error: { code: 'AMBIGUOUS_RELEASE' } } }
  ];

  for (const response of rejectedResponses) {
    const service = createRoomContributions(config, {
      client: {
        getChainId: async () => 42,
        readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? address : [{ artist: address, active: true }])
      },
      signer: account,
      fetch: async () => ({ ok: response.ok, json: async () => response.body })
    });
    const room = { hostId: 'host', track: { hash } };
    await assert.rejects(() => service.recoverTrack(room, room.track), /could not be verified/);
    assert.equal(room.track.runtimeAddress, undefined);
  }
});
test('room attribution recovery never overwrites a track that changed during verification', async () => {
  let resolveCatalog;
  const catalog = new Promise(resolve => {
    resolveCatalog = resolve;
  });
  const service = createRoomContributions(config, {
    client: {
      getChainId: async () => 42,
      readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? address : [{ artist: address, active: true }])
    },
    signer: account,
    fetch: async () => catalog
  });
  const expectedTrack = { hash, title: 'First work' };
  const room = { hostId: 'host', track: expectedTrack };
  const recovery = service.recoverTrack(room, expectedTrack);
  room.track = { hash: zeroHash, title: 'Next work' };
  resolveCatalog({
    ok: true,
    json: async () => ({ release: { hash, runtimeAddress: address, active: true }, meta: { state: 'fresh' } })
  });

  assert.equal(await recovery, null);
  assert.deepEqual(room.track, { hash: zeroHash, title: 'Next work' });
});
test('a host account change invalidates an in-flight quote and a stale identity binding', async () => {
  const { service, room, input, client } = setup();
  await assert.rejects(() => service.bind(room, 'valid-token', () => false), /hosting session changed/);
  assert.equal(room.tipHost, undefined);
  await service.bind(room, 'valid-token');
  const read = client.readContract;
  client.readContract = async args => {
    delete room.tipHost;
    return read(args);
  };
  await assert.rejects(() => service.quote(room, input), /room changed/);
});
test('chat announces only a finalized canonical contribution in this room, once', async () => {
  const { service, room, client } = setup();
  await service.bind(room, 'valid-token');
  const abi = parseAbi([
    'event ContributionReceived(bytes32 indexed id,bytes32 indexed contentHash,address indexed sender,uint256 amount,address host,bytes32 room,bytes32 campaign,bytes32 policy,uint64 timestamp)'
  ]);
  const receipt = {
    status: 'success',
    transactionHash: hash,
    blockNumber: 10n,
    blockHash: hash,
    logs: [
      {
        address,
        logIndex: 1,
        transactionHash: hash,
        topics: encodeEventTopics({ abi, eventName: 'ContributionReceived', args: { id: hash, contentHash: hash, sender: address } }),
        data: encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
          [100n, address, room.tipScope, zeroHash, hash, 1700000000n]
        )
      }
    ]
  };
  client.getTransactionReceipt = async () => receipt;
  client.getBlock = async () => ({ number: 9n, hash });
  await assert.rejects(() => service.notification(room, { runtime: address, hash }), /not finalized/);
  client.getBlock = async ({ blockTag }) => ({ number: 10n, hash: blockTag ? hash : zeroHash });
  await assert.rejects(() => service.notification(room, { runtime: address, hash }), /receipt changed/);
  client.getBlock = async () => ({ number: 10n, hash });
  await assert.rejects(() => service.notification({ ...room, tipScope: zeroHash }, { runtime: address, hash }), /does not belong/);
  const message = await service.notification(room, { runtime: address, hash });
  assert.equal(message.senderId, 'dotify-confirmed-tip');
  assert.equal(message.ts, 1700000000000);
  assert.match(message.text, /Work/);
  assert.equal(await service.notification(room, { runtime: address, hash }), null);
  assert.equal(await service.notification(room, { runtime: address, hash: hash.toUpperCase().replace('0X', '0x') }), null);
});

function tipLog(room, host = address, id = hash) {
  const abi = parseAbi([
    'event ContributionReceived(bytes32 indexed id,bytes32 indexed contentHash,address indexed sender,uint256 amount,address host,bytes32 room,bytes32 campaign,bytes32 policy,uint64 timestamp)'
  ]);
  return {
    address,
    logIndex: 1,
    transactionHash: hash,
    topics: encodeEventTopics({ abi, eventName: 'ContributionReceived', args: { id, contentHash: hash, sender: address } }),
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
      [10n, host, room, zeroHash, hash, 1700000000n]
    )
  };
}

test('an unbound host still permits a full artist tip and its exact room intent announcement', async () => {
  const { service, room, input, client } = setup();
  const quoted = await service.quote(room, input);
  assert.equal(quoted.host, zeroAddress);
  assert.equal(quoted.room, zeroHash);
  assert.equal(quoted.proof, '0x');
  const id = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [address, input.intentId]));
  client.getTransactionReceipt = async () => ({
    status: 'success',
    transactionHash: hash,
    blockNumber: 10n,
    blockHash: hash,
    logs: [tipLog(zeroHash, zeroAddress, id)]
  });
  client.getBlock = async () => ({ number: 10n, hash });
  await assert.rejects(() => service.notification({ hostId: 'other-room' }, { runtime: address, hash }), /does not belong/);
  assert.match((await service.notification(room, { runtime: address, hash })).text, /Work/);
  assert.equal(await service.notification(room, { runtime: address, hash }), null);
});

test('native room announcements use the verified API extrinsic receipt and reject mismatches', async () => {
  const { room, client } = setup();
  client.getChainId = async () => 420420417;
  let body;
  const requests = [];
  const service = createRoomContributions(
    { ...config, chainId: 420420417, receiptToken: 'test-receipt-service-token-32-characters' },
    {
      client,
      signer: account,
      fetch: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, json: async () => (url.endsWith('/auth/identity') ? { address, chainId: 420420417 } : body) };
      }
    }
  );
  await service.bind(room, 'token');
  body = {
    status: 'success',
    genesisHash: '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2',
    hash,
    block: { number: 10, hash, index: 3 },
    logs: [tipLog(room.tipScope)]
  };
  const input = { runtime: address, hash, nativeBlock: { number: 10, hash, index: 3 } };
  const correct = globalThis.structuredClone(body);
  for (const mutation of [
    { hash: zeroHash },
    { status: 'failed' },
    { genesisHash: zeroHash },
    { block: { number: 11, hash, index: 3 } },
    { logs: [tipLog(zeroHash)] }
  ]) {
    body = { ...correct, ...mutation };
    await assert.rejects(() => service.notification(room, input), /could not be verified|does not belong/);
  }
  body = correct;
  assert.equal((await service.notification(room, input)).senderId, 'dotify-confirmed-tip');
  assert.equal(await service.notification(room, input), null);
  assert.equal(requests.at(-1).url, 'https://api.example/api/contributions/native-receipt');
  assert.equal(requests.at(-1).init.headers.Authorization, 'Bearer test-receipt-service-token-32-characters');
  assert.deepEqual(JSON.parse(requests.at(-1).init.body), { hash, block: input.nativeBlock });
});
test('native announcements require the configured service credential before calling the API', async () => {
  const { client } = setup();
  client.getChainId = async () => 420420417;
  let called = false;
  const service = createRoomContributions(
    { ...config, chainId: 420420417 },
    {
      client,
      fetch: async () => {
        called = true;
      }
    }
  );
  await assert.rejects(() => service.notification({}, { runtime: address, hash, nativeBlock: { number: 10 } }), /service credential/);
  assert.equal(called, false);
});
