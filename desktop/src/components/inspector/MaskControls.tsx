import { RangeField } from './NumberField';
import { defaultLayerMask, type LayerMask, type MaskShape } from '../../stores/model';
import { t } from '../../i18n';

const SHAPES: { id: MaskShape; label: string }[] = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'star', label: 'Star' },
];

function ShapeSlider({ label, value, min, max, step, unit, disabled, onChange, onCommit }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return <RangeField label={label} sliderLabel={`Mask ${label.toLowerCase()}`} unit={unit.trim()} min={min} max={max} step={step} value={value} disabled={disabled} onChange={onChange} onCommit={onCommit} />;
}

/**
 * Shape mask editor for image and video overlays. Geometry is stored relative
 * to the overlay box, so it follows position, scale and keyframes.
 */
export function MaskControls({ mask, disabled, context = 'overlay', onStage, onCommit, onApply }: {
  mask?: LayerMask;
  disabled?: boolean;
  context?: 'overlay' | 'scene';
  onStage: (mask: LayerMask | undefined) => void;
  onCommit: () => void;
  onApply: (mask: LayerMask | undefined) => void;
}) {
  const current = mask ?? defaultLayerMask('rectangle');
  return <details className="advanced-disclosure mask-controls">
    <summary>{t('Shape mask')}{mask ? ` · ${SHAPES.find(shape => shape.id === mask.shape)?.label ?? mask.shape}` : ''}</summary>
    <div className="mask-row">
      <label className="field">Shape<select aria-label="Overlay mask shape" value={mask?.shape ?? 'none'} disabled={disabled} onChange={event => {
        const shape = event.target.value;
        onApply(shape === 'none' ? undefined : { ...current, shape: shape as MaskShape });
      }}><option value="none">None</option>{SHAPES.map(shape => <option key={shape.id} value={shape.id}>{shape.label}</option>)}</select></label>
      {mask && <button type="button" className="text-button" disabled={disabled} onClick={() => onApply({ ...mask, x: .5, y: .5, width: .82, height: .82, rotation: 0 })}>Center</button>}
    </div>
    {mask ? <>
      <p className="inspector-inline-status">{context === 'scene' ? "The cutout applies to the photo only; the framing background stays visible outside it. Feathering is baked into exports." : "The cutout follows the overlay's move, scale and keyframes. Feathering is baked into exports."}</p>
      <div className="mask-grid">
        <ShapeSlider label="Center X" value={mask.x} min={0} max={1} step={.01} unit="" disabled={disabled} onChange={value => onStage({ ...mask, x: value })} onCommit={onCommit} />
        <ShapeSlider label="Center Y" value={mask.y} min={0} max={1} step={.01} unit="" disabled={disabled} onChange={value => onStage({ ...mask, y: value })} onCommit={onCommit} />
        <ShapeSlider label="Width" value={mask.width} min={.05} max={1} step={.01} unit="" disabled={disabled} onChange={value => onStage({ ...mask, width: value })} onCommit={onCommit} />
        <ShapeSlider label="Height" value={mask.height} min={.05} max={1} step={.01} unit="" disabled={disabled} onChange={value => onStage({ ...mask, height: value })} onCommit={onCommit} />
        <ShapeSlider label="Rotation" value={mask.rotation} min={-180} max={180} step={1} unit="°" disabled={disabled} onChange={value => onStage({ ...mask, rotation: value })} onCommit={onCommit} />
        <ShapeSlider label="Feather" value={mask.feather} min={0} max={100} step={1} unit="%" disabled={disabled} onChange={value => onStage({ ...mask, feather: value })} onCommit={onCommit} />
      </div>
      <div className="mask-footer">
        <label className="checkbox-field"><input type="checkbox" checked={mask.invert} disabled={disabled} onChange={event => onApply({ ...mask, invert: event.target.checked })} /> Invert mask</label>
        <button type="button" className="text-button danger" disabled={disabled} onClick={() => onApply(undefined)}>Remove mask</button>
      </div>
    </> : <button type="button" className="button" disabled={disabled} onClick={() => onApply(defaultLayerMask('rectangle'))}>Add shape mask</button>}
  </details>;
}
