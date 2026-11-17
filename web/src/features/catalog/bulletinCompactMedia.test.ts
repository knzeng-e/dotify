import { afterEach, expect, it, vi } from 'vitest';
import { createBulletinHostCompactMediaReader } from './bulletinCompactMedia';
import { createBulletinHostBlockReader, createBulletinHostMediaReader } from './bulletinHostMedia';
import { decryptStreamingMedia } from './streamingFormat';
import vector from './fixtures/compactMedia.json';
const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
const signal = () => new AbortController().signal;
function fixture(inside = true) {
  const blocks = new Map(Object.entries(vector.blocks).map(([cid, value]) => [cid, bytes(value)]));
  const queryBytes = vi.fn(async (cid: string, _options: { noReassemble: true; lookupTimeoutMs: number }) => ({ ok: true as const, value: blocks.get(cid)! }));
  const insideHost = vi.fn(() => inside),
    prepare = createBulletinHostCompactMediaReader({ insideHost, queryBytes });
  const input = { root: vector.root, manifestBytes: bytes(vector.manifestHex), key: bytes(vector.keyHex), scope: vector.scope, signal: signal() };
  return { blocks, queryBytes, insideHost, prepare, input };
}
afterEach(() => vi.useRealTimers());
it('reconstructs the API constructor vector and decrypts every quality with the ordinary verified context', async () => {
  const f = fixture(),
    prepared = await f.prepare(f.input);
  for (const r of prepared.context.manifest.renditions)
    for (const object of [r.init, ...r.segments]) {
      const encrypted = await prepared.read(object.path, object.encryptedLength);
      expect(encrypted).not.toBeNull();
      expect(await decryptStreamingMedia(prepared.context, object, encrypted!)).toEqual(bytes(vector.plain[object.path as keyof typeof vector.plain]));
    }
  expect(f.queryBytes).toHaveBeenCalled();
  for (const call of f.queryBytes.mock.calls) expect(call[1]).toEqual({ noReassemble: true, lookupTimeoutMs: 10_000 });
});
it('authenticates manifest/scope before Host calls and copies bytes before asynchronous authentication', async () => {
  const f = fixture();
  for (const extra of [
    { key: new Uint8Array(32) },
    { scope: { ...f.input.scope, contentHash: '0x' + '33'.repeat(32) } },
    { manifestBytes: new Uint8Array(256 * 1024 + 1) }
  ])
    await expect(f.prepare({ ...f.input, ...extra })).rejects.toThrow();
  expect(f.insideHost).not.toHaveBeenCalled();
  expect(f.queryBytes).not.toHaveBeenCalled();
  const pending = f.prepare(f.input);
  f.input.manifestBytes.fill(0);
  expect(await (await pending).read('96/init.bin', 816)).toHaveLength(816);
});
it('refuses archive/direct pack/arbitrary ranges and invalid bounds before SDK calls', async () => {
  const f = fixture(),
    prepared = await f.prepare(f.input);
  for (const path of ['archive/master.bin', '96/pack.bin', '../manifest.json', '96/segment-256.bin', '96/init.bin?offset=1'])
    await expect(prepared.read(path, 816)).rejects.toThrow();
  for (const max of [0, -1, 0.5, Infinity, 2 * 1024 * 1024, 1]) await expect(prepared.read('96/init.bin', max)).rejects.toThrow('bound');
  expect(f.queryBytes).not.toHaveBeenCalled();
  expect(f.insideHost).not.toHaveBeenCalled();
});
it('returns null outside the Host without probing SDK, and refuses corrupt block responses', async () => {
  const outside = fixture(false),
    prepared = await outside.prepare(outside.input);
  expect(await prepared.read('96/init.bin', 816)).toBeNull();
  expect(outside.queryBytes).not.toHaveBeenCalled();
  const f = fixture();
  f.queryBytes.mockImplementation(async () => ({ ok: true, value: new Uint8Array([1, 2, 3]) }));
  await expect((await f.prepare(f.input)).read('96/init.bin', 816)).rejects.toThrow('authentication');
});
it('caps the real lifetime of uncancellable SDK calls across cancelled readers', async () => {
  const completions: Array<(value: { ok: false }) => void> = [];
  const queryBytes = vi.fn(() => new Promise<{ ok: false }>(resolve => completions.push(resolve)));
  const f = fixture(),
    prepare = createBulletinHostCompactMediaReader({ insideHost: () => true, queryBytes });
  const session = await prepare(f.input);
  vi.useFakeTimers();
  for (let i = 0; i < 2; i++) {
    const owner = new AbortController();
    const rejected = expect(session.read('96/init.bin', 816, owner.signal)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    owner.abort();
    await rejected;
  }
  expect(queryBytes).toHaveBeenCalledTimes(2);
  await expect(session.read('96/init.bin', 816)).rejects.toThrow('busy');
  expect(queryBytes).toHaveBeenCalledTimes(2);
  completions.forEach(finish => finish({ ok: false }));
  await vi.advanceTimersByTimeAsync(0);
  const next = expect(session.read('96/init.bin', 816)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(10_001);
  await next;
  expect(queryBytes).toHaveBeenCalledTimes(3);
  completions[2]({ ok: false });
});
it('retiring the prepared owner permanently cancels further reads without a Host reconnect', async () => {
  const f = fixture(),
    owner = new AbortController(),
    prepared = await f.prepare({ ...f.input, signal: owner.signal });
  owner.abort();
  await expect(prepared.read('96/init.bin', 816)).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.queryBytes).not.toHaveBeenCalled();
  expect(f.insideHost).not.toHaveBeenCalled();
});

it('old and compact adapters share the same actual SDK budget across format transitions', async () => {
  const pending: Array<(value: { ok: false }) => void> = [];
  const queryBytes = vi.fn(() => new Promise<{ ok: false }>(resolve => pending.push(resolve)));
  const deps = { insideHost: () => true, queryBytes },
    block = createBulletinHostBlockReader(deps);
  const legacy = createBulletinHostMediaReader(deps, false, block);
  const f = fixture(),
    compact = await createBulletinHostCompactMediaReader(deps, block)(f.input);
  vi.useFakeTimers();
  for (let i = 0; i < 2; i++) {
    const owner = new AbortController();
    const rejected = expect(legacy(vector.root, '96/init.bin', 816, owner.signal)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    owner.abort();
    await rejected;
  }
  await expect(compact.read('96/init.bin', 816)).rejects.toThrow('busy');
  expect(queryBytes).toHaveBeenCalledTimes(2);
  pending.forEach(resolve => resolve({ ok: false }));
  await vi.advanceTimersByTimeAsync(0);
});
it('the prepared root and owner cannot be changed through the original mutable input object', async () => {
  const f = fixture(),
    owner = new AbortController(),
    input = { ...f.input, signal: owner.signal };
  const compact = await f.prepare(input);
  input.root = 'invalid';
  expect(await compact.read('96/init.bin', 816)).toHaveLength(816);
  owner.abort();
  input.signal = signal();
  await expect(compact.read('96/init.bin', 816)).rejects.toMatchObject({ name: 'AbortError' });
});
