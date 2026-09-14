#!/usr/bin/env node

// Product CASH settlement readiness harness.
//
// This is deliberately read-only. It validates Dotify's local fail-closed CASH
// boundary and can inspect operator-supplied evidence for a future Product CASH
// bridge, but it never submits a payment and never treats a Host payment status
// alone as a runtime access entitlement.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION = 1;
export const PRODUCT_CASH_DECISION_DATE = '2026-09-14';
export const PRODUCT_CASH_DEVNET_RESET_AT = '2026-09-09T00:00:00.000Z';

export const PRODUCT_CASH_TOPOLOGY = {
  productId: 'dotify-test01.dot',
  assetHubParaId: 1000,
  peopleParaId: 1004,
  bulletinParaId: 1010,
  assetHubChainId: 420420417,
  peopleCashAssetId: 1,
  assetHubCashAssetId: 50000413,
  cashDecimals: 6,
  cdmRegistry: '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f'
};

export const PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY =
  'Product must expose an authoritative CASH settlement or attestation path that binds the payer, recipient, CASH asset, People-chain finality, Asset-Hub runtime entitlement, and stable receipt id.';

const EXPECTED_PRODUCT_PACKAGES = {
  '@parity/product-sdk': '0.27.0',
  '@parity/product-sdk-host': '0.19.1'
};

const RECOGNIZED_AUTHORITY = 'product-confirmed-cash-asset-hub-entitlement';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHexAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isHexHash(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isPositiveIntegerString(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function sameText(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

function parseDateMs(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function gate(gates, status, id, label, detail, source = 'local') {
  gates.push({ id, label, status, detail, source });
}

function pass(gates, id, label, detail, source) {
  gate(gates, 'pass', id, label, detail, source);
}

function fail(gates, id, label, detail, source) {
  gate(gates, 'fail', id, label, detail, source);
}

function blocked(gates, id, label, detail, source) {
  gate(gates, 'blocked', id, label, detail, source);
}

function notRun(gates, id, label, detail, source) {
  gate(gates, 'not-run', id, label, detail, source);
}

export function packageLockVersion(lockfile, packageName) {
  return lockfile?.packages?.[`node_modules/${packageName}`]?.version ?? null;
}

function checkPinnedPackage(gates, lockfile, packageName, expectedVersion) {
  const installed = packageLockVersion(lockfile, packageName);
  if (installed === expectedVersion) {
    pass(gates, `package:${packageName}`, packageName, `Installed ${installed}.`, 'web/package-lock.json');
  } else {
    fail(gates, `package:${packageName}`, packageName, `Expected ${expectedVersion}, found ${installed ?? 'missing'}.`, 'web/package-lock.json');
  }
}

export function evaluateStaticCashBoundary(snapshot) {
  const gates = [];
  const paymentModel = snapshot.paymentModelText ?? '';
  const runtimePorts = snapshot.runtimePortsText ?? '';
  const productDocs = snapshot.productArchitectureText ?? '';

  for (const [packageName, version] of Object.entries(EXPECTED_PRODUCT_PACKAGES)) {
    checkPinnedPackage(gates, snapshot.webPackageLock, packageName, version);
  }

  if (paymentModel.includes("rail: 'product-cash'") && paymentModel.includes("status: 'unsupported'")) {
    pass(gates, 'cash-intent-unsupported', 'CASH intent boundary', 'Product CASH is modeled as an explicit unsupported rail.', 'paymentModel.ts');
  } else {
    fail(
      gates,
      'cash-intent-unsupported',
      'CASH intent boundary',
      'Product CASH must remain explicit and unsupported until W16/W16-follow-up proves settlement.',
      'paymentModel.ts'
    );
  }

  if (runtimePorts.includes('ExecutableTrackAccessPaymentIntent') && runtimePorts.includes('payForAccess(intent: ExecutableTrackAccessPaymentIntent)')) {
    pass(gates, 'cash-not-executable', 'Executable payment rail', 'Runtime writers accept only executable native runtime payment intents.', 'runtimePorts.ts');
  } else {
    fail(gates, 'cash-not-executable', 'Executable payment rail', 'Runtime writers must not accept product-cash intents.', 'runtimePorts.ts');
  }

  const normalizedProductDocs = productDocs.replace(/\s+/g, ' ');
  if (normalizedProductDocs.includes('Dotify must not silently convert CASH to native runtime value or mark access paid without runtime evidence.')) {
    pass(
      gates,
      'cash-doc-boundary',
      'Documented CASH boundary',
      'Product architecture docs state the no-conversion/no-unverified-access rule.',
      'product-devnet-architecture.md'
    );
  } else {
    fail(
      gates,
      'cash-doc-boundary',
      'Documented CASH boundary',
      'Product architecture docs must state the no-conversion/no-unverified-access rule.',
      'product-devnet-architecture.md'
    );
  }

  pass(
    gates,
    'product-cash-topology',
    'Product CASH topology',
    `CASH People asset ${PRODUCT_CASH_TOPOLOGY.peopleCashAssetId}, Asset Hub protected asset ${PRODUCT_CASH_TOPOLOGY.assetHubCashAssetId}, runtime chain ${PRODUCT_CASH_TOPOLOGY.assetHubChainId}.`,
    'official Product docs'
  );

  return gates;
}

export function evaluateProductCashSettlementEvidence(evidence, options = {}) {
  const gates = [];
  const source = options.source ?? 'operator evidence';

  if (!evidence) {
    notRun(gates, 'cash-evidence', 'Live CASH settlement evidence', 'No Product CASH settlement evidence was supplied.', source);
    blocked(gates, 'cash-authority', 'Authoritative CASH entitlement mechanism', PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY, 'official Product APIs');
    return gates;
  }

  if (!isRecord(evidence)) {
    fail(gates, 'cash-evidence-shape', 'Evidence schema', 'Evidence must be a JSON object.', source);
    return gates;
  }

  if (evidence.schemaVersion === PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION) {
    pass(gates, 'schema-version', 'Evidence schema', `schemaVersion ${evidence.schemaVersion}.`, source);
  } else {
    fail(gates, 'schema-version', 'Evidence schema', `Expected schemaVersion ${PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION}.`, source);
  }

  const capturedAtMs = parseDateMs(evidence.capturedAt);
  const resetAtMs = Date.parse(PRODUCT_CASH_DEVNET_RESET_AT);
  if (capturedAtMs !== null && capturedAtMs >= resetAtMs) {
    pass(gates, 'captured-at', 'Capture date', `${evidence.capturedAt} is after the September 2026 Product DevNet reset.`, source);
  } else {
    fail(gates, 'captured-at', 'Capture date', `Evidence must be captured after ${PRODUCT_CASH_DEVNET_RESET_AT}.`, source);
  }

  evaluateContext(gates, evidence.context, source);
  evaluateQuote(gates, evidence.quote, source);
  evaluateHostPayment(gates, evidence.quote, evidence.hostPayment, source);
  evaluateFinality(gates, evidence.finality, source);
  evaluateRuntimeEntitlement(gates, evidence.quote, evidence.entitlement, source);
  evaluateReconciliation(gates, evidence.hostPayment, evidence.entitlement, evidence.reconciliation, source);
  evaluateAuthority(gates, evidence.settlementAuthority, { source });

  return gates;
}

function evaluateContext(gates, context, source) {
  if (!isRecord(context)) {
    fail(gates, 'context', 'Product context', 'Missing context object.', source);
    return;
  }

  if (context.productId === PRODUCT_CASH_TOPOLOGY.productId) {
    pass(gates, 'context:product-id', 'Product ID', context.productId, source);
  } else {
    fail(gates, 'context:product-id', 'Product ID', `Expected ${PRODUCT_CASH_TOPOLOGY.productId}, found ${context.productId ?? 'missing'}.`, source);
  }

  if (context.assetHubChainId === PRODUCT_CASH_TOPOLOGY.assetHubChainId && context.peopleParaId === PRODUCT_CASH_TOPOLOGY.peopleParaId) {
    pass(gates, 'context:chains', 'Chain topology', 'People 1004 CASH settlement and Asset Hub 420420417 runtime entitlement are both named.', source);
  } else {
    fail(gates, 'context:chains', 'Chain topology', 'Expected People para 1004 and Asset Hub EVM chain 420420417.', source);
  }

  if (sameText(context.cdmRegistry, PRODUCT_CASH_TOPOLOGY.cdmRegistry)) {
    pass(gates, 'context:cdm-registry', 'CDM registry', context.cdmRegistry, source);
  } else {
    fail(gates, 'context:cdm-registry', 'CDM registry', `Expected ${PRODUCT_CASH_TOPOLOGY.cdmRegistry}.`, source);
  }
}

function evaluateQuote(gates, quote, source) {
  if (!isRecord(quote)) {
    fail(gates, 'quote', 'Bound quote', 'Missing quote object.', source);
    return;
  }

  if (typeof quote.quoteId === 'string' && quote.quoteId.trim()) {
    pass(gates, 'quote:id', 'Quote id', 'Stable quote id is present.', source);
  } else {
    fail(gates, 'quote:id', 'Quote id', 'Quote must have a stable quoteId.', source);
  }

  if (typeof quote.idempotencyKey === 'string' && quote.idempotencyKey.trim()) {
    pass(gates, 'quote:idempotency', 'Idempotency key', 'Quote carries a retry-safe idempotency key.', source);
  } else {
    fail(gates, 'quote:idempotency', 'Idempotency key', 'Quote must bind retries to a stable idempotency key.', source);
  }

  if (isHexAddress(quote.payerH160) && typeof quote.payerProductPublicKey === 'string' && /^0x[0-9a-fA-F]{64}$/.test(quote.payerProductPublicKey)) {
    pass(gates, 'quote:payer', 'Payer binding', 'Quote binds the Product account public key and derived H160 runtime identity.', source);
  } else {
    fail(gates, 'quote:payer', 'Payer binding', 'Quote must include payerH160 and payerProductPublicKey.', source);
  }

  if (isHexAddress(quote.recipient)) {
    pass(gates, 'quote:recipient', 'Recipient binding', quote.recipient, source);
  } else {
    fail(gates, 'quote:recipient', 'Recipient binding', 'Quote must include the CASH recipient H160 address.', source);
  }

  if (isHexAddress(quote.runtimeAddress) && isHexHash(quote.contentHash)) {
    pass(gates, 'quote:release', 'Runtime release binding', 'Quote binds runtimeAddress and contentHash.', source);
  } else {
    fail(gates, 'quote:release', 'Runtime release binding', 'Quote must bind the exact runtimeAddress and contentHash.', source);
  }

  if (
    isPositiveIntegerString(quote.amountAtomic) &&
    quote.cashDecimals === PRODUCT_CASH_TOPOLOGY.cashDecimals &&
    quote.peopleAssetId === PRODUCT_CASH_TOPOLOGY.peopleCashAssetId &&
    quote.assetHubAssetId === PRODUCT_CASH_TOPOLOGY.assetHubCashAssetId
  ) {
    pass(gates, 'quote:asset', 'CASH asset binding', 'Quote uses CASH decimals 6, People asset 1, and Asset Hub protected asset 50000413.', source);
  } else {
    fail(gates, 'quote:asset', 'CASH asset binding', 'Quote must use CASH decimals 6, People asset 1, and Asset Hub protected asset 50000413.', source);
  }
}

function evaluateHostPayment(gates, quote, hostPayment, source) {
  if (!isRecord(hostPayment)) {
    blocked(gates, 'host-payment', 'Host payment status', 'No Host payment status was supplied.', source);
    return;
  }

  if (isRecord(quote) && hostPayment.quoteId === quote.quoteId) {
    pass(gates, 'host-payment:quote', 'Payment quote binding', 'Host payment references the quote id.', source);
  } else {
    fail(gates, 'host-payment:quote', 'Payment quote binding', 'Host payment must reference the same quoteId.', source);
  }

  if (hostPayment.status === 'Completed') {
    pass(gates, 'host-payment:status', 'Host payment status', 'Host reports Completed.', source);
  } else if (hostPayment.status === 'Processing') {
    blocked(gates, 'host-payment:status', 'Host payment status', 'Host payment is still processing.', source);
  } else {
    fail(gates, 'host-payment:status', 'Host payment status', `Expected Completed, found ${hostPayment.status ?? 'missing'}.`, source);
  }

  if (isRecord(quote) && hostPayment.amountAtomic === quote.amountAtomic && sameText(hostPayment.destination, quote.recipient)) {
    pass(gates, 'host-payment:amount-recipient', 'Amount and recipient', 'Host payment matches the quoted amount and recipient.', source);
  } else {
    fail(gates, 'host-payment:amount-recipient', 'Amount and recipient', 'Host payment must match quote amountAtomic and recipient.', source);
  }
}

function evaluateFinality(gates, finality, source) {
  if (!isRecord(finality)) {
    blocked(gates, 'finality', 'People-chain finality', 'Missing finality evidence for the CASH movement.', source);
    return;
  }

  if (finality.peopleParaId !== PRODUCT_CASH_TOPOLOGY.peopleParaId) {
    fail(gates, 'finality:chain', 'Finality chain', 'Finality must be observed on People para 1004.', source);
  } else if (finality.status === 'finalized' && isHexHash(finality.blockHash) && finality.reorgSafe === true) {
    pass(gates, 'finality:chain', 'Finality chain', 'People-chain CASH settlement is finalized and reorg-safe.', source);
  } else if (finality.status === 'included' || finality.status === 'pending') {
    blocked(gates, 'finality:chain', 'Finality chain', 'Payment is not finalized yet; do not grant runtime access.', source);
  } else {
    fail(gates, 'finality:chain', 'Finality chain', 'Finality evidence must include finalized status, blockHash, and reorgSafe=true.', source);
  }
}

function evaluateRuntimeEntitlement(gates, quote, entitlement, source) {
  if (!isRecord(entitlement)) {
    blocked(gates, 'entitlement', 'Asset Hub runtime entitlement', 'Missing runtime entitlement evidence. A Host payment receipt alone is not access.', source);
    return;
  }

  if (entitlement.status === 'verified' && entitlement.hasPaid === true && entitlement.canAccess === true && entitlement.finalized === true) {
    pass(gates, 'entitlement:state', 'Runtime access state', 'Runtime read-back reports paid and playable access after a finalized entitlement write.', source);
  } else {
    fail(gates, 'entitlement:state', 'Runtime access state', 'Entitlement must be finalized and read back hasPaid=true plus canAccess=true.', source);
  }

  if (
    isRecord(quote) &&
    sameText(entitlement.runtimeAddress, quote.runtimeAddress) &&
    sameText(entitlement.contentHash, quote.contentHash) &&
    sameText(entitlement.listenerAddress, quote.payerH160)
  ) {
    pass(gates, 'entitlement:binding', 'Runtime entitlement binding', 'Entitlement matches the quoted runtime, content hash, and payer identity.', source);
  } else {
    fail(gates, 'entitlement:binding', 'Runtime entitlement binding', 'Entitlement must match quote runtimeAddress, contentHash, and payerH160.', source);
  }

  if (entitlement.issuanceCount === 1) {
    pass(gates, 'entitlement:once', 'Exactly-once entitlement', 'Exactly one runtime entitlement was issued for the receipt.', source);
  } else {
    fail(gates, 'entitlement:once', 'Exactly-once entitlement', 'Expected issuanceCount=1.', source);
  }
}

function evaluateReconciliation(gates, hostPayment, entitlement, reconciliation, source) {
  if (!isRecord(reconciliation)) {
    blocked(gates, 'reconciliation', 'Reconciliation and replay prevention', 'Missing reconciliation evidence.', source);
    return;
  }

  const receiptId = reconciliation.stableReceiptId;
  if (typeof receiptId === 'string' && receiptId.trim() && (!isRecord(hostPayment) || receiptId === hostPayment.paymentId)) {
    pass(gates, 'reconciliation:receipt-id', 'Stable receipt id', 'Stable receipt id is recorded and matches the Host payment id when present.', source);
  } else {
    fail(gates, 'reconciliation:receipt-id', 'Stable receipt id', 'stableReceiptId must be present and match hostPayment.paymentId.', source);
  }

  if (reconciliation.receiptAlreadyUsed === false) {
    pass(gates, 'reconciliation:replay', 'Receipt replay', 'Receipt is not marked as previously used.', source);
  } else {
    fail(gates, 'reconciliation:replay', 'Receipt replay', 'Reused CASH receipts must be rejected.', source);
  }

  if (isNonNegativeInteger(reconciliation.duplicateRetryCount) && reconciliation.duplicateRetryCount <= 1) {
    pass(gates, 'reconciliation:retry', 'Duplicate retry safety', 'Retries are idempotent and did not create duplicate payments.', source);
  } else {
    fail(gates, 'reconciliation:retry', 'Duplicate retry safety', 'duplicateRetryCount must be 0 or 1; repeated submissions must not charge twice.', source);
  }

  if (reconciliation.unreconciledPayment === false && (!isRecord(entitlement) || entitlement.issuanceCount === 1)) {
    pass(gates, 'reconciliation:unreconciled', 'Unreconciled payment', 'No unreconciled payment remains in the evidence.', source);
  } else {
    blocked(
      gates,
      'reconciliation:unreconciled',
      'Unreconciled payment',
      'Payment remains unreconciled; support/refund responsibility must be handled before access is claimed.',
      source
    );
  }
}

function evaluateAuthority(gates, authority, options) {
  if (!isRecord(authority)) {
    blocked(gates, 'cash-authority', 'Authoritative CASH entitlement mechanism', PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY, 'official Product APIs');
    return;
  }

  if (authority.kind === 'trusted-relay' || authority.kind === 'operator-attestation') {
    fail(
      gates,
      'cash-authority',
      'Authoritative CASH entitlement mechanism',
      `Refusing ${authority.kind}: W16 does not allow a trusted relay to masquerade as Product-supported settlement.`,
      options.source
    );
    return;
  }

  if (authority.kind !== RECOGNIZED_AUTHORITY) {
    blocked(gates, 'cash-authority', 'Authoritative CASH entitlement mechanism', PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY, options.source);
    return;
  }

  blocked(
    gates,
    'cash-authority',
    'Authoritative CASH entitlement mechanism',
    'Evidence names the required future authority shape, but this Dotify build does not enable a supported Product CASH bridge.',
    options.source
  );
}

export function summarizeGates(gates) {
  const summary = {
    passCount: gates.filter(item => item.status === 'pass').length,
    failCount: gates.filter(item => item.status === 'fail').length,
    blockedCount: gates.filter(item => item.status === 'blocked').length,
    notRunCount: gates.filter(item => item.status === 'not-run').length,
    status: 'pass'
  };
  if (summary.failCount > 0) summary.status = 'fail';
  else if (summary.blockedCount > 0) summary.status = 'blocked';
  else if (summary.notRunCount > 0) summary.status = 'not-run';
  return summary;
}

export function buildProductCashSettlementReport(input = {}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const staticGates = evaluateStaticCashBoundary(input.snapshot ?? readLocalSnapshot(input.rootDir));
  const evidenceGates = evaluateProductCashSettlementEvidence(input.evidence ?? null, {
    source: input.evidenceSource
  });
  const gates = [...staticGates, ...evidenceGates];
  const summary = summarizeGates(gates);

  return {
    schemaVersion: PRODUCT_CASH_SETTLEMENT_SCHEMA_VERSION,
    generatedAt,
    decisionDate: PRODUCT_CASH_DECISION_DATE,
    summary,
    topology: PRODUCT_CASH_TOPOLOGY,
    externalDependency: PRODUCT_CASH_SETTLEMENT_EXTERNAL_DEPENDENCY,
    staticGates,
    evidenceGates,
    gates,
    result:
      summary.status === 'pass' ? 'cash-settlement-supported' : summary.status === 'fail' ? 'cash-settlement-evidence-invalid' : 'cash-settlement-unavailable'
  };
}

export function renderMarkdownReport(report) {
  const rows = report.gates.map(item => `| ${item.status} | ${item.id} | ${item.label} | ${escapePipes(item.detail)} | ${item.source} |`).join('\n');

  return `# Product CASH settlement readiness

- Generated: ${report.generatedAt}
- Decision date: ${report.decisionDate}
- Result: ${report.result}
- Summary: ${report.summary.passCount} pass / ${report.summary.failCount} fail / ${report.summary.blockedCount} blocked / ${report.summary.notRunCount} not-run
- External dependency: ${report.externalDependency}

## Topology

- Product ID: \`${report.topology.productId}\`
- Asset Hub para: \`${report.topology.assetHubParaId}\`
- People para: \`${report.topology.peopleParaId}\`
- Asset Hub EVM chain ID: \`${report.topology.assetHubChainId}\`
- CASH on People: asset \`${report.topology.peopleCashAssetId}\`
- CASH on Asset Hub: protected asset \`${report.topology.assetHubCashAssetId}\`
- CDM registry: \`${report.topology.cdmRegistry}\`

## Gates

| Status | ID | Gate | Detail | Source |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function escapePipes(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

export function readLocalSnapshot(rootDir = repoRoot()) {
  return {
    webPackageLock: readJsonIfExists(resolve(rootDir, 'web/package-lock.json')),
    paymentModelText: readTextIfExists(resolve(rootDir, 'web/src/features/payments/paymentModel.ts')),
    runtimePortsText: readTextIfExists(resolve(rootDir, 'web/src/features/runtime/runtimePorts.ts')),
    productArchitectureText: readTextIfExists(resolve(rootDir, 'docs/explanation/product-devnet-architecture.md'))
  };
}

export function gitCommit(rootDir = repoRoot()) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readRequiredJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseArgs(argv) {
  const args = { rootDir: repoRoot(), evidence: null, jsonOut: null, mdOut: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evidence') args.evidence = argv[++index] ?? null;
    else if (arg === '--json-out') args.jsonOut = argv[++index] ?? null;
    else if (arg === '--md-out') args.mdOut = argv[++index] ?? null;
    else if (arg === '--root') args.rootDir = argv[++index] ?? args.rootDir;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage: node scripts/product-cash-settlement-readiness.mjs [--evidence evidence.json] [--json-out report.json] [--md-out report.md]

Without --evidence, the harness validates the local fail-closed CASH boundary
and reports the Product CASH settlement rail as blocked on external Product
support. It never signs or submits transactions.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const evidencePath = args.evidence ? resolve(args.evidence) : null;
  const evidence = evidencePath ? readRequiredJson(evidencePath, 'Evidence') : null;
  const report = buildProductCashSettlementReport({
    rootDir: args.rootDir,
    evidence,
    evidenceSource: evidencePath ?? undefined
  });

  if (args.jsonOut) {
    writeFileSync(resolve(args.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (args.mdOut) {
    writeFileSync(resolve(args.mdOut), renderMarkdownReport(report));
  }

  console.log(renderMarkdownReport(report));

  if (report.summary.failCount > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
