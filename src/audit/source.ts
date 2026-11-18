export interface SourceHint {
  framework: 'react' | 'vue' | 'svelte' | 'angular';
  component: string | null;
  file: string | null;
  line: number | null;
}

type Bag = Record<string, unknown>;

const REACT_FIBER = '__reactFiber$';

const field = (value: unknown, key: string): unknown =>
  (value !== null && typeof value === 'object') || typeof value === 'function' ? (value as Bag)[key] : undefined;

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function baseName(file: string | null): string | null {
  if (!file) return null;
  const name = file.split(/[\\/]/).pop() ?? file;
  return name.replace(/\.(?:vue|svelte|[cm]?[jt]sx?)$/, '') || null;
}

const readable = (name: string | null) => (name && !/^[A-Za-z]{1,2}\d*$/.test(name) ? name : null);

function componentName(type: unknown): string | null {
  if (typeof type === 'function') return text(field(type, 'displayName')) ?? text(field(type, 'name'));
  if (type && typeof type === 'object') {
    return text(field(type, 'displayName')) ?? componentName(field(type, 'render')) ?? componentName(field(type, 'type'));
  }
  return null;
}

function vueSource(element: Element): SourceHint | null {
  const instance = field(element, '__vueParentComponent');
  if (!instance) return null;
  const type = field(instance, 'type');
  const file = text(field(type, '__file'));
  const component = readable(text(field(type, 'name')) ?? text(field(type, '__name')) ?? baseName(file));
  return { framework: 'vue', component, file, line: null };
}

function reactSource(element: Element): SourceHint | null {
  const key = Object.keys(element).find((name) => name.startsWith(REACT_FIBER));
  if (!key) return null;
  const fiber = (element as unknown as Bag)[key];

  const owner = field(fiber, '_debugOwner');
  let component = componentName(field(owner, 'type')) ?? text(field(owner, 'name'));
  for (let node = field(fiber, 'return'); !component && node; node = field(node, 'return')) {
    component = componentName(field(node, 'type'));
  }

  const source = field(fiber, '_debugSource') ?? field(owner, '_debugSource');
  return {
    framework: 'react',
    component: readable(component),
    file: text(field(source, 'fileName')),
    line: count(field(source, 'lineNumber'))
  };
}

function svelteSource(element: Element): SourceHint | null {
  const meta = field(element, '__svelte_meta');
  if (!meta) return null;
  const location = field(meta, 'loc');
  const file = text(field(location, 'file'));
  return { framework: 'svelte', component: baseName(file), file, line: count(field(location, 'line')) };
}

function angularSource(element: Element): SourceHint | null {
  const ng = field(element.ownerDocument.defaultView, 'ng');
  const owning = field(ng, 'getOwningComponent');
  if (typeof owning !== 'function') return null;
  try {
    const instance: unknown = owning.call(ng, element);
    const name = text(field(field(instance, 'constructor'), 'name'));
    return name ? { framework: 'angular', component: readable(name.replace(/^_+/, '')), file: null, line: null } : null;
  } catch {
    return null;
  }
}

export function sourceOf(element: Element): SourceHint | null {
  return vueSource(element) ?? reactSource(element) ?? svelteSource(element) ?? angularSource(element);
}

export function describeSource(source: SourceHint | null): string | null {
  if (!source) return null;
  const file = source.file ? (source.file.split(/[\\/]/).pop() ?? source.file) : null;
  if (file) return source.line ? `${file}:${source.line}` : file;
  return source.component;
}

function escapeIdent(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, (char) => `\\${char}`);
}

interface Segment {
  text: string;
  base: string;
  nth: number | null;
}

export function createSelectorFinder(doc: Document): (element: Element) => string {
  const found = new WeakMap<Element, string>();
  const segments = new WeakMap<Element, Segment>();
  const positions = new WeakMap<Element, number>();
  const sameTag = new WeakMap<Element, Map<string, Element[]>>();
  const lookAlikes = new WeakMap<Element, Map<string, number>>();
  const matched = new Map<string, Element[]>();
  const byPosition = new Map<string, Map<number, Element[]>>();
  const counts = new Map<string, number>();

  function siblingsWithTag(parent: Element, tag: string): Element[] {
    let byTag = sameTag.get(parent);
    if (!byTag) {
      byTag = new Map();
      for (const child of parent.children) {
        let list = byTag.get(child.localName);
        if (!list) byTag.set(child.localName, (list = []));
        list.push(child);
        positions.set(child, list.length);
      }
      sameTag.set(parent, byTag);
    }
    return byTag.get(tag) ?? [];
  }

  function positionOf(node: Element): number {
    const parent = node.parentElement;
    if (!parent) return 1;
    siblingsWithTag(parent, node.localName);
    return positions.get(node) ?? 1;
  }

  function segmentOf(node: Element): Segment {
    let segment = segments.get(node);
    if (segment) return segment;
    const tag = node.localName;
    const names = [...node.classList].slice(0, 2);
    const base = tag + names.map((name) => `.${escapeIdent(name)}`).join('');
    const parent = node.parentElement;
    let nth: number | null = null;
    if (parent) {
      const siblings = siblingsWithTag(parent, tag);
      let known = lookAlikes.get(parent);
      if (!known) lookAlikes.set(parent, (known = new Map()));
      let twins = known.get(base);
      if (twins === undefined) {
        twins = siblings.filter((sibling) => names.every((name) => sibling.classList.contains(name))).length;
        known.set(base, twins);
      }
      if (twins > 1) nth = positionOf(node);
    }
    segment = { text: nth === null ? base : `${base}:nth-of-type(${nth})`, base, nth };
    segments.set(node, segment);
    return segment;
  }

  function matching(selector: string): Element[] {
    let list = matched.get(selector);
    if (!list) {
      try {
        list = Array.from(doc.querySelectorAll(selector));
      } catch {
        list = [];
      }
      matched.set(selector, list);
    }
    return list;
  }

  function matchingStep(step: Segment): Element[] {
    if (step.nth === null) return matching(step.text);
    let index = byPosition.get(step.base);
    if (!index) {
      index = new Map();
      for (const element of matching(step.base)) {
        const position = positionOf(element);
        const list = index.get(position);
        if (list) list.push(element);
        else index.set(position, [element]);
      }
      byPosition.set(step.base, index);
    }
    return index.get(step.nth) ?? [];
  }

  function count(steps: Segment[]): number {
    const text = steps.map((step) => step.text).join(' > ');
    let known = counts.get(text);
    if (known !== undefined) return known;
    const [top, ...rest] = steps;
    const tops = matchingStep(top!);
    if (!rest.length) {
      known = Math.min(tops.length, 2);
    } else {
      const below = `:scope > ${rest.map((step) => step.text).join(' > ')}`;
      known = 0;
      try {
        for (const element of tops) {
          known += element.querySelectorAll(below).length;
          if (known > 1) break;
        }
      } catch {
        known = 2;
      }
      known = Math.min(known, 2);
    }
    counts.set(text, known);
    return known;
  }

  return (element) => {
    const known = found.get(element);
    if (known !== undefined) return known;

    const steps: Segment[] = [];
    for (let node: Element | null = element; node && node !== doc.documentElement; node = node.parentElement) {
      const id = node.id ? `#${escapeIdent(node.id)}` : '';
      if (id && matching(id).length === 1) {
        steps.push({ text: id, base: id, nth: null });
        break;
      }
      steps.push(segmentOf(node));
    }

    let length = 1;
    while (length < steps.length && count(steps.slice(0, length).reverse()) !== 1) length++;
    const selector = steps
      .slice(0, length)
      .reverse()
      .map((step) => step.text)
      .join(' > ');
    found.set(element, selector);
    return selector;
  };
}

export function selectorOf(element: Element): string {
  return createSelectorFinder(element.ownerDocument)(element);
}
