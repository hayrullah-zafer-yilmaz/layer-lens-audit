const DRAG_THRESHOLD = 4;
const ELEMENT_NODE = 1;

export interface DragSession {
  move(dx: number, dy: number): void;
  end(): void;
}

export interface PointerHandlers {
  grab(shift: boolean): DragSession;
  hover(target: Element | null, x: number, y: number): void;
}

interface Press {
  id: number;
  x: number;
  y: number;
  shift: boolean;
  session: DragSession | null;
}

export function watchPointer(root: HTMLElement, handlers: PointerHandlers): () => void {
  let press: Press | null = null;
  let swallowClick = false;

  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, shift: event.shiftKey, session: null };
  };

  const move = (event: PointerEvent) => {
    if (!press) {
      const target = event.target as Node | null;
      handlers.hover(target?.nodeType === ELEMENT_NODE ? (target as Element) : null, event.clientX, event.clientY);
      return;
    }
    if (event.pointerId !== press.id) return;

    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.session) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      press.session = handlers.grab(press.shift);
      try {
        root.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    press.session.move(dx, dy);
  };

  const up = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const session = press.session;
    press = null;
    if (!session) return;

    session.end();
    if (event.type === 'pointerup') {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
    }
  };

  const click = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const leave = () => {
    if (!press) handlers.hover(null, 0, 0);
  };

  const dragStart = (event: DragEvent) => event.preventDefault();

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('click', click, true);
  root.addEventListener('dragstart', dragStart);

  return () => {
    press?.session?.end();
    press = null;
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('click', click, true);
    root.removeEventListener('dragstart', dragStart);
  };
}
