import { secondsToTicks, type Timebase, type Transition } from '../../stores/model';

/**
 * How much of a clip's tail a transition covers. The window always leaves at
 * least one tick of moving picture, so a 0.1 s transition on a 0.2 s clip still
 * exports instead of producing an empty segment.
 */
export function transitionTicksFor(durationTicks: number, transition: Transition | null | undefined, timebase: Timebase): number {
  if (!transition || transition.type === 'none' || durationTicks < 2) return 0;
  return Math.max(1, Math.min(secondsToTicks(transition.duration, timebase), durationTicks - 1));
}

/** Picture and sound lengths for a clip that ends in a transition. */
export function splitTransition(durationTicks: number, transition: Transition | null | undefined, timebase: Timebase) {
  const transitionTicks = transitionTicksFor(durationTicks, transition, timebase);
  return {
    transitionTicks,
    mainTicks: Math.max(1, durationTicks - transitionTicks),
    audioTicks: transitionTicks ? durationTicks : 0,
  };
}
