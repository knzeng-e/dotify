#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCT_DEPLOY_PROFILE = {
  packageName: '@parity/polkadot-app-deploy',
  cliVersion: '0.20.0',
  environmentId: 'devnet',
  ipfs: 'https://devnet-ipfs.api.polkadotcommunity.foundation',
  webGateway: 'dev-dot.li',
  contracts: {
    DOTNS_REGISTRY: '0x527b08a640b527a3dae0C4BE04D7344E430B6E50',
    DOTNS_CONTENT_RESOLVER: '0x326bdE29315199c814B1c58b431D84D16EA5cE41'
  }
};

function normalizeAddress(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function evaluateProductDeployEnvironment({ packageJson, environments }) {
  const errors = [];

  if (packageJson?.name !== PRODUCT_DEPLOY_PROFILE.packageName) {
    errors.push(`Expected package ${PRODUCT_DEPLOY_PROFILE.packageName}, found ${packageJson?.name ?? 'unknown'}.`);
  }
  if (packageJson?.version !== PRODUCT_DEPLOY_PROFILE.cliVersion) {
    errors.push(`Expected CLI ${PRODUCT_DEPLOY_PROFILE.cliVersion}, found ${packageJson?.version ?? 'unknown'}.`);
  }

  const environment = environments?.environments?.find(entry => entry.id === PRODUCT_DEPLOY_PROFILE.environmentId);
  if (!environment) {
    errors.push(`Environment ${PRODUCT_DEPLOY_PROFILE.environmentId} is missing from the deploy CLI.`);
    return { errors, environment: null };
  }

  for (const [name, expected] of Object.entries(PRODUCT_DEPLOY_PROFILE.contracts)) {
    const actual = environment.contracts?.[name];
    if (normalizeAddress(actual) !== normalizeAddress(expected)) {
      errors.push(`Expected ${name}=${expected}, found ${actual ?? 'missing'}.`);
    }
  }

  if (environment.ipfs !== PRODUCT_DEPLOY_PROFILE.ipfs) {
    errors.push(`Expected IPFS gateway ${PRODUCT_DEPLOY_PROFILE.ipfs}, found ${environment.ipfs ?? 'missing'}.`);
  }
  if (environment.webGateway !== PRODUCT_DEPLOY_PROFILE.webGateway) {
    errors.push(`Expected web gateway ${PRODUCT_DEPLOY_PROFILE.webGateway}, found ${environment.webGateway ?? 'missing'}.`);
  }

  return { errors, environment };
}

export function evaluateProductDeployApi({ index, deployModule }) {
  const expectedExports = {
    index: ['derivePoolAccounts', 'preflightProductConfig', 'loadEnvironments', 'resolveEndpoints', 'reconcileManifestDomain', 'deploy', 'publishManifest'],
    deployModule: ['shouldPublishManifest', 'printDeploymentCompleteBanner']
  };
  return Object.entries(expectedExports).flatMap(([moduleName, names]) =>
    names.filter(name => typeof { index, deployModule }[moduleName]?.[name] !== 'function')
      .map(name => `Deploy CLI 0.20.0 is missing ${moduleName}.${name}.`)
  );
}

function findPadPackageRoot() {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const output = execFileSync(locator, ['pad'], { encoding: 'utf8' }).trim();
  const executable = output.split(/\r?\n/)[0];
  if (!executable) throw new Error('pad is not available on PATH. Run this check through npm exec --package.');

  return resolve(dirname(realpathSync(executable)), '..');
}

async function run() {
  const packageRoot = findPadPackageRoot();
  const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  const environments = JSON.parse(readFileSync(resolve(packageRoot, 'assets/environments.json'), 'utf8'));
  const result = evaluateProductDeployEnvironment({ packageJson, environments });

  if (result.errors.length === 0) {
    const [index, deployModule] = await Promise.all([
      import(pathToFileURL(resolve(packageRoot, 'dist/index.js')).href),
      import(pathToFileURL(resolve(packageRoot, 'dist/deploy.js')).href)
    ]);
    result.errors.push(...evaluateProductDeployApi({ index, deployModule }));
  }

  if (result.errors.length > 0) {
    console.error('Product deploy environment preflight failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Product deploy environment aligned: CLI ${PRODUCT_DEPLOY_PROFILE.cliVersion}, ` +
      `${PRODUCT_DEPLOY_PROFILE.environmentId}, registry ${PRODUCT_DEPLOY_PROFILE.contracts.DOTNS_REGISTRY}, ` +
      `content resolver ${PRODUCT_DEPLOY_PROFILE.contracts.DOTNS_CONTENT_RESOLVER}.`
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  run().catch(error => {
    console.error(`Product deploy environment preflight failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
