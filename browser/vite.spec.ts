import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';

const root = fileURLToPath(new URL('./fixtures/vite-app/', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

let server: ViteDevServer;
let url: string;

test.beforeAll(async () => {
  const { layerLensAudit } = (await import(new URL('../dist/vite.js', import.meta.url).href)) as typeof import('../src/vite');
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [layerLensAudit({ root: '#app', locale: 'en' })],
    resolve: { alias: { 'layer-lens-audit': `${dist}index.js` } },
    server: { port: 0, fs: { allow: [root, dist] } }
  });
  await server.listen();
  url = server.resolvedUrls!.local[0]!;
});

test.afterAll(async () => {
  await server?.close();
});

test('the Vite plugin adds the inspector to the dev server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(url);
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete');
  await page.keyboard.press('Alt+Shift+KeyL');

  const panel = page.locator('[data-layer-lens-audit-ui]').locator('.panel');
  await expect(panel.locator('.scope')).toHaveText('main#app');
  await expect(panel.locator('.finding .title').first()).toHaveText("2 nested wrappers aren't needed");
  expect(errors).toEqual([]);
});
