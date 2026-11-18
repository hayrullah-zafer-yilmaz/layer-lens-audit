import { messagesFor } from '../i18n';
import { inspect, type Inspector, type InspectOptions } from './inspector';

export interface InstallOptions extends InspectOptions {
  shortcut?: string;
}

export interface Shortcut {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  code: string | null;
  key: string;
}

export const DEFAULT_SHORTCUT = 'Alt+Shift+L';

export function parseShortcut(text: string): Shortcut {
  const shortcut: Shortcut = { alt: false, ctrl: false, meta: false, shift: false, code: null, key: '' };
  for (const part of text.split('+').map((piece) => piece.trim()).filter(Boolean)) {
    const name = part.toLowerCase();
    if (name === 'alt' || name === 'option') shortcut.alt = true;
    else if (name === 'ctrl' || name === 'control') shortcut.ctrl = true;
    else if (name === 'meta' || name === 'cmd' || name === 'command') shortcut.meta = true;
    else if (name === 'shift') shortcut.shift = true;
    else shortcut.key = part;
  }
  if (/^[a-z]$/i.test(shortcut.key)) shortcut.code = `Key${shortcut.key.toUpperCase()}`;
  else if (/^\d$/.test(shortcut.key)) shortcut.code = `Digit${shortcut.key}`;
  return shortcut;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  if (event.altKey !== shortcut.alt || event.ctrlKey !== shortcut.ctrl) return false;
  if (event.metaKey !== shortcut.meta || event.shiftKey !== shortcut.shift) return false;
  return shortcut.code ? event.code === shortcut.code : event.key.toLowerCase() === shortcut.key.toLowerCase();
}

export function installInspector(options: InstallOptions = {}): () => void {
  const { shortcut: keys = DEFAULT_SHORTCUT, ...inspectOptions } = options;
  const shortcut = parseShortcut(keys);
  let current: Inspector | null = null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (!matchesShortcut(event, shortcut)) return;
    event.preventDefault();
    if (current?.isOpen) {
      current.close();
      current = null;
      return;
    }
    current = inspect(inspectOptions);
    current.ready.catch(() => {});
  };

  window.addEventListener('keydown', onKeyDown, true);
  console.info(messagesFor(inspectOptions.locale).shortcutHint(keys));

  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    current?.close();
    current = null;
  };
}
