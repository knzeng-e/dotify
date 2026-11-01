import { afterEach, describe, expect, it, vi } from 'vitest';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { blake2b256 } from '@polkadot-apps/utils';
import { createBulletinHostMediaReader } from './bulletinHostMedia';
import { isBulletinMediaRoot } from './streamingTransport';

function fixture(bytes = new TextEncoder().encode('encrypted media')) {
  const blocks = new Map<string, Uint8Array>();
  const add = (codec: number, data: Uint8Array) => {
    const cid = CID.createV1(codec, digest(0xb220, blake2b256(data)));
    blocks.set(cid.toString(), data);
    return cid;
  };
  const raw = add(0x55, bytes);
  const directory = (name: string, child: CID) => {
    const bytes: unknown = dagPB.encode({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: [{ Name: name, Hash: child }] });
    if (!(bytes instanceof Uint8Array)) throw new Error('Invalid directory encoding');
    return add(0x70, bytes);
  };
  const root = directory('160', directory('segment-000.bin', raw)).toString();
  const queryBytes = vi.fn(async (cid: string) => ({ ok: true as const, value: blocks.get(cid)! }));
  return { blocks, raw, root, queryBytes, bytes, read: createBulletinHostMediaReader({ insideHost: () => true, queryBytes }) };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ordinary Host Bulletin media reader', () => {
  it('reads only the selected directory/file dependencies and verifies raw SDK responses', async () => {
    const c = fixture();
    expect(isBulletinMediaRoot(c.root)).toBe(true);
    const bytes = await c.read(c.root, '160/segment-000.bin', 1024, new AbortController().signal);
    expect(bytes).toEqual(c.bytes);
    expect(c.queryBytes).toHaveBeenCalledTimes(3);
    for (const call of c.queryBytes.mock.calls) expect(call.length).toBe(2);
    expect(c.queryBytes).toHaveBeenLastCalledWith(c.raw.toString(), { noReassemble: true, lookupTimeoutMs: 10_000 });
    await c.read(c.root, '160/segment-000.bin', 1024, new AbortController().signal);
    expect(c.queryBytes).toHaveBeenCalledTimes(3);
  });
  it('never treats corruption, an archive path or an oversized object as usable media', async () => {
    const c = fixture();
    c.queryBytes.mockImplementation(async () => ({ ok: true, value: new Uint8Array([1, 2, 3]) }));
    await expect(c.read(c.root, '160/segment-000.bin', 1024, new AbortController().signal)).rejects.toThrow('authentication');
    c.queryBytes.mockClear();
    for (const path of ['archive/master.bin', '../manifest.json', '160/segment-256.bin', 'manifest.json?key=secret'])
      await expect(c.read(c.root, path, 1024, new AbortController().signal)).rejects.toThrow('path');
    expect(c.queryBytes).not.toHaveBeenCalled();
    const large = fixture(new Uint8Array(2048));
    await expect(large.read(large.root, '160/segment-000.bin', 1024, new AbortController().signal)).rejects.toThrow('object bound');
  });
  it('falls back without querying the Host when it is not available', async () => {
    const c = fixture();
    const read = createBulletinHostMediaReader({ insideHost: () => false, queryBytes: c.queryBytes });
    expect(await read(c.root, '160/segment-000.bin', 1024, new AbortController().signal)).toBeNull();
    expect(c.queryBytes).not.toHaveBeenCalled();
  });
  it('bounds unresponsive SDK subscriptions across cancelled callers and admits work again only after settlement', async () => {
    vi.useFakeTimers();
    const c = fixture();
    const completions: Array<(value: { ok: false }) => void> = [];
    const queryBytes = vi.fn(() => new Promise<{ ok: false }>(resolve => completions.push(resolve)));
    const read = createBulletinHostMediaReader({ insideHost: () => true, queryBytes });
    for (let i = 0; i < 2; i++) {
      const abort = new AbortController();
      const reading = expect(read(c.root, '160/segment-000.bin', 1024, abort.signal)).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(0);
      abort.abort();
      await reading;
    }
    expect(queryBytes).toHaveBeenCalledTimes(2);
    await expect(read(c.root, '160/segment-000.bin', 1024, new AbortController().signal)).rejects.toThrow('busy');
    expect(queryBytes).toHaveBeenCalledTimes(2);
    completions.forEach(resolve => resolve({ ok: false }));
    await vi.advanceTimersByTimeAsync(0);
    const reading = expect(read(c.root, '160/segment-000.bin', 1024, new AbortController().signal)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10_001);
    await reading;
    expect(queryBytes).toHaveBeenCalledTimes(3);
    completions[2]({ ok: false });
  });
});
