import { describe, expect, it } from 'vitest';
import { RoomCreationController } from './roomCreation';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('room creation lifetime', () => {
  it('does not create or publish an obsolete choice when track preparation finishes late', async () => {
    const creation = new RoomCreationController();
    const audio = deferred();
    const submitted: string[] = [];
    const visible: string[] = [];
    const first = creation.begin();
    const delayed = (async () => {
      await audio.promise;
      if (first.aborted) return;
      submitted.push('old room');
      if (creation.finish(first)) visible.push('old room');
    })();

    creation.cancel(); // Opening a replacement sheet supersedes preparation.
    const replacement = creation.begin();
    submitted.push('new room');
    expect(creation.finish(replacement)).toBe(true);
    audio.resolve();
    await delayed;

    expect(submitted).toEqual(['new room']);
    expect(visible).toEqual([]);
  });

  it('retires a sent room before its replacement and ignores its delayed acknowledgement', async () => {
    const creation = new RoomCreationController();
    const ack = deferred();
    const wire: string[] = [];
    const installed: string[] = [];
    const first = creation.begin();
    creation.markSent(first);
    wire.push('create old');
    const delayed = (async () => {
      await ack.promise;
      if (creation.finish(first)) installed.push('old room');
    })();

    if (creation.cancel()) wire.push('leave');
    const replacement = creation.begin();
    creation.markSent(replacement);
    wire.push('create new');
    expect(creation.finish(replacement)).toBe(true);
    installed.push('new room');
    ack.resolve();
    await delayed;

    expect(wire).toEqual(['create old', 'leave', 'create new']);
    expect(installed).toEqual(['new room']);
    expect(creation.cancel()).toBe(false); // A stale ACK cannot close the replacement.
  });

  it('leaving while permission is pending prevents a later transport send', async () => {
    const creation = new RoomCreationController();
    const permission = deferred();
    const submitted: AbortSignal[] = [];
    const signal = creation.begin();
    const delayed = (async () => {
      await permission.promise;
      if (!signal.aborted) submitted.push(signal);
    })();

    expect(creation.cancel()).toBe(false);
    permission.resolve();
    await delayed;

    expect(submitted).toEqual([]);
    expect(creation.finish(signal)).toBe(false);
  });

  it('leaving during an acknowledgement retires the pending room exactly once', () => {
    const creation = new RoomCreationController();
    const signal = creation.begin();
    creation.markSent(signal);

    expect(creation.cancel()).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(creation.cancel()).toBe(false);
    expect(creation.finish(signal)).toBe(false);
  });

  it('opening or dismissing another dialog cannot leave an acknowledged live room', () => {
    const creation = new RoomCreationController();
    const signal = creation.begin();
    creation.markSent(signal);

    expect(creation.finish(signal)).toBe(true);
    expect(creation.finish(signal)).toBe(false);
    expect(creation.cancel()).toBe(false);
    const next = creation.begin();
    creation.markSent(signal); // A stale callback cannot mark this dialog as sent.
    expect(creation.cancel()).toBe(false);
    expect(next.aborted).toBe(true);
  });
});
