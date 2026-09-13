#!/usr/bin/env node

// Product DevNet journey harness.
//
// This is intentionally read-only. It validates the local Product build
// contract, and it can evaluate JSON copied/downloaded from the browser-side
// Product CDM host smoke panel. It never signs, broadcasts, reads secrets, or
// treats missing live evidence as a pass.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PRODUCT_JOURNEY_SCHEMA_VERSION = 1;
export const EXPECTED_PRODUCT_DEVNET = {
  productId: 'dotify-test01.dot',
  publicAppUrl: 'https://dotify-test01.dev-dot.li',
  chainId: 420420417,
  devnetResetAt: '2026-09-09T00:00:00.000Z',
  assetHubRpcUrls: ['https://eth-rpc-testnet.polkadot.io/', 'https://paseo-assethub-rpc.laissez-faire.trade/'],
  cdmRegistry: '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f',
  retiredCdmRegistry: '0x59b0245778917af55224e5f8fb55f7f8d452619f',
  productSdk: '0.27.0',
  productSdkHost: '0.19.1',
  productSdkDescriptors: '0.11.0',
  productSdkStatementStore: '0.6.9',
  productDeployCli: '0.16.2'
};

const REQUIRED_PRODUCT_ORIGINS = [
  'https://muzinga.netlify.app',
  'https://dotify-test01.dev-dot.li',
  'https://dotify-test01.app.dev-dot.li',
  'https://dotify-test01.app.dot.li',
  'https://dotify-test01.dot',
  'polkadot://dotify-test01.dot',
  'polkadot://app.dotify-test01.dot'
];

const FORBIDDEN_EVIDENCE_KEYS = ['contentKey', 'signature', 'nonce', 'sessionToken', 'token'];

export function parseEnvFile(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function packageLockVersion(lockfile, packageName) {
  return lockfile?.packages?.[`node_modules/${packageName}`]?.version ?? null;
}

export function extractProductAppVersion(configText) {
  const match = configText.match(/appVersion\s*:\s*\[([^\]]+)\]/m);
  if (!match) return null;
  const parts = match[1]
    .split(',')
    .map(part => Number.parseInt(part.trim(), 10))
    .filter(Number.isFinite);
  return parts.length > 0 ? parts : null;
}

function pushGate(gates, status, id, label, detail, source = 'local') {
  gates.push({ id, label, status, detail, source });
}

function pass(gates, id, label, detail, source) {
  pushGate(gates, 'pass', id, label, detail, source);
}

function fail(gates, id, label, detail, source) {
  pushGate(gates, 'fail', id, label, detail, source);
}

function blocked(gates, id, label, detail, source) {
  pushGate(gates, 'blocked', id, label, detail, source);
}

function notRun(gates, id, label, detail, source) {
  pushGate(gates, 'not-run', id, label, detail, source);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizedUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function isExpectedProductDevnetRpcUrl(value) {
  const normalized = normalizedUrl(value);
  if (!normalized) return false;
  return EXPECTED_PRODUCT_DEVNET.assetHubRpcUrls.map(url => normalizedUrl(url)).includes(normalized);
}

function normalizeAddress(address) {
  return typeof address === 'string' ? address.toLowerCase() : '';
}

function isHexAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isHexHash(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isProductPublicKey(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isPositivePlanck(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

function parseDateMs(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function versionText(appVersion) {
  return Array.isArray(appVersion) ? `[${appVersion.join(', ')}]` : null;
}

function sameValue(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

function commaList(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function originListFromToml(text, key) {
  const match = text.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`));
  return match ? commaList(match[1]) : [];
}

function checkPackage(gates, lockfile, packageName, expectedVersion) {
  const installed = packageLockVersion(lockfile, packageName);
  if (installed === expectedVersion) {
    pass(gates, `package:${packageName}`, packageName, `Installed ${installed}.`);
  } else {
    fail(gates, `package:${packageName}`, packageName, `Expected ${expectedVersion}, found ${installed ?? 'missing'}.`);
  }
}

function checkOrigins(gates, source, label, origins) {
  const missing = REQUIRED_PRODUCT_ORIGINS.filter(origin => !origins.includes(origin));
  if (missing.length === 0) {
    pass(gates, `origins:${label}`, `${label} origins`, 'All Product and standalone origins are allowlisted.', source);
  } else {
    fail(gates, `origins:${label}`, `${label} origins`, `Missing ${missing.join(', ')}.`, source);
  }

  if (origins.includes('null') || origins.includes('*')) {
    fail(gates, `origins:${label}:unsafe`, `${label} unsafe origins`, 'Origin allowlist must not include null or *.', source);
  } else {
    pass(gates, `origins:${label}:unsafe`, `${label} unsafe origins`, 'No null or wildcard origin is present.', source);
  }
}

export function evaluateStaticProductDevnetSnapshot(snapshot) {
  const gates = [];
  const env = snapshot.env ?? {};

  checkPackage(gates, snapshot.webPackageLock, '@parity/product-sdk', EXPECTED_PRODUCT_DEVNET.productSdk);
  checkPackage(gates, snapshot.webPackageLock, '@parity/product-sdk-host', EXPECTED_PRODUCT_DEVNET.productSdkHost);
  checkPackage(gates, snapshot.webPackageLock, '@parity/product-sdk-descriptors', EXPECTED_PRODUCT_DEVNET.productSdkDescriptors);
  checkPackage(gates, snapshot.webPackageLock, '@parity/product-sdk-statement-store', EXPECTED_PRODUCT_DEVNET.productSdkStatementStore);

  const deployScript = snapshot.webPackageJson?.scripts?.['deploy:product-devnet'] ?? '';
  if (deployScript.includes(`@polkadot-community-foundation/polkadot-app-deploy@${EXPECTED_PRODUCT_DEVNET.productDeployCli}`)) {
    pass(gates, 'deploy-cli', 'Product deploy CLI', `Pinned to ${EXPECTED_PRODUCT_DEVNET.productDeployCli}.`, 'web/package.json');
  } else {
    fail(gates, 'deploy-cli', 'Product deploy CLI', `Expected deploy script to pin ${EXPECTED_PRODUCT_DEVNET.productDeployCli}.`, 'web/package.json');
  }

  if (env.VITE_DOTIFY_HOST_MODE === 'required') {
    pass(gates, 'host-mode', 'Product host mode', 'Product profile requires the host.', 'web/.env.product-devnet');
  } else {
    fail(gates, 'host-mode', 'Product host mode', `Expected required, found ${env.VITE_DOTIFY_HOST_MODE || 'missing'}.`, 'web/.env.product-devnet');
  }

  if (env.VITE_DOTIFY_PRODUCT_ID === EXPECTED_PRODUCT_DEVNET.productId) {
    pass(gates, 'product-id', 'Product ID', env.VITE_DOTIFY_PRODUCT_ID, 'web/.env.product-devnet');
  } else {
    fail(
      gates,
      'product-id',
      'Product ID',
      `Expected ${EXPECTED_PRODUCT_DEVNET.productId}, found ${env.VITE_DOTIFY_PRODUCT_ID || 'missing'}.`,
      'web/.env.product-devnet'
    );
  }

  if (env.VITE_PUBLIC_APP_URL === EXPECTED_PRODUCT_DEVNET.publicAppUrl) {
    pass(gates, 'public-app-url', 'Canonical room URL origin', env.VITE_PUBLIC_APP_URL, 'web/.env.product-devnet');
  } else {
    fail(
      gates,
      'public-app-url',
      'Canonical room URL origin',
      `Expected ${EXPECTED_PRODUCT_DEVNET.publicAppUrl}, found ${env.VITE_PUBLIC_APP_URL || 'missing'}.`,
      'web/.env.product-devnet'
    );
  }

  for (const [id, key] of [
    ['api-url', 'VITE_DOTIFY_API_URL'],
    ['signal-url', 'VITE_SIGNAL_URL'],
    ['pinata-gateway', 'VITE_PINATA_GATEWAY']
  ]) {
    const value = env[key] ?? '';
    if (isHttpsUrl(value)) {
      pass(gates, id, key, value, 'web/.env.product-devnet');
    } else {
      fail(gates, id, key, `Expected an https URL, found ${value || 'missing'}.`, 'web/.env.product-devnet');
    }
  }

  const ethRpcUrl = env.VITE_ETH_RPC_URL ?? '';
  if (isExpectedProductDevnetRpcUrl(ethRpcUrl)) {
    pass(gates, 'asset-hub-rpc', 'VITE_ETH_RPC_URL', `${ethRpcUrl} (Product DevNet chain ${EXPECTED_PRODUCT_DEVNET.chainId}).`, 'web/.env.product-devnet');
  } else {
    fail(
      gates,
      'asset-hub-rpc',
      'VITE_ETH_RPC_URL',
      `Expected Product DevNet Asset Hub RPC (${EXPECTED_PRODUCT_DEVNET.assetHubRpcUrls.join(' or ')}), found ${ethRpcUrl || 'missing'}.`,
      'web/.env.product-devnet'
    );
  }

  if (env.VITE_PINATA_JWT || env.VITE_CONTENT_SECRET) {
    fail(
      gates,
      'browser-secrets',
      'Browser-exposed secrets',
      'Product profile must keep VITE_PINATA_JWT and VITE_CONTENT_SECRET empty.',
      'web/.env.product-devnet'
    );
  } else {
    pass(gates, 'browser-secrets', 'Browser-exposed secrets', 'No browser upload token or content secret is configured.', 'web/.env.product-devnet');
  }

  const readGateways = commaList(env.VITE_IPFS_READ_GATEWAYS);
  if (env.VITE_PINATA_GATEWAY === 'https://gateway.pinata.cloud' && readGateways.includes('https://devnet-ipfs.api.polkadotcommunity.foundation')) {
    pass(gates, 'ipfs-gateways', 'Track asset gateways', 'Pinata remains primary; Product/Bulletin gateways stay fallback reads.', 'web/.env.product-devnet');
  } else {
    fail(gates, 'ipfs-gateways', 'Track asset gateways', 'Expected Pinata primary plus Product DevNet gateway fallback.', 'web/.env.product-devnet');
  }

  const runtimeAdapter = String(env.VITE_DOTIFY_RUNTIME_ADAPTER ?? '').trim() || 'viem';
  if (runtimeAdapter === 'viem') {
    pass(
      gates,
      'tracked-runtime-adapter',
      'Tracked runtime adapter',
      'Default Product profile remains viem until live Product CDM write evidence passes.',
      'web/.env.product-devnet'
    );
  } else {
    fail(
      gates,
      'tracked-runtime-adapter',
      'Tracked runtime adapter',
      `Expected viem/unset for tracked profile, found ${runtimeAdapter}.`,
      'web/.env.product-devnet'
    );
  }

  if (normalizeAddress(snapshot.contractsCdm?.registry) === EXPECTED_PRODUCT_DEVNET.cdmRegistry) {
    pass(gates, 'cdm-registry', 'CDM registry', EXPECTED_PRODUCT_DEVNET.cdmRegistry, 'contracts/evm/cdm.json');
  } else {
    fail(gates, 'cdm-registry', 'CDM registry', `Expected ${EXPECTED_PRODUCT_DEVNET.cdmRegistry}.`, 'contracts/evm/cdm.json');
  }
  if (JSON.stringify(snapshot).toLowerCase().includes(EXPECTED_PRODUCT_DEVNET.retiredCdmRegistry)) {
    fail(gates, 'retired-cdm-registry', 'Retired CDM registry', 'The pre-September registry is still present in local Product config.');
  } else {
    pass(gates, 'retired-cdm-registry', 'Retired CDM registry', 'No Product config points at the retired registry.');
  }

  const generatedContracts = snapshot.generatedCdm?.contracts ?? {};
  const generatedDirectory = normalizeAddress(generatedContracts['@dotify/artist-directory']?.address);
  const generatedFactory = normalizeAddress(generatedContracts['@dotify/artist-runtime-factory']?.address);
  if (generatedDirectory === normalizeAddress(snapshot.deployments?.directory)) {
    pass(gates, 'cdm-directory-address', 'CDM ArtistDirectory address', generatedDirectory, 'web/src/generated/contracts/cdm.json');
  } else {
    fail(
      gates,
      'cdm-directory-address',
      'CDM ArtistDirectory address',
      'Generated manifest does not match deployments.json.',
      'web/src/generated/contracts/cdm.json'
    );
  }
  if (generatedFactory === normalizeAddress(snapshot.deployments?.factory)) {
    pass(gates, 'cdm-factory-address', 'CDM ArtistRuntimeFactory address', generatedFactory, 'web/src/generated/contracts/cdm.json');
  } else {
    fail(
      gates,
      'cdm-factory-address',
      'CDM ArtistRuntimeFactory address',
      'Generated manifest does not match deployments.json.',
      'web/src/generated/contracts/cdm.json'
    );
  }

  const appVersion = extractProductAppVersion(snapshot.productDeployConfigText ?? '');
  if (appVersion) {
    pass(gates, 'product-app-version', 'Product executable version', `[${appVersion.join(', ')}]`, 'web/polkadot-app-deploy.config.ts');
  } else {
    fail(gates, 'product-app-version', 'Product executable version', 'Could not read appVersion.', 'web/polkadot-app-deploy.config.ts');
  }

  if ((snapshot.productDeployConfigText ?? '').includes(`domain: '${EXPECTED_PRODUCT_DEVNET.productId}'`)) {
    pass(gates, 'deploy-domain', 'Deploy domain', EXPECTED_PRODUCT_DEVNET.productId, 'web/polkadot-app-deploy.config.ts');
  } else {
    fail(gates, 'deploy-domain', 'Deploy domain', `Expected ${EXPECTED_PRODUCT_DEVNET.productId}.`, 'web/polkadot-app-deploy.config.ts');
  }

  checkOrigins(gates, 'services/api/fly.toml', 'API', originListFromToml(snapshot.apiFlyTomlText ?? '', 'API_ORIGINS'));
  checkOrigins(gates, 'web/fly.signal.toml', 'Signal', originListFromToml(snapshot.signalFlyTomlText ?? '', 'SIGNAL_ORIGINS'));

  if ((snapshot.runtimeAdapterConfigText ?? '').includes("const PRODUCT_ENVIRONMENTS = ['devnet'] as const")) {
    pass(
      gates,
      'product-chain-env',
      'Product chain environment',
      'Only devnet is accepted by the runtime adapter config.',
      'web/src/features/runtime/runtimeAdapterConfig.ts'
    );
  } else {
    fail(
      gates,
      'product-chain-env',
      'Product chain environment',
      'Runtime adapter config must fail closed to devnet only.',
      'web/src/features/runtime/runtimeAdapterConfig.ts'
    );
  }

  return gates;
}

function containsForbiddenKey(value, path = []) {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_EVIDENCE_KEYS.includes(key)) return nextPath.join('.');
    const nested = containsForbiddenKey(child, nextPath);
    if (nested) return nested;
  }
  return null;
}

function smokeEvents(evidence) {
  return Array.isArray(evidence?.events) ? evidence.events : [];
}

function latestPaymentEvent(events) {
  return events.filter(event => event?.kind === 'payment').at(-1) ?? null;
}

function latestAllowedKeyEvent(events, payment, context) {
  return (
    events.find(
      event =>
        event?.kind === 'key' &&
        event.phase === 'key-allowed' &&
        event.signatureScheme === 'product-sr25519-v1' &&
        event.chainId === EXPECTED_PRODUCT_DEVNET.chainId &&
        event.access === 'allowed' &&
        event.playbackMode === 'full' &&
        sameValue(event.address, context?.listenerAddress) &&
        sameValue(event.productPublicKey, context?.productPublicKey) &&
        (!payment || (sameValue(event.contentHash, payment.contentHash) && sameValue(event.runtime, payment.runtimeAddress)))
    ) ?? null
  );
}

function hasExplicitHostApproval(events) {
  return events.some(event => event?.kind === 'operator-observation' && event.observation === 'host-approval-explicit' && event.ok === true);
}

function allSmokeIdentitiesMatch(events, context) {
  if (!context?.listenerAddress || !context?.productPublicKey) return false;
  const identityEvents = events.filter(event => event?.kind === 'payment' || event?.kind === 'key');
  if (identityEvents.length === 0) return false;
  return identityEvents.every(event => {
    if (event.kind === 'payment') return sameValue(event.listenerAddress, context.listenerAddress);
    return sameValue(event.address, context.listenerAddress) && sameValue(event.productPublicKey, context.productPublicKey);
  });
}

export function evaluateProductCdmSmokeEvidence(evidence, options = {}) {
  const gates = [];
  const expectedVersion = versionText(options.appVersion);
  const expectedCommit = typeof options.commit === 'string' && options.commit !== 'unknown' ? options.commit : null;
  const generatedAtMs = parseDateMs(options.generatedAt) ?? Date.now();
  const devnetResetAtMs = parseDateMs(EXPECTED_PRODUCT_DEVNET.devnetResetAt);

  if (!evidence) {
    blocked(
      gates,
      'product-cdm-live-unlock',
      'Product-signed Classic unlock',
      'No exported Product CDM host smoke JSON was supplied. Run the product-cdm smoke build with a funded Product account and pass --smoke-json <file>.',
      'Product host'
    );
    return gates;
  }

  const context = evidence.context ?? {};
  const events = smokeEvents(evidence);
  const payment = latestPaymentEvent(events);
  const allowedKey = latestAllowedKeyEvent(events, payment, context);

  if (evidence.schemaVersion !== 1) {
    fail(gates, 'smoke-schema', 'Smoke evidence schema', `Expected schemaVersion 1, found ${evidence.schemaVersion ?? 'missing'}.`, 'Product host JSON');
  } else {
    pass(gates, 'smoke-schema', 'Smoke evidence schema', 'schemaVersion 1.', 'Product host JSON');
  }

  const capturedAtMs = parseDateMs(evidence.capturedAt);
  if (capturedAtMs === null) {
    fail(gates, 'smoke-captured-at', 'Smoke capture time', 'capturedAt must be an ISO timestamp.', 'Product host JSON');
  } else if (devnetResetAtMs !== null && capturedAtMs < devnetResetAtMs) {
    fail(
      gates,
      'smoke-captured-at',
      'Smoke capture time',
      `Evidence predates the Product DevNet reset at ${EXPECTED_PRODUCT_DEVNET.devnetResetAt}.`,
      'Product host JSON'
    );
  } else if (capturedAtMs > generatedAtMs + 5 * 60_000) {
    fail(gates, 'smoke-captured-at', 'Smoke capture time', 'capturedAt is later than the harness run.', 'Product host JSON');
  } else {
    pass(gates, 'smoke-captured-at', 'Smoke capture time', evidence.capturedAt, 'Product host JSON');
  }

  const forbidden = containsForbiddenKey(evidence);
  if (forbidden) {
    fail(gates, 'smoke-secrets', 'Smoke evidence secret hygiene', `Forbidden key "${forbidden}" is present.`, 'Product host JSON');
  } else {
    pass(gates, 'smoke-secrets', 'Smoke evidence secret hygiene', 'No content keys, signatures, nonces, or tokens are present.', 'Product host JSON');
  }

  const buildProblems = [];
  if (expectedCommit && context.buildSha !== expectedCommit) buildProblems.push(`buildSha ${context.buildSha || 'missing'} does not match ${expectedCommit}`);
  if (expectedVersion && context.productAppVersion !== expectedVersion) {
    buildProblems.push(`productAppVersion ${context.productAppVersion || 'missing'} does not match ${expectedVersion}`);
  }
  if (context.publicAppUrl !== EXPECTED_PRODUCT_DEVNET.publicAppUrl) {
    buildProblems.push(`publicAppUrl ${context.publicAppUrl || 'missing'} does not match ${EXPECTED_PRODUCT_DEVNET.publicAppUrl}`);
  }
  if (normalizeAddress(context.cdmRegistry) !== EXPECTED_PRODUCT_DEVNET.cdmRegistry) {
    buildProblems.push(`cdmRegistry ${context.cdmRegistry || 'missing'} does not match ${EXPECTED_PRODUCT_DEVNET.cdmRegistry}`);
  }
  if (buildProblems.length === 0) {
    pass(
      gates,
      'smoke-build',
      'Smoke build identity',
      `Build ${expectedCommit ?? 'unknown'} ${expectedVersion ?? ''} matches Product DevNet config.`,
      'Product host JSON'
    );
  } else {
    fail(gates, 'smoke-build', 'Smoke build identity', buildProblems.join('; '), 'Product host JSON');
  }

  if (
    context.productId === EXPECTED_PRODUCT_DEVNET.productId &&
    context.productHostMode === 'required' &&
    context.productHostStatus === 'available' &&
    context.walletMethod === 'product-host' &&
    isHexAddress(context.listenerAddress) &&
    isProductPublicKey(context.productPublicKey) &&
    context.expectedChainId === EXPECTED_PRODUCT_DEVNET.chainId &&
    context.apiConfigured === true
  ) {
    pass(gates, 'smoke:product-account', 'Product account', `Connected ${context.listenerAddress} for ${context.productId}.`, 'Product host JSON');
  } else {
    fail(
      gates,
      'smoke:product-account',
      'Product account',
      'Expected Product host account, available host, current product ID, Product DevNet chain, API enabled, H160 listener, and 32-byte Product public key.',
      'Product host JSON'
    );
  }

  if (context.runtimeAdapterKind === 'product-cdm') {
    pass(gates, 'smoke:product-cdm-adapter', 'Runtime adapter', 'Product CDM adapter was active.', 'Product host JSON');
  } else {
    fail(gates, 'smoke:product-cdm-adapter', 'Runtime adapter', `Expected product-cdm, found ${context.runtimeAdapterKind || 'missing'}.`, 'Product host JSON');
  }

  if (hasExplicitHostApproval(events)) {
    pass(gates, 'smoke:host-approval', 'Host approval', 'Operator recorded an explicit Product host approval prompt.', 'Product host JSON');
  } else {
    fail(gates, 'smoke:host-approval', 'Host approval', 'Expected an operator-observation event with host-approval-explicit=true.', 'Product host JSON');
  }

  if (payment && isPositivePlanck(payment.amountPlanck)) {
    pass(gates, 'smoke:native-value', 'Native value', `amountPlanck=${payment.amountPlanck}.`, 'Product host JSON');
  } else {
    fail(gates, 'smoke:native-value', 'Native value', 'Expected a payment event with a non-zero native amountPlanck.', 'Product host JSON');
  }

  if (
    payment &&
    payment.ok === true &&
    payment.hasPaid === true &&
    payment.canAccess === true &&
    Number.isInteger(payment.attempts) &&
    payment.attempts > 0 &&
    isHexHash(payment.txHash) &&
    isHexAddress(payment.runtimeAddress) &&
    isHexHash(payment.contentHash) &&
    sameValue(payment.listenerAddress, context.listenerAddress)
  ) {
    pass(gates, 'smoke:payment-readback', 'Payment read-back', `Access read-back passed after ${payment.attempts} attempts.`, 'Product host JSON');
  } else {
    fail(
      gates,
      'smoke:payment-readback',
      'Payment read-back',
      'Expected a same-identity payment event with valid tx/runtime/content hashes, ok=true, hasPaid=true, canAccess=true, and attempts>0.',
      'Product host JSON'
    );
  }

  if (allowedKey) {
    pass(
      gates,
      'smoke:backend-key',
      'Backend key release',
      `Backend released full access through ${allowedKey.path} Product sr25519 identity.`,
      'Product host JSON'
    );
  } else {
    fail(
      gates,
      'smoke:backend-key',
      'Backend key release',
      'Expected a matching key-allowed event for the same listener, Product public key, runtime, content hash, Product DevNet chain, and full playback.',
      'Product host JSON'
    );
  }

  if (allSmokeIdentitiesMatch(events, context)) {
    pass(gates, 'smoke:same-identity', 'Same identity', 'Payment and key events use the connected Product H160/public-key identity.', 'Product host JSON');
  } else {
    fail(gates, 'smoke:same-identity', 'Same identity', 'Payment/key event identities must match the connected Product account.', 'Product host JSON');
  }

  return gates;
}

export function evaluateRoomJourneyEvidence(roomEvidence, publicAppUrl = EXPECTED_PRODUCT_DEVNET.publicAppUrl) {
  const gates = [];
  if (!roomEvidence) {
    notRun(
      gates,
      'product-room-guest',
      'Product host room to browser guest',
      'No Product room evidence JSON was supplied. Record host origin, canonical room URL, guest origin, walletless join, and audible/in-sync result.',
      'manual room smoke'
    );
    return gates;
  }

  if (roomEvidence.schemaVersion !== 1) {
    fail(gates, 'room-schema', 'Room evidence schema', `Expected schemaVersion 1, found ${roomEvidence.schemaVersion ?? 'missing'}.`, 'room JSON');
  } else {
    pass(gates, 'room-schema', 'Room evidence schema', 'schemaVersion 1.', 'room JSON');
  }

  const hostSurface = roomEvidence.hostSurface;
  if (
    (hostSurface === 'product-desktop' || hostSurface === 'product-web-gateway') &&
    typeof roomEvidence.hostOrigin === 'string' &&
    roomEvidence.hostOrigin.trim() &&
    typeof roomEvidence.hostVersion === 'string' &&
    roomEvidence.hostVersion.trim() &&
    typeof roomEvidence.guestOrigin === 'string' &&
    isHttpsUrl(roomEvidence.guestOrigin)
  ) {
    pass(gates, 'room-surface', 'Product room surface', `${hostSurface} ${roomEvidence.hostVersion} from ${roomEvidence.hostOrigin}.`, 'room JSON');
  } else {
    fail(
      gates,
      'room-surface',
      'Product room surface',
      'Expected hostSurface=product-desktop or product-web-gateway plus hostOrigin, hostVersion, and HTTPS guestOrigin.',
      'room JSON'
    );
  }

  const canonical = typeof roomEvidence.canonicalRoomUrl === 'string' && roomEvidence.canonicalRoomUrl.startsWith(`${publicAppUrl}/#/rooms/`);
  if (canonical && roomEvidence.hostSharedCanonicalUrl === true) {
    pass(gates, 'canonical-room-link', 'Canonical room link', roomEvidence.canonicalRoomUrl, 'room JSON');
  } else {
    fail(gates, 'canonical-room-link', 'Canonical room link', `Expected a ${publicAppUrl}/#/rooms/<code> URL shared by the Product host.`, 'room JSON');
  }

  if (roomEvidence.guestAccountConnected === false && roomEvidence.guestJoined === true && roomEvidence.guestHeardAudio === true) {
    pass(
      gates,
      'walletless-browser-guest',
      'Walletless browser guest',
      'Guest joined and heard the Product host stream without account connection.',
      'room JSON'
    );
  } else {
    fail(
      gates,
      'walletless-browser-guest',
      'Walletless browser guest',
      'Expected guestAccountConnected=false, guestJoined=true, and guestHeardAudio=true.',
      'room JSON'
    );
  }

  return gates;
}

function gatesPassed(gates, ids) {
  return ids.every(id => gates.some(gate => gate.id === id && gate.status === 'pass'));
}

function roomEvidenceSurface(roomEvidence, roomGates) {
  if (!gatesPassed(roomGates, ['room-schema', 'room-surface', 'canonical-room-link', 'walletless-browser-guest'])) return null;
  return roomEvidence?.hostSurface ?? null;
}

export function buildSurfaceMatrix({ commit, appVersion, productSmokeGates, roomEvidence, roomGates }) {
  const version = appVersion ? `[${appVersion.join(', ')}]` : 'unknown';
  const productPaymentComplete = gatesPassed(productSmokeGates, [
    'smoke-schema',
    'smoke-captured-at',
    'smoke-secrets',
    'smoke-build',
    'smoke:product-account',
    'smoke:product-cdm-adapter',
    'smoke:host-approval',
    'smoke:native-value',
    'smoke:payment-readback',
    'smoke:backend-key',
    'smoke:same-identity'
  ]);
  const roomSurface = roomEvidenceSurface(roomEvidence, roomGates);
  const productDesktopRoomComplete = roomSurface === 'product-desktop';
  const productWebRoomComplete = roomSurface === 'product-web-gateway';

  return [
    {
      surface: 'Standalone desktop browser',
      buildSha: commit,
      appVersion: 'web build',
      status: 'not-run',
      evidence: 'Run ordinary browser Music/Rooms/Artist smoke against Netlify or local preview.'
    },
    {
      surface: 'Standalone mobile browser',
      buildSha: commit,
      appVersion: 'web build',
      status: 'not-run',
      evidence: 'Run mobile browser Free playback and room join smoke.'
    },
    {
      surface: 'Product Desktop',
      buildSha: commit,
      appVersion: version,
      status: productPaymentComplete && productDesktopRoomComplete ? 'pass' : 'blocked',
      evidence:
        productPaymentComplete && productDesktopRoomComplete
          ? 'Product CDM payment/key smoke and Product Desktop room guest evidence supplied.'
          : productPaymentComplete
            ? 'Needs room evidence explicitly captured on Product Desktop.'
            : 'Needs live Product Desktop payment/key and room evidence.'
    },
    {
      surface: 'Product Web gateway',
      buildSha: commit,
      appVersion: version,
      status: productWebRoomComplete ? 'pass' : 'not-run',
      evidence: productWebRoomComplete ? 'Canonical Product Web gateway room evidence supplied.' : 'Needs Product Web gateway room/open playback smoke.'
    },
    {
      surface: 'Product iOS',
      buildSha: commit,
      appVersion: version,
      status: 'not-run',
      evidence: 'Only the external-browser continuation may be claimed until a real host capability smoke proves in-app WebRTC.'
    }
  ];
}

export function summarizeGates(gates) {
  const failCount = gates.filter(gate => gate.status === 'fail').length;
  const blockedCount = gates.filter(gate => gate.status === 'blocked').length;
  const notRunCount = gates.filter(gate => gate.status === 'not-run').length;
  return {
    status: failCount > 0 ? 'fail' : blockedCount > 0 ? 'blocked' : notRunCount > 0 ? 'incomplete' : 'pass',
    failCount,
    blockedCount,
    notRunCount,
    passCount: gates.filter(gate => gate.status === 'pass').length
  };
}

export function buildProductDevnetJourneyReport(input) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const staticGates = evaluateStaticProductDevnetSnapshot(input.snapshot);
  const appVersion = extractProductAppVersion(input.snapshot.productDeployConfigText ?? '');
  const productSmokeGates = evaluateProductCdmSmokeEvidence(input.productSmokeEvidence, {
    commit: input.commit ?? 'unknown',
    appVersion,
    generatedAt
  });
  const roomGates = evaluateRoomJourneyEvidence(input.roomEvidence, input.snapshot.env?.VITE_PUBLIC_APP_URL);
  const surfaceMatrix = buildSurfaceMatrix({
    commit: input.commit ?? 'unknown',
    appVersion,
    productSmokeGates,
    roomEvidence: input.roomEvidence,
    roomGates
  });
  const gates = [...staticGates, ...productSmokeGates, ...roomGates];
  return {
    schemaVersion: PRODUCT_JOURNEY_SCHEMA_VERSION,
    generatedAt,
    commit: input.commit ?? 'unknown',
    product: EXPECTED_PRODUCT_DEVNET,
    summary: summarizeGates(gates),
    staticGates,
    productSmokeGates,
    roomGates,
    surfaceMatrix
  };
}

export function renderProductDevnetJourneyMarkdown(report) {
  return [
    '# Product DevNet Journey Harness',
    '',
    `Generated: ${report.generatedAt}`,
    `Commit: \`${report.commit}\``,
    `Summary: **${report.summary.status}** (${report.summary.passCount} pass, ${report.summary.failCount} fail, ${report.summary.blockedCount} blocked, ${report.summary.notRunCount} not run)`,
    '',
    '## Static Gates',
    '',
    renderGateTable(report.staticGates),
    '',
    '## Product CDM Host Smoke',
    '',
    renderGateTable(report.productSmokeGates),
    '',
    '## Room Journey',
    '',
    renderGateTable(report.roomGates),
    '',
    '## Surface Matrix',
    '',
    '| Surface | Build SHA | App version | Status | Evidence |',
    '| --- | --- | --- | --- | --- |',
    ...report.surfaceMatrix.map(row => `| ${row.surface} | \`${row.buildSha}\` | ${row.appVersion} | ${row.status} | ${escapePipes(row.evidence)} |`),
    '',
    '## Live Evidence Inputs',
    '',
    '- Product CDM payment/key smoke: pass `--smoke-json <downloaded-product-cdm-host-smoke.json>` after running the explicit `product-cdm` build from the same commit inside a funded Product host.',
    '- Product room smoke: pass `--room-json <room-evidence.json>` with `schemaVersion`, `hostSurface`, `hostOrigin`, `hostVersion`, `guestOrigin`, `canonicalRoomUrl`, `guestAccountConnected`, `guestJoined`, and `guestHeardAudio` fields.',
    '- Missing live inputs are reported as blocked/not-run, never as passed.'
  ].join('\n');
}

function renderGateTable(gates) {
  return [
    '| Gate | Status | Detail | Source |',
    '| --- | --- | --- | --- |',
    ...gates.map(gate => `| ${gate.label} | ${gate.status} | ${escapePipes(gate.detail)} | ${gate.source} |`)
  ].join('\n');
}

function escapePipes(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  if (!path) return null;
  return readJson(path);
}

export function gitCommit(repoRoot) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'unknown';
  }
}

export function readProductDevnetSnapshot(repoRoot) {
  return {
    env: parseEnvFile(readFileSync(resolve(repoRoot, 'web/.env.product-devnet'), 'utf8')),
    webPackageJson: readJson(resolve(repoRoot, 'web/package.json')),
    webPackageLock: readJson(resolve(repoRoot, 'web/package-lock.json')),
    deployments: readJson(resolve(repoRoot, 'deployments.json')),
    contractsCdm: readJson(resolve(repoRoot, 'contracts/evm/cdm.json')),
    generatedCdm: readJson(resolve(repoRoot, 'web/src/generated/contracts/cdm.json')),
    productDeployConfigText: readFileSync(resolve(repoRoot, 'web/polkadot-app-deploy.config.ts'), 'utf8'),
    runtimeAdapterConfigText: readFileSync(resolve(repoRoot, 'web/src/features/runtime/runtimeAdapterConfig.ts'), 'utf8'),
    apiFlyTomlText: readFileSync(resolve(repoRoot, 'services/api/fly.toml'), 'utf8'),
    signalFlyTomlText: readFileSync(resolve(repoRoot, 'web/fly.signal.toml'), 'utf8')
  };
}

export function parseArgs(argv) {
  const args = {
    repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
    smokeJson: null,
    roomJson: null,
    jsonOut: null,
    mdOut: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--repo-root' && next) {
      args.repoRoot = resolve(next);
      index += 1;
    } else if (value === '--smoke-json' && next) {
      args.smokeJson = resolve(next);
      index += 1;
    } else if (value === '--room-json' && next) {
      args.roomJson = resolve(next);
      index += 1;
    } else if (value === '--json-out' && next) {
      args.jsonOut = resolve(next);
      index += 1;
    } else if (value === '--md-out' && next) {
      args.mdOut = resolve(next);
      index += 1;
    } else if (value === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }

  return args;
}

function help() {
  return `Usage: npm run smoke:product-journey -- [--smoke-json <file>] [--room-json <file>] [--json-out <file>] [--md-out <file>]

Validates the browser-safe Product DevNet build profile and optionally evaluates
live evidence exported from the Product CDM host smoke panel plus a room smoke
JSON. The command is read-only and exits non-zero only for unsafe or inconsistent
local config. Missing live evidence is reported as blocked/not-run.`;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(help());
    return 0;
  }

  const snapshot = readProductDevnetSnapshot(args.repoRoot);
  const report = buildProductDevnetJourneyReport({
    snapshot,
    productSmokeEvidence: readOptionalJson(args.smokeJson),
    roomEvidence: readOptionalJson(args.roomJson),
    commit: gitCommit(args.repoRoot)
  });
  const markdown = renderProductDevnetJourneyMarkdown(report);

  if (args.jsonOut) writeFileSync(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (args.mdOut) writeFileSync(args.mdOut, `${markdown}\n`);

  console.log(markdown);
  return report.summary.failCount > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
