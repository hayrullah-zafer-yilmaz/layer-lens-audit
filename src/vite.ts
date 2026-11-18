export interface LayerLensAuditPluginOptions {
  root?: string;
  ignore?: string;
  shortcut?: string;
  locale?: string;
  limits?: { elements?: number; depth?: number; children?: number };
}

interface HtmlTag {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
  injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend';
}

export interface LayerLensAuditPlugin {
  name: string;
  apply: 'serve';
  transformIndexHtml: { order: 'pre'; handler(): HtmlTag[] };
}

export function layerLensAudit(options: LayerLensAuditPluginOptions = {}): LayerLensAuditPlugin {
  const settings = JSON.stringify(options).replace(/</g, '\\u003c');
  return {
    name: 'layer-lens-audit',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import { installInspector } from 'layer-lens-audit';\ninstallInspector(${settings});`,
            injectTo: 'body'
          }
        ];
      }
    }
  };
}

