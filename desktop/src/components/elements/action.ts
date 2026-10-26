import { ticksToSeconds, type ElementLayer, type Timebase } from '../../stores/model';
export function actionTransform(element: ElementLayer, local: number, timebase: Timebase) {
  const action = element.action;
  const result = { rotation: 0, scale: 1, y: 0 };
  if (!action) return result;
  const start = ticksToSeconds(action.startTicks, timebase), duration = ticksToSeconds(action.durationTicks, timebase);
  const time = local - start;
  if (time < 0 || time >= duration) return result;
  const cycle = action.repeat ? time % 1.2 : time;
  const envelope = action.repeat ? 1 : Math.sin(Math.PI * time / duration);
  if (action.kind === 'ring') result.rotation = Math.sin(cycle * 28) * 22 * envelope;
  if (action.kind === 'pulse') result.scale = 1 + Math.sin(cycle * Math.PI * 4) * .09 * envelope;
  if (action.kind === 'float') result.y = Math.sin(cycle * Math.PI * 2) * .025 * envelope;
  if (action.kind === 'spin') result.rotation = 360 * (action.repeat ? time % 1.2 / 1.2 : time / duration);
  return result;
}
