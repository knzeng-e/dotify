#!/usr/bin/env node
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const defaultEnvPath = resolve(webRoot, '.env.product-devnet');
const defaultOutPath = resolve(webRoot, 'src/services/productDevnetCatalogBootstrap.ts');
const defaultLimit = 100;
const requestTimeoutMs = 15_000;

function parseArgs(argv) {
  const args = {
    apiUrl: '',
    envPath: defaultEnvPath,
    inputPath: '',
    limit: defaultLimit,
    outPath: defaultOutPath,
    productId: '',
    strict: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict') {
      args.strict = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`${arg} requires a value`);
    index += 1;

    switch (arg) {
      case '--api-url':
        args.apiUrl = next;
        break;
      case '--env':
        args.envPath = resolve(next);
        break;
      case '--input':
        args.inputPath = resolve(next);
        break;
      case '--limit':
        args.limit = Number.parseInt(next, 10);
        break;
      case '--out':
        args.outPath = resolve(next);
        break;
      case '--product-id':
        args.productId = next;
        break;
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer');
  return args;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readEnvFile(path) {
  if (!(await fileExists(path))) return {};

  const env = {};
  for (const line of (await readFile(path, 'utf8')).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/$/, '');
}

function catalogUrl(apiUrl, limit) {
  const url = new URL('/api/catalog', `${normalizeBaseUrl(apiUrl)}/`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('includeInactive', 'true');
  return url;
}

async function fetchCatalog(apiUrl, limit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(catalogUrl(apiUrl, limit), {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Catalog API returned HTTP ${response.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readCatalogInput(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assertString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
}

function assertHexAddress(value, label) {
  assertString(value, label);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} must be an EVM address`);
}

function assertHexHash(value, label) {
  assertString(value, label);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be a 32-byte hex hash`);
}

function assertNumber(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') throw new Error('Catalog payload must be an object');
  if (!Array.isArray(catalog.items)) throw new Error('Catalog payload must contain an items array');
  if (!Array.isArray(catalog.artists)) throw new Error('Catalog payload must contain an artists array');
  if (!catalog.pagination || typeof catalog.pagination !== 'object') throw new Error('Catalog payload must contain pagination');
  if (!catalog.meta || typeof catalog.meta !== 'object') throw new Error('Catalog payload must contain meta');

  assertNumber(catalog.pagination.limit, 'pagination.limit');
  assertNumber(catalog.pagination.total, 'pagination.total');
  if (catalog.pagination.nextCursor !== null) assertString(catalog.pagination.nextCursor, 'pagination.nextCursor');

  for (const [index, item] of catalog.items.entries()) {
    const prefix = `items[${index}]`;
    assertString(item.id, `${prefix}.id`);
    assertHexHash(item.hash, `${prefix}.hash`);
    assertHexAddress(item.runtimeAddress, `${prefix}.runtimeAddress`);
    assertHexAddress(item.artistAddress, `${prefix}.artistAddress`);
    assertString(item.tokenId, `${prefix}.tokenId`);
    assertString(item.title, `${prefix}.title`);
    assertString(item.artist, `${prefix}.artist`);
    assertString(item.description, `${prefix}.description`);
    assertString(item.imageRef, `${prefix}.imageRef`);
    if (!Array.isArray(item.coverVariants)) throw new Error(`${prefix}.coverVariants must be an array`);
    assertString(item.audioRef, `${prefix}.audioRef`);
    assertString(item.metadataRef, `${prefix}.metadataRef`);
    assertString(item.bulletinRef, `${prefix}.bulletinRef`);
    assertString(item.artistContractRef, `${prefix}.artistContractRef`);
    if (!['human-free', 'classic', 'free'].includes(item.accessMode)) throw new Error(`${prefix}.accessMode is invalid`);
    assertString(item.priceWei, `${prefix}.priceWei`);
    assertString(item.priceDot, `${prefix}.priceDot`);
    if (!['DIM1', 'DIM2'].includes(item.personhoodLevel)) throw new Error(`${prefix}.personhoodLevel is invalid`);
    if (typeof item.active !== 'boolean') throw new Error(`${prefix}.active must be a boolean`);
    if (typeof item.encrypted !== 'boolean') throw new Error(`${prefix}.encrypted must be a boolean`);
    assertNumber(item.royaltyBps, `${prefix}.royaltyBps`);
    if (!Array.isArray(item.royaltySplits)) throw new Error(`${prefix}.royaltySplits must be an array`);
    for (const [splitIndex, split] of item.royaltySplits.entries()) {
      assertString(split.label, `${prefix}.royaltySplits[${splitIndex}].label`);
      assertHexAddress(split.recipient, `${prefix}.royaltySplits[${splitIndex}].recipient`);
      assertNumber(split.bps, `${prefix}.royaltySplits[${splitIndex}].bps`);
    }
    assertNumber(item.registeredAtBlock, `${prefix}.registeredAtBlock`);
    assertNumber(item.sourceBlock, `${prefix}.sourceBlock`);
  }

  for (const [index, artist] of catalog.artists.entries()) {
    const prefix = `artists[${index}]`;
    assertHexAddress(artist.artistAddress, `${prefix}.artistAddress`);
    assertHexAddress(artist.runtimeAddress, `${prefix}.runtimeAddress`);
    assertString(artist.name, `${prefix}.name`);
    assertNumber(artist.releaseCount, `${prefix}.releaseCount`);
    assertNumber(artist.activeReleaseCount, `${prefix}.activeReleaseCount`);
    assertNumber(artist.latestReleaseBlock, `${prefix}.latestReleaseBlock`);
  }

  if (!['fresh', 'stale-cache', 'indexer-outage', 'rpc-outage', 'empty'].includes(catalog.meta.state)) throw new Error('meta.state is invalid');
  if (typeof catalog.meta.cacheAvailable !== 'boolean') throw new Error('meta.cacheAvailable must be a boolean');
  if (catalog.meta.indexedAt !== null) assertString(catalog.meta.indexedAt, 'meta.indexedAt');
  if (catalog.meta.lastIndexedBlock !== null) assertNumber(catalog.meta.lastIndexedBlock, 'meta.lastIndexedBlock');
  if (catalog.meta.chainHeadBlock !== null) assertNumber(catalog.meta.chainHeadBlock, 'meta.chainHeadBlock');
  if (catalog.meta.blockLag !== null) assertNumber(catalog.meta.blockLag, 'meta.blockLag');
  assertNumber(catalog.meta.staleAfterMs, 'meta.staleAfterMs');
  if (catalog.meta.lastErrorCode !== null && !['CATALOG_INDEXER_UNAVAILABLE', 'CHAIN_RPC_UNAVAILABLE'].includes(catalog.meta.lastErrorCode)) {
    throw new Error('meta.lastErrorCode is invalid');
  }
}

function toBootstrapCatalog(catalog) {
  return {
    ...catalog,
    meta: {
      ...catalog.meta,
      state: 'stale-cache',
      cacheAvailable: true,
      lastErrorCode: null
    }
  };
}

function renderCatalogModule(productId, catalog) {
  const serialized = JSON.stringify(catalog, null, 2);
  return [
    '// Generated by npm run generate:product-catalog-bootstrap. Do not edit manually.',
    "import type { CatalogApiResponse } from './catalog';",
    '',
    `export const PRODUCT_DEVNET_BOOTSTRAP_PRODUCT_ID = ${JSON.stringify(productId)};`,
    '',
    `export const PRODUCT_DEVNET_BOOTSTRAP_CATALOG: CatalogApiResponse = ${serialized};`,
    ''
  ].join('\n');
}

async function formatSource(source, path) {
  try {
    const prettier = await import('prettier');
    const config = (await prettier.resolveConfig(path)) ?? {};
    return await prettier.format(source, { ...config, parser: 'typescript' });
  } catch {
    return source;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await readEnvFile(args.envPath);
  const productId = (args.productId || process.env.VITE_DOTIFY_PRODUCT_ID || env.VITE_DOTIFY_PRODUCT_ID || '').trim();
  const apiUrl = normalizeBaseUrl(args.apiUrl || process.env.CATALOG_API_URL || process.env.VITE_DOTIFY_API_URL || env.VITE_DOTIFY_API_URL || '');

  if (!productId) throw new Error('Product id is required. Set VITE_DOTIFY_PRODUCT_ID in .env.product-devnet or pass --product-id.');

  let catalog;
  try {
    if (!args.inputPath && !apiUrl) throw new Error('Catalog API URL is required. Set VITE_DOTIFY_API_URL, CATALOG_API_URL, or pass --api-url.');
    catalog = args.inputPath ? await readCatalogInput(args.inputPath) : await fetchCatalog(apiUrl, args.limit);
  } catch (error) {
    if (!args.strict && (await fileExists(args.outPath))) {
      console.warn(`warn - catalog bootstrap refresh skipped: ${error.message}`);
      console.warn(`warn - keeping existing ${args.outPath}`);
      return;
    }
    throw error;
  }

  validateCatalog(catalog);
  const bootstrapCatalog = toBootstrapCatalog(catalog);
  const source = await formatSource(renderCatalogModule(productId, bootstrapCatalog), args.outPath);
  await writeFile(args.outPath, source, 'utf8');
  console.log(`ok - wrote ${bootstrapCatalog.items.length} catalog items to ${args.outPath}`);
}

main().catch(error => {
  console.error(`Product catalog bootstrap generation failed: ${error.message}`);
  process.exitCode = 1;
});
