// Generated-only baseline capture. Run with the candidate's tsx loader; import
// the pinned Zod 3 checkout's actual schemas and dependencies. No live paths.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const [root, output, ...extra] = process.argv.slice(2);
assert.ok(!extra.length && isAbsolute(root ?? '') && isAbsolute(output ?? ''));
const baseline = '1a6b22d49679a4af4c9156f3229e69c754fcd0be';
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const base = join(root, 'services/api');
assert.equal(createRequire(join(base, 'package.json'))('zod/package.json').version, '3.25.76');
const get = name => import(pathToFileURL(join(base, 'src/services', name + '.ts')));
const { fixture } = await get('bulletinPreparedRecovery.fixture');
const { publisherProfileSchema } = await get('bulletinPublisherProfile');
const { ownerSchema, jobSchema, load } = await get('bulletinMediaState');
const { releaseAdmissionLedgerSchema } = await get('bulletinReleaseAdmission');
const { streamingJobsSchema } = await get('streamingJobState');
const cases = [];
for (const mode of ['pilot', 'standard', 'compact']) {
  const cleanup = [];
  try {
    const c = await fixture({ after: cb => cleanup.push(cb) }, mode, await realpath('/tmp'));
    const capture = async phase => {
      const specs = [
        ['profile', publisherProfileSchema, join(c.root, 'profile.json')],
        ['owner', ownerSchema, join(c.profile.directory, 'owner.json')],
        ['queue', streamingJobsSchema, join(c.queue, 'jobs.json')],
        ['inventory', jobSchema, join(c.profile.directory, `stream-${c.options.jobId}.json`)]
      ];
      if (mode !== 'pilot') specs.push(['admission', releaseAdmissionLedgerSchema, join(c.profile.directory, 'release-admission.json')]);
      for (const [schema, parser, file] of specs) {
        const input = await load(file);
        const canonical = JSON.stringify(parser.parse(input));
        cases.push({ name: `${mode}/${phase}/${schema}`, schema, input, canonicalSha256: createHash('sha256').update(canonical).digest('hex') });
      }
    };
    await capture('prepared');
    c.loseAck = true;
    await assert.rejects(c.execute((await c.inspect()).planSha256));
    await capture('uncertain');
    c.loseAck = false;
    await c.execute((await c.inspect()).planSha256);
    await capture('ready');
  } finally {
    for (const fn of cleanup) await fn();
  }
}
await writeFile(
  output,
  JSON.stringify({ sourceCommit: '1a6b22d49679a4af4c9156f3229e69c754fcd0be', validator: '3.25.76', syntheticOnly: true, cases }, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 }
);
console.log({ cases: cases.length });
