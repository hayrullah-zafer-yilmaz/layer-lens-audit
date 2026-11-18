import { afterEach, describe, expect, it } from 'vitest';
import { screen, type Screening } from '../src/audit/checks';
import { collectCssFacts, matchable } from '../src/audit/selectors';
import { MESSAGES } from '../src/i18n';
import { computedStyles } from '../src/shared/dom';

function check(html: string, css = ''): Screening {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `<main id="root">${html}</main>`;
  const root = document.getElementById('root')!;
  const facts = collectCssFacts(document);
  const positioned = new Set<Element>();
  for (const selector of facts.positional) for (const element of root.querySelectorAll(matchable(selector))) positioned.add(element);
  const target = root.querySelector('[data-target], .target') ?? root.firstElementChild!;
  return screen(target, { root, styleOf: computedStyles(window), view: window, facts, positioned, messages: MESSAGES.en });
}

const kept = (screening: Screening) => ('keep' in screening ? screening.keep : null);

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('screen', () => {
  it('tests a plain wrapper by unwrapping it', () => {
    expect(check('<div class="target"><p>x</p></div>')).toEqual({ test: 'unwrap', notes: [] });
  });

  it('tests an empty element by removing it, with a note to check', () => {
    const result = check('<div class="target"></div>');
    expect(result).toMatchObject({ test: 'remove' });
    expect('notes' in result && result.notes[0]).toMatch(/Scripts sometimes fill/);
  });

  it('keeps elements that mean more than a div', () => {
    expect(kept(check('<section class="target"><p>x</p></section>'))).toBe('a section means more than a div');
  });

  it('keeps elements with a job', () => {
    expect(kept(check('<div class="target" role="group"><p>x</p></div>'))).toBe('it has a role attribute');
    expect(kept(check('<div class="target" aria-label="x"><p>x</p></div>'))).toBe('it has an aria-label attribute');
  });

  it('keeps elements whose framework handlers live on the element', () => {
    document.body.innerHTML = '';
    const result = (() => {
      document.body.innerHTML = '<main id="root"><div class="target"><p>x</p></div></main>';
      const target = document.querySelector('.target') as HTMLElement & Record<string, unknown>;
      target.__reactProps$abc = { onClick() {} };
      const root = document.getElementById('root')!;
      return screen(target, {
        root,
        styleOf: computedStyles(window),
        view: window,
        facts: collectCssFacts(document),
        positioned: new Set(),
        messages: MESSAGES.en
      });
    })();
    expect(kept(result)).toBe('it has a React onClick handler');
  });

  it('keeps elements that draw or have an effect', () => {
    expect(kept(check('<div class="target"><p>x</p></div>', '.target { background-color: #eee; }'))).toBe(
      'it draws a background, border, shadow or outline'
    );
    expect(kept(check('<div class="target"><p>x</p></div>', '.target { position: relative; }'))).toBe('it is positioned');
    expect(kept(check('<div class="target"><p>x</p></div>', '.target { overflow: hidden; }'))).toBe(
      'it clips or scrolls its content'
    );
  });

  it('keeps elements that set inherited styles for what is inside them', () => {
    expect(kept(check('<div class="target"><p>x</p></div>', '.target { color: rgb(200, 0, 0); }'))).toBe(
      'it sets color for what is inside it'
    );
  });

  it('keeps elements styled in another state or at another size', () => {
    expect(kept(check('<div class="target"><p>x</p></div>', '.target:hover { color: red; }'))).toBe(
      'it has its own styles when .target:hover applies'
    );
    expect(kept(check('<div class="target"><p>x</p></div>', '.dark .target { color: white; }'))).toBe(
      'it has its own styles when .dark .target applies'
    );
    expect(kept(check('<div class="target"><p>x</p></div>', '@media (min-width: 900px) { .target { display: flex; } }'))).toBe(
      'it has its own styles under @media (min-width: 900px)'
    );
    expect(kept(check('<div class="target"><p>x</p></div>', '.target { max-width: 60rem; }'))).toBe(
      'it limits its size (max-width: 60rem), which can matter at other screen sizes'
    );
  });

  it('keeps elements that other elements are styled through', () => {
    expect(kept(check('<div class="target"><p class="title">x</p></div>', '.target > .title { margin: 0; }'))).toBe(
      'other elements are styled through it: .target > .title'
    );
  });

  it('keeps elements whose siblings are styled by position', () => {
    expect(
      kept(check('<div class="stack"><p>a</p><div class="target"><p>b</p></div></div>', '.stack > * + * { margin-top: 8px; }'))
    ).toBe('its siblings or children are styled by their position, which would shift');
  });

  it('notes ids and data attributes that code may rely on', () => {
    const result = check('<div class="target" id="hero" data-testid="hero" data-v-1a2b><p>x</p></div>');
    expect(result).toEqual({
      test: 'unwrap',
      notes: ['Has id="hero": check that no CSS, link or script uses it.', 'Has data-testid="hero": tests may select it.']
    });
  });
});
