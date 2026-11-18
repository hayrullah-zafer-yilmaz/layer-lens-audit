import { audit, resolveRoot, type AuditOptions } from '../audit/audit';
import type { AuditReport, Finding } from '../audit/report';
import { describeSource } from '../audit/source';
import { messagesFor, type Messages } from '../i18n';
import { describeElement, flatteningReason, UI_ATTRIBUTE } from '../shared/dom';
import { createLayerLensAudit, ZOOM_STEP, type LayerLensAudit } from '../view/layerLensAudit';
import { createOverlay } from './overlay';
import { createPanel } from './panel';
import { INSPECTOR_CSS } from './styles';

export type InspectOptions = Omit<AuditOptions, 'signal' | 'onProgress'>;

export interface Inspector {
  readonly report: AuditReport | null;
  readonly ready: Promise<AuditReport>;
  readonly isOpen: boolean;
  rerun(): Promise<AuditReport>;
  close(): void;
}

let active: Inspector | null = null;

const MIN_VIEW_HEIGHT = 160;
const MAX_VIEW_ELEMENTS = 2000;

const isAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError';

function attachStyles(shadow: ShadowRoot, css: string) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = shadow.ownerDocument.createElement('style');
    style.textContent = css;
    shadow.append(style);
  }
}

function viewRootFor(finding: Finding, view: Window & typeof globalThis): HTMLElement {
  const first = finding.elements[0]!;
  let start: Element = first;
  if (finding.kind === 'deep-nesting') {
    for (let steps = 0; steps < 6 && start.parentElement; steps++) start = start.parentElement;
  } else if (finding.kind !== 'wide-parent' && first.parentElement) {
    start = first.parentElement;
  }

  const html = first.ownerDocument.documentElement;
  let fallback: HTMLElement | null = null;
  let node: Element | null = start;
  for (let steps = 0; node && node !== html && steps < 5; node = node.parentElement, steps++) {
    if (!(node instanceof view.HTMLElement)) continue;
    if (node !== first && node.getElementsByTagName('*').length > MAX_VIEW_ELEMENTS) break;
    const style = view.getComputedStyle(node);
    if (style.display === 'contents' || style.display === 'inline' || flatteningReason(style)) continue;
    fallback ??= node;
    if (node.offsetHeight >= MIN_VIEW_HEIGHT) return node;
  }
  return fallback ?? (first as HTMLElement);
}

function log(report: AuditReport, text: Messages) {
  const columns = text.consoleColumns;
  console.groupCollapsed(`layer-lens-audit: ${report.summary()}`);
  if (report.findings.length) {
    console.table(
      report.findings.map((finding) => ({
        [columns.finding]: finding.title,
        [columns.where]: describeSource(finding.source) ?? '',
        [columns.selector]: finding.selector,
        [columns.check]: finding.notes.join(' ')
      }))
    );
  }
  console.log(report);
  console.groupEnd();
}

export function inspect(options: InspectOptions = {}): Inspector {
  active?.close();

  const root = resolveRoot(options.root);
  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const text = messagesFor(options.locale);

  const host = doc.createElement('div');
  host.setAttribute(UI_ATTRIBUTE, '');
  const shadow = host.attachShadow({ mode: 'open' });
  attachStyles(shadow, INSPECTOR_CSS);
  const overlay = createOverlay(shadow);

  let report: AuditReport | null = null;
  let controller: AbortController | null = null;
  let lens: LayerLensAudit | null = null;
  let viewing: Finding | null = null;
  let isOpen = true;

  const removable = () =>
    report?.findings
      .filter((finding) => finding.kind === 'redundant-wrappers' || finding.kind === 'empty-element')
      .flatMap((finding) => finding.elements) ?? [];

  function closeView() {
    lens?.destroy();
    lens = null;
    viewing = null;
    panel.viewing(null);
  }

  const panel = createPanel(doc, describeElement(root), {
    rerun: () => void run(),
    close,
    copy(format) {
      if (!report) return;
      const content = format === 'json' ? JSON.stringify(report.toJSON(), null, 2) : report.toMarkdown();
      const fallback = () => {
        console.log(content);
        panel.flash(text.inConsole);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(content)
          .then(() => panel.flash(format === 'json' ? text.copiedJson : text.copiedMarkdown), fallback);
      } else {
        fallback();
      }
    },
    hover(finding) {
      if (finding) overlay.focus(finding.elements);
      else overlay.clear();
    },
    select(finding) {
      finding.elements[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      overlay.focus(finding.elements);
    },
    toggleView(finding) {
      if (viewing === finding) return closeView();
      closeView();
      overlay.clear();

      const viewRoot = viewRootFor(finding, view);
      viewRoot.scrollIntoView({ block: 'center' });
      lens = createLayerLensAudit(viewRoot, {
        depth: 'dom',
        spacing: 26,
        marks: removable().filter((element) => viewRoot.contains(element)),
        markLabel: text.flagged,
        onZoomChange: (zoom) => panel.zoomed(zoom),
        onOpenChange(open) {
          if (open) return;
          viewing = null;
          panel.viewing(null);
        }
      });
      viewing = finding;
      panel.viewing(finding);
      void lens.open();
    },
    outline(on) {
      overlay.outline(on ? removable() : []);
    },
    zoomIn() {
      lens?.setZoom(lens.zoom * ZOOM_STEP);
    },
    zoomOut() {
      lens?.setZoom(lens.zoom / ZOOM_STEP);
    },
    resetView() {
      lens?.resetView();
    }
  }, text);

  shadow.append(panel.element);
  doc.documentElement.append(host);

  function run(): Promise<AuditReport> {
    controller?.abort();
    closeView();
    overlay.clear();
    overlay.outline([]);

    const current = new AbortController();
    controller = current;
    panel.running(0, 0);

    const result = audit({
      ...options,
      root,
      locale: text.locale,
      signal: current.signal,
      onProgress: (done, total) => panel.running(done, total)
    }).then(
      (next) => {
        if (current.signal.aborted) throw new DOMException('The audit was stopped.', 'AbortError');
        report = next;
        panel.show(next);
        log(next, text);
        return next;
      }
    );
    result.catch((error: unknown) => {
      if (isAbort(error)) return;
      panel.failed(error instanceof Error ? error.message : String(error));
      console.error('layer-lens-audit:', error);
    });
    return result;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    controller?.abort();
    closeView();
    overlay.destroy();
    host.remove();
    if (active === inspector) active = null;
  }

  const ready = run();
  const inspector: Inspector = {
    get report() {
      return report;
    },
    get isOpen() {
      return isOpen;
    },
    ready,
    rerun: run,
    close
  };
  active = inspector;
  return inspector;
}
