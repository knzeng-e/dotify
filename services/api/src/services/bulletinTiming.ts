// Ephemeral, fixed-cardinality publisher diagnostics. Never custody state.
import type { BulletinMediaTransport } from './bulletinMedia.js';
export type PublicationPhase = 'queue' | 'prepare' | 'status' | 'nextNonce' | 'lookup' | 'readBlock' | 'lookupSubmission' | 'store' | 'submitAndFinalize';
export type PublicationMilestone = 'created' | 'broadcasted' | 'firstInclusion';
type MilestoneTiming = { observations: number; totalMs: number; maxMs: number };
type PhaseTiming = { calls: number; failures: number; totalMs: number; maxMs: number; peakConcurrency: number; inFlightAtReport: number };
export type PublicationTimingReport = {
  schema: 'dotify.bulletin.publication-timing.v1';
  scope: 'publisher-attempt';
  outcome: 'succeeded' | 'failed';
  elapsedMs: number;
  phases: Partial<Record<PublicationPhase, PhaseTiming>>;
  milestones: Partial<Record<PublicationMilestone, MilestoneTiming>>;
};
export function createPublicationTimings(now: () => number = () => performance.now()) {
  const began = now();
  const milestones: Partial<Record<PublicationMilestone, MilestoneTiming>> = {};
  const phases: Partial<Record<PublicationPhase, Omit<PhaseTiming, 'inFlightAtReport'> & { active: number }>> = {};
  const elapsed = (start: number) => Math.max(0, Math.round(now() - start));
  const start = (phase: PublicationPhase) => {
    const began = now();
    const state = (phases[phase] ??= { calls: 0, failures: 0, totalMs: 0, maxMs: 0, peakConcurrency: 0, active: 0 });
    state.calls++;
    state.peakConcurrency = Math.max(state.peakConcurrency, ++state.active);
    let ended = false;
    return (succeeded = true) => {
      if (ended) return;
      ended = true;
      const ms = elapsed(began);
      state.active--;
      state.failures += succeeded ? 0 : 1;
      state.totalMs += ms;
      state.maxMs = Math.max(state.maxMs, ms);
    };
  };
  return {
    start,
    transaction() {
      const began = now(),
        seen = new Set<PublicationMilestone>();
      return (milestone: PublicationMilestone) => {
        if (seen.has(milestone)) return;
        seen.add(milestone);
        const ms = elapsed(began);
        const state = (milestones[milestone] ??= { observations: 0, totalMs: 0, maxMs: 0 });
        state.observations++;
        state.totalMs += ms;
        state.maxMs = Math.max(state.maxMs, ms);
      };
    },
    async measure<T>(phase: PublicationPhase, run: () => Promise<T>): Promise<T> {
      const finish = start(phase);
      try {
        const result = await run();
        finish();
        return result;
      } catch (error) {
        finish(false);
        throw error;
      }
    },
    snapshot(outcome: PublicationTimingReport['outcome']): PublicationTimingReport {
      return {
        schema: 'dotify.bulletin.publication-timing.v1',
        scope: 'publisher-attempt',
        outcome,
        elapsedMs: elapsed(began),
        // Copy only fixed keys/counters: no RPC arguments, identifiers or errors.
        phases: Object.fromEntries(Object.entries(phases).map(([phase, { active, ...timing }]) => [phase, { ...timing, inFlightAtReport: active }])),
        milestones: Object.fromEntries(Object.entries(milestones).map(([stage, timing]) => [stage, { ...timing }]))
      };
    }
  };
}
export type PublicationTimings = ReturnType<typeof createPublicationTimings>;
/** Preserve arguments, results, cancellation and unknown-outcome errors exactly. */
export function timedBulletinTransport(transport: BulletinMediaTransport, timings: PublicationTimings): BulletinMediaTransport {
  return {
    ...transport,
    status: signal => timings.measure('status', () => transport.status(signal)),
    nextNonce: signal => timings.measure('nextNonce', () => transport.nextNonce(signal)),
    lookup: (cid, signal) => timings.measure('lookup', () => transport.lookup(cid, signal)),
    readBlock: (cid, signal) => timings.measure('readBlock', () => transport.readBlock(cid, signal)),
    lookupSubmission: (query, signal) => timings.measure('lookupSubmission', () => transport.lookupSubmission(query, signal)),
    store: (block, intent, signal) => timings.measure('store', () => transport.store(block, intent, signal))
  };
}
