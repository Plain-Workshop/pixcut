import { describe, expect, it } from 'vitest';
import { inspectorKind } from '../src/app/inspector';
import { animationSelection, ELEMENT_ANIMATIONS, elementMotion, isContinuousMotion, motionPreviewSeconds } from '../src/components/elements/motion';
import { elementAnimationTime } from '../src/components/elements/animation-time';
import { elementTransform } from '../src/components/elements/transform';
import { emptyProject, type ElementLayer } from '../src/stores/model';
const selected={scene:true,text:true,element:true,audio:true};
describe('selection-driven inspector',()=>{
 it('shows only the actively selected item, regardless of other stored selections',()=>{
  for(const target of ['scene','text','element','audio'] as const)expect(inspectorKind(target,selected)).toBe(target);
  expect(inspectorKind('audio',{...selected,scene:false})).toBe('audio');
  expect(inspectorKind('element',{...selected,scene:false})).toBe('element');
 });
 it('does not fall back to scene controls when an item selection becomes stale',()=>{
  for(const target of ['text','element','audio'] as const)expect(inspectorKind(target,{...selected,[target]:false})).toBe('none');
  expect(inspectorKind('scene',{...selected,scene:false})).toBe('none');
 });
});
describe('all motion previews and continuous playback',()=>{
 it('defaults continuous motions to repeat and entrances to once',()=>{
  for(const [id] of ELEMENT_ANIMATIONS)expect(animationSelection(id)).toEqual({animation:id,loop:['pulse','float','swing'].includes(id)});
 });
 it('keeps pulse, float and swing moving after several seconds in the shared renderer transform',()=>{
  for(const animation of ['pulse','float','swing'] as const){
   const e:ElementLayer={id:'e',kind:'name-tag',x:.5,y:.5,width:.4,height:.2,color:'#C5B4FF',opacity:100,rotation:0,startTicks:0,durationTicks:300,...animationSelection(animation)};
   const samples=[3.1,3.4,3.8,4.3].map(t=>JSON.stringify(elementTransform(e,t,emptyProject().timebase)));
   expect(new Set(samples).size,animation).toBeGreaterThan(2);
   expect(elementAnimationTime(e,4)).toBeGreaterThan(3);
  }
 });
 it('gives every animated demo changing frames and leaves Still stable',()=>{
  for(const [id] of ELEMENT_ANIMATIONS){const frames=[.1,.35,.6,1.1].map(t=>JSON.stringify(elementMotion(id,motionPreviewSeconds(id,t))));expect(new Set(frames).size,id)[id==='none'?'toBe':'toBeGreaterThan'](id==='none'?1:1);}
  expect(isContinuousMotion('spin')).toBe(false);expect(motionPreviewSeconds('float',5)).toBe(5);
 });
});
