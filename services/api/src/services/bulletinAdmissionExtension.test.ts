import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { extendBulletinAdmission } from './bulletinAdmissionExtension.js';
import { admissionArchive, admissionDigest, admissionExtensions, createReleaseAdmission, releaseJob } from './bulletinReleaseAdmission.js';
import { publicationBinding } from './bulletinPublisherProfile.js';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { load, save } from './bulletinMediaState.js';
import { createReleasePublication } from './bulletinReleasePublication.js';
import { PublicationAdmissionError } from './publicationAdmission.js';

const scope = (hash: string) => ({
  chainId: 420420417,
  runtimeAddress: `0x${'22'.repeat(20)}`,
  contentHash: `0x${hash.repeat(32)}`,
  keyVersion: 'dotify-content-key-v2'
});
async function fixture(t: Parameters<typeof assetFixture>[0]) {
  const c = await assetFixture(t, true);
  const options = {
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  };
  const admission = createReleaseAdmission(options);
  await admission.claim(scope('11'), 'audio');
  await admission.claim(scope('22'), 'cover', 'original-cover');
  const before = await admission.validate();
  const request = {
    schema: 'dotify.bulletin.release-extension.v1',
    profileFile: c.profileFile,
    queue: c.queue,
    expectedProfileSha256: options.profileSha256,
    expectedAdmissionSha256: admissionDigest(before),
    owner: c.owner.address,
    scope: scope('44')
  };
  const protectedFiles = [
    c.profileFile,
    join(c.profile.directory, 'publisher.json'),
    join(c.profile.directory, 'owner.json'),
    join(c.queue, 'publication-store.json'),
    join(c.queue, 'jobs.json'),
    join(c.queue, 'nonces', 'ledger.json')
  ];
  await writeFile(join(c.queue, 'nonces', 'permanent-reservation-canary'), 'Do not reset nonce history', { mode: 0o600 });
  protectedFiles.push(join(c.queue, 'nonces', 'permanent-reservation-canary'));
  const snapshot = () => Promise.all(protectedFiles.map(file => readFile(file)));
  return { ...c, options, admission, before, request, snapshot };
}

it('inspects without changes, then grants one exact new release while preserving profile, queue and nonce history', async t => {
  const c = await fixture(t);
  const files = await readdir(c.profile.directory),
    protectedBefore = await c.snapshot();
  const inspection = await extendBulletinAdmission(c.request);
  assert.equal(inspection.applied, false);
  assert.equal(inspection.capacity, 3);
  assert.equal(inspection.addedWholeReleaseBudget.maxTransactions, 48);
  assert.deepEqual(await readdir(c.profile.directory), files);
  assert.deepEqual(await c.admission.validate(), c.before);
  const report = await extendBulletinAdmission(c.request, true);
  assert.equal(report.applied, true);
  assert.equal(report.networkWrites, 0);
  assert.equal(report.keysChanged, false);
  assert.deepEqual(await c.snapshot(), protectedBefore);
  await assert.rejects(c.admission.check(scope('44')), /extensions changed/, 'A running instance cannot adopt an extension');
  const restarted = createReleaseAdmission(c.options);
  assert.deepEqual((await restarted.validate()).releases, c.before.releases);
  assert.equal(await restarted.claim(scope('44'), 'audio', '', c.owner.address), releaseJob(scope('44'), 'audio'));
  await restarted.claim(scope('44'), 'cover', 'new-cover');
  await restarted.claim(scope('44'), 'metadata', 'new-metadata');
  await createReleasePublication(c.profile, async () => []).audio(scope('44'), releaseJob(scope('44'), 'audio'));
  const state = await restarted.validate();
  assert.equal(state.releases.length, 3);
  assert.equal(admissionExtensions(state).length, 1);
  assert.deepEqual(state.releases.slice(0, 2), c.before.releases);
  await assert.rejects(restarted.claim(scope('55'), 'audio'), PublicationAdmissionError);
  await assert.rejects(restarted.claim(scope('44'), 'cover', 'other-root'), PublicationAdmissionError);
  await assert.rejects(restarted.check(scope('44'), `0x${'99'.repeat(20)}`), PublicationAdmissionError);
  await assert.rejects(restarted.check({ ...scope('44'), keyVersion: 'dotify-content-key-v3' }), PublicationAdmissionError);
});

it('never refunds or grants again on replay, changed fingerprints or an existing admitted identity', async t => {
  const c = await fixture(t);
  for (const changed of [
    { ...c.request, expectedAdmissionSha256: '0'.repeat(64) },
    { ...c.request, expectedProfileSha256: '0'.repeat(64) },
    { ...c.request, owner: `0x${'99'.repeat(20)}` },
    { ...c.request, scope: scope('11') },
    { ...c.request, scope: { ...scope('44'), runtimeAddress: `0x${'99'.repeat(20)}` } }
  ])
    await assert.rejects(extendBulletinAdmission(changed, true));
  assert.deepEqual(await c.admission.validate(), c.before);
  await extendBulletinAdmission(c.request, true);
  const after = await readFile(join(c.profile.directory, 'release-admission.json'));
  await assert.rejects(extendBulletinAdmission(c.request, true), /checkpoint changed/);
  await assert.rejects(
    extendBulletinAdmission({ ...c.request, expectedAdmissionSha256: admissionDigest(await createReleaseAdmission(c.options).validate()) }, true),
    /already has/
  );
  assert.deepEqual(await readFile(join(c.profile.directory, 'release-admission.json')), after);
});

it('excludes a live publisher and refuses writer, active, uncertain, orphan or unfinished queue state', async t => {
  const c = await fixture(t),
    original = await c.snapshot();
  const unlock = await acquireBulletinPublisherLock(c.profile);
  await assert.rejects(extendBulletinAdmission(c.request, true), { code: 'EEXIST' });
  await unlock();
  await writeFile(join(c.profile.directory, 'writer.lock'), 'busy', { mode: 0o600 });
  await assert.rejects(extendBulletinAdmission(c.request, true), /Writer lock/);
  await rm(join(c.profile.directory, 'writer.lock'));
  const owner = (await load(join(c.profile.directory, 'owner.json'))) as Record<string, unknown>;
  const id = releaseJob(scope('11'), 'audio');
  await save(c.profile.directory, 'owner.json', { ...owner, jobs: [id], activeJob: id });
  await assert.rejects(extendBulletinAdmission(c.request, true), /Active publication/);
  await save(c.profile.directory, 'owner.json', owner);
  await writeFile(join(c.profile.directory, id + '.json'), '{}', { mode: 0o600 });
  await assert.rejects(extendBulletinAdmission(c.request, true), /Orphan/);
  await rm(join(c.profile.directory, id + '.json'));
  await save(c.profile.directory, 'owner.json', { ...owner, jobs: [id] });
  for (const uncertain of [false, true]) {
    await save(c.profile.directory, id + '.json', {
      schema: 'dotify.bulletin.media-job.v2',
      genesis: c.profile.genesis,
      account: c.profile.account,
      job: id,
      root: 'synthetic-root',
      scope: scope('11'),
      generation: 'synthetic-generation',
      blocks: [{ cid: 'synthetic-block', bytes: 1 }],
      budget: c.profile.budget,
      attemptedBytes: 1,
      attemptedStores: 1,
      receipts: {},
      pending: uncertain ? { 'synthetic-block': { nonce: 1, afterBlock: 1 } } : {},
      nextNonce: 2,
      pipeline: c.profile.pipeline,
      ready: uncertain
    });
    await assert.rejects(extendBulletinAdmission(c.request, true), /Unfinished or uncertain/);
  }
  await rm(join(c.profile.directory, id + '.json'));
  await save(c.profile.directory, 'owner.json', owner);
  const queue = (await load(join(c.queue, 'jobs.json'))) as Record<string, unknown>;
  for (const state of ['queued', 'encoding', 'publishing', 'failed', 'expired']) {
    const job = {
      id: '11111111-1111-4111-8111-111111111111',
      owner: c.owner.address,
      scope: scope('11'),
      state,
      attempts: 1,
      createdAt: 1,
      updatedAt: 1,
      sourceBytes: 10,
      sourceGeneration: '0123456789abcdef'
    };
    await save(c.queue, 'jobs.json', { ...queue, jobs: [job] });
    await assert.rejects(extendBulletinAdmission(c.request, true), /Unfinished queue/);
  }
  await save(c.queue, 'jobs.json', {
    ...queue,
    jobs: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        owner: c.owner.address,
        scope: scope('11'),
        state: 'ready',
        ref: 'dotify:enc:v3:key-v2:ipfs://synthetic',
        attempts: 1,
        createdAt: 1,
        updatedAt: 1,
        sourceBytes: 10,
        sourceGeneration: '0123456789abcdef'
      }
    ]
  });
  await assert.rejects(extendBulletinAdmission(c.request, true), /Ready queue lacks/);
  await save(c.queue, 'jobs.json', queue);
  assert.deepEqual(await c.snapshot(), original);
  assert.ok(!(await readdir(c.profile.directory)).some(f => f.startsWith('admission-before-')));
});

it('preserves the archive across an interrupted pre-commit attempt and refuses altered or missing lineage', async t => {
  const c = await fixture(t),
    archive = admissionArchive(c.request.expectedAdmissionSha256);
  await save(c.profile.directory, archive, c.before); // Crash after archive, before atomic activation.
  await extendBulletinAdmission(c.request, true);
  const committed = await createReleaseAdmission(c.options).validate();
  await save(c.profile.directory, archive, { ...c.before, releases: [] });
  await assert.rejects(createReleaseAdmission(c.options).validate(), /archive changed/);
  await save(c.profile.directory, archive, c.before);
  await save(c.profile.directory, 'release-admission.json', { ...committed, releases: committed.releases.slice(1) });
  await assert.rejects(createReleaseAdmission(c.options).validate(), /lost a prior/);
  await save(c.profile.directory, 'release-admission.json', committed);
  await rm(join(c.profile.directory, archive));
  await assert.rejects(createReleaseAdmission(c.options).validate(), { code: 'ENOENT' });
});

it('allows later separately reviewed grants only with a new checkpoint and retains all earlier grants and claims', async t => {
  const c = await fixture(t);
  await extendBulletinAdmission(c.request, true);
  const first = createReleaseAdmission(c.options);
  await first.claim(scope('44'), 'audio');
  const state = await first.validate();
  await extendBulletinAdmission({ ...c.request, scope: scope('55'), expectedAdmissionSha256: admissionDigest(state) }, true);
  const restarted = createReleaseAdmission(c.options);
  await restarted.claim(scope('55'), 'audio');
  const after = await restarted.validate();
  assert.equal(admissionExtensions(after).length, 2);
  assert.deepEqual(after.releases.slice(0, 3), state.releases);
  await assert.rejects(restarted.claim(scope('66'), 'audio'), PublicationAdmissionError);
  assert.deepEqual(await load(join(c.profile.directory, admissionArchive(admissionDigest(state)))), state);
});

it('does not let an extended identity consume an unused original slot', async t => {
  const c = await assetFixture(t, true);
  const options = {
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  };
  const before = await createReleaseAdmission(options).validate();
  await extendBulletinAdmission(
    {
      schema: 'dotify.bulletin.release-extension.v1',
      profileFile: c.profileFile,
      queue: c.queue,
      expectedProfileSha256: options.profileSha256,
      expectedAdmissionSha256: admissionDigest(before),
      owner: c.owner.address,
      scope: scope('44')
    },
    true
  );
  const a = createReleaseAdmission(options);
  await a.claim(scope('44'), 'audio');
  await a.claim(scope('11'), 'audio');
  await a.claim(scope('22'), 'audio');
  await assert.rejects(a.claim(scope('55'), 'audio'), PublicationAdmissionError);
  assert.equal((await a.validate()).releases.length, 3);
});

it('keeps original per-part caps on the new identity and serializes competing maintenance requests', async t => {
  const c = await fixture(t);
  const results = await Promise.allSettled([extendBulletinAdmission(c.request, true), extendBulletinAdmission({ ...c.request, scope: scope('55') }, true)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const admission = createReleaseAdmission(c.options),
    state = await admission.validate();
  const granted = admissionExtensions(state)[0].scope;
  const id = await admission.claim(granted, 'audio');
  const inventory = {
    scope: granted,
    job: id,
    generation: 'synthetic',
    root: 'synthetic',
    budget: c.profile.budget,
    blocks: [{ cid: 'block', bytes: 1 }],
    attemptedBytes: 0,
    attemptedStores: 0
  };
  await admission.validateInventories([inventory as never]);
  await assert.rejects(
    admission.validateInventories([{ ...inventory, budget: { ...c.profile.budget, maxTransactions: c.profile.budget.maxTransactions + 1 } } as never]),
    /allowance changed/
  );
  await assert.rejects(
    admission.validateInventories([{ ...inventory, attemptedStores: c.profile.budget.maxTransactions + 1 } as never]),
    /exceeds its allowance/
  );
});

it('refuses widened grant owners, refunded source identities, changed claims and capacity above 64', async t => {
  const c = await fixture(t);
  await extendBulletinAdmission(c.request, true);
  const state = await createReleaseAdmission(c.options).validate();
  assert.equal(state.schema, 'dotify.bulletin.release-admission.v2');
  if (state.schema !== 'dotify.bulletin.release-admission.v2') return;
  for (const [change, pattern] of [
    [{ ...state, extensions: [{ ...state.extensions[0], owner: `0x${'99'.repeat(20)}` }] }, undefined],
    [{ ...state, extensions: [{ ...state.extensions[0], scope: scope('11') }] }, /refund/],
    [{ ...state, releases: [{ ...state.releases[0], audio: releaseJob(scope('55'), 'audio') }, state.releases[1]] }, /changed a prior claim/],
    [
      {
        ...state,
        extensions: Array.from({ length: 63 }, (_, i) => ({
          ...state.extensions[0],
          scope: {
            ...scope('44'),
            contentHash:
              '0x' +
              BigInt(i + 1)
                .toString(16)
                .padStart(64, '0')
          }
        }))
      },
      /capacity bound/
    ]
  ] as const) {
    await save(c.profile.directory, 'release-admission.json', change);
    if (pattern) await assert.rejects(createReleaseAdmission(c.options).validate(), pattern);
    else await assert.rejects(createReleaseAdmission(c.options).validate(), PublicationAdmissionError);
  }
  await save(c.profile.directory, 'release-admission.json', state);
  assert.deepEqual(await createReleaseAdmission(c.options).validate(), state);
});

it('CLI inspection runs without application configuration, vault secrets, network or persistent writes', async t => {
  const c = await fixture(t),
    before = await c.snapshot();
  const requestFile = join(c.root, 'request.json');
  await writeFile(requestFile, JSON.stringify(c.request), { mode: 0o600 });
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      fileURLToPath(new URL('../../node_modules/tsx/dist/loader.mjs', import.meta.url)),
      fileURLToPath(new URL('../scripts/extendBulletinAdmission.ts', import.meta.url)),
      '--inspect',
      requestFile
    ],
    { encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, NODE_ENV: 'production', CONTENT_KEY_MASTER_SECRETS: 'INVALID-VAULT-MUST-NOT-BE-READ' } }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).applied, false);
  assert.deepEqual(await c.snapshot(), before);
  assert.deepEqual(await c.admission.validate(), c.before);
});
