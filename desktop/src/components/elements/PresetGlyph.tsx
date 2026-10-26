import { createElement } from 'react';
import { elementPreset } from './catalog';
import { PRESET_ICONS } from './preset-icons';
export function PresetGlyph({id,size=18}:{id:string;size?:number}) {
  const preset=elementPreset({presetId:id});
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(PRESET_ICONS[preset?.icon??'']??[]).map(([tag,attrs],index)=>createElement(tag,{...attrs,key:index}))}</svg>;
}
