import { describe, expect, it } from 'vitest';
import { centreGuides, edgeGuides, snapToTargets } from '../src/components/preview/snapping';

describe('snapToTargets', () => {
  it('snaps a value inside the threshold and reports the guide', () => {
    expect(snapToTargets(.503, centreGuides())).toEqual({ value: .5, guide: .5 });
  });

  it('leaves a value outside the threshold untouched', () => {
    expect(snapToTargets(.2, centreGuides())).toEqual({ value: .2, guide: null });
  });

  it('picks the nearest of several targets', () => {
    const targets = [{ at: .3, guide: .3 }, { at: .34, guide: .34 }];
    expect(snapToTargets(.332, targets)).toEqual({ value: .34, guide: .34 });
  });

  it('accepts a custom threshold and treats it inclusively', () => {
    expect(snapToTargets(.47, centreGuides(), .03)).toEqual({ value: .5, guide: .5 });
    expect(snapToTargets(.46, centreGuides(), .03)).toEqual({ value: .46, guide: null });
  });

  it('ignores broken target values instead of throwing', () => {
    const targets = [{ at: Number.NaN, guide: .5 }, { at: .5, guide: Number.POSITIVE_INFINITY }, { at: .5, guide: .5 }];
    expect(snapToTargets(.505, targets)).toEqual({ value: .5, guide: .5 });
    expect(snapToTargets(Number.NaN, targets)).toEqual({ value: Number.NaN, guide: null });
  });

  it('snaps to another layer centre and draws the guide there', () => {
    const targets = centreGuides([.25, 1.4, Number.NaN]);
    expect(snapToTargets(.252, targets)).toEqual({ value: .25, guide: .25 });
    expect(targets).toHaveLength(2);
  });
});

describe('edge guides', () => {
  it('offers left, centre and right for a box aligned by its left edge', () => {
    const guides = edgeGuides(.4);
    expect(guides).toEqual([
      { at: 0, guide: 0 },
      { at: .3, guide: .5 },
      { at: .6, guide: 1 },
    ]);
    expect(snapToTargets(.302, guides)).toEqual({ value: .3, guide: .5 });
  });

  it('clamps out-of-range sizes and uses the same maths for height', () => {
    expect(edgeGuides(2)).toEqual([{ at: 0, guide: 0 }, { at: 0, guide: .5 }, { at: 0, guide: 1 }]);
    expect(edgeGuides(.2)[1]).toEqual({ at: .4, guide: .5 });
    expect(edgeGuides(Number.NaN)).toEqual([{ at: 0, guide: 0 }, { at: .5, guide: .5 }, { at: 1, guide: 1 }]);
  });
});
