#!/usr/bin/env node
// Generated canaries only. Never copy or inspect a real operator/credential tree.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'dotify-context-rehearsal-'));
const owner = `dotify-context-${randomBytes(10).toString('hex')}`;
const images = [];
const privateFiles = [
  '.data/operator-backup.json',
  '.aws/credentials',
  '.codex/auth.json',
  '.agents/private.txt',
  '.git/config',
  '.npmrc',
  '.env',
  '.env.local',
  'node_modules/private.txt'
];
const publicFiles = ['src/public.txt', 'server/public.mjs', 'shared/public.mjs', 'package.json'];
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10 * 60 * 1000 });
  if (!allowFailure && (result.error || result.status !== 0))
    throw new Error(`Generated Docker context check failed: ${result.error?.message ?? result.stderr}`);
  return result;
}
try {
  for (const [name, directory, dockerfile] of [
    ['api', 'services/api', 'Dockerfile'],
    ['web', 'web', 'Dockerfile.signal']
  ]) {
    const source = join(repo, directory);
    const base = readFileSync(join(source, dockerfile), 'utf8').match(/^FROM (node:\S+)/m)?.[1];
    assert.match(base ?? '', /^node:22\.\d+\.\d+-bookworm-slim@sha256:[a-f0-9]{64}$/);
    const context = join(root, name);
    mkdirSync(context, { mode: 0o700 });
    writeFileSync(join(context, '.dockerignore'), readFileSync(join(source, '.dockerignore')));
    for (const file of [...privateFiles, ...publicFiles]) {
      const path = join(context, file);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, 'PUBLIC SYNTHETIC CONTEXT CANARY — NOT A SECRET\n', { mode: 0o600 });
    }
    const verify = `const fs=require('node:fs');for(const p of ${JSON.stringify(privateFiles)})if(fs.existsSync('/context/'+p))throw Error('Private canary entered ${name} build context: '+p);for(const p of ${JSON.stringify(publicFiles)})if(!fs.existsSync('/context/'+p))throw Error('Public source excluded: '+p);console.log('${name} context privacy verified');`;
    // COPY all transmitted files: a selective application COPY cannot hide a leak.
    writeFileSync(join(context, 'Dockerfile'), `FROM ${base}\nCOPY . /context\nRUN ${JSON.stringify(['node', '-e', verify])}\n`);
    const image = `${owner}:${name}`;
    images.push(image);
    docker(['build', '--pull=false', '--network=none', '--label', `dotify.context-rehearsal=${owner}`, '-t', image, context]);
  }
  console.log(
    JSON.stringify({
      syntheticOnly: true,
      contexts: ['api', 'web'],
      privateCanariesPerContext: privateFiles.length,
      publicSentinelsPerContext: publicFiles.length,
      privateInputsRead: false,
      serviceStarted: false
    })
  );
} finally {
  for (const image of images) {
    const found = docker(['image', 'inspect', '--format', '{{index .Config.Labels "dotify.context-rehearsal"}}', image], true);
    if (found.status === 0 && found.stdout.trim() === owner) docker(['image', 'rm', image], true);
  }
  rmSync(root, { recursive: true, force: true });
}
