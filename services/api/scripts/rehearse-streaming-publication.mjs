#!/usr/bin/env node
// Local synthetic integration. No external network, Pinata, chain writes or real keys.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const context = resolve(fileURLToPath(new URL('..', import.meta.url)));
const label = `dotify-stream-${Date.now()}-${randomBytes(3).toString('hex')}`;
const encoder = `${label}:encoder`,
  api = `${label}:api`,
  network = `${label}-net`,
  worker = `${label}-worker`,
  volume = `${label}-data`;
const token = 'synthetic-worker-token-not-a-secret-000000';
const seconds = Number(process.env.DOTIFY_REHEARSAL_SECONDS ?? 60);
if (![60, 900].includes(seconds)) throw new Error('Use the synthetic 60s or 900s resource profile');
const sampleRate = seconds === 60 ? 48000 : 24000;
const containers = [];
let madeNetwork = false,
  madeVolume = false;
const images = [];
function docker(args, options = {}) {
  const p = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error(`Docker integration failed: ${p.stderr}`);
  return p.stdout?.trim() ?? '';
}
const limits = [
  '--memory=512m',
  '--cpus=1',
  '--pids-limit=64',
  '--read-only',
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
  '--tmpfs',
  '/tmp:rw,noexec,nosuid,size=256m'
];
try {
  docker(['build', '-f', `${context}/Dockerfile.encoder`, '-t', encoder, context], { stdio: 'inherit' });
  images.push(encoder);
  docker(['build', '-t', api, context], { stdio: 'inherit' });
  images.push(api);
  docker(['network', 'create', '--internal', network]);
  madeNetwork = true;
  docker(['volume', 'create', volume]);
  madeVolume = true;
  containers.push(worker);
  docker([
    'run',
    '-d',
    '--name',
    worker,
    '--network',
    network,
    '--network-alias',
    'encoder.internal',
    ...limits,
    '-e',
    `STREAMING_WORKER_TOKEN=${token}`,
    encoder
  ]);
  docker([
    'exec',
    worker,
    'node',
    '--input-type=module',
    '-e',
    "import {existsSync} from 'node:fs'; if(existsSync('/app/services/keyVault.js')||existsSync('/app/config.js')||existsSync('/app/node_modules')||process.env.CONTENT_KEY_MASTER_SECRET)process.exit(1); console.log('parser isolation verified');"
  ]);
  // Only this rehearsal-created empty volume needs explicit root provisioning.
  // The API/controller and parser below always execute as non-root.
  const setup = `${label}-setup`;
  containers.push(setup);
  docker([
    'run',
    '--rm',
    '--name',
    setup,
    '--network=none',
    '--user=0:0',
    '--read-only',
    '--cap-drop=ALL',
    '--cap-add=CHOWN',
    '--security-opt=no-new-privileges',
    '--mount',
    `type=volume,source=${volume},target=/state`,
    '--entrypoint=node',
    api,
    '--input-type=module',
    '-e',
    "import {chown,chmod} from 'node:fs/promises';await chmod('/state',0o700);await chown('/state',1000,1000);"
  ]);
  const client = `${label}-client`;
  containers.push(client);
  const result = docker(
    [
      'run',
      '--rm',
      '--name',
      client,
      '--network',
      network,
      ...limits,
      '--user=1000:1000',
      '--mount',
      `type=volume,source=${volume},target=/state`,
      '--entrypoint=node',
      '-i',
      api,
      '--input-type=module'
    ],
    {
      timeout: 600_000,
      input: `
    import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
    import {blake2b} from '@noble/hashes/blake2';
    import {StreamingJobs,initializeStreamingJobs} from './dist/services/streamingJobs.js';
    import {createStreamingWorkerClient} from './dist/services/streamingWorkerClient.js';
    import {parseStreamingManifest,verifyStreamingManifest,decryptStreamingObject} from './dist/services/streamingFormat.js';
    const endpoint='http://encoder.internal:8791';
    for(let n=0;;n++){try{await fetch(endpoint);break;}catch{if(n>30)throw new Error('worker failed to start');await new Promise(r=>setTimeout(r,100));}}
    assert.equal((await fetch(endpoint+'/encode',{method:'POST',body:'invalid'})).status,401);
    assert.equal((await fetch(endpoint+'/encode',{method:'POST',headers:{Authorization:'Bearer ${token}'},body:'invalid'})).status,422);
    const duration=${seconds},sampleRate=${sampleRate},frames=sampleRate*duration;const audio=Buffer.alloc(44+frames*2);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(sampleRate,24);audio.writeUInt32LE(sampleRate*2,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(frames*2,40);for(let n=0;n<frames;n++)audio.writeInt16LE(Math.round(Math.sin(n*2*Math.PI*440/sampleRate)*2000),44+n*2);
    const key=Buffer.alloc(32,31);const scope={chainId:420420417,runtimeAddress:'0x'+'12'.repeat(20),contentHash:'0x'+Buffer.from(blake2b(audio,{dkLen:32})).toString('hex'),keyVersion:'dotify-content-key-v2'};
    await initializeStreamingJobs('/state/streaming');let pinCount=0;
    const queue=new StreamingJobs({directory:'/state/streaming',deriveKey:()=>Buffer.from(key),authority:async()=>true,transcode:createStreamingWorkerClient(endpoint,'${token}'),pin:async files=>{
      pinCount++;const manifest=parseStreamingManifest(files.find(f=>f.path==='manifest.json').bytes);verifyStreamingManifest(manifest,key,scope);assert(Math.abs(manifest.durationSeconds-duration)<0.1);
      assert.deepEqual(decryptStreamingObject(files.find(f=>f.path==='archive/master.bin').bytes,key,manifest,manifest.master),audio);
      for(const r of manifest.renditions)for(const o of [r.init,...r.segments])decryptStreamingObject(files.find(f=>f.path===o.path).bytes,key,manifest,o);
      return 'Qm'+'a'.repeat(44);
    }});
    await queue.start(false);const job=await queue.enqueue({owner:'0x'+'34'.repeat(20),scope,master:audio});const start=performance.now();await queue.runNext();const ready=queue.get(job.id,'0x'+'34'.repeat(20),420420417);assert.equal(ready.state,'ready');assert.equal(pinCount,1);await queue.stop();
    console.log(JSON.stringify({schema:'dotify.streaming.publication-rehearsal.v1',durationSeconds:duration,elapsedMs:Math.round(performance.now()-start),clientPeakRssKiB:process.resourceUsage().maxRSS,workerHasNoCustody:true,authenticatedObjects:true,unauthorizedWorkerRefused:true,malformedMediaRefused:true,productionTouched:false}));
  `
    }
  );
  console.log(result);
  console.log(
    JSON.stringify({
      encoderImageBytes: Number(docker(['image', 'inspect', encoder, '--format', '{{.Size}}'])),
      workerMemoryPeakBytes: docker(['exec', worker, 'cat', '/sys/fs/cgroup/memory.peak']),
      workerCpu: docker(['exec', worker, 'cat', '/sys/fs/cgroup/cpu.stat'])
    })
  );
  console.log(docker(['exec', worker, 'cat', '/usr/share/dotify-encoder/build.txt']));
  console.log(docker(['exec', worker, 'cat', '/usr/share/dotify-encoder/license.txt']));
} finally {
  for (const name of containers.reverse()) {
    const p = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    if (p.status !== 0 && !p.stderr?.includes('No such container')) throw new Error('Synthetic container cleanup failed');
  }
  if (madeVolume) docker(['volume', 'rm', volume]);
  if (madeNetwork) docker(['network', 'rm', network]);
  for (const image of images.reverse()) docker(['image', 'rm', image]);
}
