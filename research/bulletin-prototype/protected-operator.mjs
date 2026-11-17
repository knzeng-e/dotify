// Child of the credential-isolating launcher. Network and signer are explicit.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import WebSocket from 'ws';
import { createPapiMediaTransport } from './media-transport.mjs';
import { withAccountLease } from './operator-lease.mjs';
import { localSigner, withLease } from './canary.mjs';
import { loadProtected, prepareProtected, backupProtected, privateBytes, snapshotChecksums, IDENTITY } from './protected-package.mjs';
import { createBulletinMediaStore } from '../../services/api/src/services/bulletinMedia.ts';
import { load, save, ownerSchema, jobSchema } from '../../services/api/src/services/bulletinMediaState.ts';

export const RPC_MESSAGE_MAX = 20 * 1024 * 1024; // 8-MiB SCALE body represented as hex, plus JSON/header overhead
export class BoundedWebSocket extends WebSocket {
  constructor(url) {
    super(url, {
      maxPayload: RPC_MESSAGE_MAX,
      perMessageDeflate: false,
      followRedirects: false,
      handshakeTimeout: 10_000,
      maxFragments: 1024,
      maxBufferedChunks: 4096
    });
  }
}
let stage = 'argument validation';
export const protectedStage = () => stage;
export function protectedFailureCategory(error) {
  if (error?.name === 'TimeoutError' || error?.message === 'Finality deadline exceeded; submission outcome is unknown') return 'deadline exceeded';
  if (error?.name === 'AbortError') return 'cancelled';
  if (error?.code === 'ERR_ASSERTION') return 'validation failed';
  return 'unclassified failure';
}
const repo = fileURLToPath(new URL('../../', import.meta.url));
const git = (args, repository = repo) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const codePaths = ['research/bulletin-prototype', 'services/api/src', 'services/api/package.json', 'services/api/package-lock.json'];
function cleanCode(implementation, repository = repo) {
  git(['diff', '--exit-code', 'HEAD', '--', ...codePaths], repository);
  assert.equal(git(['ls-files', '--others', '--exclude-standard', '--', ...codePaths], repository), '', 'Commit operator code before preparing a package');
  if (implementation) {
    git(['merge-base', '--is-ancestor', implementation, 'HEAD'], repository);
    git(['diff', '--exit-code', implementation, 'HEAD', '--', ...codePaths], repository);
  }
  return git(['rev-parse', 'HEAD'], repository);
}
export function reviewedProtectedSource(artifactImplementation, executionApproval = artifactImplementation, { repository = repo } = {}) {
  assert.match(artifactImplementation, /^[0-9a-f]{40}$/);
  assert.match(executionApproval, /^[0-9a-f]{40}$/);
  assert.equal(git(['cat-file', '-t', executionApproval], repository), 'commit', 'Source approval must identify a commit');
  // A repaired operator needs separate owner review. Never rewrite the immutable
  // artifact plan or infer code approval from its previously approved byte budget.
  git(['merge-base', '--is-ancestor', artifactImplementation, executionApproval], repository);
  cleanCode(executionApproval, repository);
  return executionApproval;
}
export function parseProtectedArgs(argv) {
  const [command, input, ...args] = argv;
  assert.ok(
    ['prepare', 'plan', 'backup', 'check', 'reconcile', 'publish'].includes(command) && input,
    'Expected prepare|plan|backup|check|reconcile|publish PRIVATE_DIRECTORY'
  );
  const expected =
    command === 'publish'
      ? ['--approval', '--backup', '--exclusive-account', '--signer-fd']
      : command === 'backup'
        ? ['--destination', '--exclusive-account']
        : command === 'reconcile'
          ? ['--exclusive-account']
          : [];
  const optional = command === 'publish' ? ['--source-approval'] : [];
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    assert.ok([...expected, ...optional].includes(name) && !(name in options), 'Unexpected or duplicate operator flag');
    if (name === '--exclusive-account') options[name] = true;
    else {
      assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing operator flag value');
      options[name] = args[++i];
    }
  }
  assert.deepEqual(
    Object.keys(options)
      .filter(name => !optional.includes(name))
      .sort(),
    [...expected].sort(),
    'Required explicit operator flags are missing'
  );
  if (command === 'publish') {
    assert.match(options['--approval'], /^[0-9a-f]{64}$/);
    if (options['--source-approval']) assert.match(options['--source-approval'], /^[0-9a-f]{40}$/);
    assert.ok(
      /^[0-9]+$/.test(options['--signer-fd']) &&
        Number.isSafeInteger(Number(options['--signer-fd'])) &&
        Number(options['--signer-fd']) >= 3 &&
        Number(options['--signer-fd']) <= 64,
      'Signer must enter through an explicit descriptor 3..64'
    );
  }
  return { command, directory: resolve(input), options };
}
export async function packageState(directory, plan) {
  const stateDirectory = join(directory, 'publications');
  const owner = ownerSchema.parse(await load(join(stateDirectory, 'owner.json')));
  assert.equal(owner.genesis, plan.identity.genesis);
  assert.equal(owner.account, plan.identity.account);
  assert.ok(owner.jobs.length <= 1 && owner.jobs.every(j => j === plan.job), 'Unexpected package ownership');
  assert.ok(owner.activeJob === null || owner.activeJob === plan.job, 'Another job owns account');
  let inventory = null;
  try {
    inventory = jobSchema.parse(await load(join(stateDirectory, `${plan.job}.json`)));
  } catch (e) {
    if (e.code !== 'ENOENT' || owner.jobs.includes(plan.job) || owner.activeJob) throw e;
  }
  if (inventory) {
    assert.ok(owner.jobs.includes(plan.job), 'Orphan publication inventory');
    for (const field of ['job', 'root', 'scope', 'generation', 'budget', 'pipeline', 'blocks'])
      assert.deepEqual(inventory[field], plan[field], 'Publication differs from reviewed plan');
    assert.equal(inventory.genesis, plan.identity.genesis);
    assert.equal(inventory.account, plan.identity.account);
    assert.ok(inventory.nextNonce === null || (owner.nextNonce !== null && inventory.nextNonce <= owner.nextNonce), 'Account cursor is behind its job');
    if (owner.activeJob) assert.equal(inventory.nextNonce, owner.nextNonce, 'Publication cursors require manual reconciliation');
  }
  return { owner, inventory };
}
export function preservePriorReserve(transport, plan) {
  return {
    genesis: transport.genesis,
    account: transport.account,
    writable: transport.writable,
    nextNonce: (...args) => transport.nextNonce(...args),
    lookup: (...args) => transport.lookup(...args),
    readBlock: (...args) => transport.readBlock(...args),
    lookupSubmission: (...args) => transport.lookupSubmission(...args),
    store: (...args) => transport.store(...args),
    async status(signal) {
      const status = await transport.status(signal),
        a = status.authorization;
      assert.ok(
        a.remainingTransactions >= plan.priorReserve.transactions && BigInt(a.remainingRenewBytes) >= BigInt(plan.priorReserve.bytes),
        'Previous lab renewal reserve is unavailable'
      );
      return {
        ...status,
        authorization: {
          ...a,
          remainingTransactions: a.remainingTransactions - plan.priorReserve.transactions,
          remainingRenewBytes: BigInt(a.remainingRenewBytes) - BigInt(plan.priorReserve.bytes)
        }
      };
    }
  };
}
export async function checkProtected(transport, loaded, directory, signal) {
  assert.equal(transport.genesis, loaded.plan.identity.genesis);
  assert.equal(transport.account, loaded.plan.identity.account);
  const state = await packageState(directory, loaded.plan);
  const status = await transport.status(signal),
    nonce = await transport.nextNonce(signal);
  assert.ok(status.authorization.expiresAt > Math.max(status.head, nonce.head) + loaded.plan.budget.minimumLifetimeBlocks, 'Storage authorization is expiring');
  const remaining = loaded.plan.send.maxStores - (state.inventory?.attemptedStores ?? 0);
  assert.ok(remaining >= 0, 'Attempt budget exceeded');
  assert.ok(
    status.authorization.remainingTransactions >= remaining + loaded.plan.reserve.transactions &&
      BigInt(status.authorization.remainingBytes) >= BigInt(loaded.plan.send.maxBytes - (state.inventory?.attemptedBytes ?? 0)) &&
      BigInt(status.authorization.remainingRenewBytes) >= BigInt(loaded.plan.reserve.bytes),
    'Quota does not cover stores and renewal reserves'
  );
  // An active account can have unresolved broadcasts; only reconcile may decide
  // whether its exact intents settled. Never clear a barrier here.
  if (!state.owner.activeJob && state.owner.nextNonce !== null) assert.ok(nonce.nonce >= state.owner.nextNonce, 'Finalized nonce went backwards');
  return {
    head: status.head,
    finalizedNonce: nonce.nonce,
    authorization: status.authorization,
    activeJob: state.owner.activeJob,
    pending: Object.keys(state.inventory?.pending ?? {}).length
  };
}
export async function backupMatches(path, loaded) {
  const backup = await loadProtected(path, { allowBackup: true });
  assert.equal(backup.digest, loaded.digest, 'Backup belongs to another package');
  const marker = JSON.parse(await privateBytes(join(path, 'SNAPSHOT.json'), 64 * 1024));
  assert.equal(marker.schema, 'dotify.bulletin.custody-snapshot.v1');
  assert.equal(marker.digest, loaded.digest);
  assert.equal((await privateBytes(join(path, 'BACKUP_ONLY'), 128)).toString(), 'Inspection-only custody snapshot; never a writer directory.');
  assert.deepEqual(await snapshotChecksums(path), marker.checksums, 'Backup inventory differs from its checksums');
}

function sessionFor(plan, signer = null) {
  const client = createClient(getWsProvider(plan.endpoint, { websocketClass: BoundedWebSocket }));
  return createPapiMediaTransport({ client, identity: plan.identity, signer, budget: { maxBytes: plan.send.maxBytes, maxTransactions: plan.send.maxStores } });
}
export async function persistProtectedObservation(directory, command, report) {
  assert.ok(['publish', 'reconcile'].includes(command), 'Invalid observation command');
  // RPC allowances are u64 BigInts. Keep their decimal precision without
  // changing the strict numeric nonce/receipt schemas in custody journals.
  const serializable = JSON.parse(JSON.stringify(report, (_, value) => (typeof value === 'bigint' ? value.toString() : value)));
  await save(directory, `observation-${command}.json`, serializable);
  return serializable;
}
export async function runProtected(argv, { openSession = sessionFor } = {}) {
  assert.equal(process.env.DOTIFY_PROTECTED_OPERATOR, 'isolated', 'Use the credential-isolating protected-canary.mjs launcher');
  const { command, directory, options } = parseProtectedArgs(argv);
  if (command === 'prepare') {
    stage = 'local preparation';
    return prepareProtected(directory, { implementation: cleanCode() });
  }
  stage = 'private package validation';
  const loaded = await loadProtected(directory),
    { plan, digest } = loaded;
  let executionApproval;
  if (command === 'plan') {
    await packageState(directory, plan);
    return { digest, plan };
  }
  if (command === 'publish') {
    assert.equal(options['--approval'], digest, 'Approval digest differs from the exact reviewed package');
    stage = 'reviewed source validation';
    executionApproval = reviewedProtectedSource(plan.implementation, options['--source-approval']);
    stage = 'backup validation';
    await backupMatches(resolve(options['--backup']), loaded);
  }
  stage = 'exclusive operator leases';
  return withAccountLease(() =>
    withLease(directory, async () => {
      if (command === 'backup') {
        stage = 'quiescent custody backup';
        await packageState(directory, plan);
        return backupProtected(directory, resolve(options['--destination']));
      }
      const controller = new AbortController(),
        abort = () => controller.abort(new Error('Operator interrupted; reconcile before retry'));
      process.once('SIGINT', abort);
      process.once('SIGTERM', abort);
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)]);
      let session;
      const start = performance.now();
      try {
        stage = 'network and quota preflight';
        session = openSession(plan);
        assert.equal(session.transport.writable, false, 'Preflight requires a read-only session');
        let transport = preservePriorReserve(session.transport, plan);
        const before = await checkProtected(transport, loaded, directory, signal);
        if (command === 'check') return { digest, before, signerUsed: false, stores: 0 };
        if (command === 'publish') {
          // Only now read the explicit FD, after package/backup/network/quota checks.
          assert.equal(before.pending, 0, 'Reconcile pending broadcasts before opening a signer');
          session.close();
          stage = 'local signer identity';
          const createTransaction = localSigner(Number(options['--signer-fd']));
          session = openSession(plan, { account: IDENTITY.account, createTransaction });
          assert.equal(session.transport.writable, true, 'Publish requires an explicit writer session');
          transport = preservePriorReserve(session.transport, plan);
        }
        const storage = createBulletinMediaStore({
          directory: join(directory, 'publications'),
          identity: plan.identity,
          transport,
          budget: plan.budget,
          pipeline: plan.pipeline
        });
        stage = 'publication or receipt reconciliation';
        let partial = false;
        try {
          await storage.pin(loaded.files, plan.job, signal);
        } catch (e) {
          if (command === 'reconcile' && e.message === 'Bulletin transport is read-only') partial = true;
          else throw e;
        }
        const inventory = await storage.inventory(plan.job);
        const report = {
          schema: 'dotify.bulletin.protected-observation.v1',
          digest,
          command,
          artifactImplementation: plan.implementation,
          ...(executionApproval ? { executionApproval } : {}),
          observedAt: new Date().toISOString(),
          root: plan.root,
          ready: inventory.ready,
          partial,
          pending: Object.keys(inventory.pending).length,
          receipts: Object.keys(inventory.receipts).length,
          attemptedStores: inventory.attemptedStores,
          attemptedBytes: inventory.attemptedBytes,
          sessionStores: session.attemptedTransactions,
          elapsedMs: Math.round(performance.now() - start),
          maxRssKiB: process.resourceUsage().maxRSS,
          before,
          physicalPlaybackTested: false,
          productionAccessTested: false,
          renewalsSubmitted: 0
        };
        stage = 'observation persistence';
        return persistProtectedObservation(directory, command, report);
      } finally {
        session?.close();
        process.removeListener('SIGINT', abort);
        process.removeListener('SIGTERM', abort);
      }
    })
  );
}
