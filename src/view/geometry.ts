export interface ViewAngles {
  tilt: number;
  turn: number;
}

export interface ViewFrame {
  width: number;
  height: number;
  rise: number;
  perspective: number;
  zoom?: number;
  pan?: { x: number; y: number };
}

export const MAX_TILT = 85;

const FIT_MARGIN = 0.96;
const MIN_SCALE = 0.25;
const PIXELS = /^-?(?:\d+\.?\d*|\.\d+)px$/;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function splitValues(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of value.trim()) {
    if (char === '(') depth++;
    else if (char === ')') depth--;

    if (depth === 0 && /\s/.test(char)) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function liftedTranslate(translate: string, lift: number): string {
  const parts = !translate || translate === 'none' ? [] : splitValues(translate);
  const [x = '0px', y = '0px', z] = parts;
  const raised =
    z === undefined
      ? `${round(lift)}px`
      : PIXELS.test(z)
        ? `${round(parseFloat(z) + lift)}px`
        : `calc(${z} + ${round(lift)}px)`;

  return `${x} ${y} ${raised}`;
}

export interface ScreenBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function projectedBox(angles: ViewAngles, frame: ViewFrame): ScreenBox {
  const turn = radians(angles.turn);
  const tilt = radians(angles.tilt);
  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  const box: ScreenBox = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      for (const z of [0, frame.rise]) {
        const turnedX = x * Math.cos(turn) - y * Math.sin(turn);
        const turnedY = x * Math.sin(turn) + y * Math.cos(turn);
        const tiltedY = turnedY * Math.cos(tilt) - z * Math.sin(tilt);
        const towardViewer = turnedY * Math.sin(tilt) + z * Math.cos(tilt);
        const magnified = frame.perspective / Math.max(frame.perspective - towardViewer, frame.perspective * 0.1);

        box.left = Math.min(box.left, turnedX * magnified);
        box.right = Math.max(box.right, turnedX * magnified);
        box.top = Math.min(box.top, tiltedY * magnified);
        box.bottom = Math.max(box.bottom, tiltedY * magnified);
      }
    }
  }

  return box;
}

export function viewTransform(angles: ViewAngles, frame: ViewFrame): string {
  const zoom = frame.zoom ?? 1;
  let scale = zoom;
  let shiftX = 0;
  let shiftY = 0;

  if (frame.width > 0 && frame.height > 0) {
    const box = projectedBox(angles, frame);
    const fit = clamp(
      Math.min(1, (frame.width * FIT_MARGIN) / (box.right - box.left), (frame.height * FIT_MARGIN) / (box.bottom - box.top)),
      MIN_SCALE,
      1
    );
    scale = fit * zoom;
    shiftX = (-(box.left + box.right) / 2) * scale;
    shiftY = (-(box.top + box.bottom) / 2) * scale;
  }

  shiftX += frame.pan?.x ?? 0;
  shiftY += frame.pan?.y ?? 0;

  const size = round(scale, 3);
  return [
    `translate(${round(shiftX)}px, ${round(shiftY)}px)`,
    `perspective(${round(frame.perspective)}px)`,
    `rotateX(${round(angles.tilt)}deg)`,
    `rotateZ(${round(angles.turn)}deg)`,
    `scale3d(${size}, ${size}, ${size})`
  ].join(' ');
}
