import { readFile } from 'node:fs/promises';
import type { AuditJson } from '../audit/report';
import type { Viewport } from '../format';
import { connect } from './cdp';
import { findChrome, launchChrome } from './chrome';
import type { ViewportRun } from './combine';

export interface RunOptions {
  url: string;
  viewports: Viewport[];
  root?: string;
  ignore?: string;
  locale: string;
  wait: number;
  waitFor?: string;
  chrome?: string;
  timeout?: number;
}

interface Evaluation {
  result: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

const BUNDLE = new URL('./layer-lens-audit.global.js', import.meta.url);
const POLL = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runAudits(options: RunOptions): Promise<ViewportRun[]> {
  const path = options.chrome ?? findChrome();
  if (!path) {
    throw new Error('could not find Chrome, Chromium or Edge. Install one, or pass --chrome <path> or set CHROME_PATH.');
  }

  const bundle = await readFile(BUNDLE, 'utf8');
  const timeout = options.timeout ?? 30_000;
  const chrome = await launchChrome(path);

  try {
    const cdp = await connect(chrome.endpoint);
    try {
      const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
      const page = <T>(method: string, params?: Record<string, unknown>) => cdp.send<T>(method, params, sessionId);
      const evaluate = async (expression: string) => {
        const response = await page<Evaluation>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        const failure = response.exceptionDetails;
        if (failure) throw new Error(failure.exception?.description ?? failure.text ?? 'a script failed in the page.');
        return response.result.value;
      };

      await page('Page.enable');
      await page('Runtime.enable');

      const runs: ViewportRun[] = [];
      for (const [index, viewport] of options.viewports.entries()) {
        await page('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.width < 768
        });

        const loaded = cdp.next('Page.loadEventFired', sessionId, timeout);
        try {
          if (index === 0) {
            const navigation = await page<{ errorText?: string }>('Page.navigate', { url: options.url });
            if (navigation.errorText) throw new Error(`could not open ${options.url}: ${navigation.errorText}`);
          } else {
            await page('Page.reload');
          }
          await loaded;
        } catch (error) {
          loaded.cancel();
          throw error;
        }

        if (options.waitFor) {
          const started = Date.now();
          const selector = JSON.stringify(options.waitFor);
          while (!(await evaluate(`document.querySelector(${selector}) !== null`))) {
            if (Date.now() - started > timeout) throw new Error(`${options.waitFor} did not appear on the page.`);
            await sleep(POLL);
          }
        }
        if (options.wait > 0) await sleep(options.wait);

        await evaluate(`${bundle};undefined`);
        const settings = JSON.stringify({ root: options.root, ignore: options.ignore, locale: options.locale });
        const report = (await evaluate(`LayerLensAudit.audit(${settings}).then((report) => report.toJSON())`)) as AuditJson;
        runs.push({ viewport, report });
      }
      return runs;
    } finally {
      cdp.close();
    }
  } finally {
    await chrome.close();
  }
}
