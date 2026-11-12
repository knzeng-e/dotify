// Read-only local coherence checks, shared by capture and isolated restoration.
// Every physical path comes from the caller's bounded view, never the saved profile.
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { CID } from 'multiformats/cid';
import { publisherProfileSchema, publicationBinding } from './bulletinPublisherProfile.js';
import { load, ownerSchema, jobSchema, bulletinInventoryLayout, type BulletinMediaInventory } from './bulletinMediaState.js';
import { streamingJobsSchema, streamingJobSchema } from './streamingJobState.js';
import { admissionExtensions, createReleaseAdmission, releaseIdentity, releaseJob, releasePipeline, releaseAudioLayout } from './bulletinReleaseAdmission.js';
import { formatStreamingReference } from './streamingReference.js';
import { parseStreamingManifest } from './streamingFormat.js';
import { checkpointMetadata, type CheckpointEntry } from './bulletinCheckpointFiles.js';

export async function validateCheckpointState(
  view: { files: CheckpointEntry[]; directories: string[]; pathFor: (logical: string) => string },
  signal: AbortSignal
) {
  const { files, directories } = view;
  const names = new Set(files.map(file => file.path));
  const pathFor = (path: string) => {
    assert.ok(names.has(path), 'Missing checkpoint state file');
    return view.pathFor(path);
  };
  const profile = publisherProfileSchema.parse(await load(pathFor('profile.json')));
  assert.ok(profile.releasePolicy && !profile.pilotScope, 'Checkpoint supports the settled multi-release store only');
  const binding = publicationBinding(profile);
  for (const path of ['queue/publication-store.json', 'publisher/publisher.json'])
    assert.deepEqual(await load(pathFor(path)), binding, 'Checkpoint publication binding changed');
  const state = streamingJobsSchema.parse(await load(pathFor('queue/jobs.json')));
  assert.equal(new Set(state.jobs.map(job => job.id)).size, state.jobs.length, 'Duplicate queue job');
  assert.ok(
    state.jobs.every(job => job.state === 'ready'),
    'Unsettled queue must finish or reconcile before checkpoint'
  );
  const owner = ownerSchema.parse(await load(pathFor('publisher/owner.json')));
  assert.equal(owner.account, profile.account);
  assert.equal(owner.genesis, profile.genesis);
  assert.equal(owner.activeJob, null, 'Active publisher must finish or reconcile before checkpoint');
  assert.ok(owner.jobs.length <= 192 && new Set(owner.jobs).size === owner.jobs.length, 'Invalid checkpoint inventory count');
  const inventoryNames = files
    .filter(file => /^publisher\/stream-/.test(file.path))
    .map(file => file.path.slice('publisher/'.length))
    .sort();
  assert.deepEqual(inventoryNames, owner.jobs.map(id => `${id}.json`).sort(), 'Orphan or missing inventory');
  const inventories: BulletinMediaInventory[] = [];
  for (const id of owner.jobs) {
    signal.throwIfAborted();
    const inventory = jobSchema.parse(await load(pathFor(`publisher/${id}.json`)));
    assert.equal(inventory.job, id);
    assert.equal(inventory.account, profile.account);
    assert.equal(inventory.genesis, profile.genesis);
    assert.ok(inventory.ready && !Object.keys(inventory.pending).length, 'Unsettled inventory must reconcile before checkpoint');
    const blocks = new Map(inventory.blocks.map(block => [block.cid, block.bytes]));
    assert.equal(blocks.size, inventory.blocks.length, 'Duplicate inventory block');
    assert.ok(blocks.has(inventory.root), 'Inventory root missing');
    assert.deepEqual(Object.keys(inventory.receipts).sort(), [...blocks.keys()].sort(), 'Incomplete ready receipts');
    for (const [cid, receipt] of Object.entries(inventory.receipts)) {
      assert.equal(receipt.cid, cid);
      assert.equal(receipt.bytes, blocks.get(cid));
    }
    inventories.push(inventory);
  }
  const admission = createReleaseAdmission({
    directory: dirname(pathFor('publisher/release-admission.json')),
    profileSha256: publicationBinding(profile).profileSha256,
    policy: profile.releasePolicy!,
    audio: profile.budget
  });
  const ledger = await admission.validate();
  await admission.validateInventories(inventories);
  const archives = files
    .filter(file => /^publisher\/admission-before-/.test(file.path))
    .map(file => file.path)
    .sort();
  assert.deepEqual(
    archives,
    admissionExtensions(ledger)
      .map(extension => `publisher/admission-before-${extension.previousAdmissionSha256}.json`)
      .sort(),
    'Unbound admission archive'
  );
  for (const inventory of inventories)
    assert.deepEqual(inventory.pipeline, releasePipeline(profile.pipeline, ledger, inventory.scope), 'Inventory pipeline changed');
  await load(pathFor('queue/nonces/ledger.json')).then(marker => assert.deepEqual(marker, { schema: 'dotify.streaming.nonce-ledger.v1' }));
  const generations = new Set<string>();
  for (const file of files.filter(file => /^queue\/nonces\/[0-9a-f]{64}\//.test(file.path))) {
    const [, , fingerprint, generationFile] = file.path.split('/');
    const generation = generationFile.slice(0, -5);
    assert.deepEqual(await load(pathFor(file.path)), { schema: 'dotify.streaming.nonce-ledger.v1', fingerprint, generation });
    generations.add(generation);
  }
  // Ready queue entries and their ciphertext are routinely pruned. The permanent
  // audio inventory still binds the output generation, so its reservation must
  // survive independently of either temporary representation. Public assets
  // are unencrypted and use non-nonce generation labels.
  for (const inventory of inventories)
    if (inventory.job === releaseJob(inventory.scope, 'audio')) assert.ok(generations.has(inventory.generation), 'Output nonce reservation missing');
  const jobIds = new Set(state.jobs.map(job => job.id));
  for (const directory of directories.filter(path => /^queue\/jobs\/[^/]+$/.test(path)))
    assert.ok(jobIds.has(directory.split('/')[2]), 'Orphan queue directory');
  for (const job of state.jobs) {
    admission.artistFor(job.scope, job.owner);
    const inventory = inventories.find(item => item.job === `stream-${job.id}`);
    assert.ok(inventory && inventory.job === releaseJob(job.scope, 'audio'), 'Ready queue lacks its admitted audio inventory');
    assert.deepEqual(inventory.scope, job.scope);
    assert.equal(
      job.ref,
      formatStreamingReference(inventory.root, job.scope.keyVersion, releaseAudioLayout(ledger, job.scope), value => CID.parse(value))
    );
    assert.equal(bulletinInventoryLayout(inventory), releaseAudioLayout(ledger, job.scope));
    assert.ok(generations.has(job.sourceGeneration), 'Source nonce reservation missing');
    if (directories.includes(`queue/jobs/${job.id}`)) {
      const folder = `queue/jobs/${job.id}`;
      const envelope = streamingJobSchema.parse(await load(pathFor(`${folder}/job.json`)));
      for (const key of ['id', 'owner', 'scope', 'sourceGeneration', 'sourceBytes'] as const)
        assert.deepEqual(envelope[key], job[key], 'Admission envelope changed');
      const manifest = parseStreamingManifest(await checkpointMetadata(pathFor(`${folder}/output/manifest.json`), 256 * 1024, signal));
      for (const key of ['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'] as const)
        assert.equal(manifest[key], job.scope[key], 'Manifest scope changed');
      assert.equal(manifest.generation, inventory.generation, 'Manifest output generation changed');
      const expected = new Map<string, number | undefined>([
        [`queue/jobs/${job.id}/job.json`, undefined],
        [`queue/jobs/${job.id}/source.bin`, job.sourceBytes + 16],
        [`queue/jobs/${job.id}/output/manifest.json`, undefined],
        ...[manifest.master, ...manifest.renditions.flatMap(rendition => [rendition.init, ...rendition.segments])].map(
          object => [`queue/jobs/${job.id}/output/${object.path}`, object.encryptedLength] as const
        )
      ]);
      const retained = files.filter(file => file.path.startsWith(`queue/jobs/${job.id}/`));
      assert.deepEqual(retained.map(file => file.path).sort(), [...expected.keys()].sort(), 'Incomplete retained ciphertext');
      for (const file of retained) if (expected.get(file.path) !== undefined) assert.equal(file.bytes, expected.get(file.path));
    }
  }
  const metadata = files.filter(file => /^publisher\/public-metadata-/.test(file.path)).map(file => file.path);
  for (const path of metadata)
    assert.ok(
      ledger.releases.some(entry => path === `publisher/public-metadata-${releaseIdentity(entry.scope)}.json`),
      'Unbound public metadata'
    );
  return {
    profile,
    profileSha256: binding.profileSha256,
    requiredKeyVersions: [
      ...new Set([
        ...profile.releasePolicy!.artists.map(artist => artist.keyVersion),
        ...ledger.releases.map(entry => entry.scope.keyVersion),
        ...inventories.map(item => item.scope.keyVersion)
      ])
    ].sort(),
    queueJobs: state.jobs.length,
    inventories: inventories.length
  };
}
