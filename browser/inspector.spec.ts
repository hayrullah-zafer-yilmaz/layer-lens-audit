import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = new URL('./fixtures/cases.html', import.meta.url).href;
const bundle = fileURLToPath(new URL('../dist/layer-lens-audit.global.js', import.meta.url));

async function open(page: Page) {
  await page.goto(fixture);
  await page.addScriptTag({ path: bundle });
  const before = await page.evaluate(() => document.documentElement.outerHTML);
  await page.evaluate(async () => {
    await window.LayerLensAudit.inspect().ready;
  });
  return before;
}

const panel = (page: Page) => page.locator('[data-layer-lens-audit-ui]').locator('.panel');

test('lists the findings in a panel that the page cannot style', async ({ page }) => {
  await open(page);

  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('.headline strong')).not.toHaveText('0');
  const titles = await panel(page).locator('.finding .title').allTextContents();
  expect(titles.some((title) => title.includes("2 nested wrappers aren't needed"))).toBe(true);
  expect(titles.some((title) => title.startsWith("This empty div isn't needed"))).toBe(true);
  await expect(panel(page).locator('.where', { hasText: 'ProductCard.vue' })).toBeVisible();
});

test('explains a finding when it is clicked: why, what to do, and the markup before and after', async ({ page }) => {
  await open(page);
  const chain = panel(page).locator('.finding', { hasText: '2 nested wrappers' });
  const main = chain.locator('.main');

  await expect(panel(page).locator('.hint')).toHaveText('Click a finding to see why, and what to do about it.');
  await expect(main).toHaveAttribute('aria-expanded', 'false');
  await main.click();
  await expect(main).toHaveAttribute('aria-expanded', 'true');

  const details = chain.locator('.details');
  await expect(details.locator('.label')).toHaveText(['Why', 'What to do', 'Now', 'After']);
  await expect(details).toContainText('nothing on the page moved');
  await expect(details).toContainText('Delete the wrapper tags and keep what is inside them where it is.');
  await expect(details.locator('pre').first()).toHaveText(
    '<div class="expect-flag">\n  <div class="expect-flag">\n    <p>…</p>\n  </div>\n</div>'
  );
  await expect(details.locator('pre').last()).toHaveText('<p>…</p>');

  const other = panel(page).locator('.finding', { hasText: "This empty div isn't needed" }).first();
  await other.locator('.main').click();
  await expect(chain.locator('.details')).toHaveCount(0);
  await expect(other.locator('.details .label')).toHaveText(['Why', 'What to do']);
  await other.locator('.main').click();
  await expect(other.locator('.details')).toHaveCount(0);
});

test('outlines a finding on the page while it is hovered', async ({ page }) => {
  await open(page);
  const overlayBoxes = page.locator('[data-layer-lens-audit-ui]').locator('.overlay .box:not(.faint)');

  await panel(page).locator('.finding .main').first().hover();
  await expect(overlayBoxes.first()).toBeVisible();

  await page.mouse.move(5, 5);
  await expect(overlayBoxes).toHaveCount(0);
});

test('opens a finding in 3D and puts the page back when it closes', async ({ page }) => {
  const before = await open(page);
  const chain = panel(page).locator('.finding', { hasText: '2 nested wrappers' });

  await chain.locator('.view').click();
  await expect(chain.locator('.view')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[style*="preserve-3d"]').length))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('#chain .expect-flag')].every((el) => (el as HTMLElement).style.backgroundColor !== '')))
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(chain.locator('.view')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[style*="preserve-3d"]').length)).toBe(0);

  await panel(page).locator('button[aria-label="Close layer-lens-audit"]').click();
  await expect(page.locator('[data-layer-lens-audit-ui]')).toHaveCount(0);
  const after = await page.evaluate(() => document.documentElement.outerHTML);
  expect(after).toBe(before);
});

test('opens and closes with the keyboard shortcut', async ({ page }) => {
  await page.goto(fixture);
  await page.addScriptTag({ path: bundle });
  await page.evaluate(() => window.LayerLensAudit.installInspector());

  await page.keyboard.press('Alt+Shift+KeyL');
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Alt+Shift+KeyL');
  await expect(page.locator('[data-layer-lens-audit-ui]')).toHaveCount(0);
});

test.describe('in a Turkish browser', () => {
  test.use({ locale: 'tr-TR' });

  test('speaks Turkish without being told to', async ({ page }) => {
    await open(page);

    await expect(panel(page)).toHaveAttribute('lang', 'tr');
    await expect(panel(page).locator('.headline')).toContainText('eleman kaldırılabilir');
    await expect(panel(page).locator('.finding .title', { hasText: 'İç içe 2 sarmalayıcı gereksiz' }).first()).toBeVisible();
    await expect(panel(page).locator('button[aria-label="layer-lens-audit\'i kapat"]')).toBeVisible();
    await expect(panel(page).locator('.foot')).toContainText('boyutunda');
  });

  test('still speaks English when asked to', async ({ page }) => {
    await page.goto(fixture);
    await page.addScriptTag({ path: bundle });
    await page.evaluate(async () => {
      await window.LayerLensAudit.inspect({ locale: 'en' }).ready;
    });
    await expect(panel(page).locator('.headline')).toContainText('could go');
  });
});

test('zooms the 3D view from the panel, the wheel and the keyboard', async ({ page }) => {
  await open(page);
  const chain = panel(page).locator('.finding', { hasText: '2 nested wrappers' });
  const zoom = panel(page).locator('.zoom');
  const level = zoom.locator('.zoom-level');
  const scale = () =>
    page.evaluate(() => {
      const root = [...document.querySelectorAll<HTMLElement>('*')].find((el) => el.style.transform.includes('rotateX'));
      return Number(/scale3d\(([\d.]+),/.exec(root?.style.transform ?? '')?.[1] ?? 0);
    });

  await expect(zoom).toBeHidden();
  await chain.locator('.view').click();
  await expect(zoom).toBeVisible();
  await expect(level).toHaveText('100%');
  await expect.poll(scale).toBeGreaterThan(0);
  const fitted = await scale();

  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await expect(level).toHaveText('125%');
  await expect.poll(scale).toBeCloseTo(fitted * 1.25, 2);

  await page.mouse.move(400, 400);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -40);
  await page.keyboard.up('Control');
  await expect.poll(async () => parseInt((await level.textContent()) ?? '0', 10)).toBeGreaterThan(125);

  await page.keyboard.press('0');
  await expect(level).toHaveText('100%');

  await page.keyboard.press('Escape');
  await expect(zoom).toBeHidden();
});
