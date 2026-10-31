export type SpectrogramData = { values:Uint8Array; columns:number; bins:number; duration:number; minFrequency:number; maxFrequency:number };

/** FFT length: 2048 points resolves about 11 Hz per bin at 22 kHz, enough for bass notes. */
export const SPECTROGRAM_FFT_SIZE = 2048;
/** Columns per second of audio, so short clips are not smeared and long ones stay light. */
export const SPECTROGRAM_COLUMNS_PER_SECOND = 32;

/** How many time columns to analyse for a source of this length. */
export function spectrogramColumns(durationSeconds:number){
  if(!(durationSeconds>0))return 0;
  return Math.max(64,Math.min(4096,Math.round(durationSeconds*SPECTROGRAM_COLUMNS_PER_SECOND)));
}

/**
 * Hann-windowed radix-2 FFT, with stereo powers combined instead of cancelling
 * phases. Bands are log-spaced; a band narrower than one FFT bin interpolates
 * between neighbouring bins instead of repeating one, which is what used to
 * paint flat stripes across the low end. Levels use a fixed decibel scale so
 * quiet audio looks quieter than loud audio.
 */
export function calculateSpectrogram(channels:Float32Array[],sampleRate:number,maxColumns=1024,bins=64):SpectrogramData {
  if(!Number.isFinite(sampleRate)||sampleRate<80||!Number.isInteger(maxColumns)||maxColumns<1||!Number.isInteger(bins)||bins<1)return {values:new Uint8Array(),columns:0,bins:0,duration:0,minFrequency:40,maxFrequency:40};
  const size=SPECTROGRAM_FFT_SIZE,bits=Math.log2(size),length=channels.length?Math.min(...channels.map(c=>c.length)):0;
  const columns=length?Math.max(1,Math.min(maxColumns,Math.ceil(length/(size/8)))):0;
  const minFrequency=40,maxFrequency=Math.max(40,sampleRate/2);
  const output:SpectrogramData={values:new Uint8Array(columns*bins),columns,bins,duration:length/sampleRate,minFrequency,maxFrequency};
  if(!length)return output;
  const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
  const windowSum=window.reduce((sum,v)=>sum+v,0),real=new Float64Array(size),imag=new Float64Array(size),power=new Float64Array(size/2+1);
  const reverse=new Uint32Array(size);
  for(let i=0;i<size;i++){let n=i,r=0;for(let j=0;j<bits;j++){r=(r<<1)|(n&1);n>>=1;}reverse[i]=r;}
  const cos=Float64Array.from({length:size/2},(_,i)=>Math.cos(-2*Math.PI*i/size));
  const sin=Float64Array.from({length:size/2},(_,i)=>Math.sin(-2*Math.PI*i/size));
  const binHz=sampleRate/size,top=size/2;
  // Fractional FFT-bin edges for each display band.
  const bands=Array.from({length:bins},(_,bin)=>{
    const low=minFrequency*Math.pow(maxFrequency/minFrequency,bin/bins),high=minFrequency*Math.pow(maxFrequency/minFrequency,(bin+1)/bins);
    return [Math.min(top,low/binHz),Math.min(top,high/binHz)] as const;
  });
  const at=(position:number)=>{const index=Math.min(top-1,Math.max(0,Math.floor(position))),fraction=Math.min(1,Math.max(0,position-index));return power[index]*(1-fraction)+power[index+1]*fraction;};
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
      const [low,high]=bands[bin];
      // Narrow bands read the interpolated power at their centre; wide ones keep their loudest bin.
      let peak=at((low+high)/2);
      for(let i=Math.ceil(low);i<=Math.floor(high)&&i<=top;i++)peak=Math.max(peak,power[i]);
      const db=20*Math.log10(Math.max(1e-9,Math.sqrt(peak)*2/windowSum));
      output.values[column*bins+bin]=Math.round(Math.min(255,Math.max(0,(db+90)/90*255)));
    }
  }
  return output;
}
/**
 * How many low bands hold the audio, for drawing. A bass pad then fills the
 * lane instead of sitting under ten kilohertz of black. Never fewer bands
 * than reach `minimumHz`, so different clips still look comparable.
 */
export function spectrogramVisibleBins(data:SpectrogramData,minimumHz=2000,threshold=24){
  if(!data.columns||!data.bins)return data.bins;
  let highest=-1;
  for(let bin=data.bins-1;bin>=0&&highest<0;bin--)for(let column=0;column<data.columns;column++)if(data.values[column*data.bins+bin]>threshold){highest=bin;break;}
  const floor=Math.ceil(data.bins*Math.log(Math.max(data.minFrequency,Math.min(minimumHz,data.maxFrequency))/data.minFrequency)/Math.log(data.maxFrequency/data.minFrequency));
  return Math.min(data.bins,Math.max(floor,highest+3,1));
}
export function spectrogramRange(data:SpectrogramData,start:number,duration:number){
  const from=Math.min(data.duration,Math.max(0,start)),to=Math.min(data.duration,Math.max(from,from+duration));
  return {start:data.duration?from/data.duration*data.columns:0,end:data.duration?to/data.duration*data.columns:0};
}
