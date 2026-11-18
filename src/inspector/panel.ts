import type { AuditReport, Finding } from '../audit/report';
import { describeSource } from '../audit/source';
import type { Messages } from '../i18n';

export interface PanelHandlers {
  rerun(): void;
  close(): void;
  copy(format: 'markdown' | 'json'): void;
  hover(finding: Finding | null): void;
  select(finding: Finding): void;
  toggleView(finding: Finding): void;
  outline(on: boolean): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
}

export interface Panel {
  readonly element: HTMLElement;
  running(done: number, total: number): void;
  show(report: AuditReport): void;
  failed(message: string): void;
  viewing(finding: Finding | null): void;
  zoomed(zoom: number): void;
  flash(message: string): void;
}

type Child = Node | string | null | undefined | false;
type Attributes = Record<string, string | boolean | undefined>;

const VIEWABLE = new Set(['redundant-wrappers', 'empty-element', 'deep-nesting', 'wide-parent']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKETCH_LINES = 3;
const SKETCH_CLASSES = 34;
const SKETCH_TEXT = 40;

const shorten = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value);

function openTag(element: Element): string {
  const id = element.id ? ` id="${element.id}"` : '';
  const classes = shorten((element.getAttribute('class') ?? '').trim().replace(/\s+/g, ' '), SKETCH_CLASSES);
  return `<${element.localName}${id}${classes ? ` class="${classes}"` : ''}>`;
}

function contentOf(element: Element): string[] {
  const lines: string[] = [];
  for (const node of element.childNodes) {
    let line = '';
    if (node.nodeType === 1) {
      const child = node as Element;
      line = VOID.has(child.localName) ? openTag(child) : `${openTag(child)}…</${child.localName}>`;
    } else if (node.nodeType === 3) {
      line = shorten((node.nodeValue ?? '').trim().replace(/\s+/g, ' '), SKETCH_TEXT);
    }
    if (!line) continue;
    if (lines.length === SKETCH_LINES) {
      lines.push('…');
      break;
    }
    lines.push(line);
  }
  return lines;
}

export function sketchWrappers(chain: readonly Element[]): { now: string; after: string } {
  const content = contentOf(chain[chain.length - 1]!);
  const indent = (depth: number) => '  '.repeat(depth);
  const now = [
    ...chain.map((element, depth) => `${indent(depth)}${openTag(element)}`),
    ...content.map((line) => `${indent(chain.length)}${line}`),
    ...chain.map((element, depth) => `${indent(depth)}</${element.localName}>`).reverse()
  ];
  return { now: now.join('\n'), after: content.join('\n') };
}

export function createPanel(doc: Document, scope: string, handlers: PanelHandlers, text: Messages): Panel {
  function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Attributes = {},
    ...children: Child[]
  ): HTMLElementTagNameMap[K] {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined || value === false) continue;
      element.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children) if (child) element.append(child);
    return element;
  }

  const rerun = h('button', { class: 'icon', type: 'button', title: text.rerun, 'aria-label': text.rerun }, '↻');
  const collapse = h(
    'button',
    { class: 'icon', type: 'button', title: text.collapse, 'aria-label': text.collapse, 'aria-expanded': 'true' },
    '–'
  );
  const close = h('button', { class: 'icon', type: 'button', title: text.close, 'aria-label': text.closeLabel }, '×');
  const body = h('div', { class: 'body' });
  const foot = h('p', { class: 'foot' });

  const zoomOut = h('button', { class: 'icon', type: 'button', title: text.zoomOut, 'aria-label': text.zoomOut }, '−');
  const zoomIn = h('button', { class: 'icon', type: 'button', title: text.zoomIn, 'aria-label': text.zoomIn }, '+');
  const zoomLevel = h('output', { class: 'zoom-level', 'aria-live': 'polite' }, text.zoomLevel(1));
  const resetView = h('button', { class: 'action', type: 'button' }, text.resetView);
  const zoomBar = h(
    'div',
    { class: 'zoom', hidden: true },
    h('div', { class: 'zoom-controls' }, zoomOut, zoomLevel, zoomIn, resetView),
    h('p', { class: 'zoom-hint' }, text.zoomHint)
  );
  zoomOut.addEventListener('click', () => handlers.zoomOut());
  zoomIn.addEventListener('click', () => handlers.zoomIn());
  resetView.addEventListener('click', () => handlers.resetView());
  const panel = h(
    'section',
    { class: 'panel', role: 'dialog', 'aria-label': text.panelLabel, lang: text.locale },
    h('header', { class: 'head' }, h('span', { class: 'brand' }, 'layer-lens-audit', h('span', { class: 'scope' }, scope)), rerun, collapse, close),
    body,
    zoomBar,
    foot
  );

  let footText = '';
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  const items = new Map<Finding, { item: HTMLLIElement; view: HTMLButtonElement | null }>();
  let selected: HTMLLIElement | null = null;
  let expanded: { item: HTMLLIElement; collapse(): void } | null = null;
  let detailCount = 0;

  rerun.addEventListener('click', () => handlers.rerun());
  close.addEventListener('click', () => handlers.close());
  collapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    const label = collapsed ? text.expand : text.collapse;
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.textContent = collapsed ? '+' : '–';
    collapse.title = label;
    collapse.setAttribute('aria-label', label);
  });

  function setFoot(message: string) {
    footText = message;
    foot.textContent = message;
  }

  function details(finding: Finding, id: string): HTMLElement {
    const sections: Child[] = [
      h('p', { class: 'label' }, text.why),
      h('p', { class: 'text' }, finding.detail),
      h('p', { class: 'label' }, text.whatToDo),
      h('p', { class: 'text' }, finding.fix)
    ];
    if (finding.kind === 'redundant-wrappers' && finding.elements.length) {
      const { now, after } = sketchWrappers(finding.elements);
      sections.push(h('p', { class: 'label' }, text.now), h('pre', {}, now), h('p', { class: 'label' }, text.after), h('pre', {}, after));
    }
    return h('div', { class: 'details', id }, ...sections);
  }

  function findingItem(finding: Finding): HTMLLIElement {
    const where = describeSource(finding.source);
    const detailId = `layer-lens-audit-details-${++detailCount}`;
    const main = h(
      'button',
      { class: 'main', type: 'button', 'aria-expanded': 'false', 'aria-controls': detailId },
      h(
        'span',
        { class: 'title' },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        finding.title,
        finding.confidence === 'medium' && h('span', { class: 'check' }, text.check)
      ),
      where && h('span', { class: 'where' }, where),
      h('code', { class: 'selector', title: finding.selector }, finding.selector),
      ...finding.notes.map((note) => h('span', { class: 'note' }, note))
    );
    const view = VIEWABLE.has(finding.kind)
      ? h(
          'button',
          { class: 'view', type: 'button', 'aria-pressed': 'false', title: text.show3d, 'aria-label': text.show3dLabel(finding.title) },
          '3D'
        )
      : null;
    const item = h('li', { class: 'finding', 'data-kind': finding.kind }, h('div', { class: 'row' }, main, view));
    let open: HTMLElement | null = null;
    const collapse = () => {
      open?.remove();
      open = null;
      main.setAttribute('aria-expanded', 'false');
      item.classList.remove('open');
      if (expanded?.item === item) expanded = null;
    };

    main.addEventListener('mouseenter', () => handlers.hover(finding));
    main.addEventListener('mouseleave', () => handlers.hover(null));
    main.addEventListener('focus', () => handlers.hover(finding));
    main.addEventListener('blur', () => handlers.hover(null));
    main.addEventListener('click', () => {
      if (open) return collapse();
      expanded?.collapse();
      open = details(finding, detailId);
      item.append(open);
      item.classList.add('open');
      main.setAttribute('aria-expanded', 'true');
      expanded = { item, collapse };

      selected?.classList.remove('selected');
      selected = item;
      item.classList.add('selected');
      handlers.select(finding);
    });
    view?.addEventListener('click', () => handlers.toggleView(finding));

    items.set(finding, { item, view });
    return item;
  }

  return {
    element: panel,

    running(done, total) {
      rerun.disabled = true;
      const share = total ? Math.round((done / total) * 100) : 0;
      const fill = h('span');
      fill.style.width = `${share}%`;
      body.replaceChildren(
        h(
          'div',
          { class: 'progress' },
          h(
            'div',
            { class: 'bar', role: 'progressbar', 'aria-label': text.reading, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(share) },
            fill
          ),
          h('p', {}, total ? text.checking(text.number(done), text.number(total)) : text.reading)
        )
      );
      setFoot(text.runningNote);
    },

    show(report) {
      rerun.disabled = false;
      items.clear();
      selected = null;
      expanded = null;

      const clean = report.removable === 0;
      const depth = report.cleaned.depth < report.stats.depth ? text.depthChange(report.stats.depth, report.cleaned.depth) : '';
      const headline = clean
        ? h('p', { class: 'headline clean' }, h('strong', {}, text.number(0)), text.nothingToRemove)
        : h('p', { class: 'headline' }, h('strong', {}, text.number(report.removable)), text.couldGo(report.removable));
      const outline = h('input', { type: 'checkbox' });
      outline.addEventListener('change', () => handlers.outline(outline.checked));
      const copyMarkdown = h('button', { class: 'action', type: 'button' }, text.copyMarkdown);
      const copyJson = h('button', { class: 'action', type: 'button' }, text.copyJson);
      copyMarkdown.addEventListener('click', () => handlers.copy('markdown'));
      copyJson.addEventListener('click', () => handlers.copy('json'));

      const summary = h(
        'div',
        { class: 'summary' },
        headline,
        h('p', { class: 'subline' }, `${text.ofTotal(text.number(report.stats.elements))}${depth}`),
        !clean && h('label', { class: 'switch' }, outline, text.outline),
        h('div', { class: 'actions' }, copyMarkdown, copyJson),
        report.findings.length > 0 && h('p', { class: 'hint' }, text.detailsHint)
      );

      const list = report.findings.length
        ? h('ol', { class: 'findings' }, ...report.findings.map(findingItem))
        : h('p', { class: 'message' }, text.allNeeded);

      body.replaceChildren(summary, list);

      const unreadable = report.unreadableStyleSheets ? text.unreadable(report.unreadableStyleSheets) : '';
      setFoot(
        `${text.measured(report.viewport.width, report.viewport.height, text.duration(report.durationMs))}${unreadable} ${text.checkBeforeDeleting}`
      );
    },

    failed(message) {
      rerun.disabled = false;
      body.replaceChildren(h('p', { class: 'message error' }, text.failed(message)));
    },

    viewing(finding) {
      for (const [entry, { view }] of items) view?.setAttribute('aria-pressed', String(entry === finding));
      zoomBar.hidden = !finding;
      if (finding) zoomLevel.textContent = text.zoomLevel(1);
    },

    zoomed(zoom) {
      zoomLevel.textContent = text.zoomLevel(zoom);
    },

    flash(message) {
      clearTimeout(flashTimer);
      foot.replaceChildren(h('span', { class: 'flash' }, message));
      flashTimer = setTimeout(() => (foot.textContent = footText), 2400);
    }
  };
}
