import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeData } from '@parity/product-sdk-statement-store';
import { startPrivateCelerityObservation } from './celerityPrivateObservation';
import { createCelerityBudget } from './celerityEnvelope';
import type { RoomRealtimePort } from './roomRealtimePort';
import type { RealtimePeer, RealtimeRegistration } from './celerityPrivateTypes';
import type { ObservationStatement } from './celeritySdk';
import type { PrivateEnvelope } from './celerityPrivateChannel';
import type { CelerityMetric } from './celerityDiagnostics';

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach(stop => stop());
  vi.useRealTimers();
});

function network() {
  const peers: RealtimePeer[] = [];
  const ports: { incoming: (event: string, value: unknown) => void }[] = [];
  const readers = new Set<(statement: ObservationStatement) => void>();
  const wire: PrivateEnvelope[] = [];
  let revision = 0;
  const roster = () => ({ scope: 'a'.repeat(32), revision, peers: [...peers] });
  function port(id: string) {
    const handlers = new Map<string, Set<(value: unknown) => void>>();
    const incoming = (event: string, value: unknown) => handlers.get(event)?.forEach(callback => callback(value));
    const request = vi.fn((_event: string, input: { publicKey: string }, _options: unknown, reply: (error: null, value: RealtimeRegistration) => void) => {
      peers.push({ id, publicKey: input.publicKey, role: peers.length === 0 ? 'host' : 'listener' });
      revision++;
      reply(null, { ok: true, self: id, roster: roster() });
      ports.forEach(p => p.incoming('room:realtime-roster', roster()));
    });
    const emit = vi.fn();
    const result = {
      incoming,
      request,
      emit,
      api: {
        id,
        connected: true,
        request,
        emit,
        on: (event: string, callback: (value: unknown) => void) => {
          if (!handlers.has(event)) handlers.set(event, new Set());
          handlers.get(event)!.add(callback);
        },
        off: (event: string, callback: (value: unknown) => void) => handlers.get(event)?.delete(callback)
      } as unknown as RoomRealtimePort
    };
    ports.push(result);
    return result;
  }
  const createClient = vi.fn(async (_scope: string, receive: (statement: ObservationStatement) => void) => {
    readers.add(receive);
    return {
      encode: encodeData,
      maxStatementBytes: 512,
      maxAccountBytes: 1024,
      channel: (a: string, b: string) => `${a}/${b}`,
      publish: async (value: PrivateEnvelope) => {
        wire.push(value);
        for (const reader of readers)
          reader({ data: value, expiry: BigInt(Math.floor((value[5] + 10_000) / 1000)) << 32n, channel: `${value[2]}/${value[3]}` });
        return true;
      },
      stop: () => {
        readers.delete(receive);
      }
    };
  });
  function start(member: ReturnType<typeof port>, mode: 'observe' | 'dual', insideProduct = true, factory = createClient) {
    const metrics: CelerityMetric[] = [];
    const stop = startPrivateCelerityObservation(member.api, mode, {
      insideProduct: async () => insideProduct,
      createClient: factory,
      budget: createCelerityBudget(0),
      report: value => metrics.push(value)
    });
    stops.push(stop);
    return { metrics, stop };
  }
  return { port, start, createClient, wire, readers };
}

describe('private Product observation lifecycle', () => {
  it('exchanges encrypted canonical chat and reactions between two clients without changing UI authority', async () => {
    const n = network();
    const a = n.port('1'.repeat(16));
    const b = n.port('2'.repeat(16));
    const sender = n.start(a, 'dual');
    await vi.waitFor(() => expect(sender.metrics.some(m => m.event === 'ready')).toBe(true));
    const receiver = n.start(b, 'observe');
    await vi.waitFor(() => expect(receiver.metrics.some(m => m.event === 'ready')).toBe(true));
    a.incoming('room:chat', { senderId: a.api.id, text: 'a private room message' });
    await vi.waitFor(() => expect(receiver.metrics.some(m => m.event === 'accepted' && m.kind === 'chat')).toBe(true));
    a.incoming('room:reaction', { senderId: a.api.id, emoji: '\u{1F525}' });
    await vi.waitFor(() => expect(receiver.metrics.some(m => m.event === 'accepted' && m.kind === 'reaction')).toBe(true));
    const request = { id: 'canonical-request', senderId: a.api.id, ts: Date.now(), text: 'A song from home' };
    a.incoming('room:requests', [request]);
    await vi.waitFor(() => expect(receiver.metrics.some(m => m.event === 'accepted' && m.kind === 'request')).toBe(true));
    a.incoming('room:requests', [request]);
    expect(n.wire).toHaveLength(3);
    expect(JSON.stringify(n.wire)).not.toContain('a private room message');
    expect(a.emit).not.toHaveBeenCalled();
    expect(b.emit).not.toHaveBeenCalled();
    b.incoming('room:chat', { senderId: b.api.id, text: 'receive only' });
    a.incoming('room:chat', { senderId: b.api.id, text: 'do not echo other people' });
    expect(n.wire).toHaveLength(3);
    receiver.stop();
    expect(b.emit).toHaveBeenCalledWith('room:realtime-unregister', { scope: 'a'.repeat(32), self: b.api.id });
    expect(n.readers.size).toBe(1);
  });

  it('never registers anonymous standalone guests with the Product private transport', async () => {
    const n = network();
    const a = n.port('1'.repeat(16));
    const observed = n.start(a, 'dual', false);
    await vi.waitFor(() => expect(observed.metrics.some(m => m.event === 'unsupported')).toBe(true));
    expect(a.request).not.toHaveBeenCalled();
    expect(n.createClient).not.toHaveBeenCalled();
  });

  it('stops cleanly on unavailable transport without emitting chat or changing room admission', async () => {
    const n = network();
    const a = n.port('1'.repeat(16));
    const failing = vi.fn(async () => {
      throw new Error('Host permission denied');
    });
    const observed = n.start(a, 'dual', true, failing);
    await vi.waitFor(() => expect(observed.metrics.some(m => m.event === 'unavailable')).toBe(true));
    expect(a.emit).toHaveBeenCalledExactlyOnceWith('room:realtime-unregister', expect.anything());
    expect(n.wire).toEqual([]);
    expect(a.api.connected).toBe(true);
  });

  it('cleans up late SDK initialization after a disconnect', async () => {
    const n = network();
    const a = n.port('1'.repeat(16));
    let resolve!: (value: Awaited<ReturnType<typeof n.createClient>>) => void;
    const delayed = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<typeof n.createClient>>>(reply => {
          resolve = reply;
        })
    );
    const observed = n.start(a, 'dual', true, delayed);
    await vi.waitFor(() => expect(delayed).toHaveBeenCalledOnce());
    a.incoming('disconnect', 'network lost');
    const stop = vi.fn();
    resolve({ encode: encodeData, channel: (a, b) => `${a}/${b}`, maxAccountBytes: 1024, maxStatementBytes: 512, publish: async () => true, stop });
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(observed.metrics.some(m => m.event === 'ready')).toBe(false);
  });
});
