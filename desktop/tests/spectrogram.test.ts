import { describe,it,expect } from 'vitest';
import {calculateSpectrogram,spectrogramRange} from '../src/components/timeline/spectrogram-data';
const rate=8192;
const tone=(frequency:number,amplitude=1)=>Float32Array.from({length:rate},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/rate));
function peak(data:ReturnType<typeof calculateSpectrogram>,column:number){const values=data.values.slice(column*data.bins,(column+1)*data.bins);return values.indexOf(Math.max(...values));}
function hz(data:ReturnType<typeof calculateSpectrogram>,bin:number){return data.minFrequency*Math.pow(data.maxFrequency/data.minFrequency,(bin+.5)/data.bins);}
describe('real audio spectrogram',()=>{
 it('locates actual spectral energy and leaves silence dark',()=>{
  const data=calculateSpectrogram([tone(1000)],rate);expect(hz(data,peak(data,16))).toBeGreaterThan(700);expect(hz(data,peak(data,16))).toBeLessThan(1400);
  expect(calculateSpectrogram([new Float32Array(rate)],rate).values.every(v=>v===0)).toBe(true);
 });
 it('keeps opposite stereo phases audible and uses a fixed decibel scale',()=>{
  const signal=tone(1000),single=calculateSpectrogram([signal],rate),stereo=calculateSpectrogram([signal,signal.map(v=>-v)],rate);
  expect(stereo.values).toEqual(single.values);
  const quiet=calculateSpectrogram([tone(1000,.1)],rate);expect(Math.max(...single.values)-Math.max(...quiet.values)).toBeGreaterThan(45);
 });
 it('maps time to columns and trimmed ranges to the decoded source duration',()=>{
  const signal=tone(400),other=tone(2400);signal.set(other.slice(rate/2),rate/2);
  const data=calculateSpectrogram([signal],rate,32);
  expect(peak(data,25)).toBeGreaterThan(peak(data,6)+10);
  expect(spectrogramRange(data,.25,.5)).toEqual({start:8,end:24});
  expect(spectrogramRange(data,2,1)).toEqual({start:32,end:32});
 });
 it('handles unavailable or invalid analysis input safely',()=>{
  expect(calculateSpectrogram([],rate).values.length).toBe(0);expect(calculateSpectrogram([tone(1000)],0).columns).toBe(0);
 });
});
