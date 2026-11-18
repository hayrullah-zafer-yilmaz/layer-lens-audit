import { inspect, installInspector, type Inspector } from 'layer-lens-audit';
import { applyLanguage, initialLanguage, PRODUCT_NAMES, setText, TEXT, type Lang } from './i18n';

const products = [
  { price: '$49', tone: 'linear-gradient(135deg, #dbeafe, #93c5fd)' },
  { price: '$129', tone: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)' },
  { price: '$349', tone: 'linear-gradient(135deg, #dbeafe, #60a5fa)' },
  { price: '$89', tone: 'linear-gradient(135deg, #e0f2fe, #7dd3fc)' },
  { price: '$199', tone: 'linear-gradient(135deg, #e0e7ff, #818cf8)' },
  { price: '$19', tone: 'linear-gradient(135deg, #dbeafe, #3b82f6)' }
];

const grid = document.querySelector<HTMLElement>('#product-grid')!;
const template = document.querySelector<HTMLTemplateElement>('#product')!;
for (const product of products) {
  const card = template.content.cloneNode(true) as DocumentFragment;
  card.querySelector<HTMLElement>('.price')!.textContent = product.price;
  card.querySelector<HTMLElement>('.product-image')!.style.backgroundImage = product.tone;
  grid.append(card);
}

const shop = document.querySelector<HTMLElement>('#shop')!;
const copyStatus = document.querySelector<HTMLElement>('#copy-status')!;
const copyTimers = new Map<HTMLButtonElement, number>();
let lang: Lang = initialLanguage();
let inspector: Inspector | null = null;
let uninstall: () => void = () => {};

function labelCopyButton(button: HTMLButtonElement, key: 'copy' | 'copied') {
  const label = TEXT[lang][key] ?? '';
  if (button.dataset.i18n) setText(button, label);
  if (button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
  if (button.hasAttribute('title')) button.title = label;
}

function resetCopyButtons() {
  for (const [button, timer] of copyTimers) {
    window.clearTimeout(timer);
    delete button.dataset.copied;
  }
  copyTimers.clear();
  copyStatus.textContent = '';
}

async function copy(button: HTMLButtonElement) {
  const source = document.querySelector<HTMLElement>(button.dataset.copy!);
  if (!source) return;
  try {
    await navigator.clipboard.writeText(source.textContent!.trim());
  } catch {
    getSelection()?.selectAllChildren(source);
    return;
  }
  window.clearTimeout(copyTimers.get(button));
  button.dataset.copied = '';
  labelCopyButton(button, 'copied');
  copyStatus.textContent = TEXT[lang].copied ?? '';
  copyTimers.set(
    button,
    window.setTimeout(() => {
      copyTimers.delete(button);
      delete button.dataset.copied;
      labelCopyButton(button, 'copy');
      copyStatus.textContent = '';
    }, 1600)
  );
}

function render() {
  resetCopyButtons();
  applyLanguage(lang);
  grid.querySelectorAll<HTMLElement>('.product-title').forEach((title, index) => {
    title.textContent = PRODUCT_NAMES[lang][index] ?? '';
  });
}

function audit() {
  document.querySelector('.stage')!.scrollIntoView({ block: 'start', behavior: 'smooth' });
  inspector = inspect({ root: shop, locale: lang });
}

function setLanguage(next: Lang) {
  if (next === lang) return;
  lang = next;
  render();
  uninstall();
  uninstall = installInspector({ root: shop, locale: lang });
  if (inspector?.isOpen) audit();
}

render();
uninstall = installInspector({ root: shop, locale: lang });

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-audit]')) {
  button.addEventListener('click', audit);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', () => copy(button));
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  button.addEventListener('click', () => setLanguage(button.dataset.lang as Lang));
}

if (location.hash === '#audit') audit();
