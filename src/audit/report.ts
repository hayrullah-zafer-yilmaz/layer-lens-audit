import { formatMarkdown } from '../format';
import type { Locale, Messages } from '../i18n';
import { createSelectorFinder, sourceOf, type SourceHint } from './source';
import type { Test } from './checks';

export type FindingKind = 'redundant-wrappers' | 'empty-element' | 'dom-size' | 'deep-nesting' | 'wide-parent';

export interface Finding {
  kind: FindingKind;
  elements: Element[];
  confidence: 'high' | 'medium';
  title: string;
  detail: string;
  fix: string;
  notes: string[];
  selector: string;
  source: SourceHint | null;
}

export interface DomStats {
  elements: number;
  depth: number;
  children: number;
}

export interface AuditLimits {
  elements: number;
  depth: number;
  children: number;
}

export interface FindingJson {
  kind: FindingKind;
  confidence: 'high' | 'medium';
  title: string;
  detail: string;
  fix: string;
  notes: string[];
  selector: string;
  selectors: string[];
  tags: string[];
  source: SourceHint | null;
}

export interface AuditJson {
  url: string;
  locale: Locale;
  viewport: { width: number; height: number };
  durationMs: number;
  removable: number;
  stats: DomStats;
  cleaned: DomStats;
  limits: AuditLimits;
  unreadableStyleSheets: number;
  findings: FindingJson[];
}

export interface AuditReport {
  readonly root: Element;
  readonly locale: Locale;
  readonly findings: readonly Finding[];
  readonly stats: DomStats;
  readonly cleaned: DomStats;
  readonly removable: number;
  readonly limits: AuditLimits;
  readonly viewport: { width: number; height: number };
  readonly unreadableStyleSheets: number;
  readonly durationMs: number;
  summary(): string;
  toJSON(): AuditJson;
  toMarkdown(): string;
}

export interface Visit {
  element: Element;
  depth: number;
}

export interface Flagged {
  element: Element;
  test: Test;
  notes: string[];
}

export interface ReportInput {
  root: Element;
  visits: Visit[];
  flagged: Flagged[];
  limits: AuditLimits;
  view: Window;
  unreadableStyleSheets: number;
  durationMs: number;
  messages: Messages;
}

function childrenAfter(element: Element, unwrapped: Set<Element>, removed: Set<Element>, counted: Set<Element>): number {
  let total = 0;
  for (const child of element.children) {
    if (!counted.has(child)) continue;
    if (unwrapped.has(child)) total += childrenAfter(child, unwrapped, removed, counted);
    else if (!removed.has(child)) total++;
  }
  return total;
}

function statsOf(visits: Visit[], root: Element, flagged: Flagged[]) {
  const unwrapped = new Set(flagged.filter((item) => item.test === 'unwrap').map((item) => item.element));
  const removed = new Set(flagged.filter((item) => item.test === 'remove').map((item) => item.element));
  const counted = new Set(visits.map((visit) => visit.element));

  const now: DomStats = { elements: visits.length, depth: 0, children: 0 };
  const cleaned: DomStats = { elements: visits.length - flagged.length, depth: 0, children: 0 };
  let deepest: Element | null = null;
  const wide: [Element, number][] = [];

  for (const { element, depth } of [{ element: root, depth: 0 }, ...visits]) {
    const children = [...element.children].filter((child) => counted.has(child)).length;
    if (depth > now.depth) {
      now.depth = depth;
      deepest = element;
    }
    now.children = Math.max(now.children, children);
    wide.push([element, children]);

    if (unwrapped.has(element) || removed.has(element)) continue;
    let lifted = 0;
    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      if (unwrapped.has(node)) lifted++;
    }
    cleaned.depth = Math.max(cleaned.depth, depth - lifted);
    cleaned.children = Math.max(cleaned.children, childrenAfter(element, unwrapped, removed, counted));
  }

  return { now, cleaned, deepest, wide };
}

function chains(flagged: Flagged[]): Flagged[][] {
  const groups: Flagged[][] = [];
  const endingWith = new Map<Element, Flagged[]>();

  for (const item of flagged) {
    if (item.test !== 'unwrap') continue;
    const parent = item.element.parentElement;
    const group = parent ? endingWith.get(parent) : undefined;
    if (group) {
      endingWith.delete(parent!);
      group.push(item);
      endingWith.set(item.element, group);
    } else {
      const fresh = [item];
      groups.push(fresh);
      endingWith.set(item.element, fresh);
    }
  }
  return groups;
}

export function buildReport(input: ReportInput): AuditReport {
  const { root, visits, flagged, limits, view, messages } = input;
  const number = messages.number;
  const selectorOf = createSelectorFinder(root.ownerDocument);

  const fixes: Record<FindingKind, string> = {
    'redundant-wrappers': messages.wrapperFix,
    'empty-element': messages.emptyFix,
    'dom-size': messages.domSizeFix,
    'deep-nesting': messages.deepFix,
    'wide-parent': messages.wideFix
  };

  function finding(kind: FindingKind, elements: Element[], title: string, detail: string, notes: string[] = []): Finding {
    const first = elements[0]!;
    const source = sourceOf(first);
    const fix = kind === 'redundant-wrappers' && source ? `${fixes[kind]} ${messages.frameworkFix[source.framework]}` : fixes[kind];
    return {
      kind,
      elements,
      confidence: notes.length ? 'medium' : 'high',
      title,
      detail,
      fix,
      notes,
      selector: selectorOf(first),
      source
    };
  }
  const { now, cleaned, deepest, wide } = statsOf(visits, root, flagged);
  const removable = flagged.length;
  const findings: Finding[] = [];

  if (now.elements > limits.elements) {
    findings.push(
      finding(
        'dom-size',
        [root],
        messages.domSize(number(now.elements), number(limits.elements)),
        removable ? messages.domSizeCleaned(number(removable), number(cleaned.elements)) : messages.domSizeDetail
      )
    );
  }

  if (deepest && now.depth > limits.depth) {
    findings.push(
      finding(
        'deep-nesting',
        [deepest],
        messages.deep(number(now.depth), number(limits.depth)),
        cleaned.depth < now.depth ? messages.deepCleaned(number(cleaned.depth)) : messages.deepDetail
      )
    );
  }

  for (const [element, children] of wide
    .filter(([, children]) => children > limits.children)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)) {
    findings.push(
      finding(
        'wide-parent',
        [element],
        messages.wide(number(children), number(limits.children)),
        messages.wideDetail
      )
    );
  }

  const wrapperGroups = chains(flagged).sort((a, b) => b.length - a.length);
  for (const group of wrapperGroups) {
    const elements = group.map((item) => item.element);
    const notes = [...new Set(group.flatMap((item) => item.notes))];
    const single = elements.length === 1;
    findings.push(
      finding(
        'redundant-wrappers',
        elements,
        single ? messages.wrapper(elements[0]!.localName) : messages.wrappers(elements.length),
        single ? messages.wrapperDetail : messages.wrappersDetail,
        notes
      )
    );
  }

  for (const item of flagged) {
    if (item.test !== 'remove') continue;
    findings.push(
      finding(
        'empty-element',
        [item.element],
        messages.empty(item.element.localName),
        messages.emptyDetail,
        item.notes
      )
    );
  }

  const viewport = { width: view.innerWidth, height: view.innerHeight };
  const durationMs = Math.round(input.durationMs);

  return {
    root,
    locale: messages.locale,
    findings,
    stats: now,
    cleaned,
    removable,
    limits,
    viewport,
    unreadableStyleSheets: input.unreadableStyleSheets,
    durationMs,
    summary() {
      if (!removable) return messages.summaryNone(number(now.elements));
      const share = messages.percent(removable / Math.max(now.elements, 1));
      return messages.summarySome(number(removable), number(now.elements), share);
    },
    toJSON: json,
    toMarkdown: () => formatMarkdown(json(), messages)
  };

  function json(): AuditJson {
    return {
      url: root.ownerDocument.URL,
      locale: messages.locale,
      viewport,
      durationMs,
      removable,
      stats: now,
      cleaned,
      limits,
      unreadableStyleSheets: input.unreadableStyleSheets,
      findings: findings.map((item) => ({
        kind: item.kind,
        confidence: item.confidence,
        title: item.title,
        detail: item.detail,
        fix: item.fix,
        notes: item.notes,
        selector: item.selector,
        selectors: item.elements.map(selectorOf),
        tags: item.elements.map((element) => element.localName),
        source: item.source
      }))
    };
  }
}
