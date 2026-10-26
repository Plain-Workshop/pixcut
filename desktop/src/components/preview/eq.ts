import type { AudioClip } from '../../stores/model';

type Graph = { filters: BiquadFilterNode[] };

const graphs = new WeakMap<HTMLMediaElement, Graph>();
let context: AudioContext | null = null;

const clampDb = (value: number | undefined) => Math.max(-12, Math.min(12, Number.isFinite(value) ? value ?? 0 : 0));

export function hasEq(clip: Pick<AudioClip, 'low' | 'mid' | 'high'>): boolean {
  return Math.abs(clip.low ?? 0) > 0.01 || Math.abs(clip.mid ?? 0) > 0.01 || Math.abs(clip.high ?? 0) > 0.01;
}

/**
 * Routes a music element through a three-band EQ. The graph is built the first
 * time a clip needs it and reused afterwards; flat settings are neutral, so a
 * track that is later reset keeps playing unchanged. Browsers that refuse the
 * element source keep the plain volume path instead of going silent.
 */
export function applyClipEq(element: HTMLMediaElement, clip: Pick<AudioClip, 'low' | 'mid' | 'high'>): void {
  let graph = graphs.get(element);
  if (!hasEq(clip)) {
    if (graph) for (const filter of graph.filters) filter.gain.value = 0;
    return;
  }
  if (!graph) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context ??= new Ctor();
      const source = context.createMediaElementSource(element);
      const low = context.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 120;
      const mid = context.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1;
      const high = context.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 6000;
      source.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(context.destination);
      graph = { filters: [low, mid, high] };
      graphs.set(element, graph);
    } catch {
      return;
    }
  }
  graph.filters[0].gain.value = clampDb(clip.low);
  graph.filters[1].gain.value = clampDb(clip.mid);
  graph.filters[2].gain.value = clampDb(clip.high);
  if (context?.state === 'suspended') void context.resume().catch(() => { /* the next gesture retries */ });
}

/** Test hook: forget cached graphs so a fresh element starts clean. */
export function resetEqGraphs(): void {
  context = null;
}
