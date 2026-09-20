import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  EXPECTED_PRODUCT_DEVNET,
  buildProductDevnetJourneyReport,
  evaluateProductCdmSmokeEvidence,
  extractProductAppVersion,
  gitCommit,
  parseEnvFile
} from './product-devnet-journey-harness.mjs';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const RUNTIME = '0x2222222222222222222222222222222222222222';
const PRODUCT_PUBLIC_KEY = `0x${'33'.repeat(32)}`;
const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const TX_HASH = `0x${'cd'.repeat(32)}`;
const CANDIDATE_SHA = '1234567890abcdef1234567890abcdef12345678';
const DEPLOYED_CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';
const OTHER_DEPLOYED_CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2C19Rhdm9zYgC5xA7a7H';
const APP_VERSION = '[0, 1, 20]';

function lockfile() {
  return {
    packages: {
      'node_modules/@parity/product-sdk': { version: EXPECTED_PRODUCT_DEVNET.productSdk },
      'node_modules/@parity/product-sdk-host': { version: EXPECTED_PRODUCT_DEVNET.productSdkHost },
      'node_modules/@parity/product-sdk-descriptors': { version: EXPECTED_PRODUCT_DEVNET.productSdkDescriptors },
      'node_modules/@parity/product-sdk-statement-store': { version: EXPECTED_PRODUCT_DEVNET.productSdkStatementStore }
    }
  };
}

function staticSnapshot(patch = {}) {
  return {
    env: {
      VITE_DOTIFY_DEPLOYMENT: 'production',
      VITE_DOTIFY_HOST_MODE: 'required',
      VITE_DOTIFY_PRODUCT_ID: EXPECTED_PRODUCT_DEVNET.productId,
      VITE_PUBLIC_APP_URL: EXPECTED_PRODUCT_DEVNET.publicAppUrl,
      VITE_SIGNAL_URL: 'https://dotify-signal.fly.dev',
      VITE_DOTIFY_API_URL: 'https://dotify-api.fly.dev',
      VITE_ETH_RPC_URL: 'https://eth-rpc-testnet.polkadot.io/',
      VITE_PINATA_GATEWAY: 'https://gateway.pinata.cloud',
      VITE_IPFS_READ_GATEWAYS: 'https://ipfs.io,https://devnet-ipfs.api.polkadotcommunity.foundation',
      VITE_PINATA_JWT: '',
      VITE_CONTENT_SECRET: ''
    },
    webPackageJson: {
      scripts: {
        'deploy:product-devnet': `npx --yes --package @polkadot-community-foundation/polkadot-app-deploy@${EXPECTED_PRODUCT_DEVNET.productDeployCli} pad`
      }
    },
    webPackageLock: lockfile(),
    deployments: {
      directory: '0x4e883827d61e573094c7b777bae323070ea9f954',
      factory: '0x835a626a9a6965b197d079ae56b1ec94033c2699'
    },
    contractsCdm: { registry: EXPECTED_PRODUCT_DEVNET.cdmRegistry },
    generatedCdm: {
      contracts: {
        '@dotify/artist-directory': { address: '0x4e883827D61e573094C7b777bAe323070Ea9f954' },
        '@dotify/artist-runtime-factory': { address: '0x835A626A9a6965b197D079aE56b1eC94033C2699' }
      }
    },
    productDeployConfigText: "export default { domain: 'dotify-test01.dot', executables: [{ appVersion: [0, 1, 20] }] };",
    runtimeAdapterConfigText: "const PRODUCT_ENVIRONMENTS = ['devnet'] as const;",
    apiFlyTomlText:
      'API_ORIGINS = "https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot"',
    signalFlyTomlText:
      'SIGNAL_ORIGINS = "https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot"',
    ...patch
  };
}

function completeSmokeEvidence() {
  return {
    schemaVersion: 2,
    capturedAt: '2026-09-13T10:00:00.000Z',
    candidate: { gitSha: CANDIDATE_SHA, productAppVersion: APP_VERSION, deployedCid: DEPLOYED_CID },
    summary: { tone: 'ok', label: 'Evidence complete', problemCount: 0 },
    context: {
      buildSha: CANDIDATE_SHA,
      productAppVersion: APP_VERSION,
      deployedCid: DEPLOYED_CID,
      productId: EXPECTED_PRODUCT_DEVNET.productId,
      publicAppUrl: EXPECTED_PRODUCT_DEVNET.publicAppUrl,
      cdmRegistry: EXPECTED_PRODUCT_DEVNET.cdmRegistry,
      productHostMode: 'required',
      productHostStatus: 'available',
      runtimeAdapterKind: 'product-cdm',
      walletMethod: 'product-host',
      listenerAddress: ADDRESS,
      substrateAddress: '5ProductAccount',
      productPublicKey: PRODUCT_PUBLIC_KEY,
      expectedChainId: EXPECTED_PRODUCT_DEVNET.chainId,
      apiConfigured: true
    },
    checks: [
      ['product-account', 'Product account'],
      ['product-cdm-adapter', 'Runtime adapter'],
      ['host-approval', 'Host approval'],
      ['native-value', 'Native value'],
      ['payment-readback', 'Payment read-back'],
      ['backend-key', 'Backend key release'],
      ['same-identity', 'Same identity']
    ].map(([id, label]) => ({ id, label, tone: 'ok', detail: `${label} ok.` })),
    events: [
      {
        kind: 'operator-observation',
        observation: 'host-approval-explicit',
        ok: true,
        timestamp: 500
      },
      {
        kind: 'payment',
        txHash: TX_HASH,
        runtimeAddress: RUNTIME,
        contentHash: CONTENT_HASH,
        listenerAddress: ADDRESS,
        amountPlanck: '250000000000',
        hasPaid: true,
        canAccess: true,
        attempts: 2,
        ok: true,
        error: null,
        timestamp: 1_000
      },
      {
        kind: 'key',
        phase: 'key-allowed',
        path: 'session',
        signatureScheme: 'product-sr25519-v1',
        address: ADDRESS,
        productPublicKey: PRODUCT_PUBLIC_KEY,
        chainId: EXPECTED_PRODUCT_DEVNET.chainId,
        purpose: 'individual',
        contentHash: CONTENT_HASH,
        access: 'allowed',
        playbackMode: 'full',
        runtime: RUNTIME,
        timestamp: 2_000
      }
    ],
    limitations: []
  };
}

function completeRoomEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    capturedAt: '2026-09-13T10:00:00.000Z',
    candidate: { gitSha: CANDIDATE_SHA, productAppVersion: APP_VERSION, deployedCid: DEPLOYED_CID },
    hostSurface: 'product-desktop',
    hostOrigin: 'polkadot://dotify-test01.dot',
    hostVersion: 'Product Desktop 0.1.0',
    guestOrigin: 'https://muzinga.netlify.app',
    canonicalRoomUrl: `${EXPECTED_PRODUCT_DEVNET.publicAppUrl}/#/rooms/LIVE42`,
    hostSharedCanonicalUrl: true,
    guestAccountConnected: false,
    guestJoined: true,
    guestHeardAudio: true,
    guestInSync: true,
    hostRoomCreated: true,
    hostStreamReady: true,
    hostPeerConnected: true,
    hostListenerCount: 1,
    ...overrides
  };
}

test('parseEnvFile ignores comments and preserves empty values', () => {
  assert.deepEqual(
    parseEnvFile(`
# comment
VITE_DOTIFY_PRODUCT_ID=dotify-test01.dot
VITE_CONTENT_SECRET=
`),
    {
      VITE_DOTIFY_PRODUCT_ID: 'dotify-test01.dot',
      VITE_CONTENT_SECRET: ''
    }
  );
});

test('extractProductAppVersion reads the Product executable tuple', () => {
  assert.deepEqual(extractProductAppVersion('export default { executables: [{ appVersion: [0, 1, 20] }] };'), [0, 1, 20]);
  assert.equal(extractProductAppVersion('export default {}'), null);
});

test('local static gates can pass while missing live host evidence remains blocked', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: null,
    roomEvidence: null,
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.failCount, 0);
  assert.equal(report.summary.blockedCount, 1);
  assert.equal(report.summary.notRunCount, 1);
  assert.equal(report.summary.status, 'blocked');
  assert.equal(
    report.staticGates.every(gate => gate.status === 'pass'),
    true
  );
  assert.equal(report.productSmokeGates[0].id, 'product-cdm-live-unlock');
  assert.equal(report.productSmokeGates[0].status, 'blocked');
});

test('static gates reject a mnemonic expanded into Product deploy arguments', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot({
      webPackageJson: {
        scripts: {
          'deploy:product-devnet': `npx --yes --package @polkadot-community-foundation/polkadot-app-deploy@${EXPECTED_PRODUCT_DEVNET.productDeployCli} pad --mnemonic "$MNEMONIC"`
        }
      }
    }),
    productSmokeEvidence: null,
    roomEvidence: null,
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  const boundary = report.staticGates.find(gate => gate.id === 'deploy-secret-boundary');
  assert.equal(boundary?.status, 'fail');
  assert.match(boundary?.detail ?? '', /must not be expanded/);
});

test('complete Product smoke and room evidence satisfy the live journey gates', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence(),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'pass');
  assert.equal(report.summary.failCount, 0);
  assert.equal(report.summary.blockedCount, 0);
  assert.equal(
    report.productSmokeGates.every(gate => gate.status === 'pass'),
    true
  );
  assert.equal(
    report.roomGates.every(gate => gate.status === 'pass'),
    true
  );
});

test('ok-toned Product smoke checks fail when underlying facts do not match Product DevNet', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: {
      schemaVersion: 2,
      capturedAt: '2026-09-01T10:00:00.000Z',
      candidate: { gitSha: 'old-build', productAppVersion: APP_VERSION, deployedCid: DEPLOYED_CID },
      summary: { tone: 'ok', label: 'Evidence complete', problemCount: 0 },
      context: {
        buildSha: 'old-build',
        productAppVersion: APP_VERSION,
        deployedCid: DEPLOYED_CID,
        productId: 'other-product.dot',
        publicAppUrl: 'https://other-product.dev-dot.li',
        cdmRegistry: EXPECTED_PRODUCT_DEVNET.retiredCdmRegistry,
        productHostMode: 'required',
        productHostStatus: 'unavailable',
        runtimeAdapterKind: 'product-cdm',
        walletMethod: 'product-host',
        listenerAddress: ADDRESS,
        substrateAddress: '5ProductAccount',
        productPublicKey: PRODUCT_PUBLIC_KEY,
        expectedChainId: 1,
        apiConfigured: true
      },
      checks: ['product-account', 'product-cdm-adapter', 'host-approval', 'native-value', 'payment-readback', 'backend-key', 'same-identity'].map(id => ({
        id,
        label: id,
        tone: 'ok',
        detail: 'ok'
      })),
      events: [],
      limitations: []
    },
    roomEvidence: null,
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.productSmokeGates.find(gate => gate.id === 'smoke-captured-at')?.status, 'fail');
  assert.equal(report.productSmokeGates.find(gate => gate.id === 'smoke-build')?.status, 'fail');
  assert.equal(report.productSmokeGates.find(gate => gate.id === 'smoke:product-account')?.status, 'fail');
  assert.equal(report.productSmokeGates.find(gate => gate.id === 'smoke:payment-readback')?.status, 'fail');
});

test('unsafe Product smoke evidence fails instead of persisting secrets', () => {
  const gates = evaluateProductCdmSmokeEvidence({
    ...completeSmokeEvidence(),
    events: [{ ...completeSmokeEvidence().events[0], signature: `0x${'44'.repeat(64)}` }]
  });

  assert.equal(gates.find(gate => gate.id === 'smoke-secrets')?.status, 'fail');
});

test('static gates fail when the tracked Product profile points at the retired CDM registry', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot({ contractsCdm: { registry: EXPECTED_PRODUCT_DEVNET.retiredCdmRegistry } }),
    productSmokeEvidence: null,
    roomEvidence: null,
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.staticGates.find(gate => gate.id === 'cdm-registry')?.status, 'fail');
});

test('static gates fail when the configured HTTPS RPC is not the Product DevNet Asset Hub endpoint', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot({
      env: {
        ...staticSnapshot().env,
        VITE_ETH_RPC_URL: 'https://ethereum-rpc.publicnode.com'
      }
    }),
    productSmokeEvidence: null,
    roomEvidence: null,
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.staticGates.find(gate => gate.id === 'asset-hub-rpc')?.status, 'fail');
});

test('Product evidence rejects a CID-shaped string that is not a valid CID', () => {
  const evidence = completeSmokeEvidence();
  evidence.candidate.deployedCid = 'bafy0000000000000000';
  evidence.context.deployedCid = 'bafy0000000000000000';
  const gates = evaluateProductCdmSmokeEvidence(evidence, {
    commit: CANDIDATE_SHA,
    appVersion: [0, 1, 20],
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(gates.find(gate => gate.id === 'smoke-candidate')?.status, 'fail');
});

test('room evidence fails when its deployed CID differs from the Product payment evidence', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence({
      candidate: { gitSha: CANDIDATE_SHA, productAppVersion: APP_VERSION, deployedCid: OTHER_DEPLOYED_CID }
    }),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'room-candidate')?.status, 'fail');
});

test('Product Desktop room evidence does not satisfy the separate Product Web gateway surface', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence(),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.surfaceMatrix.find(row => row.surface === 'Product Desktop')?.status, 'pass');
  assert.equal(report.surfaceMatrix.find(row => row.surface === 'Product Web gateway')?.status, 'not-run');
});

test('room evidence must name the Product host surface before it can pass', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence({ hostSurface: undefined, hostOrigin: undefined, hostVersion: undefined, guestOrigin: undefined }),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'room-surface')?.status, 'fail');
});

test('room evidence requires timestamped host transport facts and guest sync observation', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence({
      capturedAt: undefined,
      guestInSync: false,
      hostStreamReady: false,
      hostPeerConnected: false,
      hostListenerCount: 0
    }),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'room-captured-at')?.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'host-room-observed')?.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'walletless-browser-guest')?.status, 'fail');
});

test('room evidence rejects secret-bearing fields', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: completeRoomEvidence({ sessionToken: 'should-never-be-exported' }),
    commit: CANDIDATE_SHA,
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.roomGates.find(gate => gate.id === 'room-secrets')?.status, 'fail');
});

test('gitCommit resolves HEAD from linked Git worktrees', () => {
  const root = mkdtempSync(join(tmpdir(), 'dotify-w11-git-'));
  try {
    const repo = join(root, 'repo');
    const worktree = join(root, 'linked-worktree');
    mkdirSync(repo);
    execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
    writeFileSync(join(repo, 'README.md'), 'test\n');
    execFileSync('git', ['add', 'README.md'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Dotify Test', 'commit', '-m', 'init'], { cwd: repo, stdio: 'ignore' });
    const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    execFileSync('git', ['-C', repo, 'worktree', 'add', worktree], { stdio: 'ignore' });

    assert.equal(existsSync(join(worktree, '.git')), true);
    assert.equal(gitCommit(worktree), commit);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
