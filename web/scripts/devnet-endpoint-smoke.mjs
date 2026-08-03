// Read-only DevNet endpoint smoke check.
//
// Answers one question with evidence rather than assertion: does the Product
// DevNet build profile point at a chain that actually holds Dotify's contracts?
//
// Product DevNet is a preset over the Paseo system parachains - Asset Hub
// (1000), People (1004), Bulletin (1010) - at EVM chain 420420417. Dotify is
// already deployed there, so porting to DevNet is a configuration question, not
// a redeploy. This check proves the configuration.
//
// Run: npm run smoke:devnet
//
// Network-dependent and therefore not part of `npm run test:unit`. It performs
// only eth_chainId / eth_getCode reads and unauthenticated GETs; it sends no
// transaction, reads no secret, and prints no credential.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');

const EXPECTED_CHAIN_ID = 420420417;
const REQUEST_TIMEOUT_MS = 20_000;

function parseEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

async function withTimeout(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function ethCall(rpcUrl, method, params) {
  return withTimeout(async signal => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message ?? 'RPC error');
    return body.result;
  });
}

async function reachable(url) {
  return withTimeout(async signal => {
    const response = await fetch(url, { method: 'GET', signal });
    // A Substrate WS RPC answers a plain GET with 405, and an IPFS gateway
    // redirects. Both prove the endpoint is serving.
    return response.status;
  });
}

const results = [];
function record(ok, label, detail) {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} - ${label}${detail ? ` (${detail})` : ''}`);
}

const env = parseEnvFile(resolve(repoRoot, 'web/.env.product-devnet'));
const deployments = JSON.parse(readFileSync(resolve(repoRoot, 'deployments.json'), 'utf8'));
const rpcUrl = env.VITE_ETH_RPC_URL;

if (!rpcUrl) {
  console.error('VITE_ETH_RPC_URL is not set in web/.env.product-devnet');
  process.exit(1);
}

console.log(`Dotify Product DevNet endpoint smoke\nAsset Hub RPC: ${rpcUrl}\n`);

try {
  const chainIdHex = await ethCall(rpcUrl, 'eth_chainId', []);
  const chainId = Number.parseInt(chainIdHex, 16);
  record(chainId === EXPECTED_CHAIN_ID, `Asset Hub reports EVM chain ${EXPECTED_CHAIN_ID}`, `got ${chainId}`);
} catch (error) {
  record(false, 'Asset Hub reports the expected EVM chain', error.message);
}

try {
  const blockHex = await ethCall(rpcUrl, 'eth_blockNumber', []);
  const block = Number.parseInt(blockHex, 16);
  // The chain stalled at 10612201 on 2026-07-01 and later resumed. A head at or
  // below that is the signature of a frozen chain, not a healthy one.
  record(block > 10_612_201, 'Asset Hub is producing blocks past the 2026-07 halt', `head ${block}`);
} catch (error) {
  record(false, 'Asset Hub is producing blocks', error.message);
}

// The contracts Dotify reads on every catalog load. Code present here is the
// evidence that no redeploy is needed to serve the catalog on DevNet.
for (const [label, address] of [
  ['ArtistDirectory', deployments.directory],
  ['ArtistRuntimeFactory', deployments.factory]
]) {
  try {
    const code = await ethCall(rpcUrl, 'eth_getCode', [address, 'latest']);
    const deployed = typeof code === 'string' && code !== '0x' && code.length > 2;
    record(deployed, `${label} is deployed at ${address}`, deployed ? `${code.length} chars of bytecode` : 'no code');
  } catch (error) {
    record(false, `${label} is deployed at ${address}`, error.message);
  }
}

for (const [label, url] of [
  ['Bulletin RPC', env.VITE_BULLETIN_WS_URL?.replace(/^wss:/, 'https:')],
  ['IPFS gateway', env.VITE_PINATA_GATEWAY]
]) {
  if (!url) {
    record(false, `${label} is configured`, 'missing');
    continue;
  }
  try {
    const status = await reachable(url);
    record(status > 0 && status < 500, `${label} responds`, `HTTP ${status}`);
  } catch (error) {
    record(false, `${label} responds`, error.message);
  }
}

const failed = results.filter(result => !result.ok);
if (failed.length > 0) {
  console.error(`\nDotify DevNet endpoint smoke failed: ${failed.length} of ${results.length} checks.`);
  process.exit(1);
}

console.log(`\nDotify DevNet endpoint smoke passed (${results.length} checks).`);
