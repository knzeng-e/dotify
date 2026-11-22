import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The qualification server does not scan the listener app or its chain graph.
// Production compilation has its own clean-source and rendered-module guards.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ['qualification.html', 'account-qualification.html', 'e2e/fixtures/host-qualification.html', 'e2e/fixtures/account-qualification.html'],
    esbuildOptions: { target: 'esnext' }
  },
  build: { target: 'esnext' }
});
