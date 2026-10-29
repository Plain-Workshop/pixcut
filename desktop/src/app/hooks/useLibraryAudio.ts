import { t } from '../../i18n';
import { findSavedTrack, loadSavedTracks, storeSavedTracks, withSavedTrack, withoutSavedTrack, type SavedTrack } from '../../stores/online-downloads';
import { onlineLicenseLabel, DOWNLOAD_CANCELLED, downloadOnlineTrack, type OnlineTrack } from '../../stores/online-music';
import { MUSIC_TRACKS, musicTrackData, musicTrackPreviewUrl, musicTrackCredit, musicTrackClipName, releaseMusicPreviewUrls, type MusicTrack } from '../../stores/music-library';
import { soundEffectData, type SoundEffectId } from '../../components/elements/sound-effects';
import { createRecordedSoundClip, creditForRecordedClip, recordedSoundData, type RecordedSound } from '../../stores/sound-library';
import { createSoundClip, type SoundId } from '../../components/elements/sound-catalog';
import { isAssetRef, resolveMediaSource } from '../../components/preview/media-url';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { secondsToTicks, ticksToSeconds, totalTicks, type AudioClip, type Command, type Project } from '../../stores/model';
import { messageFor } from '../errors';

/** Library audio: hover/Listen previews, adding bundled, saved and online music, and sound effects to the timeline. */
export function useLibraryAudio({ canEdit, projectTicks, position, project, latestProject, run, setBusy, setNotice, setError, tab, audioLibraryTab, playing, modal, setHoveredMedia, setHoveredElement }: {
  canEdit: boolean;
  projectTicks: number;
  position: number;
  project: Project;
  latestProject: { current: Project };
  run: (command: Command) => Promise<boolean>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  tab: string;
  audioLibraryTab: string;
  playing: boolean;
  modal: string | null;
  setHoveredMedia: Dispatch<SetStateAction<any>>;
  setHoveredElement: Dispatch<SetStateAction<any>>;
}) {
  const soundPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [previewingAudio, setPreviewingAudio] = useState<string | null>(null);
  const libraryAudio = useRef<HTMLAudioElement | null>(null), libraryAudioToken = useRef(0), libraryAudioTimer = useRef<number | undefined>(undefined);

  function stopLibraryPreview() {
    libraryAudioToken.current++;window.clearTimeout(libraryAudioTimer.current);
    if(libraryAudio.current){libraryAudio.current.pause();libraryAudio.current.removeAttribute('src');libraryAudio.current.load();libraryAudio.current=null;}
    setPreviewingAudio(null);
  }
  function hoverLibraryAudio(id:string,source:string|(()=>Promise<string>),start=0,length=30,explicit=false) {
    stopLibraryPreview();if(playing || modal)return;
    const token=libraryAudioToken.current;
    const play=(url:string|undefined)=>{
      if(!url||token!==libraryAudioToken.current)return;
      const player=new Audio(url);libraryAudio.current=player;player.volume=.5;
      player.onloadedmetadata=()=>{player.currentTime=Math.min(start,Math.max(0,player.duration-.01));};
      player.ontimeupdate=()=>{if(player.currentTime>=start+length)stopLibraryPreview();};
      player.onended=()=>stopLibraryPreview();
      void player.play().then(()=>{if(token===libraryAudioToken.current)setPreviewingAudio(id);else player.pause();}).catch(()=>{if(token===libraryAudioToken.current){setPreviewingAudio(null);if(explicit)setNotice(t('Audio preview could not start. Check the app audio permissions and try Listen again.'));}});
    };
    const resolve=()=>{
      // Bundled music is read from the app bundle first: the desktop shell
      // cannot stream audio from its own scheme, so the file becomes a blob URL.
      if(typeof source==='function'){void source().then(play,error=>{if(token===libraryAudioToken.current&&explicit)setError(messageFor(error));});return;}
      // Keep direct Listen clicks inside the browser's user-activation event.
      if(explicit&&!isAssetRef(source)){play(source);return;}
      void resolveMediaSource(source).then(play);
    };
    if(explicit)resolve();else libraryAudioTimer.current=window.setTimeout(resolve,100);
  }

  useEffect(()=>{stopLibraryPreview();setHoveredMedia(null);setHoveredElement(null);},[tab,audioLibraryTab,playing,modal,project.id]);
  // Read the bundled tracks as soon as the Music tab opens, so Listen starts
  // from memory instead of waiting on the file the user just clicked.
  useEffect(()=>{
    if(tab!=='audio'||audioLibraryTab!=='music')return;
    for(const track of MUSIC_TRACKS)void musicTrackPreviewUrl(track).catch(()=>{});
  },[tab,audioLibraryTab]);
  useEffect(()=>()=>{libraryAudioToken.current++;window.clearTimeout(libraryAudioTimer.current);libraryAudio.current?.pause();releaseMusicPreviewUrls();},[]);
  useEffect(()=>{
    const stop=()=>{stopLibraryPreview();setHoveredMedia(null);setHoveredElement(null);};
    const visibility=()=>{if(document.hidden)stop();};
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility);};
  },[]);

  async function copyMusicCredit(track:MusicTrack) {
    try { await navigator.clipboard.writeText(musicTrackCredit(track)); setNotice(t('Credit for {title} copied. Paste it into your video description.', { title: track.title })); }
    catch { setError(t('Could not copy the credit. It is listed under the music licence in the Music panel.')); }
  }
  async function copyMusicCredits() {
    const credits = MUSIC_TRACKS.map(track => musicTrackCredit(track)).join('\n');
    try { await navigator.clipboard.writeText(`Music (CC BY 4.0):\n${credits}`); setNotice(t('All music credits copied.')); }
    catch { setError(t('Could not copy the credits. They are listed under the music licence in the Music panel.')); }
  }
  async function addMusic(track:MusicTrack) {
    if(!canEdit||!projectTicks)return;
    stopLibraryPreview();setBusy(true);
    try{
      const data=await musicTrackData(track),snapshot=latestProject.current,total=totalTicks(snapshot);
      const startTicks=Math.min(total-1,Math.max(0,secondsToTicks(position,project.timebase)));
      const durationTicks=Math.min(total-startTicks,Math.max(1,secondsToTicks(track.seconds,snapshot.timebase)));
      const lane=Array.from({length:8},(_,i)=>i).find(i=>!snapshot.audio.some(c=>(c.lane??0)===i&&c.startTicks<startTicks+durationTicks&&c.startTicks+c.durationTicks>startTicks));
      const clip:AudioClip={id:crypto.randomUUID(),name:musicTrackClipName(track),data,lane:lane??7,startTicks,durationTicks,sourceInSeconds:0,sourceDurationSeconds:track.seconds,volume:.55,fadeIn:.15,fadeOut:Math.min(.6,ticksToSeconds(durationTicks,snapshot.timebase)/3)};
      if(await run({type:'audio',audio:[...snapshot.audio,clip]}))setNotice(t('{title} added at the playhead. Credit {author} when you publish — the line is in the Audio panel.', { title: track.title, author: track.author }));
    }catch(error){setError(messageFor(error));}finally{setBusy(false);}
  }

  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>(() => loadSavedTracks());
  const savedTracksRef = useRef(savedTracks);
  function updateSavedTracks(update: (list: SavedTrack[]) => SavedTrack[]) {
    const next = update(savedTracksRef.current);
    savedTracksRef.current = next; setSavedTracks(next); storeSavedTracks(next);
  }
  function removeSavedTrack(key: string) { updateSavedTracks(list => withoutSavedTrack(list, key)); }
  /** Adds a track that is already on this device. No network is used. */
  async function addSavedTrack(saved: SavedTrack) {
    if (!canEdit || !projectTicks) return;
    stopLibraryPreview(); setBusy(true);
    try {
      const snapshot = latestProject.current, total = totalTicks(snapshot);
      const startTicks = Math.min(total - 1, Math.max(0, secondsToTicks(position, project.timebase)));
      const durationTicks = Math.min(total - startTicks, Math.max(1, secondsToTicks(saved.seconds, snapshot.timebase)));
      const lane = Array.from({ length: 8 }, (_, i) => i).find(i => !snapshot.audio.some(c => (c.lane ?? 0) === i && c.startTicks < startTicks + durationTicks && c.startTicks + c.durationTicks > startTicks));
      const music = saved.kind === 'music';
      const clip: AudioClip = { id: crypto.randomUUID(), name: saved.name, data: saved.reference, lane: lane ?? 7, startTicks, durationTicks, sourceInSeconds: 0, sourceDurationSeconds: saved.seconds, volume: music ? .55 : .7, fadeIn: music ? .15 : 0, fadeOut: Math.min(music ? .6 : .03, ticksToSeconds(durationTicks, snapshot.timebase) / 3), ...(saved.credit ? { credit: saved.credit } : {}) };
      if (await run({ type: 'audio', audio: [...snapshot.audio, clip] })) setNotice(t('{title} added at the playhead from your downloads.', { title: saved.title }));
    } catch (error) { setError(messageFor(error)); } finally { setBusy(false); }
  }

  async function addOnlineMusic(track: OnlineTrack, kind: 'music' | 'sound_effect' = 'music') {
    if (!canEdit || !projectTicks) return;
    stopLibraryPreview();
    // The download can take a while; the editor stays usable meanwhile, and the row in the list shows the progress.
    try {
      const existing = findSavedTrack(savedTracksRef.current, track);
      const downloaded = existing ? { reference: existing.reference, name: existing.name, bytes: 0 } : await downloadOnlineTrack(track);
      if (!existing) updateSavedTracks(list => withSavedTrack(list, track, downloaded, kind, onlineLicenseLabel(track)));
      const snapshot = latestProject.current, total = totalTicks(snapshot);
      const startTicks = Math.min(total - 1, Math.max(0, secondsToTicks(position, project.timebase)));
      const durationTicks = Math.min(total - startTicks, Math.max(1, secondsToTicks(track.seconds, snapshot.timebase)));
      const lane = Array.from({ length: 8 }, (_, i) => i).find(i => !snapshot.audio.some(c => (c.lane ?? 0) === i && c.startTicks < startTicks + durationTicks && c.startTicks + c.durationTicks > startTicks));
      const clip: AudioClip = { id: crypto.randomUUID(), name: downloaded.name, data: downloaded.reference, lane: lane ?? 7, startTicks, durationTicks, sourceInSeconds: 0, sourceDurationSeconds: track.seconds, volume: kind === 'music' ? .55 : .7, fadeIn: kind === 'music' ? .15 : 0, fadeOut: Math.min(kind === 'music' ? .6 : .03, ticksToSeconds(durationTicks, snapshot.timebase) / 3), credit: track.credit };
      if (await run({ type: 'audio', audio: [...snapshot.audio, clip] })) setNotice(t('{title} added at the playhead. The credit line is saved with the clip and shows in the Audio panel.', { title: track.title }));
    } catch (error) {
      // Cancelling is the user's own choice, so it gets a quiet notice instead of the error banner.
      if (messageFor(error) === DOWNLOAD_CANCELLED) setNotice(t('Download cancelled.'));
      else setError(messageFor(error));
    }
  }

  function previewSound(id: SoundEffectId) {
    soundPreviewRef.current?.pause();
    const player = new Audio(soundEffectData(id)); soundPreviewRef.current = player;
    player.volume = .65; void player.play().catch(error => setError(messageFor(error)));
  }
  async function addRecordedSound(sound: RecordedSound, startTicks: number) {
    if (!canEdit) return;
    try {
      const clip = createRecordedSoundClip(latestProject.current, sound, await recordedSoundData(sound), startTicks);
      if (clip && await run({ type: 'audio', audio: [...latestProject.current.audio, clip] })) setNotice(creditForRecordedClip(clip.name, [sound]) ? t('{label} added. Credit {author} when you publish — the line is in the Audio panel.', { label: sound.label, author: sound.author }) : t('{label} added to the audio timeline. Drag it to adjust timing.', { label: sound.label }));
    } catch (error) { setError(messageFor(error)); }
  }
  async function addSound(id: SoundId, startTicks: number) {
    if (!canEdit) return;
    const clip = createSoundClip(latestProject.current, id, startTicks);
    if (clip && await run({ type: 'audio', audio: [...latestProject.current.audio, clip] })) setNotice(t('{name} added to the audio timeline. Drag it to adjust timing.', { name: clip.name }));
  }

  return { previewingAudio, savedTracks, stopLibraryPreview, hoverLibraryAudio, copyMusicCredit, copyMusicCredits, addMusic, removeSavedTrack, addSavedTrack, addOnlineMusic, previewSound, addRecordedSound, addSound };
}
