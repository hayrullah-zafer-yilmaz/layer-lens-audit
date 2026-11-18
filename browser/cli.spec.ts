import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const fixture = new URL('./fixtures/cases.html', import.meta.url).href;

function run(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [cli, fixture, '--wait', '0', ...args], { timeout: 90_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

test('reports only the elements that can go at every screen size', async ({ page }) => {
  const { code, stdout } = await run('--format', 'json');
  expect(code).toBe(0);

  const report = JSON.parse(stdout);
  expect(report.viewports).toEqual([
    { width: 390, height: 844 },
    { width: 1440, height: 900 }
  ]);
  expect(report.removable).toBeGreaterThan(0);

  await page.goto(fixture);
  for (const finding of report.findings) {
    for (const selector of finding.selectors) {
      const matches = await page.locator(selector).evaluateAll((elements) => elements.map((element) => element.className));
      expect(matches, selector).toHaveLength(1);
      expect(matches[0], selector).toContain('expect-flag');
    }
  }
});

test('fails with --max, and only on new elements with a baseline', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'layer-lens-audit-test-'));
  const baseline = join(folder, 'baseline.json');
  try {
    const strict = await run('--viewports', '1280x800', '--max', '0');
    expect(strict.code).toBe(1);
    expect(strict.stderr).toContain('more than the 0 allowed');

    const saved = await run('--viewports', '1280x800', '--baseline', baseline, '--update-baseline');
    expect(saved.code).toBe(0);
    expect(JSON.parse(await readFile(baseline, 'utf8')).elements.length).toBeGreaterThan(0);

    const later = await run('--viewports', '1280x800', '--baseline', baseline, '--max', '0');
    expect(later.code).toBe(0);
    expect(later.stdout).toContain('None of them is new since the baseline.');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('writes Turkish Markdown when asked to', async () => {
  const { code, stdout } = await run('--viewports', '1280x800', '--format', 'markdown', '--locale', 'tr');
  expect(code).toBe(0);
  expect(stdout).toContain('| Bulgu | Nerede | Seçici | Kontrol |');
  expect(stdout).toContain('1280 × 800 boyutunda ölçüldü.');
});

test('explains a mistake and exits with 2', async () => {
  const { code, stderr } = await run('--format', 'pdf');
  expect(code).toBe(2);
  expect(stderr).toContain('--format is text, markdown or json');
});
