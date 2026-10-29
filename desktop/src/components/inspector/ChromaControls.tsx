import { t } from '../../i18n';
import { RangeField } from './NumberField';
import { defaultChromaKey, type ChromaKey } from '../../stores/model';

function ChromaSlider({ label, value, disabled, onChange, onCommit }: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return <RangeField label={label} sliderLabel={`Chroma ${label.toLowerCase()}`} unit="%" min={0} max={100} step={1} value={value} disabled={disabled} onChange={onChange} onCommit={onCommit} />;
}

/** Green-screen/colour-distance key for image and video overlays. */
export function ChromaControls({ chroma, disabled, onStage, onCommit, onApply }: {
  chroma?: ChromaKey;
  disabled?: boolean;
  onStage: (chroma: ChromaKey) => void;
  onCommit: () => void;
  onApply: (chroma: ChromaKey | undefined) => void;
}) {
  return <details className="advanced-disclosure mask-controls chroma-controls">
    <summary>Chroma key{chroma ? ' · on' : ''}</summary>
    {chroma ? <>
      <p className="inspector-inline-status">Removes a colour from this overlay. The transparent result is baked into preview, still frames and export.</p>
      <label className="field color-field">{t('Key colour')}<input aria-label={t('Chroma key colour')} type="color" value={chroma.color} disabled={disabled} onChange={event => onStage({ ...chroma, color: event.target.value })} onBlur={onCommit} /><span>{chroma.color.toUpperCase()}</span></label>
      <div className="mask-grid">
        <ChromaSlider label="Similarity" value={chroma.similarity} disabled={disabled} onChange={value => onStage({ ...chroma, similarity: value })} onCommit={onCommit} />
        <ChromaSlider label="Softness" value={chroma.softness} disabled={disabled} onChange={value => onStage({ ...chroma, softness: value })} onCommit={onCommit} />
        <ChromaSlider label="Spill" value={chroma.spill} disabled={disabled} onChange={value => onStage({ ...chroma, spill: value })} onCommit={onCommit} />
      </div>
      <div className="mask-footer"><span /><button type="button" className="text-button danger" disabled={disabled} onClick={() => onApply(undefined)}>{t('Remove key')}</button></div>
    </> : <button type="button" className="button" disabled={disabled} onClick={() => onApply(defaultChromaKey())}>{t('Add chroma key')}</button>}
  </details>;
}
