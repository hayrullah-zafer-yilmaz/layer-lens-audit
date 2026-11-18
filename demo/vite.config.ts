import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: [{ find: /^layer-lens-audit$/, replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)) }]
  }
});
