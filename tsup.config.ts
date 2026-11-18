import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', vite: 'src/vite.ts' },
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true
  },
  {
    entry: { 'layer-lens-audit': 'src/index.ts' },
    format: ['iife'],
    globalName: 'LayerLensAudit',
    target: 'es2022',
    minify: true,
    sourcemap: true
  },
  {
    entry: { cli: 'src/cli/main.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    banner: { js: '#!/usr/bin/env node' }
  }
]);
