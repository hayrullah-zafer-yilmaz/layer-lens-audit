import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).href;
const bundle = fileURLToPath(new URL('../dist/layer-lens-audit.global.js', import.meta.url));

declare global {
  interface Window {
    LayerLensAudit: typeof import('../src/index');
  }
}

async function load(page: Page, name: string) {
  await page.goto(fixture(name));
  await page.addScriptTag({ path: bundle });
}

test('reports exactly the elements that can go, and leaves the page as it was', async ({ page }) => {
  await load(page, 'cases.html');
  const before = await page.evaluate(() => document.documentElement.outerHTML);

  const result = await page.evaluate(async () => {
    const report = await window.LayerLensAudit.audit();
    const flagged = report.findings
      .filter((finding) => finding.kind === 'redundant-wrappers' || finding.kind === 'empty-element')
      .flatMap((finding) => finding.elements.map((element) => ({ element, finding })));
    const flaggedSet = new Set(flagged.map(({ element }) => element));
    const describe = (element: Element) => `${element.closest('section')?.id ?? '?'}: ${element.outerHTML.slice(0, 80)}`;

    return {
      unexpected: flagged.filter(({ element }) => !element.classList.contains('expect-flag')).map(({ element }) => describe(element)),
      missed: [...document.querySelectorAll('.expect-flag')].filter((element) => !flaggedSet.has(element)).map(describe),
      wrongConfidence: flagged
        .filter(({ element, finding }) => (finding.confidence === 'medium') !== element.classList.contains('expect-medium'))
        .map(({ element }) => describe(element)),
      chainLengths: report.findings.filter((finding) => finding.kind === 'redundant-wrappers').map((finding) => finding.elements.length),
      vue: report.findings.find((finding) => finding.elements[0]?.classList.contains('from-vue'))?.source ?? null,
      removable: report.removable,
      scroll: [scrollX, scrollY]
    };
  });

  expect(result.unexpected, 'reported but needed').toEqual([]);
  expect(result.missed, 'could go but not reported').toEqual([]);
  expect(result.wrongConfidence, 'confidence').toEqual([]);
  expect(result.chainLengths).toContain(2);
  expect(result.vue).toEqual({ framework: 'vue', component: 'ProductCard', file: '/src/components/ProductCard.vue', line: null });
  expect(result.scroll).toEqual([0, 0]);

  const after = await page.evaluate(() => document.documentElement.outerHTML);
  expect(after).toBe(before);
});

test('reports DOM size, depth and wide parents against the limits', async ({ page }) => {
  await load(page, 'cases.html');
  const kinds = await page.evaluate(async () => {
    const report = await window.LayerLensAudit.audit({ limits: { elements: 10, depth: 3, children: 5 } });
    return report.findings.map((finding) => finding.kind);
  });

  expect(kinds).toContain('dom-size');
  expect(kinds).toContain('deep-nesting');
  expect(kinds).toContain('wide-parent');
});

test('the JSON report holds selectors instead of elements', async ({ page }) => {
  await load(page, 'cases.html');
  const json = await page.evaluate(async () => JSON.parse(JSON.stringify(await window.LayerLensAudit.audit())));

  expect(json.removable).toBeGreaterThan(0);
  expect(typeof json.findings[0].selector).toBe('string');
  for (const finding of json.findings) {
    for (const selector of finding.selectors) {
      const count = await page.evaluate((query) => document.querySelectorAll(query).length, selector);
      expect(count, selector).toBe(1);
    }
  }
});
