import { messagesFor } from '../i18n';
import { computedStyles, isOwnUi, isStyled, NON_RENDERING, type StyledElement } from '../shared/dom';
import { StyleLedger } from '../shared/ledger';
import { screen } from './checks';
import { createMeasurer, type Removal } from './measure';
import { buildReport, type AuditLimits, type AuditReport, type Flagged, type Visit } from './report';
import { collectCssFacts, matchable } from './selectors';

export type { AuditLimits } from './report';

export const DEFAULT_LIMITS: Readonly<AuditLimits> = Object.freeze({ elements: 1400, depth: 32, children: 60 });

export interface AuditOptions {
  root?: Element | string;
  ignore?: string;
  limits?: Partial<AuditLimits>;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  locale?: string;
}

const HTML = 'http://www.w3.org/1999/xhtml';
export const MARK_ATTRIBUTE = 'data-layer-lens-audit';
const SLICE = 12;
const MAX_BATCH = 256;
const LOOKAHEAD = 16;

interface Entry extends Visit {
  rendered: boolean;
  keep: boolean;
}

interface Candidate extends Removal {
  index: number;
  notes: string[];
}

export function resolveRoot(root: Element | string | undefined, doc: Document = document): Element {
  if (root === undefined) return doc.body;
  if (typeof root !== 'string') return root;
  const element = doc.querySelector(root);
  if (!element) throw new Error(`layer-lens-audit: no element matches "${root}".`);
  return element;
}

function walk(
  root: Element,
  ignore: string | undefined,
  styleOf: ReturnType<typeof computedStyles>,
  boxless: Set<Element>
): Entry[] {
  const entries: Entry[] = [];
  const stack: { element: Element; depth: number; rendered: boolean }[] = [];
  for (let index = root.children.length - 1; index >= 0; index--) {
    stack.push({ element: root.children[index]!, depth: 1, rendered: true });
  }

  while (stack.length) {
    const { element, depth, rendered: parentRendered } = stack.pop()!;
    if (isOwnUi(element)) continue;
    const mark = element.getAttribute(MARK_ATTRIBUTE);
    if (mark === 'ignore') continue;
    if (ignore) {
      try {
        if (element.matches(ignore)) continue;
      } catch {
      }
    }

    let rendered = parentRendered && !NON_RENDERING.has(element.localName);
    if (rendered) {
      const display = styleOf(element).display;
      const visible = (element as Element & { checkVisibility?: () => boolean }).checkVisibility;
      if (display === 'contents') boxless.add(element);
      rendered = display !== 'none' && (display === 'contents' || typeof visible !== 'function' || visible.call(element));
    }

    entries.push({ element, depth, rendered, keep: mark === 'keep' });
    for (let index = element.children.length - 1; index >= 0; index--) {
      stack.push({ element: element.children[index]!, depth: depth + 1, rendered });
    }
  }
  return entries;
}

function positionedWithin(root: Element, selectors: Iterable<string>): Set<Element> {
  const found = new Set<Element>();
  for (const selector of selectors) {
    try {
      for (const element of root.querySelectorAll(matchable(selector))) found.add(element);
    } catch {
    }
  }
  return found;
}

function kindOf({ element, test }: Removal): string {
  const parent = element.parentElement;
  return `${test} ${parent?.localName ?? ''}.${parent?.getAttribute('class') ?? ''} > ${element.localName}.${element.getAttribute('class') ?? ''}`;
}

function yieldToPage(view: Window): Promise<void> {
  const scheduler = (view as Window & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  if (typeof MessageChannel === 'function') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function stopIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('The audit was stopped.', 'AbortError');
}

export async function audit(options: AuditOptions = {}): Promise<AuditReport> {
  const root = resolveRoot(options.root);
  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const started = performance.now();

  stopIfAborted(options.signal);
  const messages = messagesFor(options.locale);
  const styleOf = computedStyles(view);
  const facts = collectCssFacts(doc);
  const context = { root, styleOf, view, facts, messages, positioned: positionedWithin(root, facts.positional) };
  const boxless = new Set<Element>();
  const entries = walk(root, options.ignore, styleOf, boxless);
  const flagged: (Flagged & { index: number })[] = [];
  const ledger = new StyleLedger();
  const measurer = createMeasurer(view, ledger, (element) => boxless.has(element));
  const scroll = { x: view.scrollX, y: view.scrollY };

  let done = 0;
  let sliceStart = performance.now();
  async function breathe() {
    if (performance.now() - sliceStart <= SLICE) return;
    options.onProgress?.(done, entries.length);
    await yieldToPage(view);
    stopIfAborted(options.signal);
    measurer.forget();
    sliceStart = performance.now();
  }

  async function settle(batch: Candidate[], upcoming: Candidate[]): Promise<boolean> {
    if (measurer.attempt(batch, upcoming)) {
      for (const candidate of batch) {
        flagged.push({ element: candidate.element, test: candidate.test, notes: candidate.notes, index: candidate.index });
        if (candidate.test === 'unwrap') boxless.add(candidate.element);
      }
      done += batch.length;
      await breathe();
      return true;
    }
    if (batch.length === 1) {
      done++;
      await breathe();
      return false;
    }
    const middle = Math.ceil(batch.length / 2);
    await settle(batch.slice(0, middle), batch.slice(middle));
    await settle(batch.slice(middle), upcoming);
    return false;
  }

  ledger.set(doc.documentElement, 'overflow-anchor', 'none');
  try {
    const candidates: Candidate[] = [];
    for (let index = 0; index < entries.length; index++) {
      const { element, rendered, keep } = entries[index]!;
      if (rendered && !keep && element.namespaceURI === HTML && isStyled(element)) {
        const screening = screen(element, context);
        if ('test' in screening) candidates.push({ element: element as StyledElement, test: screening.test, notes: screening.notes, index });
        else done++;
      } else {
        done++;
      }
      await breathe();
    }

    const kinds = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      const key = kindOf(candidate);
      const kind = kinds.get(key);
      if (kind) kind.push(candidate);
      else kinds.set(key, [candidate]);
    }
    for (const kind of kinds.values()) {
      let size = 1;
      for (let start = 0; start < kind.length; ) {
        const batch = kind.slice(start, start + size);
        start += batch.length;
        const passed = await settle(batch, kind.slice(start, start + LOOKAHEAD));
        size = passed ? Math.min(size * 2, MAX_BATCH) : 1;
      }
    }
    options.onProgress?.(entries.length, entries.length);
  } finally {
    ledger.restoreAll();
    if (view.scrollX !== scroll.x || view.scrollY !== scroll.y) view.scrollTo(scroll.x, scroll.y);
  }

  return buildReport({
    root,
    visits: entries,
    flagged: flagged.sort((a, b) => a.index - b.index),
    limits,
    view,
    unreadableStyleSheets: facts.unreadable,
    durationMs: performance.now() - started,
    messages
  });
}
