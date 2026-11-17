import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { assetFixture } from './bulletinPublicAssets.fixture.js';
import { createReleaseAdmission, releaseIdentity, releaseJob } from './bulletinReleaseAdmission.js';
import { publicationBinding, publisherProfileSchema } from './bulletinPublisherProfile.js';
import { load, save } from './bulletinMediaState.js';
import { PublicationAdmissionError } from './publicationAdmission.js';
const scope = (hash: string) => ({
  chainId: 420420417,
  runtimeAddress: `0x${'22'.repeat(20)}`,
  contentHash: `0x${hash.repeat(32)}`,
  keyVersion: 'dotify-content-key-v2'
});
it('atomically reserves whole releases across parts/restarts, never refunds, and respects the aggregate limit', async t => {
  const c = await assetFixture(t, true);
  const options = {
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  };
  const a = createReleaseAdmission(options);
  await a.check(scope('11'), c.owner.address);
  assert.equal((await a.validate()).releases.length, 0, 'Preflight must not reserve');
  const [audio, cover] = await Promise.all([a.claim(scope('11'), 'audio'), a.claim(scope('11'), 'cover', 'first-cover')]);
  assert.equal(audio, releaseJob(scope('11'), 'audio'));
  assert.equal(cover, releaseJob(scope('11'), 'cover', 'first-cover'));
  const before = await readFile(join(c.profile.directory, 'release-admission.json'));
  assert.equal(await a.claim(scope('11'), 'cover', 'first-cover'), cover);
  await assert.rejects(a.claim(scope('11'), 'cover', 'edited-cover'), PublicationAdmissionError);
  await assert.rejects(a.check(scope('11'), `0x${'99'.repeat(20)}`), PublicationAdmissionError);
  await assert.rejects(a.check({ ...scope('11'), keyVersion: 'dotify-content-key-v3' }), PublicationAdmissionError);
  assert.deepEqual(await readFile(join(c.profile.directory, 'release-admission.json')), before);
  const b = createReleaseAdmission(options);
  const raced = await Promise.allSettled([b.claim(scope('22'), 'metadata', 'metadata-root'), b.claim(scope('33'), 'audio')]);
  assert.deepEqual(
    raced.map(r => r.status),
    ['fulfilled', 'rejected']
  );
  await assert.rejects(b.claim(scope('33'), 'audio'), PublicationAdmissionError);
  const entries = (await b.validate()).releases;
  assert.equal(entries.length, 2);
  assert.equal(entries[0].audio, audio);
  // No writer inventory exists: even an untouched/abandoned admitted release
  // keeps its full allowance, not merely its successful transaction count.
  assert.equal(((await load(join(c.profile.directory, 'owner.json'))) as { jobs: string[] }).jobs.length, 0);
  const narrowed = createReleaseAdmission({
    ...options,
    policy: { ...options.policy, maxReleases: 64, total: { ...options.policy.total, maxBytes: options.policy.total.maxBytes / 2 } }
  });
  await assert.rejects(narrowed.validate(), /aggregate cap/);
});

it('refuses missing, changed, duplicate and orphaned admission state without rebuilding it', async t => {
  const c = await assetFixture(t, true);
  const options = {
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  };
  const a = createReleaseAdmission(options);
  await a.claim(scope('11'), 'audio');
  const file = join(c.profile.directory, 'release-admission.json');
  const state = await a.validate();
  await save(c.profile.directory, 'release-admission.json', { ...state, releases: [...state.releases, state.releases[0]] });
  await assert.rejects(a.validate(), /Duplicate release/);
  await save(c.profile.directory, 'release-admission.json', { ...state, profileSha256: '0'.repeat(64) });
  await assert.rejects(a.validate(), /profile changed/);
  await writeFile(file, JSON.stringify(state), { mode: 0o600 });
  await assert.rejects(
    a.validateInventories([{ schema: 'dotify.bulletin.media-job.v2', scope: scope('11'), job: releaseJob(scope('22'), 'audio') } as never]),
    /lacks its durable release claim/
  );
  await rm(file);
  await assert.rejects(a.check(scope('11')), { code: 'ENOENT' });
  assert.equal(releaseIdentity(scope('11')).length, 64);
});

it('requires explicit compatible complete-release policy bounds', async t => {
  const c = await assetFixture(t, true);
  assert(!publisherProfileSchema.safeParse({ ...c.profile, pilotScope: scope('11') }).success);
  assert(
    !publisherProfileSchema.safeParse({ ...c.profile, releasePolicy: { ...c.profile.releasePolicy, total: { maxBytes: 1, maxTransactions: 1 } } }).success
  );
  assert(
    !publisherProfileSchema.safeParse({
      ...c.profile,
      releasePolicy: { ...c.profile.releasePolicy, artists: [c.profile.releasePolicy!.artists[0], c.profile.releasePolicy!.artists[0]] }
    }).success
  );
});

it('keeps concurrent preflights and inventory snapshots coherent with whole-release claim replacement', async t => {
  const c = await assetFixture(t, true);
  const admission = createReleaseAdmission({
    directory: c.profile.directory,
    profileSha256: publicationBinding(c.profile).profileSha256,
    policy: c.profile.releasePolicy!,
    audio: c.profile.budget
  });
  await Promise.all([admission.claim(scope('11'), 'audio'), admission.claim(scope('22'), 'audio')]);
  await Promise.all([
    admission.claim(scope('11'), 'cover', 'cover-one'),
    ...Array.from({ length: 20 }, () => admission.check(scope('11'), c.owner.address)),
    admission.claim(scope('22'), 'metadata', 'metadata-two'),
    ...Array.from({ length: 20 }, () => admission.validateInventories([])),
    admission.claim(scope('11'), 'metadata', 'metadata-one'),
    admission.claim(scope('22'), 'cover', 'cover-two'),
    ...Array.from({ length: 20 }, () => admission.validate())
  ]);
  const state = await admission.validate();
  assert.equal(state.releases.length, 2);
  for (const entry of state.releases) assert.ok(entry.audio && entry.cover && entry.metadata);
  await assert.rejects(admission.claim(scope('33'), 'audio'), PublicationAdmissionError);
});
