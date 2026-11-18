import { describe, expect, it } from 'vitest';
import { layerLensAudit } from '../src/vite';

describe('the Vite plugin', () => {
  it('only runs in the dev server, before Vite processes the page', () => {
    expect(layerLensAudit()).toMatchObject({ name: 'layer-lens-audit', apply: 'serve', transformIndexHtml: { order: 'pre' } });
  });

  it('adds a module script that installs the inspector with its options', () => {
    const [tag] = layerLensAudit({ root: '#app', locale: 'tr' }).transformIndexHtml.handler();
    expect(tag).toMatchObject({ tag: 'script', attrs: { type: 'module' }, injectTo: 'body' });
    expect(tag!.children).toBe(`import { installInspector } from 'layer-lens-audit';\ninstallInspector({"root":"#app","locale":"tr"});`);
  });

  it('cannot be made to close the script tag early', () => {
    const [tag] = layerLensAudit({ ignore: '</script><script>alert(1)</script>' }).transformIndexHtml.handler();
    expect(tag!.children).not.toContain('</script>');
  });
});
