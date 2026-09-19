import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

import { assertProductionEnvironment } from './src/shared/config/deploymentSafety';
import { assertCleanEvidenceBuild, computeBuildConfigDigest, readGitBuildIdentity, resolveEmbeddedBuildIdentity } from './scripts/build-identity.mjs';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (command === 'build') assertProductionEnvironment(env);
  const gitIdentity = readGitBuildIdentity(__dirname);
  assertCleanEvidenceBuild(command, env, gitIdentity);
  const buildIdentity = resolveEmbeddedBuildIdentity(command, env, gitIdentity);
  const buildConfigDigest = computeBuildConfigDigest(mode, env);

  return {
    base: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_DOTIFY_BUILD_SHA': JSON.stringify(buildIdentity.gitSha),
      'import.meta.env.VITE_DOTIFY_BUILD_CLEAN': JSON.stringify(String(buildIdentity.clean)),
      'import.meta.env.VITE_DOTIFY_BUILD_CONFIG_DIGEST': JSON.stringify(buildConfigDigest)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      }
    }
  };
});
