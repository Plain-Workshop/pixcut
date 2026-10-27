import { describe, expect, it } from 'vitest';
import { SOUND_EFFECTS, soundEffectData, createSoundEffectClip } from '../src/components/elements/sound-effects';
import { emptyProject, edit, validateProject, type Scene } from '../src/stores/model';
const scene:Scene={id:'s',name:'Scene',image:'data:image/png;base64,AA==',startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'};
describe('local sound effects',()=>{
 it('creates distinct audible PCM files with exact lengths and smooth endings',()=>{
  const sources=new Set<string>();
  for(const effect of SOUND_EFFECTS){
   const data=soundEffectData(effect.id);expect(soundEffectData(effect.id)).toBe(data);sources.add(data);
   const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0)),v=new DataView(bytes.buffer);
   expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('RIFF');
   expect(v.getUint32(24,true)).toBe(22050);expect((bytes.length-44)/2/22050).toBeCloseTo(effect.seconds,3);
   let peak=0,active=0;for(let i=44;i<bytes.length;i+=2){const n=Math.abs(v.getInt16(i,true));peak=Math.max(peak,n);if(n>100)active++;}
   expect(peak,effect.id).toBeGreaterThan(1000);expect(active,effect.id).toBeGreaterThan(200);expect(Math.abs(v.getInt16(bytes.length-2,true))).toBeLessThan(300);
  }
  expect(sources.size).toBe(SOUND_EFFECTS.length);
 });
 it('fits the project, chooses a free lane and round-trips through the project model',()=>{
  let project=edit(emptyProject(),{type:'add',scenes:[scene]});
  const first=createSoundEffectClip(project,'bell',30)!;project=edit(project,{type:'audio',audio:[first]});
  const second=createSoundEffectClip(project,'click',30)!;expect(second.lane).not.toBe(first.lane);
  const tail=createSoundEffectClip(project,'whoosh',119)!;expect(tail.durationTicks).toBe(1);
  const saved=validateProject({...project,audio:[first,second,tail]});expect(saved.audio).toHaveLength(3);expect(saved.audio[1].startTicks).toBe(30);
  expect(createSoundEffectClip(emptyProject(),'bell',0)).toBeNull();
 });
});
