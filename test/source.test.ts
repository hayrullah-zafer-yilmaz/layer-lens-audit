import { afterEach, describe, expect, it } from 'vitest';
import { describeSource, selectorOf, sourceOf } from '../src/audit/source';

type Tagged = HTMLElement & Record<string, unknown>;

const element = () => document.createElement('div') as unknown as Tagged;

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(window, 'ng');
});

describe('sourceOf', () => {
  it('reads Vue components and their files', () => {
    const el = element();
    el.__vueParentComponent = { type: { __name: 'ProductCard', __file: '/src/ProductCard.vue' } };
    expect(sourceOf(el)).toEqual({ framework: 'vue', component: 'ProductCard', file: '/src/ProductCard.vue', line: null });
  });

  it('reads the React component that rendered the element', () => {
    function ProductCard() {}
    const el = element();
    el['__reactFiber$x1'] = { return: { type: 'div', return: { type: ProductCard, return: null } } };
    expect(sourceOf(el)).toMatchObject({ framework: 'react', component: 'ProductCard' });
  });

  it("prefers React's owner and source in development builds", () => {
    const el = element();
    const Card = Object.assign(() => null, { displayName: 'Card' });
    el['__reactFiber$x1'] = { _debugOwner: { type: Card }, _debugSource: { fileName: '/src/Card.tsx', lineNumber: 12 } };
    expect(sourceOf(el)).toEqual({ framework: 'react', component: 'Card', file: '/src/Card.tsx', line: 12 });
  });

  it('leaves out minified names', () => {
    const el = element();
    el['__reactFiber$x1'] = { return: { type: function e() {}, return: null } };
    expect(sourceOf(el)).toMatchObject({ component: null });
  });

  it('reads Svelte locations', () => {
    const el = element();
    el.__svelte_meta = { loc: { file: 'src/lib/Card.svelte', line: 4, column: 2 } };
    expect(sourceOf(el)).toEqual({ framework: 'svelte', component: 'Card', file: 'src/lib/Card.svelte', line: 4 });
  });

  it('asks Angular for the owning component', () => {
    class _ProductCardComponent {}
    Object.assign(window, { ng: { getOwningComponent: () => new _ProductCardComponent() } });
    expect(sourceOf(element())).toMatchObject({ framework: 'angular', component: 'ProductCardComponent' });
  });

  it('returns null for plain HTML', () => {
    expect(sourceOf(element())).toBeNull();
  });
});

describe('describeSource', () => {
  it('prefers the file and line, then the component', () => {
    expect(describeSource({ framework: 'vue', component: 'Card', file: '/src/Card.vue', line: null })).toBe('Card.vue');
    expect(describeSource({ framework: 'svelte', component: 'Card', file: 'src/Card.svelte', line: 4 })).toBe('Card.svelte:4');
    expect(describeSource({ framework: 'react', component: 'Card', file: null, line: null })).toBe('Card');
    expect(describeSource(null)).toBeNull();
  });
});

describe('selectorOf', () => {
  it('builds the shortest selector that finds only this element', () => {
    document.body.innerHTML = `
      <main>
        <ul class="list"><li class="item">a</li><li class="item">b</li></ul>
        <div id="hero"><span class="title">x</span></div>
      </main>`;
    const second = document.querySelectorAll('.item')[1]!;
    const title = document.querySelector('.title')!;

    expect(selectorOf(second)).toBe('li.item:nth-of-type(2)');
    expect(selectorOf(title)).toBe('span.title');
    for (const target of [second, title]) expect(document.querySelectorAll(selectorOf(target))).toHaveLength(1);
  });
});
