import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StatementTransport, Statement } from '@parity/product-sdk-statement-store';
import { createCelerityClient, createPrivateCelerityClient } from './celeritySdk';
import type { PrivateEnvelope } from './celerityPrivateChannel';
import { presenceEnvelope } from './celerityEnvelope';

const mock = vi.hoisted(() => ({ host: true, transport: null as unknown as StatementTransport }));
vi.mock('@parity/product-sdk-host', () => ({ isInsideContainer: () => mock.host }));
vi.mock('@parity/product-sdk-statement-store', async original => ({
  ...(await original<typeof import('@parity/product-sdk-statement-store')>()),
  createTransport: async () => mock.transport
}));

afterEach(() => {
  vi.useRealTimers();
  mock.host = true;
});

describe('pinned SDK adapter', () => {
  it('encodes private envelopes with a separate namespace, directed channel and ten-second expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const submitted: Statement[] = [];
    let incoming!: (statements: Statement[]) => void;
    mock.transport = {
      subscribe: (_filter, callback) => {
        incoming = callback;
        return { unsubscribe: vi.fn() };
      },
      signAndSubmit: async statement => {
        submitted.push(statement);
      },
      destroy: vi.fn()
    };
    const scope = 'a'.repeat(32);
    const receive = vi.fn();
    const client = (await createPrivateCelerityClient(scope, receive, vi.fn()))!;
    const value: PrivateEnvelope = [2, scope, '1'.repeat(16), '2'.repeat(16), 1, Date.now(), 'nonce', 'opaque'];
    expect(await client.publish(value)).toBe(true);
    expect(submitted[0].data).toEqual(client.encode(value));
    expect(submitted[0].channel).toBe(client.channel(value[2], value[3]));
    expect(Number(submitted[0].expiry! >> 32n) * 1000).toBe(Date.now() + 10_000);
    incoming(submitted);
    expect(receive).toHaveBeenCalledWith({ data: value, expiry: submitted[0].expiry, channel: submitted[0].channel });
    client.stop();
  });
  it('never initializes Statement Store outside Product', async () => {
    mock.host = false;
    expect(await createCelerityClient('ABC123', vi.fn(), vi.fn())).toBeNull();
  });

  it('uses real encoding/expiry/channel and sponsored host credentials, and exposes interruption', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    let incoming!: (statements: Statement[]) => void;
    let error!: (error: Error) => void;
    const unsubscribe = vi.fn();
    const submitted: Statement[] = [];
    mock.transport = {
      subscribe: (_filter, onStatements, onError) => {
        incoming = onStatements;
        error = onError;
        return { unsubscribe };
      },
      signAndSubmit: vi.fn(async statement => {
        submitted.push(statement);
      }),
      destroy: vi.fn()
    };
    const receive = vi.fn();
    const interrupted = vi.fn();
    const client = (await createCelerityClient('ABC123', receive, interrupted))!;
    const event = presenceEnvelope('ABC123', 'a'.repeat(32), 1, 3, Date.now());
    expect(await client.publish(event)).toBe(true);
    expect(mock.transport.signAndSubmit).toHaveBeenCalledWith(expect.anything(), { mode: 'host' });
    expect(submitted[0].data).toEqual(client.encode(event));
    expect(submitted[0].channel).toBe(client.channel('ABC123', event.producer));
    incoming(submitted);
    incoming(submitted);
    expect(receive).toHaveBeenCalledOnce(); // SDK already removes duplicates.
    expect(receive).toHaveBeenCalledWith({ data: event, expiry: submitted[0].expiry, channel: submitted[0].channel });
    error(new Error('network interrupted'));
    expect(interrupted).toHaveBeenCalledOnce();
    client.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(mock.transport.destroy).toHaveBeenCalledOnce();
  });
});
