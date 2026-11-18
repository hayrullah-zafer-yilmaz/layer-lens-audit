import { afterEach, describe, expect, it } from 'vitest';
import { audit } from '../src/audit/audit';
import { MESSAGES, resolveLocale } from '../src/i18n';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('resolveLocale', () => {
  it('reads any Turkish tag as Turkish', () => {
    expect(resolveLocale('tr')).toBe('tr');
    expect(resolveLocale('tr-TR')).toBe('tr');
    expect(resolveLocale('TR')).toBe('tr');
  });

  it('falls back to English for everything else', () => {
    expect(resolveLocale('en-GB')).toBe('en');
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale('trk')).toBe('en');
  });

  it("uses the browser's language when none is asked for", () => {
    expect(resolveLocale()).toBe(resolveLocale(navigator.language));
  });
});

describe('messages', () => {
  it('has every message in both languages', () => {
    expect(Object.keys(MESSAGES.tr).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });

  it('formats numbers the way each language writes them', () => {
    expect(MESSAGES.en.number(1240)).toBe('1,240');
    expect(MESSAGES.tr.number(1240)).toBe('1.240');
    expect(MESSAGES.en.percent(0.033)).toBe('3.3%');
    expect(MESSAGES.tr.percent(0.033)).toBe('%3,3');
    expect(MESSAGES.en.duration(1500)).toBe('1.5 s');
    expect(MESSAGES.tr.duration(1500)).toBe('1,5 sn');
    expect(MESSAGES.tr.duration(16)).toBe('16 ms');
  });
});

describe('a Turkish audit', () => {
  it('writes its findings, notes and summary in Turkish', async () => {
    document.body.innerHTML = '<section><div class="a"><div class="b"><p>x</p></div></div><div id="hero" class="c"><p>y</p></div><div></div></section>';
    const report = await audit({ locale: 'tr' });

    expect(report.locale).toBe('tr');
    expect(report.findings.map((finding) => finding.title)).toEqual([
      'İç içe 2 sarmalayıcı gereksiz',
      'Bu div gereksiz',
      'Bu boş div gereksiz'
    ]);
    expect(report.findings.map((finding) => finding.fix)).toEqual([
      'Sarmalayıcı etiketlerini silin, içindekileri olduğu yerde bırakın.',
      'Sarmalayıcı etiketlerini silin, içindekileri olduğu yerde bırakın.',
      'Elemanı silin.'
    ]);
    expect(report.findings[1]!.notes).toEqual([
      'id="hero" taşıyor: hiçbir CSS, bağlantı ya da script\'in onu kullanmadığından emin olun.'
    ]);
    expect(report.summary()).toBe('7 elemandan 4 tanesi kaldırılabilir (%57,1).');
    expect(report.toJSON()).toMatchObject({ locale: 'tr', findings: [{ kind: 'redundant-wrappers' }, {}, {}] });
  });

  it('writes the limits in Turkish too, with Turkish number formatting', async () => {
    document.body.innerHTML = `<ul>${'<li>x</li>'.repeat(1500)}</ul>`;
    const report = await audit({ locale: 'tr' });
    expect(report.findings[0]!.title).toBe('1.501 eleman, 1.400 sınırının üstünde');
  });
});
