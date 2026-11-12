#!/usr/bin/env node
// Runs only reviewed, compiled repository revisions on the generated bundle.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rehearseCompiledRollback } from '../src/services/bulletinBinaryRehearsal.fixture.ts';

const [file, digest, candidateRoot, compatibleRoot, pilotRoot, ...extra] = process.argv.slice(2);
assert.ok(!extra.length && [file, candidateRoot, compatibleRoot, pilotRoot].every(path => isAbsolute(path ?? '')));
assert.match(digest ?? '', /^[0-9a-f]{64}$/);
const COMPATIBLE = '61869fb41f91bc69b7430410e4915153af7cc315';
const PILOT = '8d0706548416fe5e17711a5d480def7499776c1a';
function revision(root, expected) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
  const sha = git('rev-parse', 'HEAD');
  assert.match(sha, /^[0-9a-f]{40}$/);
  if (expected) assert.equal(sha, expected, 'Historical checkout differs from the reviewed revision');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Build only clean tracked revisions');
  return sha;
}
const revisions = [revision(candidateRoot), revision(compatibleRoot, COMPATIBLE), revision(pilotRoot, PILOT)];
assert.equal(new Set([candidateRoot, compatibleRoot, pilotRoot]).size, 3, 'Use separate executable checkouts');
const moduleAt = (root, name) => import(pathToFileURL(join(root, 'services/api/dist/services', `${name}.js`)).href);
async function runtime(root, sha, pilot = false) {
  const recover = (await moduleAt(root, 'bulletinPreparedRecovery')).recoverPreparedBulletinJob;
  assert.equal(typeof recover, 'function');
  if (pilot) return { revision: sha, recover, mediaRoot: (await moduleAt(root, 'encryptedMedia')).encryptedMediaCid };
  const parseStreamingReference = (await moduleAt(root, 'streamingReference')).parseStreamingReference;
  return {
    revision: sha,
    recover,
    Queue: (await moduleAt(root, 'streamingJobs')).StreamingJobs,
    readers: {
      parseStreamingReference,
      readBulletinMediaPath: (await moduleAt(root, 'bulletinGraph')).readBulletinMediaPath,
      readAuthenticatedCompactObject: (await moduleAt(root, 'bulletinCompactReader')).readAuthenticatedCompactObject,
      deriveContentKeyBytes: (await moduleAt(root, 'keyVault')).deriveContentKeyBytes,
      ...(await moduleAt(root, 'streamingFormat'))
    }
  };
}
const candidate = await runtime(candidateRoot, revisions[0]);
const compatible = await runtime(compatibleRoot, revisions[1]);
const pilot = await runtime(pilotRoot, revisions[2], true);
console.log(JSON.stringify(await rehearseCompiledRollback(file, digest, candidate, compatible, pilot)));
