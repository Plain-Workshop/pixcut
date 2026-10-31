import { createContext, createElement, useContext, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import type { SavedTrack } from '../stores/online-downloads';
import type { OnlineTrack } from '../stores/online-music';
import type { MusicTrack } from '../stores/music-library';
import type { RecordedSound } from '../stores/sound-library';
import type { SoundId } from '../components/elements/sound-catalog';
import type { TimelineOverlay } from '../components/elements/overlays';
import type { AudioClip, AudioLaneMix, Scene, ScenePatchKey, TextLayer } from '../stores/model';
import type { ResizeCorner } from '../components/preview/transform-handles';
import type { TemplateDefinition } from '../templates/catalog';

/**
 * Everything the editor panels can do to the project or the preview: add and
 * remove media, edit text and elements, drive audio and picture-in-picture,
 * start gestures. `App` assembles it from the hooks that implement each action
 * and the panels call it directly instead of receiving each function as a prop.
 */
export type EditorActions = {
  chooseImages: () => Promise<void>;
  chooseVideo: () => Promise<void>;
  chooseCustomElement: (kind: "image" | "video") => Promise<void>;
  chooseAudio: () => Promise<void>;
  dragOverTarget: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  dropIntoMedia: (event: ReactDragEvent<HTMLElement>) => void;
  beginMediaDrag: (event: ReactDragEvent<HTMLElement>, source: Scene) => void;
  previewMedia: (scene: Scene) => void;
  appendMedia: (scene: Scene) => Promise<void>;
  addMediaPip: (source: Scene) => Promise<void>;
  selectGlobalText: (id: string) => void;
  addProjectText: () => void;
  selectTextLayer: (id: string | null) => void;
  exportCaptions: () => Promise<void>;
  removeFont: (id: string) => void;
  addTextLayerAtPlayhead: (preset?: Partial<TextLayer>) => void;
  hoverLibraryAudio: (id: string, source: string | (() => Promise<string>), start?: number, length?: number, explicit?: boolean) => void;
  stopLibraryPreview: () => void;
  focusAudio: (clip: AudioClip) => void;
  copyMusicCredit: (track: MusicTrack) => Promise<void>;
  addMusic: (track: MusicTrack) => Promise<void>;
  addSavedTrack: (track: SavedTrack) => Promise<void>;
  removeSavedTrack: (key: string) => void;
  addOnlineMusic: (track: OnlineTrack, kind?: 'music' | 'sound_effect') => Promise<void>;
  copyMusicCredits: () => Promise<void>;
  addSound: (id: SoundId, startTicks: number) => Promise<void>;
  addRecordedSound: (sound: RecordedSound, startTicks: number) => Promise<void>;
  chooseTemplate: (template: TemplateDefinition) => void;
  templateImage: (template: TemplateDefinition) => string;
  selectOverlay: (element: TimelineOverlay, seek?: boolean) => void;
  addElement: (presetId: string) => void;
  tip: (id: string, label: string) => string;
  runCommandId: (id: string) => void;
  saveStillFrame: () => Promise<void>;
  togglePreviewFullscreen: () => void;
  beginImagePan: (event: ReactPointerEvent<HTMLElement>) => void;
  beginTextMove: (event: ReactPointerEvent<HTMLElement>) => void;
  beginTextResize: (event: ReactPointerEvent<HTMLElement>, side: "left" | "right") => void;
  beginElementMove: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null) => void;
  beginElementRotate: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null) => void;
  beginElementResize: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null, corner?: ResizeCorner) => void;
  previewInlineText: (next: { title: string; subtitle: string; }) => void;
  blurInlineText: (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null; }) => void;
  cancelInlineText: () => void;
  commitInlineText: () => void;
  shortcutText: (id: string) => string;
  scrubTo: (value: number) => void;
  togglePlayback: () => void;
  removePip: (id: string) => void;
  stagePip: (patch: Partial<Scene>) => void;
  commitPip: () => void;
  stagePipStyle: (key: "x" | "y" | "width" | "height" | "radius" | "shadow", value: number) => void;
  removeAudio: (id: string) => void;
  updateSelection: (next: Scene, force?: ScenePatchKey[], scope?: 'selection' | 'all') => Promise<boolean>;
  copySceneProperties: (source: Scene) => void;
  notifyPasted: () => void;
  inspectorFlush: RefObject<() => void>;
  requestReplaceImage: (sceneId?: string) => void;
  applyFramingToAllFormats: () => Promise<void>;
  reorderLayer: (kind: "text" | "element" | "overlay", id: string, z: number) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  dropLibraryMedia: (event: ReactDragEvent<HTMLElement>) => boolean;
  beginPlayheadDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  removeBeat: (tick: number) => void;
  selectScene: (scene: Scene, event?: ReactMouseEvent, seek?: boolean) => void;
  beginOverlayTiming: (event: ReactPointerEvent<HTMLElement>, element: TimelineOverlay, edge: "move" | "start" | "end") => void;
  beginReorder: (event: ReactDragEvent<HTMLElement>, scene: Scene) => void;
  endReorder: () => void;
  dragOverScene: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  dropScene: (event: ReactDragEvent<HTMLElement>, target: Scene) => void;
  beginFadeDrag: (event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: "in" | "out") => void;
  beginSceneTrim: (event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: "left" | "right") => void;
  setVideoAudioLevel: (volume: number) => void;
  commitMix: () => void;
  stageVideoVolume: (scene: Scene, value: number) => void;
  commitVideoVolume: (scene: Scene, value: number) => void;
  selectPip: (clip: Scene) => void;
  beginPipTiming: (event: ReactPointerEvent<HTMLElement>, clip: Scene, edge: "move" | "start" | "end") => void;
  toggleLaneMute: (lane: number) => void;
  setLaneMix: (lane: number, patch: Partial<Omit<AudioLaneMix, "lane">>) => void;
  beginAudioMove: (event: ReactPointerEvent<HTMLElement>, clip: AudioClip) => void;
  beginAudioTrim: (event: ReactPointerEvent<HTMLElement>, clip: AudioClip, side: "left" | "right") => void;
  stageAudio: (patch: Partial<AudioClip>) => void;
  commitAudio: () => void;
  addBeatAtPlayhead: () => void;
};

const EditorActionsContext = createContext<EditorActions | null>(null);

export function EditorActionsProvider({ value, children }: { value: EditorActions; children?: ReactNode }) {
  return createElement(EditorActionsContext.Provider, { value }, children);
}

export function useEditorActions(): EditorActions {
  const actions = useContext(EditorActionsContext);
  if (!actions) throw new Error('useEditorActions needs an EditorActionsProvider.');
  return actions;
}
