import { OnlineMusic } from '../../components/music/OnlineMusic';
import type { OnlineTrack } from '../../stores/online-music';
import { HoverVideo } from '../../components/preview/HoverVideo';
import { MUSIC_TRACKS, MUSIC_LICENSE, MUSIC_MOODS, musicTrackPreviewUrl, musicTrackCredit, type MusicTrack } from '../../stores/music-library';
import { SOUND_CATALOG, soundData, type SoundId } from '../../components/elements/sound-catalog';
import { ElementGlyph } from '../../components/elements/ElementGlyph';
import { ELEMENT_CATALOG, ELEMENT_CATEGORIES, ELEMENT_COLLECTIONS } from '../../components/elements/catalog';
import { elementTransform } from '../../components/elements/transform';
import { constrainPipTiming, freePipStart } from '../../components/timeline/pip';
import { applyElementMotion } from '../../components/animation/keyframes';
import { AssetImage } from '../../components/preview/AssetImage';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { sceneCount, t } from '../../i18n';
import { useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Captions, ArrowRight, Camera, Check, ChevronDown, Clapperboard, Copy, Download, Film, ImagePlus, Layers, LayoutTemplate, Maximize2, Music, Pause, Play, Plus, RefreshCw, Repeat, Search, Settings2, Shapes, SkipBack, Trash2, Type } from 'lucide-react';
import { ElementPreview } from '../../components/elements/ElementPreview';
import { IconButton } from '../../components/IconButton';
import { SceneForm } from '../../components/inspector/SceneForm';
import { MAX_PROJECT_FONTS, minTicks, sceneSeconds, secondsPerTick, secondsToTicks, ticksToSeconds, timecode, type AudioClip, type Command, type Project, type Scene, type ScenePatchKey, type TextLayer, type FormatVariant, type ElementLayer } from '../../stores/model';
import { type ResizeCorner } from '../../components/preview/transform-handles';
import { sceneTextLayers, sceneTextTitle } from '../../components/text/layers';
import { fontOption } from '../../components/text/fonts';
import { messageFor } from '../errors';
import { formatBytes, hasMedia } from '../helpers';
import { type Preferences } from '../../stores/preferences';
import { SAMPLE_TEMPLATE, TEMPLATES, type TemplateDefinition } from '../../templates/catalog';
import type { Dispatch, SetStateAction, ReactElement, RefObject } from 'react';
import type { SoundCategoryId, SoundSpec } from '../../components/elements/sound-catalog';
import type { InspectorKind } from '../inspector';
import type { ElementPreset } from '../../components/elements/catalog';
import { TITLE_PRESETS } from '../title-presets';
import { elementDisplayName } from '../../components/elements/catalog';

export function EditorBody({ addOnlineMusic, libraryWidth, tab, setTab, tabTitles, canEdit, chooseImages, chooseVideo, selectedScene, chooseCustomElement, projectTicks, audioLaneRef, selectedAudio, chooseAudio, setModal, mediaQuery, setMediaQuery, dragOverTarget, dropIntoMedia, filteredScenes, beginMediaDrag, mediaDragRef, setDropTarget, setHoveredMedia, previewMedia, hoveredMedia, playing, modal, project, appendMedia, addMediaPip, setError, sourceMedia, editTarget, selectedGlobalTextId, selectGlobalText, run, setSelectedGlobalTextId, addProjectText, selectedTextLayerId, selectTextLayer, scenes, captionInput, exportCaptions, fontTargetId, fontInput, removeFont, addTextLayerAtPlayhead, audioLibraryTab, setAudioLibraryTab, audio, previewingAudio, hoverLibraryAudio, stopLibraryPreview, focusAudio, musicMood, setMusicMood, copyMusicCredit, addMusic, copyMusicCredits, setNotice, soundQuery, setSoundQuery, soundGroups, openSoundGroup, setOpenSoundGroup, addSound, position, chooseTemplate, templateImage, elementSearch, setElementSearch, setElementLimit, elementCollection, setElementCollection, setElementCategory, elementCategory, allOverlays, selectedElementId, selectOverlay, filteredElements, elementLimit, setHoveredElement, addElement, hoveredElement, preferences, beginResize, tip, safeArea, runCommandId, activeFormat, setActiveFormatId, previewTarget, activeSize, saveStillFrame, togglePreviewFullscreen, previewArea, previewStage, previewSize, preview, sceneVideo, setVideoTick, pipVideoScenes, pipVideoElements, setPipVideoTick, snapGuides, framingMode, beginImagePan, selectedTextLayer, selectedGlobalText, textBox, selectedTextVisible, selectedElement, editingText, beginTextMove, setTextDraft, setEditingText, beginTextResize, overlayDraft, sceneLayerRank, beginElementMove, beginElementRotate, beginElementResize, textDraft, previewInlineText, blurInlineText, cancelInlineText, commitInlineText, fadeAmount, shortcutText, duration, frameSeconds, scrubTo, setPosition, setPlaying, togglePlayback, loop, setLoop, inspectorWidth, selectedPip, propertyKind, selectedCount, setSelectedIds, setPrimarySelected, selectionAnchor, activePip, removePip, pipScenes, stagePip, commitPip, stagePipStyle, removeAudio, audioInspector, elementInspector, selectedTextScene, inspectorScene, updateSelection, setGlobalTextDraft, setPreviewScene, copySceneProperties, propertyClipboard, notifyPasted, inspectorFlush, requestReplaceImage, textStartTicks, textLayerLocal, previewLocalSeconds, textFocus, setFramingMode, applyFramingToAllFormats, renderOverlays, reorderLayer, deleteSelected, hasSceneSelection, duplicateSelected }: {
  libraryWidth: any;
  tab: "media" | "text" | "elements" | "audio" | "templates";
  setTab: Dispatch<SetStateAction<"media" | "text" | "elements" | "audio" | "templates">>;
  tabTitles: { readonly media: "Your media"; readonly text: "Titles"; readonly elements: "Elements"; readonly transitions: "Transitions"; readonly effects: "Effects"; readonly audio: "Audio"; readonly templates: "Templates"; };
  canEdit: boolean;
  chooseImages: () => Promise<void>;
  chooseVideo: () => Promise<void>;
  selectedScene: Scene | undefined;
  chooseCustomElement: (kind: "image" | "video") => Promise<void>;
  projectTicks: number;
  audioLaneRef: RefObject<number>;
  selectedAudio: AudioClip;
  chooseAudio: () => Promise<void>;
  setModal: Dispatch<SetStateAction<"templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  mediaQuery: string;
  setMediaQuery: Dispatch<SetStateAction<string>>;
  dragOverTarget: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  dropIntoMedia: (event: ReactDragEvent<HTMLElement>) => void;
  filteredScenes: Scene[];
  beginMediaDrag: (event: ReactDragEvent<HTMLElement>, source: Scene) => void;
  mediaDragRef: RefObject<Scene | null>;
  setDropTarget: Dispatch<SetStateAction<string | null>>;
  setHoveredMedia: Dispatch<SetStateAction<string | null>>;
  previewMedia: (scene: Scene) => void;
  hoveredMedia: string | null;
  playing: boolean;
  modal: "templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null;
  project: Project;
  appendMedia: (scene: Scene) => Promise<void>;
  addMediaPip: (source: Scene) => Promise<void>;
  setError: Dispatch<SetStateAction<string>>;
  sourceMedia: Scene[];
  editTarget: "text" | "audio" | "scene" | "element";
  selectedGlobalTextId: string | null;
  selectGlobalText: (id: string) => void;
  run: (command: Command) => Promise<boolean>;
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  addProjectText: () => void;
  selectedTextLayerId: string | null;
  selectTextLayer: (id: string | null) => void;
  scenes: Scene[];
  captionInput: RefObject<HTMLInputElement | null>;
  exportCaptions: () => Promise<void>;
  fontTargetId: RefObject<string | null>;
  fontInput: RefObject<HTMLInputElement | null>;
  removeFont: (id: string) => void;
  addTextLayerAtPlayhead: (preset?: Partial<TextLayer>) => void;
  audioLibraryTab: "project" | "music" | "sounds";
  setAudioLibraryTab: Dispatch<SetStateAction<"project" | "music" | "sounds">>;
  audio: AudioClip[];
  previewingAudio: string | null;
  hoverLibraryAudio: (id: string, source: string | (() => Promise<string>), start?: number, length?: number, explicit?: boolean) => void;
  stopLibraryPreview: () => void;
  focusAudio: (clip: AudioClip) => void;
  musicMood: string;
  setMusicMood: Dispatch<SetStateAction<string>>;
  copyMusicCredit: (track: MusicTrack) => Promise<void>;
  addMusic: (track: MusicTrack) => Promise<void>;
  addOnlineMusic: (track: OnlineTrack) => Promise<void>;
  copyMusicCredits: () => Promise<void>;
  setNotice: Dispatch<SetStateAction<string>>;
  soundQuery: string;
  setSoundQuery: Dispatch<SetStateAction<string>>;
  soundGroups: { id: SoundCategoryId; label: string; count: number; sounds: SoundSpec[]; }[];
  openSoundGroup: string | null;
  setOpenSoundGroup: Dispatch<SetStateAction<string | null>>;
  addSound: (id: SoundId, startTicks: number) => Promise<void>;
  position: number;
  chooseTemplate: (template: TemplateDefinition) => void;
  templateImage: (template: TemplateDefinition) => string;
  elementSearch: string;
  setElementSearch: Dispatch<SetStateAction<string>>;
  setElementLimit: Dispatch<SetStateAction<number>>;
  elementCollection: string;
  setElementCollection: Dispatch<SetStateAction<string>>;
  setElementCategory: Dispatch<SetStateAction<string>>;
  elementCategory: string;
  allOverlays: TimelineOverlay[];
  selectedElementId: string | null;
  selectOverlay: (element: TimelineOverlay, seek?: boolean) => void;
  filteredElements: ElementPreset[];
  elementLimit: number;
  setHoveredElement: Dispatch<SetStateAction<string | null>>;
  addElement: (presetId: string) => void;
  hoveredElement: string | null;
  preferences: Preferences;
  beginResize: (kind: "library" | "inspector" | "timeline", start: number, coord: number) => void;
  tip: (id: string, label: string) => string;
  safeArea: boolean;
  runCommandId: (id: string) => void;
  activeFormat: FormatVariant;
  setActiveFormatId: Dispatch<SetStateAction<string | null>>;
  previewTarget: Scene | undefined;
  activeSize: { width: number; height: number; };
  saveStillFrame: () => Promise<void>;
  togglePreviewFullscreen: () => void;
  previewArea: RefObject<HTMLDivElement | null>;
  previewStage: RefObject<HTMLDivElement | null>;
  previewSize: { width: number; height: number; } | null;
  preview: RefObject<HTMLCanvasElement | null>;
  sceneVideo: RefObject<HTMLVideoElement | null>;
  setVideoTick: Dispatch<SetStateAction<number>>;
  pipVideoScenes: Scene[];
  pipVideoElements: RefObject<Map<string, HTMLVideoElement>>;
  setPipVideoTick: Dispatch<SetStateAction<number>>;
  snapGuides: { x: number | null; y: number | null; };
  framingMode: boolean;
  beginImagePan: (event: ReactPointerEvent<HTMLElement>) => void;
  selectedTextLayer: TextLayer;
  selectedGlobalText: TextLayer | null;
  textBox: { hasText: boolean; leftPct: number; topPct: number; widthPct: number; heightPct: number; rotation: number; } | null;
  selectedTextVisible: boolean;
  selectedElement: TimelineOverlay | null;
  editingText: boolean;
  beginTextMove: (event: ReactPointerEvent<HTMLElement>) => void;
  setTextDraft: Dispatch<SetStateAction<{ title: string; subtitle: string; }>>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  beginTextResize: (event: ReactPointerEvent<HTMLElement>, side: "left" | "right") => void;
  overlayDraft: TimelineOverlay | null;
  sceneLayerRank: Map<string, number>;
  beginElementMove: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null) => void;
  beginElementRotate: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null) => void;
  beginElementResize: (event: ReactPointerEvent<HTMLElement>, element?: TimelineOverlay | null, corner?: ResizeCorner) => void;
  textDraft: { title: string; subtitle: string; };
  previewInlineText: (next: { title: string; subtitle: string; }) => void;
  blurInlineText: (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null; }) => void;
  cancelInlineText: () => void;
  commitInlineText: () => void;
  fadeAmount: number;
  shortcutText: (id: string) => string;
  duration: number;
  frameSeconds: number;
  scrubTo: (value: number) => void;
  setPosition: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  togglePlayback: () => void;
  loop: boolean;
  setLoop: Dispatch<SetStateAction<boolean>>;
  inspectorWidth: any;
  selectedPip: Scene | null;
  propertyKind: InspectorKind;
  selectedCount: number;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  activePip: Scene | null;
  removePip: (id: string) => void;
  pipScenes: Scene[];
  stagePip: (patch: Partial<Scene>) => void;
  commitPip: () => void;
  stagePipStyle: (key: "x" | "y" | "width" | "height" | "radius" | "shadow", value: number) => void;
  removeAudio: (id: string) => void;
  audioInspector: ReactElement;
  elementInspector: ReactElement | null;
  selectedTextScene: Scene | null | undefined;
  inspectorScene: Scene | null;
  updateSelection: (next: Scene, force?: ScenePatchKey[]) => Promise<boolean>;
  setGlobalTextDraft: Dispatch<SetStateAction<TextLayer[] | null>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  copySceneProperties: (source: Scene) => void;
  propertyClipboard: Partial<Scene> | null;
  notifyPasted: () => void;
  inspectorFlush: RefObject<() => void>;
  requestReplaceImage: (sceneId?: string) => void;
  textStartTicks: number;
  textLayerLocal: number;
  previewLocalSeconds: number;
  textFocus: number;
  setFramingMode: Dispatch<SetStateAction<boolean>>;
  applyFramingToAllFormats: () => Promise<void>;
  renderOverlays: ElementLayer[];
  reorderLayer: (kind: "text" | "element" | "overlay", id: string, z: number) => void;
  deleteSelected: () => void;
  hasSceneSelection: boolean;
  duplicateSelected: () => void;
}) {
  const [musicSource, setMusicSource] = useState<'bundled' | 'online'>('bundled');
  return (
    <>
      <div className="editor-body">
        <aside className="library" style={{ width: libraryWidth }}>
        <nav className="tool-rail" aria-label="Editor tools">
          <button aria-label="Media" title="Media" className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}><Clapperboard size={20} /><span>{t('Media')}</span></button>
          <button aria-label="Titles" title="Titles" className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Type size={21} /><span>{t('Titles')}</span></button>
          <button aria-label="Elements" title="Elements" className={tab === 'elements' ? 'active' : ''} onClick={() => setTab('elements')}><Shapes size={20} /><span>{t('Elements')}</span></button>
          <button aria-label="Audio" title="Audio" className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><Music size={20} /><span>{t('Audio')}</span></button>
          <button aria-label="Templates" title="Templates" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><LayoutTemplate size={20} /><span>{t('Templates')}</span></button>
        </nav>
      
      
          <div className="panel-title"><h2>{t(tabTitles[tab])}</h2><div className="library-header-actions">
            {tab === 'media' && <><IconButton label="Import images" disabled={!canEdit} onClick={() => void chooseImages()}><ImagePlus size={17} /></IconButton><IconButton label="Import video" disabled={!canEdit} onClick={() => void chooseVideo()}><Film size={17} /></IconButton></>}
            {tab === 'elements' && <><IconButton label={t('Import graphic')} disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('image')}><ImagePlus size={17} /></IconButton><IconButton label={t('Video overlay')} disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('video')}><Layers size={17} /></IconButton></>}
            {tab === 'audio' && <button className="button library-add" disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = selectedAudio?.lane ?? 0; void chooseAudio(); }} title={t('Add audio at playhead')}><Plus size={15} /> {t('Add audio')}</button>}
            {tab === 'templates' && <IconButton label="Browse the full gallery" onClick={() => setModal('templates')}><LayoutTemplate size={17} /></IconButton>}
          </div></div>
      
          {tab === 'media' ? <>
            <label className="search-field"><Search size={14} /><input aria-label="Search project media" placeholder="Search media…" value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} /></label>
            <div className="media-grid" onDragOver={event => dragOverTarget(event, 'media-grid')} onDrop={dropIntoMedia}>{filteredScenes.map(source => <div key={source.id} className="media-tile source-tile" draggable={canEdit && hasMedia(source.image)} onDragStart={event => beginMediaDrag(event, source)} onDragEnd={() => { window.setTimeout(() => { if (mediaDragRef.current?.id === source.id) mediaDragRef.current = null; }, 250); setDropTarget(null); }}>
              <button className="media-source" draggable={canEdit && hasMedia(source.image)} aria-label={`Preview ${source.name}`} onPointerEnter={() => setHoveredMedia(source.id)} onPointerLeave={() => setHoveredMedia(null)} onFocus={() => setHoveredMedia(source.id)} onBlur={() => setHoveredMedia(null)} onClick={() => previewMedia(source)}><div><AssetImage source={source.videoPoster ?? source.image} alt="" fallback={<span className="media-missing"><ImagePlus size={18} /> Missing</span>} />{source.mediaKind === 'video' && <HoverVideo source={source.image} active={hoveredMedia === source.id && !playing && !modal} start={ticksToSeconds(source.sourceInTicks,project.timebase)} duration={sceneSeconds(source,project.timebase)} />}<span>{source.mediaKind === 'video' ? 'VIDEO · ' : ''}{sceneSeconds(source, project.timebase).toFixed(1)}s</span><Play className="source-play" size={20} /></div><span className="media-name">{source.name}</span></button>
              <div className="media-placement"><button title={hasMedia(source.image) ? 'Append to timeline' : 'Relink this file first'} aria-label={`Append ${source.name}`} disabled={!canEdit || !hasMedia(source.image)} onClick={() => void appendMedia(source)}><Plus size={14} /><span>Add</span></button><button title={hasMedia(source.image) ? 'Picture in picture' : 'Relink this file first'} aria-label={`Picture in picture: ${source.name}`} disabled={!canEdit || !selectedScene || !hasMedia(source.image)} onClick={() => void addMediaPip(source).catch(error => setError(messageFor(error)))}><Layers size={14} /></button></div>
            </div>)}</div>
            {!sourceMedia.length && <div className="library-empty"><ImagePlus size={34} /><strong>{t('A story starts with a photo.')}</strong><p>{t('Import images from your device.')}<br />{t('Nothing gets uploaded.')}</p></div>}
            {sourceMedia.length > 0 && !filteredScenes.length && <div className="library-empty"><Search size={30} /><strong>{t('No matching media.')}</strong><p>{t('Try a different name, or clear the search.')}</p></div>}
          </> : tab === 'text' ? <div className="title-library">
            <details className="library-disclosure title-tools"><summary>Layers &amp; text tools <ChevronDown size={14} /></summary><div className="library-disclosure-body">
            <div className="library-item-list" aria-label="Project text layers">
              {Boolean(project.globalText?.length) && <div className="library-label">PROJECT TEXT <span>ALL SCENES</span></div>}
              {(project.globalText ?? []).map((layer, index) => <div className={`project-text-row ${editTarget === 'text' && selectedGlobalTextId === layer.id ? 'active' : ''}`} key={layer.id}>
                <button className="project-text-select" aria-pressed={editTarget === 'text' && selectedGlobalTextId === layer.id} onClick={() => selectGlobalText(layer.id)}><Type size={14} /><span>{layer.title || `Project text ${index + 1}`}</span><small>{ticksToSeconds(layer.startTicks, project.timebase).toFixed(1)} s</small></button>
                <button className="text-button danger" aria-label={`Delete ${layer.title || `Project text ${index + 1}`}`} disabled={!canEdit} onClick={() => void run({ type: 'globalText', layers: (project.globalText ?? []).filter(item => item.id !== layer.id) }).then(ok => { if (ok && selectedGlobalTextId === layer.id) setSelectedGlobalTextId(null); })}><Trash2 size={12} /></button>
              </div>)}
              <button className="button add-project-text" disabled={!canEdit || !projectTicks} onClick={addProjectText}><Plus size={14} /> Add project text</button>
            </div>
            {selectedScene && sceneTextLayers(selectedScene).length > 0 && <div className="library-item-list" aria-label="Text layers in selected scene"><div className="library-label">IN THIS SCENE</div>{sceneTextLayers(selectedScene).map((layer,index) => <button key={layer.id} className={editTarget === 'text' && selectedTextLayerId === layer.id ? 'active' : ''} aria-pressed={editTarget === 'text' && selectedTextLayerId === layer.id} onClick={() => selectTextLayer(layer.id)}><Type size={14} /><span>{layer.title || `Text layer ${index+1}`}</span></button>)}</div>}
      
            <div className="caption-import">
              <div className="caption-import-actions">
                <button className="button" disabled={!canEdit || !scenes.length} onClick={() => captionInput.current?.click()}><Captions size={14} /> Import</button>
                <button className="button" disabled={!canEdit || !scenes.length} onClick={() => void exportCaptions()}><Download size={14} /> Export SRT</button>
              </div>
              <small>Import SRT or WebVTT as editable layers; export every text layer back as subtitles.</small>
            </div>
            <div className="caption-import font-import">
              <button className="button" disabled={!canEdit || (project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS} onClick={() => { fontTargetId.current = null; fontInput.current?.click(); }}><Type size={14} /> Import font</button>
              <small>{project.fonts?.length ? `${project.fonts.length} custom font${project.fonts.length === 1 ? '' : 's'} in the picker` : 'TTF/OTF up to 40 MB · large faces are subsetted'}</small>
            </div>
            {(project.fonts?.length ?? 0) > 0 && <div className="font-list" aria-label="Imported fonts">
              {project.fonts!.map(font => <div className="font-row" key={font.id}>
                <span className="font-row-name"><Type size={12} /><span>{font.name}</span><small>{formatBytes(font.data.length * .75)}</small></span>
                <button className="text-button" aria-label={`Refresh subset for ${font.name}`} title="Choose the original font file to cover the text you have now" disabled={!canEdit} onClick={() => { fontTargetId.current = font.id; fontInput.current?.click(); }}><RefreshCw size={12} /> Refresh</button>
                <button className="text-button danger" aria-label={`Remove ${font.name}`} disabled={!canEdit} onClick={() => removeFont(font.id)}><Trash2 size={12} /></button>
              </div>)}
            </div>}
            </div></details>
            {TITLE_PRESETS.map(preset => <button key={preset.name} className={`title-preset ${preset.id}`} disabled={!selectedScene || !canEdit || sceneTextLayers(selectedScene).length >= 8} onClick={() => addTextLayerAtPlayhead(preset.layer)} aria-label={`Add ${preset.name} title`}>
              <span className="title-preset-art" style={{ fontFamily: fontOption(preset.layer.font ?? 'inter').family }}><span>{preset.sample}</span></span><strong>{preset.name}</strong><Plus size={13} />
            </button>)}
          </div> : tab === 'audio' ? <div className="music-panel">
            <div className="audio-library-tabs" role="tablist" aria-label="Audio library">{([['project','Project'],['music','Music'],['sounds','Sounds']] as const).map(([id,label])=><button key={id} role="tab" aria-selected={audioLibraryTab===id} onClick={()=>setAudioLibraryTab(id)}>{t(label)}</button>)}</div>
            {audioLibraryTab === 'project' ? <>
            {audio.length ? <div className="audio-list">{audio.map(clip => {
              const start = ticksToSeconds(clip.startTicks, project.timebase);
              const length = ticksToSeconds(clip.durationTicks, project.timebase);
              return <div className={`audio-list-item ${editTarget === 'audio' && selectedAudio?.id === clip.id ? 'active' : ''}`} key={clip.id}>
                <button className={`audio-list-select ${previewingAudio === clip.id ? 'previewing' : ''}`} onPointerEnter={() => hoverLibraryAudio(clip.id,clip.data,clip.sourceInSeconds,ticksToSeconds(clip.durationTicks,project.timebase))} onPointerLeave={stopLibraryPreview} onFocus={() => hoverLibraryAudio(clip.id,clip.data,clip.sourceInSeconds,ticksToSeconds(clip.durationTicks,project.timebase))} onBlur={stopLibraryPreview} onClick={() => { focusAudio(clip); hoverLibraryAudio(clip.id,clip.data,clip.sourceInSeconds,ticksToSeconds(clip.durationTicks,project.timebase),true); }}><Music size={15} /><span><strong>{clip.name}</strong><small>{start.toFixed(1)} s · {length.toFixed(1)} s</small></span></button>
              </div>;
            })}</div> : <div className="library-empty music-empty">
              <Music size={34} />
              <strong>Give your story a soundtrack.</strong>
              <p>Add as many audio clips as you need.<br />Stays on this device.</p>
            </div>}
            </> : audioLibraryTab === 'music' ? <div className="free-music-library">
              <div className="music-source-switch" role="tablist" aria-label="Music source">{([['bundled', 'Bundled'], ['online', 'Online']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={musicSource === id} className={musicSource === id ? 'active' : ''} onClick={() => { stopLibraryPreview(); setMusicSource(id); }}>{label}</button>)}</div>
              {musicSource === 'online' ? <OnlineMusic canEdit={canEdit && Boolean(projectTicks)} onAdd={addOnlineMusic} onStopOther={stopLibraryPreview} /> : <>
              <label className="field music-mood">Mood<select aria-label="Music mood" value={musicMood} onChange={event=>setMusicMood(event.target.value)}>{MUSIC_MOODS.map(mood=><option key={mood}>{mood}</option>)}</select></label>
              <div className="free-music-list">{MUSIC_TRACKS.filter(track=>musicMood==='All'||track.mood===musicMood).map((track,index)=><div key={track.id} className={`free-music-track ${previewingAudio===track.id?'previewing':''}`} onPointerEnter={()=>hoverLibraryAudio(track.id,()=>musicTrackPreviewUrl(track))} onPointerLeave={stopLibraryPreview}>
                <button className="music-listen" aria-label={`Listen to ${track.title}`} onFocus={()=>hoverLibraryAudio(track.id,()=>musicTrackPreviewUrl(track))} onBlur={stopLibraryPreview} onClick={()=>hoverLibraryAudio(track.id,()=>musicTrackPreviewUrl(track),0,track.seconds,true)}><Play size={16}/></button>
                <span><strong>{track.title}</strong><small>{track.author} · {track.mood} · {Math.round(track.seconds)}s</small><span className="music-wave" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{height:`${4+Math.abs(Math.sin(i*1.7+index))*13}px`}}/>)}</span></span>
                <button className="icon-button" aria-label={`Copy credit for ${track.title}`} title="Copy the credit line for this track" onClick={()=>void copyMusicCredit(track)}><Copy size={14}/></button>
                <button className="icon-button" aria-label={`Add music ${track.title}`} disabled={!canEdit||!projectTicks} onClick={()=>void addMusic(track)}><Plus size={16}/></button>
              </div>)}</div>
              <details className="library-disclosure music-license"><summary>CC BY 4.0 · credit required</summary><p>Real recordings from Scott Buckley and Ketsa, free for commercial videos when the artist is credited.</p><p>Paste the credit line into your video description. Content ID checks can still fire on any music.</p><div className="music-credits">{MUSIC_TRACKS.map(track=><div key={track.id}><strong>{track.title}</strong><span>{musicTrackCredit(track)}</span></div>)}</div><button className="button" onClick={()=>void copyMusicCredits()}>Copy all credits</button><button className="button" onClick={()=>void navigator.clipboard.writeText(MUSIC_LICENSE).then(()=>setNotice('Music licence copied.')).catch(()=>setError('Could not copy the music licence. It is included in the music folder.'))}>Copy licence</button></details>
              </>}
            </div> : <div className="sound-library">
              <label className="search-field"><Search size={14} /><input aria-label="Search sound effects" placeholder={`Search ${SOUND_CATALOG.length} sounds…`} value={soundQuery} onChange={event => setSoundQuery(event.target.value)} /></label>
              {soundGroups.map(group => {
                const open = Boolean(soundQuery.trim()) || openSoundGroup === group.id;
                return <section className="sound-group" key={group.id}>
                  <button className="sound-group-head" aria-expanded={open} onClick={() => setOpenSoundGroup(openSoundGroup === group.id ? null : group.id)}><span>{group.label}</span><small>{group.count}</small><ChevronDown size={14} /></button>
                  {open && <div className="sound-effect-list">{group.sounds.map(effect => <div key={effect.id} className={previewingAudio === `sfx-${effect.id}` ? 'previewing' : ''}>
                    <button className="icon-button" aria-label={`Listen to ${effect.label}`} onClick={() => hoverLibraryAudio(`sfx-${effect.id}`, soundData(effect.id), 0, effect.seconds, true)}><Play size={13} /></button>
                    <span>{effect.label}</span>
                    <button className="icon-button" aria-label={`Add ${effect.label} at playhead`} disabled={!canEdit || !projectTicks} onClick={() => void addSound(effect.id, secondsToTicks(position, project.timebase))}><Plus size={14} /></button>
                  </div>)}</div>}
                </section>;
              })}
              {!soundGroups.length && <p className="note">No sound matches that search.</p>}
              <p className="note sound-library-note">{SOUND_CATALOG.length} sounds · synthesized on this device</p>
            </div>}
          </div> : tab === 'templates' ? <div className="template-tab">
            <div className="template-tab-list">{TEMPLATES.map(template => <button key={template.id} className="template-tab-card" disabled={!canEdit} onClick={() => chooseTemplate(template)}>
              <span className="template-tab-art"><img src={templateImage(template)} alt="" /></span>
              <span className="template-tab-copy"><strong>{t(template.name)}</strong><small>{template.aspect} · {sceneCount(template.sceneCount)} · {template.duration.toFixed(1)} s</small><span className="template-badges">{template.video && <span className="template-badge video">VIDEO</span>}{template.audio && <span className="template-badge music">MUSIC</span>}</span></span>
              <Plus size={15} />
            </button>)}</div>
      
          </div> : <div className="elements-panel">
            <div className="element-library-tools">
              <label className="element-search"><Search size={15} /><input aria-label="Search elements" placeholder={t('Search {count} elements…', { count: ELEMENT_CATALOG.length })} value={elementSearch} onChange={e => { setElementSearch(e.target.value); setElementLimit(40); }} /></label>
              <select aria-label="Element collection" value={elementCollection} onChange={e => { setElementCollection(e.target.value); setElementCategory('All'); setElementLimit(40); }}><option value="All">{t('All {count} collections', { count: ELEMENT_COLLECTIONS.length })}</option>{ELEMENT_COLLECTIONS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
              <select aria-label="Element category" value={elementCategory} onChange={e => { setElementCategory(e.target.value); setElementCollection('All'); setElementLimit(40); }}>{ELEMENT_CATEGORIES.map(category => <option key={category} value={category}>{category === 'All' ? t('All categories') : t(category)}</option>)}</select>
            </div>
            {allOverlays.length > 0 && <details className="element-list element-project-overlays library-disclosure">
              <summary>{t('In project')} <span>{allOverlays.length}</span></summary>
              {allOverlays.map(element => <button key={element.id} className={`element-list-row ${selectedElementId === element.id ? 'active' : ''}`} onClick={() => selectOverlay(element)}><span className="element-list-row-icon" style={{ color: element.color }}><ElementGlyph presetId={element.presetId} kind={element.kind} size={12} /></span><span>{elementDisplayName(element)}</span><small>{ticksToSeconds(element.startTicks, project.timebase).toFixed(1)}s</small></button>)}
            </details>}
            <div className="element-grid">{filteredElements.slice(0, elementLimit).map(item => <button key={item.id} className="element-card" onPointerEnter={() => setHoveredElement(item.id)} onPointerLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement(item.id)} onBlur={() => setHoveredElement(null)} aria-label={`Add ${item.label}`} disabled={!selectedScene || !canEdit || allOverlays.length >= 64} onClick={() => addElement(item.id)}><span className="element-card-icon"><ElementPreview active={hoveredElement === item.id} presetId={item.id} kind={item.kind} color={item.color} animation={item.animation} reduceMotion={preferences.reduceMotion} /></span><strong>{item.label}</strong><Plus size={12} /></button>)}</div>
            {filteredElements.length === 0 && <p className="note">{t('No matching elements. Try another collection or search.')}</p>}
            {filteredElements.length > elementLimit && <button className="button element-show-more" onClick={() => setElementLimit(n => n + 40)}>{t('Show 40 more')} · {Math.min(elementLimit, filteredElements.length)} / {filteredElements.length}</button>}
      
          </div>}
      
      
        </aside>
      
        <div className="splitter vertical" onPointerDown={e => beginResize('library', libraryWidth, e.clientX)} />
      
        <main className="preview-panel">
          <div className="preview-heading">
            <span>{t('PREVIEW')}</span>
            <div>
              <span className="offline"><span />{t('Local only')}</span>
              <button className="text-button" title={tip('view.safe_area', `Safe area ${safeArea ? 'on' : 'off'}`)} onClick={() => runCommandId('view.safe_area')}>{t('Safe area')} {t(safeArea ? 'on' : 'off')}</button>
              <select aria-label="Output format" value={activeFormat?.id ?? ''} disabled={!canEdit} onChange={event => setActiveFormatId(event.target.value)}>{project.formats.map(format => <option key={format.id} value={format.id}>{format.name} · {format.aspect}</option>)}</select>
              <button className="format-manage-button" onClick={() => setModal('formats')}><Layers size={13} /> {t('Formats')} <span>{project.formats.length}</span></button>
              {previewTarget && <IconButton label={`Save still frame · ${activeSize.width} × ${activeSize.height} PNG`} onClick={() => void saveStillFrame()}><Camera size={15} /></IconButton>}
              <IconButton label="Fullscreen preview" onClick={togglePreviewFullscreen}><Maximize2 size={15} /></IconButton>
            </div>
          </div>
          <div className="preview-area" ref={previewArea}>
            {previewTarget ? <div className="preview-stage" data-dialog-open={Boolean(modal)} inert={Boolean(modal)} ref={previewStage} style={previewSize ? { width: previewSize.width, height: previewSize.height } : undefined}>
              <canvas ref={preview} className="preview-canvas" aria-label={`Preview: ${sceneTextTitle(previewTarget) || previewTarget.name}`} />
              <video ref={sceneVideo} className="scene-video" playsInline preload="auto" aria-hidden="true" onLoadedData={() => setVideoTick(value => value + 1)} onSeeked={() => setVideoTick(value => value + 1)} />
              {pipVideoScenes.map(clip => <video
                key={clip.id}
                ref={node => { if (node) pipVideoElements.current.set(clip.id, node); else pipVideoElements.current.delete(clip.id); }}
                className="scene-video"
                playsInline
                preload="auto"
                muted
                aria-hidden="true"
                onLoadedData={() => setPipVideoTick(value => value + 1)}
                onSeeked={() => setPipVideoTick(value => value + 1)}
              />)}
              {snapGuides.x !== null && <span className="snap-guide vertical" style={{ left: `${snapGuides.x * 100}%` }} aria-hidden="true" />}
              {snapGuides.y !== null && <span className="snap-guide horizontal" style={{ top: `${snapGuides.y * 100}%` }} aria-hidden="true" />}
              {selectedScene && framingMode && canEdit && <div className="image-framing-overlay" onPointerDown={beginImagePan} title="Drag to choose the visible part of the image">
                <span className="framing-grid" aria-hidden="true" />
                <span className="framing-hint">Drag to reposition · adjust zoom and letterbox in the inspector</span>
              </div>}
              {selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && selectedTextVisible && !selectedElement && canEdit && !editingText && !framingMode && <div
                className="text-box"
                style={{ left: `${textBox.leftPct}%`, top: `${Math.max(0, textBox.topPct - .7)}%`, width: `${textBox.widthPct}%`, height: `${Math.max(7, textBox.heightPct + 1.4)}%`, transform: `rotate(${textBox.rotation}deg)` }}
                title="Drag to move · drag the edge handles to resize · double-click to edit"
                onPointerDown={beginTextMove}
                onDoubleClick={event => { event.stopPropagation(); setTextDraft({ title: selectedTextLayer.title, subtitle: selectedTextLayer.subtitle }); setEditingText(true); }}
              >
                <span className="text-box-handle left" onPointerDown={event => beginTextResize(event, 'left')} />
                <span className="text-box-handle right" onPointerDown={event => beginTextResize(event, 'right')} />
                <span className="text-box-label">TEXT</span>
              </div>}
              {canEdit && !framingMode && !editingText && allOverlays.map((saved, index) => {
                const draft = overlayDraft?.id === saved.id ? overlayDraft : saved;
                const local = position - ticksToSeconds(draft.startTicks, project.timebase);
                if (local < 0 || local >= ticksToSeconds(draft.durationTicks, project.timebase)) return null;
                const element = draft;
                const shown = element.keyframes?.length ? applyElementMotion(element, local) : element;
                const motion = elementTransform(shown, local, project.timebase);
                const selected = selectedElementId === element.id;
                const rank = sceneLayerRank.get(element.legacySceneId ? `element:${element.legacyId}` : `overlay:${element.id}`) ?? index;
                return <div key={element.id} role="button" tabIndex={0} aria-label={`Select overlay ${elementDisplayName(element)}`} aria-pressed={selected} className={`overlay-hitbox ${selected ? 'element-box' : ''}`} style={{ left: `${(shown.x + motion.x - shown.width / 2) * 100}%`, top: `${(shown.y + motion.y - shown.height / 2) * 100}%`, width: `${shown.width * 100}%`, height: `${shown.height * 100}%`, transform: `rotate(${shown.rotation + motion.rotation}deg) scale(${motion.scale})`, zIndex: (element.legacySceneId ? 4 : 100) + rank, pointerEvents: playing ? 'none' : undefined }} title={`Drag to move ${elementDisplayName(element)}`} onClick={event => { if (event.detail === 0) selectOverlay(element, false); }} onPointerDown={event => beginElementMove(event, element)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOverlay(element, false); } }}>{selected && <>
                  <span className="element-box-label">{element.kind === 'image' || element.kind === 'video' ? 'OVERLAY' : 'ELEMENT'}</span>
                  <span className="element-rotate-stem" aria-hidden="true" />
                  <span className="element-rotate-handle" title="Drag to rotate · hold Shift to snap to 15°" onPointerDown={event => beginElementRotate(event, element)} />
                  {(['nw', 'ne', 'sw', 'se'] as const).map(corner => <span key={corner} className={`element-handle ${corner}`} title="Drag to resize · hold Shift to keep proportions" onPointerDown={event => beginElementResize(event, element, corner)} />)}
                </>}</div>;
              })}
              {editingText && selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && <div
                className="text-edit-overlay"
                style={{ left: `${Math.min(textBox.leftPct, 56)}%`, top: `${Math.min(textBox.topPct, 42)}%`, width: 'min(340px, 74%)' }}
              >
                <div className="text-edit-head"><span><Type size={12} /> Edit text</span><small>{selectedTextLayer.title ? 'Title and subtitle' : 'Add a title'}</small></div>
                <label className="inline-edit-field"><span>Title</span><textarea aria-label="Edit title in preview" rows={2} maxLength={120} value={textDraft.title} onChange={event => previewInlineText({ ...textDraft, title: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); }} autoFocus /></label>
                <label className="inline-edit-field"><span>Subtitle <em>optional</em></span><input aria-label="Edit subtitle in preview" maxLength={200} value={textDraft.subtitle} onChange={event => previewInlineText({ ...textDraft, subtitle: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); if (event.key === 'Enter') { event.preventDefault(); commitInlineText(); } }} /></label>
                <div className="text-edit-actions"><button className="text-button" onClick={cancelInlineText}>Cancel</button><button className="button primary" onClick={commitInlineText}><Check size={13} /> Done</button></div>
              </div>}
              {fadeAmount > 0.001 && <div className="preview-fade" style={{ opacity: fadeAmount }} aria-hidden="true" />}
              {safeArea && <div className="safe-area-overlay" aria-hidden="true" />}
            </div> : <div className="empty-preview">
              <Film size={40} /><h2>{t('Every story starts somewhere.')}</h2><p>{t('Add a few photos. Make them your own.')}</p>
              <button className="button primary" disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={16} /> {t('Add your first images')}</button>
              <button className="text-button" disabled={!canEdit} onClick={() => chooseTemplate(SAMPLE_TEMPLATE)}>{t('Or explore a sample story')} <ArrowRight size={14} /></button>
            </div>}
          </div>
          <div className="preview-scrub"><input aria-label="Preview playhead" title={`Preview playhead · ${shortcutText('timeline.prev_frame')} / ${shortcutText('timeline.next_frame')} to step frames`} type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
          <div className="preview-controls">
            <span className="timecode">{timecode(position, project.timebase)} <span>/ {timecode(duration, project.timebase)}</span></span>
            <div className="transport"><IconButton label="Return to start" onClick={() => { setPosition(0); setPlaying(false); }}><SkipBack size={17} /></IconButton><button className="play-button" disabled={!duration || !canEdit} title={tip('playback.toggle', playing ? 'Pause' : 'Play')} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><IconButton className={loop ? 'active' : ''} label={loop ? 'Loop playback on' : 'Loop playback off'} onClick={() => setLoop(value => !value)}><Repeat size={16} /></IconButton></div>
            <span className="preview-quality">{([activeSize.width, activeSize.height] as [number, number]).join(' × ')} <Maximize2 size={13} /></span>
          </div>
        </main>
      
        <div className="splitter vertical" onPointerDown={e => beginResize('inspector', inspectorWidth, e.clientX)} />
      
        <aside className="inspector" aria-label="Selected item properties" style={{ width: inspectorWidth }}>
          <div className="inspector-heading"><Settings2 size={16} /><h2>{selectedPip ? t('Picture in picture') : t(({scene: selectedScene?.mediaKind === 'video' ? 'Video properties' : 'Scene properties', text:'Text properties', element:'Element properties', audio:'Audio properties', none:'Properties'})[propertyKind])}</h2></div>
          {propertyKind === 'scene' && selectedCount > 1 && <div className="multi-select-banner"><span><Layers size={13} /> Editing {selectedCount} clips</span><button className="text-button" onClick={() => { if(selectedScene){setSelectedIds([selectedScene.id]);setPrimarySelected(selectedScene.id);selectionAnchor.current=selectedScene.id;} }}>Edit only this clip</button></div>}
          {selectedPip && activePip && activePip.pip ? <fieldset disabled={!canEdit} className="inspector-fields">
            <div className="inspector-item-actions"><strong>{activePip.name}</strong><button className="icon-button danger" aria-label="Delete picture in picture" onClick={() => removePip(activePip.id)}><Trash2 size={15} /></button></div>
            <p className="note">Its own visual track over the base story. It never extends the timeline and its own audio is muted.</p>
            <label className="music-control"><span>Start <b>{ticksToSeconds(activePip.startTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Picture-in-picture start" type="range" min={0} max={Math.max(0, ticksToSeconds(projectTicks - activePip.durationTicks, project.timebase))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.startTicks, project.timebase)} onChange={event => { const desired = secondsToTicks(Number(event.target.value), project.timebase); const start = freePipStart(pipScenes.filter(clip => clip.id !== activePip.id), desired, activePip.durationTicks, projectTicks); if (start !== null) stagePip({ startTicks: start }); }} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Duration <b>{ticksToSeconds(activePip.durationTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Picture-in-picture duration" type="range" min={Math.max(secondsPerTick(project.timebase), ticksToSeconds(minTicks(project.timebase), project.timebase))} max={Math.max(secondsPerTick(project.timebase), Math.min(ticksToSeconds(projectTicks - activePip.startTicks, project.timebase), activePip.sourceDurationSeconds ?? 600))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.durationTicks, project.timebase)} onChange={event => { const wanted = secondsToTicks(Number(event.target.value), project.timebase); stagePip(constrainPipTiming(activePip, 'end', wanted - activePip.durationTicks, pipScenes, projectTicks, project.timebase, minTicks(project.timebase))); }} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Width <b>{Math.round(activePip.pip.width * 100)}%</b></span><input aria-label="Picture-in-picture width" type="range" min={5} max={100} step={1} value={Math.round(activePip.pip.width * 100)} onChange={event => stagePipStyle('width', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Height <b>{Math.round(activePip.pip.height * 100)}%</b></span><input aria-label="Picture-in-picture height" type="range" min={5} max={100} step={1} value={Math.round(activePip.pip.height * 100)} onChange={event => stagePipStyle('height', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Horizontal <b>{Math.round(activePip.pip.x * 100)}%</b></span><input aria-label="Picture-in-picture horizontal" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.x * 100)} onChange={event => stagePipStyle('x', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Vertical <b>{Math.round(activePip.pip.y * 100)}%</b></span><input aria-label="Picture-in-picture vertical" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.y * 100)} onChange={event => stagePipStyle('y', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Corner radius <b>{Math.round(activePip.pip.radius * 100)}%</b></span><input aria-label="Picture-in-picture corner radius" type="range" min={0} max={50} step={1} value={Math.round(activePip.pip.radius * 100)} onChange={event => stagePipStyle('radius', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="music-control"><span>Shadow <b>{Math.round(activePip.pip.shadow)}%</b></span><input aria-label="Picture-in-picture shadow" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.shadow)} onChange={event => stagePipStyle('shadow', Number(event.target.value))} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
            <label className="field">Fill<select aria-label="Picture-in-picture fill" value={activePip.fit} onChange={event => { stagePip({ fit: event.target.value as Scene['fit'] }); window.setTimeout(commitPip, 0); }}><option value="cover">{t('Fill frame')}</option><option value="contain">{t('Fit whole image')}</option><option value="blur">{t('Blur fill')}</option></select></label>
          </fieldset> : propertyKind === 'audio' && selectedAudio ? <fieldset disabled={!canEdit} className="inspector-fields"><div className="inspector-item-actions"><strong>{selectedAudio.name}</strong><button className="icon-button danger" aria-label="Delete selected audio" onClick={() => removeAudio(selectedAudio.id)}><Trash2 size={15} /></button></div>{audioInspector}</fieldset> : propertyKind === 'element' ? <fieldset disabled={!canEdit} className="inspector-fields">{elementInspector}</fieldset> : (propertyKind === 'scene' || propertyKind === 'text') && selectedScene ? <fieldset disabled={!canEdit} className="inspector-fields">
            <SceneForm reduceMotion={preferences.reduceMotion} mode={propertyKind === 'text' ? 'text' : 'scene'} hasNextScene={Boolean(selectedScene && scenes.findIndex(scene => scene.id === selectedScene.id) < scenes.length - 1)} scene={selectedGlobalText && selectedTextScene ? selectedTextScene : inspectorScene!} timebase={project.timebase} update={updateSelection} onPreview={selectedGlobalText ? (next: Scene | null) => setGlobalTextDraft(next?.textLayers ?? null) : setPreviewScene} onCopyProperties={copySceneProperties} propertyClipboard={propertyClipboard} onPasteProperties={notifyPasted} flushRef={inspectorFlush} onReplaceImage={selectedCount === 1 && !selectedGlobalText ? () => requestReplaceImage() : undefined} textLayerId={selectedGlobalText ? selectedGlobalText.id : selectedTextLayerId} onSelectTextLayer={selectTextLayer} textStartTicks={textStartTicks} playheadSeconds={selectedGlobalText ? Math.max(0, textLayerLocal) : previewLocalSeconds} focusText={textFocus} framingActive={framingMode} onToggleFraming={() => { setFramingMode(value => !value); setEditingText(false); }} formatName={activeFormat?.name ?? 'Original'} formatCount={project.formats.length} onApplyFramingToAll={applyFramingToAllFormats} overlays={renderOverlays} onReorderLayer={reorderLayer} />
            {propertyKind === 'text' && <div className="inspector-item-actions"><button className="button danger" aria-label="Delete selected text layer" onClick={deleteSelected}><Trash2 size={14} /> Delete text layer</button></div>}
            {propertyKind === 'scene' && hasSceneSelection && <div className="scene-actions compact-scene-actions"><IconButton label={tip('clip.duplicate', 'Duplicate clip')} onClick={duplicateSelected}><Copy size={16} /></IconButton><IconButton label={tip('clip.delete', 'Delete selected scene')} onClick={deleteSelected}><Trash2 size={16} /></IconButton></div>}
          </fieldset> : <div className="inspector-empty"><Settings2 size={26} /><p>Select a scene, text layer, element or audio clip to edit its properties.</p></div>}
      
        </aside>
      </div>
    </>
  );
}
