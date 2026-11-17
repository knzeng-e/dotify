import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { measureSignaling } from './signaling.mjs';
import { measureSfu } from './sfu.mjs';
const image = 'redis:7.4-alpine@sha256:6ba19c50b56777f5c11c58eff8ddb69d0d5f27ba131cffb63f180ccfd43c66af';
const prefix = `w39-${randomBytes(6).toString('hex')}`;
const docker = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 }).trim();
const startedAt = new Date().toISOString();
let redisStarted = false;
try {
  docker(['run', '--rm', '-d', '--name', prefix, '-p', '127.0.0.1::6379', image, 'redis-server', '--save', '', '--appendonly', 'no']);
  redisStarted = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if (docker(['exec', prefix, 'redis-cli', 'ping']) === 'PONG') {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  if (!ready) throw Error('Redis readiness timeout');
  const port = docker(['port', prefix, '6379/tcp']).split(':').at(-1);
  const signaling = await measureSignaling({
    redisUrl: `redis://127.0.0.1:${port}`,
    prefix,
    pauseRedis: async paused => {
      docker([paused ? 'pause' : 'unpause', prefix]);
    }
  });
  console.log('Signaling prototype verified');
  const sfu = process.argv.includes('--signaling-only') ? { state: 'not-run' } : await measureSfu();
  const result = {
    schema: 'dotify.room-scaling-research.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: { node: process.version, platform: process.platform, arch: process.arch, redisImage: image },
    scope: 'Local synthetic research; not production, native Product or audible-device evidence',
    signaling,
    sfu
  };
  const out = resolve(process.env.W39_OUTPUT ?? 'results.json');
  await writeFile(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (redisStarted) {
    try {
      if (docker(['inspect', '--format', '{{.State.Paused}}', prefix]) === 'true') docker(['unpause', prefix]);
    } catch {}
    try {
      docker(['rm', '-f', prefix]);
    } catch {}
  }
}
