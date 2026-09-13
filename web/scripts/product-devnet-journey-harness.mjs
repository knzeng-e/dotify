#!/usr/bin/env node

// Product DevNet journey harness.
//
// This is intentionally read-only. It validates the local Product build
// contract, and it can evaluate JSON copied/downloaded from the browser-side
// Product CDM host smoke panel. It never signs, broadcasts, reads secrets, or
// treats missing live evidence as a pass.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PRODUCT_JOURNEY_SCHEMA_VERSION = 1;
export const EXPECTED_PRODUCT_DEVNET = {
  productId: 'dotify-test01.dot',
  publicAppUrl: 'https://dotify-test01.dev-dot.li',
  chainId: 420420417,
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

const REQUIRED_PRODUCT_SMOKE_CHECKS = [
  'product-account',
  'product-cdm-adapter',
  'host-approval',
  'native-value',
  'payment-readback',
  'backend-key',
  'same-identity'
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

function normalizeAddress(address) {
  return typeof address === 'string' ? address.toLowerCase() : '';
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
    ['asset-hub-rpc', 'VITE_ETH_RPC_URL'],
    ['pinata-gateway', 'VITE_PINATA_GATEWAY']
  ]) {
    const value = env[key] ?? '';
    if (isHttpsUrl(value)) {
      pass(gates, id, key, value, 'web/.env.product-devnet');
    } else {
      fail(gates, id, key, `Expected an https URL, found ${value || 'missing'}.`, 'web/.env.product-devnet');
    }
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

function findCheck(evidence, id) {
  return Array.isArray(evidence?.checks) ? evidence.checks.find(check => check?.id === id) : null;
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

export function evaluateProductCdmSmokeEvidence(evidence) {
  const gates = [];

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

  if (evidence.schemaVersion !== 1) {
    fail(gates, 'smoke-schema', 'Smoke evidence schema', `Expected schemaVersion 1, found ${evidence.schemaVersion ?? 'missing'}.`, 'Product host JSON');
  } else {
    pass(gates, 'smoke-schema', 'Smoke evidence schema', 'schemaVersion 1.', 'Product host JSON');
  }

  const forbidden = containsForbiddenKey(evidence);
  if (forbidden) {
    fail(gates, 'smoke-secrets', 'Smoke evidence secret hygiene', `Forbidden key "${forbidden}" is present.`, 'Product host JSON');
  } else {
    pass(gates, 'smoke-secrets', 'Smoke evidence secret hygiene', 'No content keys, signatures, nonces, or tokens are present.', 'Product host JSON');
  }

  for (const id of REQUIRED_PRODUCT_SMOKE_CHECKS) {
    const check = findCheck(evidence, id);
    if (!check) {
      fail(gates, `smoke:${id}`, checkLabel(id), 'Required smoke check missing.', 'Product host JSON');
    } else if (check.tone === 'ok') {
      pass(gates, `smoke:${id}`, check.label ?? checkLabel(id), check.detail ?? 'ok', 'Product host JSON');
    } else {
      fail(gates, `smoke:${id}`, check.label ?? checkLabel(id), check.detail ?? `Expected ok, found ${check.tone}.`, 'Product host JSON');
    }
  }

  return gates;
}

function checkLabel(id) {
  return id
    .split('-')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
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

export function buildSurfaceMatrix({ commit, appVersion, productSmokeEvidence, roomEvidence }) {
  const version = appVersion ? `[${appVersion.join(', ')}]` : 'unknown';
  const productPaymentComplete = productSmokeEvidence?.summary?.tone === 'ok';
  const roomComplete = roomEvidence?.guestAccountConnected === false && roomEvidence?.guestJoined === true && roomEvidence?.guestHeardAudio === true;

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
      status: productPaymentComplete && roomComplete ? 'pass' : 'blocked',
      evidence:
        productPaymentComplete && roomComplete
          ? 'Product CDM payment/key smoke and room guest evidence supplied.'
          : 'Needs live Product host payment/key and room evidence.'
    },
    {
      surface: 'Product Web gateway',
      buildSha: commit,
      appVersion: version,
      status: roomComplete ? 'pass' : 'not-run',
      evidence: roomComplete ? 'Canonical Product room URL evidence supplied.' : 'Needs Product gateway room/open playback smoke.'
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
  const staticGates = evaluateStaticProductDevnetSnapshot(input.snapshot);
  const productSmokeGates = evaluateProductCdmSmokeEvidence(input.productSmokeEvidence);
  const roomGates = evaluateRoomJourneyEvidence(input.roomEvidence, input.snapshot.env?.VITE_PUBLIC_APP_URL);
  const appVersion = extractProductAppVersion(input.snapshot.productDeployConfigText ?? '');
  const surfaceMatrix = buildSurfaceMatrix({
    commit: input.commit ?? 'unknown',
    appVersion,
    productSmokeEvidence: input.productSmokeEvidence,
    roomEvidence: input.roomEvidence
  });
  const gates = [...staticGates, ...productSmokeGates, ...roomGates];
  return {
    schemaVersion: PRODUCT_JOURNEY_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
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
    '- Product CDM payment/key smoke: pass `--smoke-json <downloaded-product-cdm-host-smoke.json>` after running the explicit `product-cdm` build inside a funded Product host.',
    '- Product room smoke: pass `--room-json <room-evidence.json>` with `schemaVersion`, `canonicalRoomUrl`, `guestAccountConnected`, `guestJoined`, and `guestHeardAudio` fields.',
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

function gitCommit(repoRoot) {
  try {
    const head = readFileSync(resolve(repoRoot, '.git/HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5).trim();
      const refPath = resolve(repoRoot, '.git', ref);
      if (existsSync(refPath)) return readFileSync(refPath, 'utf8').trim();
      const packedRefs = readFileSync(resolve(repoRoot, '.git/packed-refs'), 'utf8');
      const match = packedRefs
        .split('\n')
        .map(line => line.trim())
        .find(line => line.endsWith(` ${ref}`));
      return match?.split(' ')[0] ?? 'unknown';
    }
    return head;
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
