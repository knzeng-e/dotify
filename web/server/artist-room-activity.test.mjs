import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { test } from 'node:test';
import { io } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';
import { createArtistRoomActivity } from './artist-room-activity.mjs';
import { createRoomContributions } from './room-contributions.mjs';
import { coarseNearbyCell } from '../shared/nearby-v2.mjs';

const runtime = `0x${'11'.repeat(20)}`;
const account = `0x${'22'.repeat(20)}`;
const other = `0x${'33'.repeat(20)}`;
const hash = `0x${'44'.repeat(32)}`;
const imageRef = 'ipfs://Qmc1s9HahFvSTuKk23KXpToF8PBaJraj5Re8qKMU1Ntxdq/cover/640.webp';
const track = { runtimeAddress: runtime, hash, title: 'Untrusted title', artist: 'Untrusted artist' };
const canonical = { artist: account, active: true, title: 'Canonical song', artistName: 'Registered artist', imageRef, audioRef: 'private-source' };
const config = { chainId: 42, directory: other, api: 'https://api.example/api' };
const deps = {
  client: {
    getChainId: async () => 42,
    readContract: async ({ functionName }) => (functionName === 'runtimeOf' ? runtime : [canonical])
  },
  fetch: async (_url, options) => ({
    ok: options.headers.Authorization === 'Bearer valid',
    status: options.headers.Authorization === 'Bearer valid' ? 200 : 401,
    json: async () => ({ address: account, chainId: 42 })
  })
};
const ack = (socket, event, payload) =>
  new Promise((resolve, reject) => socket.timeout(4000).emit(event, payload, (error, result) => (error ? reject(error) : resolve(result))));

test('only the verified runtime owner sees private aggregates, with public invitations beyond radius', async t => {
  const server = startSignalingServer(
    { port: 0, host: '127.0.0.1', contributions: config, logger: () => {} },
    {
      contributions: {
        ...deps,
        client: {
          ...deps.client,
          readContract: async input =>
            input.functionName === 'musicRegGetTrack' && input.args[0] !== hash ? [{ ...canonical, active: false }] : deps.client.readContract(input)
        }
      }
    }
  );
  const port = await server.listen();
  const clients = [];
  t.after(async () => {
    clients.forEach(socket => socket.disconnect());
    await server.close();
  });
  async function connect() {
    const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    clients.push(socket);
    await new Promise(resolve => socket.once('connect', resolve));
    return socket;
  }
  const privateHost = await connect();
  const nearHost = await connect();
  const worldHost = await connect();
  const privateRoom = await ack(privateHost, 'room:create', { displayName: 'Private host name', track });
  const nearRoom = await ack(nearHost, 'room:create', { displayName: 'Nearby host', track });
  const worldRoom = await ack(worldHost, 'room:create', { displayName: 'Worldwide host', track });
  const spoofHost = await connect();
  await ack(spoofHost, 'room:create', { displayName: 'Forged runtime claim', track: { ...track, hash: 'malformed' } });
  const inactiveHost = await connect();
  await ack(inactiveHost, 'room:create', { displayName: 'Inactive release claim', track: { ...track, hash: `0x${'55'.repeat(32)}` } });
  const listener = await connect();
  await ack(listener, 'room:join', { roomId: privateRoom.roomId, displayName: 'Private listener name' });
  await ack(nearHost, 'nearby:publish', { schemaVersion: 2, cell: coarseNearbyCell(40, 0), radiusKm: 5 });
  await ack(worldHost, 'nearby:publish', { schemaVersion: 2, worldwide: true });
  const outsider = await connect();
  assert.equal((await ack(outsider, 'artist:rooms', { runtime, token: 'invalid' })).ok, false);
  const wrongOwner = await connect();
  assert.equal((await ack(wrongOwner, 'artist:rooms', { runtime: other, token: 'valid' })).ok, false);
  assert.deepEqual((await ack(outsider, 'nearby:search', { schemaVersion: 4, cell: coarseNearbyCell(0, 0), radiusKm: 42 })).results, []);
  assert.deepEqual((await (await fetch(`http://127.0.0.1:${port}/status`)).json()).rooms, []);

  const artist = await connect();
  const snapshot = await ack(artist, 'artist:rooms', { runtime, token: 'valid' });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.roomCount, 3);
  assert.equal(snapshot.connectedCount, 4);
  assert.deepEqual(snapshot.rooms.map(room => room.roomId).sort(), [nearRoom.roomId, worldRoom.roomId].sort());
  assert.deepEqual(snapshot.rooms.map(room => room.visibility).sort(), ['nearby', 'worldwide']);
  assert.equal(snapshot.rooms[0].track.title, canonical.title);
  assert.equal(snapshot.rooms[0].track.imageRef, imageRef);
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    new RegExp(`${privateRoom.roomId}|Private host|Private listener|private-source|audioRef|metadataRef|wallet|cell|latitude`)
  );
  // The artist can join this opted-in nearby invitation without a local scan.
  assert.equal((await ack(artist, 'room:join', { roomId: nearRoom.roomId, displayName: 'Artist' })).ok, true);
});

test('snapshots reflect opt-out, track switches, disconnects and exact listener changes without leaking private ids', async () => {
  let time = 10000;
  const rooms = new Map([['ABC234', { hostId: 'host', hostName: 'Host', track, createdAt: 1, listeners: new Map(), playerState: null }]]);
  let publicRoom = true;
  let valid = true;
  let resolveTrack;
  let slow = false;
  const service = createArtistRoomActivity({
    rooms,
    maxListeners: 24,
    now: () => time,
    nearby: { publicVisibility: () => (publicRoom ? 'nearby' : null) },
    contributions: {
      verifyArtistRuntime: async () => {
        if (!valid) throw Object.assign(new Error(), { code: 'SESSION_INVALID' });
        return { runtime, address: account };
      },
      publicTrackStatus: async () =>
        slow
          ? new Promise(resolve => {
              resolveTrack = resolve;
            })
          : { status: 'verified', release: canonical }
    }
  });
  const events = new Map();
  const socket = { id: 'artist', connected: true, data: {}, handshake: { address: 'test' }, on: (event, handler) => events.set(event, handler) };
  service.register(socket);
  const read = () => {
    time += 5000;
    return new Promise(resolve => events.get('artist:rooms')({ runtime, token: 'valid' }, resolve));
  };
  const room = rooms.get('ABC234');
  assert.equal((await read()).roomCount, 1);
  room.listeners.set('listener', {});
  assert.equal((await read()).connectedCount, 2);
  publicRoom = false;
  const hidden = await read();
  assert.equal(hidden.roomCount, 1);
  assert.deepEqual(hidden.rooms, []);
  publicRoom = true;
  slow = true;
  const changing = read();
  await new Promise(resolve => setImmediate(resolve));
  room.track = { ...track, hash: `0x${'55'.repeat(32)}` };
  resolveTrack({ status: 'verified', release: canonical });
  assert.equal((await changing).roomCount, 0);
  slow = false;
  room.hostId = null;
  assert.equal((await read()).roomCount, 0);
  valid = false;
  assert.deepEqual(await read(), { ok: false, code: 'SESSION_INVALID' });
});

test('artist verification fails closed on wrong network, owner, missing session and registry outage', async () => {
  const service = createRoomContributions(config, deps);
  await assert.rejects(() => service.verifyArtistRuntime(runtime, ''), /Connect/);
  await assert.rejects(() => service.verifyArtistRuntime(other, 'valid'), /belong/);
  await assert.rejects(
    () =>
      createRoomContributions(config, {
        ...deps,
        fetch: async () => ({ ok: true, json: async () => ({ address: account, chainId: 99 }) })
      }).verifyArtistRuntime(runtime, 'valid'),
    /Reconnect/
  );
  await assert.rejects(
    () =>
      createRoomContributions(config, {
        ...deps,
        client: {
          ...deps.client,
          readContract: async () => {
            throw new Error('RPC unavailable');
          }
        }
      }).verifyArtistRuntime(runtime, 'valid'),
    /RPC unavailable/
  );
});

test('verified session cache respects the signed expiry and 20-second revocation bound', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  let accepted = true;
  let reads = 0;
  const service = createRoomContributions(config, {
    ...deps,
    fetch: async () => {
      reads++;
      return { ok: accepted, status: accepted ? 200 : 401, json: async () => ({ address: account, chainId: 42 }) };
    }
  });
  const token = `${Buffer.from(JSON.stringify({ exp: 200000 })).toString('base64url')}.signature`;
  await service.verifyArtistRuntime(runtime, token);
  accepted = false;
  t.mock.timers.tick(19000);
  await service.verifyArtistRuntime(runtime, token);
  assert.equal(reads, 1);
  t.mock.timers.tick(1000);
  await assert.rejects(() => service.verifyArtistRuntime(runtime, token), /Reconnect/);
  assert.equal(reads, 2);
  accepted = true;
  const expiring = `${Buffer.from(JSON.stringify({ exp: Date.now() + 1000 })).toString('base64url')}.signature`;
  await service.verifyArtistRuntime(runtime, expiring);
  accepted = false;
  t.mock.timers.tick(1000);
  await assert.rejects(() => service.verifyArtistRuntime(runtime, expiring), /Reconnect/);
  assert.equal(reads, 4);
});

test('artwork lookup coalesces reads and bounds concurrency during a cold catalog burst', async () => {
  let complete;
  let reads = 0;
  const service = createRoomContributions(config, {
    ...deps,
    client: {
      ...deps.client,
      getChainId: async () => {
        reads++;
        await new Promise(resolve => {
          complete = resolve;
        });
        return 42;
      }
    }
  });
  const first = service.publicTrack(track);
  const duplicate = service.publicTrack(track);
  assert.equal(reads, 1);
  complete();
  assert.equal(await first, canonical);
  assert.equal(await duplicate, canonical);
  assert.equal(await service.publicTrack(track), canonical);
  assert.equal(reads, 1);
  const pending = [];
  const bounded = createRoomContributions(config, {
    ...deps,
    client: {
      ...deps.client,
      getChainId: async () => {
        await new Promise(resolve => pending.push(resolve));
        return 42;
      }
    }
  });
  const burst = Array.from({ length: 8 }, (_, index) => bounded.publicTrack({ ...track, hash: `0x${String(index).repeat(64)}` }));
  assert.equal(pending.length, 8);
  assert.equal(await bounded.publicTrack({ ...track, hash: `0x${'99'.repeat(32)}` }), null);
  pending.forEach(resolve => resolve());
  await Promise.all(burst);
  assert.equal(await bounded.publicTrack({ ...track, hash: `0x${'00'.repeat(32)}` }), canonical);
});
