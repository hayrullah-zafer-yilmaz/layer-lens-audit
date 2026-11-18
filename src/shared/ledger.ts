import type { StyledElement } from './dom';

interface Saved {
  value: string;
  priority: string;
}

interface Entry {
  attribute: string | null;
  cssText: string;
  saved: Map<string, Saved>;
}

export class StyleLedger {
  readonly #entries = new Map<StyledElement, Entry>();

  set(element: StyledElement, property: string, value: string): void {
    let entry = this.#entries.get(element);
    if (!entry) {
      entry = { attribute: element.getAttribute('style'), cssText: element.style.cssText, saved: new Map() };
      this.#entries.set(element, entry);
    }
    if (!entry.saved.has(property)) {
      entry.saved.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
    }
    element.style.setProperty(property, value, 'important');
  }

  restore(element: StyledElement, properties?: readonly string[]): void {
    const entry = this.#entries.get(element);
    if (!entry) return;

    const changed = [...entry.saved.keys()].reverse();
    for (const property of properties ? changed.filter((name) => properties.includes(name)) : changed) {
      const saved = entry.saved.get(property);
      if (!saved) continue;
      if (saved.value) element.style.setProperty(property, saved.value, saved.priority);
      else element.style.removeProperty(property);
      entry.saved.delete(property);
    }

    if (entry.saved.size > 0) return;
    this.#entries.delete(element);

    if (element.style.cssText !== entry.cssText) return;

    const current = element.getAttribute('style');
    if (entry.attribute === null) {
      if (current !== null) element.removeAttribute('style');
    } else if (current !== entry.attribute) {
      element.setAttribute('style', entry.attribute);
    }
  }

  restoreAll(): void {
    for (const element of [...this.#entries.keys()]) this.restore(element);
  }

  elements(): StyledElement[] {
    return [...this.#entries.keys()];
  }
}
