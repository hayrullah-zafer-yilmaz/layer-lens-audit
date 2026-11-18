import { describe, expect, it } from 'vitest';
import { matchesShortcut, parseShortcut } from '../src/inspector/shortcut';

const press = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('shortcuts', () => {
  it('reads modifiers and a key', () => {
    expect(parseShortcut('Alt+Shift+L')).toEqual({ alt: true, ctrl: false, meta: false, shift: true, code: 'KeyL', key: 'L' });
    expect(parseShortcut('Ctrl + 1')).toMatchObject({ ctrl: true, code: 'Digit1' });
    expect(parseShortcut('Cmd+F2')).toMatchObject({ meta: true, code: null, key: 'F2' });
  });

  it('matches letters by physical key, so Alt on macOS still works', () => {
    const shortcut = parseShortcut('Alt+Shift+L');
    expect(matchesShortcut(press({ code: 'KeyL', key: '¬', altKey: true, shiftKey: true }), shortcut)).toBe(true);
    expect(matchesShortcut(press({ code: 'KeyL', key: 'L', shiftKey: true }), shortcut)).toBe(false);
    expect(matchesShortcut(press({ code: 'KeyK', key: 'K', altKey: true, shiftKey: true }), shortcut)).toBe(false);
  });

  it('matches other keys by name', () => {
    expect(matchesShortcut(press({ key: 'F2', code: 'F2', metaKey: true }), parseShortcut('Cmd+F2'))).toBe(true);
  });
});
