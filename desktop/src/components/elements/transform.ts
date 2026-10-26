import { ticksToSeconds, type ElementLayer, type Timebase } from '../../stores/model';
import { actionTransform } from './action';
import { elementAnimationTime } from './animation-time';
import { elementMotion } from './motion';

// The canvas and its interaction handles must follow the same animation.
export function elementTransform(element: ElementLayer, localSeconds: number, timebase: Timebase) {
  const motion = elementMotion(element.animation, elementAnimationTime(element, localSeconds));
  const action = actionTransform(element, localSeconds, timebase);
  const duration = ticksToSeconds(element.durationTicks, timebase);
  const exit = element.exit && element.exit !== 'none' ? Math.max(0, Math.min(1, (duration - localSeconds) / Math.min(.4, duration / 2))) : 1;
  return { ...motion, alpha: motion.alpha * exit, rotation: motion.rotation + action.rotation, scale: motion.scale * action.scale, y: motion.y + action.y + (element.exit === 'slide-down' ? (1 - exit) * .07 : 0) };
}
