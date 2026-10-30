// Local diagnostics only. Keys, source bytes and signer material have no report fields.
export const REPORT_KEY = 'dotify.bulletin.mobile-reports.v1';
export const MAX_REPORTS = 5;
export const MAX_HISTORY_BYTES = 256 * 1024;
const text = (value, max = 400) => (typeof value === 'string' ? value.slice(0, max) : undefined);
const size = value => new TextEncoder().encode(value).byteLength;
const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const scalarFields = {
  id: value => text(value, 80),
  schema: text,
  startedAt: text,
  base: text,
  transport: text,
  environment: text,
  network: text,
  userAgent: value => text(value, 600),
  reader: text,
  hostCache: text,
  pageCache: text,
  recoveredAfterReload: value => value === true,
  lastObservedOutcome: text,
  outcome: text,
  root: text,
  error: text,
  errorName: text,
  lookupTimeoutMs: number,
  firstPlayingEventMs: number,
  progressive: value => (typeof value === 'boolean' ? value : undefined),
  insideHost: value => (typeof value === 'boolean' ? value : undefined),
  operatorHeardAudio: value => value === true,
  audibleFirstSoundMeasured: () => false,
  productionAccessTested: () => false
};
const project = (input, fields) =>
  Object.fromEntries(
    Object.entries(fields).flatMap(([key, convert]) => {
      const value = convert(input?.[key]);
      return value === undefined ? [] : [[key, value]];
    })
  );
export function safeReport(input) {
  if (!input || input.schema !== 'dotify.bulletin.host-report.v1' || !text(input.id, 80)) throw new Error('Invalid diagnostic report');
  const report = project(input, scalarFields);
  report.implementation = project(input.implementation, { sha: value => text(value, 64), dirty: value => value === true });
  report.events = (Array.isArray(input.events) ? input.events : [])
    .slice(-200)
    .map(event => project(event, { name: value => text(value, 40), at: value => text(value, 40), elapsedMs: number, mediaSeconds: number }));
  report.reads = (Array.isArray(input.reads) ? input.reads : [])
    .slice(-100)
    .map(read => project(read, { cid: value => text(value, 128), bytes: number, elapsedMs: number }));
  // Metrics remain on the current screen; stored/exported evidence has an explicit, smaller schema.
  return report;
}
export function reportJournal(storage, onUnavailable = () => {}) {
  let reports = [];
  try {
    const saved = storage.getItem(REPORT_KEY);
    if (saved && size(saved) > MAX_HISTORY_BYTES) throw new Error('Report history exceeds its bound');
    reports = (saved ? JSON.parse(saved) : [])
      .slice(-MAX_REPORTS)
      .map(safeReport)
      .map(report =>
        ['preparing', 'playing'].includes(report.outcome)
          ? { ...report, lastObservedOutcome: report.outcome, outcome: 'interrupted', recoveredAfterReload: true }
          : report
      );
  } catch {
    onUnavailable();
  }
  return {
    list: () => structuredClone(reports),
    save(input) {
      const report = safeReport(input);
      reports = [...reports.filter(item => item.id !== report.id), report].slice(-MAX_REPORTS);
      while (reports.length > 1 && size(JSON.stringify(reports)) > MAX_HISTORY_BYTES) reports.shift();
      try {
        storage.setItem(REPORT_KEY, JSON.stringify(reports));
      } catch {
        onUnavailable();
      } // A blocked/quota-full store cannot interrupt playback.
      return structuredClone(report);
    },
    clear() {
      reports = [];
      try {
        storage.removeItem(REPORT_KEY);
      } catch {
        onUnavailable();
      }
    }
  };
}
