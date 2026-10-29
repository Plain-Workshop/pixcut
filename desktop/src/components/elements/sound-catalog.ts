import { secondsToTicks, ticksToSeconds, totalTicks, type AudioClip, type Project } from '../../stores/model';

/**
 * A curated, grouped sound-effect library rendered locally as PCM. Every effect
 * here is synthesized on demand from a compact spec, so preview and FFmpeg receive identical WAV data.
 *
 * The catalog is deliberately built from distinct archetypes (transients,
 * strings, FM bells, vowels, swept noise, ambience beds) instead of stacking
 * small parameter changes, and `tests/sound-catalog.test.ts` measures every
 * pair to keep near-duplicates out. Real recordings (CC0 / CC BY only) live in
 * `stores/sound-library.ts` and `public/sounds/`.
 */
export type SoundEngine = 'tone' | 'chime' | 'fm' | 'pluck' | 'formant' | 'noise' | 'whoosh' | 'impact' | 'sweep' | 'arp' | 'ambience' | 'click';
export type SoundCategoryId = 'ui' | 'chime' | 'whoosh' | 'impact' | 'cartoon' | 'alert' | 'nature' | 'scifi' | 'music' | 'foley';

export type SoundSpec = {
  id: string;
  label: string;
  category: SoundCategoryId;
  seconds: number;
  engine: SoundEngine;
  /** Start frequency in Hz. */
  freq?: number;
  /** End frequency for glides, sweeps and whooshes. */
  freqEnd?: number;
  /** Seconds the pitch takes to reach `freqEnd`. */
  glide?: number;
  /** Harmonic ratios for tonal, chime and arp engines. */
  partials?: number[];
  /** Exponential decay rate; higher is shorter. */
  decay?: number;
  /** Attack or fade-in seconds. */
  attack?: number;
  /** Soft-clip amount for sweeps. */
  drive?: number;
  /** White-noise blend for tonal engines. */
  noise?: number;
  /** Low/high blend for noise and ambience engines. */
  bright?: number;
  /** Filter cutoff in Hz for noise and ambience engines. */
  color?: number;
  /** Frequency modulation depth (0..1 for vibrato, 0..1 of the carrier for FM). */
  vibrato?: number;
  /** Amplitude LFO rate in Hz for ambience. */
  wobble?: number;
  /** Note ratios for arpeggios and sequences. */
  notes?: number[];
  /** Seconds per note for arpeggios. */
  noteSeconds?: number;
  /** FM modulator ratio (non-integer values sound glassy). */
  ratio?: number;
  /** FM modulation index; higher is brighter. */
  index?: number;
  /** Karplus-Strong damping (0.9 loose, 0.999 tight). */
  damping?: number;
  /** Formant frequencies for vowel-like cartoon voices. */
  vowel?: [number, number, number];
  /** Detune in Hz added to chime partials for a shimmering beat. */
  beating?: number;
  /** Flips the envelope and tail, turning risers into reverse impacts. */
  reverse?: boolean;
};

export const SOUND_CATEGORIES: { id: SoundCategoryId; label: string }[] = [
  { id: 'ui', label: 'Interface' },
  { id: 'chime', label: 'Chimes & bells' },
  { id: 'whoosh', label: 'Whooshes & swells' },
  { id: 'impact', label: 'Impacts & hits' },
  { id: 'cartoon', label: 'Cartoon & comedy' },
  { id: 'alert', label: 'Alerts & notifications' },
  { id: 'nature', label: 'Nature & ambience' },
  { id: 'scifi', label: 'Sci-fi & tech' },
  { id: 'music', label: 'Musical stings' },
  { id: 'foley', label: 'Camera & Foley' },
];

type Row = [id: string, label: string, seconds: number, engine: SoundEngine, params?: Partial<SoundSpec>];
const group = (category: SoundCategoryId, rows: Row[]): SoundSpec[] => rows.map(([id, label, seconds, engine, params]) => ({ id, label, category, seconds, engine, ...params }));

/** Everyday editor sounds: clicks, switches, toggles and short feedback. */
const INTERFACE: Row[] = [
  ['click', 'Click', .16, 'click', { freq: 1900, decay: 120, noise: .6 }],
  ['click-soft', 'Soft click', .2, 'click', { freq: 1400, decay: 200, noise: .3 }],
  ['click-sharp', 'Sharp click', .11, 'click', { freq: 2800, decay: 260, noise: .75 }],
  ['tap', 'Tap', .18, 'impact', { freq: 320, freqEnd: 240, decay: 60, noise: .15 }],
  ['tick', 'Tick', .06, 'click', { freq: 3600, decay: 300, noise: .5 }],
  ['tock', 'Tock', .14, 'click', { freq: 600, decay: 70, noise: .25 }],
  ['pop', 'Pop', .32, 'tone', { freq: 420, freqEnd: 980, decay: 26, attack: .002 }],
  ['pop-soft', 'Soft pop', .26, 'tone', { freq: 240, freqEnd: 520, decay: 14 }],
  ['blip', 'Blip', .18, 'tone', { freq: 1500, freqEnd: 1250, decay: 24 }],
  ['bloop', 'Bloop', .34, 'tone', { freq: 320, freqEnd: 170, decay: 12 }],
  ['bubble', 'Bubble', .4, 'tone', { freq: 300, freqEnd: 900, decay: 12, vibrato: .08 }],
  ['switch-on', 'Switch on', .22, 'impact', { freq: 500, freqEnd: 300, decay: 40, noise: .2 }],
  ['switch-off', 'Switch off', .2, 'impact', { freq: 300, freqEnd: 180, decay: 40, noise: .2 }],
  ['toggle', 'Toggle', .24, 'tone', { freq: 660, freqEnd: 990, decay: 18 }],
  ['hover', 'Hover', .08, 'click', { freq: 2200, decay: 190, noise: .35 }],
  ['press', 'Press', .16, 'impact', { freq: 200, freqEnd: 120, decay: 40, noise: .25 }],
  ['release', 'Release', .12, 'click', { freq: 1600, decay: 90, noise: .3 }],
  ['scroll', 'Scroll', .1, 'click', { freq: 1800, decay: 170, noise: .45 }],
  ['swipe', 'Swipe', .35, 'whoosh', { freq: 1600, freqEnd: 400 }],
  ['slide-in', 'Slide in', .5, 'whoosh', { freq: 350, freqEnd: 1500 }],
  ['drop', 'Drop', .3, 'impact', { freq: 190, freqEnd: 95, decay: 20, noise: .2 }],
  ['lift', 'Lift', .26, 'sweep', { freq: 300, freqEnd: 900 }],
  ['snap', 'Snap', .14, 'noise', { color: 3500, decay: 42, bright: .85 }],
  ['lock', 'Lock', .2, 'impact', { freq: 240, freqEnd: 150, decay: 26, noise: .15 }],
  ['unlock', 'Unlock', .24, 'chime', { partials: [1, 1.5, 2], freq: 620, decay: 12 }],
  ['delete', 'Delete', .35, 'noise', { color: 1500, decay: 12, bright: .45 }],
  ['error', 'Error', .3, 'tone', { freq: 240, freqEnd: 170, decay: 11, partials: [1, 1.5] }],
  ['success', 'Success', .5, 'arp', { notes: [1, 1.26, 1.5], noteSeconds: .1, freq: 660, decay: 14 }],
  ['typing', 'Typing', .12, 'noise', { color: 3000, decay: 60, bright: .9, attack: .002 }],
  ['menu', 'Menu open', .3, 'arp', { notes: [1, 1.12], noteSeconds: .06, freq: 880, decay: 20 }],
];

/** Recognizable ring, ding and bell archetypes across the pitch range. */
const CHIMES: Row[] = [
  ['ding', 'Ding', 1.4, 'chime', { partials: [1], freq: 1568, decay: 7 }],
  ['ding-high', 'High ding', 1, 'chime', { partials: [1], freq: 2637, decay: 9 }],
  ['ding-low', 'Low ding', 1.8, 'chime', { partials: [1], freq: 784, decay: 5 }],
  ['bell', 'Bell ring', 1.8, 'chime', { partials: [1, 2.01, 2.96, 4.2], freq: 880, decay: 3.2, noise: .05 }],
  ['bell-soft', 'Soft bell', 2.4, 'chime', { partials: [1, 2.4, 3.9], freq: 520, decay: 2.4 }],
  ['bell-deep', 'Deep bell', 3.2, 'chime', { partials: [1, 2.03, 3.1], freq: 320, decay: 1.5 }],
  ['chime', 'Chime', .9, 'chime', { partials: [1, 2, 3], freq: 1046, decay: 4 }],
  ['chime-bright', 'Bright chime', .7, 'chime', { partials: [1, 2.7, 4.2], freq: 1568, decay: 5 }],
  ['gong', 'Gong', 4, 'fm', { freq: 140, ratio: 1.41, index: 2, decay: .8 }],
  ['gong-deep', 'Deep gong', 5, 'chime', { partials: [1, 1.48, 2.02, 2.6], freq: 120, decay: .8 }],
  ['triangle', 'Triangle', 1.4, 'chime', { partials: [1, 3, 5], freq: 660, decay: 2.2 }],
  ['glass', 'Glass tap', .8, 'chime', { partials: [1, 2.3, 3.7, 5.2], freq: 1320, decay: 6 }],
  ['glass-hit', 'Glass hit', 1.2, 'chime', { partials: [1, 2.6, 4.4], freq: 980, decay: 4 }],
  ['music-box', 'Music box', 1.6, 'chime', { partials: [1, 2.01, 3.99], freq: 784, decay: 3 }],
  ['temple-bell', 'Temple bell', 3.6, 'chime', { partials: [1, 2.05, 3.2, 4.4], freq: 240, decay: 1.2 }],
  ['cowbell', 'Cowbell', .6, 'chime', { partials: [1, 2.4, 3.6], freq: 540, decay: 9 }],
  ['handbell', 'Handbell', 1.8, 'chime', { partials: [1, 2.4, 3.2, 4.6], freq: 660, decay: 2.6 }],
  ['doorbell', 'Doorbell', 1.4, 'chime', { partials: [1, 2.01], freq: 620, decay: 2.2 }],
  ['wind-chime', 'Wind chime', 2.2, 'arp', { notes: [1, 1.12, 1.26, 1.5, 1.68], noteSeconds: .22, freq: 880, decay: 5 }],
  ['crystal', 'Crystal', 1.6, 'fm', { freq: 1760, ratio: 3.5, index: 4, decay: 3 }],
  ['marimba', 'Marimba', .7, 'chime', { partials: [1, 4.1, 9.2], freq: 330, decay: 8 }],
  ['vibraphone', 'Vibraphone', 1.8, 'chime', { partials: [1, 4, 10], freq: 523, decay: 3, beating: 1.4 }],
  ['celesta', 'Celesta', 1.2, 'chime', { partials: [1, 3, 6], freq: 1046, decay: 4.5 }],
  ['tubular', 'Tubular bell', 3, 'fm', { freq: 294, ratio: 2.76, index: 3, decay: 1.2 }],
  ['kalimba', 'Kalimba', 1.1, 'pluck', { freq: 523, damping: .99, decay: .12 }],
  ['harp-pluck', 'Harp pluck', 1.5, 'pluck', { freq: 392, damping: .997, decay: .05 }],
  ['singing-bowl', 'Singing bowl', 4.2, 'chime', { partials: [1, 1.01, 1.5, 2.02], freq: 210, decay: .9 }],
  ['church-bell', 'Church bell', 4.5, 'chime', { partials: [1, 2, 2.7, 3.4, 4.1], freq: 155, decay: 2 }],
  ['sleigh-bells', 'Sleigh bells', 1.4, 'arp', { notes: [1, 1.2, 1.5, 1.2], noteSeconds: .07, freq: 2400, decay: 30 }],
  ['bowl-strike', 'Bowl strike', 2.6, 'chime', { partials: [1, 2.76, 5.4, 8.9], freq: 150, decay: 1.8, beating: 3.1 }],
];

/** Trailer-style movement: sweeps, risers, downlifters and reverse tails. */
const WHOOSHES: Row[] = [
  ['whoosh', 'Soft whoosh', .55, 'whoosh', { freq: 700, freqEnd: 2800 }],
  ['whoosh-fast', 'Fast whoosh', .22, 'whoosh', { freq: 300, freqEnd: 2400 }],
  ['whoosh-deep', 'Deep whoosh', .8, 'whoosh', { freq: 180, freqEnd: 1200 }],
  ['whoosh-air', 'Air whoosh', 1.1, 'whoosh', { freq: 400, freqEnd: 2200 }],
  ['swish', 'Swish', .25, 'whoosh', { freq: 2200, freqEnd: 900 }],
  ['swoosh', 'Swoosh', .75, 'whoosh', { freq: 400, freqEnd: 1800 }],
  ['swoosh-reverse', 'Reverse swoosh', .7, 'whoosh', { freq: 3000, freqEnd: 400 }],
  ['riser', 'Riser', 2.2, 'sweep', { freq: 180, freqEnd: 1400, drive: 1.4 }],
  ['riser-short', 'Short riser', .9, 'sweep', { freq: 220, freqEnd: 1200, drive: 1.2 }],
  ['riser-dark', 'Dark riser', 2.8, 'sweep', { freq: 90, freqEnd: 600, drive: 1.6 }],
  ['riser-bright', 'Bright riser', 1.8, 'sweep', { freq: 400, freqEnd: 3000, drive: 1.1 }],
  ['downlifter', 'Downlifter', 1.6, 'sweep', { freq: 1200, freqEnd: 180, drive: 1.2 }],
  ['transition-up', 'Transition up', .35, 'sweep', { freq: 700, freqEnd: 3400, drive: 1.3 }],
  ['transition-down', 'Transition down', .45, 'whoosh', { freq: 2600, freqEnd: 900 }],
  ['tape-stop', 'Tape stop', 1.1, 'tone', { freq: 880, freqEnd: 60, glide: 1, decay: 2, partials: [1, 2, 3] }],
  ['tape-start', 'Tape start', .8, 'tone', { freq: 60, freqEnd: 880, glide: .7, decay: 1.2, partials: [1, 3, 5] }],
  ['wind-swell', 'Wind swell', 2.4, 'ambience', { color: 900, freq: 90, wobble: .12, attack: 1.2 }],
  ['reverse-cymbal', 'Reverse cymbal', 1.6, 'noise', { bright: .9, color: 6000, attack: 1.5, decay: .2 }],
  ['reverse-hit', 'Reverse hit', 1.2, 'noise', { bright: .6, color: 3000, attack: 1.1, decay: .5 }],
  ['air-sweep', 'Air sweep', 1.4, 'whoosh', { freq: 300, freqEnd: 2000 }],
  ['metal-sweep', 'Metal sweep', .9, 'whoosh', { freq: 1400, freqEnd: 3800 }],
  ['pass-by', 'Pass by', .8, 'whoosh', { freq: 1400, freqEnd: 300 }],
  ['swell-slow', 'Slow swell', 3.2, 'ambience', { color: 700, freq: 70, wobble: .1, attack: 2 }],
  ['whoosh-cinematic', 'Cinematic whoosh', 1.8, 'whoosh', { freq: 250, freqEnd: 900 }],
  ['whoosh-brake', 'Brake whoosh', .22, 'whoosh', { freq: 3000, freqEnd: 1000 }],
  ['whoosh-zoom', 'Zoom whoosh', .4, 'whoosh', { freq: 800, freqEnd: 5000 }],
  ['whoosh-whip', 'Whip whoosh', .25, 'whoosh', { freq: 2200, freqEnd: 300 }],
  ['whoosh-drone', 'Whoosh drone', 2.6, 'ambience', { color: 1200, freq: 110, wobble: .24, attack: .9, bright: .6 }],
  ['reverse-boom', 'Reverse boom', 1.4, 'impact', { freq: 60, freqEnd: 30, decay: 3, noise: .3, reverse: true }],
  ['fly-by', 'Fly by', 1.4, 'sweep', { freq: 200, freqEnd: 1200, drive: 2.2 }],
];

/** Booms, hits and foley impacts used in every short-form edit. */
const IMPACTS: Row[] = [
  ['impact', 'Impact', .7, 'impact', { freq: 120, freqEnd: 40, decay: 9, noise: .4, glide: .1 }],
  ['impact-deep', 'Deep impact', 1.1, 'impact', { freq: 80, freqEnd: 32, decay: 6, noise: .3 }],
  ['thud', 'Thud', .5, 'impact', { freq: 160, freqEnd: 60, decay: 14, noise: .25 }],
  ['thump', 'Thump', .35, 'impact', { freq: 260, freqEnd: 100, decay: 22, noise: .5 }],
  ['boom', 'Boom', 1.4, 'impact', { freq: 70, freqEnd: 28, decay: 5, noise: .25 }],
  ['kick', 'Kick drum', .5, 'impact', { freq: 180, freqEnd: 45, decay: 18, noise: .1, glide: .06 }],
  ['punch', 'Punch', .28, 'impact', { freq: 330, freqEnd: 120, decay: 30, noise: .25 }],
  ['slam', 'Slam', .18, 'noise', { color: 900, decay: 30, bright: .65, attack: .001 }],
  ['door-slam', 'Door slam', .8, 'impact', { freq: 110, freqEnd: 40, decay: 8, noise: .5 }],
  ['metal-hit', 'Metal hit', .9, 'chime', { partials: [1, 2.3, 3.7, 5.1], freq: 420, decay: 5, noise: .15 }],
  ['wood-hit', 'Wood hit', .4, 'chime', { partials: [1, 3.1, 5.4], freq: 300, decay: 12, noise: .2 }],
  ['glass-break', 'Glass break', 1.1, 'noise', { bright: .9, color: 6200, decay: 5, attack: .002 }],
  ['crash', 'Crash', 2, 'noise', { bright: .8, color: 5000, decay: 2.6, attack: .004 }],
  ['snare', 'Snare', .3, 'noise', { bright: .7, color: 3800, decay: 18 }],
  ['tom', 'Tom', .6, 'impact', { freq: 220, freqEnd: 90, decay: 14, noise: .05 }],
  ['bass-drop', 'Bass drop', 1.6, 'sweep', { freq: 220, freqEnd: 35, drive: 2 }],
  ['sub-drop', 'Sub drop', 2.2, 'tone', { freq: 70, freqEnd: 20, glide: .4, decay: 2, partials: [1] }],
  ['hammer', 'Hammer', .42, 'impact', { freq: 180, freqEnd: 60, decay: 18, noise: .55 }],
  ['brick', 'Brick', .35, 'noise', { color: 500, decay: 14, bright: .15 }],
  ['concrete', 'Concrete thud', .8, 'noise', { color: 350, decay: 8, bright: .15, attack: .01 }],
  ['anvil', 'Anvil', 1.6, 'chime', { partials: [1, 2.7, 4.6, 6.2], freq: 520, decay: 3, noise: .1 }],
  ['stomp', 'Stomp', .5, 'noise', { color: 600, decay: 7, bright: .3 }],
  ['vine-boom', 'Vine boom', 1.8, 'impact', { freq: 95, freqEnd: 30, decay: 2.6, noise: .35, glide: .2 }],
  ['cinematic-hit', 'Cinematic hit', 2.2, 'chime', { partials: [1, 2.5, 4], freq: 130, decay: 2.5, noise: .2 }],
  ['trailer-boom', 'Trailer boom', 2.4, 'impact', { freq: 55, freqEnd: 22, decay: 3.5, noise: .3 }],
  ['metal-clang', 'Metal clang', 1.4, 'chime', { partials: [1, 2.1, 3.4, 5.9], freq: 700, decay: 2.4 }],
  ['wood-crack', 'Wood crack', .2, 'noise', { color: 2600, decay: 45, bright: .7 }],
  ['body-fall', 'Body fall', 1, 'impact', { freq: 100, freqEnd: 35, decay: 12, noise: .4, glide: .25 }],
  ['explosion', 'Explosion', 2.6, 'noise', { color: 300, decay: 2, bright: .25, attack: .01 }],
  ['debris', 'Debris', 1.8, 'noise', { color: 2600, decay: 4, bright: .8, attack: .005 }],
];

/** Slapstick and meme-adjacent cues: boings, whistles, pops and splats. */
const CARTOON: Row[] = [
  ['boing', 'Boing', .7, 'tone', { freq: 220, freqEnd: 520, glide: .5, vibrato: .06, decay: 4, partials: [1, 2] }],
  ['boing-low', 'Low boing', .9, 'tone', { freq: 140, freqEnd: 320, glide: .6, vibrato: .05 }],
  ['boing-wet', 'Wet boing', .8, 'formant', { freq: 180, freqEnd: 300, vowel: [500, 900, 2400], decay: 4 }],
  ['slide-whistle-up', 'Slide whistle up', .6, 'sweep', { freq: 500, freqEnd: 1900 }],
  ['slide-whistle-down', 'Slide whistle down', 1.1, 'sweep', { freq: 1800, freqEnd: 350 }],
  ['cartoon-run', 'Cartoon run', .5, 'arp', { notes: [1, 1.5], noteSeconds: .06, freq: 800, decay: 30 }],
  ['cartoon-jump', 'Cartoon jump', .4, 'sweep', { freq: 400, freqEnd: 1400 }],
  ['cartoon-fall', 'Cartoon fall', .7, 'sweep', { freq: 1400, freqEnd: 300 }],
  ['spring', 'Spring', .6, 'tone', { freq: 300, freqEnd: 900, glide: .45, vibrato: .1, decay: 6 }],
  ['spring-tight', 'Tight spring', .35, 'tone', { freq: 400, freqEnd: 1400, glide: .3, vibrato: .14, decay: 10 }],
  ['wobble', 'Wobble', .8, 'tone', { freq: 500, vibrato: .12, decay: 3 }],
  ['honk', 'Honk', .3, 'tone', { freq: 360, freqEnd: 300, decay: 14, partials: [1, 3, 5] }],
  ['squeak', 'Squeak', .25, 'tone', { freq: 1800, freqEnd: 2500, decay: 18 }],
  ['splat', 'Splat', .22, 'impact', { freq: 400, freqEnd: 150, decay: 18, noise: .5 }],
  ['bonk', 'Bonk', .25, 'impact', { freq: 500, freqEnd: 180, decay: 26, noise: .15 }],
  ['bonk-metal', 'Metal bonk', .5, 'chime', { partials: [1, 3, 6], freq: 800, decay: 14 }],
  ['zip', 'Zip', .18, 'whoosh', { freq: 1200, freqEnd: 6000 }],
  ['zoom', 'Zoom', .3, 'whoosh', { freq: 800, freqEnd: 3000 }],
  ['bubble-pop', 'Bubble pop', .18, 'tone', { freq: 900, freqEnd: 300, decay: 30 }],
  ['twinkle', 'Twinkle', 1.1, 'arp', { notes: [1, 1.5, 2, 3], noteSeconds: .1, freq: 1200, decay: 10 }],
  ['kazoo', 'Kazoo', .9, 'tone', { freq: 260, freqEnd: 300, decay: 3, partials: [1, 2.1, 3.3], drive: 2 }],
  ['sad-trombone', 'Sad trombone', 1.8, 'tone', { freq: 180, freqEnd: 110, glide: 1.2, decay: 1, partials: [1, 2, 3] }],
  ['record-scratch', 'Record scratch', .5, 'noise', { color: 900, decay: 20, bright: .7, attack: .01 }],
  ['ricochet', 'Ricochet', .45, 'arp', { notes: [1, 1.2, 1.5], noteSeconds: .05, freq: 2000, decay: 25 }],
  ['plink', 'Plink', .6, 'pluck', { freq: 1200, damping: .99, decay: .2 }],
  ['whistle-short', 'Short whistle', .4, 'tone', { freq: 1600, freqEnd: 1900, decay: 6 }],
  ['whistle-long', 'Long whistle', 1.6, 'tone', { freq: 1500, freqEnd: 1700, decay: 3 }],
  ['dun-dun-dun', 'Dun dun dun', 1.6, 'arp', { notes: [1, 1, 1.06], noteSeconds: .45, freq: 196, decay: 1.6 }],
  ['slide-up', 'Slide up', .5, 'tone', { freq: 250, freqEnd: 1100, decay: 10 }],
  ['slide-down', 'Slide down', .9, 'tone', { freq: 800, freqEnd: 150, decay: 4 }],
];

/** Pings, rings and progress cues from messenger and game UIs. */
const ALERTS: Row[] = [
  ['notification', 'Notification', .5, 'chime', { partials: [1, 2, 3], freq: 880, decay: 6 }],
  ['notification-soft', 'Soft notification', .7, 'chime', { partials: [1, 1.5], freq: 660, decay: 4 }],
  ['message', 'Message', 1, 'arp', { notes: [1, 1.26, 1.5], noteSeconds: .14, freq: 700, decay: 5 }],
  ['message-sent', 'Message sent', .3, 'arp', { notes: [1, 1.5], noteSeconds: .06, freq: 1200, decay: 20 }],
  ['email', 'Email', .6, 'arp', { notes: [1, 1.5], noteSeconds: .12, freq: 900, decay: 7 }],
  ['ping', 'Ping', .4, 'chime', { partials: [1], freq: 1400, decay: 9 }],
  ['pong', 'Pong', .5, 'chime', { partials: [1], freq: 900, decay: 7 }],
  ['alert', 'Alert', .9, 'arp', { notes: [1, 1.12, 1], noteSeconds: .18, freq: 880, decay: 4 }],
  ['warning', 'Warning', 1.2, 'tone', { freq: 440, decay: 1.5, partials: [1, 3], attack: .01 }],
  ['error-alert', 'Error alert', 1.1, 'arp', { notes: [1, .94], noteSeconds: .3, freq: 330, decay: 3 }],
  ['success-alert', 'Success alert', 1.2, 'arp', { notes: [1, 1.26, 1.5, 2], noteSeconds: .13, freq: 660, decay: 4 }],
  ['achievement', 'Achievement', 1.8, 'arp', { notes: [1, 1.26, 1.5, 1.5, 2], noteSeconds: .14, freq: 660, decay: 3 }],
  ['level-up', 'Level up', 1.5, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52], noteSeconds: .12, freq: 660, decay: 3 }],
  ['coin', 'Coin', .35, 'chime', { partials: [1, 2.7], freq: 1320, decay: 12 }],
  ['coin-double', 'Coin double', .6, 'arp', { notes: [1, 1.5], noteSeconds: .12, freq: 1568, decay: 10 }],
  ['cash', 'Cash', .5, 'chime', { partials: [1, 2, 3.2], freq: 1100, decay: 9 }],
  ['sonar', 'Sonar', 2, 'tone', { freq: 900, decay: 2.2, vibrato: .01 }],
  ['beep', 'Beep', .2, 'tone', { freq: 1000, decay: 14, partials: [1, 3] }],
  ['beep-double', 'Double beep', .45, 'arp', { notes: [1, 0, 1], noteSeconds: .16, freq: 1000, decay: 12 }],
  ['alarm', 'Alarm', 1.6, 'arp', { notes: [1, 1, 0, 1], noteSeconds: .2, freq: 760, decay: 6 }],
  ['timer', 'Timer', 1, 'arp', { notes: [1, 0, 1, 0], noteSeconds: .14, freq: 1200, decay: 10 }],
  ['clock-tick', 'Clock tick', .3, 'arp', { notes: [1, 0, 1], noteSeconds: .04, freq: 3000, decay: 200 }],
  ['clock-chime', 'Clock chime', 1.4, 'chime', { partials: [1, 2.01, 3.2], freq: 740, decay: 3 }],
  ['ringtone', 'Ringtone', 2, 'arp', { notes: [1, 1, 1.26, 0, 1, 1, 1.26, 0], noteSeconds: .2, freq: 660, decay: 5 }],
  ['chat-ping', 'Chat ping', .5, 'fm', { freq: 1800, ratio: 2, index: 2, decay: 6 }],
  ['chat-pop', 'Chat pop', .22, 'tone', { freq: 700, freqEnd: 1100, decay: 20 }],
  ['reminder', 'Reminder', .9, 'arp', { notes: [1, 1.5, 1], noteSeconds: .25, freq: 520, decay: 3 }],
  ['power-up', 'Power up', .8, 'arp', { notes: [1, 1.5, 2, 3], noteSeconds: .09, freq: 880, decay: 6 }],
  ['achievement-big', 'Big achievement', 2.2, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52, 3], noteSeconds: .12, freq: 587, decay: 2.5 }],
  ['call-ping', 'Call ping', .9, 'chime', { partials: [1, 2.01, 3.01], freq: 1046, decay: 3, beating: 3 }],
];

/** Beds and one-shots: weather, water, fire and wildlife. */
const NATURE: Row[] = [
  ['rain-light', 'Light rain', 5, 'ambience', { color: 2600, freq: 200, wobble: .3, attack: .4, bright: .6 }],
  ['rain-heavy', 'Heavy rain', 6, 'ambience', { color: 3400, freq: 160, wobble: .5, attack: .5, bright: .75 }],
  ['rain-on-roof', 'Rain on roof', 3.2, 'noise', { color: 2400, decay: 3, bright: .7, attack: .2 }],
  ['thunder', 'Thunder', 3.2, 'noise', { color: 320, decay: 1.6, bright: .15, attack: .06 }],
  ['thunder-far', 'Distant thunder', 4, 'noise', { color: 220, decay: 1, bright: .1, attack: .5 }],
  ['wind', 'Wind', 5, 'ambience', { color: 700, freq: 90, wobble: .12, attack: .8 }],
  ['wind-forest', 'Forest wind', 5.5, 'ambience', { color: 1100, freq: 120, wobble: .18, attack: 1, bright: .3 }],
  ['breeze', 'Breeze', 4, 'ambience', { color: 1800, freq: 300, wobble: .3, attack: 1.4, bright: .5 }],
  ['ocean', 'Ocean', 6, 'ambience', { color: 900, freq: 70, wobble: .1, attack: 1.2 }],
  ['waves', 'Waves', 4.5, 'ambience', { color: 800, freq: 60, wobble: .22, attack: .6 }],
  ['stream', 'Stream', 5, 'ambience', { color: 2200, freq: 300, wobble: .25, attack: .5, bright: .5 }],
  ['waterfall', 'Waterfall', 5.5, 'ambience', { color: 2600, freq: 150, wobble: .2, attack: .7, bright: .55 }],
  ['river-rapids', 'River rapids', 4, 'noise', { color: 1800, decay: .5, bright: .6, attack: 1.6 }],
  ['birds', 'Birds', 3, 'arp', { notes: [1, 1.4, 1.1, 1.6, 1.2], noteSeconds: .18, freq: 2200, decay: 9 }],
  ['seagulls', 'Seagulls', 2.6, 'arp', { notes: [1, .9, 1.1], noteSeconds: .3, freq: 1600, decay: 6 }],
  ['owls', 'Owls', 2.4, 'formant', { freq: 120, freqEnd: 150, vowel: [400, 800, 2400], decay: 3 }],
  ['frogs', 'Frogs', 2.4, 'arp', { notes: [1, 1, 0], noteSeconds: .12, freq: 350, decay: 18 }],
  ['crickets', 'Crickets', 4, 'arp', { notes: [1, 1, 0, 1, 1, 0], noteSeconds: .12, freq: 3200, decay: 20 }],
  ['night', 'Night', 5, 'ambience', { color: 600, freq: 70, wobble: .1, attack: 1, bright: .2 }],
  ['forest', 'Forest', 5, 'ambience', { color: 900, freq: 110, wobble: .16, attack: .9, bright: .25 }],
  ['fire', 'Fire', 4, 'ambience', { color: 1500, freq: 130, wobble: .6, attack: .4, bright: .4 }],
  ['fire-crackle', 'Fire crackle', 2.2, 'noise', { color: 2000, decay: 8, bright: .7, attack: .05 }],
  ['campfire', 'Campfire', 4.5, 'ambience', { color: 1200, freq: 110, wobble: .5, attack: .6, bright: .35 }],
  ['cave', 'Cave', 6, 'ambience', { color: 500, freq: 55, wobble: .07, attack: 1.4 }],
  ['underwater', 'Underwater', 5, 'ambience', { color: 400, freq: 80, wobble: .2, attack: 1 }],
  ['meadow', 'Meadow', 5, 'ambience', { color: 1600, freq: 140, wobble: .14, attack: 1, bright: .35 }],
  ['storm', 'Storm', 6, 'ambience', { color: 500, freq: 60, wobble: .3, attack: 1, bright: .3 }],
  ['snow', 'Snow crunch', 2.5, 'noise', { color: 1200, decay: 6, bright: .25, attack: .3 }],
  ['desert-wind', 'Desert wind', 5, 'ambience', { color: 800, freq: 80, wobble: .16, attack: 1.2 }],
  ['jungle', 'Jungle', 4, 'arp', { notes: [1, 1.3, 1.12, 1.5], noteSeconds: .16, freq: 1800, decay: 10 }],
];

/** Machines, lasers and glitches. */
const SCIFI: Row[] = [
  ['laser', 'Laser', .4, 'sweep', { freq: 2400, freqEnd: 300, drive: 1.6 }],
  ['laser-short', 'Short laser', .22, 'sweep', { freq: 1800, freqEnd: 400, drive: 1.5 }],
  ['laser-charge', 'Laser charge', 1.4, 'tone', { freq: 200, freqEnd: 1800, glide: 1.2, vibrato: .12, decay: .5, partials: [1, 2, 3] }],
  ['blaster', 'Blaster', .5, 'sweep', { freq: 1200, freqEnd: 180, drive: 2 }],
  ['teleport', 'Teleport', 1.6, 'sweep', { freq: 300, freqEnd: 2400, drive: 1.3 }],
  ['warp', 'Warp', 2.4, 'sweep', { freq: 80, freqEnd: 1800, drive: 1.4 }],
  ['warp-down', 'Warp down', 1.4, 'sweep', { freq: 1800, freqEnd: 80, drive: 1.4 }],
  ['hologram', 'Hologram', 1.4, 'tone', { freq: 600, freqEnd: 900, vibrato: .04, decay: 2, partials: [1, 2.5] }],
  ['robot', 'Robot', 1, 'arp', { notes: [1, 1.12, 1, 1.26], noteSeconds: .1, freq: 400, decay: 8 }],
  ['servo', 'Servo', .8, 'tone', { freq: 180, freqEnd: 260, vibrato: .08, decay: 5, partials: [1, 3] }],
  ['scan', 'Scan', 1.2, 'arp', { notes: [1, 1.5, 1, 1.5], noteSeconds: .08, freq: 1500, decay: 12 }],
  ['data', 'Data', 1, 'arp', { notes: [1, 1.26, 1.5, 1.68], noteSeconds: .07, freq: 1200, decay: 14 }],
  ['glitch', 'Glitch', .8, 'noise', { color: 3200, bright: .8, decay: 8, attack: .002 }],
  ['computer', 'Computer', .7, 'arp', { notes: [1, 1, 1.26, 1], noteSeconds: .1, freq: 900, decay: 10 }],
  ['power-up-scifi', 'Sci-fi power up', 1.2, 'arp', { notes: [1, 1.5, 2, 3, 4], noteSeconds: .08, freq: 400, decay: 8 }],
  ['power-down', 'Power down', 1.4, 'tone', { freq: 1200, freqEnd: 90, glide: 1.2, decay: .6, partials: [1, 2, 3] }],
  ['force-field', 'Force field', 2, 'tone', { freq: 120, freqEnd: 140, vibrato: .03, decay: 1, partials: [1, 2, 4], attack: .2 }],
  ['energy', 'Energy', 1.2, 'tone', { freq: 300, freqEnd: 700, vibrato: .06, decay: 3, partials: [1, 1.5, 3] }],
  ['shield', 'Shield', 1, 'sweep', { freq: 400, freqEnd: 900, drive: 1.6 }],
  ['spaceship', 'Spaceship', 3, 'ambience', { color: 800, freq: 90, wobble: .2, attack: .8, bright: .5 }],
  ['drone', 'Drone', 4, 'tone', { freq: 110, vibrato: .02, decay: .1, partials: [1, 2, 3, 4], attack: .5 }],
  ['static', 'Static', 2, 'noise', { color: 4000, bright: .85, decay: .1, attack: .05 }],
  ['modem', 'Modem', 1.6, 'arp', { notes: [1, 1.5, 1, 1.26, 1.68], noteSeconds: .12, freq: 1200, decay: 10 }],
  ['cyber', 'Cyber', .9, 'fm', { freq: 700, ratio: 2.5, index: 3, decay: 4 }],
  ['alarm-scifi', 'Sci-fi alarm', 1.4, 'arp', { notes: [1, 1, 0], noteSeconds: .18, freq: 980, decay: 4 }],
  ['door-scifi', 'Sci-fi door', 1.4, 'sweep', { freq: 120, freqEnd: 400, drive: 1.5 }],
  ['ui-scifi', 'Sci-fi UI', .16, 'click', { freq: 2500, decay: 80, noise: .6 }],
  ['telemetry', 'Telemetry', .8, 'arp', { notes: [1, 1.06, 1.12], noteSeconds: .05, freq: 1500, decay: 16 }],
  ['mech-step', 'Mech step', 1.1, 'chime', { partials: [1, 2.2, 3.6], freq: 110, decay: 5, noise: .3 }],
  ['beam', 'Beam', 1.6, 'tone', { freq: 700, freqEnd: 1400, vibrato: .02, decay: 1.5, partials: [1, 2.5], attack: .05 }],
];

/** Stings, chords and solo instruments for emotional beats. */
const MUSIC: Row[] = [
  ['sting-hope', 'Hopeful sting', 2.2, 'arp', { notes: [1, 1.26, 1.5, 2], noteSeconds: .4, freq: 392, decay: 1.4 }],
  ['sting-drama', 'Dramatic sting', 2.4, 'arp', { notes: [1, 1.19, 1.5, 1.5], noteSeconds: .5, freq: 220, decay: 1.2 }],
  ['sting-tension', 'Tense sting', 2.2, 'tone', { freq: 180, freqEnd: 170, vibrato: .02, decay: .8, partials: [1, 2, 3], attack: .02 }],
  ['sting-mystery', 'Mystery sting', 2.6, 'arp', { notes: [1, 1.06, 1.5, 1.06], noteSeconds: .5, freq: 196, decay: 1 }],
  ['sting-comedy', 'Comedy sting', 1.4, 'arp', { notes: [1, 1.26, 1, 1.5], noteSeconds: .18, freq: 523, decay: 3 }],
  ['sting-end', 'Ending sting', 3, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52], noteSeconds: .5, freq: 261, decay: .9 }],
  ['sting-logo', 'Logo sting', 2.8, 'arp', { notes: [1, 1.5, 2, 3], noteSeconds: .5, freq: 330, decay: 1 }],
  ['chord-major', 'Major chord', 3, 'tone', { freq: 261, decay: .8, partials: [1, 1.26, 1.5, 2], attack: .05 }],
  ['chord-minor', 'Minor chord', 3, 'tone', { freq: 220, decay: .8, partials: [1, 1.19, 1.5, 2], attack: .05 }],
  ['chord-sus', 'Suspended chord', 3, 'fm', { freq: 293, ratio: 1.5, index: 1, decay: .8 }],
  ['arp-up', 'Arpeggio up', 1.6, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52, 3], noteSeconds: .12, freq: 261, decay: 5 }],
  ['arp-down', 'Arpeggio down', 1.6, 'arp', { notes: [3, 2.52, 2, 1.5, 1.26, 1], noteSeconds: .12, freq: 261, decay: 5 }],
  ['piano-note', 'Piano note', 2.4, 'chime', { partials: [1, 2, 3, 4, 5], freq: 261, decay: 1.8 }],
  ['piano-chord', 'Piano chord', 3, 'fm', { freq: 261, ratio: 1, index: .8, decay: 1.2 }],
  ['guitar-strum', 'Guitar strum', 1.8, 'pluck', { freq: 196, damping: .995, decay: .04 }],
  ['bass-note', 'Bass note', 2, 'tone', { freq: 82, decay: 1.4, partials: [1, 2, 3] }],
  ['drum-fill', 'Drum fill', .9, 'arp', { notes: [1, 1, 1, 1, 2], noteSeconds: .09, freq: 180, decay: 14 }],
  ['flourish', 'Flourish', 2, 'arp', { notes: [1, 1.5, 2, 2.52, 3, 4], noteSeconds: .13, freq: 392, decay: 3 }],
  ['sad-violin', 'Sad violin', 4, 'tone', { freq: 330, freqEnd: 320, vibrato: .08, decay: .35, partials: [1, 2, 3, 4], attack: .15 }],
  ['happy-jingle', 'Happy jingle', 1.2, 'arp', { notes: [1, 1.25, 1.5, 2, 2.52], noteSeconds: .12, freq: 659, decay: 8 }],
  ['fanfare', 'Fanfare', 2.2, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52], noteSeconds: .18, freq: 392, decay: 1.2 }],
  ['game-over', 'Game over', 2, 'arp', { notes: [1, .84, .7, .53], noteSeconds: .35, freq: 392, decay: 1.5 }],
  ['victory', 'Victory', 2.2, 'arp', { notes: [1, 1.26, 1.5, 2, 2.52, 3], noteSeconds: .16, freq: 523, decay: 1.5 }],
  ['suspense-riser', 'Suspense riser', 4, 'sweep', { freq: 100, freqEnd: 900, drive: 1.1 }],
  ['lofi-chord', 'Lo-fi chord', 3, 'fm', { freq: 174, ratio: 1.5, index: 2, decay: 1.4 }],
  ['synth-lead', 'Synth lead', 1.4, 'tone', { freq: 523, vibrato: .03, decay: .6, partials: [1, 3, 5] }],
  ['synth-pad', 'Synth pad', 4, 'tone', { freq: 130, decay: .05, partials: [1, 1.5, 2, 3], attack: 1 }],
  ['harp-gliss', 'Harp glissando', 2, 'arp', { notes: [1, 1.12, 1.26, 1.5, 1.68, 2], noteSeconds: .08, freq: 523, decay: 18 }],
  ['koto-pluck', 'Koto pluck', 1.6, 'pluck', { freq: 440, damping: .992, decay: .08 }],
  ['orchestral-hit', 'Orchestral hit', 1.5, 'impact', { freq: 200, freqEnd: 60, decay: 2.5, noise: .3 }],
];

/** Camera, hands and props. */
const FOLEY: Row[] = [
  ['shutter', 'Camera shutter', .2, 'click', { freq: 1600, decay: 70, noise: .8 }],
  ['shutter-dslr', 'DSLR shutter', .35, 'impact', { freq: 900, freqEnd: 300, decay: 40, noise: .5 }],
  ['shutter-click', 'Shutter click', .08, 'click', { freq: 1500, decay: 120, noise: .9 }],
  ['focus-beep', 'Focus beep', .16, 'tone', { freq: 1800, decay: 18, partials: [1, 2] }],
  ['flash', 'Flash', .25, 'noise', { bright: .95, color: 7000, decay: 22, attack: .001 }],
  ['film-advance', 'Film advance', .6, 'noise', { color: 1800, decay: 14, bright: .5 }],
  ['camera-roll', 'Camera roll', .9, 'noise', { color: 1200, decay: 8, bright: .35 }],
  ['camera-zoom', 'Camera zoom', 1.2, 'tone', { freq: 400, freqEnd: 700, vibrato: .05, decay: 3, partials: [1, 2] }],
  ['boom-mic-tap', 'Boom mic tap', .6, 'impact', { freq: 260, freqEnd: 120, decay: 30, noise: .3 }],
  ['clap', 'Clap', .25, 'noise', { color: 2400, decay: 28, bright: .6 }],
  ['clapper', 'Clapperboard', .22, 'impact', { freq: 900, freqEnd: 300, decay: 40, noise: .5 }],
  ['footsteps', 'Footsteps', .9, 'arp', { notes: [1, 1, 1], noteSeconds: .28, freq: 120, decay: 30 }],
  ['footstep-grass', 'Grass footsteps', 1, 'arp', { notes: [1, 1, 1], noteSeconds: .3, freq: 90, decay: 34 }],
  ['door-open', 'Door open', 1.1, 'whoosh', { freq: 200, freqEnd: 700 }],
  ['door-close', 'Door close', .8, 'noise', { color: 400, decay: 6, bright: .25, attack: .002 }],
  ['drawer', 'Drawer', 1.2, 'noise', { color: 700, decay: 3, bright: .3 }],
  ['page-turn', 'Page turn', .5, 'noise', { color: 2800, decay: 12, bright: .75 }],
  ['paper', 'Paper', .3, 'noise', { color: 2000, decay: 22, bright: .55 }],
  ['keys', 'Keys', 1.1, 'arp', { notes: [1, 1.2, 1.5, 1.1], noteSeconds: .12, freq: 1600, decay: 16 }],
  ['water-drop', 'Water drop', .5, 'tone', { freq: 1200, freqEnd: 400, decay: 12, partials: [1, 1.5] }],
  ['match-strike', 'Match strike', .35, 'noise', { color: 5000, decay: 16, bright: .9 }],
  ['zipper', 'Zipper', .7, 'noise', { color: 3600, decay: 6, bright: .85 }],
  ['coin-drop', 'Coin drop', .7, 'chime', { partials: [1, 2.4, 3.6], freq: 1100, decay: 8 }],
  ['typewriter', 'Typewriter', .3, 'click', { freq: 900, decay: 55, noise: .7 }],
  ['pen', 'Pen scratch', .45, 'noise', { color: 2200, decay: 6, bright: .55, attack: .01 }],
  ['velcro', 'Velcro', .45, 'noise', { color: 1000, decay: 16, bright: .3 }],
  ['fabric', 'Fabric', .3, 'noise', { color: 2600, decay: 12, bright: .55 }],
  ['lighter', 'Lighter', .4, 'noise', { color: 1400, decay: 8, bright: .6 }],
  ['bottle', 'Bottle', .6, 'tone', { freq: 600, freqEnd: 450, decay: 16, partials: [1, 2.3] }],
  ['glass-clink', 'Glass clink', .4, 'chime', { partials: [1, 2.9, 5.1], freq: 2200, decay: 14 }],
];

/** Every bundled effect, in sidebar order. */
export const SOUND_CATALOG: SoundSpec[] = [
  ...group('ui', INTERFACE),
  ...group('chime', CHIMES),
  ...group('whoosh', WHOOSHES),
  ...group('impact', IMPACTS),
  ...group('cartoon', CARTOON),
  ...group('alert', ALERTS),
  ...group('nature', NATURE),
  ...group('scifi', SCIFI),
  ...group('music', MUSIC),
  ...group('foley', FOLEY),
];

export type SoundId = string;

const RATE = 22050;
const PEAK = .62;
const CACHE_LIMIT = 24;
const cache = new Map<string, string>();

function seedOf(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) { seed ^= id.charCodeAt(i); seed = Math.imul(seed, 16777619); }
  return seed >>> 0;
}

/** Deterministic 22050 Hz mono PCM. The same bytes feed preview and export. */
function render(spec: SoundSpec): Float32Array {
  const count = Math.max(1, Math.ceil(spec.seconds * RATE));
  const output = new Float32Array(count);
  const freq = Math.max(20, spec.freq ?? 440), freqEnd = Math.max(20, spec.freqEnd ?? freq);
  const decay = spec.decay ?? 8, attack = Math.max(.0004, spec.attack ?? .004);
  const drive = Math.max(1, spec.drive ?? 1), noiseAmount = spec.noise ?? 0;
  const bright = Math.min(1, Math.max(0, spec.bright ?? 0));
  const color = Math.min(8000, Math.max(40, spec.color ?? 1200));
  const partials = spec.partials ?? [1, 2, 3], notes = spec.notes ?? [1], noteSeconds = spec.noteSeconds ?? .14;
  const wobble = spec.wobble ?? .18, vibrato = spec.vibrato ?? 0;
  const ratio = spec.ratio ?? 2, index = spec.index ?? 3, beating = spec.beating ?? 0;
  const vowel = spec.vowel ?? [730, 1090, 2440];
  const glide = spec.glide ?? spec.seconds;
  let seed = seedOf(spec.id), phase = 0, low = 0, band = 0, deep = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const alpha = (cutoff: number) => 1 - Math.exp(-2 * Math.PI * Math.min(cutoff, RATE * .45) / RATE);
  const colorAlpha = alpha(color);

  // Karplus-Strong delay line for the pluck engine.
  const pluckLength = Math.max(2, Math.round(RATE / freq));
  const pluckLine = new Float32Array(pluckLength);
  for (let i = 0; i < pluckLength; i++) pluckLine[i] = random();
  let pluckIndex = 0;
  const damping = Math.min(.99999, Math.max(.9, spec.damping ?? .996));

  for (let i = 0; i < count; i++) {
    const time = i / RATE, progress = count > 1 ? i / (count - 1) : 0;
    const attackCurve = Math.min(1, time / attack);
    const white = random();
    let value = 0;
    if (spec.engine === 'click') {
      value = (Math.sin(2 * Math.PI * freq * time) * .7 + white * (noiseAmount || .5)) * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'tone') {
      const pitch = freq * Math.pow(freqEnd / freq, Math.min(1, time / Math.max(.01, glide)));
      phase += 2 * Math.PI * pitch / RATE;
      const modulation = vibrato ? 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * time) : 1;
      let sum = 0;
      partials.forEach((harmonic, order) => { sum += Math.sin(phase * harmonic * modulation + order * .7) / (1 + order * .9); });
      value = (sum + white * noiseAmount * .3) * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'chime') {
      let sum = 0;
      partials.forEach((harmonic, order) => {
        const partial = 2 * Math.PI * freq * harmonic * time;
        sum += (Math.sin(partial) + (beating ? Math.sin(partial + beating * 2 * Math.PI * time) : 0)) * Math.exp(-time * decay * (1 + order * .5)) / (1 + order * .4);
      });
      value = (sum + white * noiseAmount * .3) * attackCurve;
    } else if (spec.engine === 'fm') {
      const pitch = freq * Math.pow(freqEnd / freq, Math.min(1, time / Math.max(.01, glide)));
      phase += 2 * Math.PI * pitch / RATE;
      const modulator = Math.sin(phase * ratio) * Math.exp(-time * decay * .55);
      value = Math.sin(phase + index * modulator) * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'pluck') {
      const sample = pluckLine[pluckIndex];
      const nextIndex = pluckIndex + 1 === pluckLength ? 0 : pluckIndex + 1;
      pluckLine[pluckIndex] = damping * .5 * (sample + pluckLine[nextIndex]);
      pluckIndex = nextIndex;
      value = (sample + Math.sin(2 * Math.PI * freq * time) * .15) * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'formant') {
      const pitch = freq * Math.pow(freqEnd / freq, Math.min(1, time / Math.max(.01, glide)));
      phase += 2 * Math.PI * pitch / RATE;
      const voice = Math.sin(phase) * .5 + Math.sin(2 * phase) * .22 + Math.sin(3 * phase) * .1;
      const formants = vowel.reduce((sum, hz, order) => sum + Math.sin(2 * Math.PI * hz * time) * [.24, .16, .08][order] / (1 + order * .3), 0);
      value = (voice + formants) * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'noise') {
      low += (white - low) * colorAlpha;
      const high = white - low, shaped = low * (1 - bright) + high * bright;
      value = shaped * Math.exp(-time * decay) * attackCurve;
    } else if (spec.engine === 'whoosh') {
      const cutoff = freq * Math.pow(freqEnd / freq, progress), sweepAlpha = alpha(cutoff);
      low += (white - low) * sweepAlpha;
      band += (low - band) * sweepAlpha;
      value = (low - band) * Math.pow(Math.sin(Math.PI * progress), 2) * 2.4 * attackCurve;
    } else if (spec.engine === 'impact') {
      const pitch = freq * Math.pow(freqEnd / freq, Math.min(1, time / Math.max(.01, glide)));
      phase += 2 * Math.PI * pitch / RATE;
      value = (Math.sin(phase) * Math.exp(-time * decay) + white * noiseAmount * Math.exp(-time * 26)) * attackCurve;
    } else if (spec.engine === 'sweep') {
      const pitch = freq * Math.pow(freqEnd / freq, progress);
      phase += 2 * Math.PI * pitch / RATE;
      value = Math.tanh((Math.sin(phase) + .3 * Math.sin(2 * phase)) * drive) * Math.pow(Math.sin(Math.PI * progress), .6) * attackCurve;
    } else if (spec.engine === 'arp') {
      const step = Math.floor(time / noteSeconds), local = time - step * noteSeconds;
      const envelope = Math.exp(-local * decay) * Math.min(1, local * 400);
      value = Math.sin(2 * Math.PI * freq * notes[step % notes.length] * local) * envelope;
    } else {
      low += (white - low) * alpha(color * .35);
      band += (low - band) * alpha(color * .35);
      deep += (band - deep) * alpha(color * .35);
      const movement = .6 + .4 * Math.sin(2 * Math.PI * wobble * time + 1.2);
      const fadeIn = Math.min(1, time / Math.max(.02, attack));
      const fadeOut = Math.min(1, (spec.seconds - time) / Math.max(.06, Math.min(1.2, spec.seconds * .22)));
      value = (deep * 6 + Math.sin(2 * Math.PI * freq * time) * .1 + white * bright * .25) * movement * fadeIn * Math.max(0, fadeOut);
    }
    output[i] = value;
  }

  if (spec.reverse) output.reverse();

  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(output[i]));
  const gain = peak > 0 ? PEAK / peak : 0;
  const fade = Math.min(Math.floor(RATE * .012), Math.floor(count / 4));
  for (let i = 0; i < count; i++) {
    let value = output[i] * gain;
    if (fade > 0 && i >= count - fade) {
      const tail = (count - i) / fade;
      value *= tail * tail * (3 - 2 * tail);
    }
    output[i] = Math.max(-1, Math.min(1, value));
  }
  return output;
}

function wav(samples: Float32Array): string {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const word = (at: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function soundSpec(id: SoundId): SoundSpec | undefined {
  return SOUND_CATALOG.find(effect => effect.id === id);
}

/** Renders (or returns cached) WAV data. Call from clicks, never during render. */
export function soundData(id: SoundId): string {
  const cached = cache.get(id);
  if (cached) { cache.delete(id); cache.set(id, cached); return cached; }
  const spec = soundSpec(id);
  if (!spec) throw new Error(`Unknown sound effect “${id}”.`);
  const data = wav(render(spec));
  cache.set(id, data);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return data;
}

/** Categories matching a search, with their sounds. Empty groups are dropped. */
export function groupedSounds(query = ''): { id: SoundCategoryId; label: string; count: number; sounds: SoundSpec[] }[] {
  const needle = query.trim().toLowerCase();
  return SOUND_CATEGORIES.map(category => {
    const sounds = SOUND_CATALOG.filter(sound => sound.category === category.id && (!needle || sound.label.toLowerCase().includes(needle) || sound.id.includes(needle)));
    return { ...category, count: sounds.length, sounds };
  }).filter(category => category.sounds.length > 0);
}

export function createSoundClip(project: Project, id: SoundId, startTicks: number): AudioClip | null {
  const total = totalTicks(project);
  const spec = soundSpec(id);
  if (!total || !spec) return null;
  const start = Math.round(Math.min(total - 1, Math.max(0, startTicks)));
  const durationTicks = Math.min(total - start, Math.max(1, secondsToTicks(spec.seconds, project.timebase)));
  const lane = Array.from({ length: 8 }, (_, i) => i).find(i => !project.audio.some(clip => (clip.lane ?? 0) === i && clip.startTicks < start + durationTicks && clip.startTicks + clip.durationTicks > start));
  return { id: crypto.randomUUID(), name: spec.label, data: soundData(id), lane: lane ?? 7, startTicks: start, durationTicks, sourceInSeconds: 0, sourceDurationSeconds: spec.seconds, volume: .65, fadeIn: 0, fadeOut: Math.min(.03, ticksToSeconds(durationTicks, project.timebase) / 4) };
}
