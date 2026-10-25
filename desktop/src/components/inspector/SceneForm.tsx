import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ClipboardPaste, Copy, Gauge, RotateCcw, Search, Sparkles, Type } from 'lucide-react';
import type { Scene, ScenePatchKey } from '../../stores/model';
import { FILTERS, clamp, thumbnailFilterCss } from '../preview/filters';

type Tab = 'video' | 'color' | 'speed' | 'fade' | 'filters';
type ColorKey = 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'highlights' | 'shadows' | 'temperature' | 'tint';

const COLOR_CONTROLS: { key: ColorKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 2.5, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 2.5, step: 0.01 },
  { key: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.05 },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2.5, step: 0.01 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'Tint', min: -1, max: 1, step: 0.01 },
];

const COLOR_DEFAULTS: Partial<Scene> = { brightness: 1, contrast: 1, saturation: 1, exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0 };
const COLOR_KEYS: ScenePatchKey[] = COLOR_CONTROLS.map(control => control.key);
const SPEED_PRESETS = [0.5, 1, 1.5, 2];

function formatNumber(value: number) {
  return String(Number(value.toFixed(2)));
}

function comparable(scene: Scene) {
  return JSON.stringify({
    duration: scene.duration,
    title: scene.title,
    subtitle: scene.subtitle,
    color: scene.color,
    fit: scene.fit,
    brightness: scene.brightness ?? 1,
    contrast: scene.contrast ?? 1,
    saturation: scene.saturation ?? 1,
    exposure: scene.exposure ?? 0,
    highlights: scene.highlights ?? 0,
    shadows: scene.shadows ?? 0,
    temperature: scene.temperature ?? 0,
    tint: scene.tint ?? 0,
    filter: scene.filter ?? 'none',
    filterIntensity: scene.filterIntensity ?? 100,
    speed: scene.speed ?? 1,
    pitch: scene.pitch ?? true,
    fadeIn: scene.fadeIn ?? 0,
    fadeOut: scene.fadeOut ?? 0,
  });
}

function NumericField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const [text, setText] = useState(formatNumber(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(formatNumber(value)); }, [value]);
  function change(raw: string) {
    setText(raw);
    if (raw.trim() === '' || raw === '-') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
  }
  function commit() {
    const parsed = text.trim() === '' || text === '-' ? Number.NaN : Number(text);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    setText(formatNumber(next));
    if (next !== value) onChange(next);
    onCommit();
  }
  return <span className="range-number-wrap">
    <input
      className="range-number"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={event => change(event.target.value)}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    />
    {unit && <span className="range-unit">{unit}</span>}
  </span>;
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return <div className={`range-field ${disabled ? 'disabled' : ''}`}>
    <div className="range-head">
      <span>{label}</span>
      <NumericField label={label} value={value} min={min} max={max} step={step} unit={unit} disabled={disabled} onChange={onChange} onCommit={onCommit} />
    </div>
    <input
      type="range"
      aria-label={`${label} slider`}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
    />
  </div>;
}

function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <div className="inspector-heading"><span>{children}</span>{icon}</div>;
}

export function SceneForm({
  scene,
  update,
  onPreview,
  onCopyProperties,
  onPasteProperties,
  propertyClipboard,
}: {
  scene: Scene;
  update: (scene: Scene, force?: ScenePatchKey[]) => void;
  onPreview: (scene: Scene | null) => void;
  onCopyProperties: (scene: Scene) => void;
  onPasteProperties: () => void;
  propertyClipboard: Partial<Scene> | null;
}) {
  const [tab, setTab] = useState<Tab>('video');
  const [draft, setDraft] = useState(scene);
  const [dirty, setDirty] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const draftRef = useRef(draft), dirtyRef = useRef(dirty);
  const updateRef = useRef(update), previewRef = useRef(onPreview), sceneIdRef = useRef(scene.id);
  const committedRef = useRef(comparable(scene));
  const flushRef = useRef<() => void>(() => {});
  draftRef.current = draft;
  dirtyRef.current = dirty;
  updateRef.current = update;
  previewRef.current = onPreview;

  function flushIfDirty() {
    if (!dirtyRef.current) return;
    const next = draftRef.current;
    setDirty(false);
    dirtyRef.current = false;
    previewRef.current(null);
    const signature = comparable(next);
    if (signature !== committedRef.current) {
      committedRef.current = signature;
      updateRef.current(next);
    }
  }
  flushRef.current = flushIfDirty;

  useEffect(() => {
    const changed = sceneIdRef.current !== scene.id;
    sceneIdRef.current = scene.id;
    if (changed) flushIfDirty();
    if (changed || !dirtyRef.current) {
      setDraft(scene);
      draftRef.current = scene;
      committedRef.current = comparable(scene);
      setDirty(false);
      dirtyRef.current = false;
      previewRef.current(null);
    }
  }, [scene]);

  useEffect(() => {
    const inspector = document.querySelector<HTMLElement>('.inspector');
    if (inspector) inspector.scrollTop = 0;
  }, [tab, scene.id]);

  useEffect(() => () => { flushRef.current(); previewRef.current(null); }, []);

  function stage(patch: Partial<Scene>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
    dirtyRef.current = true;
    return next;
  }

  function preview(next: Scene) {
    previewRef.current(next);
  }

  function commit(next = draftRef.current) {
    setDirty(false);
    dirtyRef.current = false;
    previewRef.current(null);
    const signature = comparable(next);
    if (signature !== committedRef.current) {
      committedRef.current = signature;
      updateRef.current(next);
    }
  }

  function apply(patch: Partial<Scene>, force: ScenePatchKey[] = []) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(false);
    dirtyRef.current = false;
    previewRef.current(null);
    const signature = comparable(next);
    if (signature !== committedRef.current || force.length) {
      committedRef.current = signature;
      updateRef.current(next, force);
    }
  }

  function stageDuration(value: number) {
    const next = stage({
      duration: value,
      fadeIn: Math.min(draftRef.current.fadeIn ?? 0, value),
      fadeOut: Math.min(draftRef.current.fadeOut ?? 0, value),
    });
    preview(next);
  }

  function speedPatch(target: number): Partial<Scene> {
    const baseDuration = draftRef.current.duration * (draftRef.current.speed ?? 1);
    const duration = clamp(baseDuration / target, 0.5, 30);
    return {
      speed: baseDuration / duration,
      duration,
      fadeIn: Math.min(draftRef.current.fadeIn ?? 0, duration),
      fadeOut: Math.min(draftRef.current.fadeOut ?? 0, duration),
    };
  }

  function stageSpeed(target: number) {
    const next = stage(speedPatch(target));
    preview(next);
  }

  function applySpeed(target: number) {
    apply(speedPatch(target), ['speed']);
  }

  function stageColor(key: ColorKey, value: number) {
    preview(stage({ [key]: value } as Partial<Scene>));
  }

  const speed = draft.speed ?? 1;
  const sourceDuration = draft.duration * speed;
  const activeFilter = draft.filter ?? 'none';
  const filterIntensity = draft.filterIntensity ?? 100;
  const filteredFilters = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return FILTERS;
    return FILTERS.filter(filter => `${filter.label} ${filter.description}`.toLowerCase().includes(query));
  }, [filterQuery]);

  return <>
    <div className="inspector-tabs" role="tablist" aria-label="Scene inspector">
      {(['video', 'color', 'speed', 'fade', 'filters'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
    </div>

    {tab === 'video' && <>
      <SectionTitle icon={<Gauge size={14} />}>SCENE TIMING</SectionTitle>
      <RangeField label="Duration" value={draft.duration} min={0.5} max={30} step={0.1} unit="sec" onChange={stageDuration} onCommit={() => commit()} />
      <label className="field">Image scaling<select value={draft.fit} onChange={event => apply({ fit: event.target.value as Scene['fit'] }, ['fit'])}><option value="cover">Fill · crop to frame</option><option value="contain">Fit · show whole image</option><option value="blur">Blur fill</option></select></label>
      <hr />
      <SectionTitle icon={<Type size={14} />}>TEXT OVERLAY</SectionTitle>
      <label className="field">Title<textarea aria-label="Scene title" maxLength={120} rows={3} placeholder="Give this moment a title…" value={draft.title} onChange={event => preview(stage({ title: event.target.value }))} onBlur={() => commit()} /></label>
      <label className="field">Subtitle<input aria-label="Scene subtitle" maxLength={200} placeholder="A little more to the story" value={draft.subtitle} onChange={event => preview(stage({ subtitle: event.target.value }))} onBlur={() => commit()} /></label>
      <label className="field color-field">Text color<input aria-label="Text color" type="color" value={draft.color} onChange={event => preview(stage({ color: event.target.value }))} onBlur={() => commit()} /><span>{draft.color.toUpperCase()}</span></label>
      <div className="note"><Check size={14} /><span>Text is rendered in your video. Edits preview live and commit when you leave the field.</span></div>
    </>}

    {tab === 'color' && <>
      <div className="color-summary">
        <span>{activeFilter === 'none' ? 'Original look' : `Look: ${FILTERS.find(filter => filter.id === activeFilter)?.label} · ${Math.round(filterIntensity)}%`}</span>
        <span className="tiny-label">Non-destructive</span>
      </div>
      {COLOR_CONTROLS.map(control => <RangeField
        key={control.key}
        label={control.label}
        value={draft[control.key] ?? (control.key === 'brightness' || control.key === 'contrast' || control.key === 'saturation' ? 1 : 0)}
        min={control.min}
        max={control.max}
        step={control.step}
        onChange={value => stageColor(control.key, value)}
        onCommit={() => commit()}
      />)}
      <div className="property-actions">
        <button className="button" onClick={() => apply(COLOR_DEFAULTS, COLOR_KEYS)}><RotateCcw size={13} /> Reset color</button>
        <button className="button" onClick={() => onCopyProperties(draftRef.current)}><Copy size={13} /> Copy</button>
        <button className="button" onClick={() => { if (propertyClipboard) { apply(propertyClipboard, Object.keys(propertyClipboard) as ScenePatchKey[]); onPasteProperties(); } }} disabled={!propertyClipboard}><ClipboardPaste size={13} /> Paste</button>
      </div>
      <details className="advanced-disclosure">
        <summary>Advanced color</summary>
        <p>Curves, HSL, and LUT controls are planned for the video engine. Basic adjustments here are already non-destructive.</p>
      </details>
      <div className="note"><Check size={14} /><span>Color edits apply to preview and still-frame export without changing the source photo.</span></div>
    </>}

    {tab === 'speed' && <>
      <SectionTitle icon={<Gauge size={14} />}>SPEED</SectionTitle>
      <div className="speed-presets">{SPEED_PRESETS.map(value => <button key={value} className={`button ${Math.abs(speed - value) < 0.01 ? 'active' : ''}`} onClick={() => applySpeed(value)}>{value}×</button>)}</div>
      <RangeField label="Custom speed" value={speed} min={0.25} max={4} step={0.05} unit="×" onChange={stageSpeed} onCommit={() => applySpeed(draftRef.current.speed ?? 1)} />
      <div className="speed-summary"><span>Source duration</span><strong>{sourceDuration.toFixed(1)} s → {draft.duration.toFixed(1)} s at {speed.toFixed(2)}×</strong></div>
      <label className="field checkbox-field"><input type="checkbox" checked={draft.pitch ?? true} onChange={event => apply({ pitch: event.target.checked }, ['pitch'])} /> Maintain audio pitch</label>
      <p className="note">This photo story has no audio. The pitch preference is stored for audio clips when the video engine arrives.</p>
      <details className="advanced-disclosure">
        <summary>Advanced speed</summary>
        <p>Speed curves and reverse playback arrive with the video engine. Duration changes remain undoable and portable.</p>
      </details>
    </>}

    {tab === 'fade' && <>
      <SectionTitle icon={<Sparkles size={14} />}>OPACITY FADES</SectionTitle>
      <div className="fade-preview" aria-hidden="true">
        <span className="fade-preview-in" style={{ width: `${Math.min(100, ((draft.fadeIn ?? 0) / draft.duration) * 100)}%` }} />
        <span className="fade-preview-out" style={{ width: `${Math.min(100, ((draft.fadeOut ?? 0) / draft.duration) * 100)}%` }} />
        <span className="fade-preview-center" />
      </div>
      <RangeField label="Fade in" value={draft.fadeIn ?? 0} min={0} max={draft.duration} step={0.1} unit="sec" onChange={value => preview(stage({ fadeIn: value }))} onCommit={() => commit()} />
      <RangeField label="Fade out" value={draft.fadeOut ?? 0} min={0} max={draft.duration} step={0.1} unit="sec" onChange={value => preview(stage({ fadeOut: value }))} onCommit={() => commit()} />
      {(draft.fadeIn ?? 0) + (draft.fadeOut ?? 0) > draft.duration && <p className="fade-warning">Fade in and fade out overlap. The clip may not reach full opacity.</p>}
      <p className="note">Fades preview live at the playhead. MP4 fade rendering arrives with the video engine; still-frame export uses the selected look.</p>
    </>}

    {tab === 'filters' && <>
      <SectionTitle icon={<Sparkles size={14} />}>LOOKS</SectionTitle>
      <label className="search-field"><Search size={14} /><input aria-label="Search filters" placeholder="Search looks…" value={filterQuery} onChange={event => setFilterQuery(event.target.value)} /></label>
      <div className="filter-grid">
        {filteredFilters.map(filter => <button
          key={filter.id}
          className={`filter-card ${activeFilter === filter.id ? 'selected' : ''}`}
          onClick={() => apply({ filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity }, ['filter', 'filterIntensity'])}
          onMouseEnter={() => preview({ ...draftRef.current, filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity })}
          onMouseLeave={() => previewRef.current(null)}
          onFocus={() => preview({ ...draftRef.current, filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity })}
          onBlur={() => previewRef.current(null)}
        >
          <span className="filter-thumb"><img src={draft.image} alt="" style={{ filter: thumbnailFilterCss(filter.id, filter.id === 'none' ? 0 : 100) }} />{activeFilter === filter.id && <span className="filter-check"><Check size={11} /></span>}</span>
          <span className="filter-name">{filter.label}</span>
          <small>{filter.description}</small>
        </button>)}
      </div>
      {!filteredFilters.length && <div className="library-empty compact"><Search size={24} /><strong>No matching look.</strong><p>Try “warm”, “mono”, or clear the search.</p></div>}
      <RangeField label="Filter intensity" value={filterIntensity} min={0} max={100} step={1} unit="%" disabled={activeFilter === 'none'} onChange={value => preview(stage({ filterIntensity: value }))} onCommit={() => commit()} />
      {activeFilter === 'none' && <p className="note">Choose a look to adjust intensity. Original is always first and never changes the source image.</p>}
      <p className="note"><Sparkles size={14} /><span>Hover or focus a look to preview it in the main viewer. Click to apply.</span></p>
    </>}
  </>;
}
