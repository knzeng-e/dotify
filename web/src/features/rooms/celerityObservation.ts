import { CELERITY_TTL_MS, celerityBudget, createCelerityBudget, createPresenceReceiver, parsePresenceEnvelope, presenceEnvelope } from './celerityEnvelope';
import { createCelerityClient, type CelerityClient, type ObservationStatement } from './celeritySdk';
import { recordCelerityMetric, type CelerityMetric } from './celerityDiagnostics';

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
  let deadline: ReturnType<typeof setTimeout> | undefined;
  // Only startup replay may be queued; bound it before a client is available for channel checks.
  let initial: ObservationStatement[] = [];
  const metric = (event: CelerityMetric['event'], extra: Omit<CelerityMetric, 'event' | 'at'> = {}) => report({ at: now(), event, ...extra });
  function stop(reason: CelerityMetric['event'] = 'stopped') {
    if (stopped) return;
    stopped = true;
    clearTimeout(refresh);
    clearTimeout(deadline);
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
      if (!reserve.reserve(client.channel(event.room, producer), bytes, event.expires, created, client.maxAccountBytes, client.maxStatementBytes)) {
        metric('budget');
      } else {
        deadline = setTimeout(() => stop('timeout'), TIMEOUT_MS);
        const started = performance.now();
        const ok = await client.publish(event);
        if (stopped) return;
        clearTimeout(deadline);
        metric(ok ? 'submitted' : 'rejected', { bytes, durationMs: Math.round(performance.now() - started) });
      }
    } catch {
      if (!stopped) {
        clearTimeout(deadline);
        metric('rejected');
      }
    }
    if (!stopped)
      refresh = setTimeout(() => {
        void publish();
      }, INTERVAL_MS);
  }
  metric('starting');
  deadline = setTimeout(() => stop('timeout'), TIMEOUT_MS);
  void (deps.createClient ?? createCelerityClient)(options.room, receive, () => stop('interrupted'))
    .then(connected => {
      if (stopped) {
        connected?.stop();
        return;
      }
      clearTimeout(deadline);
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
