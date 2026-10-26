import { elementPreset } from './catalog';
import { presetSize } from './designer';
import { defaultElementSize } from './geometry';
import { isDynamicElement } from './dynamic';
import { useEffect, useRef } from 'react';
import { elementMotion, motionPreviewSeconds } from './motion';
import { drawElementOverlay } from '../preview/render';
import type { ElementKind, ElementLayer, Scene } from '../../stores/model';

export function ElementPreview({ kind, color, presetId, animation = 'none', label, reduceMotion = false, motionSample = false }: { kind: ElementKind; presetId?: string; color: string; animation?: ElementLayer['animation']; label?: string; reduceMotion?: boolean; motionSample?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const preset = elementPreset({ presetId });
    const size = preset ? presetSize(preset, { width: 240, height: 160 }) : defaultElementSize(kind, { width: 240, height: 160 });
    const ratio = size.height / size.width, width = motionSample ? .58 : Math.min(.78, .6 / ratio), height = motionSample ? .78 : width * ratio;
    const element: ElementLayer = { id:'preview', kind:motionSample?'counter':kind, presetId:motionSample?undefined:presetId, behavior:preset?.behavior, label:motionSample?'Aa':label??preset?.text, x:.5, y:.5, width, height, rotation:0, color, opacity:100, startTicks:0, durationTicks:600, animation:'none' };
    const scene:Scene = {id:'preview',name:'',image:'',startTicks:0,sourceInTicks:0,durationTicks:600,title:'',subtitle:'',color,fit:'cover',elements:[element]};
    const target=canvas.current;if(!target)return;
    let raf=0,visible=false,last=0,start=0,drawing=false;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw=async(elapsed:number)=>{
      if(drawing)return;drawing=true;
      try {
        const motion=elementMotion(animation,motionPreviewSeconds(animation,elapsed));
        const scale=motionSample && animation==='pulse' ? 1+(motion.scale-1)*3 : motion.scale;
        const translation=motionSample?3:2;
        element.x=.5+motion.x*translation;element.y=.5+motion.y*translation;
        element.rotation=motion.rotation;element.width=width*scale;element.height=height*scale;
        element.opacity=(motionSample?motion.alpha:Math.max(.35,motion.alpha))*100;
        await drawElementOverlay(target,scene,'preview',elapsed%10,'16:9',undefined,motionSample?{width:160,height:120}:{width:240,height:160},[],true);
      } finally {drawing=false;}
    };
    const animate=(now:number)=>{if(!visible||reduceMotion||media.matches||(animation==='none'&&!isDynamicElement(kind)&&!preset))return;if(!start)start=now-350;if(now-last>65){void draw((now-start)/1000);last=now;}raf=requestAnimationFrame(animate);};
    const restart=()=>{cancelAnimationFrame(raf);void draw(.4);if(visible){start=0;raf=requestAnimationFrame(animate);}};
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;restart();});
    void draw(.4);observer.observe(target);media.addEventListener('change',restart);
    return()=>{observer.disconnect();cancelAnimationFrame(raf);media.removeEventListener('change',restart);};
  },[kind,color,presetId,animation,label,reduceMotion,motionSample]);
  return <canvas ref={canvas} aria-hidden="true" data-motion={motionSample?animation:undefined}/>;
}
