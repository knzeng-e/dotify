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
      expires: event => event.expires,
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
      expires: event => event[5] + 10_000,
      channel: (sender, recipient) => `private/${scope}/${sender}/${recipient}`,
      target: event => [event[2], event[3]]
    },
    receive,
    interrupted
  );
}

async function connectCelerity<T>(
  config: {
    app: string;
    topic: string;
    ttl: number;
    expires: (event: T) => number;
    channel: (a: string, b: string) => string;
    target: (event: T) => [string, string];
  },
  receive: (statement: ObservationStatement) => void,
  interrupted: () => void
): Promise<CelerityClient<T> | null> {
  const { isInsideContainer } = await import('@parity/product-sdk-host');
  if (!(await isInsideContainer())) return null;
  const sdk = await import('@parity/product-sdk-statement-store');
  const transport = await sdk.createTransport();
  const topics = [config.app, config.topic].map(name => sdk.topicToHex(sdk.createTopic(name)));
  let stopped = false;
  const client = new sdk.StatementStoreClient({
    appName: config.app,
    defaultTtlSeconds: config.ttl,
    transport: {
      // SDK channel/expiry dedup precedes authentication and hides reordering.
      // Keep its transport, codec and publisher; validate/replay-check in Dotify.
      subscribe: (_filter, _callback, onError) =>
        transport.subscribe(
          { matchAll: topics },
          statements => {
            for (const statement of statements) {
              if (
                stopped ||
                statement.topics?.[0] !== topics[0] ||
                statement.topics?.[1] !== topics[1] ||
                !statement.data ||
                statement.data.length > sdk.MAX_STATEMENT_SIZE
              )
                continue;
              try {
                receive({ data: sdk.decodeData(statement.data), expiry: statement.expiry, channel: statement.channel });
              } catch {
                /* Malformed statements cannot interrupt the subscription. */
              }
            }
          },
          error => {
            if (stopped) return;
            interrupted();
            onError(error);
          }
        ),
      signAndSubmit: (statement, credentials) => transport.signAndSubmit(statement, credentials),
      destroy: () => transport.destroy()
    }
  });
  const channelName = config.channel;
  const topic2 = config.topic;
  try {
    await client.connect({ mode: 'host' });
  } catch (error) {
    stopped = true;
    client.destroy();
    throw error;
  }
  return {
    encode: sdk.encodeData,
    maxStatementBytes: sdk.MAX_STATEMENT_SIZE,
    maxAccountBytes: sdk.MAX_USER_TOTAL,
    channel: (roomId, producer) => sdk.topicToHex(sdk.createChannel(channelName(roomId, producer))),
    publish: async event => {
      const remaining = config.expires(event) - Date.now();
      if (stopped || !Number.isFinite(remaining) || remaining <= 0 || remaining > config.ttl * 1000 + 5000) return false;
      // SDK expiry is second-granular. Preserve the authenticated payload TTL
      // after async encryption rather than starting another full TTL now.
      return (await client.publish(event, { channel: channelName(...config.target(event)), topic2, ttlSeconds: Math.ceil(remaining / 1000) })).ok;
    },
    stop: () => {
      stopped = true;
      client.destroy();
    }
  };
}
