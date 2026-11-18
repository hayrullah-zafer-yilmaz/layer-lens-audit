import { computedStyles, ELEMENT_NODE, type StyledElement, type StyleOf } from '../shared/dom';
import { StyleLedger } from '../shared/ledger';
import { clamp, liftedTranslate, MAX_TILT, viewTransform, type ViewAngles } from './geometry';
import { createHoverLabel, describeWithSize, type HoverLabel } from './label';
import { planAdded, planLayers, type Layer, type LayerLensAuditDepth } from './layers';
import { watchPointer } from './pointer';

export type LayerLensAuditPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface LayerLensAuditOptions {
  spacing?: number;
  tilt?: number;
  turn?: number;
  perspective?: number;
  duration?: number;
  depth?: LayerLensAuditDepth;
  interactive?: boolean;
  outlines?: boolean;
  color?: string;
  marks?: Iterable<Element>;
  markLabel?: string;
  onOpenChange?: (open: boolean) => void;
  onZoomChange?: (zoom: number) => void;
}

export interface LayerLensAudit {
  readonly phase: LayerLensAuditPhase;
  readonly isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  toggle(): Promise<void>;
  update(options: LayerLensAuditOptions): void;
  readonly zoom: number;
  setZoom(zoom: number): void;
  resetView(): void;
  destroy(): void;
}

type Settings = Required<Omit<LayerLensAuditOptions, 'onOpenChange' | 'onZoomChange' | 'marks' | 'markLabel'>>;

export const LAYER_LENS_AUDIT_DEFAULTS: Readonly<Settings> = Object.freeze<Settings>({
  spacing: 40,
  tilt: 55,
  turn: -35,
  perspective: 2000,
  duration: 700,
  depth: 'visual',
  interactive: true,
  outlines: true,
  color: '#2563eb'
});

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const STAGGER = 0.08;
const STAGGER_LEVELS = 8;
const SETTLE_MARGIN = 34;
const MARK_COLOR = '#dc2626';
const MARK_FILL = 'rgb(220 38 38 / 0.14)';
const OUTLINE = ['outline-style', 'outline-width', 'outline-color', 'outline-offset', 'background-color'];
const GRAB = ['cursor', 'user-select', '-webkit-user-select', 'touch-action'];
const DEGREES_PER_PIXEL = 0.3;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.25;
const WHEEL_SPEED = 0.01;
const WHEEL_CAP = 40;
const ZOOM_MS = 180;

function isTyping(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return !!element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function resolve(options: LayerLensAuditOptions): Settings {
  const defaults = LAYER_LENS_AUDIT_DEFAULTS;
  return {
    spacing: Math.max(0, finite(options.spacing, defaults.spacing)),
    tilt: clamp(finite(options.tilt, defaults.tilt), 0, MAX_TILT),
    turn: finite(options.turn, defaults.turn),
    perspective: Math.max(100, finite(options.perspective, defaults.perspective)),
    duration: Math.max(0, finite(options.duration, defaults.duration)),
    depth: options.depth === 'dom' ? 'dom' : 'visual',
    interactive: options.interactive ?? defaults.interactive,
    outlines: options.outlines ?? defaults.outlines,
    color: options.color || defaults.color
  };
}

const sameSettings = (a: Settings, b: Settings) =>
  (Object.keys(a) as (keyof Settings)[]).every((key) => a[key] === b[key]);

function prefersReducedMotion(view: Window): boolean {
  return typeof view.matchMedia === 'function' && view.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function createLayerLensAudit(root: HTMLElement, options: LayerLensAuditOptions = {}): LayerLensAudit {
  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const ledger = new StyleLedger();
  const layers = new Map<Element, Layer>();

  let current: LayerLensAuditOptions = { ...options };
  let settings = resolve(current);
  let marks = new Set<Element>(options.marks ?? []);
  let angles: ViewAngles = { tilt: settings.tilt, turn: settings.turn };
  let phase: LayerLensAuditPhase = 'closed';
  let plannedDepth: LayerLensAuditDepth = settings.depth;
  let baseTransform = 'none';
  let pending: Promise<void> | null = null;
  let settlePending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dragging = false;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let highlighted: StyledElement | null = null;
  let label: HoverLabel | null = null;
  let stopInteraction: (() => void) | null = null;
  let observers: { disconnect(): void }[] = [];
  let destroyed = false;
  let deepestLevel: number | null = null;
  let rootSize: { width: number; height: number } | null = null;
  let labelFor: Element | null = null;
  let labelText = '';

  const isShown = () => phase === 'opening' || phase === 'open';
  const duration = () => (prefersReducedMotion(view) ? 0 : settings.duration);
  const step = () => duration() * STAGGER;
  const deepest = () => {
    if (deepestLevel === null) {
      deepestLevel = 0;
      for (const layer of layers.values()) deepestLevel = Math.max(deepestLevel, layer.depth);
    }
    return deepestLevel;
  };
  const levels = () => Math.min(deepest(), STAGGER_LEVELS);
  const motionTime = () => duration() + step() * levels();
  const risenElements = () => [...layers.values()].filter((layer) => layer.rise).map((layer) => layer.element);

  function transition(element: StyledElement, property: string, ms: number, delay: number) {
    ledger.set(element, 'transition-property', property);
    ledger.set(element, 'transition-duration', `${Math.round(ms)}ms`);
    ledger.set(element, 'transition-timing-function', EASING);
    ledger.set(element, 'transition-delay', `${Math.round(delay)}ms`);
  }

  function tiltedTransform(): string {
    rootSize ??= { width: root.offsetWidth, height: root.offsetHeight };
    const tilted = viewTransform(angles, {
      width: rootSize.width,
      height: rootSize.height,
      rise: deepest() * settings.spacing,
      perspective: settings.perspective,
      zoom,
      pan
    });
    return baseTransform === 'none' ? tilted : `${tilted} ${baseTransform}`;
  }

  function outline(element: StyledElement, strong: boolean) {
    ledger.set(element, 'outline-style', element === root && !strong ? 'dashed' : 'solid');
    ledger.set(element, 'outline-width', strong ? '2px' : '1px');
    ledger.set(
      element,
      'outline-color',
      strong ? settings.color : `color-mix(in srgb, ${settings.color} 45%, transparent)`
    );
    ledger.set(element, 'outline-offset', '0px');
  }

  function mark(element: StyledElement) {
    ledger.set(element, 'outline-style', 'solid');
    ledger.set(element, 'outline-width', '2px');
    ledger.set(element, 'outline-color', MARK_COLOR);
    ledger.set(element, 'outline-offset', '0px');
    ledger.set(element, 'background-color', MARK_FILL);
  }

  function settleOutline(element: StyledElement) {
    if (marks.has(element) && layers.get(element)?.rise) return mark(element);
    ledger.restore(element, ['background-color']);
    const isLayer = element === root || !!layers.get(element)?.rise;
    if (settings.outlines && isLayer) outline(element, false);
    else ledger.restore(element, OUTLINE);
  }

  function paintOutlines() {
    for (const element of [root, ...risenElements()]) {
      if (element === highlighted) outline(element, true);
      else settleOutline(element);
    }
  }

  function raiseLayer(layer: Layer, ms: number, delay: number) {
    if (layer.opens) ledger.set(layer.element, 'transform-style', 'preserve-3d');
    if (!layer.rise) return;
    transition(layer.element, 'translate', ms, delay);
    ledger.set(layer.element, 'translate', liftedTranslate(layer.translate, layer.rise * settings.spacing));
  }

  function raise(staggered: boolean) {
    const ms = duration();
    const gap = staggered ? step() : 0;
    ledger.set(root, 'transform-style', 'preserve-3d');
    transition(root, 'transform', dragging ? 0 : ms, 0);
    ledger.set(root, 'transform', tiltedTransform());
    for (const layer of layers.values()) raiseLayer(layer, ms, gap * Math.min(layer.depth, STAGGER_LEVELS));
    paintOutlines();
  }

  function lower() {
    const ms = duration();
    const gap = step();
    const count = levels();
    transition(root, 'transform', ms, gap * count * 0.5);
    ledger.set(root, 'transform', baseTransform);
    for (const layer of layers.values()) {
      if (!layer.rise) continue;
      transition(layer.element, 'translate', ms, gap * (count - Math.min(layer.depth, count)));
      ledger.set(layer.element, 'translate', layer.translate);
    }
  }

  function settleAfter(next: 'open' | 'closed', ms: number): Promise<void> {
    clearTimeout(timer);
    settlePending?.();

    pending = new Promise<void>((resolveSettled) => {
      settlePending = resolveSettled;
      timer = setTimeout(
        () => {
          timer = undefined;
          settlePending = null;
          pending = null;
          if (next === 'open') phase = 'open';
          else teardown();
          resolveSettled();
        },
        ms > 0 ? ms + SETTLE_MARGIN : 0
      );
    });
    return pending;
  }

  function plan() {
    layers.clear();
    deepestLevel = null;
    rootSize = null;
    labelFor = null;
    plannedDepth = settings.depth;
    const result = planLayers(root, settings.depth, computedStyles(view), marks);
    for (const layer of result.layers) layers.set(layer.element, layer);
    return result;
  }

  function prepare() {
    baseTransform = view.getComputedStyle(root).transform || 'none';
    const result = plan();
    if (result.flat) {
      console.warn(
        `layer-lens-audit: the root has ${result.flat}, which keeps everything inside it flat. Point the view at an element inside it.`
      );
    }
    watchChanges();
  }

  function replan() {
    for (const layer of layers.values()) ledger.restore(layer.element);
    if (highlighted !== root) highlighted = null;
    plan();
  }

  function teardown() {
    for (const observer of observers) observer.disconnect();
    observers = [];
    endInteraction();
    ledger.restoreAll();
    layers.clear();
    deepestLevel = null;
    rootSize = null;
    labelFor = null;
    label?.remove();
    label = null;
    highlighted = null;
    zoom = 1;
    pan = { x: 0, y: 0 };
    angles = { tilt: settings.tilt, turn: settings.turn };
    phase = 'closed';
  }

  function open(): Promise<void> {
    if (destroyed || phase === 'open') return Promise.resolve();
    if (phase === 'opening') return pending ?? Promise.resolve();

    if (phase === 'closed') prepare();
    else if (plannedDepth !== settings.depth) replan();

    phase = 'opening';
    startInteraction();
    raise(true);
    const done = settleAfter('open', motionTime());
    current.onOpenChange?.(true);
    return done;
  }

  function close(): Promise<void> {
    if (destroyed || phase === 'closed') return Promise.resolve();
    if (phase === 'closing') return pending ?? Promise.resolve();

    phase = 'closing';
    endInteraction();
    lower();
    const done = settleAfter('closed', motionTime());
    current.onOpenChange?.(false);
    return done;
  }

  function update(next: LayerLensAuditOptions) {
    if (destroyed) return;
    const { marks: nextMarks, ...rest } = next;
    current = { ...current, ...rest };
    const previous = settings;
    settings = resolve(current);
    const marksChanged = nextMarks !== undefined;
    if (marksChanged) marks = new Set(nextMarks);
    if (sameSettings(previous, settings) && !marksChanged) return;

    if (settings.tilt !== previous.tilt || settings.turn !== previous.turn) {
      angles = { tilt: settings.tilt, turn: settings.turn };
    }
    if (settings.color !== previous.color) {
      label?.remove();
      label = null;
    }
    if (!isShown()) return;

    if (settings.depth !== previous.depth || marksChanged) replan();
    if (settings.interactive !== previous.interactive) {
      endInteraction();
      startInteraction();
    }
    raise(false);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(timer);
    timer = undefined;
    const settle = settlePending;
    settlePending = null;
    pending = null;
    teardown();
    settle?.();
  }

  function layerAt(target: Element): StyledElement | null {
    for (let node: Element | null = target; node; node = node.parentElement) {
      if (node === root) return root;
      const layer = layers.get(node);
      if (layer?.rise) return layer.element;
    }
    return null;
  }

  function highlight(element: StyledElement | null) {
    if (element === highlighted) return;
    const previous = highlighted;
    highlighted = element;
    if (previous) settleOutline(previous);
    if (element) outline(element, true);
  }

  function hover(target: Element | null, x: number, y: number) {
    const element = target && isShown() && !dragging ? layerAt(target) : null;
    highlight(element);
    if (!element) {
      label?.hide();
      return;
    }
    label ??= createHoverLabel(doc, settings.color);
    if (element !== labelFor) {
      labelFor = element;
      labelText = `${describeWithSize(element)}${marks.has(element) ? ` · ${current.markLabel ?? 'flagged'}` : ''}`;
    }
    label.show(labelText, x, y);
  }

  function startInteraction() {
    if (stopInteraction || !settings.interactive) return;

    ledger.set(root, 'cursor', 'grab');
    ledger.set(root, 'user-select', 'none');
    ledger.set(root, '-webkit-user-select', 'none');
    ledger.set(root, 'touch-action', 'pan-y');

    const stopPointer = watchPointer(root, {
      grab: (shift) => {
        dragging = true;
        hover(null, 0, 0);
        ledger.set(root, 'cursor', shift ? 'move' : 'grabbing');
        ledger.set(root, 'transition-duration', '0ms');
        const from = { ...angles };
        const fromPan = { ...pan };
        return {
          move(dx, dy) {
            if (shift) pan = { x: fromPan.x + dx, y: fromPan.y + dy };
            else angles = { tilt: clamp(from.tilt - dy * DEGREES_PER_PIXEL, 0, MAX_TILT), turn: from.turn - dx * DEGREES_PER_PIXEL };
            ledger.set(root, 'transform', tiltedTransform());
          },
          end() {
            dragging = false;
            ledger.set(root, 'cursor', 'grab');
            ledger.set(root, 'transition-duration', `${Math.round(duration())}ms`);
          }
        };
      },
      hover
    });

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      zoomTo(zoom * Math.exp(-clamp(pixels, -WHEEL_CAP, WHEEL_CAP) * WHEEL_SPEED), false);
    };
    root.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        void close();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (event.key === '+' || event.key === '=') zoomTo(zoom * ZOOM_STEP, true);
      else if (event.key === '-' || event.key === '_') zoomTo(zoom / ZOOM_STEP, true);
      else if (event.key === '0') resetView();
      else return;
      event.preventDefault();
    };
    doc.addEventListener('keydown', onKeyDown);

    stopInteraction = () => {
      stopPointer();
      root.removeEventListener('wheel', onWheel);
      doc.removeEventListener('keydown', onKeyDown);
      ledger.restore(root, GRAB);
      hover(null, 0, 0);
    };
  }

  function endInteraction() {
    const stop = stopInteraction;
    stopInteraction = null;
    stop?.();
  }

  function applyView(animate: boolean) {
    if (!isShown()) return;
    transition(root, 'transform', animate && !dragging ? Math.min(duration(), ZOOM_MS) : 0, 0);
    ledger.set(root, 'transform', tiltedTransform());
  }

  function zoomTo(next: number, animate: boolean) {
    const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(target - zoom) < 0.001) return;
    zoom = target;
    applyView(animate);
    current.onZoomChange?.(zoom);
  }

  function resetView() {
    const zoomed = zoom !== 1;
    zoom = 1;
    pan = { x: 0, y: 0 };
    angles = { tilt: settings.tilt, turn: settings.turn };
    applyView(true);
    if (zoomed) current.onZoomChange?.(zoom);
  }

  function baseDepth(element: Element, styleOf: StyleOf): number | null {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node === root) return 0;
      const layer = layers.get(node);
      if (layer) return layer.opens ? layer.depth : null;
      const display = styleOf(node).display;
      if (display !== 'contents' && display !== 'inline') return null;
    }
    return null;
  }

  function adopt(records: MutationRecord[]) {
    if (!isShown()) return;
    let changed = false;

    for (const element of ledger.elements()) {
      if (element === root || root.contains(element)) continue;
      ledger.restore(element);
      layers.delete(element);
      deepestLevel = null;
      if (highlighted === element) highlighted = null;
      changed = true;
    }

    const styleOf = computedStyles(view);
    const ms = duration();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== ELEMENT_NODE) continue;
        const element = node as Element;
        if (layers.has(element) || !root.contains(element)) continue;

        const depth = baseDepth(element, styleOf);
        if (depth === null) continue;

        for (const layer of planAdded(element, depth, settings.depth, styleOf, marks)) {
          if (layers.has(layer.element)) continue;
          layers.set(layer.element, layer);
          deepestLevel = null;
          raiseLayer(layer, ms, 0);
          if (layer.rise) settleOutline(layer.element);
          changed = true;
        }
      }
    }

    if (changed) ledger.set(root, 'transform', tiltedTransform());
  }

  function watchChanges() {
    if (typeof view.MutationObserver === 'function') {
      const mutations = new view.MutationObserver(adopt);
      mutations.observe(root, { childList: true, subtree: true });
      observers.push(mutations);
    }
    if (typeof view.ResizeObserver === 'function') {
      const resize = new view.ResizeObserver(() => {
        rootSize = null;
        labelFor = null;
        if (isShown()) ledger.set(root, 'transform', tiltedTransform());
      });
      resize.observe(root);
      observers.push(resize);
    }
  }

  return {
    get phase() {
      return phase;
    },
    get isOpen() {
      return isShown();
    },
    open,
    close,
    toggle: () => (isShown() ? close() : open()),
    get zoom() {
      return zoom;
    },
    setZoom: (next: number) => zoomTo(next, true),
    resetView,
    update,
    destroy
  };
}
