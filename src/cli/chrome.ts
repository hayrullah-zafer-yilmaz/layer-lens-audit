import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const MAC = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
];
const LINUX = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
const WINDOWS = [
  ['PROGRAMFILES', 'Google\\Chrome\\Application\\chrome.exe'],
  ['PROGRAMFILES(X86)', 'Google\\Chrome\\Application\\chrome.exe'],
  ['LOCALAPPDATA', 'Google\\Chrome\\Application\\chrome.exe'],
  ['PROGRAMFILES', 'Microsoft\\Edge\\Application\\msedge.exe'],
  ['PROGRAMFILES(X86)', 'Microsoft\\Edge\\Application\\msedge.exe']
];

function onPath(name: string): string | null {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, name);
    if (directory && existsSync(candidate)) return candidate;
  }
  return null;
}

export function findChrome(): string | null {
  const fromEnvironment = process.env.CHROME_PATH;
  if (fromEnvironment && existsSync(fromEnvironment)) return fromEnvironment;

  if (process.platform === 'darwin') return MAC.find((path) => existsSync(path)) ?? null;
  if (process.platform === 'win32') {
    for (const [variable, rest] of WINDOWS) {
      const base = process.env[variable!];
      if (base && existsSync(join(base, rest!))) return join(base, rest!);
    }
    return null;
  }
  for (const name of LINUX) {
    const found = onPath(name);
    if (found) return found;
  }
  return null;
}

export interface Chrome {
  endpoint: string;
  close(): Promise<void>;
}

const STARTUP_TIMEOUT = 20_000;

export async function launchChrome(path: string): Promise<Chrome> {
  const profile = await mkdtemp(join(tmpdir(), 'layer-lens-audit-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank'
  ];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');

  const child: ChildProcess = spawn(path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));

  const close = async () => {
    if (child.exitCode === null) child.kill();
    await exited;
    await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  };

  try {
    const endpoint = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Chrome did not start in time.')), STARTUP_TIMEOUT);
      child.stderr!.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Chrome stopped before it was ready (exit code ${code}).`));
      });
    });
    return { endpoint, close };
  } catch (error) {
    await close();
    throw error;
  }
}
