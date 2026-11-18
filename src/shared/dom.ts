export type StyledElement = Element & ElementCSSInlineStyle;

export type StyleOf = (element: Element) => CSSStyleDeclaration;

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;

export const UI_ATTRIBUTE = 'data-layer-lens-audit-ui';

export const NON_RENDERING = new Set([
  'area',
  'base',
  'br',
  'datalist',
  'head',
  'link',
  'map',
  'meta',
  'noscript',
  'optgroup',
  'option',
  'param',
  'script',
  'source',
  'style',
  'template',
  'title',
  'track',
  'wbr'
]);

export const SOLID = new Set([
  'audio',
  'button',
  'canvas',
  'embed',
  'hr',
  'iframe',
  'img',
  'input',
  'meter',
  'object',
  'progress',
  'select',
  'svg',
  'textarea',
  'video'
]);

const SIDES = ['top', 'right', 'bottom', 'left'];

export const isStyled = (element: Element): element is StyledElement => 'style' in element;

export const isSet = (value: string | null | undefined) => !!value && value !== 'none';

export const hasShadow = (value: string | null | undefined) => !!value && !/\bnone\b/.test(value);

export function transparent(color: string | null | undefined): boolean {
  const value = (color ?? '').trim().toLowerCase();
  return !value || value === 'transparent' || /[,/]\s*0(?:\.0*)?%?\s*\)$/.test(value);
}

export function computedStyles(view: Window): StyleOf {
  const cache = new Map<Element, CSSStyleDeclaration>();
  return (element) => {
    let style = cache.get(element);
    if (!style) {
      style = view.getComputedStyle(element);
      cache.set(element, style);
    }
    return style;
  };
}

export function drawsBox(style: CSSStyleDeclaration): boolean {
  if (!transparent(style.backgroundColor) || isSet(style.backgroundImage) || hasShadow(style.boxShadow)) return true;

  return SIDES.some((side) => {
    const width = parseFloat(style.getPropertyValue(`border-${side}-width`));
    const line = style.getPropertyValue(`border-${side}-style`);
    return width > 0 && line !== 'none' && line !== 'hidden' && !transparent(style.getPropertyValue(`border-${side}-color`));
  });
}

export function drawsOutline(style: CSSStyleDeclaration): boolean {
  const line = style.getPropertyValue('outline-style');
  return (
    !!line &&
    line !== 'none' &&
    parseFloat(style.getPropertyValue('outline-width')) > 0 &&
    !transparent(style.getPropertyValue('outline-color'))
  );
}

export function hasOwnText(element: Element, styleOf: StyleOf): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      if (node.nodeValue?.trim()) return true;
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;

    const child = node as Element;
    if (SOLID.has(child.localName) || NON_RENDERING.has(child.localName)) continue;
    const display = styleOf(child).display;
    if ((display === 'inline' || display === 'contents') && hasOwnText(child, styleOf)) return true;
  }
  return false;
}

export function hasContent(element: Element): boolean {
  if (element.childElementCount > 0) return true;
  for (const node of element.childNodes) {
    if (node.nodeType === TEXT_NODE && node.nodeValue?.trim()) return true;
  }
  return false;
}

export function flatteningReason(style: CSSStyleDeclaration): string | null {
  for (const property of ['overflow-x', 'overflow-y']) {
    const value = style.getPropertyValue(property);
    if (value && value !== 'visible' && value !== 'clip') return `overflow: ${value}`;
  }

  const opacity = parseFloat(style.opacity);
  if (opacity < 1) return `opacity: ${style.opacity}`;

  for (const property of ['filter', 'backdrop-filter', 'clip-path', 'mask-image', '-webkit-mask-image']) {
    const value = style.getPropertyValue(property);
    if (isSet(value)) return `${property}: ${value}`;
  }

  if (style.getPropertyValue('isolation') === 'isolate') return 'isolation: isolate';

  const blend = style.getPropertyValue('mix-blend-mode');
  if (blend && blend !== 'normal') return `mix-blend-mode: ${blend}`;

  const contain = style.getPropertyValue('contain');
  if (/\b(?:paint|strict|content)\b/.test(contain)) return `contain: ${contain}`;

  return null;
}

export function describeElement(element: Element): string {
  const id = element.id ? `#${element.id}` : '';
  const classes = [...element.classList]
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join('');
  return `${element.localName}${id}${classes}`;
}

export const isOwnUi = (element: Element) => element.hasAttribute(UI_ATTRIBUTE);
