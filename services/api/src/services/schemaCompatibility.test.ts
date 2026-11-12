import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { z } from 'zod';
import { publisherProfileSchema } from './bulletinPublisherProfile.js';
import { ownerSchema, jobSchema } from './bulletinMediaState.js';
import { releaseAdmissionLedgerSchema } from './bulletinReleaseAdmission.js';
import { streamingJobsSchema } from './streamingJobState.js';

// Captured with the real Zod 3 schemas at the pinned pre-upgrade revision.
// These are generated fixtures, never an export of operator or artist state.
const historical = JSON.parse(await readFile(new URL('./fixtures/zod3-durable-state.json', import.meta.url), 'utf8')) as {
  sourceCommit: string;
  validator: string;
  syntheticOnly: boolean;
  cases: Array<{ name: string; schema: keyof typeof schemas; input: Record<string, unknown>; canonicalSha256: string }>;
};
const schemas = {
  profile: publisherProfileSchema,
  owner: ownerSchema,
  inventory: jobSchema,
  admission: releaseAdmissionLedgerSchema,
  queue: streamingJobsSchema
};
assert.equal(historical.sourceCommit, '1a6b22d49679a4af4c9156f3229e69c754fcd0be');
assert.equal(historical.validator, '3.25.76');
assert.equal(historical.syntheticOnly, true);
assert.equal(historical.cases.length, 42);

for (const entry of historical.cases) {
  test(`Zod 3 canonical bytes remain identical: ${entry.name}`, () => {
    const before = JSON.stringify(entry.input);
    const parsed = schemas[entry.schema].parse(entry.input);
    assert.equal(createHash('sha256').update(JSON.stringify(parsed)).digest('hex'), entry.canonicalSha256);
    assert.equal(JSON.stringify(entry.input), before, 'Validation must not mutate the original state');
  });
  test(`unknown durable fields fail closed: ${entry.name}`, () => {
    assert.equal(schemas[entry.schema].safeParse({ ...entry.input, unreviewedUpgrade: true }).success, false);
  });
}

test('patched validator refuses an oversized array before validating its elements', () => {
  let visited = 0;
  const schema = z
    .array(
      z.string().superRefine(() => {
        visited++;
      })
    )
    .max(1);
  const result = schema.safeParse(Array(10_000).fill('generated'));
  assert.equal(result.success, false);
  assert.equal(visited, 0, 'Do not reintroduce vulnerable per-element work via zod/v3');
  assert.equal(result.error?.issues.length, 1);
});

test('queue refuses malformed UUIDs, unsafe timestamps and unknown nested scope fields', () => {
  const sample = historical.cases.find(entry => entry.name === 'standard/ready/queue')!;
  for (const alter of [
    (job: Record<string, unknown>) => {
      job.id = '00000000-0000-4000-0000-000000000000';
    },
    (job: Record<string, unknown>) => {
      job.createdAt = Number.MAX_SAFE_INTEGER + 1;
    },
    (job: Record<string, unknown>) => {
      job.scope = { ...(job.scope as object), overrideAccess: true };
    }
  ]) {
    const input = structuredClone(sample.input) as { jobs: Array<Record<string, unknown>> };
    alter(input.jobs[0]);
    assert.equal(streamingJobsSchema.safeParse(input).success, false);
  }
});
