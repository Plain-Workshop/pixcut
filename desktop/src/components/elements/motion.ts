import type { ElementLayer } from '../../stores/model';

export const ELEMENT_ANIMATIONS = [
  ['none', 'Still'], ['fade', 'Fade in'], ['pop', 'Pop in'], ['slide-up', 'Rise'],
  ['slide-down', 'Drop in'], ['slide-left', 'From right'], ['slide-right', 'From left'],
  ['zoom-out', 'Zoom out'], ['bounce', 'Bounce'], ['spin', 'Spin in'],
  ['pulse', 'Pulse'], ['float', 'Float'], ['swing', 'Swing'],
] as const;

// Shared by the canvas preview and every export overlay.
export function elementMotion(animation: ElementLayer['animation'], seconds: number) {
  const local = Math.max(0, seconds);
  const progress = Math.min(1, local / .6);
  const eased = 1 - (1 - progress) ** 3;
  const entrance = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'spin', 'zoom-out'].includes(animation);
  let scale = 1, x = 0, y = 0, rotation = 0;
  if (animation === 'pop') scale = .6 + .4 * eased;
  if (animation === 'zoom-out') scale = 1.5 - .5 * eased;
  if (animation === 'slide-up') y = (1 - eased) * .07;
  if (animation === 'slide-down') y = -(1 - eased) * .07;
  if (animation === 'slide-left') x = (1 - eased) * .1;
  if (animation === 'slide-right') x = -(1 - eased) * .1;
  if (animation === 'spin') { rotation = -180 * (1 - eased); scale = .5 + .5 * eased; }
  if (animation === 'bounce') y = -Math.abs(Math.sin(progress * Math.PI * 2.5)) * (1 - progress) * .16;
  if (animation === 'pulse') scale = 1 + Math.sin(local * 6) * .05;
  if (animation === 'float') y = Math.sin(local * 2.4) * .02;
  if (animation === 'swing') rotation = Math.sin(local * 3.5) * 12;
  return { alpha: entrance ? eased : 1, scale, x: x || 0, y: y || 0, rotation: rotation || 0 };
}

export const isContinuousMotion = (animation: ElementLayer['animation']) => ['pulse', 'float', 'swing'].includes(animation);
export function animationSelection(animation: ElementLayer['animation']): Pick<ElementLayer,'animation'|'loop'> {
  return { animation, loop: isContinuousMotion(animation) };
}
/** A dedicated motion clock keeps content animation from hiding the entrance demo. */
export function motionPreviewSeconds(animation: ElementLayer['animation'], elapsed: number) {
  return isContinuousMotion(animation) ? elapsed : (1 - Math.cos(elapsed * Math.PI / .8)) / 2 * .6;
}
