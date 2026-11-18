import { describeElement, UI_ATTRIBUTE } from '../shared/dom';

export interface HoverLabel {
  show(text: string, x: number, y: number): void;
  hide(): void;
  remove(): void;
}

const OFFSET = 14;
const EDGE = 8;

export function createHoverLabel(doc: Document, color: string): HoverLabel {
  const label = doc.createElement('div');
  label.setAttribute('aria-hidden', 'true');
  label.setAttribute(UI_ATTRIBUTE, '');

  const style = label.style;
  const styles: [string, string][] = [
    ['all', 'initial'],
    ['position', 'fixed'],
    ['left', '0'],
    ['top', '0'],
    ['z-index', '2147483647'],
    ['pointer-events', 'none'],
    ['padding', '4px 8px'],
    ['border-radius', '6px'],
    ['background', '#0f172a'],
    ['box-shadow', `inset 3px 0 0 ${color}, 0 4px 14px rgb(0 0 0 / 0.18)`],
    ['color', '#f8fafc'],
    ['font', '500 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'],
    ['white-space', 'nowrap'],
    ['display', 'none']
  ];
  for (const [property, value] of styles) style.setProperty(property, value);
  let size: { text: string; width: number; height: number } | null = null;

  return {
    show(text, x, y) {
      if (!label.isConnected) doc.body.append(label);
      style.setProperty('display', 'block');
      if (size?.text !== text) {
        label.textContent = text;
        size = { text, width: label.offsetWidth, height: label.offsetHeight };
      }

      const view = doc.defaultView;
      const right = (view?.innerWidth ?? Number.POSITIVE_INFINITY) - size.width - EDGE;
      const bottom = (view?.innerHeight ?? Number.POSITIVE_INFINITY) - size.height - EDGE;
      const left = Math.max(EDGE, Math.min(x + OFFSET, right));
      const top = y + OFFSET <= bottom ? y + OFFSET : y - OFFSET - size.height;
      style.setProperty('transform', `translate(${Math.round(left)}px, ${Math.round(Math.max(EDGE, top))}px)`);
    },
    hide() {
      style.setProperty('display', 'none');
    },
    remove() {
      label.remove();
    }
  };
}

export function describeWithSize(element: Element): string {
  const size =
    'offsetWidth' in element ? ` · ${(element as HTMLElement).offsetWidth} × ${(element as HTMLElement).offsetHeight}` : '';
  return `${describeElement(element)}${size}`;
}
