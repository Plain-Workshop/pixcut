import { calculateSpectrogram, spectrogramColumns } from './spectrogram-data';
self.onmessage=(event:MessageEvent<{channels:Float32Array[];sampleRate:number}>)=>{
  try{const{channels,sampleRate}=event.data,length=channels.length?Math.min(...channels.map(c=>c.length)):0;
  const result=calculateSpectrogram(channels,sampleRate,Math.max(1,spectrogramColumns(length/sampleRate)));self.postMessage({result}, {transfer:[result.values.buffer]});}
  catch{self.postMessage({error:true});}
};
