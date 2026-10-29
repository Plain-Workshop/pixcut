import { t } from '../../i18n';
import type { AudioClip, ElementBehavior, ElementLayer } from '../../stores/model';
import { defaultElementSize } from './geometry';
import { isDynamicElement } from './dynamic';

type Props = { canvas: { width: number; height: number }; element: ElementLayer; audio: AudioClip[]; update: (patch: Partial<ElementLayer>) => void; stage: (patch: Partial<ElementLayer>) => void; commit: () => void; preview: (seconds: number) => void };
export function BehaviorControls({ canvas, element, audio, update, stage, commit, preview }: Props) {
  const b = element.behavior ?? {}, kind = element.kind;
  const numeric = (key: keyof ElementBehavior, label: string, fallback: number, min: number, max: number, step = .1) => <label className="field">{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={typeof b[key] === 'number' ? b[key] as number : fallback} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n)) stage({ behavior: { ...b, [key]: Math.max(min, Math.min(max, n)) } }); }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit(); }} /></label>;
  return <>
    {(isDynamicElement(kind) || (kind === 'device' && !element.presetId)) && <details className="element-behavior" open><summary>{kind === 'device' ? 'Frame style' : 'Timeline behavior'}</summary>
      {kind === 'mouse' && <label className="field">{t('Interaction')}<select aria-label={t('Mouse interaction')} value={b.variant ?? 'click'} onChange={event => update({ behavior: { ...b, variant: event.target.value as ElementBehavior['variant'] } })}><option value="click">{t('Click ripple')}</option><option value="double-click">{t('Double click')}</option><option value="drag">{t('Drag gesture')}</option></select></label>}
      {kind === 'device' && <><label className="field">{t('Frame')}<select aria-label={t('Device frame style')} value={b.variant ?? 'browser'} onChange={event => { const phone = event.target.value === 'phone'; update({ behavior: { ...b, variant: phone ? 'phone' : 'browser' }, ...(phone ? { width: .22, height: Math.min(.95, .22 * canvas.width / canvas.height / .5) } : defaultElementSize('device', canvas)) }); }}><option value="browser">{t('Browser window')}</option><option value="phone">{t('Phone')}</option></select></label><p className="note">{t('Place this above an image or video overlay. The screen stays transparent.')}</p></>}
      {kind === 'waveform' ? <><label className="field">{t('React to audio')}<select aria-label={t('Waveform audio source')} value={b.audioId ?? ''} onChange={event => update({ behavior: { ...b, audioId: event.target.value || undefined } })}><option value="">{t('All audio tracks')}</option>{audio.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)}</select></label><p className="note">Uses local audio tracks, including trim, volume and fades. Silence appears flat.{audio.length === 0 ? ' Add audio to see it react.' : ''}</p></> : kind !== 'device' && <>
        {numeric('atSeconds', kind === 'message' ? 'Reveal message after (s)' : 'Action starts after (s)', 1, 0, 3600)}
        {kind !== 'message' && numeric('intervalSeconds', kind === 'mouse' || kind === 'keycaps' ? 'Repeat interval / drag duration (s)' : kind === 'comparison' ? 'Sweep duration (s)' : 'Step interval (s)', 1, .1, 60)}
        {kind === 'countdown' && <div className="overlay-timing">{numeric('countFrom', 'Count from', 5, 0, 9999, 1)}{numeric('countTo', 'Count to', 0, 0, 9999, 1)}</div>}
        {kind === 'rating' && numeric('countFrom', 'Stars', 5, 0, 5, 1)}
        {kind !== 'message' && <label className="checkbox-field"><input type="checkbox" checked={b.repeat ?? false} onChange={event => update({ behavior: { ...b, repeat: event.target.checked } })} />{t('Repeat behavior')}</label>}
        <button className="button" onClick={() => preview(b.atSeconds ?? 1)}>{t('Preview action')}</button>
      </>}
    </details>}
    {kind === 'device' && element.presetId && <p className="note">The screen is transparent. Place an image or video underneath; choose another frame from the library to change its style.</p>}
    {kind === 'comparison' && <p className="note">{t('Labels and divider only. Position over your before/after media.')}</p>}
    {kind === 'end-screen' && <p className="note">{t('Place image or video overlays inside the two transparent frames.')}</p>}
    {kind === 'qr' && <p className="note">{t('Enter a link or text below. The QR code is generated offline.')}</p>}
    <label className="field">{t('Exit')}<select aria-label={t('Element exit')} value={element.exit ?? 'none'} onChange={event => update({ exit: event.target.value as ElementLayer['exit'] })}><option value="none">{t('None')}</option><option value="fade">{t('Fade out')}</option><option value="slide-down">{t('Slide down + fade')}</option></select></label>
  </>;
}
