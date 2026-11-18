import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLayerLensAudit, type LayerLensAudit } from '../src/view/layerLensAudit';

let lens: LayerLensAudit | null = null;

function mount() {
  document.head.innerHTML = '<style>.card { background-color: #fff; }</style>';
  document.body.innerHTML = `
    <section id="root" style="padding: 4px">
      <div id="wrap">
        <article id="card" class="card"><h2 id="title">Title</h2></article>
      </div>
    </section>`;
  return document.getElementById('root') as HTMLElement;
}

const el = (id: string) => document.getElementById(id) as HTMLElement;
const css = (id: string, property: string) => el(id).style.getPropertyValue(property);
const styleAttributes = () => [...document.querySelectorAll('*')].map((node) => [node.id, node.getAttribute('style')]);
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

afterEach(() => {
  lens?.destroy();
  lens = null;
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('createLayerLensAudit', () => {
  it('tips the root back and lifts each layer', async () => {
    const root = mount();
    lens = createLayerLensAudit(root, { duration: 0 });

    const opened = lens.open();
    expect(lens.phase).toBe('opening');
    expect(lens.isOpen).toBe(true);
    expect(css('root', 'transform-style')).toBe('preserve-3d');
    expect(css('root', 'transform')).toContain('rotateX(55deg) rotateZ(-35deg)');
    expect(css('wrap', 'transform-style')).toBe('preserve-3d');
    expect(css('wrap', 'translate')).toBe('');
    expect(css('card', 'translate')).toBe('0px 0px 40px');
    expect(css('title', 'translate')).toBe('0px 0px 40px');

    await opened;
    expect(lens.phase).toBe('open');
  });

  it('puts every style back exactly as it was', async () => {
    const root = mount();
    const before = styleAttributes();
    lens = createLayerLensAudit(root, { duration: 0 });

    await lens.open();
    await lens.close();

    expect(lens.phase).toBe('closed');
    expect(styleAttributes()).toEqual(before);
  });

  it('keeps inline styles the page set itself', async () => {
    const root = mount();
    el('card').style.setProperty('translate', '5px 6px');
    el('card').style.setProperty('outline-color', 'red', 'important');
    lens = createLayerLensAudit(root, { duration: 0 });

    await lens.open();
    expect(css('card', 'translate')).toBe('5px 6px 40px');

    await lens.close();
    expect(css('card', 'translate')).toBe('5px 6px');
    expect(el('card').style.getPropertyPriority('translate')).toBe('');
    expect(css('card', 'outline-color')).toBe('red');
    expect(el('card').style.getPropertyPriority('outline-color')).toBe('important');
  });

  it('reports opening and closing, and closes on Escape', async () => {
    const changes: boolean[] = [];
    lens = createLayerLensAudit(mount(), { duration: 0, onOpenChange: (open) => changes.push(open) });

    await lens.open();
    pressEscape();
    expect(lens.phase).toBe('closing');

    await lens.close();
    expect(lens.phase).toBe('closed');
    expect(changes).toEqual([true, false]);
  });

  it('ignores Escape when it is not interactive', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0, interactive: false });

    await lens.open();
    pressEscape();
    expect(lens.phase).toBe('open');
    expect(css('root', 'cursor')).toBe('');
  });

  it('toggles between open and closed', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });

    await lens.toggle();
    expect(lens.phase).toBe('open');
    await lens.toggle();
    expect(lens.phase).toBe('closed');
  });

  it('lets a close interrupt an open', async () => {
    const root = mount();
    const before = styleAttributes();
    lens = createLayerLensAudit(root, { duration: 0 });

    const opened = lens.open();
    const closed = lens.close();
    await Promise.all([opened, closed]);

    expect(lens.phase).toBe('closed');
    expect(styleAttributes()).toEqual(before);
  });

  it('moves an open lens to new options', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();

    lens.update({ spacing: 60, tilt: 20 });
    expect(css('card', 'translate')).toBe('0px 0px 60px');
    expect(css('root', 'transform')).toContain('rotateX(20deg)');

    lens.update({ depth: 'dom' });
    expect(css('wrap', 'translate')).toBe('0px 0px 60px');
    expect(css('card', 'translate')).toBe('0px 0px 60px');
  });

  it('puts the page back at once when destroyed', () => {
    const root = mount();
    const before = styleAttributes();
    lens = createLayerLensAudit(root, { duration: 700 });

    void lens.open();
    lens.destroy();

    expect(lens.phase).toBe('closed');
    expect(styleAttributes()).toEqual(before);
  });

  it('lifts content added while open, and lets go of content removed', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();

    el('wrap').insertAdjacentHTML('beforeend', '<article id="late" class="card"><p id="late-text">x</p></article>');
    await nextTask();
    expect(css('late', 'translate')).toBe('0px 0px 40px');
    expect(css('late-text', 'translate')).toBe('0px 0px 40px');

    const late = el('late');
    late.remove();
    await nextTask();
    expect(late.getAttribute('style')).toBeNull();
  });

  it('lets the levels rise one after another', () => {
    lens = createLayerLensAudit(mount(), { duration: 1000 });
    void lens.open();

    expect(css('root', 'transition-delay')).toBe('0ms');
    expect(css('card', 'transition-delay')).toBe('80ms');
    expect(css('title', 'transition-delay')).toBe('160ms');
  });

  it('skips the animation when the user prefers reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query.includes('reduce') })
    });
    lens = createLayerLensAudit(mount(), { duration: 1000 });
    void lens.open();

    expect(css('root', 'transition-duration')).toBe('0ms');
    expect(css('title', 'transition-delay')).toBe('0ms');
  });

  it('outlines the layers unless told not to', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();
    expect(css('root', 'outline-style')).toBe('dashed');
    expect(css('card', 'outline-style')).toBe('solid');
    expect(css('wrap', 'outline-style')).toBe('');

    lens.update({ outlines: false });
    expect(css('root', 'outline-style')).toBe('');
    expect(css('card', 'outline-style')).toBe('');
  });

  it('marks elements in red and lifts them even when they draw nothing', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0, marks: [el('wrap')] });
    await lens.open();

    expect(css('wrap', 'translate')).toBe('0px 0px 40px');
    expect(css('wrap', 'outline-color')).toBe('rgb(220, 38, 38)');
    expect(css('wrap', 'background-color')).not.toBe('');
    expect(css('card', 'translate')).toBe('0px 0px 40px');

    await lens.close();
    expect(el('wrap').getAttribute('style')).toBeNull();
  });

  it('warns when the root keeps everything flat', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = mount();
    root.style.overflow = 'hidden';
    lens = createLayerLensAudit(root, { duration: 0 });

    await lens.open();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('overflow: hidden'));
  });
});

describe('zoom', () => {
  const scale = () => Number(/scale3d\(([\d.]+),/.exec(css('root', 'transform'))?.[1]);
  const translate = () => {
    const [, x, y = '0'] = /translate\((-?[\d.]+)px(?:, (-?[\d.]+)px)?\)/.exec(css('root', 'transform'))!;
    return [Number(x), Number(y)];
  };
  const key = (name: string, target: EventTarget = document) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  const pointer = (type: string, x: number, y: number, shiftKey = false) =>
    el('root').dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, shiftKey, bubbles: true }));

  it('zooms between 0.5 and 4 and reports each change', async () => {
    const zooms: number[] = [];
    lens = createLayerLensAudit(mount(), { duration: 0, onZoomChange: (zoom) => zooms.push(zoom) });
    await lens.open();

    lens.setZoom(2);
    expect(scale()).toBe(2);
    lens.setZoom(10);
    expect(lens.zoom).toBe(4);
    lens.setZoom(0.1);
    expect(lens.zoom).toBe(0.5);
    expect(zooms).toEqual([2, 4, 0.5]);
  });

  it('zooms with + and −, resets with 0, and leaves the keys alone while someone types', async () => {
    const root = mount();
    root.insertAdjacentHTML('beforeend', '<input id="field">');
    lens = createLayerLensAudit(root, { duration: 0 });
    await lens.open();

    key('+');
    expect(lens.zoom).toBe(1.25);
    key('-');
    key('-');
    expect(lens.zoom).toBeCloseTo(0.8);
    key('+', el('field'));
    expect(lens.zoom).toBeCloseTo(0.8);
    key('0');
    expect(lens.zoom).toBe(1);
  });

  it('zooms on Ctrl + scroll and a pinch, but lets a plain scroll scroll the page', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();

    const plain = new WheelEvent('wheel', { deltaY: -40, cancelable: true });
    el('root').dispatchEvent(plain);
    expect(lens.zoom).toBe(1);
    expect(plain.defaultPrevented).toBe(false);

    const pinch = new WheelEvent('wheel', { deltaY: -40, ctrlKey: true, cancelable: true });
    el('root').dispatchEvent(pinch);
    expect(lens.zoom).toBeCloseTo(Math.exp(0.4));
    expect(pinch.defaultPrevented).toBe(true);
  });

  it('moves the view with Shift + drag and turns it with a plain drag', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();

    pointer('pointerdown', 100, 100, true);
    pointer('pointermove', 130, 90, true);
    pointer('pointerup', 130, 90, true);
    expect(translate()).toEqual([30, -10]);
    expect(css('root', 'transform')).toContain('rotateZ(-35deg)');

    pointer('pointerdown', 100, 100);
    pointer('pointermove', 120, 100);
    pointer('pointerup', 120, 100);
    expect(css('root', 'transform')).toContain('rotateZ(-41deg)');

    lens.resetView();
    expect(translate()).toEqual([0, 0]);
    expect(css('root', 'transform')).toContain('rotateZ(-35deg)');
  });

  it('opens fitted again after it was zoomed and closed', async () => {
    lens = createLayerLensAudit(mount(), { duration: 0 });
    await lens.open();
    lens.setZoom(3);
    await lens.close();

    expect(lens.zoom).toBe(1);
    await lens.open();
    expect(scale()).toBe(1);
  });
});
