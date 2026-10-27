import { calculateSpectrogram } from './spectrogram-data';
self.onmessage=(event:MessageEvent<{channels:Float32Array[];sampleRate:number}>)=>{
  try{const result=calculateSpectrogram(event.data.channels,event.data.sampleRate);self.postMessage({result}, {transfer:[result.values.buffer]});}
  catch{self.postMessage({error:true});}
};
