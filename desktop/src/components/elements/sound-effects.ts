import { secondsToTicks, ticksToSeconds, totalTicks, type AudioClip, type Project } from '../../stores/model';
import { bellSound } from './sound';
export const SOUND_EFFECTS = [
  {id:'bell',label:'Bell ring',seconds:1.8}, {id:'click',label:'Subscribe click',seconds:.18},
  {id:'pop',label:'Like pop',seconds:.35}, {id:'whoosh',label:'Soft whoosh',seconds:.55},
  {id:'success',label:'Success chime',seconds:.8}, {id:'shutter',label:'Camera shutter',seconds:.2},
] as const;
export type SoundEffectId = typeof SOUND_EFFECTS[number]['id'];
const cache = new Map<SoundEffectId,string>();
/** Deterministic local PCM effects; the same WAV goes to preview and FFmpeg. */
export function soundEffectData(id: SoundEffectId): string {
  if(id==='bell')return bellSound(1.8,false);
  const existing=cache.get(id);if(existing)return existing;
  const spec=SOUND_EFFECTS.find(s=>s.id===id)!,rate=22050,count=Math.ceil(spec.seconds*rate);
  const bytes=new Uint8Array(44+count*2),v=new DataView(bytes.buffer);
  const word=(at:number,s:string)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  word(0,'RIFF');v.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,count*2,true);
  let noise=1977;
  for(let i=0;i<count;i++){
    const t=i/rate,p=t/spec.seconds;noise=(noise*1664525+1013904223)>>>0;const n=noise/2147483648-1;
    const envelope=Math.min(1,p*20)*Math.exp(-p*7);
    let signal=0;
    if(id==='click')signal=(Math.sin(2*Math.PI*1800*t)*.35+n*.65)*envelope;
    if(id==='pop')signal=Math.sin(2*Math.PI*(650*t-650*t*t))*envelope;
    if(id==='whoosh')signal=n*Math.pow(Math.sin(Math.PI*p),3)*.35;
    if(id==='shutter')signal=n*(Math.exp(-t*65)+.65*Math.exp(-Math.max(0,t-.07)*90)*(t>.07?1:0))*Math.min(1,t*1000);
    if(id==='success'){const local=t<.2?t:t-.2;signal=Math.sin(2*Math.PI*(t<.2?659:988)*local)*Math.exp(-local*8)*Math.min(1,local*200)*Math.min(1,(spec.seconds-t)*100);}
    v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,signal*.55))*32767),true);
  }
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const data=`data:audio/wav;base64,${btoa(binary)}`;cache.set(id,data);return data;
}
export function createSoundEffectClip(project: Project,id:SoundEffectId,startTicks:number): AudioClip | null {
  const total=totalTicks(project);if(!total)return null;
  const spec=SOUND_EFFECTS.find(s=>s.id===id)!;
  const start=Math.round(Math.min(total-1,Math.max(0,startTicks)));
  const durationTicks=Math.min(total-start,Math.max(1,secondsToTicks(spec.seconds,project.timebase)));
  const lane=Array.from({length:8},(_,i)=>i).find(i=>!project.audio.some(c=>(c.lane??0)===i&&c.startTicks<start+durationTicks&&c.startTicks+c.durationTicks>start));
  return {id:crypto.randomUUID(),name:spec.label,data:soundEffectData(id),lane:lane??7,startTicks:start,durationTicks,sourceInSeconds:0,sourceDurationSeconds:spec.seconds,volume:.65,fadeIn:0,fadeOut:Math.min(.03,ticksToSeconds(durationTicks,project.timebase)/4)};
}
