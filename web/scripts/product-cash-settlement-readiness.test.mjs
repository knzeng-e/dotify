import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY,
  PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION,
  PRODUCT_CASH_TOPOLOGY,
  buildProductCashSettlementReport,
  packageLockVersion
} from './product-cash-settlement-readiness.mjs';

const PRODUCT_PUBLIC_KEY = `0x${'44'.repeat(32)}`;
const ADDRESS = '0x0e8ce681fb6d8aa53c5302e72b80f654141a0e65';
const WRONG_DERIVED_ADDRESS = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0x2222222222222222222222222222222222222222';
const RUNTIME = '0x3333333333333333333333333333333333333333';
const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const CASH_TX_HASH = `0x${'cd'.repeat(32)}`;
const ENTITLEMENT_TX_HASH = `0x${'12'.repeat(32)}`;
const ENTITLEMENT_BLOCK_HASH = `0x${'34'.repeat(32)}`;
const BLOCK_HASH = `0x${'ef'.repeat(32)}`;

function staticSnapshot(patch = {}) {
  return {
    webPackageLock: {
      packages: {
        'node_modules/@parity/product-sdk': { version: '0.27.0' },
        'node_modules/@parity/product-sdk-host': { version: '0.19.1' }
      }
    },
    paymentModelText: "type Cash = { rail: 'product-cash'; status: 'unsupported' };",
    runtimePortsText:
      'import type { ExecutableTrackAccessPaymentIntent } from "../payments/paymentModel"; payForAccess(intent: ExecutableTrackAccessPaymentIntent): Promise<Hash>;',
    productArchitectureText: 'Dotify must not silently convert CASH to native runtime value or mark access paid without runtime evidence.',
    ...patch
  };
}

function completeEvidence(patch = {}) {
  const quote = {
    quoteId: 'quote-001',
    idempotencyKey: 'dotify-cash-quote-001',
    payerH160: ADDRESS,
    payerProductPublicKey: PRODUCT_PUBLIC_KEY,
    recipient: RECIPIENT,
    runtimeAddress: RUNTIME,
    contentHash: CONTENT_HASH,
    amountAtomic: '2500000',
    cashDecimals: PRODUCT_CASH_TOPOLOGY.cashDecimals,
    peopleAssetId: PRODUCT_CASH_TOPOLOGY.peopleCashAssetId,
    assetHubAssetId: PRODUCT_CASH_TOPOLOGY.assetHubCashAssetId
  };

  const hostPayment = {
    paymentId: 'payment-001',
    quoteId: quote.quoteId,
    status: 'Completed',
    amountAtomic: quote.amountAtomic,
    destination: quote.recipient,
    completedAt: '2026-09-14T10:01:00.000Z'
  };

  return {
    schemaVersion: PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION,
    capturedAt: '2026-09-14T10:00:00.000Z',
    context: {
      productId: PRODUCT_CASH_TOPOLOGY.productId,
      assetHubChainId: PRODUCT_CASH_TOPOLOGY.assetHubChainId,
      peopleParaId: PRODUCT_CASH_TOPOLOGY.peopleParaId,
      cdmRegistry: PRODUCT_CASH_TOPOLOGY.cdmRegistry
    },
    quote,
    hostPayment,
    finality: {
      peopleParaId: PRODUCT_CASH_TOPOLOGY.peopleParaId,
      status: 'finalized',
      blockHash: BLOCK_HASH,
      reorgSafe: true,
      quoteId: quote.quoteId,
      paymentId: hostPayment.paymentId,
      payerH160: quote.payerH160,
      recipient: quote.recipient,
      amountAtomic: quote.amountAtomic,
      peopleAssetId: quote.peopleAssetId,
      transactionHash: CASH_TX_HASH,
      finalizedAt: '2026-09-14T10:02:00.000Z'
    },
    entitlement: {
      status: 'verified',
      runtimeAddress: quote.runtimeAddress,
      contentHash: quote.contentHash,
      listenerAddress: quote.payerH160,
      hasPaid: true,
      canAccess: true,
      finalized: true,
      transactionHash: ENTITLEMENT_TX_HASH,
      blockHash: ENTITLEMENT_BLOCK_HASH,
      issuanceCount: 1,
      quoteId: quote.quoteId,
      paymentId: hostPayment.paymentId,
      cashFinalityBlockHash: BLOCK_HASH,
      cashFinalityTransactionHash: CASH_TX_HASH,
      issuedAt: '2026-09-14T10:03:00.000Z'
    },
    reconciliation: {
      stableReceiptId: hostPayment.paymentId,
      receiptAlreadyUsed: false,
      duplicateRetryCount: 1,
      unreconciledPayment: false
    },
    settlementAuthority: {
      kind: 'product-confirmed-cash-asset-hub-entitlement',
      sourceUrl: 'https://docs.polkadotcommunity.foundation/future-cash-entitlement-proof'
    },
    ...patch
  };
}

function reportFor(evidence, options = {}) {
  return buildProductCashSettlementReport({
    snapshot: staticSnapshot(),
    evidence,
    generatedAt: '2026-09-14T11:00:00.000Z',
    ...options
  });
}

function gate(report, id) {
  return report.gates.find(item => item.id === id);
}

test('packageLockVersion reads exact pinned Product package versions', () => {
  assert.equal(packageLockVersion(staticSnapshot().webPackageLock, '@parity/product-sdk-host'), '0.19.1');
  assert.equal(packageLockVersion(staticSnapshot().webPackageLock, '@missing/pkg'), null);
});

test('local static gates pass while Product CASH remains externally blocked', () => {
  const report = reportFor(null);

  assert.equal(report.summary.status, 'blocked');
  assert.equal(report.summary.failCount, 0);
  assert.equal(gate(report, 'cash-authority').status, 'blocked');
  assert.equal(gate(report, 'cash-authority').detail, PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY);
  assert.equal(
    report.staticGates.every(item => item.status === 'pass'),
    true
  );
});

test('off-chain Host payment completion alone never grants Dotify access', () => {
  const evidence = completeEvidence({ entitlement: undefined, finality: undefined, reconciliation: undefined, settlementAuthority: undefined });
  const report = reportFor(evidence);

  assert.equal(report.summary.status, 'blocked');
  assert.equal(gate(report, 'host-payment:status').status, 'pass');
  assert.equal(gate(report, 'entitlement').status, 'blocked');
  assert.match(gate(report, 'entitlement').detail, /Host payment receipt alone is not access/);
});

test('valid but wrong Product payer mapping fails closed', () => {
  const base = completeEvidence();
  const report = reportFor(
    completeEvidence({
      quote: {
        ...base.quote,
        payerH160: WRONG_DERIVED_ADDRESS
      },
      finality: {
        ...base.finality,
        payerH160: WRONG_DERIVED_ADDRESS
      },
      entitlement: {
        ...base.entitlement,
        listenerAddress: WRONG_DERIVED_ADDRESS
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'quote:payer').status, 'fail');
  assert.match(gate(report, 'quote:payer').detail, /derived 0x0e8ce681fb6d8aa53c5302e72b80f654141a0e65/);
});

test('wrong payer, recipient, asset, and chain evidence fails closed', () => {
  const evidence = completeEvidence({
    context: {
      productId: 'other.dot',
      assetHubChainId: 1,
      peopleParaId: 1502,
      cdmRegistry: '0x59b0245778917af55224e5f8fb55f7f8d452619f'
    },
    quote: {
      ...completeEvidence().quote,
      payerH160: 'not-an-address',
      recipient: 'not-a-recipient',
      cashDecimals: 18,
      peopleAssetId: 2,
      assetHubAssetId: 42
    },
    hostPayment: {
      ...completeEvidence().hostPayment,
      quoteId: 'different-quote',
      destination: ADDRESS,
      amountAtomic: '100'
    },
    finality: {
      ...completeEvidence().finality,
      peopleParaId: 999
    }
  });
  const report = reportFor(evidence);

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'context:product-id').status, 'fail');
  assert.equal(gate(report, 'context:chains').status, 'fail');
  assert.equal(gate(report, 'quote:payer').status, 'fail');
  assert.equal(gate(report, 'quote:recipient').status, 'fail');
  assert.equal(gate(report, 'quote:asset').status, 'fail');
  assert.equal(gate(report, 'host-payment:quote').status, 'fail');
  assert.equal(gate(report, 'host-payment:amount-recipient').status, 'fail');
  assert.equal(gate(report, 'finality:chain').status, 'fail');
});

test('a failed Host payment never becomes access even with claimed entitlement evidence', () => {
  const evidence = completeEvidence({
    hostPayment: {
      ...completeEvidence().hostPayment,
      status: 'Failed'
    }
  });
  const report = reportFor(evidence);

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'host-payment:status').status, 'fail');
});

test('reused receipts and duplicate payment retries are rejected', () => {
  const report = reportFor(
    completeEvidence({
      reconciliation: {
        stableReceiptId: 'payment-001',
        receiptAlreadyUsed: true,
        duplicateRetryCount: 2,
        unreconciledPayment: false
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'reconciliation:replay').status, 'fail');
  assert.equal(gate(report, 'reconciliation:retry').status, 'fail');
});

test('a crash after payment but before entitlement stays unreconciled and blocked', () => {
  const report = reportFor(
    completeEvidence({
      entitlement: undefined,
      reconciliation: {
        stableReceiptId: 'payment-001',
        receiptAlreadyUsed: false,
        duplicateRetryCount: 0,
        unreconciledPayment: true
      }
    })
  );

  assert.equal(report.summary.status, 'blocked');
  assert.equal(gate(report, 'host-payment:status').status, 'pass');
  assert.equal(gate(report, 'entitlement').status, 'blocked');
  assert.equal(gate(report, 'reconciliation:unreconciled').status, 'blocked');
});

test('included or reorg-unsafe payments stay blocked before entitlement', () => {
  const report = reportFor(
    completeEvidence({
      finality: {
        peopleParaId: PRODUCT_CASH_TOPOLOGY.peopleParaId,
        status: 'included',
        blockHash: BLOCK_HASH,
        reorgSafe: false
      },
      entitlement: undefined,
      reconciliation: undefined,
      settlementAuthority: undefined
    })
  );

  assert.equal(report.summary.status, 'blocked');
  assert.equal(gate(report, 'finality:chain').status, 'blocked');
});

test('an unrelated finalized People block cannot prove CASH finality', () => {
  const report = reportFor(
    completeEvidence({
      finality: {
        peopleParaId: PRODUCT_CASH_TOPOLOGY.peopleParaId,
        status: 'finalized',
        blockHash: BLOCK_HASH,
        reorgSafe: true
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'finality:chain').status, 'pass');
  assert.equal(gate(report, 'finality:payment-binding').status, 'fail');
});

test('wrong or repeated runtime entitlement fails instead of issuing access', () => {
  const report = reportFor(
    completeEvidence({
      entitlement: {
        status: 'verified',
        runtimeAddress: RUNTIME,
        contentHash: CONTENT_HASH,
        listenerAddress: RECIPIENT,
        hasPaid: true,
        canAccess: true,
        finalized: true,
        transactionHash: ENTITLEMENT_TX_HASH,
        issuanceCount: 2
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'entitlement:binding').status, 'fail');
  assert.equal(gate(report, 'entitlement:once').status, 'fail');
});

test('pre-existing access cannot satisfy a later CASH receipt', () => {
  const base = completeEvidence();
  const report = reportFor(
    completeEvidence({
      entitlement: {
        status: 'verified',
        runtimeAddress: base.quote.runtimeAddress,
        contentHash: base.quote.contentHash,
        listenerAddress: base.quote.payerH160,
        hasPaid: true,
        canAccess: true,
        finalized: true,
        transactionHash: ENTITLEMENT_TX_HASH,
        blockHash: ENTITLEMENT_BLOCK_HASH,
        issuanceCount: 1,
        issuedAt: '2026-09-14T10:03:00.000Z'
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'entitlement:state').status, 'pass');
  assert.equal(gate(report, 'entitlement:binding').status, 'pass');
  assert.equal(gate(report, 'entitlement:cash-receipt').status, 'fail');
});

test('trusted relay evidence is explicitly refused', () => {
  const report = reportFor(
    completeEvidence({
      settlementAuthority: {
        kind: 'trusted-relay',
        sourceUrl: 'https://example.invalid/relay'
      }
    })
  );

  assert.equal(report.summary.status, 'fail');
  assert.equal(gate(report, 'cash-authority').status, 'fail');
  assert.match(gate(report, 'cash-authority').detail, /Refusing trusted-relay/);
});

test('a perfectly-shaped future bridge still stays blocked in this build', () => {
  const report = reportFor(completeEvidence());

  assert.equal(report.summary.status, 'blocked');
  assert.equal(gate(report, 'cash-authority').status, 'blocked');
  assert.match(gate(report, 'cash-authority').detail, /does not enable a supported Product CASH bridge/);
});
