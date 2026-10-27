import { useEffect, useRef, useState } from 'react';
import { resolveMediaSource } from './media-url';
/** A muted source preview, mounted and decoded only while its library tile is active. */
export function HoverVideo({ source, active, start, duration }: { source:string; active:boolean; start:number; duration:number }) {
  const video=useRef<HTMLVideoElement>(null);
  const [url,setUrl]=useState<string>();
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let cancelled=false;setUrl(undefined);setReady(false);
    if(active)void resolveMediaSource(source).then(value=>{if(!cancelled)setUrl(value);});
    return()=>{cancelled=true;video.current?.pause();};
  },[source,active]);
  if(!active||!url)return null;
  return <video ref={video} src={url} className={`source-hover-video ${ready?'ready':''}`} muted playsInline loop preload="auto" aria-hidden="true" onLoadedMetadata={event=>{event.currentTarget.currentTime=Math.min(start,Math.max(0,event.currentTarget.duration-.01));void event.currentTarget.play().catch(()=>{});}} onPlaying={()=>setReady(true)} onTimeUpdate={event=>{if(event.currentTarget.currentTime>=start+duration)event.currentTarget.currentTime=start;}} />;
}
