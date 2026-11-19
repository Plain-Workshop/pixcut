import { t } from '../../i18n';
import { RangeField } from '../../components/inspector/NumberField';
import { AudioLines, Command as Copy, Magnet, Music, Mic, RotateCcw, Square } from 'lucide-react';
import { isAssetRef } from '../../components/preview/media-url';
import { formatBytes } from '../helpers';
import { creditForClipName } from '../../stores/music-library';
import { secondsPerTick, secondsToTicks, ticksToSeconds, type AudioClip, type Command } from '../../stores/model';
import type { Project } from '../../stores/model';
import type { Dispatch, SetStateAction } from 'react';

export function AudioInspector({ audioLanes, beatBusy, beatTempo, canEdit, commitAudio, commitDucking, detectAudioBeats, duckDraft, hasVideoScenes, project, projectTicks, recordSeconds, recording, run, selectedAudio, setDuckDraft, setError, setNotice, snapCutsToBeat, stageAudio, startVoiceover, stopVoiceover }: {
  audioLanes: number[];
  beatBusy: boolean;
  beatTempo: number | null;
  canEdit: boolean;
  commitAudio: () => void;
  commitDucking: (amount: number) => void;
  detectAudioBeats: () => Promise<void>;
  duckDraft: number | null;
  hasVideoScenes: boolean;
  project: Project;
  projectTicks: number;
  recordSeconds: number;
  recording: boolean;
  run: (command: Command) => Promise<boolean>;
  selectedAudio: AudioClip;
  setDuckDraft: Dispatch<SetStateAction<number | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  snapCutsToBeat: () => Promise<void>;
  stageAudio: (patch: Partial<AudioClip>) => void;
  startVoiceover: () => Promise<void>;
  stopVoiceover: () => void;
}) {
  return (<>
              <details className="inspector-section ducking-panel"><summary>{t('Project music mix')}</summary>
                <label className="checkbox-field"><input type="checkbox" checked={(project.ducking ?? 0) > 0} disabled={!canEdit || !hasVideoScenes} onChange={event => void run({ type: 'ducking', amount: event.target.checked ? 60 : 0 })} /> {t('Lower music under video sound')}</label>
                {(project.ducking ?? 0) > 0 && <RangeField label={'Reduce music by'} sliderLabel="Music ducking amount" unit="%" min={10} max={90} step={5} value={duckDraft ?? project.ducking ?? 60} disabled={!canEdit} onChange={v => setDuckDraft(v)} onCommit={() => commitDucking(duckDraft ?? project.ducking ?? 60)} />}
                <p className="note"><AudioLines size={14} /><span>{hasVideoScenes ? t('Lowers all music tracks while video audio is playing.') : t('Add a video clip to duck music under its sound.')}</span></p>
              </details>
              <div className="voiceover-panel">
                <div className="beat-sync-head"><strong>{t('Voiceover')}</strong>{recording ? <span>{recordSeconds.toFixed(1)} s</span> : null}</div>
                <div className="beat-sync-actions">
                  {recording
                    ? <button className="button danger" onClick={stopVoiceover}><Square size={13} /> {t('Stop and add')}</button>
                    : <button className="button" disabled={!canEdit || !projectTicks} onClick={() => void startVoiceover()}><Mic size={14} /> {t('Record voiceover')}</button>}
                </div>
                <small>{recording ? t('Speak now. The take is added at the playhead when you stop.') : t('Records from your microphone at the playhead. Nothing is uploaded.')}</small>
              </div>
              {selectedAudio && <div className="audio-editor">
                <div className="audio-editor-title"><small>{isAssetRef(selectedAudio.data) ? t('Stored locally') : formatBytes(selectedAudio.data.length * .75)} · {t('{duration} s source', { duration: selectedAudio.sourceDurationSeconds.toFixed(1) })}</small></div>
                {(selectedAudio.credit || creditForClipName(selectedAudio.name)) && <div className="music-credit-note"><Music size={13} /><span>{selectedAudio.credit || creditForClipName(selectedAudio.name)}</span><button className="text-button" onClick={() => void navigator.clipboard.writeText((selectedAudio.credit || creditForClipName(selectedAudio.name))!).then(() => setNotice(t('Music credit copied.'))).catch(() => setError(t('Could not copy the credit. It is listed in the Music panel.')))}><Copy size={12} /> {t('Copy credit')}</button></div>}
                <label className="field">{t('Audio track')}<select aria-label={t('Audio track')} value={selectedAudio.lane} onChange={event => stageAudio({ lane: Number(event.target.value) })} onBlur={commitAudio}>{audioLanes.map((lane, index) => <option key={lane} value={lane}>{t('Track {number}', { number: index + 1 })}</option>)}{audioLanes.length < 8 && <option value={audioLanes.length}>{t('Track {number}', { number: audioLanes.length + 1 })}</option>}</select></label>
                <RangeField label={'Start'} sliderLabel="Audio start" unit="s" min={0} max={ticksToSeconds(Math.max(0, projectTicks - selectedAudio.durationTicks), project.timebase)} step={secondsPerTick(project.timebase)} value={ticksToSeconds(selectedAudio.startTicks, project.timebase)} disabled={!canEdit} onChange={v => stageAudio({ startTicks: secondsToTicks(v, project.timebase) })} onCommit={commitAudio} />
                <RangeField label={'Trim in'} sliderLabel="Audio trim in" unit="s" min={0} max={Math.max(0, selectedAudio.sourceDurationSeconds - secondsPerTick(project.timebase))} step={0.1} value={selectedAudio.sourceInSeconds} disabled={!canEdit} onChange={v => stageAudio({ sourceInSeconds: v })} onCommit={commitAudio} />
                <RangeField label={'Duration'} sliderLabel="Audio duration" unit="s" min={0.1} max={Math.max(0.1, Math.min(ticksToSeconds(projectTicks - selectedAudio.startTicks, project.timebase), selectedAudio.sourceDurationSeconds - selectedAudio.sourceInSeconds))} step={0.1} value={ticksToSeconds(selectedAudio.durationTicks, project.timebase)} disabled={!canEdit} onChange={v => stageAudio({ durationTicks: secondsToTicks(v, project.timebase) })} onCommit={commitAudio} />
                <RangeField label={'Volume'} sliderLabel="Audio volume" unit="%" min={0} max={100} step={1} value={Math.round(selectedAudio.volume * 100)} disabled={!canEdit} onChange={v => stageAudio({ volume: v / 100 })} onCommit={commitAudio} />
                <RangeField label={'Fade in'} sliderLabel="Audio fade in" unit="s" min={0} max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step={0.1} value={selectedAudio.fadeIn} disabled={!canEdit} onChange={v => stageAudio({ fadeIn: v })} onCommit={commitAudio} />
                <RangeField label={'Fade out'} sliderLabel="Audio fade out" unit="s" min={0} max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step={0.1} value={selectedAudio.fadeOut} disabled={!canEdit} onChange={v => stageAudio({ fadeOut: v })} onCommit={commitAudio} />
                <details className="inspector-section" open>
                  <summary>{t('Three-band EQ')}</summary>
                  {([['low', 'Bass · 120 Hz'], ['mid', 'Voice · 1 kHz'], ['high', 'Treble · 6 kHz']] as const).map(([key, label]) => (
                    <RangeField key={key} label={label} sliderLabel={`Audio ${key} EQ`} unit="dB" min={-12} max={12} step={1} value={selectedAudio[key] ?? 0} disabled={!canEdit} onChange={v => stageAudio({ [key]: v })} onCommit={commitAudio} />
                  ))}
                  <button className="button" disabled={!canEdit || !selectedAudio.low && !selectedAudio.mid && !selectedAudio.high} onClick={() => { stageAudio({ low: 0, mid: 0, high: 0 }); window.setTimeout(commitAudio, 0); }}><RotateCcw size={13} /> {t('Reset EQ')}</button>
                </details>
                <div className="beat-sync">
                  <div className="beat-sync-head"><strong>{t('Beat tools')}</strong>{beatTempo ? <span>{beatTempo} BPM</span> : null}</div>
                  <div className="beat-sync-actions">
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void detectAudioBeats()}><AudioLines size={14} />{beatBusy ? t('Listening…') : t('Detect beats')}</button>
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void snapCutsToBeat()}><Magnet size={14} />{t('Snap cuts')}</button>
                  </div>
                  <small>{t('Detect beat markers, then align cuts to the rhythm.')}</small>
                </div>

              </div>}
  </>);
}
