export type InspectorKind = 'scene' | 'text' | 'element' | 'audio' | 'none';
/** A browser tab never changes which object its inspector edits. */
export function inspectorKind(target: Exclude<InspectorKind,'none'>, selected: {scene:boolean;text:boolean;element:boolean;audio:boolean}):InspectorKind {
  if (target==='audio') return selected.audio?'audio':'none';
  if (target==='element') return selected.element?'element':'none';
  if (target==='text') return selected.text&&selected.scene?'text':'none';
  return selected.scene?'scene':'none';
}
