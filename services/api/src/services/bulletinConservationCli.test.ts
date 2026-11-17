import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, rpcFixture } from './bulletinTransport.fixture.js';
import { readBulletinConservation } from './bulletinConservationRpc.js';
const run = promisify(execFile);
const script = new URL('../scripts/checkBulletinConservation.ts', import.meta.url).pathname;
const canary = 'synthetic-signing-environment-must-never-be-read-or-printed';
async function invoke(args: string[]) {
  try {
    const result = await run(process.execPath, ['--import', 'tsx', script, ...args], { timeout: 10_000, env: { ...process.env, MNEMONIC: canary } });
    return { ...result, code: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout), stderr: String(error.stderr), code: error.code };
  }
}
test('offline operator contract: green/warning/critical/incomplete exits and private input boundaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-conservation-cli-'));
  const plan = {
    schema: 'dotify.bulletin.conservation-plan.v1',
    identity: fixture.identity,
    retainedReserve: { transactions: 1, bytes: '117' },
    warningBlocks: 500,
    criticalBlocks: 100,
    sources: [{ id: 'diagnostic:marker', kind: 'diagnostic', root: fixture.query.cid, blocks: [{ cid: fixture.query.cid, bytes: 117 }] }]
  };
  const planFile = join(directory, 'plan.json'),
    snapshotFile = join(directory, 'snapshot.json');
  const state = await readBulletinConservation(plan, rpcFixture().request, new AbortController().signal);
  const save = (file: string, value: unknown) => writeFile(file, JSON.stringify(value), { mode: 0o600 });
  try {
    await save(planFile, plan);
    await save(snapshotFile, state);
    const result = await invoke(['--snapshot', planFile, snapshotFile]);
    assert.equal(result.code, 0);
    assert.equal(JSON.parse(result.stdout).writes, 0);
    state.authorization!.expiresAt = state.head + 300;
    await save(snapshotFile, state);
    assert.equal((await invoke(['--snapshot', planFile, snapshotFile])).code, 2);
    state.authorization!.expiresAt = state.head;
    await save(snapshotFile, state);
    assert.equal((await invoke(['--snapshot', planFile, snapshotFile])).code, 3);
    await chmod(snapshotFile, 0o644);
    const insecure = await invoke(['--snapshot', planFile, snapshotFile]);
    assert.equal(insecure.code, 1);
    assert.equal(insecure.stdout, '');
    await chmod(snapshotFile, 0o600);
    await symlink(snapshotFile, join(directory, 'link.json'));
    assert.equal((await invoke(['--snapshot', planFile, join(directory, 'link.json')])).code, 1);
    const invalid = await invoke([planFile, 'wss://user:private-provider-secret@example.invalid']);
    assert.equal(invalid.code, 1);
    assert.equal(invalid.stdout, '');
    assert.ok(![result, insecure, invalid].some(r => (r.stdout + r.stderr).includes(canary) || (r.stdout + r.stderr).includes('private-provider-secret')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
