import { describe,it,expect } from 'vitest';
import {calculateSpectrogram,spectrogramColumns,spectrogramRange,spectrogramVisibleBins} from '../src/components/timeline/spectrogram-data';
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
describe('spectrogram resolution',()=>{
 const rate=22050,second=(f:number)=>Float32Array.from({length:rate},(_,i)=>.5*Math.sin(2*Math.PI*f*i/rate));
 it('places a bass note in the right low band with the 2048-point FFT',()=>{
  const data=calculateSpectrogram([second(110)],rate);
  const column=Math.floor(data.columns/2),values=Array.from(data.values.slice(column*data.bins,(column+1)*data.bins));
  const loudest=values.indexOf(Math.max(...values));
  expect(hz(data,loudest)).toBeGreaterThan(80);expect(hz(data,loudest)).toBeLessThan(150);
 });
 it('does not repeat one FFT bin across several low bands',()=>{
  // Deterministic noise: every band has its own level, so identical neighbours mean a copied bin.
  let seed=7;const noise=Float32Array.from({length:rate},()=>{seed=(seed*1103515245+12345)%2147483648;return (seed/2147483648-.5)*.4;});
  const data=calculateSpectrogram([noise],rate),column=Math.floor(data.columns/2);
  const low=Array.from(data.values.slice(column*data.bins,column*data.bins+16));
  let longestRun=1,run=1;for(let i=1;i<low.length;i++){run=low[i]===low[i-1]?run+1:1;longestRun=Math.max(longestRun,run);}
  expect(longestRun).toBeLessThan(3);
 });
 it('scales columns with the length of the audio',()=>{
  expect(spectrogramColumns(0)).toBe(0);expect(spectrogramColumns(1)).toBe(64);
  expect(spectrogramColumns(20)).toBe(640);expect(spectrogramColumns(3600)).toBe(4096);
 });
 it('crops the drawn range to the bands that hold sound, but never below 2 kHz',()=>{
  const bass=calculateSpectrogram([second(110)],rate),bright=calculateSpectrogram([second(6000)],rate);
  const limit=spectrogramVisibleBins(bass);
  expect(hz(bass,limit-1)).toBeGreaterThan(1800);expect(limit).toBeLessThan(bass.bins);
  expect(spectrogramVisibleBins(bright)).toBeGreaterThan(limit);
  const empty=calculateSpectrogram([],rate);expect(spectrogramVisibleBins(empty)).toBe(empty.bins);
 });
});
