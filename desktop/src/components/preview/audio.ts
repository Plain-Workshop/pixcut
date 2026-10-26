import { ticksToSeconds, type AudioClip, type Timebase } from '../../stores/model';
type AudioState = { active: boolean; pending: boolean; retryAfter: number };
const states = new WeakMap<HTMLMediaElement, AudioState>();

// A pending play() must not be restarted by every React/playhead frame.
export function syncAudioElement(element: HTMLMediaElement, clip: AudioClip, position: number, playing: boolean, timebase: Timebase, now = performance.now(), gain = 1) {
  const state = states.get(element) ?? { active: false, pending: false, retryAfter: 0 };
  states.set(element, state);
  const local = position - ticksToSeconds(clip.startTicks, timebase);
  const length = ticksToSeconds(clip.durationTicks, timebase);
  const active = playing && local >= 0 && local < length;
  const target = clip.sourceInSeconds + Math.max(0, local);
  if (!active) {
    if (!element.paused) element.pause();
    state.active = false;
    if (local >= 0 && local < length && !element.seeking && Math.abs(element.currentTime - target) > .05) {
      try { element.currentTime = target; } catch { /* wait for metadata */ }
    }
    return;
  }
  if (!state.active || (!state.pending && !element.seeking && Math.abs(element.currentTime - target) > 1)) {
    try { element.currentTime = target; } catch { /* wait for metadata */ }
  }
  state.active = true;
  const fadeIn = clip.fadeIn > 0 ? Math.min(1, local / clip.fadeIn) : 1;
  const fadeOut = clip.fadeOut > 0 ? Math.min(1, (length - local) / clip.fadeOut) : 1;
  element.volume = Math.max(0, Math.min(1, clip.volume * Math.min(fadeIn, fadeOut) * Math.max(0, Math.min(1, gain))));
  if (element.paused && !state.pending && now >= state.retryAfter) {
    state.pending = true;
    void element.play().catch(() => { state.retryAfter = now + 1000; }).finally(() => { state.pending = false; });
  }
}
