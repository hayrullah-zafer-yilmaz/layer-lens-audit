import { describe, expect, it } from 'vitest';
import type { AuditJson, FindingJson } from '../src/audit/report';
import { baselineOf, combine, compareWithBaseline, countForLimit } from '../src/cli/combine';
import { formatMarkdown, formatText } from '../src/format';
import { MESSAGES } from '../src/i18n';

const en = MESSAGES.en;

function wrappers(selectors: string[]): FindingJson {
  return {
    kind: 'redundant-wrappers',
    confidence: 'high',
    title: selectors.length === 1 ? en.wrapper('div') : en.wrappers(selectors.length),
    detail: '',
    fix: en.wrapperFix,
    notes: [],
    selector: selectors[0]!,
    selectors,
    tags: selectors.map(() => 'div'),
    source: null
  };
}

function empty(selector: string): FindingJson {
  return {
    ...wrappers([selector]),
    kind: 'empty-element',
    confidence: 'medium',
    title: en.empty('div'),
    fix: en.emptyFix,
    notes: [en.noteEmpty]
  };
}

function report(findings: FindingJson[], width = 1440): AuditJson {
  const removable = findings.filter((f) => f.kind !== 'dom-size').reduce((total, f) => total + f.selectors.length, 0);
  return {
    url: 'http://localhost:5173/',
    locale: 'en',
    viewport: { width, height: 900 },
    durationMs: 20,
    removable,
    stats: { elements: 100, depth: 12, children: 8 },
    cleaned: { elements: 100 - removable, depth: 9, children: 8 },
    limits: { elements: 1400, depth: 32, children: 60 },
    unreadableStyleSheets: 0,
    findings
  };
}

describe('combine', () => {
  it('keeps only what can go at every screen size', () => {
    const desktop = report([wrappers(['.a', '.b', '.c']), wrappers(['.d']), empty('.e')]);
    const mobile = report([wrappers(['.a']), wrappers(['.c']), empty('.e')], 390);
    const combined = combine(
      [
        { viewport: { width: 1440, height: 900 }, report: desktop },
        { viewport: { width: 390, height: 844 }, report: mobile }
      ],
      en
    );

    expect(combined.removable).toBe(3);
    expect(combined.viewports).toEqual([
      { width: 1440, height: 900 },
      { width: 390, height: 844 }
    ]);
    expect(combined.findings.map((finding) => [finding.title, finding.selectors])).toEqual([
      ["This div isn't needed", ['.a']],
      ["This div isn't needed", ['.c']],
      ["This empty div isn't needed", ['.e']]
    ]);
    expect(combined.cleaned.elements).toBe(97);
  });

  it('keeps DOM size findings from any screen size', () => {
    const size: FindingJson = { ...wrappers(['body']), kind: 'dom-size', title: en.domSize('1,500', '1,400') };
    const combined = combine(
      [
        { viewport: { width: 1440, height: 900 }, report: report([size]) },
        { viewport: { width: 390, height: 844 }, report: report([]) }
      ],
      en
    );
    expect(combined.findings.map((finding) => finding.kind)).toEqual(['dom-size']);
  });
});

describe('baselines', () => {
  const current = combine([{ viewport: { width: 1440, height: 900 }, report: report([wrappers(['.a', '.b']), empty('.e')]) }], en);

  it('saves every element that can go', () => {
    expect(baselineOf(current)).toEqual({
      version: 1,
      elements: ['empty-element .e', 'redundant-wrappers .a', 'redundant-wrappers .b']
    });
  });

  it('counts and marks only what is new', () => {
    const compared = compareWithBaseline(current, { version: 1, elements: ['redundant-wrappers .a', 'redundant-wrappers .b'] });
    expect(compared.baseline).toEqual({ known: 2, fresh: 1 });
    expect(compared.findings.map((finding) => Boolean((finding as { fresh?: boolean }).fresh))).toEqual([false, true]);
    expect(countForLimit(compared)).toBe(1);
    expect(countForLimit(current)).toBe(3);
  });
});

describe('formats', () => {
  const data = combine([{ viewport: { width: 1440, height: 900 }, report: report([wrappers(['.a', '.b']), empty('.e')]) }], en);

  it('writes a Markdown table that pastes into a pull request', () => {
    const markdown = formatMarkdown(data, en);
    expect(markdown).toContain('### layer-lens-audit: 3 of 100 elements could go (3.0%).');
    expect(markdown).toContain('Measured at 1440 × 900.');
    expect(markdown).toContain('| Finding | Where | Selector | Check |');
    expect(markdown).toContain("| 2 nested wrappers aren't needed |  | `.a` |  |");
  });

  it('says once, under the table, what to do about each kind of finding', () => {
    const markdown = formatMarkdown(data, en);
    expect(markdown).toContain(
      '**How to fix**\n\n- **Wrappers:** Delete the wrapper tags and keep what is inside them where it is.\n- **Empty elements:** Delete the element.'
    );
    const react = { ...data, findings: [{ ...data.findings[0]!, fix: `${en.wrapperFix} ${en.frameworkFix.react}` }] };
    expect(formatMarkdown(react, en)).toContain('return a Fragment (`<>…</>`)');
  });

  it('writes Turkish headings and numbers in Turkish', () => {
    const markdown = formatMarkdown(data, MESSAGES.tr);
    expect(markdown).toContain('### layer-lens-audit: 100 elemandan 3 tanesi kaldırılabilir (%3,0).');
    expect(markdown).toContain('| Bulgu | Nerede | Seçici | Kontrol |');
  });

  it('escapes pipes so a note cannot break the table', () => {
    const tricky = { ...data, findings: [{ ...data.findings[0]!, notes: ['a | b'] }] };
    expect(formatMarkdown(tricky, en)).toContain('a \\| b');
  });

  it('writes plain text without colours for files and pipes', () => {
    const text = formatText(data, en, false);
    expect(text).toContain('3 of 100 elements could go (3.0%).');
    expect(text).toContain("● This empty div isn't needed  check");
    expect(text).toContain('How to fix\n  Wrappers: Delete the wrapper tags');
    expect(text).not.toContain('\x1b[');
  });
});
