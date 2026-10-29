import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';
import { loopbackUrl, percentile } from './boundary.mjs';

async function node(config, children) {
  const child = fork(new URL('./signal-node.mjs', import.meta.url), [], {
    env: { PATH: process.env.PATH, W39_NODE_CONFIG: JSON.stringify(config) },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc']
  });
  children.push(child);
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Signaling readiness timed out')), 15000);
    const onMessage = message => finish(null, [message]);
    const onExit = () => finish(new Error('Signaling process exited before ready'));
    const onError = error => finish(error);
    function finish(error, value) {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve(value);
    }
    child.once('message', onMessage);
    child.once('exit', onExit);
    child.once('error', onError);
  });
  return { child, url: `http://127.0.0.1:${ready[0].port}` };
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const kill = setTimeout(() => child.kill('SIGKILL'), 3000);
  await exited;
  clearTimeout(kill);
}
async function connect(url, sockets) {
  loopbackUrl(url, ['http:']);
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 4000 });
  sockets.push(socket);
  await Promise.race([
    once(socket, 'connect'),
    once(socket, 'connect_error').then(([error]) => {
      throw error;
    })
  ]);
  return socket;
}
const emit = (socket, event, payload = {}) => socket.timeout(4000).emitWithAck(event, payload);
async function delivery(host, guest, value) {
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      guest.off('research:event', receive);
      reject(new Error('Cross-node delivery timed out'));
    }, 4000);
    function receive(packet) {
      if (packet.value === value) {
        clearTimeout(timer);
        guest.off('research:event', receive);
        resolve(packet);
      }
    }
    guest.on('research:event', receive);
  });
  const start = performance.now();
  assert.equal((await emit(host, 'research:publish', { value })).ok, true);
  const packet = await event;
  return { ms: performance.now() - start, packet };
}
export async function measureSignaling({ redisUrl, prefix, pauseRedis }) {
  const children = [],
    sockets = [];
  const spawn = config => node({ redisUrl, prefix, ...config }, children);
  try {
    const baselineA = await spawn({ nodeId: 'baseline-a', mode: 'baseline' });
    const baselineB = await spawn({ nodeId: 'baseline-b', mode: 'baseline' });
    const baselineHost = await connect(baselineA.url, sockets),
      baselineGuest = await connect(baselineB.url, sockets);
    const created = await emit(baselineHost, 'room:create', { displayName: 'Synthetic host' });
    assert.equal(created.ok, true);
    const crossNode = await emit(baselineGuest, 'room:join', { roomId: created.roomId, displayName: 'Synthetic guest' });
    assert.equal(crossNode.code, 'ROOM_NOT_FOUND');
    await stop(baselineA.child);
    const restarted = await spawn({ nodeId: 'baseline-a', mode: 'baseline' });
    const restartHost = await connect(restarted.url, sockets);
    const resume = await emit(restartHost, 'room:resume', { roomId: created.roomId, hostResumeToken: created.hostResumeToken });
    assert.equal(resume.code, 'ROOM_NOT_FOUND');
    await Promise.all([stop(restarted.child), stop(baselineB.child)]);
    const a = await spawn({ nodeId: 'a', mode: 'prototype' }),
      b = await spawn({ nodeId: 'b', mode: 'prototype' });
    const host = await connect(a.url, sockets),
      guest = await connect(b.url, sockets);
    const room = await emit(host, 'room:create');
    assert.equal(room.ok, true);
    assert.equal((await emit(guest, 'room:join', { roomId: room.roomId })).ok, true);
    const samples = [];
    for (let i = 0; i < 30; i++) samples.push((await delivery(host, guest, `sample-${i}`)).ms);
    const outsider = await connect(b.url, sockets);
    assert.equal((await emit(outsider, 'room:resume', { roomId: room.roomId, hostResumeToken: 'wrong' })).code, 'DENIED');
    assert.equal((await emit(outsider, 'research:publish', { value: 'forged' })).code, 'DENIED');
    const crowd = await Promise.all(Array.from({ length: 30 }, (_, i) => connect(i % 2 ? a.url : b.url, sockets)));
    const admission = await Promise.all(crowd.map(client => emit(client, 'room:join', { roomId: room.roomId })));
    assert.equal(admission.filter(x => x.ok).length, 23);
    assert.equal(admission.filter(x => x.code === 'FULL').length, 7);
    const drained = once(a.child, 'message');
    a.child.send('drain');
    assert.equal((await drained)[0].type, 'drained');
    assert.equal((await emit(host, 'research:publish', { value: 'stale-owner' })).code, 'FENCED');
    const newHost = await connect(b.url, sockets);
    const start = performance.now();
    const takeover = await emit(newHost, 'room:resume', { roomId: room.roomId, hostResumeToken: room.hostResumeToken });
    assert.equal(takeover.ok, true);
    assert.equal(takeover.epoch, 2);
    const postDrain = await delivery(newHost, guest, 'after-drain');
    const drainResumeMs = performance.now() - start;
    assert.equal(postDrain.packet.epoch, 2);
    assert.equal((await emit(outsider, 'room:resume', { roomId: room.roomId, hostResumeToken: room.hostResumeToken })).code, 'DENIED');
    assert.equal((await emit(host, 'research:publish', { value: 'stale-owner-2' })).code, 'FENCED');
    await stop(a.child);
    // Separate room: crash its host node while a guest stays connected elsewhere.
    const c = await spawn({ nodeId: 'c', mode: 'prototype' });
    const crashHost = await connect(c.url, sockets);
    const crashRoom = await emit(crashHost, 'room:create');
    const survivor = await connect(b.url, sockets);
    assert.equal((await emit(survivor, 'room:join', { roomId: crashRoom.roomId })).ok, true);
    const killed = once(c.child, 'exit');
    c.child.kill('SIGKILL');
    await killed;
    const recoveryHost = await connect(b.url, sockets);
    const crashStart = performance.now();
    let recovery;
    do {
      recovery = await emit(recoveryHost, 'room:resume', { roomId: crashRoom.roomId, hostResumeToken: crashRoom.hostResumeToken });
      if (recovery.code === 'BUSY') await delay(100);
    } while (recovery.code === 'BUSY' && performance.now() - crashStart < 4000);
    assert.equal(recovery.ok, true);
    const crashRecovery = await delivery(recoveryHost, survivor, 'after-crash');
    const crashResumeMs = performance.now() - crashStart;
    assert.equal(crashRecovery.packet.epoch, 2);
    // Paused shared authority must refuse writes, never invent local success.
    await pauseRedis(true);
    let unavailable;
    try {
      unavailable = await emit(newHost, 'research:publish', { value: 'redis-unavailable' });
      assert.equal(unavailable.code, 'STORE_UNAVAILABLE');
    } finally {
      await pauseRedis(false);
    }
    return {
      processes: 2,
      productionWithAdapterOnly: { crossNodeJoin: crossNode.code, restartResume: resume.code },
      prototype: {
        crossNodeEvents: samples.length,
        p50Ms: percentile(samples, 0.5),
        p95Ms: percentile(samples, 0.95),
        maxMs: Math.max(...samples),
        simultaneousJoinAttempts: 30,
        acceptedWithOneExistingGuest: 23,
        rejectedAtSharedCap: 7,
        cap: 24,
        invalidResumeDenied: true,
        guestPublicationDenied: true,
        oldOwnerFenced: true,
        rotatedTokenRejectsReplay: true,
        drainResumeMs,
        crashResumeMs,
        survivingGuestReceivesAfterTakeover: true,
        redisOutage: unavailable.code,
        mediaContinuityTested: false
      }
    };
  } finally {
    for (const socket of sockets) socket.disconnect();
    await Promise.all(children.map(stop));
  }
}
