#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEPLOY_PACKAGE = '@parity/polkadot-app-deploy';
const DEPLOY_VERSION = '0.20.0';
const BUILD_DIR = './dist-product';
const DOMAIN = 'dotify-test01.dot';
const ENVIRONMENT = 'devnet';
const CONFIG_PATH = './polkadot-app-deploy.config.ts';
const DEFAULT_POOL_SIZE = 10;

function padPackageRoot() {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const output = execFileSync(locator, ['pad'], { encoding: 'utf8' }).trim();
  const executable = output.split(/\r?\n/)[0];
  if (!executable) throw new Error('pad is not available on PATH. Run through npm exec --package.');
  return resolve(realpathSync(executable), '..', '..');
}

async function importDeployPackage() {
  const packageRoot = padPackageRoot();
  const index = await import(pathToFileURL(resolve(packageRoot, 'dist/index.js')).href);
  const deployModule = await import(pathToFileURL(resolve(packageRoot, 'dist/deploy.js')).href);
  return { index, deployModule };
}

function parsePoolIndex(value) {
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`BULLETIN_POOL_ACCOUNT_INDEX must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}

function selectStorageAccount(index, derivePoolAccounts) {
  const poolSize = Math.max(DEFAULT_POOL_SIZE, index + 1);
  const accounts = derivePoolAccounts(poolSize, process.env.BULLETIN_POOL_MNEMONIC);
  const account = accounts[index];
  if (!account) throw new Error(`No Bulletin pool account at index ${index}.`);
  return account;
}

async function run() {
  const mnemonic = process.env.MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error('MNEMONIC is required for Product DevNet deploy. Provide it in the local terminal only.');
  }

  const { index, deployModule } = await importDeployPackage();
  const packageJson = await import(pathToFileURL(resolve(padPackageRoot(), 'package.json')).href, { with: { type: 'json' } });
  if (packageJson.default.name !== DEPLOY_PACKAGE || packageJson.default.version !== DEPLOY_VERSION) {
    throw new Error(`Expected ${DEPLOY_PACKAGE}@${DEPLOY_VERSION}, found ${packageJson.default.name}@${packageJson.default.version}.`);
  }

  const poolIndex = parsePoolIndex(process.env.BULLETIN_POOL_ACCOUNT_INDEX);
  const storageAccount = selectStorageAccount(poolIndex, index.derivePoolAccounts);
  console.log(`Bulletin storage signer (DevNet pool account ${poolIndex}, not your DotNS owner): ${storageAccount.address}`);
  console.log('The MNEMONIC account signs DotNS updates; this separate pool account uploads Bulletin bytes.');

  const [loadedConfig, environments] = await Promise.all([
    index.preflightProductConfig({ path: CONFIG_PATH }),
    index.loadEnvironments({ userFilePath: process.env.PAD_ENV_FILE })
  ]);
  const resolved = index.resolveEndpoints(environments.doc, ENVIRONMENT);
  const envTld = resolved.tld ?? 'dot';
  if (!loadedConfig) throw new Error(`Product config is required at ${CONFIG_PATH}.`);
  index.reconcileManifestDomain(loadedConfig.config.domain, DOMAIN, envTld, loadedConfig.sourcePath);
  const manifestWillPublish = deployModule.shouldPublishManifest({ configFound: true, noManifest: false });

  const result = await index.deploy(BUILD_DIR, DOMAIN, {
    mnemonic,
    env: ENVIRONMENT,
    jsMerkle: true,
    manifestPending: manifestWillPublish,
    transferToSignedInUser: false,
    storageSigner: storageAccount.signer,
    storageSignerAddress: storageAccount.address
  });

  console.log(`CID: ${result.cid}`);
  console.log(`Domain: ${result.fullDomain}`);

  if (manifestWillPublish) {
    await index.publishManifest({
      loaded: loadedConfig,
      domain: DOMAIN,
      buildDirCid: { absPath: resolve(BUILD_DIR), cid: result.cid },
      env: ENVIRONMENT,
      mnemonic,
      storageSigner: storageAccount.signer,
      storageSignerAddress: storageAccount.address
    });
    deployModule.printDeploymentCompleteBanner(result.fullDomain, result.browserUrl);
  }
}

run().catch(error => {
  console.error(`Product DevNet deploy failed: ${error?.message ?? error}`);
  process.exitCode = 1;
});
