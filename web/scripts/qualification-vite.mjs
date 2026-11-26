import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The qualification server does not scan the listener app or its chain graph.
// Production compilation has its own clean-source and rendered-module guards.
export default defineConfig({
  plugins: [react()],
  cacheDir: 'node_modules/.vite-qualification',
  optimizeDeps: {
    // Explicitly include gesture-loaded SDK entries so parallel browser contexts
    // cannot discover a new shared chunk and reload another context mid-read.
    noDiscovery: true,
    include: [
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      '@parity/product-sdk/host',
      '@parity/product-sdk/address',
      '@parity/product-sdk-host/testing',
      'neverthrow'
    ],
    esbuildOptions: { target: 'esnext' }
  },
  build: { target: 'esnext' }
});
