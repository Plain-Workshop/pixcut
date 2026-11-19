import { createStoreKit } from './keyed-store';

/** The transport: whether the story is playing, where the playhead is, and how playback behaves. */
export type PlaybackState = {
  playing: boolean;
  /** Playhead, in seconds. */
  position: number;
  loop: boolean;
  /** 1 forward, -1 reverse. */
  playDirection: 1 | -1;
};

export const INITIAL_PLAYBACK: PlaybackState = { playing: false, position: 0, loop: false, playDirection: 1 };

const kit = createStoreKit('Playback', INITIAL_PLAYBACK);
export const createPlaybackStore = kit.create;
export const PlaybackProvider = kit.Provider;
export const useCreatePlaybackStore = kit.useCreate;
export const usePlayback = kit.useStore;
