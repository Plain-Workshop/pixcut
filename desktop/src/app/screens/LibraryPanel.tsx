import { DownloadedMusic } from '../../components/music/DownloadedMusic';
import { findSavedTrack, type SavedTrack } from '../../stores/online-downloads';
import { OnlineMusic } from '../../components/music/OnlineMusic';
import { HoverVideo } from '../../components/preview/HoverVideo';
import { MUSIC_TRACKS, MUSIC_LICENSE, MUSIC_MOODS, musicTrackPreviewUrl, musicTrackCredit } from '../../stores/music-library';
import { searchRecordedSounds, recordedSoundData, creditForRecordedClip, recordedSoundClipName, type RecordedSound } from '../../stores/sound-library';
import { SOUND_CATALOG, soundData, groupedSounds } from '../../components/elements/sound-catalog';
import { ElementGlyph } from '../../components/elements/ElementGlyph';
import { ELEMENT_CATALOG, ELEMENT_CATEGORIES, ELEMENT_COLLECTIONS } from '../../components/elements/catalog';
import { AssetImage } from '../../components/preview/AssetImage';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { fontCount, sceneCount, t } from '../../i18n';
import { useMemo, useState } from 'react';
import { useLibraryState, filterElements } from '../library-store';
import { Captions, ChevronDown, Clapperboard, Copy, Download, Film, ImagePlus, Layers, LayoutTemplate, Music, Pause, Play, Plus, RefreshCw, Search, Shapes, Trash2, Type } from 'lucide-react';
import { ElementPreview } from '../../components/elements/ElementPreview';
import { IconButton } from '../../components/IconButton';
import { useLayout } from '../layout-store';
import { useEditorActions } from '../editor-actions';
import { useEditorModel } from '../editor-model';
import { useEditorView } from '../editor-view';
import { useSelection } from '../selection-store';
import { MAX_PROJECT_FONTS, sceneSeconds, secondsToTicks, ticksToSeconds, type AudioClip, type Scene } from '../../stores/model';
import { sceneTextLayers } from '../../components/text/layers';
import { fontOption } from '../../components/text/fonts';
import { messageFor } from '../errors';
import { formatBytes, hasMedia } from '../helpers';
import { TEMPLATES } from '../../templates/catalog';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { TITLE_PRESETS } from '../title-presets';
import { elementDisplayName } from '../../components/elements/catalog';

export function LibraryPanel({tab, setTab, tabTitles, audioLaneRef, selectedAudio, setModal, mediaDragRef, setDropTarget, playing, modal, sourceMedia, setSelectedGlobalTextId, captionInput, fontTargetId, fontInput, previewingAudio, savedTracks, recordedSounds, position, allOverlays}: {
  tab: "media" | "text" | "elements" | "audio" | "templates";
  setTab: Dispatch<SetStateAction<"media" | "text" | "elements" | "audio" | "templates">>;
  tabTitles: { readonly media: "Your media"; readonly text: "Titles"; readonly elements: "Elements"; readonly transitions: "Transitions"; readonly effects: "Effects"; readonly audio: "Audio"; readonly templates: "Templates"; };
  audioLaneRef: RefObject<number>;
  selectedAudio: AudioClip;
  setModal: Dispatch<SetStateAction<"templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  mediaDragRef: RefObject<Scene | null>;
  setDropTarget: Dispatch<SetStateAction<string | null>>;
  playing: boolean;
  modal: "templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null;
  sourceMedia: Scene[];
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  captionInput: RefObject<HTMLInputElement | null>;
  fontTargetId: RefObject<string | null>;
  fontInput: RefObject<HTMLInputElement | null>;
  previewingAudio: string | null;
  savedTracks: SavedTrack[];
  recordedSounds: RecordedSound[];
  position: number;
  allOverlays: TimelineOverlay[];
}) {
  const { mediaQuery, hoveredMedia, audioLibraryTab, musicMood, soundQuery, openSoundGroup, elementSearch, elementCategory, elementCollection, elementLimit, hoveredElement, setMediaQuery, setHoveredMedia, setAudioLibraryTab, setMusicMood, setSoundQuery, setOpenSoundGroup, setElementSearch, setElementCategory, setElementCollection, setElementLimit, setHoveredElement } = useLibraryState();
  const soundGroups = useMemo(() => groupedSounds(soundQuery), [soundQuery]);
  const filteredElements = useMemo(() => filterElements(ELEMENT_CATALOG, { elementCategory, elementCollection, elementSearch }), [elementCategory, elementCollection, elementSearch]);
  const filteredScenes = useMemo(() => sourceMedia.filter(scene => scene.name.toLowerCase().includes(mediaQuery.trim().toLowerCase())), [sourceMedia, mediaQuery]);
  const { canEdit, projectTicks, project, setError, run, scenes, audio, setNotice, preferences } = useEditorModel();
  const { selectedScene } = useEditorView();
  const { selectedGlobalTextId, selectedTextLayerId, editTarget, selectedElementId } = useSelection();
  const { chooseImages, chooseVideo, chooseCustomElement, chooseAudio, dragOverTarget, dropIntoMedia, beginMediaDrag, previewMedia, appendMedia, addMediaPip, selectGlobalText, addProjectText, selectTextLayer, exportCaptions, removeFont, addTextLayerAtPlayhead, hoverLibraryAudio, stopLibraryPreview, focusAudio, copyMusicCredit, addMusic, addSavedTrack, removeSavedTrack, addOnlineMusic, copyMusicCredits, addSound, addRecordedSound, chooseTemplate, templateImage, selectOverlay, addElement } = useEditorActions();
  const { libraryWidth, beginResize } = useLayout();
  const recordedGroups = searchRecordedSounds(recordedSounds, soundQuery);
  const [musicSource, setMusicSource] = useState<'bundled' | 'online' | 'saved'>('bundled');
  const [soundSource, setSoundSource] = useState<'bundled' | 'online' | 'saved'>('bundled');
  return (
    <>
        <aside className="library" style={{ width: libraryWidth }}>
        <nav className="tool-rail" aria-label={t('Editor tools')}>
          <button aria-label={t('Media')} title={t('Media')} className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}><Clapperboard size={20} /><span>{t('Media')}</span></button>
          <button aria-label={t('Titles')} title={t('Titles')} className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Type size={21} /><span>{t('Titles')}</span></button>
          <button aria-label={t('Elements')} title={t('Elements')} className={tab === 'elements' ? 'active' : ''} onClick={() => setTab('elements')}><Shapes size={20} /><span>{t('Elements')}</span></button>
          <button aria-label={t('Audio')} title={t('Audio')} className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><Music size={20} /><span>{t('Audio')}</span></button>
          <button aria-label={t('Templates')} title={t('Templates')} className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><LayoutTemplate size={20} /><span>{t('Templates')}</span></button>
        </nav>
      
      
          <div className="panel-title"><h2>{t(tabTitles[tab])}</h2><div className="library-header-actions">
            {tab === 'media' && <><IconButton label="Import images" disabled={!canEdit} onClick={() => void chooseImages()}><ImagePlus size={17} /></IconButton><IconButton label="Import video" disabled={!canEdit} onClick={() => void chooseVideo()}><Film size={17} /></IconButton></>}
            {tab === 'elements' && <><IconButton label={t('Import graphic')} disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('image')}><ImagePlus size={17} /></IconButton><IconButton label={t('Video overlay')} disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('video')}><Layers size={17} /></IconButton></>}
            {tab === 'audio' && <button className="button library-add" disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = selectedAudio?.lane ?? 0; void chooseAudio(); }} title={t('Add audio at playhead')}><Plus size={15} /> {t('Add audio')}</button>}
            {tab === 'templates' && <IconButton label="Browse the full gallery" onClick={() => setModal('templates')}><LayoutTemplate size={17} /></IconButton>}
          </div></div>
      
          {tab === 'media' ? <>
            <label className="search-field"><Search size={14} /><input aria-label={t('Search project media')} placeholder={t('Search media…')} value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} /></label>
            <div className="media-grid" onDragOver={event => dragOverTarget(event, 'media-grid')} onDrop={dropIntoMedia}>{filteredScenes.map(source => <div key={source.id} className="media-tile source-tile" draggable={canEdit && hasMedia(source.image)} onDragStart={event => beginMediaDrag(event, source)} onDragEnd={() => { window.setTimeout(() => { if (mediaDragRef.current?.id === source.id) mediaDragRef.current = null; }, 250); setDropTarget(null); }}>
              <button className="media-source" draggable={canEdit && hasMedia(source.image)} aria-label={t('Preview {name}', { name: source.name })} onPointerEnter={() => setHoveredMedia(source.id)} onPointerLeave={() => setHoveredMedia(null)} onFocus={() => setHoveredMedia(source.id)} onBlur={() => setHoveredMedia(null)} onClick={() => previewMedia(source)}><div><AssetImage source={source.videoPoster ?? source.image} alt="" fallback={<span className="media-missing"><ImagePlus size={18} /> Missing</span>} />{source.mediaKind === 'video' && <HoverVideo source={source.image} active={hoveredMedia === source.id && !playing && !modal} start={ticksToSeconds(source.sourceInTicks,project.timebase)} duration={sceneSeconds(source,project.timebase)} />}<span>{source.mediaKind === 'video' ? 'VIDEO · ' : ''}{sceneSeconds(source, project.timebase).toFixed(1)}s</span><Play className="source-play" size={20} /></div><span className="media-name">{source.name}</span></button>
              <div className="media-placement"><button title={hasMedia(source.image) ? 'Append to timeline' : 'Relink this file first'} aria-label={t('Append {name}', { name: source.name })} disabled={!canEdit || !hasMedia(source.image)} onClick={() => void appendMedia(source)}><Plus size={14} /><span>Add</span></button><button title={hasMedia(source.image) ? 'Picture in picture' : 'Relink this file first'} aria-label={t('Picture in picture: {name}', { name: source.name })} disabled={!canEdit || !selectedScene || !hasMedia(source.image)} onClick={() => void addMediaPip(source).catch(error => setError(messageFor(error)))}><Layers size={14} /></button></div>
            </div>)}</div>
            {!sourceMedia.length && <div className="library-empty"><ImagePlus size={34} /><strong>{t('A story starts with a photo.')}</strong><p>{t('Import images from your device.')}<br />{t('Nothing gets uploaded.')}</p></div>}
            {sourceMedia.length > 0 && !filteredScenes.length && <div className="library-empty"><Search size={30} /><strong>{t('No matching media.')}</strong><p>{t('Try a different name, or clear the search.')}</p></div>}
          </> : tab === 'text' ? <div className="title-library">
            <details className="library-disclosure title-tools"><summary>Layers &amp; text tools <ChevronDown size={14} /></summary><div className="library-disclosure-body">
            <div className="library-item-list" aria-label={t('Project text layers')}>
              {Boolean(project.globalText?.length) && <div className="library-label">PROJECT TEXT <span>{t('ALL SCENES')}</span></div>}
              {(project.globalText ?? []).map((layer, index) => <div className={`project-text-row ${editTarget === 'text' && selectedGlobalTextId === layer.id ? 'active' : ''}`} key={layer.id}>
                <button className="project-text-select" aria-pressed={editTarget === 'text' && selectedGlobalTextId === layer.id} onClick={() => selectGlobalText(layer.id)}><Type size={14} /><span>{layer.title || `Project text ${index + 1}`}</span><small>{ticksToSeconds(layer.startTicks, project.timebase).toFixed(1)} s</small></button>
                <button className="text-button danger" aria-label={t('Delete {name}', { name: layer.title || t('Project text {number}', { number: index + 1 }) })} disabled={!canEdit} onClick={() => void run({ type: 'globalText', layers: (project.globalText ?? []).filter(item => item.id !== layer.id) }).then(ok => { if (ok && selectedGlobalTextId === layer.id) setSelectedGlobalTextId(null); })}><Trash2 size={12} /></button>
              </div>)}
              <button className="button add-project-text" disabled={!canEdit || !projectTicks} onClick={addProjectText}><Plus size={14} /> Add project text</button>
            </div>
            {selectedScene && sceneTextLayers(selectedScene).length > 0 && <div className="library-item-list" aria-label={t('Text layers in selected scene')}><div className="library-label">{t('IN THIS SCENE')}</div>{sceneTextLayers(selectedScene).map((layer,index) => <button key={layer.id} className={editTarget === 'text' && selectedTextLayerId === layer.id ? 'active' : ''} aria-pressed={editTarget === 'text' && selectedTextLayerId === layer.id} onClick={() => selectTextLayer(layer.id)}><Type size={14} /><span>{layer.title || `Text layer ${index+1}`}</span></button>)}</div>}
      
            <div className="caption-import">
              <div className="caption-import-actions">
                <button className="button" disabled={!canEdit || !scenes.length} onClick={() => captionInput.current?.click()}><Captions size={14} /> Import</button>
                <button className="button" disabled={!canEdit || !scenes.length} onClick={() => void exportCaptions()}><Download size={14} /> Export SRT</button>
              </div>
              <small>Import SRT or WebVTT as editable layers; export every text layer back as subtitles.</small>
            </div>
            <div className="caption-import font-import">
              <button className="button" disabled={!canEdit || (project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS} onClick={() => { fontTargetId.current = null; fontInput.current?.click(); }}><Type size={14} /> Import font</button>
              <small>{project.fonts?.length ? t('{fonts} in the picker', { fonts: fontCount(project.fonts.length) }) : t('TTF/OTF up to 40 MB · large faces are subsetted')}</small>
            </div>
            {(project.fonts?.length ?? 0) > 0 && <div className="font-list" aria-label={t('Imported fonts')}>
              {project.fonts!.map(font => <div className="font-row" key={font.id}>
                <span className="font-row-name"><Type size={12} /><span>{font.name}</span><small>{formatBytes(font.data.length * .75)}</small></span>
                <button className="text-button" aria-label={t('Refresh subset for {name}', { name: font.name })} title={t('Choose the original font file to cover the text you have now')} disabled={!canEdit} onClick={() => { fontTargetId.current = font.id; fontInput.current?.click(); }}><RefreshCw size={12} /> Refresh</button>
                <button className="text-button danger" aria-label={t('Remove {name}', { name: font.name })} disabled={!canEdit} onClick={() => removeFont(font.id)}><Trash2 size={12} /></button>
              </div>)}
            </div>}
            </div></details>
            {TITLE_PRESETS.map(preset => <button key={preset.name} className={`title-preset ${preset.id}`} disabled={!selectedScene || !canEdit || sceneTextLayers(selectedScene).length >= 8} onClick={() => addTextLayerAtPlayhead(preset.layer)} aria-label={t('Add {name} title', { name: preset.name })}>
              <span className="title-preset-art" style={{ fontFamily: fontOption(preset.layer.font ?? 'inter').family }}><span>{preset.sample}</span></span><strong>{preset.name}</strong><Plus size={13} />
            </button>)}
          </div> : tab === 'audio' ? <div className="music-panel">
            <div className="audio-library-tabs" role="tablist" aria-label={t('Audio library')}>{([['project','Project'],['music','Music'],['sounds','Sounds']] as const).map(([id,label])=><button key={id} role="tab" aria-selected={audioLibraryTab===id} onClick={()=>setAudioLibraryTab(id)}>{t(label)}</button>)}</div>
            {audioLibraryTab === 'project' ? <>
            {audio.length ? <div className="audio-list">{audio.map(clip => {
              const start = ticksToSeconds(clip.startTicks, project.timebase);
              const length = ticksToSeconds(clip.durationTicks, project.timebase);
              return <div className={`audio-list-item ${editTarget === 'audio' && selectedAudio?.id === clip.id ? 'active' : ''}`} key={clip.id}>
                <button className={`audio-list-select ${previewingAudio === clip.id ? 'previewing' : ''}`} onClick={() => focusAudio(clip)}><Music size={15} /><span><strong>{clip.name}</strong><small>{start.toFixed(1)} s · {length.toFixed(1)} s</small></span></button>
                <button className="icon-button audio-list-play" aria-label={previewingAudio === clip.id ? t('Pause {name}', { name: clip.name }) : t('Play {name}', { name: clip.name })} aria-pressed={previewingAudio === clip.id} onClick={() => previewingAudio === clip.id ? stopLibraryPreview() : hoverLibraryAudio(clip.id,clip.data,clip.sourceInSeconds,ticksToSeconds(clip.durationTicks,project.timebase),true)}>{previewingAudio === clip.id ? <Pause size={14} /> : <Play size={14} />}</button>
              </div>;
            })}</div> : <div className="library-empty music-empty">
              <Music size={34} />
              <strong>{t('Give your story a soundtrack.')}</strong>
              <p>{t('Add as many audio clips as you need.')}<br />{t('Stays on this device.')}</p>
            </div>}
            </> : audioLibraryTab === 'music' ? <div className="free-music-library">
              <div className="music-source-switch" role="tablist" aria-label={t('Music source')}>{([['bundled', 'Bundled'], ['online', 'Online'], ['saved', `Downloaded${savedTracks.some(track => track.kind === 'music') ? ` (${savedTracks.filter(track => track.kind === 'music').length})` : ''}`]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={musicSource === id} className={musicSource === id ? 'active' : ''} onClick={() => { stopLibraryPreview(); setMusicSource(id); }}>{label}</button>)}</div>
              {musicSource === 'saved' ? <DownloadedMusic tracks={savedTracks.filter(track => track.kind === 'music')} canEdit={canEdit && Boolean(projectTicks)} onAdd={addSavedTrack} onRemove={removeSavedTrack} onStopOther={stopLibraryPreview} /> : musicSource === 'online' ? <OnlineMusic canEdit={canEdit && Boolean(projectTicks)} onAdd={addOnlineMusic} onStopOther={stopLibraryPreview} isDownloaded={track => Boolean(findSavedTrack(savedTracks, track))} /> : <>
              <label className="field music-mood">{t('Mood')}<select aria-label={t('Music mood')} value={musicMood} onChange={event=>setMusicMood(event.target.value)}>{MUSIC_MOODS.map(mood=><option key={mood}>{mood}</option>)}</select></label>
              <div className="free-music-list">{MUSIC_TRACKS.filter(track=>musicMood==='All'||track.mood===musicMood).map((track,index)=><div key={track.id} className={`free-music-track ${previewingAudio===track.id?'previewing':''}`}>
                <button className="music-listen" aria-label={previewingAudio === track.id ? t('Pause {name}', { name: track.title }) : t('Play {name}', { name: track.title })} aria-pressed={previewingAudio===track.id} onClick={()=>previewingAudio===track.id?stopLibraryPreview():hoverLibraryAudio(track.id,()=>musicTrackPreviewUrl(track),0,track.seconds,true)}>{previewingAudio===track.id?<Pause size={16}/>:<Play size={16}/>}</button>
                <span><strong>{track.title}</strong><small>{track.author} · {track.mood} · {Math.round(track.seconds)}s</small><span className="music-wave" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{height:`${4+Math.abs(Math.sin(i*1.7+index))*13}px`}}/>)}</span></span>
                <button className="icon-button" aria-label={t('Copy credit for {title}', { title: track.title })} title={t('Copy the credit line for this track')} onClick={()=>void copyMusicCredit(track)}><Copy size={14}/></button>
                <button className="icon-button" aria-label={t('Add music {title}', { title: track.title })} disabled={!canEdit||!projectTicks} onClick={()=>void addMusic(track)}><Plus size={16}/></button>
              </div>)}</div>
              <details className="library-disclosure music-license"><summary>{t('CC BY 4.0 · credit required')}</summary><p>Real recordings from Scott Buckley and Ketsa, free for commercial videos when the artist is credited.</p><p>Paste the credit line into your video description. Content ID checks can still fire on any music.</p><div className="music-credits">{MUSIC_TRACKS.map(track=><div key={track.id}><strong>{track.title}</strong><span>{musicTrackCredit(track)}</span></div>)}</div><button className="button" onClick={()=>void copyMusicCredits()}>{t('Copy all credits')}</button><button className="button" onClick={()=>void navigator.clipboard.writeText(MUSIC_LICENSE).then(()=>setNotice(t('Music licence copied.'))).catch(()=>setError(t('Could not copy the music licence. It is included in the music folder.')))}>{t('Copy licence')}</button></details>
              </>}
            </div> : <div className="sound-library">
              <div className="music-source-switch" role="tablist" aria-label={t('Sound source')}>{([['bundled', 'Bundled'], ['online', 'Online'], ['saved', `Downloaded${savedTracks.some(track => track.kind === 'sound_effect') ? ` (${savedTracks.filter(track => track.kind === 'sound_effect').length})` : ''}`]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={soundSource === id} className={soundSource === id ? 'active' : ''} onClick={() => { stopLibraryPreview(); setSoundSource(id); }}>{label}</button>)}</div>
              {soundSource === 'saved' ? <DownloadedMusic kind="sound_effect" tracks={savedTracks.filter(track => track.kind === 'sound_effect')} canEdit={canEdit && Boolean(projectTicks)} onAdd={addSavedTrack} onRemove={removeSavedTrack} onStopOther={stopLibraryPreview} /> : soundSource === 'online' ? <OnlineMusic kind="sound_effect" canEdit={canEdit && Boolean(projectTicks)} onAdd={track => addOnlineMusic(track, 'sound_effect')} onStopOther={stopLibraryPreview} isDownloaded={track => Boolean(findSavedTrack(savedTracks, track))} /> : <>
              <label className="search-field"><Search size={14} /><input aria-label={t('Search sound effects')} placeholder={t('Search {count} sounds…', { count: SOUND_CATALOG.length })} value={soundQuery} onChange={event => setSoundQuery(event.target.value)} /></label>
              {soundGroups.map(group => {
                const open = Boolean(soundQuery.trim()) || openSoundGroup === group.id;
                return <section className="sound-group" key={group.id}>
                  <button className="sound-group-head" aria-expanded={open} onClick={() => setOpenSoundGroup(openSoundGroup === group.id ? null : group.id)}><span>{group.label}</span><small>{group.count}</small><ChevronDown size={14} /></button>
                  {open && <div className="sound-effect-list">{group.sounds.map(effect => <div key={effect.id} className={previewingAudio === `sfx-${effect.id}` ? 'previewing' : ''}>
                    <button className="icon-button" aria-label={`${previewingAudio === `sfx-${effect.id}` ? 'Pause' : 'Play'} ${effect.label}`} aria-pressed={previewingAudio === `sfx-${effect.id}`} onClick={() => previewingAudio === `sfx-${effect.id}` ? stopLibraryPreview() : hoverLibraryAudio(`sfx-${effect.id}`, soundData(effect.id), 0, effect.seconds, true)}>{previewingAudio === `sfx-${effect.id}` ? <Pause size={13} /> : <Play size={13} />}</button>
                    <span>{effect.label}</span>
                    <button className="icon-button" aria-label={t('Add {label} at playhead', { label: effect.label })} disabled={!canEdit || !projectTicks} onClick={() => void addSound(effect.id, secondsToTicks(position, project.timebase))}><Plus size={14} /></button>
                  </div>)}</div>}
                </section>;
              })}
              {recordedGroups.map(group => {
                const key = `rec-${group.category}`, open = Boolean(soundQuery.trim()) || openSoundGroup === key;
                return <section className="sound-group" key={key}>
                  <button className="sound-group-head" aria-expanded={open} onClick={() => setOpenSoundGroup(openSoundGroup === key ? null : key)}><span>{t(group.category)} · {t('recorded')}</span><small>{group.sounds.length}</small><ChevronDown size={14} /></button>
                  {open && <div className="sound-effect-list">{group.sounds.map(effect => <div key={effect.id} className={previewingAudio === `rec-${effect.id}` ? 'previewing' : ''}>
                    <button className="icon-button" aria-label={`${previewingAudio === `rec-${effect.id}` ? 'Pause' : 'Play'} ${effect.label}`} aria-pressed={previewingAudio === `rec-${effect.id}`} onClick={() => previewingAudio === `rec-${effect.id}` ? stopLibraryPreview() : hoverLibraryAudio(`rec-${effect.id}`, () => recordedSoundData(effect), 0, effect.seconds, true)}>{previewingAudio === `rec-${effect.id}` ? <Pause size={13} /> : <Play size={13} />}</button>
                    <span>{effect.label}{creditForRecordedClip(recordedSoundClipName(effect), [effect]) && <small> · credit {effect.author}</small>}</span>
                    <button className="icon-button" aria-label={t('Add {label} at playhead', { label: effect.label })} disabled={!canEdit || !projectTicks} onClick={() => void addRecordedSound(effect, secondsToTicks(position, project.timebase))}><Plus size={14} /></button>
                  </div>)}</div>}
                </section>;
              })}
              {!soundGroups.length && !recordedGroups.length && <p className="note">{t('No sound matches that search.')}</p>}
              <p className="note sound-library-note">{SOUND_CATALOG.length} synthesized on this device{recordedSounds.length ? ` · ${recordedSounds.length} recorded (CC0 / CC BY)` : ''}</p>
              </>}
            </div>}
          </div> : tab === 'templates' ? <div className="template-tab">
            <div className="template-tab-list">{TEMPLATES.map(template => <button key={template.id} className="template-tab-card" disabled={!canEdit} onClick={() => chooseTemplate(template)}>
              <span className="template-tab-art"><img src={templateImage(template)} alt="" /></span>
              <span className="template-tab-copy"><strong>{t(template.name)}</strong><small>{template.aspect} · {sceneCount(template.sceneCount)} · {template.duration.toFixed(1)} s</small><span className="template-badges">{template.video && <span className="template-badge video">{t('VIDEO')}</span>}{template.audio && <span className="template-badge music">{t('MUSIC')}</span>}</span></span>
              <Plus size={15} />
            </button>)}</div>
      
          </div> : <div className="elements-panel">
            <div className="element-library-tools">
              <label className="element-search"><Search size={15} /><input aria-label={t('Search elements')} placeholder={t('Search {count} elements…', { count: ELEMENT_CATALOG.length })} value={elementSearch} onChange={e => { setElementSearch(e.target.value); }} /></label>
              <select aria-label={t('Element collection')} value={elementCollection} onChange={e => { setElementCollection(e.target.value); setElementCategory('All'); }}><option value="All">{t('All {count} collections', { count: ELEMENT_COLLECTIONS.length })}</option>{ELEMENT_COLLECTIONS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
              <select aria-label={t('Element category')} value={elementCategory} onChange={e => { setElementCategory(e.target.value); setElementCollection('All'); }}>{ELEMENT_CATEGORIES.map(category => <option key={category} value={category}>{category === 'All' ? t('All categories') : t(category)}</option>)}</select>
            </div>
            {allOverlays.length > 0 && <details className="element-list element-project-overlays library-disclosure">
              <summary>{t('In project')} <span>{allOverlays.length}</span></summary>
              {allOverlays.map(element => <button key={element.id} className={`element-list-row ${selectedElementId === element.id ? 'active' : ''}`} onClick={() => selectOverlay(element)}><span className="element-list-row-icon" style={{ color: element.color }}><ElementGlyph presetId={element.presetId} kind={element.kind} size={12} /></span><span>{elementDisplayName(element)}</span><small>{ticksToSeconds(element.startTicks, project.timebase).toFixed(1)}s</small></button>)}
            </details>}
            <div className="element-grid">{filteredElements.slice(0, elementLimit).map(item => <button key={item.id} className="element-card" onPointerEnter={() => setHoveredElement(item.id)} onPointerLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement(item.id)} onBlur={() => setHoveredElement(null)} aria-label={t('Add {label}', { label: item.label })} disabled={!selectedScene || !canEdit || allOverlays.length >= 64} onClick={() => addElement(item.id)}><span className="element-card-icon"><ElementPreview active={hoveredElement === item.id} presetId={item.id} kind={item.kind} color={item.color} animation={item.animation} reduceMotion={preferences.reduceMotion} /></span><strong>{item.label}</strong><Plus size={12} /></button>)}</div>
            {filteredElements.length === 0 && <p className="note">{t('No matching elements. Try another collection or search.')}</p>}
            {filteredElements.length > elementLimit && <button className="button element-show-more" onClick={() => setElementLimit(n => n + 40)}>{t('Show 40 more')} · {Math.min(elementLimit, filteredElements.length)} / {filteredElements.length}</button>}
      
          </div>}
      
      
        </aside>
      
        <div className="splitter vertical" onPointerDown={e => beginResize('library', libraryWidth, e.clientX)} />
    </>
  );
}
