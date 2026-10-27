import { describe, expect, it } from 'vitest';
import { normaliseRotation, resizeRotatedBox, rotationFromPointer, type BoxPixels } from '../src/components/preview/transform-handles';

const limits = { minWidth: 20, minHeight: 20, maxWidth: 1000, maxHeight: 1000 };
const box = (patch: Partial<BoxPixels> = {}): BoxPixels => ({ cx: 100, cy: 100, w: 100, h: 50, rotation: 0, ...patch });
const corner = (value: { cx: number; cy: number; w: number; h: number; rotation: number }, which: 'nw' | 'se') => {
  const radians = value.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const localX = (which === 'nw' ? -1 : 1) * value.w / 2;
  const localY = (which === 'nw' ? -1 : 1) * value.h / 2;
  return { x: value.cx + localX * cos - localY * sin, y: value.cy + localX * sin + localY * cos };
};

describe('transform handles', () => {
  it('resizes from the south-east corner while the north-west corner stays put', () => {
    const base = box();
    const next = resizeRotatedBox(base, 'se', 20, 10, limits);
    expect(next).toEqual({ cx: 110, cy: 105, w: 120, h: 60 });
    const before = corner(base, 'nw'), after = corner({ ...base, ...next }, 'nw');
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('resizes from the north-west corner while the south-east corner stays put', () => {
    const base = box();
    const next = resizeRotatedBox(base, 'nw', 10, 5, limits);
    expect(next).toEqual({ cx: 105, cy: 102.5, w: 90, h: 45 });
    const before = corner(base, 'se'), after = corner({ ...base, ...next }, 'se');
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('projects the pointer onto a rotated box and keeps the opposite corner fixed', () => {
    const base = box({ rotation: 90 });
    // Screen-right is the box's local "up", so pulling right-on-screen shrinks height.
    expect(resizeRotatedBox(base, 'se', 20, 0, limits)).toEqual({ cx: 110, cy: 100, w: 100, h: 30 });
    const rotated = box({ rotation: 30 });
    const next = resizeRotatedBox(rotated, 'se', 18, 12, limits);
    const before = corner(rotated, 'nw'), after = corner({ ...rotated, ...next }, 'nw');
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('keeps proportions when asked and clamps to the stage bounds', () => {
    const square = resizeRotatedBox(box(), 'se', 20, 0, limits, true);
    expect(square.w / square.h).toBeCloseTo(2, 6);
    const clamped = resizeRotatedBox(box(), 'nw', 500, 500, limits);
    expect(clamped.w).toBe(20);
    expect(clamped.h).toBe(20);
    const capped = resizeRotatedBox(box(), 'se', 5000, 5000, limits);
    expect(capped.w).toBe(1000);
    expect(capped.h).toBe(1000);
  });

  it('wraps rotation and snaps the pointer angle', () => {
    expect(normaliseRotation(190)).toBe(-170);
    expect(normaliseRotation(-190)).toBe(170);
    expect(normaliseRotation(180)).toBe(180);
    expect(normaliseRotation(540)).toBe(180);
    expect(rotationFromPointer(0, 10, 40)).toBe(30);
    expect(rotationFromPointer(0, 10, 47, true)).toBe(30);
    expect(rotationFromPointer(170, 0, 5, true)).toBe(180);
    expect(rotationFromPointer(-170, 0, -10, true)).toBe(180);
  });
});
