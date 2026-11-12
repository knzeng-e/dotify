// Generated-only compatibility exercise. Executables are injected by the pinned
// contributor script, never selected through a production setting or request.
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { CID } from 'multiformats/cid';
import { owner, tree } from './bulletinPreparedRecovery.fixture.js';
import {
  readRestoreBundle,
  materializeRestoreSnapshot,
  restoreFixtureVault,
  restoreFixtureReaders,
  verifyRestoredAudio
} from './bulletinRestoreRehearsal.fixture.js';
import type { recoverPreparedBulletinJob } from './bulletinPreparedRecovery.js';
import type { StreamingJobs } from './streamingJobs.js';

export type CompiledRecoveryRuntime = {
  revision: string;
  recover: typeof recoverPreparedBulletinJob;
  Queue: typeof StreamingJobs;
  readers: typeof restoreFixtureReaders;
};
type PilotRuntime = Pick<CompiledRecoveryRuntime, 'revision' | 'recover'> & {
  parseReference: typeof restoreFixtureReaders.parseStreamingReference;
};

export async function rehearseCompiledRollback(
  file: string,
  digest: string,
  candidate: CompiledRecoveryRuntime,
  compatible: CompiledRecoveryRuntime,
  pilot: PilotRuntime
) {
  const bundle = await readRestoreBundle(file, digest);
  const results = [];
  for (const snapshot of bundle.snapshots) {
    const c = await materializeRestoreSnapshot(snapshot);
    try {
      const before = await tree(c.root);
      // The actual deployed pilot-era command is not an admitted-release tool.
      // Assert its precise refusal, not just any error during module loading.
      await assert.rejects(pilot.recover(c.options, c.deps), /Prepared recovery requires an immutable one-release pilot scope/);
      assert.deepEqual(await tree(c.root), before);
      assert.equal(c.wire.signerLoads, 0);
      assert.deepEqual(c.wire.writes, []);

      const oldPlan = await compatible.recover(c.options, c.deps);
      const newPlan = await candidate.recover(c.options, c.deps);
      assert.equal(oldPlan.planSha256, newPlan.planSha256);
      assert.equal(newPlan.plan.root, snapshot.graphRoot);
      assert.deepEqual(await tree(c.root), before);

      // Candidate code advances the real file journals, then loses a newly
      // broadcast acknowledgement. Never rewind that state for the old code.
      c.wire.loseAck = true;
      const originalStores = c.wire.stored.size;
      await assert.rejects(candidate.recover({ ...c.options, executePlan: newPlan.planSha256 }, c.deps));
      assert.ok(c.wire.stored.size > originalStores);
      assert.equal(c.wire.signerLoads, c.wire.closed);
      c.wire.loseAck = false;

      const advanced = await tree(c.root);
      const loads = c.wire.signerLoads;
      await assert.rejects(compatible.recover({ ...c.options, executePlan: oldPlan.planSha256 }, c.deps), /Recovery plan changed; inspect again/);
      assert.deepEqual(await tree(c.root), advanced);
      assert.equal(c.wire.signerLoads, loads, 'A stale plan must refuse before loading the synthetic signer');

      // Reinspect with the historical executable against the newest journals.
      const rollbackPlan = await compatible.recover(c.options, c.deps);
      assert.notEqual(rollbackPlan.planSha256, oldPlan.planSha256);
      const recovered = await compatible.recover({ ...c.options, executePlan: rollbackPlan.planSha256 }, c.deps);
      assert.equal(recovered.mode, 'execute');
      assert.ok(recovered.ref);
      const ref = recovered.ref;
      const expected = snapshot.mode === 'compact' ? 'rendition-pack-v1' : 'unixfs-files-v1';
      assert.equal(compatible.readers.parseStreamingReference(ref, value => CID.parse(value))?.layout, expected);
      assert.equal(await verifyRestoredAudio(c, ref, compatible.readers), 12);
      assert.equal(await verifyRestoredAudio(c, ref, candidate.readers), 12);
      const ready = await tree(c.root);
      for (const [path, value] of Object.entries(snapshot.files))
        if (/^queue\/(nonces|jobs)\//.test(path) || /admission/.test(path))
          assert.equal(ready[path], value, 'Executable switching must retain ciphertext, nonce reservations and admission lineage');
      assert.equal(c.wire.stored.size, snapshot.chain.stored.length + c.wire.writes.length, 'No duplicate broadcast');
      assert.equal(c.wire.signerLoads, c.wire.closed);
      if (snapshot.mode === 'compact')
        assert.equal(
          pilot.parseReference(ref, value => CID.parse(value)),
          null,
          'Pilot-era readers cannot read compact refs'
        );

      // Both emitted queue implementations consume the same committed result.
      // These dependencies make any unexpected preparation/publication fatal.
      const stores = c.wire.writes.length;
      for (const runtime of [compatible, candidate]) {
        const queue = new runtime.Queue({
          directory: c.queue,
          deriveKey: () => {
            throw new Error('No key derivation during ready restart');
          },
          authority: async () => {
            throw new Error('No access recheck during ready lookup');
          },
          transcode: async () => {
            throw new Error('No encoding during ready restart');
          },
          pin: async () => {
            throw new Error('No publication during ready restart');
          }
        });
        await queue.start(false);
        try {
          const job = queue.get(snapshot.jobId, owner, restoreFixtureVault.chainId);
          assert.equal(job?.state, 'ready');
          assert.equal(job?.attempts, 3);
          assert.equal(job?.result?.ref, ref);
        } finally {
          await queue.stop();
        }
      }
      assert.equal(c.wire.writes.length, stores);
      const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
      assert.equal(index.jobs.find((job: { id: string }) => job.id === snapshot.jobId).ref, ref);
      results.push({
        mode: snapshot.mode,
        pilotRecovery: 'refused-before-signer',
        stalePlan: 'refused-before-signer',
        rollback: 'reconciled-without-duplicate-stores',
        playbackObjectsAuthenticatedPerExecutable: 12,
        compatibleReadyRestart: true,
        candidateReadyRestart: true,
        attempts: 3
      });
    } finally {
      await rm(c.root, { recursive: true });
    }
  }
  return {
    schema: 'dotify.generated-bulletin-binary-compatibility.v1',
    syntheticOnly: true,
    revisions: { candidate: candidate.revision, compatible: compatible.revision, unsupportedPilot: pilot.revision },
    cases: results,
    compiledModulesTested: true,
    serviceEntrypointTested: false,
    productionTouched: false
  };
}
