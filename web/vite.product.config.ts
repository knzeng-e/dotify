import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { assertProductionEnvironment } from './src/shared/config/deploymentSafety';
import productDeployConfig from './polkadot-app-deploy.config';
import { assertCleanEvidenceBuild, readGitBuildIdentity } from './scripts/build-identity.mjs';

function productAppVersion(): string {
  const executable = productDeployConfig.executables.find(item => item.kind === 'app');
  return executable ? `[${executable.appVersion.join(', ')}]` : 'unknown';
}

function cdmRegistry(): string {
  try {
    const cdm = JSON.parse(readFileSync(path.resolve(__dirname, '../contracts/evm/cdm.json'), 'utf8'));
    return typeof cdm.registry === 'string' ? cdm.registry : 'unknown';
  } catch {
    return 'unknown';
  }
}

// Product DevNet keeps Vite's normal multi-file output so `pad` can upload
// changed chunks incrementally on later releases.
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (command === 'build') assertProductionEnvironment(env);
  const gitIdentity = readGitBuildIdentity(__dirname);
  assertCleanEvidenceBuild(command, env, gitIdentity);
  const buildSha = String(env.VITE_DOTIFY_BUILD_SHA || '').trim() || gitIdentity.gitSha;
  const buildClean = command === 'serve' && env.VITE_E2E_READINESS_PANEL === 'true' ? true : gitIdentity.clean;

  return {
    base: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_DOTIFY_BUILD_SHA': JSON.stringify(buildSha),
      'import.meta.env.VITE_DOTIFY_BUILD_CLEAN': JSON.stringify(String(buildClean)),
      'import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION': JSON.stringify(productAppVersion()),
      'import.meta.env.VITE_DOTIFY_CDM_REGISTRY': JSON.stringify(cdmRegistry())
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist-product',
      target: 'esnext'
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      }
    }
  };
});
