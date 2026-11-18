import { afterEach, describe, expect, it } from 'vitest';
import { computedStyles } from '../src/shared/dom';
import { planLayers, type Layer, type LayerLensAuditDepth } from '../src/view/layers';

function mount(html: string, css = '') {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `<div id="root">${html}</div>`;
  return document.getElementById('root') as HTMLElement;
}

const plan = (root: Element, mode: LayerLensAuditDepth = 'visual') => planLayers(root, mode, computedStyles(window));

const byId = (layers: Layer[]) =>
  Object.fromEntries(
    layers.map((layer) => [layer.element.id, { depth: layer.depth, rise: layer.rise, opens: layer.opens }])
  );

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

const CARD = `
  <div id="wrap">
    <div id="card" class="card">
      <p id="text">Hello</p>
      <div id="empty"></div>
    </div>
  </div>`;

describe('planLayers', () => {
  it('lifts only what draws something in visual mode', () => {
    const { layers } = plan(mount(CARD, '.card { background-color: #fff; }'));

    expect(byId(layers)).toEqual({
      wrap: { depth: 0, rise: 0, opens: true },
      card: { depth: 1, rise: 1, opens: true },
      text: { depth: 2, rise: 1, opens: false }
    });
  });

  it('lifts every element in dom mode', () => {
    const { layers } = plan(mount(CARD), 'dom');

    expect(byId(layers)).toEqual({
      wrap: { depth: 1, rise: 1, opens: true },
      card: { depth: 2, rise: 1, opens: true },
      text: { depth: 3, rise: 1, opens: false },
      empty: { depth: 3, rise: 1, opens: false }
    });
  });

  it('counts text inside inline elements as part of its block', () => {
    const { layers } = plan(mount('<p id="para"><span id="inline">only inline text</span></p>'));
    expect(byId(layers)).toEqual({ para: { depth: 1, rise: 1, opens: false } });
  });

  it('lifts controls and media as one piece', () => {
    const { layers } = plan(mount('<button id="button"><span id="icon"></span>Go</button><img id="photo" alt="">'));

    expect(byId(layers)).toEqual({
      button: { depth: 1, rise: 1, opens: false },
      photo: { depth: 1, rise: 1, opens: false }
    });
  });

  it('keeps the children of an element that flattens them', () => {
    const { layers } = plan(
      mount('<div id="clip" style="overflow: hidden; background-color: #eee"><p id="inside">x</p></div>')
    );
    expect(byId(layers)).toEqual({ clip: { depth: 1, rise: 1, opens: false } });
  });

  it('leaves the path to a positioned element alone', () => {
    const { layers } = plan(
      mount(`
        <div id="card" style="position: relative; background-color: #fff">
          <div id="body">
            <span id="badge" style="position: absolute; background-color: red">1</span>
            <p id="copy">x</p>
          </div>
        </div>
        <div id="frame" style="position: relative">
          <span id="pin" style="position: absolute; display: block; background-color: red">2</span>
        </div>`)
    );

    expect(byId(layers)).toEqual({
      card: { depth: 1, rise: 1, opens: false },
      frame: { depth: 0, rise: 0, opens: true },
      pin: { depth: 1, rise: 1, opens: false }
    });
  });

  it('goes through display: contents', () => {
    const { layers } = plan(mount('<div id="contents" style="display: contents"><p id="inner">x</p></div>'));
    expect(byId(layers)).toEqual({ inner: { depth: 1, rise: 1, opens: false } });
  });

  it('skips elements without a box', () => {
    const { layers } = plan(
      mount(`
        <script id="script"></script>
        <template id="template"><p>t</p></template>
        <div id="gone" style="display: none"><p>x</p></div>
        <div id="hidden" style="visibility: hidden; background-color: red"></div>`)
    );
    expect(layers).toEqual([]);
  });

  it('remembers the translate an element had', () => {
    const { layers } = plan(mount('<div id="moved" style="translate: 10px 20px; background-color: #fff"></div>'));
    expect(layers[0]?.translate).toBe('10px 20px');
  });

  it('reports a root that keeps everything flat', () => {
    const root = mount('<p>x</p>');
    root.style.overflow = 'hidden';

    expect(plan(root)).toEqual({ layers: [], flat: 'overflow: hidden' });
  });
});
