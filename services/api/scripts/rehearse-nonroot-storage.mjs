#!/usr/bin/env node
// Local Docker only. All tokens, receipts and media references are synthetic.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const context = resolve(fileURLToPath(new URL('..', import.meta.url)));
const label = `dotify-api-storage-${Date.now()}-${randomBytes(3).toString('hex')}`;
const api = `${label}:api`;
const maintenance = `${label}:maintenance`;
const volumes = [label, `${label}-backup`, `${label}-restore`];
const createdVolumes = [];
const createdImages = [];
const containers = [];
function containerName() {
  const name = `${label}-${containers.length}`;
  containers.push(name);
  return name;
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker rehearsal failed (${result.status}): ${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}
function run(image, volume, code, extra = []) {
  return docker(
    [
      'run',
      '--rm',
      '--name',
      containerName(),
      '--network=none',
      '--memory=512m',
      '--cpus=1',
      '--pids-limit=64',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=16m',
      '--mount',
      `type=volume,source=${volume},target=/data/contributions`,
      ...extra,
      '--entrypoint=node',
      '-i',
      image,
      '--input-type=module'
    ],
    { input: code }
  );
}
function inspect(volume) {
  return JSON.parse(
    run(
      maintenance,
      volume,
      "import {inspectApiStorage} from './dist/services/storageOwnership.js'; console.log(JSON.stringify(await inspectApiStorage('/data/contributions')));"
    )
  );
}
function apply(volume, fingerprint) {
  return JSON.parse(
    run(
      maintenance,
      volume,
      `import {prepareApiStorage} from './dist/services/storageOwnership.js'; console.log(JSON.stringify(await prepareApiStorage('/data/contributions', ${JSON.stringify(fingerprint)})));`
    )
  );
}
const paths = "const locations=['catalog.json','session-revocations.json','receipts.json'].map(name=>({name,path:'/data/contributions/'+name}));";
const sessions = `const options={epoch:'synthetic-storage-epoch',masterSecret:()=> '51'.repeat(32),revocationPath:'/data/contributions/session-revocations.json'};`;
try {
  docker(['build', '--target=runner', '-t', api, context], { stdio: 'inherit' });
  createdImages.push(api);
  docker(['build', '--target=storage-maintenance', '-t', maintenance, context], { stdio: 'inherit' });
  createdImages.push(maintenance);
  assert.equal(docker(['image', 'inspect', api, '--format', '{{.Config.User}}']), 'node');
  assert.equal(docker(['image', 'inspect', maintenance, '--format', '{{.Config.User}}']), 'root');
  for (const name of volumes) {
    docker(['volume', 'create', name]);
    createdVolumes.push(name);
  }
  const fixture = JSON.parse(
    run(
      maintenance,
      volumes[0],
      `
    import {mkdir,chmod,writeFile,copyFile} from 'node:fs/promises';
    import {createSessionTokenService} from './dist/services/sessionTokens.js';
    import {JsonCatalogSnapshotStore} from './dist/services/catalog/snapshotStore.js';
    import {PASEO_ASSET_HUB_GENESIS} from './dist/services/nativeReceipts.js';
    await chmod('/data/contributions',0o700); await mkdir('/data/contributions/lost+found',{mode:0o700});
    ${sessions}
    const service=createSessionTokenService(options);
    const address='0x'+'12'.repeat(20); const hash='0x'+'34'.repeat(32);
    const revoked=service.issue(address,420420417); const active=service.issue(address,420420417);
    if(!revoked.ok||!active.ok)throw new Error('Synthetic session setup failed'); service.revoke(revoked.token);
    const date=new Date().toISOString();
    await new JsonCatalogSnapshotStore('/data/contributions/catalog.json').save({schemaVersion:1,chainId:420420417,directoryAddress:address,lastIndexedBlock:42,lastIndexedBlockHash:hash,chainHeadBlock:42,indexedAt:date,reconciledAt:date,artists:[{artistAddress:address,runtimeAddress:address,name:'Synthetic artist',releaseCount:0,activeReleaseCount:0,latestReleaseBlock:42}],releases:[]});
    await writeFile('/data/contributions/receipts.json',JSON.stringify({version:1,genesisHash:PASEO_ASSET_HUB_GENESIS,updatedAt:date,receipts:[{hash,genesisHash:PASEO_ASSET_HUB_GENESIS,status:'success',block:{number:42,hash},logs:[{address,data:'0x',topics:[],transactionHash:hash,logIndex:0}]}]}),{mode:0o600});
    for(const name of ['catalog.json','session-revocations.json','receipts.json'])await copyFile('/data/contributions/'+name,'/backup/'+name);
    console.log(JSON.stringify({revoked:revoked.token,active:active.token,address}));
  `,
      ['--mount', `type=volume,source=${volumes[1]},target=/backup`]
    )
  );
  const before = inspect(volumes[0]);
  const blocked = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      containerName(),
      '--network=none',
      '--memory=512m',
      '--cpus=1',
      '--pids-limit=64',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=16m',
      '--mount',
      `type=volume,source=${volumes[0]},target=/data/contributions`,
      '-e',
      'CATALOG_SNAPSHOT_PATH=/data/contributions/catalog.json',
      '-e',
      'SESSION_REVOCATIONS_PATH=/data/contributions/session-revocations.json',
      '-e',
      'NATIVE_CONTRIBUTION_SNAPSHOT_PATH=/data/contributions/receipts.json',
      api
    ],
    { encoding: 'utf8', timeout: 15_000 }
  );
  assert.equal(blocked.status, 1, blocked.stderr);
  assert.match(blocked.stderr, /API storage preflight failed/);
  assert.doesNotMatch(blocked.stderr, /fresh session epoch|Server listening/);
  assert.equal(inspect(volumes[0]).fingerprint, before.fingerprint);
  const mismatch = run(
    maintenance,
    volumes[0],
    `import {prepareApiStorage} from './dist/services/storageOwnership.js';try{await prepareApiStorage('/data/contributions','0'.repeat(64));process.exit(2);}catch(error){if(!error.message.includes('fingerprint changed'))throw error;console.log('refused');}`
  );
  assert.equal(mismatch, 'refused');
  assert.deepEqual(inspect(volumes[0]), before);
  const after = apply(volumes[0], before.fingerprint);
  assert.equal(after.fingerprint, before.fingerprint);
  assert.equal(after.directory.uid, 1000);
  assert.ok(after.files.every(file => file.uid === 1000 && file.gid === 1000 && file.mode === 0o600));
  assert.deepEqual(apply(volumes[0], before.fingerprint), after);
  const verify = `
    import assert from 'node:assert/strict';
    import {verifyApiStorage} from './dist/services/storagePreflight.js';
    import {createSessionTokenService} from './dist/services/sessionTokens.js';
    import {JsonCatalogSnapshotStore} from './dist/services/catalog/snapshotStore.js';
    import {NativeContributionLedger} from './dist/services/nativeContributionLedger.js';
    const fixture=${JSON.stringify(fixture)}; ${paths} ${sessions}
    await verifyApiStorage(locations);
    const service=createSessionTokenService(options);
    assert.equal(service.verify(fixture.revoked).code,'SESSION_REVOKED');
    assert.equal(service.verify(fixture.active).valid,true);
    assert.equal((await new JsonCatalogSnapshotStore('/data/contributions/catalog.json').load()).lastIndexedBlock,42);
    assert.equal((await new NativeContributionLedger('/data/contributions/receipts.json').history([fixture.address])).receipts.length,1);
  `;
  run(api, volumes[0], verify + "assert.equal(process.getuid(),1000); console.log('non-root read/write preflight and trust-state continuity passed');");
  // Backup restoration is rehearsed before any post-migration application write.
  run(
    maintenance,
    volumes[2],
    "import {copyFile} from 'node:fs/promises';for(const name of ['catalog.json','session-revocations.json','receipts.json'])await copyFile('/backup/'+name,'/data/contributions/'+name);",
    ['--mount', `type=volume,source=${volumes[1]},target=/backup,readonly`]
  );
  assert.equal(inspect(volumes[2]).fingerprint, before.fingerprint);
  apply(volumes[2], before.fingerprint);
  run(api, volumes[2], verify);
  // Roll code back as root while retaining the latest state, never an older backup.
  run(
    api,
    volumes[0],
    verify +
      "service.revoke(fixture.active); const store=new JsonCatalogSnapshotStore('/data/contributions/catalog.json'); const snapshot=await store.load(); await store.save({...snapshot,lastIndexedBlock:43,chainHeadBlock:43});"
  );
  run(
    api,
    volumes[0],
    `
    import assert from 'node:assert/strict'; import {createSessionTokenService} from './dist/services/sessionTokens.js'; import {JsonCatalogSnapshotStore} from './dist/services/catalog/snapshotStore.js';
    const fixture=${JSON.stringify(fixture)}; ${sessions}
    const service=createSessionTokenService(options); assert.equal(process.getuid(),0);
    assert.equal(service.verify(fixture.revoked).code,'SESSION_REVOKED'); assert.equal(service.verify(fixture.active).code,'SESSION_REVOKED');
    const store=new JsonCatalogSnapshotStore('/data/contributions/catalog.json'); const snapshot=await store.load(); assert.equal(snapshot.lastIndexedBlock,43); await store.save(snapshot);
  `,
    ['--user=0:0']
  );
  const rollback = inspect(volumes[0]);
  apply(volumes[0], rollback.fingerprint);
  run(
    api,
    volumes[0],
    `import assert from 'node:assert/strict';import {verifyApiStorage} from './dist/services/storagePreflight.js';${paths}await verifyApiStorage(locations);assert.equal(process.getuid(),1000);`
  );
  console.log(
    JSON.stringify({
      schema: 'dotify.synthetic-nonroot-rehearsal.v1',
      network: 'none',
      runtimeUid: 1000,
      rootOwnedStartupRefused: true,
      wrongFingerprintRefused: true,
      originalBytesPreserved: true,
      idempotentMaintenance: true,
      backupRestore: true,
      rootModeRollbackRetainedLatestRevocations: true,
      reapplyAfterRootWrite: true,
      productionTouched: false
    })
  );
} finally {
  // A timeout can kill the CLI before Docker removes its container. Remove only
  // this rehearsal's named containers before touching its private volumes.
  for (const name of containers.reverse()) {
    const removed = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    if (removed.status !== 0 && !removed.stderr?.includes('No such container')) {
      console.error(`Could not remove rehearsal container ${name}; retained volumes for inspection`);
      throw new Error('Rehearsal cleanup failed');
    }
  }
  for (const name of createdVolumes.reverse()) docker(['volume', 'rm', name]);
  for (const image of createdImages.reverse()) docker(['image', 'rm', image]);
}
