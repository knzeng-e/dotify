import { CELERITY_TTL_MS, celerityBudget, createCelerityBudget, createPresenceReceiver, parsePresenceEnvelope, presenceEnvelope } from './celerityEnvelope';
import { createCelerityClient, type CelerityClient, type ObservationStatement } from './celeritySdk';
import { recordCelerityMetric, type CelerityMetric } from './celerityDiagnostics';
import { celerityCapture } from './celerityCapture';

export type CelerityMode = 'off' | 'observe' | 'dual';
export function celerityMode(value: unknown): CelerityMode {
  return value === 'observe' || value === 'dual' ? value : 'off';
}

const INTERVAL_MS = 10_000;
const TIMEOUT_MS = 8_000;

type ObservationOptions = {
  room: string;
  mode: CelerityMode;
  isHosting: boolean;
  listeners: () => number;
};
type ObservationDeps = {
  createClient?: typeof createCelerityClient;
  now?: () => number;
  producer?: () => string;
  report?: (metric: CelerityMetric) => void;
  budget?: ReturnType<typeof createCelerityBudget>;
};

/** Independent lifetime: no socket, room setters, media or key services are reachable here. */
export function startCelerityObservation(options: ObservationOptions, deps: ObservationDeps = {}): () => void {
  if (options.mode === 'off' || !/^[A-Z0-9]{4,12}$/.test(options.room)) return () => undefined;
  const now = deps.now ?? Date.now;
  const report = deps.report ?? recordCelerityMetric;
  const reserve = deps.budget ?? celerityBudget;
  const producer = (deps.producer ?? (() => crypto.randomUUID().replace(/-/g, '')))();
  const accept = createPresenceReceiver();
  let stopped = false;
  let client: CelerityClient | null = null;
  let seq = 0;
  let refresh: ReturnType<typeof setTimeout> | undefined;
  // Only startup replay may be queued; bound it before a client is available for channel checks.
  let initial: ObservationStatement[] = [];
  const metric = (event: CelerityMetric['event'], extra: Omit<CelerityMetric, 'event' | 'at'> = {}) => report({ at: now(), event, ...extra });
  function stop(reason: CelerityMetric['event'] = 'stopped') {
    if (stopped) return;
    stopped = true;
    clearTimeout(refresh);
    clearTimeout(startupDeadline);
    initial = [];
    client?.stop();
    metric(reason);
  }
  function receive(statement: ObservationStatement) {
    if (stopped) return;
    if (!client) {
      if (initial.length < 128) initial.push(statement);
      return;
    }
    const event = parsePresenceEnvelope(statement.data, options.room, now(), statement.expiry);
    if (!event || statement.channel !== client.channel(event.room, event.producer)) {
      metric('invalid');
      return;
    }
    if (seq > 0 && event.producer === producer) {
      metric('self-echo');
      return;
    }
    const observation = accept(event, now());
    if (observation.status !== 'capacity')
      celerityCapture.frame(client.encode(event), {
        kind: 'presence',
        stage: observation.status,
        stream: `${event.room}/${event.producer}`,
        seq: event.seq,
        ttlMs: CELERITY_TTL_MS
      });
    if (observation.status === 'accepted') metric('accepted', { gap: observation.gap, ageMs: observation.ageMs });
    else metric(observation.status);
  }
  async function publish() {
    if (stopped || !client || options.mode !== 'dual' || !options.isHosting) return;
    const created = now();
    const event = presenceEnvelope(options.room, producer, ++seq, options.listeners(), created);
    try {
      // Validate locally too: never serialize caller-provided private fields.
      if (!parsePresenceEnvelope(event, options.room, created, BigInt(Math.floor(event.expires / 1000)) << 32n)) {
        metric('invalid');
        return;
      }
      const bytes = client.encode(event).length;
      if (!reserve.reserve(client.channel(event.room, producer), bytes, event.expires + 1000, created, client.maxAccountBytes, client.maxStatementBytes)) {
        metric('budget');
      } else {
        const started = performance.now();
        const capture = { kind: 'presence' as const, stream: `${event.room}/${event.producer}`, seq: event.seq, ttlMs: CELERITY_TTL_MS };
        const encoded = client.encode(event);
        celerityCapture.frame(encoded, { ...capture, stage: 'attempt' });
        const operation = client.publish(event).then(
          ok => ({ status: 'settled' as const, ok }),
          () => ({ status: 'rejected' as const })
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        const outcome = await Promise.race([
          operation,
          new Promise<{ status: 'timeout' }>(resolve => {
            timer = setTimeout(() => resolve({ status: 'timeout' }), TIMEOUT_MS);
          })
        ]);
        clearTimeout(timer);
        if (stopped) return;
        if (outcome.status === 'timeout') {
          // A late Host response is ambiguous. Never replay or relabel it, but
          // keep observation alive so the next periodic snapshot can proceed.
          metric('timeout', { bytes, durationMs: Math.round(performance.now() - started) });
        } else {
          const ok = outcome.status === 'settled' && outcome.ok;
          metric(ok ? 'submitted' : 'rejected', { bytes, durationMs: Math.round(performance.now() - started) });
          celerityCapture.frame(encoded, { ...capture, stage: ok ? 'submitted' : 'rejected' });
        }
      }
    } catch {
      if (!stopped) metric('rejected');
    }
    if (!stopped)
      refresh = setTimeout(() => {
        void publish();
      }, INTERVAL_MS);
  }
  metric('starting');
  const startupDeadline = setTimeout(() => stop('timeout'), TIMEOUT_MS);
  void (deps.createClient ?? createCelerityClient)(options.room, receive, () => stop('interrupted'))
    .then(connected => {
      if (stopped) {
        connected?.stop();
        return;
      }
      clearTimeout(startupDeadline);
      client = connected;
      if (!client) {
        stop('unsupported');
        return;
      }
      metric('ready');
      const replay = initial;
      initial = [];
      replay.forEach(receive);
      void publish();
    })
    .catch(() => stop('unavailable'));
  return () => stop();
}

export { CELERITY_TTL_MS };
