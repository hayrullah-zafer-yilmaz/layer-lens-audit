import type { FindingKind } from './audit/report';
import type { SourceHint } from './audit/source';

export type Locale = 'en' | 'tr';

export const LOCALES: readonly Locale[] = ['en', 'tr'];

export interface Messages {
  readonly locale: Locale;
  number(value: number): string;
  percent(share: number): string;
  duration(ms: number): string;

  wrapper(tag: string): string;
  wrappers(count: number): string;
  wrapperDetail: string;
  wrappersDetail: string;
  wrapperFix: string;
  empty(tag: string): string;
  emptyDetail: string;
  emptyFix: string;
  domSize(total: string, limit: string): string;
  domSizeCleaned(removable: string, cleaned: string): string;
  domSizeDetail: string;
  domSizeFix: string;
  deep(depth: string, limit: string): string;
  deepCleaned(depth: string): string;
  deepDetail: string;
  deepFix: string;
  wide(children: string, limit: string): string;
  wideDetail: string;
  wideFix: string;
  frameworkFix: Record<SourceHint['framework'], string>;
  kinds: Record<FindingKind, string>;

  noteEmpty: string;
  noteId(id: string): string;
  noteTest(name: string, value: string): string;
  noteData(name: string): string;

  summaryNone(total: string): string;
  summarySome(removable: string, total: string, share: string): string;

  panelLabel: string;
  rerun: string;
  collapse: string;
  expand: string;
  close: string;
  closeLabel: string;
  reading: string;
  checking(done: string, total: string): string;
  runningNote: string;
  couldGo(count: number): string;
  nothingToRemove: string;
  ofTotal(total: string): string;
  depthChange(from: number, to: number): string;
  outline: string;
  check: string;
  show3d: string;
  show3dLabel(title: string): string;
  allNeeded: string;
  measured(width: number, height: number, took: string): string;
  unreadable(count: number): string;
  checkBeforeDeleting: string;
  copyMarkdown: string;
  copyJson: string;
  copiedMarkdown: string;
  copiedJson: string;
  inConsole: string;
  failed(message: string): string;
  shortcutHint(keys: string): string;
  flagged: string;
  consoleColumns: { finding: string; where: string; selector: string; check: string };

  measuredAt(sizes: string[]): string;
  depthSentence(from: number, to: number): string;
  newSinceBaseline(count: number): string;
  noneNewSinceBaseline: string;
  fresh: string;
  overLimit(count: string, max: string, fresh: boolean): string;
  baselineSaved(count: string, file: string): string;

  zoomIn: string;
  zoomOut: string;
  resetView: string;
  zoomLevel(zoom: number): string;
  zoomHint: string;

  why: string;
  whatToDo: string;
  now: string;
  after: string;
  detailsHint: string;
  howToFix: string;
}

function formats(tag: string) {
  const whole = new Intl.NumberFormat(tag);
  const share = new Intl.NumberFormat(tag, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const seconds = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const list = new Intl.ListFormat(tag, { type: 'conjunction' });
  const zoom = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 });
  return { whole, share, seconds, list, zoom };
}

const en = formats('en-US');
const tr = formats('tr-TR');

const ENGLISH: Messages = {
  locale: 'en',
  number: (value) => en.whole.format(value),
  percent: (share) => en.share.format(share),
  duration: (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${en.seconds.format(ms / 1000)} s`),

  wrapper: (tag) => `This ${tag} isn't needed`,
  wrappers: (count) => `${count} nested wrappers aren't needed`,
  wrapperDetail:
    'It draws nothing and sets no style for what is inside it. With its box taken away, nothing on the page moved: its parent, its siblings and its content were each measured.',
  wrappersDetail:
    'None of them draws anything or sets a style for what is inside it. With their boxes taken away, nothing on the page moved: their parents, their siblings and their content were each measured.',
  wrapperFix: 'Delete the wrapper tags and keep what is inside them where it is.',
  empty: (tag) => `This empty ${tag} isn't needed`,
  emptyDetail: 'It holds nothing and draws nothing. With it taken away, nothing on the page moved.',
  emptyFix: 'Delete the element.',
  domSize: (total, limit) => `${total} elements, above the limit of ${limit}`,
  domSizeCleaned: (removable, cleaned) => `Removing the ${removable} elements below would bring it to ${cleaned}.`,
  domSizeDetail: 'A large DOM takes longer to style, lay out and update, and it uses more memory.',
  domSizeFix: 'Delete what can go, and render long lists a page at a time or virtualize them.',
  deep: (depth, limit) => `Nested ${depth} levels deep, above the limit of ${limit}`,
  deepCleaned: (depth) => `This is the deepest element. Without the wrappers below it would be ${depth} levels.`,
  deepDetail: 'This is the deepest element. Deep nesting makes styles and layout slower to work out.',
  deepFix:
    'Flatten the structure: take out wrappers on the way down to this element, and let CSS grid or flexbox do the layout they did.',
  wide: (children, limit) => `${children} children in one element, above the limit of ${limit}`,
  wideDetail:
    'Each child is styled and laid out even when it is off screen, and a change to one can make the browser lay them all out again.',
  wideFix: 'Render part of the list at a time: paginate it, virtualize it or load more on demand.',
  frameworkFix: {
    react: 'In React, return a Fragment (<>…</>) when a component needs one parent only because JSX asks for it.',
    vue: 'In Vue a component can have several root elements, and <template> groups elements without adding one to the page.',
    svelte: 'A Svelte component can have several top-level elements without a wrapper.',
    angular: 'In Angular, <ng-container> groups elements without adding one to the page.'
  },
  kinds: {
    'redundant-wrappers': 'Wrappers',
    'empty-element': 'Empty elements',
    'dom-size': 'DOM size',
    'deep-nesting': 'Deep nesting',
    'wide-parent': 'Long lists'
  },

  noteEmpty: 'Scripts sometimes fill an empty element later: check that none does.',
  noteId: (id) => `Has id="${id}": check that no CSS, link or script uses it.`,
  noteTest: (name, value) => `Has ${name}="${value}": tests may select it.`,
  noteData: (name) => `Has ${name}: scripts may read it.`,

  summaryNone: (total) => `Nothing to remove among ${total} elements.`,
  summarySome: (removable, total, share) => `${removable} of ${total} elements could go (${share}).`,

  panelLabel: 'layer-lens-audit',
  rerun: 'Run again',
  collapse: 'Collapse',
  expand: 'Expand',
  close: 'Close',
  closeLabel: 'Close layer-lens-audit',
  reading: 'Reading the page…',
  checking: (done, total) => `Checking ${done} of ${total} elements…`,
  runningNote: 'Each wrapper is measured with and without its box. The page is put back as it was.',
  couldGo: (count) => (count === 1 ? 'element could go' : 'elements could go'),
  nothingToRemove: 'elements to remove',
  ofTotal: (total) => `out of ${total} elements`,
  depthChange: (from, to) => `. Without them the deepest nesting drops from ${from} to ${to} levels.`,
  outline: 'Outline them on the page',
  check: 'check',
  show3d: 'Show it in 3D',
  show3dLabel: (title) => `Show "${title}" in 3D`,
  allNeeded: 'Every element here draws something, holds the layout together or has a job. Nothing to remove.',
  measured: (width, height, took) => `Measured at ${width} × ${height} in ${took}.`,
  unreadable: (count) => ` ${count} style sheet${count === 1 ? '' : 's'} from other sites couldn't be read.`,
  checkBeforeDeleting: 'Check an element before you delete it: code can still select it.',
  copyMarkdown: 'Copy as Markdown',
  copyJson: 'Copy as JSON',
  copiedMarkdown: 'Copied the report as Markdown.',
  copiedJson: 'Copied the report as JSON.',
  inConsole: 'The report is in the console.',
  failed: (message) => `The audit stopped: ${message}`,
  shortcutHint: (keys) => `layer-lens-audit: press ${keys} to audit this page.`,
  flagged: 'flagged',
  consoleColumns: { finding: 'finding', where: 'where', selector: 'selector', check: 'check' },

  measuredAt: (sizes) => `Measured at ${en.list.format(sizes)}.`,
  depthSentence: (from, to) => `Without them the DOM would be ${to} levels deep instead of ${from}.`,
  newSinceBaseline: (count) => `${count} of them ${count === 1 ? 'is' : 'are'} new since the baseline.`,
  noneNewSinceBaseline: 'None of them is new since the baseline.',
  fresh: 'new',
  overLimit: (count, max, fresh) => `${count} ${fresh ? 'new ' : ''}elements could go, more than the ${max} allowed.`,
  baselineSaved: (count, file) => `Saved ${count} elements as the baseline in ${file}.`,

  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetView: 'Reset the view',
  zoomLevel: (zoom) => en.zoom.format(zoom),
  zoomHint: 'Drag to turn, Shift + drag to move, Ctrl + scroll or pinch to zoom. The + and − keys work too.',

  why: 'Why',
  whatToDo: 'What to do',
  now: 'Now',
  after: 'After',
  detailsHint: 'Click a finding to see why, and what to do about it.',
  howToFix: 'How to fix'
};

const TURKISH: Messages = {
  locale: 'tr',
  number: (value) => tr.whole.format(value),
  percent: (share) => tr.share.format(share),
  duration: (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${tr.seconds.format(ms / 1000)} sn`),

  wrapper: (tag) => `Bu ${tag} gereksiz`,
  wrappers: (count) => `İç içe ${count} sarmalayıcı gereksiz`,
  wrapperDetail:
    'Hiçbir şey çizmiyor ve içindekilere stil vermiyor. Kutusu kaldırılınca sayfada hiçbir şey yerinden oynamadı: üst elemanı, kardeşleri ve içindekiler tek tek ölçüldü.',
  wrappersDetail:
    'Hiçbiri bir şey çizmiyor ya da içindekilere stil vermiyor. Kutuları kaldırılınca sayfada hiçbir şey yerinden oynamadı: üst elemanları, kardeşleri ve içindekiler tek tek ölçüldü.',
  wrapperFix: 'Sarmalayıcı etiketlerini silin, içindekileri olduğu yerde bırakın.',
  empty: (tag) => `Bu boş ${tag} gereksiz`,
  emptyDetail: 'İçi boş ve hiçbir şey çizmiyor. Kaldırılınca sayfada hiçbir şey yerinden oynamadı.',
  emptyFix: 'Elemanı silin.',
  domSize: (total, limit) => `${total} eleman, ${limit} sınırının üstünde`,
  domSizeCleaned: (removable, cleaned) => `Aşağıdaki ${removable} eleman kaldırılırsa sayı ${cleaned} olur.`,
  domSizeDetail: "Büyük bir DOM'un stillenmesi, yerleşimi ve güncellenmesi daha uzun sürer, daha çok bellek de kullanır.",
  domSizeFix: 'Kaldırılabilecek elemanları silin; uzun listeleri sayfalara bölün ya da sanallaştırın.',
  deep: (depth, limit) => `${depth} seviye iç içe, ${limit} sınırının üstünde`,
  deepCleaned: (depth) => `En derindeki eleman bu. Aşağıdaki sarmalayıcılar olmadan derinlik ${depth} seviye olur.`,
  deepDetail: 'En derindeki eleman bu. Derin iç içelik, stil ve yerleşim hesabını yavaşlatır.',
  deepFix:
    'Yapıyı düzleştirin: bu elemana giden yoldaki sarmalayıcıları kaldırın, yaptıkları yerleşimi CSS grid ya da flexbox ile kurun.',
  wide: (children, limit) => `Tek elemanda ${children} çocuk, ${limit} sınırının üstünde`,
  wideDetail:
    'Ekranda görünmeyenler de dahil her çocuk stillenir ve yerleştirilir; birindeki bir değişiklik hepsinin yeniden yerleştirilmesine yol açabilir.',
  wideFix: 'Listenin bir kısmını gösterin: sayfalara bölün, sanallaştırın ya da istendikçe yükleyin.',
  frameworkFix: {
    react: "React'te bir bileşen yalnızca JSX tek bir üst eleman istediği için sarmalıyorsa yerine Fragment (<>…</>) döndürün.",
    vue: "Vue'da bir bileşenin birden fazla kök elemanı olabilir; <template> da sayfaya eleman eklemeden gruplar.",
    svelte: 'Svelte bileşeninin sarmalayıcı olmadan birden fazla üst düzey elemanı olabilir.',
    angular: "Angular'da <ng-container> sayfaya eleman eklemeden gruplar."
  },
  kinds: {
    'redundant-wrappers': 'Sarmalayıcılar',
    'empty-element': 'Boş elemanlar',
    'dom-size': 'DOM boyutu',
    'deep-nesting': 'Derin iç içelik',
    'wide-parent': 'Uzun listeler'
  },

  noteEmpty: "Script'ler boş bir elemanı bazen sonradan doldurur: doldurmadıklarından emin olun.",
  noteId: (id) => `id="${id}" taşıyor: hiçbir CSS, bağlantı ya da script'in onu kullanmadığından emin olun.`,
  noteTest: (name, value) => `${name}="${value}" taşıyor: testler onu seçiyor olabilir.`,
  noteData: (name) => `${name} taşıyor: script'ler onu okuyor olabilir.`,

  summaryNone: (total) => `${total} eleman arasında kaldırılacak bir şey yok.`,
  summarySome: (removable, total, share) => `${total} elemandan ${removable} tanesi kaldırılabilir (${share}).`,

  panelLabel: 'layer-lens-audit',
  rerun: 'Yeniden çalıştır',
  collapse: 'Daralt',
  expand: 'Genişlet',
  close: 'Kapat',
  closeLabel: "layer-lens-audit'i kapat",
  reading: 'Sayfa okunuyor…',
  checking: (done, total) => `${done} / ${total} eleman kontrol edildi…`,
  runningNote: 'Her sarmalayıcı kutusuyla ve kutusu olmadan ölçülür. Sayfa sonra eski haline getirilir.',
  couldGo: () => 'eleman kaldırılabilir',
  nothingToRemove: 'kaldırılacak eleman',
  ofTotal: (total) => `toplam ${total} eleman içinden`,
  depthChange: (from, to) => `. Onlar olmadan en derin iç içelik ${from} seviyeden ${to} seviyeye iner.`,
  outline: 'Hepsini sayfada işaretle',
  check: 'kontrol edin',
  show3d: "3D'de göster",
  show3dLabel: (title) => `"${title}" bulgusunu 3D'de göster`,
  allNeeded: 'Buradaki her eleman ya bir şey çiziyor, ya yerleşimi bir arada tutuyor ya da bir işe yarıyor. Kaldırılacak bir şey yok.',
  measured: (width, height, took) => `${width} × ${height} boyutunda, ${took} içinde ölçüldü.`,
  unreadable: (count) => ` Başka sitelerden gelen ${count} stil dosyası okunamadı.`,
  checkBeforeDeleting: 'Bir elemanı silmeden önce kontrol edin: kod onu hala seçiyor olabilir.',
  copyMarkdown: 'Markdown olarak kopyala',
  copyJson: 'JSON olarak kopyala',
  copiedMarkdown: 'Rapor Markdown olarak kopyalandı.',
  copiedJson: 'Rapor JSON olarak kopyalandı.',
  inConsole: 'Rapor konsola yazıldı.',
  failed: (message) => `Denetim durdu: ${message}`,
  shortcutHint: (keys) => `layer-lens-audit: bu sayfayı denetlemek için ${keys} tuşlarına basın.`,
  flagged: 'kaldırılabilir',
  consoleColumns: { finding: 'bulgu', where: 'nerede', selector: 'seçici', check: 'kontrol' },

  measuredAt: (sizes) => `${tr.list.format(sizes)} ${sizes.length === 1 ? 'boyutunda' : 'boyutlarında'} ölçüldü.`,
  depthSentence: (from, to) => `Onlar olmadan DOM derinliği ${from} yerine ${to} seviye olur.`,
  newSinceBaseline: (count) => `Bunlardan ${count} tanesi referans rapordan sonra çıktı.`,
  noneNewSinceBaseline: 'Referans rapordan sonra yeni bir bulgu çıkmadı.',
  fresh: 'yeni',
  overLimit: (count, max, fresh) => `Kaldırılabilecek ${count} ${fresh ? 'yeni ' : ''}eleman var; izin verilen sayı ${max}.`,
  baselineSaved: (count, file) => `${count} eleman referans rapor olarak ${file} dosyasına kaydedildi.`,

  zoomIn: 'Yakınlaştır',
  zoomOut: 'Uzaklaştır',
  resetView: 'Görünümü sıfırla',
  zoomLevel: (zoom) => tr.zoom.format(zoom),
  zoomHint:
    'Sürükleyerek döndürün, Shift ile sürükleyerek taşıyın, Ctrl ile kaydırarak ya da iki parmakla yakınlaştırın. + ve − tuşları da çalışır.',

  why: 'Neden',
  whatToDo: 'Ne yapmalı',
  now: 'Şimdi',
  after: 'Sonra',
  detailsHint: 'Nedenini ve ne yapmanız gerektiğini görmek için bir bulguya tıklayın.',
  howToFix: 'Nasıl düzeltilir'
};

export const MESSAGES: Readonly<Record<Locale, Messages>> = Object.freeze({ en: ENGLISH, tr: TURKISH });

export function resolveLocale(requested?: string | null): Locale {
  const fromBrowser = typeof navigator === 'undefined' ? undefined : (navigator.languages?.[0] ?? navigator.language);
  const tag = (requested || fromBrowser || 'en').toLowerCase().replace('_', '-');
  return tag === 'tr' || tag.startsWith('tr-') || tag.startsWith('tr.') ? 'tr' : 'en';
}

export const messagesFor = (requested?: string | null): Messages => MESSAGES[resolveLocale(requested)];
