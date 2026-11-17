import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArguments } from './pipeline-canary.mjs';
import { withAccountLease } from './operator-lease.mjs';
import { planPipeline } from './pipeline-plan.mjs';
import { buildDirectory } from './graph.mjs';

test('CLI is opt-in for exclusive signing and refuses hidden signers or permissive bounds', () => {
  assert.equal(parseArguments(['plan', 'fixture']).concurrency, 2);
  assert.equal(parseArguments(['publish', 'fixture', '--signer-fd', '3', '--exclusive-account']).signerFd, 3);
  for (const argv of [
    [],
    ['publish', 'fixture'],
    ['publish', 'fixture', '--signer-fd', '3'],
    ['check', 'fixture', '--signer-fd', '3'],
    ['reconcile', 'fixture', '--exclusive-account'],
    ['plan', 'fixture', '--concurrency', '5'],
    ['publish', 'fixture', '--exclusive-account', '--signer-fd', '0'],
    ['plan', 'fixture', '--concurrency', '2', '--concurrency', '3'],
    ['plan', 'fixture', '--secret', 'anything']
  ])
    assert.throws(() => parseArguments(argv));
});

test('account lease coordinates this operator across fixtures, releases normally and refuses loose directories', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-account-lock-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  await withAccountLease(
    async () => {
      await assert.rejects(
        withAccountLease(() => assert.fail('Another writer must not start'), { parent }),
        /EEXIST/
      );
    },
    { parent }
  );
  assert.equal(await withAccountLease(async () => 42, { parent }), 42);
  const [name] = await readdir(parent);
  await chmod(join(parent, name), 0o755);
  await assert.rejects(
    withAccountLease(() => assert.fail('Unsafe directory'), { parent }),
    /private directory/
  );
});

test('offline scheduling plan counts bounded dependency waves without claiming latency or writes', async () => {
  const graph = await buildDirectory(Array.from({ length: 8 }, (_, i) => ({ path: `a/${i}.bin`, bytes: Buffer.alloc(1000 + i, i + 1) })));
  const serial = await planPipeline(graph, { concurrency: 1 }),
    parallel = await planPipeline(graph, { concurrency: 2 });
  assert.equal(serial.modeledFinalityWaves, graph.blocks.length);
  assert.ok(parallel.modeledFinalityWaves < serial.modeledFinalityWaves);
  assert.ok(parallel.waves.every(w => w.cids.length <= 2 && w.bytes <= 512 * 1024));
  assert.deepEqual(parallel.waves.at(-1).cids, [graph.root]);
  assert.equal(parallel.networkWrites, 0);
});
