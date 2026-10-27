export type SpectrogramData = { values:Uint8Array; columns:number; bins:number; duration:number; minFrequency:number; maxFrequency:number };
/** Hann-windowed radix-2 FFT, with stereo powers combined instead of cancelling phases. */
export function calculateSpectrogram(channels:Float32Array[],sampleRate:number,maxColumns=1024,bins=64):SpectrogramData {
  if(!Number.isFinite(sampleRate)||sampleRate<80||!Number.isInteger(maxColumns)||maxColumns<1||!Number.isInteger(bins)||bins<1)return {values:new Uint8Array(),columns:0,bins:0,duration:0,minFrequency:40,maxFrequency:40};
  const size=1024,length=channels.length?Math.min(...channels.map(c=>c.length)):0;
  const columns=length?Math.max(1,Math.min(maxColumns,Math.ceil(length/(size/4)))):0;
  const minFrequency=40,maxFrequency=Math.max(40,sampleRate/2);
  const output:SpectrogramData={values:new Uint8Array(columns*bins),columns,bins,duration:length/sampleRate,minFrequency,maxFrequency};
  if(!length||sampleRate<=0||!Number.isFinite(sampleRate)||maxColumns<1||bins<1)return output;
  const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
  const windowSum=window.reduce((sum,v)=>sum+v,0),real=new Float64Array(size),imag=new Float64Array(size),power=new Float64Array(size/2+1);
  const reverse=new Uint16Array(size);
  for(let i=0;i<size;i++){let n=i,r=0;for(let j=0;j<10;j++){r=(r<<1)|(n&1);n>>=1;}reverse[i]=r;}
  const cos=Float64Array.from({length:size/2},(_,i)=>Math.cos(-2*Math.PI*i/size));
  const sin=Float64Array.from({length:size/2},(_,i)=>Math.sin(-2*Math.PI*i/size));
  const bands=Array.from({length:bins},(_,bin)=>{
    const low=minFrequency*Math.pow(maxFrequency/minFrequency,bin/bins),high=minFrequency*Math.pow(maxFrequency/minFrequency,(bin+1)/bins);
    return [Math.max(1,Math.floor(low*size/sampleRate)),Math.min(size/2,Math.max(1,Math.ceil(high*size/sampleRate)))];
  });
  for(let column=0;column<columns;column++){
    power.fill(0);const center=Math.round((column+.5)*length/columns);
    for(const channel of channels){
      for(let i=0;i<size;i++){real[reverse[i]]=(channel[center+i-size/2]??0)*window[i];imag[reverse[i]]=0;}
      for(let span=2;span<=size;span*=2){const half=span/2,step=size/span;
        for(let block=0;block<size;block+=span)for(let j=0;j<half;j++){
          const a=block+j,b=a+half,c=cos[j*step],s=sin[j*step],r=real[b]*c-imag[b]*s,v=real[b]*s+imag[b]*c;
          real[b]=real[a]-r;imag[b]=imag[a]-v;real[a]+=r;imag[a]+=v;
        }
      }
      for(let bin=0;bin<power.length;bin++)power[bin]+=(real[bin]*real[bin]+imag[bin]*imag[bin])/channels.length;
    }
    for(let bin=0;bin<bins;bin++){
      let peak=0;for(let i=bands[bin][0];i<=bands[bin][1];i++)peak=Math.max(peak,power[i]);
      const db=20*Math.log10(Math.max(1e-9,Math.sqrt(peak)*2/windowSum));
      output.values[column*bins+bin]=Math.round(Math.min(255,Math.max(0,(db+90)/90*255)));
    }
  }
  return output;
}
export function spectrogramRange(data:SpectrogramData,start:number,duration:number){
  const from=Math.min(data.duration,Math.max(0,start)),to=Math.min(data.duration,Math.max(from,from+duration));
  return {start:data.duration?from/data.duration*data.columns:0,end:data.duration?to/data.duration*data.columns:0};
}
