import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { resolveMediaSource } from '../preview/media-url';
import { spectrogramRange, spectrogramVisibleBins, type SpectrogramData } from './spectrogram-data';
import { decodableSource } from './waveform-data';
const cache=new Map<string,Promise<SpectrogramData|null>>();
let queue:Promise<unknown>=Promise.resolve();
export function decodeSpectrogram(source:string):Promise<SpectrogramData|null>{
  const hit=cache.get(source);if(hit)return hit;
  if(!globalThis.OfflineAudioContext||!globalThis.Worker||!decodableSource(source))return Promise.resolve(null);
  const task=queue.then(async()=>{
    try{
      const url=await resolveMediaSource(source);if(!url)return null;
      const response=await fetch(url);if(!response.ok)return null;
      const context=new OfflineAudioContext(1,1,22050),buffer=await context.decodeAudioData(await response.arrayBuffer());
      if(buffer.duration>900)return null;
      const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,i)=>buffer.getChannelData(i).slice());
      return await new Promise<SpectrogramData|null>(resolve=>{
        const worker=new Worker(new URL('./spectrogram-worker.ts',import.meta.url),{type:'module'});
        const timer=window.setTimeout(()=>finish(null),30000);
        function finish(value:SpectrogramData|null){window.clearTimeout(timer);worker.terminate();resolve(value);}
        worker.onmessage=event=>{const result=event.data.result??null;finish(result&&result.columns?result:null);};worker.onerror=()=>finish(null);
        worker.postMessage({channels,sampleRate:buffer.sampleRate},channels.map(c=>c.buffer));
      });
    }catch{return null;}
  });
  cache.set(source,task);queue=task.catch(()=>null);
  while(cache.size>8)cache.delete(cache.keys().next().value!);
  return task;
}
// One colour texture per analysis: trimming redraws a window of it instead of rebuilding it.
const textures=new WeakMap<SpectrogramData,HTMLCanvasElement>();
function texture(data:SpectrogramData){
  const hit=textures.get(data);if(hit)return hit;
  const canvas=document.createElement('canvas');canvas.width=data.columns;canvas.height=data.bins;
  const ctx=canvas.getContext('2d');if(!ctx)return canvas;
  const image=ctx.createImageData(data.columns,data.bins);
  const stops=[[7,9,19],[42,20,82],[116,41,139],[222,83,98],[255,177,77],[255,244,194]];
  for(let x=0;x<data.columns;x++)for(let y=0;y<data.bins;y++){
    const value=data.values[x*data.bins+y]/255*(stops.length-1),low=Math.floor(value),high=Math.min(stops.length-1,low+1),amount=value-low,index=((data.bins-1-y)*data.columns+x)*4;
    for(let c=0;c<3;c++)image.data[index+c]=Math.round(stops[low][c]*(1-amount)+stops[high][c]*amount);image.data[index+3]=255;
  }
  ctx.putImageData(image,0,0);textures.set(data,canvas);return canvas;
}
export function Spectrogram({data,sourceInSeconds,durationSeconds,sourceDurationSeconds,showStatus=true}:{data:string;sourceInSeconds:number;durationSeconds:number;sourceDurationSeconds:number;showStatus?:boolean}){
  const ref=useRef<HTMLCanvasElement>(null),[analysis,setAnalysis]=useState<SpectrogramData|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let live=true;setAnalysis(null);setFailed(false);
    if(data.length>40_000_000||sourceDurationSeconds>900){setFailed(true);return;}
    void decodeSpectrogram(data).then(result=>{if(live){setAnalysis(result);setFailed(!result);}});return()=>{live=false;};
  },[data,sourceDurationSeconds]);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    if(!analysis){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    const source=texture(analysis),range=spectrogramRange(analysis,sourceInSeconds,durationSeconds),shown=spectrogramVisibleBins(analysis);
    const draw=()=>{canvas.width=Math.max(1,Math.min(2048,Math.round(canvas.clientWidth*devicePixelRatio)));canvas.height=128;ctx.clearRect(0,0,canvas.width,canvas.height);if(range.end>range.start)ctx.drawImage(source,range.start,source.height-shown,range.end-range.start,shown,0,0,canvas.width,canvas.height);};
    draw();const observer=new ResizeObserver(draw);observer.observe(canvas);return()=>observer.disconnect();
  },[analysis,sourceInSeconds,durationSeconds]);
  return <><canvas ref={ref} className="audio-spectrogram" width={512} height={128} data-ready={Boolean(analysis)} data-columns={analysis?.columns??0} aria-hidden="true"/>{failed&&showStatus&&<span className="spectrogram-status">{t('Spectrogram unavailable')}</span>}</>;
}
