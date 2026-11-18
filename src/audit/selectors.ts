export interface SubjectRule {
  selector: string;
  condition: string | null;
  limits: string[];
}

export interface CssFacts {
  subjects: Map<string, SubjectRule[]>;
  through: Map<string, Set<string>>;
  positional: Set<string>;
  customProperties: Map<string, Set<string>>;
  unreadable: number;
}

export const STATE = /:(?:hover|active|focus(?:-within|-visible)?|target|checked|open|popover-open)(?![\w-])/;
const STRUCTURAL = /:(?:nth-(?:last-)?(?:child|of-type)|(?:first|last|only)-(?:child|of-type)|empty)(?![\w-])/;
const STATE_GLOBAL = new RegExp(STATE.source, 'g');
const PSEUDO_ELEMENT = /::?(?:before|after|first-line|first-letter|marker|placeholder|selection|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?![\w-])/g;

type RuleLike = CSSRule & {
  selectorText?: string;
  style?: CSSStyleDeclaration;
  cssRules?: CSSRuleList;
  media?: MediaList;
  conditionText?: string;
  containerName?: string;
  containerQuery?: string;
  styleSheet?: CSSStyleSheet | null;
};

function escapeLength(text: string, index: number): number {
  const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(text.slice(index + 1, index + 8));
  return 1 + (hex ? hex[0].length : 1);
}

function scan(text: string, visit: (char: string, depth: number, index: number) => boolean | void) {
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === '\\') {
      index += escapeLength(text, index) - 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    if (visit(char, depth, index) === false) return;
  }
}

const SIZE_LIMITS = [
  'max-width',
  'max-height',
  'max-inline-size',
  'max-block-size',
  'min-width',
  'min-height',
  'min-inline-size',
  'min-block-size',
  'aspect-ratio'
];
const SIZES = ['width', 'height', 'inline-size', 'block-size', 'flex-basis'];
const VIEWPORT_RELATIVE = /(?:min|max|clamp)\(|\d(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh|cqw|cqh|cqi|cqb)\b/;
const NO_LIMIT = new Set(['', 'none', 'auto', '0', '0px', 'initial', 'unset', 'inherit', 'revert', 'normal']);

const SIZE_PROPERTIES = new Set([...SIZE_LIMITS, ...SIZES]);

export function sizeLimits(style: CSSStyleDeclaration): string[] {
  let sized = false;
  for (let index = 0; index < style.length && !sized; index++) sized = SIZE_PROPERTIES.has(style[index]!);
  if (!sized) return [];

  const limits: string[] = [];
  for (const property of SIZE_LIMITS) {
    const value = style.getPropertyValue(property).trim();
    if (!NO_LIMIT.has(value)) limits.push(`${property}: ${value}`);
  }
  for (const property of SIZES) {
    const value = style.getPropertyValue(property).trim();
    if (VIEWPORT_RELATIVE.test(value)) limits.push(`${property}: ${value}`);
  }
  return limits;
}

export function splitList(selectorText: string): string[] {
  if (!/[(["'\\]/.test(selectorText)) {
    return selectorText
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const parts: string[] = [];
  let start = 0;
  scan(selectorText, (char, depth, index) => {
    if (char === ',' && depth === 0) {
      parts.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  });
  parts.push(selectorText.slice(start).trim());
  return parts.filter(Boolean);
}

export function splitCompounds(selector: string): string[] {
  const compounds: string[] = [];
  let start = 0;
  scan(selector, (char, depth, index) => {
    if (depth !== 0 || !(char === '>' || char === '+' || char === '~' || /\s/.test(char))) return;
    const compound = selector.slice(start, index).trim();
    if (compound) compounds.push(compound);
    start = index + 1;
  });
  const last = selector.slice(start).trim();
  if (last) compounds.push(last);
  return compounds;
}

export function unescapeIdent(text: string): string {
  return text.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (char ?? '')
  );
}

export function tokensOf(compound: string): string[] {
  const tokens: string[] = [];
  scan(compound, (char, depth, index) => {
    if (depth !== 0 || (char !== '.' && char !== '#')) return;
    let end = index + 1;
    while (end < compound.length) {
      const next = compound[end]!;
      if (next === '\\') {
        end += escapeLength(compound, end);
        continue;
      }
      if (/[\w-]/.test(next) || next.charCodeAt(0) >= 0x80) {
        end++;
        continue;
      }
      break;
    }
    const name = compound.slice(index + 1, end);
    if (name) tokens.push(char + unescapeIdent(name));
  });
  return tokens;
}

export function nestedTokensOf(selector: string): string[] {
  const tokens: string[] = [];
  scan(selector, (char, depth, index) => {
    if (depth === 0 || (char !== '.' && char !== '#')) return;
    let end = index + 1;
    while (end < selector.length) {
      const next = selector[end]!;
      if (next === '\\') {
        end += escapeLength(selector, end);
        continue;
      }
      if (/[\w-]/.test(next) || next.charCodeAt(0) >= 0x80) {
        end++;
        continue;
      }
      break;
    }
    const name = selector.slice(index + 1, end);
    if (name) tokens.push(char + unescapeIdent(name));
  });
  return tokens;
}

export function tokensOfElement(element: Element): string[] {
  const tokens = [...element.classList].map((name) => `.${name}`);
  if (element.id) tokens.push(`#${element.id}`);
  return tokens;
}

export function matchable(selector: string): string {
  return selector.replace(PSEUDO_ELEMENT, '').replace(STATE_GLOBAL, '');
}

export function withoutPseudoElements(selector: string): string {
  return selector.replace(PSEUDO_ELEMENT, '');
}

export function lastCombinator(selector: string): string | null {
  let combinator: string | null = null;
  let pending: string | null = null;
  scan(selector, (char, depth) => {
    if (depth === 0 && (char === '>' || char === '+' || char === '~')) pending = char;
    else if (depth === 0 && /\s/.test(char)) pending ??= ' ';
    else if (pending !== null) {
      combinator = pending;
      pending = null;
    }
  });
  return combinator;
}

export interface ParsedSelector {
  subject: string[];
  through: string[];
  positional: boolean;
}

function nameEnd(text: string, index: number): number {
  let end = index + 1;
  while (end < text.length) {
    const char = text[end]!;
    if (char === '\\') end += escapeLength(text, end);
    else if (/[\w-]/.test(char) || char.charCodeAt(0) >= 0x80) end++;
    else break;
  }
  return end;
}

export function parseSelector(selector: string): ParsedSelector {
  const compounds: { text: string; tokens: string[] }[] = [];
  const nested: string[] = [];
  let tokens: string[] = [];
  let start = -1;
  let pending: string | null = null;
  let combinator: string | null = null;
  let depth = 0;
  let quote: string | null = null;

  const close = (end: number) => {
    if (start < 0) return;
    compounds.push({ text: selector.slice(start, end), tokens });
    tokens = [];
    start = -1;
  };

  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]!;
    if (quote) {
      if (char === '\\') index += escapeLength(selector, index) - 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (depth === 0 && (char === '>' || char === '+' || char === '~' || char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f')) {
      close(index);
      if (char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f') pending ??= ' ';
      else pending = char;
      continue;
    }
    if (start < 0) {
      start = index;
      if (pending !== null) combinator = pending;
      pending = null;
    }
    if (char === '\\') {
      index += escapeLength(selector, index) - 1;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      depth--;
    } else if (char === '.' || char === '#') {
      const end = nameEnd(selector, index);
      const name = selector.slice(index + 1, end);
      if (name) (depth === 0 ? tokens : nested).push(char + unescapeIdent(name));
      index = end - 1;
    }
  }
  close(selector.length);

  const subject = compounds[compounds.length - 1];
  return {
    subject: subject?.tokens ?? [],
    through: [...compounds.slice(0, -1).flatMap((compound) => compound.tokens), ...nested],
    positional: !!subject && (STRUCTURAL.test(subject.text) || combinator === '+' || combinator === '~')
  };
}

function add<V>(map: Map<string, Set<V>>, key: string, value: V) {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(value);
}

function resolveNesting(selector: string, parent: string | null): string {
  if (!parent) return selector;
  return splitList(selector)
    .map((part) => (part.includes('&') ? part.replaceAll('&', `:is(${parent})`) : `:is(${parent}) ${part}`))
    .join(', ');
}

function mediaMatches(view: Window | null, query: string): boolean {
  if (!query || query === 'all') return true;
  return typeof view?.matchMedia === 'function' ? view.matchMedia(query).matches : false;
}

function supports(condition: string): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports(condition) : false;
}

function customProperties(style: CSSStyleDeclaration): string[] {
  const names: string[] = [];
  for (let index = 0; index < style.length; index++) {
    const name = style[index]!;
    if (name.startsWith('--')) names.push(name);
  }
  return names;
}

function readStyleRule(
  selectorText: string,
  style: CSSStyleDeclaration,
  facts: CssFacts,
  inactive: string | null,
  parsed: Map<string, ParsedSelector>
) {
  if (!style.length) return;
  let custom: string[] | null = null;
  let limits: string[] | null = null;

  for (const selector of splitList(selectorText)) {
    let parts = parsed.get(selector);
    if (!parts) parsed.set(selector, (parts = parseSelector(selector)));

    if (parts.subject.length) {
      custom ??= customProperties(style);
      limits ??= sizeLimits(style);
      for (const token of parts.subject) {
        let rules = facts.subjects.get(token);
        if (!rules) facts.subjects.set(token, (rules = []));
        rules.push({ selector, condition: inactive, limits });
        for (const name of custom) add(facts.customProperties, token, name);
      }
    }
    if (parts.positional) facts.positional.add(selector);
    for (const token of parts.through) add(facts.through, token, selector);
  }
}

const RESPONSIVE = /\b(?:width|height|aspect-ratio|orientation|resolution)\b|[<>]=?/;

function walkRules(
  rules: CSSRuleList,
  facts: CssFacts,
  view: Window | null,
  inactive: string | null,
  parent: string | null,
  responsive: string | null,
  parsed: Map<string, ParsedSelector>
) {
  for (const rule of [...rules] as RuleLike[]) {
    if (typeof rule.selectorText === 'string' && rule.style) {
      const selector = resolveNesting(rule.selectorText, parent);
      readStyleRule(selector, rule.style, facts, inactive ?? responsive, parsed);
      if (rule.cssRules?.length) walkRules(rule.cssRules, facts, view, inactive, selector, responsive, parsed);
    } else if (rule.styleSheet !== undefined) {
      if (rule.styleSheet) readSheet(rule.styleSheet, facts, view, inactive, parsed);
    } else if (!rule.cssRules) {
      continue;
    } else if (rule.media) {
      const query = rule.media.mediaText;
      const condition = `under @media ${query}`;
      walkRules(
        rule.cssRules,
        facts,
        view,
        inactive ?? (mediaMatches(view, query) ? null : condition),
        parent,
        RESPONSIVE.test(query) ? condition : responsive,
        parsed
      );
    } else if (rule.containerQuery !== undefined || rule.containerName !== undefined) {
      walkRules(rule.cssRules, facts, view, inactive ?? `under @container ${rule.conditionText ?? ''}`.trim(), parent, responsive, parsed);
    } else if (typeof rule.conditionText === 'string') {
      const condition = rule.conditionText;
      walkRules(rule.cssRules, facts, view, inactive ?? (supports(condition) ? null : `under @supports ${condition}`), parent, responsive, parsed);
    } else if (rule.constructor?.name === 'CSSStartingStyleRule') {
      walkRules(rule.cssRules, facts, view, inactive ?? 'under @starting-style', parent, responsive, parsed);
    } else {
      walkRules(rule.cssRules, facts, view, inactive, parent, responsive, parsed);
    }
  }
}

function readSheet(
  sheet: CSSStyleSheet,
  facts: CssFacts,
  view: Window | null,
  inactive: string | null,
  parsed: Map<string, ParsedSelector>
) {
  if (sheet.disabled) return;
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    facts.unreadable++;
    return;
  }
  const query = sheet.media?.mediaText ?? '';
  const condition = inactive ?? (mediaMatches(view, query) ? null : `under @media ${query}`);
  walkRules(rules, facts, view, condition, null, RESPONSIVE.test(query) ? `under @media ${query}` : null, parsed);
}

export function collectCssFacts(doc: Document): CssFacts {
  const facts: CssFacts = {
    subjects: new Map(),
    through: new Map(),
    positional: new Set(),
    customProperties: new Map(),
    unreadable: 0
  };
  const view = doc.defaultView;
  const adopted = (doc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
  const parsed = new Map<string, ParsedSelector>();
  for (const sheet of [...doc.styleSheets, ...adopted]) readSheet(sheet as CSSStyleSheet, facts, view, null, parsed);
  return facts;
}
