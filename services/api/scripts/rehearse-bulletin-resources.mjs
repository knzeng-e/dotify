#!/usr/bin/env node
// Local synthetic Docker only. No service login, artist file, key or live RPC.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const context = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
assert.ok(!args.length || (args.length === 2 && args[0] === '--seconds' && ['97', '900'].includes(args[1])), 'Use no arguments, or --seconds 97|900');
const durations = args.length ? [Number(args[1])] : [97, 900];
const label = `dotify-bulletin-resource-${Date.now()}-${randomBytes(4).toString('hex')}`;
const encoder = `${label}:encoder`,
  api = `${label}:api`,
  network = `${label}-net`;
const token = 'synthetic-resource-worker-token-not-a-secret-000000';
const created = { images: [], volumes: [], containers: [], network: false };
const rows = [];
const implementation = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: context, encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: context, encoding: 'utf8' }).trim()
};
const controller = readFileSync(new URL('./research/bulletinResourceController.mjs', import.meta.url), 'utf8');
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Generated Docker exercise stopped (${result.status}): ${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}
const limits = memory => [
  `--memory=${memory}m`,
  `--memory-swap=${memory}m`,
  '--cpus=1',
  '--pids-limit=64',
  '--read-only',
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
  '--tmpfs',
  '/tmp:rw,noexec,nosuid,size=256m'
];
function named(prefix) {
  const name = `${label}-${prefix}-${created.containers.length}`;
  created.containers.push(name);
  return name;
}
function inspect(name) {
  const result = JSON.parse(docker(['inspect', name]))[0];
  assert.equal(result.State.OOMKilled, false, 'A generated resource case was OOM-killed');
  return result;
}
try {
  docker(['build', '-f', `${context}/Dockerfile.encoder`, '-t', encoder, context], { stdio: ['ignore', 2, 2] });
  created.images.push(encoder);
  docker(['build', '--target=runner', '-t', api, context], { stdio: ['ignore', 2, 2] });
  created.images.push(api);
  assert.equal(docker(['image', 'inspect', api, '--format', '{{.Config.User}}']), 'node');
  const image = JSON.parse(docker(['image', 'inspect', api]))[0];
  const encoderImage = JSON.parse(docker(['image', 'inspect', encoder]))[0];
  docker(['network', 'create', '--internal', network]);
  created.network = true;
  for (const seconds of durations) {
    for (const layout of ['unixfs-files-v1', 'rendition-pack-v1']) {
      const volume = `${label}-${seconds}-${layout}`;
      docker(['volume', 'create', volume]);
      created.volumes.push(volume);
      // Provision this new empty synthetic volume only. No host mount or old state.
      docker([
        'run',
        '--rm',
        '--name',
        named('setup'),
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
      const worker = named('encoder');
      docker([
        'run',
        '-d',
        '--name',
        worker,
        '--network',
        network,
        '--network-alias',
        'encoder.internal',
        ...limits(512),
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
        "import assert from 'node:assert/strict';import {existsSync} from 'node:fs';assert.equal(process.getuid(),1000);assert(!existsSync('/app/dist')&&!existsSync('/app/node_modules')&&!existsSync('/app/services/keyVault.js'));for(const key of ['MNEMONIC','CONTENT_KEY_MASTER_SECRET','CONTENT_KEY_MASTER_SECRETS','DATABASE_URL','PINATA_JWT'])assert(!process.env[key]);"
      ]);
      const client = named('controller');
      console.error(`Generated ${seconds}s / ${layout}: encode, encrypt, build and authenticate`);
      const report = JSON.parse(
        docker(
          [
            'run',
            '--name',
            client,
            '--network',
            network,
            ...limits(1024),
            '--user=1000:1000',
            '--mount',
            `type=volume,source=${volume},target=/state`,
            '-e',
            `STREAMING_WORKER_TOKEN=${token}`,
            '-e',
            `DOTIFY_RESOURCE_SECONDS=${seconds}`,
            '-e',
            `DOTIFY_RESOURCE_LAYOUT=${layout}`,
            '--entrypoint=node',
            '-i',
            api,
            '--input-type=module'
          ],
          { input: controller, timeout: 10 * 60_000 }
        )
      );
      assert.equal(report.schema, 'dotify.generated-bulletin-resource-controller.v1');
      assert.equal(report.syntheticOnly, true);
      assert.equal(report.layout, layout);
      assert.equal(report.seconds, seconds);
      assert.equal(report.networkStores, 0);
      const clientState = inspect(client);
      assert.equal(clientState.State.ExitCode, 0);
      assert.equal(clientState.HostConfig.NanoCpus, 1_000_000_000);
      assert.equal(clientState.HostConfig.MemorySwap, clientState.HostConfig.Memory);
      assert.equal(clientState.HostConfig.PidsLimit, 64);
      const encoderPeak = Number(docker(['exec', worker, 'cat', '/sys/fs/cgroup/memory.peak']));
      const encoderLimit = Number(docker(['exec', worker, 'cat', '/sys/fs/cgroup/memory.max']));
      const encoderEvents = Object.fromEntries(
        docker(['exec', worker, 'cat', '/sys/fs/cgroup/memory.events'])
          .split('\n')
          .map(line => line.split(/\s+/).map((value, i) => (i ? Number(value) : value)))
      );
      assert.equal(encoderLimit, 512 * 1024 * 1024);
      assert.ok(Number.isSafeInteger(encoderPeak) && encoderPeak > 0 && encoderPeak <= encoderLimit);
      assert.equal(encoderEvents.oom, 0);
      assert.equal(encoderEvents.oom_kill, 0);
      assert.equal(inspect(worker).State.Running, true);
      rows.push({ ...report, encoderCgroup: { observedPeakBytes: encoderPeak, limitBytes: encoderLimit, events: encoderEvents } });
      // Fresh worker/cgroup for every profile; no cumulative cross-case peak.
      docker(['rm', '-f', worker]);
    }
  }
  console.log(
    JSON.stringify({
      schema: 'dotify.generated-bulletin-resource-envelope.v1',
      implementation,
      platform: { os: image.Os, architecture: image.Architecture, node: docker(['run', '--rm', '--network=none', '--entrypoint=node', api, '--version']) },
      images: { api: image.Id, encoder: encoderImage.Id },
      encoderBuild: docker(['run', '--rm', '--network=none', '--entrypoint=head', encoder, '-n', '1', '/usr/share/dotify-encoder/build.txt']),
      cases: rows,
      hostedCapacityTested: false,
      serviceEntrypointTested: false,
      physicalFirstSoundTested: false,
      productionTouched: false
    })
  );
} catch (error) {
  // Retain bounded numeric observations even if a large case fails. Never put
  // arbitrary process errors or generated source/key bytes in the artifact.
  const states = [];
  for (const name of created.containers) {
    const state = spawnSync('docker', ['inspect', '--format', '{{json .State}}', name], { encoding: 'utf8' });
    if (state.status === 0) {
      const parsed = JSON.parse(state.stdout);
      states.push({ running: parsed.Running, oomKilled: parsed.OOMKilled, exitCode: parsed.ExitCode });
    }
  }
  console.log(
    JSON.stringify({
      schema: 'dotify.generated-bulletin-resource-envelope.v1',
      implementation,
      status: 'failed',
      cases: rows,
      states,
      productionTouched: false
    })
  );
  throw error;
} finally {
  // A killed Docker CLI can leave a container running. Never delete its volume
  // until all this rehearsal's named containers are known to be gone.
  let failed = false;
  for (const name of created.containers.reverse()) {
    const result = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    if (result.status !== 0 && !result.stderr?.includes('No such container')) failed = true;
  }
  if (failed) throw new Error('Generated cleanup refused: retained synthetic volumes for inspection');
  for (const volume of created.volumes) docker(['volume', 'rm', volume]);
  if (created.network) docker(['network', 'rm', network]);
  for (const image of created.images.reverse()) docker(['image', 'rm', image]);
}
