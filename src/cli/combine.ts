import type { AuditJson, FindingJson, FindingKind } from '../audit/report';
import type { ReportData, Viewport } from '../format';
import type { Messages } from '../i18n';

export interface ViewportRun {
  viewport: Viewport;
  report: AuditJson;
}

export interface Baseline {
  version: 1;
  elements: string[];
}

const REMOVABLE = new Set<FindingKind>(['redundant-wrappers', 'empty-element']);
const ORDER: Record<FindingKind, number> = {
  'dom-size': 0,
  'deep-nesting': 1,
  'wide-parent': 2,
  'redundant-wrappers': 3,
  'empty-element': 4
};

const removableIn = (report: AuditJson) =>
  new Set(report.findings.filter((finding) => REMOVABLE.has(finding.kind)).flatMap((finding) => finding.selectors));

function partOfChain(finding: FindingJson, indices: number[], text: Messages): FindingJson {
  if (indices.length === finding.selectors.length) return finding;
  const selectors = indices.map((index) => finding.selectors[index]!);
  const tags = indices.map((index) => finding.tags[index] ?? 'div');
  const single = selectors.length === 1;
  return {
    ...finding,
    selector: selectors[0]!,
    selectors,
    tags,
    title: single ? text.wrapper(tags[0]!) : text.wrappers(selectors.length),
    detail: single ? text.wrapperDetail : text.wrappersDetail
  };
}

export function combine(runs: ViewportRun[], text: Messages): ReportData {
  const [first] = runs;
  if (!first) throw new Error('layer-lens-audit: nothing was measured.');

  const sets = runs.map((run) => removableIn(run.report));
  const everywhere = new Set([...sets[0]!].filter((selector) => sets.every((set) => set.has(selector))));
  const findings: FindingJson[] = [];

  const seen = new Set<string>();
  for (const { report } of runs) {
    for (const finding of report.findings) {
      const key = `${finding.kind} ${finding.selector}`;
      if (REMOVABLE.has(finding.kind) || seen.has(key)) continue;
      seen.add(key);
      findings.push(finding);
    }
  }

  for (const finding of first.report.findings) {
    if (!REMOVABLE.has(finding.kind)) continue;
    let indices: number[] = [];
    const flush = () => {
      if (indices.length) findings.push(partOfChain(finding, indices, text));
      indices = [];
    };
    finding.selectors.forEach((selector, index) => {
      if (everywhere.has(selector)) indices.push(index);
      else flush();
    });
    flush();
  }

  findings.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.selectors.length - a.selectors.length);

  const removable = everywhere.size;
  const stats = first.report.stats;
  const cleaned = {
    elements: stats.elements - removable,
    depth: Math.max(...runs.map((run) => run.report.cleaned.depth)),
    children: Math.max(...runs.map((run) => run.report.cleaned.children))
  };

  for (const [index, finding] of findings.entries()) {
    if (finding.kind !== 'dom-size') continue;
    findings[index] = {
      ...finding,
      detail: removable
        ? text.domSizeCleaned(text.number(removable), text.number(cleaned.elements))
        : text.domSizeDetail
    };
  }

  return {
    ...first.report,
    viewports: runs.map((run) => run.viewport),
    removable,
    cleaned,
    durationMs: runs.reduce((total, run) => total + run.report.durationMs, 0),
    findings
  };
}

const keysOf = (finding: FindingJson) => finding.selectors.map((selector) => `${finding.kind} ${selector}`);

export function baselineOf(report: ReportData): Baseline {
  const elements = report.findings.filter((finding) => REMOVABLE.has(finding.kind)).flatMap(keysOf);
  return { version: 1, elements: [...new Set(elements)].sort() };
}

export function compareWithBaseline(report: ReportData, baseline: Baseline): ReportData {
  const known = new Set(baseline.elements);
  let fresh = 0;
  let old = 0;
  const findings = report.findings.map((finding) => {
    if (!REMOVABLE.has(finding.kind)) return finding;
    const keys = keysOf(finding);
    const newOnes = keys.filter((key) => !known.has(key)).length;
    fresh += newOnes;
    old += keys.length - newOnes;
    return newOnes ? { ...finding, fresh: true } : finding;
  });
  return { ...report, findings, baseline: { known: old, fresh } };
}

export const countForLimit = (report: ReportData) => report.baseline?.fresh ?? report.removable;
