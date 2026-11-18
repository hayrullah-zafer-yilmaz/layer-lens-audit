import { afterEach, describe, expect, it } from 'vitest';
import {
  collectCssFacts,
  lastCombinator,
  matchable,
  nestedTokensOf,
  parseSelector,
  sizeLimits,
  splitCompounds,
  splitList,
  tokensOf
} from '../src/audit/selectors';

afterEach(() => {
  document.head.innerHTML = '';
});

describe('selector parsing', () => {
  it('splits a list on top-level commas only', () => {
    expect(splitList('.a, .b:is(.c, .d), [data-x="1,2"]')).toEqual(['.a', '.b:is(.c, .d)', '[data-x="1,2"]']);
  });

  it('splits a complex selector into compounds', () => {
    expect(splitCompounds('.card > .body .title + span ~ em')).toEqual(['.card', '.body', '.title', 'span', 'em']);
    expect(splitCompounds('li:nth-child(2n + 1) a[href~="x y"]')).toEqual(['li:nth-child(2n + 1)', 'a[href~="x y"]']);
  });

  it('reads the classes and ids a compound requires', () => {
    expect(tokensOf('div.card.is-open#main:hover')).toEqual(['.card', '.is-open', '#main']);
    expect(tokensOf('.hover\\:bg-gray-100:hover')).toEqual(['.hover:bg-gray-100']);
    expect(tokensOf('.\\33 xl\\:w-auto')).toEqual(['.3xl:w-auto']);
    expect(tokensOf('.a:not(.b)')).toEqual(['.a']);
  });

  it('reads the classes inside :is(), :where() and :has()', () => {
    expect(nestedTokensOf(':is(.\\*\\:flex > *)')).toEqual(['.*:flex']);
    expect(nestedTokensOf('.card:has(.badge)')).toEqual(['.badge']);
  });

  it('finds the combinator before the last compound', () => {
    expect(lastCombinator('.a .b')).toBe(' ');
    expect(lastCombinator('.a > .b')).toBe('>');
    expect(lastCombinator('.a + .b')).toBe('+');
    expect(lastCombinator('.stack > * ~ *')).toBe('~');
    expect(lastCombinator('.a')).toBeNull();
  });

  it('takes out states and pseudo-elements to match now', () => {
    expect(matchable('.group:hover .arrow::after')).toBe('.group .arrow');
  });

  it('reads a selector in one pass the way the separate helpers do', () => {
    const cases: [selector: string, positional: boolean][] = [
      ['.card > .body .title + span ~ em', true],
      ['li:nth-child(2n + 1) a[href~="x y"]', false],
      ['ul.list > li.item:first-child', true],
      ['.group:hover .arrow', false],
      ['.\\33 xl\\:w-auto', false],
      ['.hover\\:bg-gray-100:hover', false],
      [':is(.\\*\\:flex > *)', false],
      ['.card:has(.badge) .title', false],
      ['.stack > * ~ *', true],
      ['[data-x="a.b > c"] .c#d', false],
      ['.a:not(.b) + .c', true],
      ['.a\n.b', false]
    ];
    for (const [selector, positional] of cases) {
      const compounds = splitCompounds(selector);
      expect(parseSelector(selector), selector).toEqual({
        subject: tokensOf(compounds[compounds.length - 1] ?? ''),
        through: [...compounds.slice(0, -1).flatMap(tokensOf), ...nestedTokensOf(selector)],
        positional
      });
    }
  });

  it('splits plain lists without a scan, and the same way', () => {
    expect(splitList('.a,  .b > .c ,div')).toEqual(['.a', '.b > .c', 'div']);
  });
});

describe('sizeLimits', () => {
  it('finds limits that bind at other screen sizes', () => {
    const style = document.createElement('div').style;
    style.maxWidth = '80rem';
    style.minWidth = '0';
    style.width = 'clamp(10rem, 50vw, 40rem)';
    style.height = '100%';
    expect(sizeLimits(style)).toEqual(['max-width: 80rem', 'width: clamp(10rem, 50vw, 40rem)']);
  });

  it('finds none in a rule that sets no size', () => {
    const style = document.createElement('div').style;
    style.color = 'red';
    style.setProperty('--gap', '4px');
    expect(sizeLimits(style)).toEqual([]);
  });
});

describe('collectCssFacts', () => {
  function facts(css: string) {
    document.head.innerHTML = `<style>${css}</style>`;
    return collectCssFacts(document);
  }

  it('records the rules that style each class, and when they apply', () => {
    const result = facts(`
      .card { color: red; }
      @media (min-width: 900px) { .card { padding: 4px; } }
      .wrap { max-width: 60rem; }
    `);
    expect(result.subjects.get('.card')).toEqual([
      { selector: '.card', condition: null, limits: [] },
      { selector: '.card', condition: 'under @media (min-width: 900px)', limits: [] }
    ]);
    expect(result.subjects.get('.wrap')?.[0]?.limits).toEqual(['max-width: 60rem']);
  });

  it('records selectors that style other elements through a class', () => {
    const result = facts('.card > .title { margin: 0; } :is(.kids > *) { padding: 0; }');
    expect([...(result.through.get('.card') ?? [])]).toEqual(['.card > .title']);
    expect([...(result.through.get('.kids') ?? [])]).toEqual([':is(.kids > *)']);
    expect(result.through.has('.title')).toBe(false);
  });

  it('records positional selectors and custom properties', () => {
    const result = facts('li:first-child { margin: 0; } .stack > * + * { margin-top: 8px; } .theme { --accent: blue; }');
    expect([...result.positional]).toEqual(['li:first-child', '.stack > * + *']);
    expect([...(result.customProperties.get('.theme') ?? [])]).toEqual(['--accent']);
  });
});
