// Fixed research limits. A fixture's metadata never opts a caller into a larger budget.
const profiles = Object.freeze({
  short: Object.freeze({
    id: 'short',
    kind: 'generated-chord-aac-v1',
    durationSeconds: 8,
    budget: Object.freeze({ maxBytes: 1024 * 1024, maxTransactions: 40 }),
    graphMaxBytes: 4 * 1024 * 1024,
    maxFiles: 32,
    archiveReadBytes: 1024 * 1024,
    attemptLimitMs: 60_000,
    firstPlayingLimitMs: 45_000,
    diagnosticVersion: '0.1.0'
  }),
  continuity: Object.freeze({
    id: 'continuity',
    kind: 'generated-continuity-aac-v1',
    durationSeconds: 64,
    budget: Object.freeze({ maxBytes: 8 * 1024 * 1024, maxTransactions: 160 }),
    graphMaxBytes: 8 * 1024 * 1024,
    maxFiles: 64,
    archiveReadBytes: 3 * 1024 * 1024,
    attemptLimitMs: 180_000,
    firstPlayingLimitMs: 45_000,
    diagnosticVersion: '0.3.1'
  })
});
export function fixtureProfile(id = 'short') {
  if (typeof id !== 'string' || !Object.hasOwn(profiles, id)) throw new Error('Unknown fixture profile; choose short or continuity explicitly');
  return profiles[id];
}
