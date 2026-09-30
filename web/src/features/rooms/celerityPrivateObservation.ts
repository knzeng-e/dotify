import type { RoomRealtimePort } from './roomRealtimePort';
import type { RealtimeRoster } from './celerityPrivateTypes';
import type { RoomChatMessage, RoomReactionEvent, RoomRequest } from '../../shared/types';
import { createPrivateRoomIdentity, type PrivateRoomChannel, type PrivateRoomEvent, type PrivateEnvelope } from './celerityPrivateChannel';
import { createPrivateCelerityClient, type CelerityClient, type ObservationStatement } from './celeritySdk';
import { celerityBudget, createCelerityBudget } from './celerityEnvelope';
import { recordCelerityMetric, type CelerityMetric } from './celerityDiagnostics';
import { celerityCapture } from './celerityCapture';
import { measureRoomClock } from './celerityClock';

type Deps = {
  insideProduct?: () => Promise<boolean>;
  createClient?: typeof createPrivateCelerityClient;
  report?: (metric: CelerityMetric) => void;
  budget?: ReturnType<typeof createCelerityBudget>;
  publishTimeoutMs?: number;
};

const PRIVATE_TTL_MS = 10_000;
const MAX_PENDING_EVENTS = 16;

/** Mirrors only the sender's server-accepted events. No UI state or media authority. */
export function startPrivateCelerityObservation(port: RoomRealtimePort, mode: 'observe' | 'dual', deps: Deps = {}) {
  const report = deps.report ?? recordCelerityMetric;
  const reserve = deps.budget ?? celerityBudget;
  const publishTimeoutMs = deps.publishTimeoutMs ?? 8_000;
  const socketId = port.id;
  let stopped = false;
  let publishing = false;
  let receiving = 0;
  let privateChannel: PrivateRoomChannel | undefined;
  let client: CelerityClient<PrivateEnvelope> | null = null;
  let latest: RealtimeRoster | undefined;
  let initial: ObservationStatement[] = [];
  const pendingEvents: { event: PrivateRoomEvent; queuedAt: number }[] = [];
  let releaseClock: (() => void) | undefined;
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
    clearTimeout(startupDeadline);
    releaseClock?.();
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
    pendingEvents.length = 0;
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
      const opened = await privateChannel?.inspect(value, statement.expiry);
      if (!stopped && opened) {
        metric(opened.status, opened.status === 'accepted' ? { kind: opened.event.kind, ageMs: opened.ageMs } : {});
        if (opened.status !== 'invalid')
          celerityCapture.frame(client.encode(value), {
            kind: opened.status === 'accepted' ? opened.event.kind : opened.kind,
            stage: opened.status,
            stream: `${value[1]}/${value[2]}/${value[3]}`,
            seq: value[4],
            ttlMs: PRIVATE_TTL_MS,
            outOfOrder: opened.status === 'accepted' && opened.outOfOrder
          });
      }
    } finally {
      receiving--;
    }
  }

  async function publishEvent(event: PrivateRoomEvent) {
    if (stopped || mode !== 'dual' || !client || !privateChannel) return;
    const started = performance.now();
    try {
      for (const peer of privateChannel.peers()) {
        const envelope = await privateChannel.seal(peer.id, event);
        if (stopped) return;
        if (!envelope) {
          metric('budget', { kind: event.kind });
          continue;
        }
        const encoded = client.encode(envelope);
        const bytes = encoded.length;
        if (
          !reserve.reserve(
            client.channel(envelope[2], envelope[3]),
            bytes,
            envelope[5] + PRIVATE_TTL_MS + 1000,
            Date.now(),
            client.maxAccountBytes,
            client.maxStatementBytes
          )
        ) {
          metric('budget', { kind: event.kind });
          continue;
        }
        const capture = { kind: event.kind, stream: `${envelope[1]}/${envelope[2]}/${envelope[3]}`, seq: envelope[4], ttlMs: PRIVATE_TTL_MS };
        celerityCapture.frame(encoded, { ...capture, stage: 'attempt' });
        const operation = client.publish(envelope).then(
          ok => ({ status: 'settled' as const, ok }),
          () => ({ status: 'rejected' as const })
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        const outcome = await Promise.race([
          operation,
          new Promise<{ status: 'timeout' }>(resolve => {
            timer = setTimeout(() => resolve({ status: 'timeout' }), publishTimeoutMs);
          })
        ]);
        clearTimeout(timer);
        if (stopped) return;
        if (outcome.status === 'timeout') {
          // The Host may still settle this request. Keep the attempt unknown and
          // never replay it, while leaving the receive subscription available.
          metric('timeout', { kind: event.kind, bytes, durationMs: Math.round(performance.now() - started) });
          return;
        }
        const ok = outcome.status === 'settled' && outcome.ok;
        metric(ok ? 'submitted' : 'rejected', { kind: event.kind, bytes, durationMs: Math.round(performance.now() - started) });
        celerityCapture.frame(encoded, { ...capture, stage: ok ? 'submitted' : 'rejected' });
      }
    } catch {
      if (!stopped) metric('rejected', { kind: event.kind });
    }
  }
  async function drain() {
    if (publishing || stopped || mode !== 'dual' || !client || !privateChannel) return;
    publishing = true;
    try {
      while (!stopped && client && privateChannel && pendingEvents.length > 0) {
        const next = pendingEvents.shift()!;
        if (Date.now() - next.queuedAt >= PRIVATE_TTL_MS) {
          metric('expired', { kind: next.event.kind });
          continue;
        }
        await publishEvent(next.event);
      }
    } finally {
      publishing = false;
    }
  }
  function publish(event: PrivateRoomEvent) {
    if (stopped || mode !== 'dual' || !client || !privateChannel) return;
    if (pendingEvents.length >= MAX_PENDING_EVENTS) {
      metric('capacity', { kind: event.kind });
      return;
    }
    pendingEvents.push({ event, queuedAt: Date.now() });
    void drain();
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
  const startupDeadline = setTimeout(() => stop('timeout'), 8000);
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
          clearTimeout(startupDeadline);
          releaseClock = celerityCapture.setProbe(() => measureRoomClock(port));
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
