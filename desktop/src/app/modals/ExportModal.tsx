import * as bridge from '../bridge';
import { fileCount, formatCount, renderCount, sceneCount, t, videoCount } from '../../i18n';
import { Check, Copy, Download, Film, Layers, Music } from 'lucide-react';
import { type Project, type Scene, type FormatVariant } from '../../stores/model';
import { type ShortcutPlatform } from '../../shortcuts/registry';
import type { Dispatch, SetStateAction } from 'react';
import type { FormatOutputGroup } from '../../stores/formats';
import { EXPORT_CODEC_OPTIONS, EXPORT_CONTAINERS, EXPORT_CONTAINER_LABEL, EXPORT_CONTAINER_SHORT, EXPORT_CODEC_NOTE, FFMPEG_INSTALL } from '../export-options';

export function ExportModal({ saveCredits, setSaveCredits, project, duration, scenes, exportCodec, exportCodecs, setExportCodec, setExportContainer, exportContainer, exportSpeed, setExportSpeed, exportHardware, hardwareAvailable, setExportHardware, exportQuality, setExportQuality, exportResolution, setExportResolution, exportFps, setExportFps, exportAudio, setExportAudio, musicCredits, setNotice, setError, hasVideoScenes, exportSettings, setExportSettings, exportFormatIds, exportOutputs, exportFormats, setExportFormatIds, exportFilename, exporter, platform, exporting, busy, exportVideo }: {
  project: Project;
  duration: number;
  scenes: Scene[];
  exportCodec: bridge.ExportCodec;
  exportCodecs: bridge.ExportCodec[];
  setExportCodec: Dispatch<SetStateAction<bridge.ExportCodec>>;
  setExportContainer: Dispatch<SetStateAction<bridge.ExportContainer>>;
  exportContainer: bridge.ExportContainer;
  exportSpeed: "fast" | "medium" | "slow";
  setExportSpeed: Dispatch<SetStateAction<"fast" | "medium" | "slow">>;
  exportHardware: boolean;
  hardwareAvailable: boolean;
  setExportHardware: Dispatch<SetStateAction<boolean>>;
  exportQuality: string;
  setExportQuality: Dispatch<SetStateAction<string>>;
  exportResolution: string;
  setExportResolution: Dispatch<SetStateAction<string>>;
  exportFps: string;
  setExportFps: Dispatch<SetStateAction<string>>;
  exportAudio: boolean;
  setExportAudio: Dispatch<SetStateAction<boolean>>;
  musicCredits: string[];
  saveCredits: boolean;
  setSaveCredits: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  hasVideoScenes: boolean;
  exportSettings: { name: string; version: string; includeQuality: boolean; includePreset: boolean; };
  setExportSettings: Dispatch<SetStateAction<{ name: string; version: string; includeQuality: boolean; includePreset: boolean; }>>;
  exportFormatIds: string[];
  exportOutputs: FormatOutputGroup<FormatVariant>[];
  exportFormats: FormatVariant[];
  setExportFormatIds: Dispatch<SetStateAction<string[]>>;
  exportFilename: (delivery: { formats: { name: string; presetId?: string | null; quality: string; width: number; height: number; }[]; slug?: string; }, includeFormat?: boolean) => string;
  exporter: boolean;
  platform: ShortcutPlatform;
  exporting: boolean;
  busy: boolean;
  exportVideo: () => Promise<void>;
}) {
  return (
    <>
      <div className="export-title"><h2 id="modal-title">{t('Export video')}</h2><p>{project.name} <span>· {duration.toFixed(1)} s · {sceneCount(scenes.length)}</span></p></div>
      <div className="export-workspace">
        <div className="export-controls">
          <section className="export-section"><h3>{t('Encoding')}</h3>
            <div className="codec-choices" role="group" aria-label="Video codec">{EXPORT_CODEC_OPTIONS.map(({ id, label, description }) => <button type="button" key={id} aria-pressed={exportCodec === id} disabled={!exportCodecs.includes(id)} className={exportCodec === id ? 'active' : ''} onClick={() => { setExportCodec(id); setExportContainer(current => EXPORT_CONTAINERS[id].includes(current) ? current : EXPORT_CONTAINERS[id][0]); }}><strong>{label}</strong><small>{exportCodecs.includes(id) ? t(description) : t('Encoder unavailable')}</small>{exportCodec === id && <Check size={15} />}</button>)}</div>
            <div className="export-pair"><label className="field">{t('Container')}<select aria-label="Video container" value={exportContainer} onChange={event => setExportContainer(event.target.value as bridge.ExportContainer)}>{EXPORT_CONTAINERS[exportCodec].map(id => <option key={id} value={id}>{EXPORT_CONTAINER_LABEL[id]}</option>)}</select></label><label className="field">{t('Encoding speed')}<select aria-label="Encoding speed" value={exportSpeed} disabled={exportCodec === 'prores'} onChange={event => setExportSpeed(event.target.value as 'medium')}><option value="fast">{t('Fast')}</option><option value="medium">{t('Balanced')}</option><option value="slow">{t('Slower · better compression')}</option></select></label></div>
            <label className="export-audio-toggle"><input type="checkbox" checked={exportHardware} disabled={!hardwareAvailable || (exportCodec !== 'h264' && exportCodec !== 'hevc')} onChange={event => setExportHardware(event.target.checked)} /> {t('Hardware encoder')} <small>{!hardwareAvailable ? t('Unavailable in this build') : exportCodec !== 'h264' && exportCodec !== 'hevc' ? t('H.264 and H.265 only') : t('Platform encoder · much faster')}</small></label>
          </section>
          <section className="export-section"><h3>{t('Quality')}</h3><div className="quality-choices" role="group" aria-label="Export quality">{([['draft','Smaller','Quick drafts'],['standard','Balanced','Everyday sharing'],['high','High','Sharper details']] as const).map(([id,label,description]) => <button type="button" key={id} aria-pressed={exportQuality === id} className={exportQuality === id ? 'active' : ''} onClick={() => setExportQuality(id)}><strong>{t(label)}</strong><small>{t(description)}</small></button>)}</div></section>
          <section className="export-section"><h3>{t('Picture')}</h3><div className="export-pair"><label className="field">{t('Resolution')}<select aria-label="Export resolution" value={exportResolution} onChange={event => setExportResolution(event.target.value)}><option value="project">{t('Project dimensions')}</option><option value="720">720p HD</option><option value="1080">1080p Full HD</option><option value="2160">4K UHD</option></select></label><label className="field">{t('Frame rate')}<select aria-label={t('Export frame rate')} value={exportFps} onChange={event => setExportFps(event.target.value)}><option value="project">{t('Match each output')}</option>{[24,25,30,60].map(fps => <option key={fps} value={fps}>{fps} fps</option>)}</select></label></div><label className="export-audio-toggle"><input type="checkbox" checked={exportAudio} onChange={event => setExportAudio(event.target.checked)} /> {t('Include audio')} <small>{exportAudio ? (exportCodec === 'vp9' ? 'Opus · 160 kbps' : exportCodec === 'prores' ? 'PCM · 48 kHz' : 'AAC · 192 kbps') : 'Silent video'}</small></label>
            {exportAudio && musicCredits.length > 0 && <div className="export-credits"><div><Music size={13} /><strong>{t('Credit this music')}</strong><button className="button" onClick={() => void navigator.clipboard.writeText(musicCredits.join('\n')).then(() => setNotice('Music credits copied.')).catch(() => setError('Could not copy the credits. They are listed in the Music panel.'))}><Copy size={13} /> {t('Copy credits')}</button></div><p>{t('The tracks are CC BY 4.0: name the artist in your video description.')}</p>{musicCredits.map(credit => <code key={credit}>{credit}</code>)}<label className="checkbox-field"><input type="checkbox" checked={saveCredits} onChange={event => setSaveCredits(event.target.checked)} /> {t('Save a credits file next to the video')}</label></div>}</section>
          {hasVideoScenes && <details className="export-naming-details"><summary>{t('Video source rendering')}</summary><p>{t('Trims, speed, color grade, fades, overlays and picture-in-picture clips are baked into the video. Scene transitions keep their blend when either side is a video clip.')}</p></details>}
          <section className="export-section export-naming"><h3>{t('File name')}</h3><div className="export-pair name-pair"><label className="field">{t('Name')}<input aria-label={t('Export file name')} maxLength={100} value={exportSettings.name} onChange={event => setExportSettings(current => ({ ...current, name: event.target.value }))} placeholder={project.name} /></label><label className="field">{t('Version')}<input aria-label={t('Export version')} maxLength={20} value={exportSettings.version} onChange={event => setExportSettings(current => ({ ...current, version: event.target.value }))} placeholder="v1" /></label></div><details className="export-naming-details"><summary>{t('File naming options')}</summary><label className="checkbox-field"><input type="checkbox" checked={exportSettings.includePreset} onChange={event => setExportSettings(current => ({ ...current, includePreset: event.target.checked }))} /> {t('Add output name')}</label><label className="checkbox-field"><input type="checkbox" checked={exportSettings.includeQuality} onChange={event => setExportSettings(current => ({ ...current, includeQuality: event.target.checked }))} /> {t('Add quality')}</label></details></section>
        </div>
        <aside className="export-delivery"><div className="export-output-heading"><h3>{t('Outputs')}</h3><span>{t('{formats} selected · {files}', { formats: formatCount(exportFormatIds.length), files: fileCount(exportOutputs.length) })}</span></div>{exportFormatIds.length > exportOutputs.length && <p className="export-combine-note"><Layers size={13} /><span>{t('{formats} share {renders}, so PixCut writes {videos} with every platform in the file name.', { formats: formatCount(exportFormatIds.length), renders: renderCount(exportOutputs.length), videos: videoCount(exportOutputs.length) })}</span></p>}<div className="export-output-list">{exportFormats.map(format => <label key={format.id} className={`export-output ${exportFormatIds.includes(format.id) ? 'active' : ''}`}><input type="checkbox" checked={exportFormatIds.includes(format.id)} onChange={event => setExportFormatIds(current => event.target.checked ? [...current, format.id] : current.filter(id => id !== format.id))} /><span className="export-aspect-icon" style={{ aspectRatio: `${format.width}/${format.height}` }} /><span><strong>{format.name}</strong><small>{format.width} × {format.height} · {format.fps} fps</small></span></label>)}</div><details className="export-file-preview"><summary>{t('File names')} <span>{fileCount(exportOutputs.length)}</span></summary>{exportOutputs.map(output => <div key={output.key}><Film size={15} /><strong>{exportFilename(output, exportOutputs.length > 1)}</strong><small>{output.label}{output.formats.length > 1 ? ` · ${output.formats.length} formats` : ''}</small></div>)}{!exportOutputs.length && <p>{t('Select an output above.')}</p>}</details><p className="export-codec-note">{t(EXPORT_CODEC_NOTE[exportCodec])}</p></aside>
      </div>
      <footer className="export-studio-footer"><div>{!bridge.native ? t('Video export is available in the desktop app.') : !exporter ? t('FFmpeg unavailable. Install with {command}, then restart PixCut.', { command: FFMPEG_INSTALL[platform] }) : !exportCodecs.includes(exportCodec) ? t('This codec is unavailable in your FFmpeg installation.') : <><span>{EXPORT_CONTAINER_SHORT[exportContainer]} · {EXPORT_CODEC_OPTIONS.find(option => option.id === exportCodec)?.label} · {exportQuality === 'high' ? t('High quality') : exportQuality === 'draft' ? t('Smaller file') : t('Balanced')}</span><small>{exportCodec === 'prores' ? t('ProRes uses the quality setting.') : t('You can continue editing during export.')}</small></>}</div><button type="button" className="button primary" disabled={!bridge.native || !exporter || exporting || busy || !exportFormatIds.length || !exportCodecs.includes(exportCodec)} onClick={() => void exportVideo()}><Download size={17} /> {exportOutputs.length > 1 ? t('Export {videos}', { videos: videoCount(exportOutputs.length) }) : t('Export video')}</button></footer>
    </>
  );
}
