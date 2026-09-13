import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPECTED_PRODUCT_DEVNET,
  buildProductDevnetJourneyReport,
  evaluateProductCdmSmokeEvidence,
  extractProductAppVersion,
  parseEnvFile
} from './product-devnet-journey-harness.mjs';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const RUNTIME = '0x2222222222222222222222222222222222222222';
const PRODUCT_PUBLIC_KEY = `0x${'33'.repeat(32)}`;
const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const TX_HASH = `0x${'cd'.repeat(32)}`;

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
    productDeployConfigText: "export default { domain: 'dotify-test01.dot', executables: [{ appVersion: [0, 1, 17] }] };",
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
    schemaVersion: 1,
    capturedAt: '2026-09-13T10:00:00.000Z',
    summary: { tone: 'ok', label: 'Evidence complete', problemCount: 0 },
    context: {
      productId: EXPECTED_PRODUCT_DEVNET.productId,
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
      }
    ],
    limitations: []
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
  assert.deepEqual(extractProductAppVersion('export default { executables: [{ appVersion: [0, 1, 17] }] };'), [0, 1, 17]);
  assert.equal(extractProductAppVersion('export default {}'), null);
});

test('local static gates can pass while missing live host evidence remains blocked', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: null,
    roomEvidence: null,
    commit: 'abc123',
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

test('complete Product smoke and room evidence satisfy the live journey gates', () => {
  const report = buildProductDevnetJourneyReport({
    snapshot: staticSnapshot(),
    productSmokeEvidence: completeSmokeEvidence(),
    roomEvidence: {
      schemaVersion: 1,
      canonicalRoomUrl: `${EXPECTED_PRODUCT_DEVNET.publicAppUrl}/#/rooms/LIVE42`,
      hostSharedCanonicalUrl: true,
      guestAccountConnected: false,
      guestJoined: true,
      guestHeardAudio: true
    },
    commit: 'abc123',
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
    commit: 'abc123',
    generatedAt: '2026-09-13T10:00:00.000Z'
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.staticGates.find(gate => gate.id === 'cdm-registry')?.status, 'fail');
});
