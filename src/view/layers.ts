import {
  drawsBox,
  flatteningReason,
  hasOwnText,
  isOwnUi,
  isSet,
  isStyled,
  NON_RENDERING,
  SOLID,
  type StyledElement,
  type StyleOf
} from '../shared/dom';

export type LayerLensAuditDepth = 'visual' | 'dom';

export interface Layer {
  readonly element: StyledElement;
  readonly depth: number;
  readonly rise: number;
  readonly opens: boolean;
  readonly translate: string;
}

export interface LayerPlan {
  layers: Layer[];
  flat: string | null;
}

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

function holdsFixed(style: CSSStyleDeclaration): boolean {
  return (
    ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter', 'backdrop-filter'].some((property) =>
      isSet(style.getPropertyValue(property))
    ) ||
    style.getPropertyValue('transform-style') === 'preserve-3d' ||
    /\b(?:layout|paint|strict|content)\b/.test(style.getPropertyValue('contain')) ||
    /\b(?:transform|translate|rotate|scale|perspective|filter)\b/.test(style.getPropertyValue('will-change'))
  );
}

function holdsAbsolute(style: CSSStyleDeclaration): boolean {
  const position = style.position;
  return (!!position && position !== 'static') || holdsFixed(style);
}

function pinnedWithin(scope: Element, styleOf: StyleOf): Set<Element> {
  const pinned = new Set<Element>();

  for (const element of scope.querySelectorAll('*')) {
    const position = styleOf(element).position;
    if (position !== 'absolute' && position !== 'fixed') continue;

    const holds = position === 'fixed' ? holdsFixed : holdsAbsolute;
    const path: Element[] = [];
    let block: Element | null = null;

    for (let node = element.parentElement; node; node = node.parentElement) {
      if (holds(styleOf(node))) {
        block = node;
        break;
      }
      if (node === scope) break;
      path.push(node);
    }

    if (block) for (const node of path) pinned.add(node);
  }

  return pinned;
}

function paints(element: Element, style: CSSStyleDeclaration, styleOf: StyleOf): boolean {
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  return SOLID.has(element.localName) || drawsBox(style) || hasOwnText(element, styleOf);
}

function createPlanner(scope: Element, mode: LayerLensAuditDepth, styleOf: StyleOf, lift: ReadonlySet<Element>) {
  const pinned = pinnedWithin(scope, styleOf);
  const layers: Layer[] = [];

  const visitChildren = (parent: Element, depth: number) => {
    for (const child of parent.children) visit(child, depth);
  };

  const visit = (element: Element, depth: number): void => {
    const name = element.localName;
    if (NON_RENDERING.has(name) || !isStyled(element) || isOwnUi(element)) return;

    const style = styleOf(element);
    const display = style.display;
    if (display === 'none') return;

    const solid = SOLID.has(name);
    if (!solid && (display === 'contents' || display === 'inline')) return visitChildren(element, depth);
    if (pinned.has(element)) return;

    const rise = mode === 'dom' || lift.has(element) || paints(element, style, styleOf) ? 1 : 0;
    const layer: Mutable<Layer> = {
      element,
      depth: depth + rise,
      rise,
      opens: false,
      translate: style.getPropertyValue('translate') || 'none'
    };
    const index = layers.length;
    layers.push(layer);

    if (!solid && element.childElementCount > 0 && !flatteningReason(style)) visitChildren(element, layer.depth);

    layer.opens = layers.length > index + 1;
    if (!rise && !layer.opens) layers.pop();
  };

  return { layers, visit, visitChildren };
}

const NOTHING: ReadonlySet<Element> = new Set();

export function planLayers(
  root: Element,
  mode: LayerLensAuditDepth,
  styleOf: StyleOf,
  lift: ReadonlySet<Element> = NOTHING
): LayerPlan {
  const flat = flatteningReason(styleOf(root));
  if (flat) return { layers: [], flat };

  const planner = createPlanner(root, mode, styleOf, lift);
  planner.visitChildren(root, 0);
  return { layers: planner.layers, flat: null };
}

export function planAdded(
  element: Element,
  depth: number,
  mode: LayerLensAuditDepth,
  styleOf: StyleOf,
  lift: ReadonlySet<Element> = NOTHING
): Layer[] {
  const planner = createPlanner(element, mode, styleOf, lift);
  planner.visit(element, depth);
  return planner.layers;
}
