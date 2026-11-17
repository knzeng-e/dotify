import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBulletinReadLane } from './bulletinReadLane.js';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

test('RPC work stays bounded, queued cancellation runs nothing, and remaining work keeps FIFO order', async () => {
  const lane = createBulletinReadLane(1),
    hold = deferred(),
    entered: number[] = [],
    cancelled = new AbortController();
  const first = lane.run(new AbortController().signal, async () => {
    entered.push(1);
    await hold.promise;
  });
  const second = lane.run(cancelled.signal, async () => {
    entered.push(2);
  });
  const third = lane.run(new AbortController().signal, async () => {
    entered.push(3);
  });
  const reason = new Error('Synthetic cancel');
  cancelled.abort(reason);
  await assert.rejects(second, e => e === reason);
  assert.deepEqual(entered, [1]);
  hold.resolve();
  await Promise.all([first, third]);
  assert.deepEqual(entered, [1, 3]);
});
test('close and queue bounds reject unstarted work without consuming slots or losing a later failure', async () => {
  const lane = createBulletinReadLane(1),
    hold = deferred(),
    signal = new AbortController().signal;
  const first = lane.run(signal, async () => {
    await hold.promise;
    throw new Error('Active failure');
  });
  const firstRejected = assert.rejects(first, /Active failure/);
  const queued = Array.from({ length: 64 }, () => lane.run(signal, async () => assert.fail('Closed work ran')));
  const queueRejected = queued.map(p => assert.rejects(p, /lane closed/));
  await assert.rejects(
    lane.run(signal, async () => {}),
    /queue limit/
  );
  lane.close();
  await Promise.all(queueRejected);
  hold.resolve();
  await firstRejected;
  await assert.rejects(
    lane.run(signal, async () => {}),
    /lane closed/
  );
});
