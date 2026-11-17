// Read-only assessment of declared dependencies. No signer, admission changes or
// renewal writes. Finalized storage metadata is not a byte-read or backup proof.
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { z } from 'zod';
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const decimal = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .max(40);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const identity = z.object({ genesis: hash, account: z.string().min(1).max(128) }).strict();
function validCid(value: string) {
  try {
    const c = CID.parse(value);
    return (
      c.version === 1 &&
      [0x55, 0x70].includes(c.code) &&
      [0x12, 0xb220].includes(c.multihash.code) &&
      c.multihash.digest.length === 32 &&
      c.toString() === value
    );
  } catch {
    return false;
  }
}
const cid = z.string().max(128).refine(validCid, 'Expected canonical raw/DAG-PB SHA-256 or BLAKE2b-256 CID');
const block = z.object({ cid, bytes: integer.min(1).max(1024 * 1024) }).strict();
export const conservationPlanSchema = z
  .object({
    schema: z.literal('dotify.bulletin.conservation-plan.v1'),
    identity,
    // Existing obligations may exceed the declared inventory; never lower this floor.
    retainedReserve: z.object({ transactions: integer, bytes: decimal }).strict(),
    warningBlocks: integer.min(1),
    criticalBlocks: integer.min(1),
    sources: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
            kind: z.enum(['application', 'audio', 'cover', 'metadata', 'diagnostic']),
            root: cid,
            blocks: z.array(block).min(1).max(8192)
          })
          .strict()
      )
      .min(1)
      .max(256)
  })
  .strict()
  .superRefine((plan, ctx) => {
    const problem = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (plan.criticalBlocks > plan.warningBlocks) problem('Critical threshold exceeds warning threshold');
    if (new Set(plan.sources.map(s => s.id)).size !== plan.sources.length) problem('Duplicate source identity');
    if (plan.sources.reduce((n, s) => n + s.blocks.length, 0) > 8192) problem('Dependency inventory exceeds bound');
    for (const source of plan.sources) {
      if (!source.blocks.some(b => b.cid === source.root)) problem('Source root missing from its declared dependencies');
      if (new Set(source.blocks.map(b => b.cid)).size !== source.blocks.length) problem('Duplicate dependency within source');
    }
  });
const observation = z.discriminatedUnion('state', [
  z.object({ state: z.literal('present'), cid, bytes: integer.min(1), block: integer, index: integer, expiresAt: integer }).strict(),
  z.object({ state: z.literal('missing') }).strict(),
  z.object({ state: z.literal('unavailable') }).strict()
]);
export const conservationSnapshotSchema = z
  .object({
    schema: z.literal('dotify.bulletin.conservation-snapshot.v1'),
    identity,
    head: integer,
    blockHash: hash,
    // The reader must pin all counters and observations to this finalized block.
    authorization: z.object({ expiresAt: integer, remainingTransactions: integer, remainingRenewBytes: decimal }).strict().nullable(),
    observations: z.record(cid, observation).refine(values => Object.keys(values).length <= 8192, 'Too many observations')
  })
  .strict();
export type ConservationPlan = z.infer<typeof conservationPlanSchema>;
export type ConservationSnapshot = z.infer<typeof conservationSnapshotSchema>;
type Severity = 'ok' | 'warning' | 'critical';
const rank: Record<Severity, number> = { ok: 0, warning: 1, critical: 2 };

export function assessBulletinConservation(input: unknown, state: unknown) {
  const plan = conservationPlanSchema.parse(input),
    snapshot = conservationSnapshotSchema.parse(state);
  assert.deepEqual(snapshot.identity, plan.identity, 'Conservation snapshot identity differs');
  const tracked = new Map<string, { bytes: number; sources: string[] }>();
  for (const source of plan.sources)
    for (const b of source.blocks) {
      const old = tracked.get(b.cid);
      assert.ok(!old || old.bytes === b.bytes, 'Shared dependency byte counts differ');
      if (old) old.sources.push(source.id);
      else tracked.set(b.cid, { bytes: b.bytes, sources: [source.id] });
    }
  const lifetime = (expiry: number): Severity =>
    expiry <= snapshot.head + plan.criticalBlocks ? 'critical' : expiry <= snapshot.head + plan.warningBlocks ? 'warning' : 'ok';
  const blocks = [...tracked].map(([key, b]) => {
    const found = snapshot.observations[key];
    if (!found || found.state === 'unavailable') return { cid: key, ...b, state: 'unknown' as const, severity: 'critical' as Severity, expiresAt: null };
    if (found.state === 'missing') return { cid: key, ...b, state: 'missing' as const, severity: 'critical' as Severity, expiresAt: null };
    if (found.cid !== key || found.bytes !== b.bytes || found.block > snapshot.head || found.expiresAt <= found.block)
      return { cid: key, ...b, state: 'invalid' as const, severity: 'critical' as Severity, expiresAt: null };
    return {
      cid: key,
      ...b,
      state: found.expiresAt <= snapshot.head ? ('expired' as const) : ('retained' as const),
      severity: lifetime(found.expiresAt),
      expiresAt: found.expiresAt
    };
  });
  const trackedBytes = blocks.reduce((n, b) => n + BigInt(b.bytes), 0n);
  const reserveBytes = BigInt(plan.retainedReserve.bytes) > trackedBytes ? BigInt(plan.retainedReserve.bytes) : trackedBytes;
  const reserveTransactions = Math.max(plan.retainedReserve.transactions, tracked.size);
  const auth = snapshot.authorization;
  const accountSeverity: Severity = auth ? lifetime(auth.expiresAt) : 'critical';
  const quotaSufficient = Boolean(auth && auth.remainingTransactions >= reserveTransactions && BigInt(auth.remainingRenewBytes) >= reserveBytes);
  const severity = blocks.reduce<Severity>(
    (worst, b) => (rank[b.severity] > rank[worst] ? b.severity : worst),
    !quotaSufficient || accountSeverity === 'critical' ? 'critical' : accountSeverity
  );
  const expiries = blocks.flatMap(b => (b.expiresAt === null ? [] : [b.expiresAt]));
  return {
    schema: 'dotify.bulletin.conservation-report.v1' as const,
    identity: plan.identity,
    head: snapshot.head,
    blockHash: snapshot.blockHash,
    severity,
    scope: 'declared-dependencies' as const,
    verification: 'finalized-storage-metadata' as const,
    bytesRetrievabilityTested: false,
    backupRestoreTested: false,
    writes: 0,
    sourceCount: plan.sources.length,
    uniqueBlocks: blocks.length,
    earliestBlockExpiry: expiries.length ? Math.min(...expiries) : null,
    accountExpiry: auth?.expiresAt ?? null,
    accountSeverity,
    authorization: auth,
    quotaSufficient,
    requiredRenewalReserve: { transactions: reserveTransactions, bytes: reserveBytes.toString() },
    blocks
  };
}
