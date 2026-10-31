import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizationPolicy, finalizationProducer } from './host/finalization.ts';
const ranges = items => ({ length: items.length, start: i => items[i][0], end: i => items[i][1] });
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(policy = 'after-final-append', observer) {
  const events = [],
    appends = [],
    errors = [],
    controller = new AbortController();
  class Source extends EventTarget {
    #state = 'open';
    duration = 64;
    streaming = true;
    finishes = 0;
    get readyState() {
      return this.#state;
    }
    endOfStream() {
      this.finishes++;
      this.#state = 'ended';
      this.dispatchEvent(new Event('sourceended'));
    }
    reopen() {
      this.#state = 'open';
      this.dispatchEvent(new Event('sourceopen'));
    }
  }
  const source = new Source();
  const buffer = Object.assign(new EventTarget(), { buffered: ranges([]), updating: false });
  const audio = Object.assign(new EventTarget(), { currentTime: 0 });
  const producer = finalizationProducer(policy, observer ?? (event => events.push(event)), error => errors.push(error));
  const run = producer({
    source,
    buffer,
    audio,
    signal: controller.signal,
    segmentCount: 16,
    duration: 64,
    bufferAheadSeconds: () => 30,
    initialize: async () => source.reopen(),
    appendSegment: async index => {
      appends.push(index);
      buffer.buffered = ranges([[0, Math.max((index + 1) * 4, buffer.buffered.length ? buffer.buffered.end(0) : 0)]]);
      buffer.dispatchEvent(new Event('updateend'));
    }
  }).catch(error => error);
  const move = at => {
    audio.currentTime = at;
    audio.dispatchEvent(new Event('timeupdate'));
  };
  const stop = async () => {
    controller.abort();
    assert.equal((await run).name, 'AbortError');
  };
  return { source, buffer, audio, events, appends, errors, controller, move, stop };
}
test('only explicit finalization controls are admitted', () => {
  assert.equal(finalizationPolicy(), 'after-final-append');
  for (const value of ['never', '', null, {}, '__proto__']) assert.throws(() => finalizationPolicy(value));
});
test('baseline preserves immediate finalization and binds native receivers without changing source identity', async () => {
  const h = harness();
  await flush();
  assert.equal(h.appends.length, 8);
  h.move(36);
  await flush();
  assert.equal(h.source.finishes, 1);
  assert.equal(h.source.readyState, 'ended');
  assert.ok(h.events.some(e => e.name === 'segment-append-complete' && e.segmentIndex === 15));
  assert.deepEqual(
    h.events.filter(e => e.name.startsWith('end-of-stream-')).map(e => [e.name, e.mediaSeconds]),
    [
      ['end-of-stream-requested', 36],
      ['end-of-stream-called', 36]
    ]
  );
  assert.equal(h.events.find(e => e.name === 'sourceended').sourceState, 'ended');
  await h.stop();
});
test('deferred finalization keeps producing without closing the source until its buffered tail is playing', async () => {
  const h = harness('near-playback-end');
  await flush();
  h.move(36);
  await flush();
  assert.equal(h.appends.length, 16);
  assert.equal(h.source.readyState, 'open');
  assert.equal(h.source.finishes, 0);
  h.move(62.9);
  await flush();
  assert.equal(h.source.finishes, 0);
  h.buffer.updating = true;
  h.move(63);
  await flush();
  assert.equal(h.source.finishes, 0);
  h.buffer.updating = false;
  h.buffer.dispatchEvent(new Event('updateend'));
  await flush();
  assert.equal(h.source.finishes, 1);
  assert.ok(h.events.some(e => e.name === 'end-of-stream-called' && e.mediaSeconds === 63));
  h.move(64);
  await flush();
  assert.equal(h.source.finishes, 1);
  await h.stop();
});
test('deferred finish cannot close over a managed eviction hole, and repairs a backwards seek', async () => {
  const h = harness('near-playback-end');
  await flush();
  h.move(36);
  await flush();
  h.source.streaming = false;
  h.buffer.buffered = ranges([
    [0, 62],
    [63.5, 64]
  ]);
  h.move(63);
  await flush();
  assert.equal(h.source.finishes, 0);
  h.source.streaming = true;
  h.audio.currentTime = 0;
  h.buffer.buffered = ranges([[4, 64]]);
  h.audio.dispatchEvent(new Event('seeking'));
  await flush();
  assert.equal(h.appends.filter(i => i === 0).length, 2);
  assert.equal(h.source.finishes, 0);
  h.move(63);
  await flush();
  assert.equal(h.source.finishes, 1);
  await h.stop();
});
test('cancelling a deferred finish removes listeners and never closes a retired source later', async () => {
  const h = harness('near-playback-end');
  await flush();
  h.move(36);
  await flush();
  const count = h.events.length;
  await h.stop();
  h.move(64);
  h.buffer.dispatchEvent(new Event('updateend'));
  assert.equal(h.source.finishes, 0);
  assert.equal(h.events.length, count);
});
test('observer failures cannot stop authenticated appends or mask completion', async () => {
  const h = harness('after-final-append', () => {
    throw new Error('Evidence unavailable');
  });
  await flush();
  h.move(36);
  await flush();
  assert.equal(h.source.finishes, 1);
  assert.deepEqual(h.errors, []);
  await h.stop();
});

test('one-sample TimeRanges rounding cannot prevent natural completion, but a real tail gap cannot be hidden', async () => {
  const h = harness('near-playback-end');
  await flush();
  h.move(36);
  await flush();
  h.source.streaming = false;
  h.buffer.buffered = ranges([[0, 64 - 2 / 48000]]);
  h.move(63);
  await flush();
  assert.equal(h.source.finishes, 0);
  h.buffer.buffered = ranges([[0, 63.999999]]);
  h.buffer.dispatchEvent(new Event('updateend'));
  await flush();
  assert.equal(h.source.finishes, 1);
  await h.stop();
});

test('asynchronous native finalization errors are reported once and never retried', async () => {
  const h = harness('near-playback-end');
  await flush();
  h.move(36);
  await flush();
  const error = new Error('Native finish failed');
  h.source.endOfStream = () => {
    throw error;
  };
  h.move(63);
  await flush();
  h.move(63.5);
  await flush();
  assert.deepEqual(h.errors, [error]);
  await h.stop();
});
