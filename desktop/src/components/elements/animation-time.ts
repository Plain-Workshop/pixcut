import type { ElementLayer } from '../../stores/model';
export function elementAnimationTime(element: ElementLayer, local: number) {
  if (element.animation === 'none') return local;
  const periods: Partial<Record<ElementLayer['animation'], number>> = { pulse: Math.PI / 3, float: Math.PI / 1.2, swing: Math.PI * 2 / 3.5 };
  const period = periods[element.animation];
  if (period) {
    const duration = element.animationDuration ?? period;
    return (element.loop === false ? Math.min(local, duration) : local) * period / duration;
  }
  const duration = Math.max(.1, element.animationDuration ?? .6);
  if (!element.loop) return local * .6 / duration;
  // Entry motions travel out and back with no idle interval between cycles.
  const phase = (Math.max(0, local) % (duration * 2)) / duration;
  return (phase <= 1 ? phase : 2 - phase) * .6;
}
