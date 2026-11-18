import { TEXT_NODE, type StyledElement } from '../shared/dom';
import type { StyleLedger } from '../shared/ledger';
import type { Test } from './checks';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Removal {
  element: StyledElement;
  test: Test;
}

export interface Measurer {
  attempt(removals: readonly Removal[], upcoming: readonly Removal[]): boolean;
  forget(): void;
}

const TOLERANCE = 0.5;

const same = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) <= TOLERANCE &&
  Math.abs(a.y - b.y) <= TOLERANCE &&
  Math.abs(a.width - b.width) <= TOLERANCE &&
  Math.abs(a.height - b.height) <= TOLERANCE;

export function sameBoxes(before: readonly Box[], after: readonly Box[]): boolean {
  return before.length === after.length && before.every((box, index) => same(box, after[index]!));
}

export function createMeasurer(view: Window, ledger: StyleLedger, flat: (element: Element) => boolean): Measurer {
  const known = new Map<Node, Box[]>();
  const range = view.document.createRange();
  const textRects = typeof range.getClientRects === 'function';

  function read(node: Node): Box[] {
    const x = view.scrollX;
    const y = view.scrollY;
    const box = (rect: DOMRectReadOnly): Box => ({ x: rect.left + x, y: rect.top + y, width: rect.width, height: rect.height });
    if (node.nodeType !== TEXT_NODE) return [box((node as Element).getBoundingClientRect())];
    if (!textRects) return [];
    range.selectNodeContents(node);
    return Array.from(range.getClientRects(), box);
  }

  function watched(removals: readonly Removal[]): Node[] {
    const going = new Set<Element>(removals.map(({ element }) => element));
    const nodes = new Set<Node>();
    const add = (element: Element) => {
      if (going.has(element) || flat(element)) for (const child of element.children) add(child);
      else nodes.add(element);
    };

    for (const { element } of removals) {
      for (const child of element.children) add(child);
      for (const node of element.childNodes) {
        if (node.nodeType === TEXT_NODE && node.nodeValue?.trim()) nodes.add(node);
      }
    }
    const parents = new Set<Element>();
    for (const { element } of removals) if (element.parentElement) parents.add(element.parentElement);
    for (const parent of parents) if (!going.has(parent)) nodes.add(parent);
    for (const parent of parents) for (const sibling of parent.children) if (!going.has(sibling)) add(sibling);
    return [...nodes];
  }

  function remember(nodes: readonly Node[]) {
    for (const node of nodes) if (!known.has(node)) known.set(node, read(node));
  }

  return {
    attempt(removals, upcoming) {
      const nodes = watched(removals);
      const missing = nodes.some((node) => !known.has(node));
      remember(nodes);
      if (missing) for (const removal of upcoming) remember(watched([removal]));
      const before = nodes.map((node) => known.get(node)!);

      for (const { element, test } of removals) ledger.set(element, 'display', test === 'unwrap' ? 'contents' : 'none');

      const after: Box[][] = [];
      for (let index = 0; index < nodes.length; index++) {
        const boxes = read(nodes[index]!);
        if (!sameBoxes(before[index]!, boxes)) {
          for (const { element } of removals) ledger.restore(element, ['display']);
          return false;
        }
        after.push(boxes);
      }

      known.clear();
      nodes.forEach((node, index) => known.set(node, after[index]!));
      return true;
    },

    forget() {
      known.clear();
    }
  };
}
