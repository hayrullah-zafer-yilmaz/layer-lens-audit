import type { Messages } from '../i18n';
import { drawsBox, drawsOutline, hasContent, isSet, type StyleOf } from '../shared/dom';
import { matchable, sizeLimits, tokensOfElement, withoutPseudoElements, type CssFacts } from './selectors';

export type Test = 'unwrap' | 'remove';

export type Screening = { test: Test; notes: string[] } | { keep: string };

export interface ScreenContext {
  root: Element;
  styleOf: StyleOf;
  view: Window;
  facts: CssFacts;
  positioned: ReadonlySet<Element>;
  messages: Messages;
}

const GENERIC = new Set(['div', 'span']);

const EMPTY_CANDIDATES = new Set([
  'article',
  'aside',
  'b',
  'blockquote',
  'code',
  'div',
  'em',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'i',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul'
]);

const JOB_ATTRIBUTES = ['role', 'tabindex', 'href', 'title', 'lang', 'dir', 'popover', 'inert', 'slot', 'accesskey', 'autofocus'];

const TOOL_ATTRIBUTE = /^data-(?:v-|svelte|astro-|reactroot|sentry-|layer-lens-audit)/;
const TEST_ATTRIBUTE = /^data-(?:testid|test-id|test|cy|qa|e2e)$/;

const INHERITED = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'font-stretch',
  'font-feature-settings',
  'font-variation-settings',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-indent',
  'text-transform',
  'text-shadow',
  'white-space',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'direction',
  'writing-mode',
  'visibility',
  'cursor',
  'pointer-events',
  'list-style-type',
  'list-style-position',
  'border-collapse',
  'border-spacing',
  'quotes',
  'tab-size',
  'accent-color',
  'color-scheme',
  'fill',
  'stroke'
];

const notNormal = (value: string) => !!value && value !== 'normal';
const notAuto = (value: string) => !!value && value !== 'auto';

const EFFECTS: [property: string, applies: (value: string) => boolean, effect: string][] = [
  ['position', (value) => !!value && value !== 'static', 'is positioned'],
  ['overflow-x', (value) => !!value && value !== 'visible', 'clips or scrolls its content'],
  ['overflow-y', (value) => !!value && value !== 'visible', 'clips or scrolls its content'],
  ['opacity', (value) => parseFloat(value) < 1, 'is see-through'],
  ['transform', isSet, 'is transformed'],
  ['translate', isSet, 'is transformed'],
  ['rotate', isSet, 'is transformed'],
  ['scale', isSet, 'is transformed'],
  ['perspective', isSet, 'sets a 3D perspective'],
  ['filter', isSet, 'has a filter'],
  ['backdrop-filter', isSet, 'has a backdrop filter'],
  ['clip-path', isSet, 'clips its content'],
  ['mask-image', isSet, 'masks its content'],
  ['-webkit-mask-image', isSet, 'masks its content'],
  ['mix-blend-mode', notNormal, 'blends with what is under it'],
  ['isolation', (value) => value === 'isolate', 'isolates its content'],
  ['z-index', notAuto, 'sets a stacking order'],
  ['contain', isSet, 'uses CSS containment'],
  ['content-visibility', (value) => !!value && value !== 'visible', 'controls whether its content renders'],
  ['container-type', notNormal, 'is a container for @container queries'],
  ['will-change', notAuto, 'is prepared for animation'],
  ['animation-name', isSet, 'is animated'],
  ['transition-duration', (value) => value.split(',').some((part) => parseFloat(part) > 0), 'animates its changes'],
  ['text-decoration-line', isSet, 'decorates the text inside it'],
  ['anchor-name', isSet, 'is an anchor for positioned elements'],
  ['view-transition-name', isSet, 'takes part in view transitions'],
  ['zoom', (value) => !!value && value !== '1' && value !== 'normal', 'is zoomed'],
  ['grid-column-start', notAuto, 'is placed in a specific grid cell'],
  ['grid-column-end', notAuto, 'is placed in a specific grid cell'],
  ['grid-row-start', notAuto, 'is placed in a specific grid cell'],
  ['grid-row-end', notAuto, 'is placed in a specific grid cell'],
  ['order', (value) => !!value && value !== '0', 'changes its order among its siblings']
];

function isMountPoint(element: Element): boolean {
  if ('__vue_app__' in element || '_reactRootContainer' in element) return true;
  return Object.keys(element).some((key) => key.startsWith('__reactContainer$'));
}

function jobAttribute(element: Element): string | null {
  for (const name of JOB_ATTRIBUTES) {
    if (element.hasAttribute(name)) return `a ${name} attribute`;
  }
  for (const { name, value } of element.attributes) {
    if (name.startsWith('aria-')) return `an ${name} attribute`;
    if (name.startsWith('on')) return `an inline ${name} handler`;
    if (name === 'contenteditable' && value !== 'false') return 'editable content';
    if (name === 'draggable' && value === 'true') return 'drag and drop';
  }
  return null;
}

type Bag = Record<string, unknown>;

const SVELTE_EVENT = /^__(?:click|dblclick|contextmenu|pointer|mouse|key|touch|focus|blur|input|change|submit)/;

function frameworkJob(element: Element): string | null {
  const bag = element as unknown as Bag;
  for (const key of Object.keys(element)) {
    if (key.startsWith('__reactProps$')) {
      const props = bag[key] as Bag | null;
      for (const name of Object.keys(props ?? {})) {
        if (/^on[A-Z]/.test(name) && typeof props![name] === 'function') return `a React ${name} handler`;
      }
      if (props?.ref) return 'a React ref';
    } else if (key.startsWith('__reactFiber$')) {
      if ((bag[key] as Bag | null)?.ref) return 'a React ref';
    } else if (key === '_vei') {
      if (Object.values((bag[key] as Bag | null) ?? {}).some(Boolean)) return 'a Vue event listener';
    } else if (SVELTE_EVENT.test(key)) {
      return 'a Svelte event handler';
    }
  }

  if ((bag.__vnode as Bag | undefined)?.ref) return 'a Vue template ref';

  const view = element.ownerDocument.defaultView as unknown as Bag | null;
  try {
    const ng = view?.ng as Bag | undefined;
    const listeners = typeof ng?.getListeners === 'function' ? (ng.getListeners as (el: Element) => unknown[])(element) : [];
    if (listeners.length) return 'an Angular event listener';
    const jquery = view?.jQuery as Bag | undefined;
    const data = typeof jquery?._data === 'function' ? (jquery._data as (el: Element, name: string) => unknown)(element, 'events') : null;
    if (data && Object.keys(data).length) return 'a jQuery event handler';
  } catch {
  }
  return null;
}

function stylesElsewhere(element: Element, facts: CssFacts): string | null {
  const own = 'style' in element ? sizeLimits((element as HTMLElement).style) : [];
  if (own.length) return `it limits its size (${own[0]}), which can matter at other screen sizes`;

  for (const token of tokensOfElement(element)) {
    for (const { selector, condition, limits } of facts.subjects.get(token) ?? []) {
      if (condition) return `it has its own styles ${condition}`;
      try {
        if (!element.matches(withoutPseudoElements(selector))) return `it has its own styles when ${selector} applies`;
      } catch {
        continue;
      }
      if (limits.length) return `it limits its size (${limits[0]}), which can matter at other screen sizes`;
    }
  }
  return null;
}

const parentsCache = new WeakMap<ReadonlySet<Element>, Set<Element>>();

function parentsOf(positioned: ReadonlySet<Element>): Set<Element> {
  let parents = parentsCache.get(positioned);
  if (!parents) {
    parents = new Set();
    for (const element of positioned) if (element.parentElement) parents.add(element.parentElement);
    parentsCache.set(positioned, parents);
  }
  return parents;
}

function shiftsPositions(element: Element, test: Test, positioned: ReadonlySet<Element>): boolean {
  if (positioned.has(element)) return true;
  const parents = parentsOf(positioned);
  const parent = element.parentElement;
  if (parent && parents.has(parent)) return true;
  return test === 'unwrap' && parents.has(element);
}

function pseudoContent(element: Element, view: Window): string | null {
  for (const pseudo of ['::before', '::after']) {
    const content = view.getComputedStyle(element, pseudo).content;
    if (content && content !== 'none' && content !== 'normal') return `${pseudo} content`;
  }
  return null;
}

function effectOf(style: CSSStyleDeclaration): string | null {
  for (const [property, applies, effect] of EFFECTS) {
    if (applies(style.getPropertyValue(property))) return effect;
  }
  return null;
}

function inheritedChanges(element: Element, style: CSSStyleDeclaration, context: ScreenContext): string[] {
  const parent = element.parentElement;
  if (!parent) return [];
  const parentStyle = context.styleOf(parent);

  const custom = new Set<string>();
  for (const token of tokensOfElement(element)) {
    for (const name of context.facts.customProperties.get(token) ?? []) custom.add(name);
  }
  if ('style' in element) {
    for (const name of (element as HTMLElement).style) if (name.startsWith('--')) custom.add(name);
  }

  return [...INHERITED, ...custom].filter(
    (property) => style.getPropertyValue(property) !== parentStyle.getPropertyValue(property)
  );
}

function styledThrough(element: Element, facts: CssFacts): string | null {
  for (const token of tokensOfElement(element)) {
    for (const selector of facts.through.get(token) ?? []) {
      const target = matchable(selector);
      try {
        if (element.querySelector(target) || element.parentElement?.closest(target)) return selector;
        for (let sibling = element.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
          if (sibling.matches(target) || sibling.querySelector(target)) return selector;
        }
      } catch {
      }
    }
  }
  return null;
}

function notesFor(element: Element, test: Test, messages: Messages): string[] {
  const notes: string[] = [];
  if (test === 'remove') notes.push(messages.noteEmpty);
  if (element.id) notes.push(messages.noteId(element.id));
  for (const { name, value } of element.attributes) {
    if (!name.startsWith('data-') || TOOL_ATTRIBUTE.test(name)) continue;
    notes.push(TEST_ATTRIBUTE.test(name) ? messages.noteTest(name, value) : messages.noteData(name));
    if (notes.length >= 3) break;
  }
  return notes;
}

const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '');

export function screen(element: Element, context: ScreenContext): Screening {
  if (element === context.root) return { keep: 'it is the root of the audit' };

  const empty = !hasContent(element);
  const name = element.localName;
  if (empty ? !EMPTY_CANDIDATES.has(name) : !GENERIC.has(name)) {
    return { keep: empty ? 'it is part of a structure or draws on its own' : `a ${name} means more than a div` };
  }
  if (isMountPoint(element)) return { keep: 'the app is mounted on it' };

  const job = jobAttribute(element) ?? frameworkJob(element);
  if (job) return { keep: `it has ${job}` };

  const style = context.styleOf(element);
  if (drawsBox(style) || drawsOutline(style)) return { keep: 'it draws a background, border, shadow or outline' };

  const pseudo = pseudoContent(element, context.view);
  if (pseudo) return { keep: `it draws ${pseudo}` };
  if (style.display === 'list-item' && isSet(style.listStyleType)) return { keep: 'it draws a list marker' };

  const effect = effectOf(style);
  if (effect) return { keep: `it ${effect}` };

  if (!empty) {
    const inherited = inheritedChanges(element, style, context);
    if (inherited.length) return { keep: `it sets ${list(inherited.slice(0, 2))} for what is inside it` };
  }

  const elsewhere = stylesElsewhere(element, context.facts);
  if (elsewhere) return { keep: elsewhere };

  const through = styledThrough(element, context.facts);
  if (through) return { keep: `other elements are styled through it: ${through}` };

  const test: Test = empty ? 'remove' : 'unwrap';
  if (shiftsPositions(element, test, context.positioned)) {
    return { keep: 'its siblings or children are styled by their position, which would shift' };
  }

  return { test, notes: notesFor(element, test, context.messages) };
}
