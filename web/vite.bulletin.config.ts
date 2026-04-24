import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bulletin Chain build — produces a single self-contained index.html.
// All JS chunks and CSS are inlined so the app works when served from a
// flat IPFS CID with no directory structure.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist-bulletin',
    target: 'esnext',
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
