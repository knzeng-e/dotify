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
    readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? address : [{ artist: address, active: true, title: 'Work' }])
  };
  const service = createRoomContributions(config, { client, signer: account, fetch: async () => ({ ok: true, json: async () => ({ address, chainId: 42 }) }) });
  const room = { hostId: 'host', track: { hash, runtimeAddress: address } };
  const input = { runtime: address, contentHash: hash, sender: address, intentId: hash, amount: '10' };
  return { service, room, input, client };
}
test('a room proof binds chain, runtime, payer, work, host, unique room, amount and expiry', async () => {
  const { service, room, input } = setup();
  await assert.rejects(() => service.quote(room, input), /host needs/);
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
  const service = createRoomContributions(config, { fetch: async () => ({ ok: false }), signer: account });
  await assert.rejects(() => service.bind({}, 'bad-token'), /could not be verified/);
});
test('a fresh unique catalog release repairs missing room attribution before quoting', async () => {
  const client = {
    getChainId: async () => 42,
    readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? address : [{ artist: address, active: true, title: 'Work' }])
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
