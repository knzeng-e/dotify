import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

import { assertProductionEnvironment } from './src/shared/config/deploymentSafety';

// Product DevNet keeps Vite's normal multi-file output so `pad` can upload
// changed chunks incrementally on later releases.
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (command === 'build') assertProductionEnvironment(env);

  return {
    base: './',
    plugins: [react()],
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
