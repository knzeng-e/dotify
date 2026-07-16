#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = resolve(webRoot, 'node_modules/vite/bin/vite.js');
const smokeOutDir = resolve(webRoot, 'dist-production-env-smoke');

const validatedEnvKeys = [
  'DOTIFY_DEPLOYMENT',
  'VITE_BLOCKSCOUT_BASE_URL',
  'VITE_BULLETIN_WS_URL',
  'VITE_CONTENT_SECRET',
  'VITE_DOTIFY_API_URL',
  'VITE_DOTIFY_DEPLOYMENT',
  'VITE_ETH_RPC_URL',
  'VITE_IPFS_READ_GATEWAYS',
  'VITE_PINATA_GATEWAY',
  'VITE_PINATA_JWT',
  'VITE_SIGNAL_URL',
  'VITE_TURN_URL',
  'VITE_WS_URL'
];

const safeProductionEnv = {
  VITE_DOTIFY_DEPLOYMENT: 'production',
  VITE_SIGNAL_URL: 'https://dotify-signal.example',
  VITE_DOTIFY_API_URL: 'https://dotify-api.example',
  VITE_PINATA_GATEWAY: 'https://gateway.example',
  VITE_IPFS_READ_GATEWAYS: 'https://paseo-ipfs.example,https://dweb.example'
};

const cases = [
  {
    name: 'missing production endpoints fails closed',
    env: {
      VITE_DOTIFY_DEPLOYMENT: 'production'
    },
    expectSuccess: false,
    expectedOutput: [
      'VITE_SIGNAL_URL is required when VITE_DOTIFY_DEPLOYMENT=production.',
      'VITE_DOTIFY_API_URL is required when VITE_DOTIFY_DEPLOYMENT=production.',
      'VITE_PINATA_GATEWAY is required when VITE_DOTIFY_DEPLOYMENT=production.',
      'VITE_IPFS_READ_GATEWAYS is required when VITE_DOTIFY_DEPLOYMENT=production.'
    ]
  },
  {
    name: 'browser-exposed production secrets fail closed',
    env: {
      ...safeProductionEnv,
      VITE_PINATA_JWT: 'browser-visible-pinata-jwt',
      VITE_CONTENT_SECRET: `0x${'11'.repeat(32)}`
    },
    expectSuccess: false,
    expectedOutput: [
      'VITE_PINATA_JWT is browser-exposed and must not be set for production builds.',
      'VITE_CONTENT_SECRET is bundled into the browser and must not be set for production builds.'
    ]
  },
  {
    name: 'safe public production env builds',
    env: safeProductionEnv,
    expectSuccess: true,
    expectedOutput: []
  }
];

function buildCaseEnv(overrides) {
  const env = { ...process.env, CI: '1' };
  for (const key of validatedEnvKeys) env[key] = '';
  return { ...env, ...overrides };
}

function runViteBuild(testCase) {
  return new Promise(resolveCase => {
    const child = spawn(process.execPath, [viteBin, 'build', '--mode', 'production-env-smoke', '--outDir', smokeOutDir, '--emptyOutDir'], {
      cwd: webRoot,
      env: buildCaseEnv(testCase.env),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', error => {
      resolveCase({ code: 1, output: error.message });
    });
    child.on('close', code => {
      resolveCase({ code: code ?? 1, output: `${stdout}\n${stderr}`.trim() });
    });
  });
}

function assertCaseResult(testCase, result) {
  const succeeded = result.code === 0;
  if (testCase.expectSuccess !== succeeded) {
    throw new Error(
      [`${testCase.name}: expected ${testCase.expectSuccess ? 'success' : 'failure'}, got exit ${result.code}.`, result.output].filter(Boolean).join('\n')
    );
  }

  for (const expected of testCase.expectedOutput) {
    if (!result.output.includes(expected)) {
      throw new Error(`${testCase.name}: missing expected output "${expected}".\n${result.output}`);
    }
  }
}

async function cleanup() {
  await rm(smokeOutDir, { force: true, recursive: true });
}

try {
  await cleanup();
  for (const testCase of cases) {
    const result = await runViteBuild(testCase);
    assertCaseResult(testCase, result);
    console.log(`ok - ${testCase.name}`);
  }
  console.log('Dotify production environment smoke passed');
} catch (error) {
  console.error(`Dotify production environment smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
