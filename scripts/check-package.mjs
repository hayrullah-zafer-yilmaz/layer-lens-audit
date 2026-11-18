import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
const pathOf = (file) => fileURLToPath(new URL(file, dist));
const require = createRequire(import.meta.url);
const FUNCTIONS = ['audit', 'inspect', 'installInspector', 'createLayerLensAudit'];

const esm = await import(new URL('index.js', dist).href);
const cjs = require(pathOf('index.cjs'));

for (const [format, module] of [['ESM', esm], ['CJS', cjs]]) {
  for (const name of FUNCTIONS) assert.equal(typeof module[name], 'function', `${format}: no ${name}`);
  assert.equal(module.DEFAULT_LIMITS?.elements, 1400, `${format}: no DEFAULT_LIMITS`);
  assert.equal(module.DEFAULT_SHORTCUT, 'Alt+Shift+L', `${format}: no DEFAULT_SHORTCUT`);
}

const context = vm.createContext({});
vm.runInContext(await readFile(pathOf('layer-lens-audit.global.js'), 'utf8'), context);
for (const name of FUNCTIONS) {
  assert.equal(typeof context.LayerLensAudit?.[name], 'function', `script tag: no LayerLensAudit.${name}`);
}

const viteEsm = await import(new URL('vite.js', dist).href);
const viteCjs = require(pathOf('vite.cjs'));
for (const [format, module] of [['ESM', viteEsm], ['CJS', viteCjs]]) {
  assert.equal(module.layerLensAudit?.().name, 'layer-lens-audit', `${format}: layer-lens-audit/vite has no layerLensAudit plugin`);
}

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const cli = await readFile(pathOf('cli.js'), 'utf8');
assert.equal(manifest.bin?.['layer-lens-audit'], './dist/cli.js', 'package.json: no layer-lens-audit bin');
assert.ok(cli.startsWith('#!/usr/bin/env node'), 'cli.js: no shebang');

console.log(
  'Package OK: ESM, CommonJS and the script tag expose the API, layer-lens-audit/vite loads, and the layer-lens-audit command is in place.'
);
