import { exportBoundaries } from '../src/components/preview/export-timing';
import { describe, expect, it } from 'vitest';
import { audioGain, behaviorTime, clickPulses, completedItems, countdownValue, waveformBars } from '../src/components/elements/dynamic';
import { qrModules } from '../src/components/elements/qr';
import { elementTransform } from '../src/components/elements/transform';
import { emptyProject, edit, validateProject, type AudioClip, type ElementLayer, type Scene } from '../src/stores/model';
const tb = emptyProject().timebase;
const base: ElementLayer = { id:'e',kind:'countdown',x:.5,y:.5,width:.3,height:.3,rotation:0,color:'#C5B4FF',opacity:100,startTicks:60,durationTicks:300,animation:'none',behavior:{atSeconds:1,intervalSeconds:.5,countFrom:3,countTo:0} };
const clip: AudioClip = {id:'a',name:'Audio',data:'data:audio/wav;base64,AA==',lane:0,startTicks:30,durationTicks:120,sourceInSeconds:2,sourceDurationSeconds:10,volume:.5,fadeIn:1,fadeOut:1};
const scene: Scene = {id:'s',name:'Scene',image:'data:image/png;base64,AA==',startTicks:0,sourceInTicks:0,durationTicks:600,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'};
describe('timeline-driven elements',()=>{
 it('counts down/up deterministically, holds the end value and can repeat',()=>{
  expect([0,1,1.5,2,2.5,9].map(t=>countdownValue(base,t))).toEqual([3,3,2,1,0,0]);
  expect(countdownValue({...base,behavior:{...base.behavior,countFrom:0,countTo:3}},2)).toBe(2);
  expect(countdownValue({...base,behavior:{...base.behavior,repeat:true}},3)).toBe(3);
  expect(countdownValue(base,1.5)).toBe(2); // scrubbing backwards has no event state
 });
 it('checks items at exact boundaries and preserves actions before/after seeking',()=>{
  expect([.9,1,1.5,2,9].map(t=>completedItems(base,t,3))).toEqual([0,1,2,3,3]);
  expect(completedItems({...base,behavior:{...base.behavior,repeat:true}},2.5,3)).toBe(0);
 });
 it('shows two distinct click ripples and repeat timing without idle replay',()=>{
  const mouse={...base,behavior:{atSeconds:2,variant:'double-click' as const}};
  expect(clickPulses(mouse,1)).toEqual([]);expect(clickPulses(mouse,2.3)).toHaveLength(2);expect(clickPulses(mouse,3)).toEqual([]);
  expect(behaviorTime({...base,behavior:{atSeconds:1,intervalSeconds:2,repeat:true}},5.2).phase).toBeCloseTo(.2);
 });
 it('matches audio trim placement, volume, silence and fades',async()=>{
  expect(audioGain(clip,.9,tb)).toBe(0);expect(audioGain(clip,1,tb)).toBe(0);expect(audioGain(clip,1.5,tb)).toBe(.25);expect(audioGain(clip,3,tb)).toBe(.5);expect(audioGain(clip,4.5,tb)).toBe(.25);expect(audioGain(clip,5,tb)).toBe(0);
  expect(await waveformBars(base,0,[clip],tb)).toEqual(new Array(32).fill(0));
  expect(await waveformBars({...base,behavior:{audioId:'other'}},3,[clip],tb)).toEqual(new Array(32).fill(0));
 });
 it('shares exit fading and position between hitboxes and rendered artwork',()=>{
  const e={...base,exit:'slide-down' as const};
  expect(elementTransform(e,9,tb).alpha).toBe(1);expect(elementTransform(e,9.8,tb).alpha).toBeCloseTo(.5);expect(elementTransform(e,9.8,tb).y).toBeCloseTo(.035);
 });
 it('generates QR finder patterns and distinct UTF-8 payloads locally',()=>{
  const a=qrModules('https://example.com'),b=qrModules('https://example.com/東京');
  expect(a.length%4).toBe(1);expect(a[0].slice(0,7)).toEqual(new Array(7).fill(true));expect(a[1].slice(0,7)).toEqual([true,false,false,false,false,false,true]);expect(a).not.toEqual(b);
 });
 it('migrates old projects and round-trips every new element and its behavior',()=>{
  for(const kind of ['caption','chapter','callout','keycaps','mouse','device','comparison','checklist','rating','countdown','waveform','message','qr','end-screen'] as const){
   const p=edit(emptyProject(),{type:'add',scenes:[scene]});p.overlays=[{...base,kind,label:'Za kulisami · 東京',exit:'fade'}];
   const saved=JSON.parse(JSON.stringify({...p,schema_version:12}));const restored=validateProject(saved);
   expect(restored.schema_version).toBe(14);expect(restored.overlays[0]).toMatchObject(p.overlays[0]);expect(validateProject(JSON.parse(JSON.stringify(restored)))).toEqual(restored);
  }
 });
 it('renders dynamic content and exits at every frame in both photo export planners',()=>{
  for(const kind of ['countdown','mouse','waveform','checklist','message','keycaps','comparison','rating'] as const){
   expect(exportBoundaries(scene,tb,false,[{...base,kind}])).toHaveLength(601);
   expect(exportBoundaries({...scene,elements:[{...base,kind}]},tb,false)).toHaveLength(601);
  }
  expect(exportBoundaries(scene,tb,false,[{...base,kind:'label',exit:'fade'}])).toHaveLength(601);
  expect(exportBoundaries(scene,tb,false,[{...base,kind:'label'}]).length).toBeLessThan(10);
 });
 it('rejects malformed settings with actionable errors',()=>{
  const p=edit(emptyProject(),{type:'add',scenes:[scene]});
  for(const behavior of [{atSeconds:-1},{intervalSeconds:0},{countFrom:Infinity},{repeat:'yes'},{variant:'unknown'},{audioId:3},[]]) expect(()=>validateProject({...p,overlays:[{...base,behavior}]})).toThrow(/dynamic|waveform/i);
  expect(()=>validateProject({...p,overlays:[{...base,exit:'unknown'}]})).toThrow('exit');
  expect(validateProject({...p,overlays:[{...base,behavior:{atSeconds:null,countFrom:null}}]}).overlays[0].behavior?.atSeconds).toBeUndefined();
 });
});
