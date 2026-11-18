export type Lang = 'en' | 'tr';

const STORAGE_KEY = 'layer-lens-audit-demo-lang';

export const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    title: "layer-lens-audit: find the divs your interface doesn't need",
    description:
      'layer-lens-audit checks any web page for wrappers that draw nothing and change nothing, empty elements and DOM that is too deep or too big, then shows them on the page and in 3D.',
    language: 'Language',
    'links.label': 'Project links',
    copy: 'Copy',
    copied: 'Copied',
    'hero.eyebrow': 'Open source DOM audit',
    'hero.title': "Find the divs your interface doesn't need.",
    'hero.lede':
      'layer-lens-audit checks the page in your browser. It finds wrappers that draw nothing and change nothing, empty elements, and DOM that is too deep or too big, then shows them on the page and in 3D. React, Vue, Svelte, Angular or plain HTML: it reads what the browser rendered.',
    'hero.audit': 'Audit the sample page',
    'stage.audit': 'Run the audit',
    'stage.title': 'A shop, built the usual way',
    'stage.text':
      'Components wrap components, and every wrapper adds a div. Some of them hold the layout together; many do nothing at all. The panel lists the ones that do nothing. Hover one to see it on the page, click it to see why it can go and what to do, press <b>3D</b> to see the tower it builds.',
    'nav.label': 'Shop sections',
    'nav.new': 'New in',
    'nav.lighting': 'Lighting',
    'nav.furniture': 'Furniture',
    'nav.sale': 'Sale',
    'search.placeholder': 'Search',
    'search.label': 'Search the shop',
    cart: 'Cart · 2',
    'filters.label': 'Filters',
    'filter.category': 'Category',
    'filter.lamps': 'Lamps',
    'filter.chairs': 'Chairs',
    'filter.tables': 'Tables',
    'filter.price': 'Price',
    'filter.under': 'Under $50',
    'filter.between': '$50 to $150',
    'filter.note': 'Prices include VAT.',
    count: '6 products',
    'sort.label': 'Sort products',
    'sort.popular': 'Popular',
    'sort.newest': 'Newest',
    'product.add': 'Add to cart',
    'product.save': 'Save for later',
    'shop.footer': 'Free delivery on orders over $50.',
    'rules.title': 'How it decides',
    'rules.lede': 'An element is only reported when all of these hold. Anything in doubt stays.',
    'rule1.title': 'It draws nothing',
    'rule1.text':
      'No background, border, shadow, outline or <code>::before</code>, no effect such as clipping, positioning or a transform.',
    'rule2.title': 'It styles nothing inside it',
    'rule2.text':
      'No colour or font for its children, no custom properties, no <code>.card &gt; .title</code> rule that goes through it.',
    'rule3.title': 'Nothing moves without it',
    'rule3.text':
      'Its box is taken away for a moment and everything around it is measured again. Half a pixel of difference is enough to keep it.',
    'rule4.title': 'Nothing else needs it',
    'rule4.text':
      'No role, aria, handler or ref, no <code>:hover</code>, dark mode or <code>@media</code> styles. Ids and test ids are flagged to check.',
    'usage.title': 'Use it on any project',
    'usage.lede': 'Three ways to run it, with the same checks behind each.',
    'usage1.kicker': 'Vite plugin',
    'usage1.title': 'In your app, while you develop',
    'usage1.text':
      'One line in your Vite config, then press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> on any page.',
    'usage1.note': "Runs on the dev server only. Builds don't include it.",
    'usage2.kicker': 'Bookmarklet',
    'usage2.title': 'On any page, without installing',
    'usage2.text': 'Drag the button to your bookmarks bar, then click it on any page you want to audit.',
    'usage2.drag': 'Drag to your bookmarks bar',
    'usage2.note': 'Sites with a strict Content Security Policy block it.',
    'usage3.kicker': 'CLI',
    'usage3.title': 'On the command line and in CI',
    'usage3.text': 'Measures the page on a phone and a desktop, and fails the build when new wrappers pile up.',
    'usage3.note': 'Reports as text, Markdown or JSON.',
    'footer.license': 'MIT licensed',
    'footer.changelog': 'Changelog'
  },
  tr: {
    title: "layer-lens-audit: arayüzünüzün ihtiyaç duymadığı div'leri bulun",
    description:
      "layer-lens-audit herhangi bir web sayfasında hiçbir şey çizmeyen ve hiçbir şeyi değiştirmeyen sarmalayıcıları, boş elemanları ve fazla derin ya da büyük DOM'u bulur, sonra bunları sayfada ve 3D'de gösterir.",
    language: 'Dil',
    'links.label': 'Proje bağlantıları',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    'hero.eyebrow': 'Açık kaynak DOM denetimi',
    'hero.title': "Arayüzünüzün ihtiyaç duymadığı div'leri bulun.",
    'hero.lede':
      "layer-lens-audit sayfayı tarayıcınızda denetler. Hiçbir şey çizmeyen ve hiçbir şeyi değiştirmeyen sarmalayıcıları, boş elemanları ve fazla derin ya da fazla büyük DOM'u bulur, sonra bunları sayfada ve 3D'de gösterir. React, Vue, Svelte, Angular ya da düz HTML fark etmez: tarayıcının çizdiği sonuca bakar.",
    'hero.audit': 'Örnek sayfayı denetle',
    'stage.audit': 'Denetimi başlat',
    'stage.title': 'Alışıldık yoldan kurulmuş bir mağaza',
    'stage.text':
      "Component'ler component'leri sarar ve her sarmalayıcı bir div daha ekler. Bazıları yerleşimi bir arada tutar, çoğu hiçbir şey yapmaz. Panel hiçbir şey yapmayanları listeler. Birinin üzerine geldiğinizde onu sayfada görürsünüz, tıkladığınızda neden kaldırılabileceğini ve ne yapmanız gerektiğini okursunuz, <b>3D</b> butonuna bastığınızda kurduğu kuleyi izlersiniz.",
    'nav.label': 'Mağaza bölümleri',
    'nav.new': 'Yeni gelenler',
    'nav.lighting': 'Aydınlatma',
    'nav.furniture': 'Mobilya',
    'nav.sale': 'İndirim',
    'search.placeholder': 'Ara',
    'search.label': 'Mağazada ara',
    cart: 'Sepet · 2',
    'filters.label': 'Filtreler',
    'filter.category': 'Kategori',
    'filter.lamps': 'Lambalar',
    'filter.chairs': 'Sandalyeler',
    'filter.tables': 'Masalar',
    'filter.price': 'Fiyat',
    'filter.under': '50 $ altı',
    'filter.between': '50 $ ile 150 $ arası',
    'filter.note': 'Fiyatlara KDV dahildir.',
    count: '6 ürün',
    'sort.label': 'Ürünleri sırala',
    'sort.popular': 'Popüler',
    'sort.newest': 'En yeni',
    'product.add': 'Sepete ekle',
    'product.save': 'Sonra için kaydet',
    'shop.footer': '50 $ üzeri siparişlerde kargo ücretsiz.',
    'rules.title': 'Nasıl karar verir',
    'rules.lede': 'Bir eleman ancak bunların hepsi doğruysa raporlanır. Şüpheli olan her şey yerinde kalır.',
    'rule1.title': 'Hiçbir şey çizmiyor',
    'rule1.text':
      'Arka plan, kenarlık, gölge, outline ya da <code>::before</code> içeriği yok; kırpma, konumlandırma ya da transform gibi bir etkisi de yok.',
    'rule2.title': 'İçindekilere stil vermiyor',
    'rule2.text':
      'Çocuklarına renk ya da font vermiyor, custom property tanımlamıyor ve üzerinden geçen bir <code>.card &gt; .title</code> kuralı yok.',
    'rule3.title': 'Onsuz hiçbir şey kaymıyor',
    'rule3.text':
      'Kutusu bir anlığına kaldırılır ve çevresindeki her şey yeniden ölçülür. Yarım piksellik bir fark bile onu yerinde tutar.',
    'rule4.title': 'Başka hiçbir şey ona bağlı değil',
    'rule4.text':
      'Role, aria, handler ya da ref yok; <code>:hover</code>, dark mode ya da <code>@media</code> stili yok. Id ve test id taşıyanlar kontrol etmeniz için ayrıca işaretlenir.',
    'usage.title': 'Her projede kullanın',
    'usage.lede': 'Üç farklı yolla çalıştırın, üçünde de aynı denetim çalışır.',
    'usage1.kicker': 'Vite eklentisi',
    'usage1.title': 'Geliştirirken, kendi uygulamanızda',
    'usage1.text':
      'Vite yapılandırmanıza tek satır ekleyin, sonra herhangi bir sayfada <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> tuşlarına basın.',
    'usage1.note': "Yalnızca geliştirme sunucusunda çalışır, build'lere eklenmez.",
    'usage2.kicker': 'Bookmarklet',
    'usage2.title': 'Kurmadan, herhangi bir sayfada',
    'usage2.text': 'Butonu yer imleri çubuğunuza sürükleyin, sonra denetlemek istediğiniz herhangi bir sayfada tıklayın.',
    'usage2.drag': 'Yer imleri çubuğunuza sürükleyin',
    'usage2.note': 'Sıkı bir Content Security Policy kullanan siteler bunu engeller.',
    'usage3.kicker': 'CLI',
    'usage3.title': "Komut satırında ve CI'da",
    'usage3.text': "Sayfayı telefonda ve masaüstünde ölçer, yeni sarmalayıcılar birikirse build'i durdurur.",
    'usage3.note': 'Raporu metin, Markdown ya da JSON olarak verir.',
    'footer.license': 'MIT lisanslı',
    'footer.changelog': 'Sürüm notları'
  }
};

export const PRODUCT_NAMES: Record<Lang, string[]> = {
  en: ['Arc desk lamp', 'Oak side table', 'Linen armchair', 'Globe pendant', 'Wool floor rug', 'Brass wall hook'],
  tr: ['Kavisli masa lambası', 'Meşe sehpa', 'Keten berjer', 'Küre sarkıt lamba', 'Yün halı', 'Pirinç duvar askısı']
};

const isLang = (value: string | null | undefined): value is Lang => value === 'en' || value === 'tr';

export function initialLanguage(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
  }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function setText(element: Element, value: string) {
  if (!element.childElementCount) {
    element.textContent = value;
    return;
  }
  const node = [...element.childNodes].reverse().find((child) => child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim());
  if (node) node.nodeValue = ` ${value}`;
}

export function applyLanguage(lang: Lang) {
  const text = TEXT[lang];
  document.documentElement.lang = lang;
  document.title = text.title!;
  document.querySelector('meta[name="description"]')?.setAttribute('content', text.description!);

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const value = text[element.dataset.i18n!];
    if (value) setText(element, value);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    const value = text[element.dataset.i18nHtml!];
    if (value) element.innerHTML = value;
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of element.dataset.i18nAttr!.split(';')) {
      const [attribute, key] = pair.split(':');
      const value = key ? text[key] : undefined;
      if (attribute && value) element.setAttribute(attribute, value);
    }
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
  }
}
