import { CELERITY_TTL_MS, type PresenceEnvelope } from './celerityEnvelope';
import type { PrivateEnvelope } from './celerityPrivateChannel';

export type ObservationStatement = { data: unknown; expiry?: bigint; channel?: string };
export type CelerityClient<T = PresenceEnvelope> = {
  encode: (value: unknown) => Uint8Array;
  maxStatementBytes: number;
  maxAccountBytes: number;
  channel: (room: string, producer: string) => string;
  publish: (event: T) => Promise<boolean>;
  stop: () => void;
};

export async function createCelerityClient(
  room: string,
  receive: (statement: ObservationStatement) => void,
  interrupted: () => void
): Promise<CelerityClient | null> {
  return connectCelerity<PresenceEnvelope>(
    {
      app: 'dotify-room-realtime-v1',
      topic: `room/${room}`,
      ttl: CELERITY_TTL_MS / 1000,
      channel: (roomId, producer) => `presence/${roomId}/${producer}`,
      target: event => [room, event.producer]
    },
    receive,
    interrupted
  );
}

export async function createPrivateCelerityClient(scope: string, receive: (statement: ObservationStatement) => void, interrupted: () => void) {
  return connectCelerity<PrivateEnvelope>(
    {
      app: 'dotify-room-private-v2',
      topic: `scope/${scope}`,
      ttl: 10,
      channel: (sender, recipient) => `private/${scope}/${sender}/${recipient}`,
      target: event => [event[2], event[3]]
    },
    receive,
    interrupted
  );
}

async function connectCelerity<T>(
  config: { app: string; topic: string; ttl: number; channel: (a: string, b: string) => string; target: (event: T) => [string, string] },
  receive: (statement: ObservationStatement) => void,
  interrupted: () => void
): Promise<CelerityClient<T> | null> {
  const { isInsideContainer } = await import('@parity/product-sdk-host');
  if (!(await isInsideContainer())) return null;
  const sdk = await import('@parity/product-sdk-statement-store');
  const transport = await sdk.createTransport();
  const client = new sdk.StatementStoreClient({
    appName: config.app,
    defaultTtlSeconds: config.ttl,
    transport: {
      subscribe: (filter, callback, onError) =>
        transport.subscribe(filter, callback, error => {
          interrupted();
          onError(error);
        }),
      signAndSubmit: (statement, credentials) => transport.signAndSubmit(statement, credentials),
      destroy: () => transport.destroy()
    }
  });
  const channelName = config.channel;
  const topic2 = config.topic;
  // Register before connect: Host subscription may synchronously replay stored statements.
  const subscription = client.subscribe(statement => receive({ data: statement.data, expiry: statement.expiry, channel: statement.channelHex }), { topic2 });
  try {
    await client.connect({ mode: 'host' });
  } catch (error) {
    subscription.unsubscribe();
    client.destroy();
    throw error;
  }
  return {
    encode: sdk.encodeData,
    maxStatementBytes: sdk.MAX_STATEMENT_SIZE,
    maxAccountBytes: sdk.MAX_USER_TOTAL,
    channel: (roomId, producer) => sdk.topicToHex(sdk.createChannel(channelName(roomId, producer))),
    publish: async event => (await client.publish(event, { channel: channelName(...config.target(event)), topic2, ttlSeconds: config.ttl })).ok,
    stop: () => {
      subscription.unsubscribe();
      client.destroy();
    }
  };
}
