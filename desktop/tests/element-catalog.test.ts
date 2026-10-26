import { describe, it, expect } from 'vitest';
import { ELEMENT_CATALOG, elementDisplayName } from '../src/components/elements/catalog';
import { defaultElementSize } from '../src/components/elements/geometry';
import { ELEMENT_LABEL_DEFAULTS } from '../src/components/elements/symbols';
import { emptyProject, edit, validateProject, type ElementLayer, type Scene } from '../src/stores/model';
const scene: Scene = { id:'s',name:'Photo',image:'data:image/png;base64,AA==',startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#FFFFFF',fit:'cover' };
const base: ElementLayer = { id:'e',kind:'label',x:.5,y:.5,width:.4,height:.2,rotation:0,opacity:100,color:'#E6F2D8',animation:'fade',startTicks:0,durationTicks:120 };
describe('curated element library',()=>{
 it('offers exactly 200 curated compositions without standalone primitive shapes',()=>{
  expect(ELEMENT_CATALOG).toHaveLength(200);
  expect(new Set(ELEMENT_CATALOG.map(p=>p.id)).size).toBe(200);
  expect(new Set(ELEMENT_CATALOG.map(p=>p.label)).size).toBe(200);
  for(const kind of ['rectangle','ellipse','triangle','star','line','arrow','sparkle','heart','burst','dots','tape'])expect(ELEMENT_CATALOG.some(e=>e.kind===kind)).toBe(false);
 });
 it('migrates v11 and preserves all new editable elements across reopening',()=>{
  for(const kind of ['label','name-tag','link','quote','counter','status'] as const){
   const project=edit(emptyProject(),{type:'add',scenes:[scene]});project.overlays=[{...base,kind,label:'Za kulisami · 東京'}];
   const restored=validateProject(JSON.parse(JSON.stringify({...project,schema_version:11})));
   expect(restored.schema_version).toBe(14);expect(restored.overlays[0].label).toBe('Za kulisami · 東京');expect(ELEMENT_LABEL_DEFAULTS[kind]).toBeTruthy();
  }
 });
 it('retains old artwork and names without reintroducing it into the picker',()=>{
  const project=validateProject({...edit(emptyProject(),{type:'add',scenes:[scene]}),schema_version:11,overlays:[{...base,kind:'arrow'}]});
  expect(project.overlays[0].kind).toBe('arrow');expect(elementDisplayName(project.overlays[0])).toBe('Arrow');
 });
 it('keeps label and name-card proportions consistent across video formats',()=>{
  for(const canvas of [{width:1920,height:1080},{width:1080,height:1920}]){
   for(const kind of ['label','name-tag','link','quote','status'] as const){const size=defaultElementSize(kind,canvas);expect(size.width*canvas.width).toBeGreaterThan(size.height*canvas.height*2);}
  }
 });
});
