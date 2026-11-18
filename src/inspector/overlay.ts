import { describeElement } from '../shared/dom';

export interface Overlay {
  focus(elements: readonly Element[]): void;
  outline(elements: readonly Element[]): void;
  clear(): void;
  destroy(): void;
}

interface Drawn {
  target: Element;
  box: HTMLElement;
  at: string;
}

export function createOverlay(container: ShadowRoot): Overlay {
  const doc = container.ownerDocument;
  const view = doc.defaultView ?? window;
  const layer = doc.createElement('div');
  layer.className = 'overlay';
  container.append(layer);

  let focused: Drawn[] = [];
  let outlined: Drawn[] = [];
  let frame = 0;
  const nextFrame = (callback: () => void) =>
    typeof view.requestAnimationFrame === 'function' ? view.requestAnimationFrame(callback) : view.setTimeout(callback, 16);
  const cancelFrame = (id: number) =>
    typeof view.cancelAnimationFrame === 'function' ? view.cancelAnimationFrame(id) : view.clearTimeout(id);

  function draw(target: Element, strong: boolean): Drawn {
    const box = doc.createElement('div');
    box.className = strong ? 'box' : 'box faint';
    if (strong) {
      const tag = doc.createElement('span');
      tag.className = 'tag';
      tag.textContent = describeElement(target);
      box.append(tag);
    }
    layer.append(box);
    return { target, box, at: '' };
  }

  function place(drawn: Drawn, rect: DOMRect) {
    const width = Math.max(rect.width, 4);
    const height = Math.max(rect.height, 4);
    const at = `${rect.left} ${rect.top} ${width} ${height}`;
    if (at === drawn.at) return;
    drawn.at = at;
    const style = drawn.box.style;
    style.left = `${rect.left}px`;
    style.top = `${rect.top}px`;
    style.width = `${width}px`;
    style.height = `${height}px`;
  }

  function tick() {
    const drawn = outlined.length ? [...outlined, ...focused] : focused;
    const rects = drawn.map(({ target }) => target.getBoundingClientRect());
    drawn.forEach((item, index) => place(item, rects[index]!));
    frame = drawn.length ? nextFrame(tick) : 0;
  }

  function start() {
    if (!frame && (focused.length || outlined.length)) tick();
  }

  function remove(drawn: Drawn[]) {
    for (const { box } of drawn) box.remove();
  }

  return {
    focus(elements) {
      remove(focused);
      focused = elements.map((element) => draw(element, true));
      start();
    },
    outline(elements) {
      remove(outlined);
      outlined = elements.map((element) => draw(element, false));
      start();
    },
    clear() {
      remove(focused);
      focused = [];
    },
    destroy() {
      if (frame) cancelFrame(frame);
      frame = 0;
      layer.remove();
      focused = [];
      outlined = [];
    }
  };
}
