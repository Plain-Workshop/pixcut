import { describe, it, expect } from 'vitest';
import { emptyProject, edit, validateProject, DEFAULT_TIMEBASE, type ElementLayer, type Scene } from '../src/stores/model';
import { timelineOverlays, replaceOverlay, constrainOverlay } from '../src/components/elements/overlays';
import { elementMotion } from '../src/components/elements/motion';
import { elementAnimationTime } from '../src/components/elements/animation-time';
import { actionTransform } from '../src/components/elements/action';
import { actionAudio } from '../src/components/elements/sound';
import { exportBoundaries } from '../src/components/preview/export-timing';
import { framingTravel } from '../src/components/preview/framing';
import { exportEta, exportOutputFormat } from '../src/app/export-progress';
const element: ElementLayer = { id:'e', kind:'bell', x:.5,y:.5,width:.2,height:.2,color:'#FFCC66',rotation:0,opacity:100,startTicks:0,durationTicks:120,animation:'fade',loop:false };
const scene: Scene = {id:'s',name:'Photo',image:'data:image/png;base64,AA==',startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'};
const project = () => edit(emptyProject(),{type:'add',scenes:[scene,{...scene,id:'s2'}]});
describe('independent overlays',()=>{
 it('moves a full-length overlay later by trimming its end rather than blocking Start',()=>{
   expect(constrainOverlay({...element,durationTicks:240},240,{startTicks:60})).toMatchObject({startTicks:60,durationTicks:180});
 });
 it('spans scene cuts and survives v10 migration and JSON reopening',()=>{
   const p=edit(project(),{type:'overlays',overlays:[{...element,startTicks:60,durationTicks:180}]});
   const restored=validateProject(JSON.parse(JSON.stringify({...p,schema_version:10})));
   expect(edit(restored,{type:'removeMany',ids:['s','s2']}).overlays).toEqual([]);
   expect(restored.schema_version).toBe(15);expect(restored.overlays[0]).toMatchObject({startTicks:60,durationTicks:180});
   expect(exportBoundaries(restored.tracks[0].clips[1],p.timebase,false,p.overlays)).toHaveLength(121);
 });
 it('promotes legacy scene layers without changing their project start or duplicating them',()=>{
   const p=edit(emptyProject(),{type:'add',scenes:[scene,{...scene,id:'second',elements:[{...element,startTicks:30,durationTicks:90}]}]});
   const legacy=timelineOverlays(p)[0];expect(legacy.startTicks).toBe(150);
   const next=validateProject(replaceOverlay(p,legacy,{...legacy,durationTicks:90,x:.3}));
   expect(next.tracks[0].clips[1].elements).toEqual([]);expect(timelineOverlays(next)).toHaveLength(1);expect(next.overlays[0].startTicks).toBe(150);
 });
 it('fades in once and rings later with an independently timed sound',()=>{
   const e={...element,durationTicks:210,action:{kind:'ring' as const,startTicks:90,durationTicks:60,repeat:false,sound:true}};
   expect(elementMotion(e.animation,elementAnimationTime(e,.3)).alpha).toBeLessThan(1);
   expect(elementMotion(e.animation,elementAnimationTime(e,2)).alpha).toBe(1);
   expect(actionTransform(e,2,DEFAULT_TIMEBASE).rotation).toBe(0);
   expect(actionTransform(e,3.2,DEFAULT_TIMEBASE).rotation).not.toBe(0);
   expect(actionTransform(e,5.1,DEFAULT_TIMEBASE).rotation).toBe(0);
   const p=edit(project(),{type:'overlays',overlays:[{...e,startTicks:30}]});const cues=actionAudio(p);
   expect(cues[0]).toMatchObject({startTicks:120,durationTicks:60});expect(cues[0].data).toMatch(/^data:audio\/wav;base64,/);
   const bytes=Uint8Array.from(atob(cues[0].data.split(',')[1]),c=>c.charCodeAt(0));expect([...bytes.slice(44)].some(n=>n!==0)).toBe(true);
   expect(validateProject({...p,audio:cues}).audio).toHaveLength(1);
 });
 it('rejects remote global media and invalid actions',()=>{
   expect(()=>edit(project(),{type:'overlays',overlays:[{...element,kind:'image',source:'https://example.com/a.png'}]})).toThrow();
   expect(()=>edit(project(),{type:'overlays',overlays:[{...element,action:{kind:'ring',startTicks:-1,durationTicks:30,repeat:false,sound:true}}]})).toThrow();
 });
 it('uses the same framing travel for canvas and dragging without adding zoom',()=>{
   expect(framingTravel({width:1920,height:1080},{width:1920,height:1080},'cover',1)).toEqual({x:480,y:270});
   expect(framingTravel({width:1920,height:1080},{width:1920,height:1080},'cover',2)).toEqual({x:960,y:540});
 });
 it('provides an approximate remaining time after enough progress is known',()=>{
   expect(exportEta(1,1)).toContain('Estimating');expect(exportEta(10,50)).toContain('10 s');
 });
});

it('uses the selected output dimensions, rate and quality consistently in export UI and jobs', () => {
  expect(exportOutputFormat(project().formats[0], '720', 'high', '24')).toMatchObject({ width: 1280, height: 720, fps: 24, quality: 'high' });
});

it('keeps preview selection geometry aligned with entrance and later action transforms', async () => {
  const { elementTransform } = await import('../src/components/elements/transform');
  const e = { ...element, animation: 'slide-up' as const, action: { kind: 'ring' as const, startTicks: 0, durationTicks: 90, repeat: false, sound: false } };
  const pose = elementTransform(e, .2, DEFAULT_TIMEBASE);
  expect(pose.y).toBeGreaterThan(0);
  expect(pose.rotation).toBe(actionTransform(e, .2, DEFAULT_TIMEBASE).rotation);
  expect(elementTransform(e, 4, DEFAULT_TIMEBASE)).toMatchObject({ x: 0, y: 0, scale: 1, rotation: 0, alpha: 1 });
});
