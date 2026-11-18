import type { AuditJson, FindingJson, FindingKind } from './audit/report';
import { describeSource } from './audit/source';
import type { Messages } from './i18n';

export interface Viewport {
  width: number;
  height: number;
}

export interface ReportData extends Omit<AuditJson, 'findings'> {
  findings: (FindingJson & { fresh?: boolean })[];
  viewports?: Viewport[];
  baseline?: { known: number; fresh: number };
}

export const size = ({ width, height }: Viewport) => `${width} × ${height}`;

export function summaryOf(report: ReportData, text: Messages): string {
  const total = text.number(report.stats.elements);
  if (!report.removable) return text.summaryNone(total);
  return text.summarySome(text.number(report.removable), total, text.percent(report.removable / Math.max(report.stats.elements, 1)));
}

function context(report: ReportData, text: Messages): string[] {
  const lines = [text.measuredAt((report.viewports ?? [report.viewport]).map(size))];
  if (report.cleaned.depth < report.stats.depth) lines.push(text.depthSentence(report.stats.depth, report.cleaned.depth));
  if (report.baseline) {
    lines.push(report.baseline.fresh ? text.newSinceBaseline(report.baseline.fresh) : text.noneNewSinceBaseline);
  }
  return lines;
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function advice(report: ReportData, text: Messages): [kind: string, fix: string][] {
  const seen = new Set<string>();
  const lines: [string, string][] = [];
  for (const finding of report.findings) {
    if (!finding.fix) continue;
    const key = `${finding.kind} ${finding.fix}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push([text.kinds[finding.kind], finding.fix]);
  }
  return lines;
}

const codeTags = (value: string) => value.replace(/<[^\s<>]*>(?:…<\/[^\s<>]*>)?/g, (tag) => `\`${tag}\``);
const capitalize = (value: string, locale: string) => value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);

export function formatMarkdown(report: ReportData, text: Messages): string {
  const lines = [`### layer-lens-audit: ${summaryOf(report, text)}`, '', context(report, text).join(' '), ''];

  if (!report.findings.length) {
    lines.push(text.allNeeded);
    return `${lines.join('\n')}\n`;
  }

  const columns = text.consoleColumns;
  const heading = [columns.finding, columns.where, columns.selector, columns.check].map((name) => capitalize(name, text.locale));
  lines.push(`| ${heading.join(' | ')} |`, '| --- | --- | --- | --- |');
  for (const finding of report.findings) {
    const title = finding.fresh ? `${finding.title} (${text.fresh})` : finding.title;
    const selector = `\`${finding.selector.replace(/`/g, '')}\``;
    lines.push(`| ${cell(title)} | ${cell(describeSource(finding.source) ?? '')} | ${selector} | ${cell(finding.notes.join(' '))} |`);
  }

  const fixes = advice(report, text);
  if (fixes.length) {
    lines.push('', `**${text.howToFix}**`, '');
    for (const [kind, fix] of fixes) lines.push(`- **${kind}:** ${codeTags(fix)}`);
  }
  return `${lines.join('\n')}\n`;
}

const ANSI = { bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m', green: '\x1b[32m', reset: '\x1b[0m' };

const DOT_COLOR: Record<FindingKind, string> = {
  'redundant-wrappers': ANSI.red,
  'empty-element': ANSI.yellow,
  'dom-size': ANSI.blue,
  'deep-nesting': ANSI.blue,
  'wide-parent': ANSI.blue
};

export function formatText(report: ReportData, text: Messages, color = false): string {
  const paint = (code: string, value: string) => (color ? `${code}${value}${ANSI.reset}` : value);
  const lines = [
    `${paint(ANSI.bold, 'layer-lens-audit')}  ${report.url}`,
    ...context(report, text).map((line) => paint(ANSI.dim, line)),
    '',
    paint(ANSI.bold, summaryOf(report, text)),
    ''
  ];

  if (!report.findings.length) lines.push(paint(ANSI.green, text.allNeeded));

  for (const finding of report.findings) {
    const where = describeSource(finding.source);
    const tags = [
      finding.fresh ? paint(ANSI.bold, text.fresh) : '',
      finding.confidence === 'medium' ? paint(ANSI.yellow, text.check) : ''
    ].filter(Boolean);
    lines.push(
      `${paint(DOT_COLOR[finding.kind], '●')} ${finding.title}${where ? `  ${paint(ANSI.blue, where)}` : ''}${tags.length ? `  ${tags.join(' ')}` : ''}`
    );
    lines.push(`  ${paint(ANSI.dim, finding.selector)}`);
    for (const note of finding.notes) lines.push(`  ${paint(ANSI.yellow, note)}`);
  }

  const fixes = advice(report, text);
  if (fixes.length) {
    lines.push('', paint(ANSI.bold, text.howToFix));
    for (const [kind, fix] of fixes) lines.push(`  ${kind}: ${fix}`);
  }

  return `${lines.join('\n')}\n`;
}
