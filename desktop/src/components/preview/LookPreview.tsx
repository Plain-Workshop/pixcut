import { useEffect,useRef,useState } from 'react';
import type { FilterId,Scene } from '../../stores/model';
import { drawScene } from './render';
/** Real local image/video poster, framing and color processing; no CSS approximation. */
export function LookPreview({scene,filter,intensity}:{scene:Scene;filter:FilterId;intensity:number}){
 const ref=useRef<HTMLCanvasElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let live=true;setFailed(false);
  const sample={...scene,filter,filterIntensity:intensity,textLayers:[],elements:[],title:'',subtitle:'',motion:'none' as const,fadeIn:0,fadeOut:0};
  const canvas=document.createElement('canvas');
  void drawScene(canvas,sample,'16:9','thumb',0,undefined,{width:240,height:135}).then(()=>{if(live&&ref.current){ref.current.width=240;ref.current.height=135;ref.current.getContext('2d')?.drawImage(canvas,0,0);}}).catch(()=>{if(live)setFailed(true);});
  return()=>{live=false;};
 },[scene,filter,intensity]);
 return <><canvas ref={ref} data-look={filter} aria-hidden="true"/>{failed&&<span className="look-unavailable">Preview unavailable</span>}</>;
}
