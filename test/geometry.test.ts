import { describe, expect, it } from 'vitest';
import { liftedTranslate, projectedBox, splitValues, viewTransform, type ViewFrame } from '../src/view/geometry';

describe('splitValues', () => {
  it('splits on spaces but keeps functions whole', () => {
    expect(splitValues(' calc(50% + 2px) 0px  4px ')).toEqual(['calc(50% + 2px)', '0px', '4px']);
  });
});

describe('liftedTranslate', () => {
  it('lifts an element that has no translate of its own', () => {
    expect(liftedTranslate('none', 40)).toBe('0px 0px 40px');
    expect(liftedTranslate('', 40)).toBe('0px 0px 40px');
  });

  it("keeps the page's own x and y", () => {
    expect(liftedTranslate('-50% -50%', 40)).toBe('-50% -50% 40px');
    expect(liftedTranslate('10px', 40)).toBe('10px 0px 40px');
  });

  it('adds to a z the element already has', () => {
    expect(liftedTranslate('1px 2px 3px', 40)).toBe('1px 2px 43px');
    expect(liftedTranslate('0px 0px calc(1em + 2px)', 10)).toBe('0px 0px calc(calc(1em + 2px) + 10px)');
  });
});

const frame: ViewFrame = { width: 1000, height: 450, rise: 120, perspective: 2000 };

function parse(transform: string) {
  const [, x = '', y = ''] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform) ?? [];
  const [, scale = ''] = /scale3d\(([\d.]+),/.exec(transform) ?? [];
  return { x: Number(x), y: Number(y), scale: Number(scale) };
}

describe('projectedBox', () => {
  it('is the root itself when nothing is turned, tipped or raised', () => {
    expect(projectedBox({ tilt: 0, turn: 0 }, { ...frame, rise: 0 })).toEqual({
      left: -500,
      right: 500,
      top: -225,
      bottom: 225
    });
  });

  it('reaches higher as the stack rises', () => {
    const flat = projectedBox({ tilt: 55, turn: -35 }, { ...frame, rise: 0 });
    const raised = projectedBox({ tilt: 55, turn: -35 }, frame);
    expect(raised.top).toBeLessThan(flat.top);
    expect(raised.bottom).toBe(flat.bottom);
  });
});

describe('viewTransform', () => {
  it('tips and turns the root', () => {
    expect(viewTransform({ tilt: 55, turn: -35 }, frame)).toContain('perspective(2000px) rotateX(55deg) rotateZ(-35deg)');
  });

  it.each([
    [55, -35],
    [30, 0],
    [80, 60],
    [10, -90]
  ])('keeps the whole stack inside the root at tilt %i and turn %i', (tilt, turn) => {
    const transform = viewTransform({ tilt, turn }, frame);
    const { x, y, scale } = parse(transform);
    const box = projectedBox({ tilt, turn }, frame);

    expect(box.left * scale + x).toBeGreaterThanOrEqual(-frame.width / 2);
    expect(box.right * scale + x).toBeLessThanOrEqual(frame.width / 2);
    expect(box.top * scale + y).toBeGreaterThanOrEqual(-frame.height / 2);
    expect(box.bottom * scale + y).toBeLessThanOrEqual(frame.height / 2);
  });

  it('moves a rising stack down to keep it centred', () => {
    expect(parse(viewTransform({ tilt: 55, turn: 0 }, frame)).y).toBeGreaterThan(0);
  });

  it('zooms around the centre and adds the move on screen', () => {
    const fitted = parse(viewTransform({ tilt: 55, turn: -35 }, frame));
    const zoomed = parse(viewTransform({ tilt: 55, turn: -35 }, { ...frame, zoom: 2, pan: { x: 30, y: -10 } }));
    expect(zoomed.scale).toBeCloseTo(fitted.scale * 2, 2);
    expect(zoomed.x).toBeCloseTo(fitted.x * 2 + 30, 1);
    expect(zoomed.y).toBeCloseTo(fitted.y * 2 - 10, 1);
  });

  it('leaves a root without size unscaled', () => {
    expect(viewTransform({ tilt: 30, turn: 0 }, { ...frame, width: 0, height: 0 })).toBe(
      'translate(0px, 0px) perspective(2000px) rotateX(30deg) rotateZ(0deg) scale3d(1, 1, 1)'
    );
  });
});
