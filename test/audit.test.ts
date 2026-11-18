import { afterEach, describe, expect, it } from 'vitest';
import { audit } from '../src/audit/audit';

function mount(html: string, css = '') {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = html;
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('audit', () => {
  it('groups nested wrappers into one finding, outermost first', async () => {
    mount('<section><div class="a"><div class="b"><p>x</p></div></div></section>');
    const report = await audit();
    const wrappers = report.findings.filter((finding) => finding.kind === 'redundant-wrappers');

    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]!.elements.map((element) => element.className)).toEqual(['a', 'b']);
    expect(wrappers[0]!.title).toBe("2 nested wrappers aren't needed");
  });

  it('counts the DOM now and without what can go', async () => {
    mount('<section><div class="a"><div class="b"><p>x</p></div></div><div class="empty"></div></section>');
    const report = await audit();

    expect(report.stats).toEqual({ elements: 5, depth: 4, children: 2 });
    expect(report.cleaned).toEqual({ elements: 2, depth: 2, children: 1 });
    expect(report.removable).toBe(3);
    expect(report.summary()).toBe('3 of 5 elements could go (60.0%).');
  });

  it('reports DOM size, depth and wide parents against the limits', async () => {
    mount(`<ul>${'<li>x</li>'.repeat(8)}</ul>`);
    const report = await audit({ limits: { elements: 5, depth: 1, children: 6 } });

    expect(report.findings.map((finding) => finding.kind)).toEqual(['dom-size', 'deep-nesting', 'wide-parent']);
    expect(report.findings[0]!.title).toBe('9 elements, above the limit of 5');
  });

  it('leaves out ignored elements and everything inside them', async () => {
    mount('<div class="widget"><div class="inner"><p>x</p></div></div><div class="mine"><p>y</p></div>');
    const report = await audit({ ignore: '.widget' });

    expect(report.findings.flatMap((finding) => finding.elements).map((element) => element.className)).toEqual(['mine']);
    expect(report.stats.elements).toBe(2);
  });

  it('does not test elements that are not rendered', async () => {
    mount('<div style="display: none"><div class="inside"><p>x</p></div></div>');
    const report = await audit();
    expect(report.removable).toBe(0);
  });

  it('turns into plain data with selectors', async () => {
    mount('<section><div class="a"><p>x</p></div></section>');
    const json = JSON.parse(JSON.stringify(await audit()));

    expect(json.findings[0]).toMatchObject({ kind: 'redundant-wrappers', selector: 'div.a', selectors: ['div.a'] });
    expect(json.stats.elements).toBe(3);
  });

  it('stops when asked to', async () => {
    mount('<div><p>x</p></div>');
    const controller = new AbortController();
    controller.abort();
    await expect(audit({ signal: controller.signal })).rejects.toThrow();
  });

  it('leaves every style attribute as it was', async () => {
    mount('<section><div class="a" style="color: inherit"><p style="margin:0">x</p></div><span></span></section>');
    const before = document.body.innerHTML;
    await audit();
    expect(document.body.innerHTML).toBe(before);
  });
});

describe('pointing the audit', () => {
  it('takes a selector for the root', async () => {
    mount('<main id="app"><div class="a"><p>x</p></div></main><div class="outside"><p>y</p></div>');
    const report = await audit({ root: '#app' });
    expect(report.root.id).toBe('app');
    expect(report.findings.flatMap((finding) => finding.elements).map((element) => element.className)).toEqual(['a']);
  });

  it('says so when the selector finds nothing', async () => {
    mount('<p>x</p>');
    await expect(audit({ root: '#missing' })).rejects.toThrow('no element matches "#missing"');
  });

  it('leaves out data-layer-lens-audit="ignore" and never reports data-layer-lens-audit="keep"', async () => {
    mount(`
      <div class="widget" data-layer-lens-audit="ignore"><div class="inside"><p>x</p></div></div>
      <div class="intentional" data-layer-lens-audit="keep"><div class="inner"><p>y</p></div></div>`);
    const report = await audit();
    const flagged = report.findings.flatMap((finding) => finding.elements).map((element) => element.className);

    expect(flagged).toEqual(['inner']);
    expect(report.findings[0]!.notes).toEqual([]);
  });
});
