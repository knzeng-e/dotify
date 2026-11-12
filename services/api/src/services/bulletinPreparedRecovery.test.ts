import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, writeFile, readdir, mkdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { StreamingJobs } from './streamingJobs.js';
import { recoverPreparedBulletinJob } from './bulletinPreparedRecovery.js';
import { admissionArchive, releasePipeline } from './bulletinReleaseAdmission.js';
import { publicationBinding } from './bulletinPublisherProfile.js';
import { formatStreamingReference } from './streamingReference.js';
import { CID } from 'multiformats/cid';
import { load, save } from './bulletinMediaState.js';
import { createStreamingPublicationStore } from './streamingPublicationStore.js';
import sharp from 'sharp';
import { createResponsiveCover } from './coverVariants.js';

import { fixture, tree, owner, signal } from './bulletinPreparedRecovery.fixture.js';

for (const mode of ['pilot', 'standard', 'compact'] as const) {
  it(`${mode}: inspects exact saved ciphertext without a Bulletin session, signer or state changes; recovery preserves attempts and unrelated jobs`, async t => {
    const c = await fixture(t, mode);
    // An unrelated exhausted job remains completely unchanged; no queue startup/prune.
    const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
    const unrelated = { ...index.jobs[0], id: '22222222-2222-4222-8222-222222222222', owner: `0x${'99'.repeat(20)}` };
    index.jobs.push(unrelated);
    await mkdir(join(c.queue, 'jobs', unrelated.id), { mode: 0o700 });
    await writeFile(join(c.queue, 'jobs', unrelated.id, 'source.bin'), await readFile(join(c.queue, 'jobs', c.options.jobId, 'source.bin')), { mode: 0o600 });
    await save(c.queue, 'jobs.json', index);
    const before = await c.snapshot();
    const inspected = await c.inspect();
    assert.equal(inspected.mode, 'inspect');
    assert.equal(inspected.plan.root, c.graph.root);
    assert.equal(inspected.plan.attempts, 3);
    assert.equal(inspected.plan.attemptedStores, 0);
    assert.equal(inspected.plan.schema, mode === 'pilot' ? 'dotify.bulletin.prepared-recovery.v1' : 'dotify.bulletin.prepared-recovery.v2');
    if (inspected.plan.schema === 'dotify.bulletin.prepared-recovery.v2') {
      assert.equal(inspected.plan.audioLayout, mode === 'compact' ? 'rendition-pack-v1' : 'unixfs-files-v1');
      assert.deepEqual(inspected.plan.pipeline, releasePipeline(c.profile.pipeline, await c.admission!.validate(), c.scope));
    }
    assert.equal(c.signerLoads, 0);
    assert.deepEqual(await c.snapshot(), before);
    const completed = await c.execute(inspected.planSha256);
    assert.equal(completed.mode, 'execute');
    assert.equal(c.encodes, 1);
    assert.equal(c.signerLoads, c.closed);
    const after = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
    assert.equal(after.jobs[0].state, 'ready');
    assert.equal(
      after.jobs[0].ref,
      formatStreamingReference(c.graph.root, c.scope.keyVersion, mode === 'compact' ? 'rendition-pack-v1' : 'unixfs-files-v1', value => CID.parse(value))
    );
    if (c.admission) {
      for (const [file, bytes] of Object.entries(before.publisher).filter(([file]) => file.includes('admission') || file === 'publisher.json'))
        assert.equal((await readFile(join(c.profile.directory, file))).toString('hex'), bytes, 'recovery must preserve admission lineage byte for byte');
    }
    assert.equal(after.jobs[0].attempts, 3);
    assert.equal(after.jobs[0].sourceGeneration, index.jobs[0].sourceGeneration);
    assert.deepEqual(after.jobs[1], unrelated);
    assert.deepEqual(await tree(join(c.queue, 'jobs')), before.files);
    assert.deepEqual(await tree(join(c.queue, 'nonces')), before.nonce);
    const audit = JSON.parse(await readFile(join(c.queue, 'recoveries', (await readdir(join(c.queue, 'recoveries')))[0]), 'utf8'));
    assert.equal(audit.state, 'ready');
    assert.equal(audit.schema, mode === 'pilot' ? 'dotify.bulletin.prepared-recovery-attempt.v1' : 'dotify.bulletin.prepared-recovery-attempt.v2');
    assert.deepEqual(audit.previousJob, index.jobs[0]);
    assert.equal(audit.planSha256, inspected.planSha256);
    const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as { ready: boolean; budget: unknown };
    assert.equal(inventory.ready, true);
    assert.deepEqual(inventory.budget, c.profile.budget);
    assert.equal(c.writes.length, c.graph.blocks.length);
    await assert.rejects(c.execute(inspected.planSha256), /exhausted failed/);
    // Unchanged queue code consumes the completed result after a restart. It
    // neither encodes nor republishes, and keeps the additive recovery audit.
    const restarted = new StreamingJobs({
      directory: c.queue,
      deriveKey: () => null,
      authority: async () => {
        throw new Error('ready jobs need no new authority call');
      },
      transcode: async () => {
        throw new Error('must not encode');
      },
      pin: async () => {
        throw new Error('must not republish');
      }
    });
    await restarted.start(false);
    const result = restarted.get(c.options.jobId, owner, 420420417);
    assert.equal(result?.state, 'ready');
    assert.equal(result?.attempts, 3);
    await restarted.stop();
    assert.equal((await readdir(join(c.queue, 'recoveries'))).length, 1);
  });
  it(`${mode}: reconciles lost acknowledgements using exact pending sender/nonces without duplicates or resetting cumulative limits`, async t => {
    const c = await fixture(t, mode);
    const first = await c.inspect();
    c.loseAck = true;
    await assert.rejects(c.execute(first.planSha256));
    const failed = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8')).jobs[0];
    assert.equal(failed.state, 'failed');
    assert.equal(failed.attempts, 3);
    assert.ok(c.writes.length > 0);
    const second = await c.inspect();
    assert.ok(second.plan.pending > 0);
    assert.notEqual(second.planSha256, first.planSha256);
    const loads = c.signerLoads;
    await assert.rejects(c.execute(first.planSha256), /plan changed/);
    assert.equal(c.signerLoads, loads);
    c.hideSubmission = true;
    c.loseAck = false;
    const prior = c.writes.length;
    await assert.rejects(c.execute(second.planSha256), /unresolved/);
    assert.equal(c.writes.length, prior);
    c.hideSubmission = false;
    const third = await c.inspect();
    await c.execute(third.planSha256);
    assert.equal(c.writes.length, c.graph.blocks.length);
    assert.equal(new Set(c.writes).size, c.writes.length);
    const audits = await readdir(join(c.queue, 'recoveries'));
    assert.equal(audits.length, 3);
  });
  it(`${mode}: refuses active custody or crash locks and leaves the lock untouched`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const file = join(c.profile.directory, 'publisher.lock');
    await writeFile(file, 'existing owner', { mode: 0o600 });
    await assert.rejects(c.inspect(), /EEXIST/);
    await assert.rejects(c.execute(inspected.planSha256), /EEXIST/);
    assert.equal(await readFile(file, 'utf8'), 'existing owner');
    assert.equal(c.signerLoads, 0);
  });
  it(`${mode}: refuses missing or changed permanent nonce reservations before loading the signer`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const dir = join(c.queue, 'nonces');
    const keyDir = (await readdir(dir)).find(name => name !== 'ledger.json')!;
    await rm(join(dir, keyDir, (await readdir(join(dir, keyDir)))[0]));
    await assert.rejects(c.execute(inspected.planSha256));
    assert.equal(c.signerLoads, 0);
    assert.equal(c.writes.length, 0);
  });
  it(`${mode}: rejects corrupt and missing output instead of encoding again or changing queue state`, async t => {
    for (const missing of [false, true]) {
      const c = await fixture(t, mode);
      const inspected = await c.inspect();
      const file = join(c.queue, 'jobs', c.options.jobId, 'output', '96', 'segment-000.bin');
      if (missing) await rm(file);
      else {
        const bytes = await readFile(file);
        bytes[0] ^= 1;
        await writeFile(file, bytes);
      }
      const queue = await readFile(join(c.queue, 'jobs.json'));
      await assert.rejects(c.execute(inspected.planSha256));
      assert.equal(c.signerLoads, 0);
      assert.equal(c.encodes, 1);
      assert.deepEqual(await readFile(join(c.queue, 'jobs.json')), queue);
    }
  });
  it(`${mode}: rejects wrong owner, scope, missing inventory and changed immutable budget before signer load`, async t => {
    for (const change of ['owner', 'scope', 'inventory', 'budget']) {
      const c = await fixture(t, mode);
      const inspected = await c.inspect();
      if (change === 'owner') {
        await assert.rejects(recoverPreparedBulletinJob({ ...c.options, owner: `0x${'99'.repeat(20)}`, executePlan: inspected.planSha256 }, c.deps));
      } else {
        if (change === 'inventory') await rm(join(c.profile.directory, `${c.name}.json`));
        else if (change === 'budget') {
          const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as Record<string, unknown>;
          inventory.budget = { ...c.profile.budget, maxTransactions: 17 };
          await save(c.profile.directory, `${c.name}.json`, inventory);
        } else {
          const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
          queue.jobs[0].scope.runtimeAddress = `0x${'99'.repeat(20)}`;
          await save(c.queue, 'jobs.json', queue);
        }
        await assert.rejects(c.execute(inspected.planSha256));
      }
      assert.equal(c.signerLoads, 0);
      assert.equal(c.writes.length, 0);
    }
  });
  it(`${mode}: refuses lost authority, stale plans and symlinked prepared directories`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    c.authority = false;
    await assert.rejects(c.execute(inspected.planSha256), /authority/);
    c.authority = true;
    const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
    index.jobs[0].updatedAt++;
    await save(c.queue, 'jobs.json', index);
    await assert.rejects(c.execute(inspected.planSha256), /plan changed/);
    assert.equal(c.signerLoads, 0);
    const output = join(c.queue, 'jobs', c.options.jobId, 'output', '96');
    await rm(output, { recursive: true });
    await mkdir(join(c.root, 'elsewhere'), { mode: 0o700 });
    await symlink(join(c.root, 'elsewhere'), output);
    await assert.rejects(c.inspect(), /owned private directory/);
  });
  it(`${mode}: refuses an aborted operation without signer use or queue changes`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const before = await c.snapshot();
    await assert.rejects(recoverPreparedBulletinJob({ ...c.options, executePlan: inspected.planSha256, signal: AbortSignal.abort() }, c.deps));
    assert.equal(c.signerLoads, 0);
    assert.deepEqual(await c.snapshot(), before);
  });
  it(`${mode}: does not publish a ready result when queue persistence races; a new inspected plan reuses all confirmed blocks`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const store = c.transport.store;
    let changed = false;
    c.transport.store = async (...args) => {
      const result = await store(...args);
      if (!changed) {
        changed = true;
        const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
        index.jobs[0].updatedAt++;
        await save(c.queue, 'jobs.json', index);
      }
      return result;
    };
    await assert.rejects(c.execute(inspected.planSha256), /Queue changed/);
    const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
    assert.equal(queue.jobs[0].state, 'failed');
    assert.equal(queue.jobs[0].attempts, 3);
    assert.equal(c.writes.length, c.graph.blocks.length);
    const after = await c.inspect();
    assert.equal(after.plan.receipts, c.graph.blocks.length);
    await c.execute(after.planSha256);
    assert.equal(c.writes.length, c.graph.blocks.length);
  });
  it(`${mode}: preserves interrupted pending submissions and resumes them without sending the same block again`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const abort = new AbortController();
    const store = c.transport.store;
    c.transport.store = async (...args) => {
      const result = await store(...args);
      abort.abort();
      return result;
    };
    await assert.rejects(recoverPreparedBulletinJob({ ...c.options, executePlan: inspected.planSha256, signal: abort.signal }, c.deps));
    const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
    assert.equal(queue.jobs[0].state, 'failed');
    assert.equal(queue.jobs[0].attempts, 3);
    c.transport.store = store;
    const next = await c.inspect();
    await c.execute(next.planSha256);
    assert.equal(c.writes.length, c.graph.blocks.length);
  });
  it(`${mode}: refuses an orphaned writer lock without removing it or loading the signer`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const file = join(c.profile.directory, 'writer.lock');
    await writeFile(file, 'unresolved writer', { mode: 0o600 });
    await assert.rejects(c.inspect(), /writer lock/);
    await assert.rejects(c.execute(inspected.planSha256), /writer lock/);
    assert.equal(await readFile(file, 'utf8'), 'unresolved writer');
    assert.equal(c.signerLoads, 0);
  });
  it(`${mode}: does not write through an unsafe recovery audit directory`, async t => {
    const c = await fixture(t, mode);
    const inspected = await c.inspect();
    const outside = join(c.root, 'outside');
    await mkdir(outside, { mode: 0o700 });
    await symlink(outside, join(c.queue, 'recoveries'));
    await assert.rejects(c.execute(inspected.planSha256), /owned private directory/);
    assert.deepEqual(await readdir(outside), []);
    assert.equal(c.writes.length, 0);
  });
  it(`${mode}: keeps cumulative store limits exhausted instead of replenishing them during recovery`, async t => {
    const c = await fixture(t, mode);
    const file = `${c.name}.json`;
    const inventory = (await load(join(c.profile.directory, file))) as Record<string, unknown>;
    inventory.attemptedStores = c.profile.budget.maxTransactions;
    await save(c.profile.directory, file, inventory);
    const inspected = await c.inspect();
    await assert.rejects(c.execute(inspected.planSha256));
    assert.equal(c.writes.length, 0);
    const after = (await load(join(c.profile.directory, file))) as typeof inventory;
    assert.equal(after.attemptedStores, c.profile.budget.maxTransactions);
    assert.deepEqual(after.budget, c.profile.budget);
  });
}

for (const mode of ['standard', 'compact'] as const) {
  it(`${mode}: refuses missing claims, changed bindings, layout and pipeline before signer use`, async t => {
    for (const change of ['claim', 'queue-binding', 'publisher-binding', 'layout', 'pipeline', 'vault']) {
      const c = await fixture(t, mode);
      const inspected = await c.inspect();
      if (change === 'claim') {
        const state = await c.admission!.validate();
        delete state.releases[0].audio;
        await save(c.profile.directory, 'release-admission.json', state);
      } else if (change.endsWith('binding')) {
        await save(change === 'queue-binding' ? c.queue : c.profile.directory, change === 'queue-binding' ? 'publication-store.json' : 'publisher.json', {
          ...publicationBinding(c.profile),
          profileSha256: '00'.repeat(32)
        });
      } else if (change === 'vault') {
        c.deps.contentKeyVault = { ...c.vault!, contentKeyMasterSecrets: JSON.stringify({ [c.scope.keyVersion]: '44'.repeat(32) }) };
      } else {
        const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as Record<string, unknown>;
        if (change === 'layout') {
          inventory.schema = mode === 'compact' ? 'dotify.bulletin.media-job.v2' : 'dotify.bulletin.media-job.v3';
          if (mode === 'compact') delete inventory.layout;
          else inventory.layout = 'rendition-pack-v1';
        } else inventory.pipeline = { ...c.profile.pipeline, concurrency: 1 };
        await save(c.profile.directory, `${c.name}.json`, inventory);
      }
      const before = await c.snapshot();
      await assert.rejects(c.inspect());
      await assert.rejects(c.execute(inspected.planSha256));
      assert.equal(c.signerLoads, 0);
      assert.deepEqual(c.writes, []);
      assert.deepEqual(await c.snapshot(), before);
    }
  });
  it(`${mode}: raw binding changes invalidate the reviewed plan without creating claims`, async t => {
    for (const file of ['profile', 'admission']) {
      const c = await fixture(t, mode);
      const inspected = await c.inspect();
      const path = file === 'profile' ? c.profileFile : join(c.profile.directory, 'release-admission.json');
      await writeFile(path, (await readFile(path, 'utf8')) + '\n');
      const before = await c.snapshot();
      await assert.rejects(c.execute(inspected.planSha256), /plan changed/);
      assert.equal(c.signerLoads, 0);
      assert.deepEqual(await c.snapshot(), before);
    }
  });
}
it('compact: requires the immutable extension archive and includes its raw bytes in the plan', async t => {
  for (const change of ['missing', 'corrupt', 'whitespace']) {
    const c = await fixture(t, 'compact');
    const inspected = await c.inspect();
    const state = await c.admission!.validate();
    assert.ok('extensions' in state);
    const path = join(c.profile.directory, admissionArchive(state.extensions[0].previousAdmissionSha256));
    if (change === 'missing') await rm(path);
    else if (change === 'corrupt') await writeFile(path, '{}');
    else await writeFile(path, (await readFile(path, 'utf8')) + '\n');
    const before = await c.snapshot();
    await assert.rejects(c.execute(inspected.planSha256));
    assert.equal(c.signerLoads, 0);
    assert.deepEqual(await c.snapshot(), before);
  }
});
for (const mode of ['pilot', 'standard', 'compact'] as const) {
  it(`${mode}: refuses orphan inventories and another unfinished publication without clearing history`, async t => {
    for (const change of ['orphan', 'unfinished']) {
      const c = await fixture(t, mode);
      const inspected = await c.inspect();
      const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as Record<string, unknown>;
      const other = 'stream-22222222-2222-4222-8222-222222222222';
      await save(c.profile.directory, `${other}.json`, { ...inventory, job: other, attemptedStores: 1 });
      if (change === 'unfinished') {
        const ownerState = (await load(join(c.profile.directory, 'owner.json'))) as { jobs: string[] };
        ownerState.jobs.push(other);
        await save(c.profile.directory, 'owner.json', ownerState);
      }
      const before = await c.snapshot();
      await assert.rejects(c.inspect(), /Orphan|reconciliation/);
      await assert.rejects(c.execute(inspected.planSha256));
      assert.equal(c.signerLoads, 0);
      assert.deepEqual(await c.snapshot(), before);
    }
  });
}

for (const mode of ['standard', 'compact'] as const) {
  it(`${mode}: preserves an already-ready cover, its admission and receipts while recovering only audio`, async t => {
    const c = await fixture(t, mode);
    const cover = await createResponsiveCover(
      await sharp({ create: { width: 16, height: 16, channels: 3, background: '#224488' } })
        .png()
        .toBuffer(),
      'png'
    );
    const store = await createStreamingPublicationStore(
      { provider: 'bulletin', queue: c.queue, profileFile: c.profileFile, releaseAssets: true, contentKeyVault: c.vault, assetAuthority: async () => true },
      c.deps.publisher
    );
    await store.pinAsset!(
      cover.files,
      'cover',
      { address: owner, chainId: c.scope.chainId, runtimeAddress: c.scope.runtimeAddress, contentHash: c.scope.contentHash, keyVersion: c.scope.keyVersion },
      signal()
    );
    await store.close();
    const before = await c.snapshot();
    const priorWrites = c.writes.length;
    const inspected = await c.inspect();
    await c.execute(inspected.planSha256);
    const coverJob = (await c.admission!.validate()).releases[0].cover!;
    assert.equal((await readFile(join(c.profile.directory, `${coverJob}.json`))).toString('hex'), before.publisher[`${coverJob}.json`]);
    assert.equal((await readFile(join(c.profile.directory, 'release-admission.json'))).toString('hex'), before.publisher['release-admission.json']);
    assert.equal(c.writes.length - priorWrites, c.graph.blocks.length);
    assert.equal(c.signerLoads, c.closed);
  });
}
