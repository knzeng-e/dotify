import { CELERITY_TTL_MS, type PresenceEnvelope } from './celerityEnvelope';

export type ObservationStatement = { data: unknown; expiry?: bigint; channel?: string };
export type CelerityClient = {
  encode: (value: unknown) => Uint8Array;
  maxStatementBytes: number;
  maxAccountBytes: number;
  channel: (room: string, producer: string) => string;
  publish: (event: PresenceEnvelope) => Promise<boolean>;
  stop: () => void;
};

export async function createCelerityClient(
  room: string,
  receive: (statement: ObservationStatement) => void,
  interrupted: () => void
): Promise<CelerityClient | null> {
  const { isInsideContainer } = await import('@parity/product-sdk-host');
  if (!(await isInsideContainer())) return null;
  const sdk = await import('@parity/product-sdk-statement-store');
  const transport = await sdk.createTransport();
  const client = new sdk.StatementStoreClient({
    appName: 'dotify-room-realtime-v1',
    defaultTtlSeconds: CELERITY_TTL_MS / 1000,
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
  const channelName = (roomId: string, producer: string) => `presence/${roomId}/${producer}`;
  const topic2 = `room/${room}`;
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
    publish: async event => (await client.publish(event, { channel: channelName(room, event.producer), topic2, ttlSeconds: CELERITY_TTL_MS / 1000 })).ok,
    stop: () => {
      subscription.unsubscribe();
      client.destroy();
    }
  };
}
