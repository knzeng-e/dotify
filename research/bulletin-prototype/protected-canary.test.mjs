import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readFile, writeFile, chmod, symlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { Socket } from 'node:net';
import { prepareProtected, loadProtected, backupProtected, privateBytes, IDENTITY, PRIOR_RESERVE } from './protected-package.mjs';
import {
  parseProtectedArgs,
  packageState,
  preservePriorReserve,
  checkProtected,
  backupMatches,
  runProtected,
  reviewedProtectedSource,
  protectedFailureCategory
} from './protected-operator.mjs';
import { createBulletinMediaStore } from '../../services/api/src/services/bulletinMedia.ts';
import { SimulatedChain } from './simulated-chain.mjs';
import { StreamingNonceLedger } from '../../services/api/src/services/streamingNonces.ts';
import { deriveContentKeyBytes } from '../../services/api/src/services/keyVault.ts';
import { parseStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';
const implementation = 'a'.repeat(40);
const signal = () => new AbortController().signal;

test('failure categories preserve a useful bounded reason without provider or signer payloads', () => {
  assert.equal(protectedFailureCategory(new DOMException('secret payload', 'TimeoutError')), 'deadline exceeded');
  assert.equal(protectedFailureCategory(new Error('Finality deadline exceeded; submission outcome is unknown')), 'deadline exceeded');
  assert.equal(protectedFailureCategory(new DOMException('secret payload', 'AbortError')), 'cancelled');
  assert.equal(protectedFailureCategory({ code: 'ERR_ASSERTION', message: 'secret payload' }), 'validation failed');
  assert.equal(protectedFailureCategory(new Error('secret payload')), 'unclassified failure');
  assert.equal(protectedFailureCategory(null), 'unclassified failure');
});

// All network behavior in this file is an explicit model. The executable launcher
// is exercised separately below, with inherited fake credentials as tripwires.
test('generated protected package: immutable custody, exact allowance and fresh-instance lost-ack recovery', { timeout: 120_000 }, async t => {
  t.mock.method(Socket.prototype, 'connect', () => {
    throw new Error('Network forbidden');
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden');
  });
  assert.equal(process.env.MNEMONIC, undefined);
  assert.equal(process.env.CONTENT_KEY_MASTER_SECRET, undefined);
  const parent = await mkdtemp(join(tmpdir(), 'dotify-protected-package-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const directory = join(parent, 'package'),
    backup = join(parent, 'backup');
  const prepared = await prepareProtected(directory, { implementation });
  const loaded = await loadProtected(directory),
    { plan, graph, files } = loaded;
  assert.equal(loaded.digest, prepared.digest);
  assert.equal(plan.send.maxStores, graph.blocks.length);
  assert.equal(plan.send.maxBytes, graph.bytes);
  assert.equal(plan.budget.maxTransactions, graph.blocks.length * 2);
  assert.deepEqual(plan.priorReserve, PRIOR_RESERVE);
  const secret = await readFile(join(directory, 'custody-secret.bin'));
  const key = deriveContentKeyBytes(plan.scope, {
    contentKeyMasterSecret: secret.toString('hex'),
    contentKeyMasterSecrets: '',
    contentKeyActiveVersion: plan.scope.keyVersion,
    chainId: plan.scope.chainId
  });
  const publicReview = await readFile(join(directory, 'REVIEW.md'), 'utf8');
  for (const bytes of [secret, key]) {
    for (const repr of [bytes.toString('hex'), bytes.toString('base64')]) {
      assert.ok(!publicReview.includes(repr));
      assert.ok(!JSON.stringify(plan).includes(repr));
      assert.ok(
        files.every(f => !f.bytes.includes(Buffer.from(repr))),
        'No key serialization in uploaded files'
      );
    }
  }
  assert.ok(publicReview.includes(String(graph.bytes)) && publicReview.includes(prepared.digest));
  await assert.rejects(prepareProtected(directory, { implementation }), { code: 'EEXIST' });
  assert.deepEqual(await packageState(directory, plan), {
    owner: { schema: 'dotify.bulletin.media-owner.v2', ...IDENTITY, nextNonce: null, activeJob: null, jobs: [] },
    inventory: null
  });
  await backupProtected(directory, backup);
  await assert.rejects(loadProtected(backup), /inspection-only/);
  await backupMatches(backup, loaded);
  const backupOwner = join(backup, 'publications', 'owner.json'),
    savedOwner = await readFile(backupOwner);
  await writeFile(backupOwner, '{}');
  await assert.rejects(backupMatches(backup, loaded), /checksums/);
  await writeFile(backupOwner, savedOwner);
  const incomplete = join(parent, 'interrupted-snapshot');
  await mkdir(incomplete, { mode: 0o700 });
  await writeFile(join(incomplete, 'BACKUP_ONLY'), 'incomplete', { mode: 0o600 });
  await assert.rejects(loadProtected(incomplete), /inspection-only/);

  await assert.rejects(backupProtected(directory, join(directory, 'nested-backup')), /outside/);
  const recovered = await loadProtected(backup, { allowBackup: true });
  assert.equal(recovered.digest, prepared.digest);
  const tripwire = 'fake-secret-that-must-not-enter-child-config';
  const isolated = spawnSync(process.execPath, [new URL('./protected-canary.mjs', import.meta.url).pathname, 'plan', directory], {
    cwd: parent,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, MNEMONIC: tripwire, CONTENT_KEY_MASTER_SECRET: tripwire, DATABASE_URL: tripwire }
  });
  assert.equal(isolated.status, 0, isolated.stderr);
  assert.equal(JSON.parse(isolated.stdout).digest, loaded.digest);
  assert.ok(!`${isolated.stdout}${isolated.stderr}`.includes(tripwire));
  const oldMarker = process.env.DOTIFY_PROTECTED_OPERATOR;
  process.env.DOTIFY_PROTECTED_OPERATOR = 'isolated';
  try {
    await assert.rejects(
      runProtected(['publish', directory, '--approval', '0'.repeat(64), '--backup', backup, '--exclusive-account', '--signer-fd', '3']),
      /Approval digest/
    );
  } finally {
    if (oldMarker === undefined) delete process.env.DOTIFY_PROTECTED_OPERATOR;
    else process.env.DOTIFY_PROTECTED_OPERATOR = oldMarker;
  }

  assert.ok((await readFile(join(backup, 'custody-secret.bin'))).equals(secret));
  // Restored permanent nonce ledger cannot reissue the original generation.
  const ledger = new StreamingNonceLedger(join(backup, 'nonces'), () => Buffer.from(plan.generation, 'hex'));
  await assert.rejects(ledger.reserve(key), /exhausted/);
  // Authenticate AND decode the actual three-rendition encoder outputs.
  const manifest = parseStreamingManifest(files.find(f => f.path === 'manifest.json').bytes);
  for (const rendition of manifest.renditions) {
    const parts = [rendition.init, ...rendition.segments].map(o => decryptStreamingObject(files.find(f => f.path === o.path).bytes, key, manifest, o));
    const media = join(parent, `${rendition.bitrateKbps}.mp4`);
    await writeFile(media, Buffer.concat(parts), { mode: 0o600 });
    parts.forEach(p => p.fill(0));
    const decode = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-i', media, '-f', 'null', '-'], {
      timeout: 30_000,
      env: { PATH: process.env.PATH }
    });
    assert.equal(decode.status, 0, 'Actual generated AAC frames must decode');
  }
  key.fill(0);
  secret.fill(0);

  const chain = new SimulatedChain();
  Object.assign(chain, IDENTITY);
  chain.authorization.remainingTransactions = 1000;
  chain.authorization.remainingBytes = 50 * 1024 * 1024;
  chain.authorization.remainingRenewBytes = 50 * 1024 * 1024;
  const submissions = new Map();
  let nonce = 10;
  chain.nextNonce = async () => ({ nonce, head: chain.head });
  chain.lookupSubmission = async ({ nonce }) => submissions.get(nonce) ?? null;
  const modelStore = chain.store.bind(chain);
  let loseAck = true;
  chain.store = async (block, intent) => {
    chain.advance(1);
    const receipt = { ...(await modelStore(block)), account: chain.account, nonce: intent.nonce };
    submissions.set(intent.nonce, receipt);
    while (submissions.has(nonce)) nonce++;
    if (loseAck && chain.stores.length === 2) throw new Error('Lost acknowledgement');
    return receipt;
  };
  const options = { directory: join(directory, 'publications'), identity: plan.identity, budget: plan.budget, pipeline: plan.pipeline };
  let transport = preservePriorReserve(chain, plan);
  const before = await checkProtected(transport, loaded, directory, signal());
  assert.equal(before.finalizedNonce, 10);
  await assert.rejects(createBulletinMediaStore({ ...options, transport }).pin(files, plan.job, signal()), /Lost acknowledgement/);
  const failed = await packageState(directory, plan);
  assert.ok(Object.keys(failed.inventory.pending).length);
  await assert.rejects(backupProtected(directory, join(parent, 'bad-backup')), /unresolved/);
  // A new read-only transport resolves the exact pending nonce without sending
  // the remaining graph. A fresh writer then continues the identical ciphertext.
  const readonly = {
    ...transport,
    writable: false,
    store() {
      throw new Error('Read-only reconciliation attempted a write');
    }
  };
  await assert.rejects(createBulletinMediaStore({ ...options, transport: readonly }).pin(files, plan.job, signal()), /read-only/);
  assert.equal(Object.keys((await packageState(directory, plan)).inventory.pending).length, 0);
  const previousMarker = process.env.DOTIFY_PROTECTED_OPERATOR;
  process.env.DOTIFY_PROTECTED_OPERATOR = 'isolated';
  try {
    const partial = await runProtected(['reconcile', directory, '--exclusive-account'], {
      openSession(_plan, signer = null) {
        assert.equal(signer, null);
        return { transport: readonly, close() {}, attemptedTransactions: 0 };
      }
    });
    assert.equal(partial.partial, true);
    assert.equal(partial.ready, false);
    assert.equal(partial.pending, 0);
    assert.equal(partial.sessionStores, 0);
    assert.equal(JSON.parse(await readFile(join(directory, 'observation-reconcile.json'), 'utf8')).partial, true);
  } finally {
    if (previousMarker === undefined) delete process.env.DOTIFY_PROTECTED_OPERATOR;
    else process.env.DOTIFY_PROTECTED_OPERATOR = previousMarker;
  }
  loseAck = false;
  await createBulletinMediaStore({ ...options, transport }).pin((await loadProtected(directory)).files, plan.job, signal());
  assert.equal(chain.stores.length, graph.blocks.length);
  assert.equal(new Set(chain.stores).size, graph.blocks.length);
  const final = await packageState(directory, plan);
  assert.equal(final.inventory.ready, true);
  assert.equal(final.owner.activeJob, null);
  assert.equal(chain.renewals.length, 0);
  await t.test('actual read-only operator persists exact u64 quota counters after reconciliation', async () => {
    const savedBytes = chain.authorization.remainingBytes;
    chain.authorization.remainingBytes = 9007199254740993n;
    const oldMarker = process.env.DOTIFY_PROTECTED_OPERATOR;
    process.env.DOTIFY_PROTECTED_OPERATOR = 'isolated';
    let closed = 0,
      opened = 0;
    try {
      const report = await runProtected(['reconcile', directory, '--exclusive-account'], {
        openSession(selected, signer = null) {
          assert.equal(selected.root, plan.root);
          assert.equal(signer, null);
          opened++;
          return {
            transport: readonly,
            close() {
              closed++;
            },
            attemptedTransactions: 0
          };
        }
      });
      const persisted = JSON.parse(await readFile(join(directory, 'observation-reconcile.json'), 'utf8'));
      assert.deepEqual(persisted, report);
      assert.equal(persisted.before.authorization.remainingBytes, '9007199254740993');
      assert.equal(typeof persisted.before.authorization.remainingRenewBytes, 'string');
      assert.equal(typeof persisted.before.finalizedNonce, 'number');
      assert.equal(persisted.ready, true);
      assert.equal(persisted.sessionStores, 0);
      assert.equal(chain.stores.length, graph.blocks.length);
      assert.equal(opened, 1);
      assert.equal(closed, 1);
    } finally {
      chain.authorization.remainingBytes = savedBytes;
      if (oldMarker === undefined) delete process.env.DOTIFY_PROTECTED_OPERATOR;
      else process.env.DOTIFY_PROTECTED_OPERATOR = oldMarker;
    }
  });
  await createBulletinMediaStore({ ...options, transport: readonly }).pin(files, plan.job, signal());
  assert.equal(chain.stores.length, graph.blocks.length, 'Re-audit sends no stores');

  await t.test('prior duties and insufficient quotas fail before submission', async () => {
    const stores = chain.stores.length;
    chain.authorization.remainingTransactions = PRIOR_RESERVE.transactions - 1;
    await assert.rejects(checkProtected(preservePriorReserve(chain, plan), loaded, directory, signal()), /Previous lab/);
    chain.authorization.remainingTransactions = PRIOR_RESERVE.transactions + plan.reserve.transactions - 1;
    await assert.rejects(checkProtected(preservePriorReserve(chain, plan), loaded, directory, signal()), /Quota/);
    chain.authorization.remainingTransactions = 1000;
    chain.authorization.remainingRenewBytes = PRIOR_RESERVE.bytes - 1;
    await assert.rejects(checkProtected(preservePriorReserve(chain, plan), loaded, directory, signal()), /Previous lab/);
    assert.equal(chain.stores.length, stores);
  });
  await t.test('plan/nonce/key tampering and unsafe files fail closed', async () => {
    const planPath = join(directory, 'plan.json'),
      original = await readFile(planPath);
    const changed = JSON.parse(original);
    changed.send.maxStores++;
    await writeFile(planPath, JSON.stringify(changed));
    await assert.rejects(loadProtected(directory), /changed/);
    await writeFile(planPath, original);
    const ledger = join(directory, 'nonces', 'ledger.json'),
      oldLedger = await readFile(ledger);
    await writeFile(ledger, '{}');
    await assert.rejects(loadProtected(directory), /changed/);
    await writeFile(ledger, oldLedger);
    const keyPath = join(directory, 'custody-secret.bin'),
      oldKey = await readFile(keyPath);
    await writeFile(keyPath, Buffer.alloc(32));
    await assert.rejects(loadProtected(directory));
    await writeFile(keyPath, oldKey);
    oldKey.fill(0);
    await chmod(keyPath, 0o644);
    await assert.rejects(loadProtected(directory), /Unsafe/);
    await chmod(keyPath, 0o600);
    await symlink(keyPath, join(parent, 'secret-link'));
    await assert.rejects(privateBytes(join(parent, 'secret-link')));
    await rm(join(directory, 'publications', `${plan.job}.json`));
    await assert.rejects(packageState(directory, plan), { code: 'ENOENT' });
  });
});

test('operator parser rejects signer use on reads, ambiguous flags and missing approval/backup/exclusivity', () => {
  for (const command of ['prepare', 'plan', 'backup', 'check', 'reconcile']) {
    assert.throws(() => parseProtectedArgs([command, '/tmp/example', '--signer-fd', '3']));
    assert.throws(() => parseProtectedArgs([command, '/tmp/example', '--source-approval', 'b'.repeat(40)]));
  }
  for (const flags of [
    [],
    ['--approval', 'a'.repeat(64)],
    ['--approval', 'a'.repeat(64), '--backup', '/tmp/backup', '--exclusive-account', '--signer-fd', '0'],
    ['--exclusive-account', '--exclusive-account']
  ])
    assert.throws(() => parseProtectedArgs(['publish', '/tmp/example', ...flags]));
  assert.equal(
    parseProtectedArgs(['publish', '/tmp/example', '--approval', 'a'.repeat(64), '--backup', '/tmp/backup', '--exclusive-account', '--signer-fd', '3']).command,
    'publish'
  );
  assert.equal(parseProtectedArgs(['reconcile', '/tmp/example', '--exclusive-account']).command, 'reconcile');
  const publish = ['publish', '/tmp/example', '--approval', 'a'.repeat(64), '--backup', '/tmp/backup', '--exclusive-account', '--signer-fd', '3'];
  assert.equal(parseProtectedArgs([...publish, '--source-approval', 'b'.repeat(40)]).options['--source-approval'], 'b'.repeat(40));
  assert.throws(() => parseProtectedArgs([...publish, '--source-approval', 'HEAD']));
  assert.throws(() => parseProtectedArgs([...publish, '--source-approval', 'b'.repeat(40), '--source-approval', 'b'.repeat(40)]));
});

test('a source repair requires an exact separately approved descendant without changing artifact custody', async t => {
  const repository = await mkdtemp(join(tmpdir(), 'dotify-source-approval-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  const git = args =>
    execFileSync('git', ['-C', repository, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: repository, GIT_CONFIG_NOSYSTEM: '1' }
    }).trim();
  git(['init']);
  git(['config', 'user.name', 'Offline source test']);
  git(['config', 'user.email', 'offline@example.invalid']);
  await mkdir(join(repository, 'research/bulletin-prototype'), { recursive: true });
  const source = join(repository, 'research/bulletin-prototype/operator.mjs');
  await writeFile(source, 'original');
  git(['add', '.']);
  git(['commit', '-m', 'original artifact source']);
  const original = git(['rev-parse', 'HEAD']);
  assert.equal(reviewedProtectedSource(original, undefined, { repository }), original);
  await writeFile(source, 'reviewed repair');
  git(['add', '.']);
  git(['commit', '-m', 'repair']);
  const repaired = git(['rev-parse', 'HEAD']);
  assert.throws(() => reviewedProtectedSource(original, undefined, { repository }), 'Old approval cannot select changed code');
  assert.equal(reviewedProtectedSource(original, repaired, { repository }), repaired);
  git(['tag', '-a', 'not-a-commit-object', '-m', 'tag object']);
  assert.throws(() => reviewedProtectedSource(original, git(['rev-parse', 'not-a-commit-object']), { repository }), /identify a commit/);
  assert.throws(() => reviewedProtectedSource(repaired, original, { repository }), 'Execution source cannot precede the artifact');
  await writeFile(source, 'unreviewed edit');
  assert.throws(() => reviewedProtectedSource(original, repaired, { repository }));
  await writeFile(source, 'reviewed repair');
  await writeFile(join(repository, 'research/bulletin-prototype/untracked.mjs'), 'unreviewed');
  assert.throws(() => reviewedProtectedSource(original, repaired, { repository }));
  await rm(join(repository, 'research/bulletin-prototype/untracked.mjs'));
  await writeFile(join(repository, 'review.md'), 'Documentation-only successor');
  git(['add', '.']);
  git(['commit', '-m', 'evidence']);
  assert.equal(reviewedProtectedSource(original, repaired, { repository }), repaired);
  git(['checkout', '--orphan', 'unrelated']);
  git(['rm', '-rf', '.']);
  await writeFile(join(repository, 'other.txt'), 'unrelated');
  git(['add', '.']);
  git(['commit', '-m', 'unrelated source']);
  assert.throws(() => reviewedProtectedSource(original, git(['rev-parse', 'HEAD']), { repository }));
});

test('isolating launcher rejects read-side FD and emits no inherited fake credentials', () => {
  const tripwire = 'do-not-echo-this-fake-deployment-secret';
  const run = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), new URL('./protected-canary.mjs', import.meta.url).pathname, 'plan', '/does-not-exist', '--signer-fd', '3'],
    { encoding: 'utf8', env: { PATH: process.env.PATH, MNEMONIC: tripwire, CONTENT_KEY_MASTER_SECRET: tripwire } }
  );
  assert.equal(run.status, 1);
  assert.ok(!`${run.stdout}${run.stderr}`.includes(tripwire));
});
