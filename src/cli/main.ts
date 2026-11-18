import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { formatMarkdown, formatText, type ReportData, type Viewport } from '../format';
import { messagesFor } from '../i18n';
import { baselineOf, combine, compareWithBaseline, countForLimit, type Baseline } from './combine';
import { runAudits } from './run';

const HELP = `Usage: layer-lens-audit <url or file> [options]

Finds wrappers that draw nothing and change nothing, empty elements, and DOM
that is too big. The page is opened in Chrome at each screen size, and only
what can go at every one of them is reported.

Options:
  --viewports <sizes>    Screen sizes, comma-separated (default: 390x844,1440x900)
  --root <selector>      Where to look (default: body)
  --ignore <selector>    Leave these elements out, with everything inside them
  --wait <ms>            Wait this long after the page loads (default: 1000)
  --wait-for <selector>  Wait until this element is on the page
  --format <format>      text, markdown or json (default: text)
  --output <file>        Also write the report to this file
  --max <count>          Exit with 1 when more than this many elements can go
  --baseline <file>      Only count elements that are not in this baseline
  --update-baseline      Save what can go now as the baseline, in --baseline
  --locale <en|tr>       Language of the report (default: the system's)
  --chrome <path>        Chrome, Chromium or Edge to use
                         (default: CHROME_PATH, then the usual install places)
  -v, --version
  -h, --help

Exit codes: 0 when all is well, 1 when --max is exceeded, 2 on errors.

Examples:
  npx layer-lens-audit http://localhost:5173
  npx layer-lens-audit localhost:3000/products --wait-for "#app main" --format markdown
  npx layer-lens-audit http://localhost:5173 --baseline layer-lens-audit.json --update-baseline
  npx layer-lens-audit http://localhost:5173 --baseline layer-lens-audit.json --max 0`;

class UsageError extends Error {}

const DEFAULT_VIEWPORTS = '390x844,1440x900';

function viewportsOf(value: string): Viewport[] {
  return value.split(',').map((part) => {
    const match = /^\s*(\d{2,5})\s*[x×]\s*(\d{2,5})\s*$/i.exec(part);
    if (!match) throw new UsageError(`"${part.trim()}" is not a screen size such as 390x844.`);
    return { width: Number(match[1]), height: Number(match[2]) };
  });
}

function targetOf(value: string): string {
  if (/^(?:https?|file):/i.test(value)) return value;
  const path = resolve(value);
  if (existsSync(path)) return pathToFileURL(path).href;
  return `http://${value}`;
}

function numberOption(value: string | undefined, name: string, fallback?: number): number | undefined {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new UsageError(`--${name} needs a whole number, not "${value}".`);
  return parsed;
}

function version(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  return manifest.version;
}

async function readBaseline(file: string): Promise<Baseline> {
  const data = JSON.parse(await readFile(file, 'utf8')) as Partial<Baseline>;
  if (data.version !== 1 || !Array.isArray(data.elements)) throw new UsageError(`${file} is not a layer-lens-audit baseline.`);
  return data as Baseline;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      viewports: { type: 'string' },
      root: { type: 'string' },
      ignore: { type: 'string' },
      wait: { type: 'string' },
      'wait-for': { type: 'string' },
      format: { type: 'string' },
      output: { type: 'string' },
      max: { type: 'string' },
      baseline: { type: 'string' },
      'update-baseline': { type: 'boolean' },
      locale: { type: 'string' },
      chrome: { type: 'string' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.version) {
    console.log(version());
    return 0;
  }

  const [input] = positionals;
  if (!input) throw new UsageError('Give the address of the page to audit.');
  const format = values.format ?? 'text';
  if (!['text', 'markdown', 'json'].includes(format)) throw new UsageError(`--format is text, markdown or json, not "${format}".`);
  if (values['update-baseline'] && !values.baseline) throw new UsageError('--update-baseline needs --baseline <file>.');

  const text = messagesFor(values.locale ?? process.env.LC_ALL ?? process.env.LANG);
  const max = numberOption(values.max, 'max');

  const runs = await runAudits({
    url: targetOf(input),
    viewports: viewportsOf(values.viewports ?? DEFAULT_VIEWPORTS),
    root: values.root,
    ignore: values.ignore,
    locale: text.locale,
    wait: numberOption(values.wait, 'wait', 1000)!,
    waitFor: values['wait-for'],
    chrome: values.chrome
  });

  let report: ReportData = combine(runs, text);

  if (values['update-baseline']) {
    const baseline = baselineOf(report);
    await writeFile(values.baseline!, `${JSON.stringify(baseline, null, 2)}\n`);
    process.stdout.write(formatText(report, text, colors()));
    console.log(text.baselineSaved(text.number(baseline.elements.length), values.baseline!));
    return 0;
  }
  if (values.baseline) report = compareWithBaseline(report, await readBaseline(values.baseline));

  const rendered =
    format === 'json'
      ? `${JSON.stringify(report, null, 2)}\n`
      : format === 'markdown'
        ? formatMarkdown(report, text)
        : formatText(report, text, colors());
  process.stdout.write(rendered);
  if (values.output) await writeFile(values.output, format === 'text' ? formatText(report, text, false) : rendered);

  const count = countForLimit(report);
  if (max !== undefined && count > max) {
    console.error(text.overLimit(text.number(count), text.number(max), report.baseline !== undefined));
    return 1;
  }
  return 0;
}

const colors = () => Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`layer-lens-audit: ${message}`);
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      console.error('Run layer-lens-audit --help to see the options.');
    }
    process.exitCode = 2;
  }
);
