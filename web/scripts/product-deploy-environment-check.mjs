#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCT_DEPLOY_PROFILE = {
  packageName: '@polkadot-community-foundation/polkadot-app-deploy',
  cliVersion: '0.16.7',
  environmentId: 'devnet',
  ipfs: 'https://devnet-ipfs.api.polkadotcommunity.foundation',
  webGateway: 'dev-dot.li',
  contracts: {
    DOTNS_REGISTRY: '0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73',
    DOTNS_CONTENT_RESOLVER: '0x7e75491ecfb04900EB05ee63CABA2B33900aABB5',
    PUBLISHER: '0xaab42efbe8ea4d4228c3a11e973f94c17b9a0f2c'
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

function findPadPackageRoot() {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const output = execFileSync(locator, ['pad'], { encoding: 'utf8' }).trim();
  const executable = output.split(/\r?\n/)[0];
  if (!executable) throw new Error('pad is not available on PATH. Run this check through npm exec --package.');

  return resolve(dirname(executable), '..', PRODUCT_DEPLOY_PROFILE.packageName);
}

function run() {
  const packageRoot = findPadPackageRoot();
  const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  const environments = JSON.parse(readFileSync(resolve(packageRoot, 'assets/environments.json'), 'utf8'));
  const result = evaluateProductDeployEnvironment({ packageJson, environments });

  if (result.errors.length > 0) {
    console.error('Product deploy environment preflight failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Product deploy environment aligned: CLI ${PRODUCT_DEPLOY_PROFILE.cliVersion}, ` +
      `${PRODUCT_DEPLOY_PROFILE.environmentId}, registry ${PRODUCT_DEPLOY_PROFILE.contracts.DOTNS_REGISTRY}, ` +
      `content resolver ${PRODUCT_DEPLOY_PROFILE.contracts.DOTNS_CONTENT_RESOLVER}, ` +
      `publisher ${PRODUCT_DEPLOY_PROFILE.contracts.PUBLISHER}.`
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) run();
