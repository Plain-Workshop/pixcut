import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, ELEMENT_COLLECTIONS, elementDisplayName } from '../src/components/elements/catalog';
import { PRESET_ICONS } from '../src/components/elements/preset-icons';
import { presetAspect, presetSize } from '../src/components/elements/designer';
import { exportBoundaries } from '../src/components/preview/export-timing';
import { emptyProject,edit,validateProject,type ElementLayer,type Scene } from '../src/stores/model';
import { TEMPLATES,buildTemplateProject } from '../src/templates/catalog';
const scene:Scene={id:'s',name:'Scene',image:'data:image/png;base64,AA==',startTicks:0,sourceInTicks:0,durationTicks:240,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'};
const base:ElementLayer={id:'e',kind:'label',x:.5,y:.5,width:.4,height:.2,rotation:0,color:'#C5B4FF',opacity:100,startTicks:0,durationTicks:240,animation:'none'};
describe('designer presets',()=>{
 it('has 22 curated collections of ten, distinct identities, usable local artwork and editable text',()=>{
  expect(ELEMENT_CATALOG).toHaveLength(220);expect(ELEMENT_COLLECTIONS).toHaveLength(22);
  expect(new Set(ELEMENT_CATALOG.map(p=>p.id)).size).toBe(220);expect(new Set(ELEMENT_CATALOG.map(p=>p.label)).size).toBe(220);
  expect(Object.keys(PRESET_ICONS).length).toBeGreaterThan(150);
  for(const [id] of ELEMENT_COLLECTIONS){const items=ELEMENT_CATALOG.filter(p=>p.collection===id);expect(items).toHaveLength(10);expect(new Set(items.map(p=>p.variant)).size).toBe(10);}
  for(const p of ELEMENT_CATALOG){expect(PRESET_ICONS[p.icon],p.id).toBeTruthy();expect(p.text.length,p.id).toBeLessThanOrEqual(80);expect(presetAspect(p)).toBeGreaterThan(0);}
 });
 it('preserves all designs, Unicode labels and behavior through schema-13 migration and reopening',()=>{
  const project=edit(emptyProject(),{type:'add',scenes:[scene]});
  for(const p of ELEMENT_CATALOG){const element={...base,kind:p.kind,presetId:p.id,label:'Twoja historia · 東京',behavior:p.behavior};const saved=validateProject({...project,schema_version:13,overlays:[element]});expect(saved.schema_version).toBe(14);expect(saved.overlays[0].presetId).toBe(p.id);expect(saved.overlays[0].label).toBe(element.label);expect(elementDisplayName(saved.overlays[0])).toBe(p.label);expect(validateProject(JSON.parse(JSON.stringify(saved)))).toEqual(saved);}
 });
 it('validates preset identifiers and tolerates a future unknown design without breaking artwork fallback',()=>{
  const p=edit(emptyProject(),{type:'add',scenes:[scene]});
  for(const presetId of ['../unsafe','UPPER CASE','',4,'a'.repeat(81)])expect(()=>validateProject({...p,overlays:[{...base,presetId}]})).toThrow('preset');
  const restored=validateProject({...p,overlays:[{...base,presetId:'future-design'}]});expect(elementDisplayName(restored.overlays[0])).toBe('Label');
 });
 it('keeps intended proportions and bounds in landscape, square and portrait formats',()=>{
  for(const p of ELEMENT_CATALOG)for(const canvas of [{width:1920,height:1080},{width:1080,height:1920},{width:1080,height:1080}]){const size=presetSize(p,canvas);expect(size.width).toBeGreaterThanOrEqual(.02);expect(size.height).toBeGreaterThanOrEqual(.02);expect(size.height).toBeLessThanOrEqual(.75);expect(size.width*canvas.width/(size.height*canvas.height)).toBeCloseTo(presetAspect(p),4);}
 });
 it('renders internal preset animation frame by frame even with a Still entrance',()=>{
  expect(exportBoundaries(scene,emptyProject().timebase,false,[{...base,presetId:'travel-01'}])).toHaveLength(241);
  expect(exportBoundaries({...scene,elements:[{...base,presetId:'travel-01'}]},emptyProject().timebase,false)).toHaveLength(241);
 });
 it('creates every bundled photo/video template without the removed decorative shapes',async()=>{
  for(const t of TEMPLATES){const p=await buildTemplateProject(t,[],async()=>scene.image,async()=> 'data:video/mp4;base64,AA==',async()=>scene.image,async()=> 'data:audio/mp4;base64,AA==');expect(p.tracks[0].clips.length,t.id).toBeGreaterThan(0);for(const clip of p.tracks[0].clips)expect(clip.elements??[],t.id).toHaveLength(0);}
 });
});
