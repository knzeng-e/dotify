import type { RoomRealtimePort } from './roomRealtimePort';
import type { RealtimeRoster } from './celerityPrivateTypes';
import type { RoomChatMessage, RoomReactionEvent, RoomRequest } from '../../shared/types';
import { createPrivateRoomIdentity, type PrivateRoomChannel, type PrivateRoomEvent, type PrivateEnvelope } from './celerityPrivateChannel';
import { createPrivateCelerityClient, type CelerityClient, type ObservationStatement } from './celeritySdk';
import { celerityBudget, createCelerityBudget } from './celerityEnvelope';
import { recordCelerityMetric, type CelerityMetric } from './celerityDiagnostics';

type Deps = {
  insideProduct?: () => Promise<boolean>;
  createClient?: typeof createPrivateCelerityClient;
  report?: (metric: CelerityMetric) => void;
  budget?: ReturnType<typeof createCelerityBudget>;
};

/** Mirrors only the sender's server-accepted events. No UI state or media authority. */
export function startPrivateCelerityObservation(port: RoomRealtimePort, mode: 'observe' | 'dual', deps: Deps = {}) {
  const report = deps.report ?? recordCelerityMetric;
  const reserve = deps.budget ?? celerityBudget;
  const socketId = port.id;
  let stopped = false;
  let sending = false;
  let receiving = 0;
  let privateChannel: PrivateRoomChannel | undefined;
  let client: CelerityClient<PrivateEnvelope> | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let latest: RealtimeRoster | undefined;
  let initial: ObservationStatement[] = [];
  let requestIds = new Set<string>();
  const startedAt = Date.now();
  const metric = (event: CelerityMetric['event'], fields: Partial<CelerityMetric> = {}) => report({ at: Date.now(), channel: 'private', event, ...fields });

  function roster(next: RealtimeRoster) {
    if (stopped) return;
    if (!next || !Number.isSafeInteger(next.revision)) return;
    if (privateChannel) {
      privateChannel.update(next);
      if (!privateChannel.active()) stop('interrupted');
    } else if (!latest || next.revision > latest.revision) latest = next;
  }
  function stop(reason: CelerityMetric['event'] = 'stopped') {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    port.off('room:realtime-roster', roster);
    port.off('room:reaction', reaction);
    port.off('room:chat', chat);
    port.off('room:requests', requests);
    port.off('disconnect', disconnected);
    port.off('room:closed', closed);
    privateChannel?.close();
    if (privateChannel && port.connected && port.id === socketId)
      port.emit('room:realtime-unregister', { scope: privateChannel.scope, self: privateChannel.self });
    client?.stop();
    initial = [];
    requestIds.clear();
    metric(reason);
  }
  const disconnected = () => stop('interrupted');
  const closed = () => stop();

  async function receive(statement: ObservationStatement) {
    if (stopped) return;
    if (!client) {
      if (initial.length < 16) initial.push(statement);
      return;
    }
    const value = statement.data;
    if (!Array.isArray(value) || value[3] !== privateChannel?.self) return;
    if (receiving >= 4) {
      metric('capacity');
      return;
    }
    if (statement.channel !== client.channel(value[2], value[3])) {
      metric('invalid');
      return;
    }
    receiving++;
    try {
      const opened = await privateChannel?.open(value, statement.expiry);
      if (!stopped) metric(opened ? 'accepted' : 'invalid', opened ? { kind: opened.event.kind, ageMs: opened.ageMs } : {});
    } finally {
      receiving--;
    }
  }

  async function publish(event: PrivateRoomEvent) {
    if (stopped || mode !== 'dual' || !client || !privateChannel || sending) return;
    sending = true;
    const started = performance.now();
    deadline = setTimeout(() => stop('timeout'), 8000);
    try {
      for (const peer of privateChannel.peers()) {
        const envelope = await privateChannel.seal(peer.id, event);
        if (stopped) return;
        if (!envelope) {
          metric('budget', { kind: event.kind });
          continue;
        }
        const bytes = client.encode(envelope).length;
        if (
          !reserve.reserve(client.channel(envelope[2], envelope[3]), bytes, envelope[5] + 10_000, Date.now(), client.maxAccountBytes, client.maxStatementBytes)
        ) {
          metric('budget', { kind: event.kind });
          continue;
        }
        const ok = await client.publish(envelope);
        if (stopped) return;
        metric(ok ? 'submitted' : 'rejected', { kind: event.kind, bytes, durationMs: Math.round(performance.now() - started) });
      }
    } catch {
      if (!stopped) metric('rejected', { kind: event.kind });
    } finally {
      clearTimeout(deadline);
      sending = false;
    }
  }
  function reaction(event: RoomReactionEvent) {
    if (event?.senderId === socketId) void publish({ kind: 'reaction', text: event.emoji });
  }
  function chat(event: RoomChatMessage) {
    if (event?.senderId === socketId) void publish({ kind: 'chat', text: event.text });
  }
  function requests(events: RoomRequest[]) {
    if (!Array.isArray(events)) return;
    const current = events.slice(0, 20);
    const added = current.filter(event => event?.senderId === socketId && event.ts >= startedAt && !requestIds.has(event.id));
    requestIds = new Set(current.map(event => event?.id));
    // Full snapshots are reconciliation, not instructions to resubmit old requests.
    for (const event of added) void publish({ kind: 'request', text: event.text });
  }

  port.on('disconnect', disconnected);
  port.on('room:closed', closed);
  metric('starting');
  deadline = setTimeout(() => stop('timeout'), 8000);
  void (async () => {
    const inside = deps.insideProduct ?? (async () => (await import('@parity/product-sdk-host')).isInsideContainer());
    if (!(await inside())) {
      stop('unsupported');
      return;
    }
    if (stopped || !port.connected || port.id !== socketId) return;
    const identity = await createPrivateRoomIdentity();
    if (stopped) return;
    port.on('room:realtime-roster', roster);
    port.request('room:realtime-register', { publicKey: identity.publicKey }, { timeoutMs: 6000 }, (error, registration) => {
      if (!registration?.ok || error) {
        stop('unavailable');
        return;
      }
      if (stopped) {
        if (port.connected && port.id === socketId) port.emit('room:realtime-unregister', { scope: registration.roster.scope, self: registration.self });
        return;
      }
      try {
        privateChannel = identity.bind(registration.self, registration.roster);
        if (latest) privateChannel.update(latest);
        if (!privateChannel.active()) {
          stop('interrupted');
          return;
        }
      } catch {
        stop('unavailable');
        return;
      }
      void (deps.createClient ?? createPrivateCelerityClient)(
        registration.roster.scope,
        statement => {
          void receive(statement);
        },
        () => stop('interrupted')
      )
        .then(connected => {
          if (stopped) {
            connected?.stop();
            return;
          }
          client = connected;
          if (!client) {
            stop('unsupported');
            return;
          }
          clearTimeout(deadline);
          port.on('room:reaction', reaction);
          port.on('room:chat', chat);
          port.on('room:requests', requests);
          const replay = initial;
          initial = [];
          replay.forEach(statement => {
            void receive(statement);
          });
          metric('ready');
        })
        .catch(() => stop('unavailable'));
    });
  })().catch(() => stop('unavailable'));
  return () => stop();
}
