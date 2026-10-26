import { useRef } from 'react';
import { limitElementText } from '../text/language';

export function ElementTextField({ value, stage, commit }: { value: string; stage: (value: string) => void; commit: () => void }) {
  const composing = useRef(false);
  const finish = (value: string) => { stage(limitElementText(value)); commit(); };
  return <label className="field">Element text
    <textarea aria-label="Element text" dir="auto" rows={2} value={value}
      placeholder="Your text, in any language"
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={event => { composing.current = false; finish(event.currentTarget.value); }}
      onChange={event => stage(composing.current ? event.target.value : limitElementText(event.target.value))}
      onKeyUp={event => { if (!composing.current && !event.nativeEvent.isComposing) commit(); }}
      onBlur={event => { composing.current = false; finish(event.currentTarget.value); }} />
    <small>Type or paste in your language. Up to 80 characters.</small>
  </label>;
}
