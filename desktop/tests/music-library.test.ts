import { describe,it,expect,vi,afterEach } from 'vitest';
import { MUSIC_TRACKS,MUSIC_LICENSE,MUSIC_MOODS,musicTrackUrl,musicTrackPreviewUrl,MAX_PREVIEW_BLOBS,musicTrackCredit,musicTrackClipName,creditForClipName,releaseMusicPreviewUrls } from '../src/stores/music-library';
import { readFileSync,existsSync,statSync } from 'node:fs';
import { resolve } from 'node:path';
describe('bundled music library',()=>{
 it('ships fifteen real CC BY recordings with local files and artist credits',()=>{
  expect(MUSIC_TRACKS).toHaveLength(15);expect(new Set(MUSIC_TRACKS.map(t=>t.id)).size).toBe(15);
  expect(new Set(MUSIC_TRACKS.map(t=>t.file)).size).toBe(15);
  for(const track of MUSIC_TRACKS){
   expect(track.license).toBe('CC BY 4.0');expect(['Scott Buckley','Ketsa']).toContain(track.author);
   expect(track.seconds).toBe(110);expect(musicTrackUrl(track)).not.toMatch(/^https?:/);
   expect(musicTrackUrl(track)).toBe(`/music/${track.id}.m4a`);
   const file=resolve('public',track.file);
   expect(existsSync(file),track.id).toBe(true);expect(statSync(file).size).toBeGreaterThan(500_000);
   expect(track.source).toMatch(/^https:\/\/(www\.scottbuckley\.com\.au|freemusicarchive\.org)\//);
  }
  expect(MUSIC_LICENSE).toContain('CC BY 4.0');expect(MUSIC_LICENSE).toContain('must be credited');
  expect(readFileSync('public/music/LICENSE.txt','utf8')).toContain('creativecommons.org/licenses/by/4.0');
  expect(readFileSync('public/music/LICENSE.txt','utf8')).toContain('Ketsa');
 });
 it('offers a mood for every track and keeps sounds out of the filter',()=>{
  expect(MUSIC_MOODS[0]).toBe('All');
  for(const track of MUSIC_TRACKS)expect(MUSIC_MOODS).toContain(track.mood);
  expect(new Set(MUSIC_TRACKS.map(t=>t.mood))).toEqual(new Set(['Chill','Beats','Upbeat','Ambient','Cinematic','Piano']));
 });
 it('writes the credit each artist asks for and finds it from the clip name',()=>{
  const scott=MUSIC_TRACKS.find(t=>t.author==='Scott Buckley')!,ketsa=MUSIC_TRACKS.find(t=>t.author==='Ketsa')!;
  expect(musicTrackCredit(scott)).toBe(`“${scott.title}” by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au`);
  expect(musicTrackCredit(ketsa)).toBe(`“${ketsa.title}” by Ketsa – licensed under CC BY 4.0 (${ketsa.source})`);
  for(const track of MUSIC_TRACKS){
   expect(musicTrackClipName(track)).toBe(`${track.title} · ${track.author}`);
   expect(creditForClipName(musicTrackClipName(track))).toBe(musicTrackCredit(track));
  }
  expect(creditForClipName('Voiceover')).toBeNull();
  expect(creditForClipName('Little memories · PixCut CC0')).toBeNull();
 });
});
describe('bundled music preview source',()=>{
 afterEach(()=>{releaseMusicPreviewUrls();vi.unstubAllGlobals();vi.restoreAllMocks();});
 it('reads a bundled track into one shared blob URL the audio element can decode',async()=>{
  const slices:string[]=[];
  const fetchMock=vi.fn(async(url:string)=>{
   expect(url).toBe(musicTrackUrl(MUSIC_TRACKS[0]));
   const blob=new Blob([new Uint8Array([1,2,3,4])],{type:'application/octet-stream'});
   const slice=blob.slice.bind(blob);
   blob.slice=((start?:number,end?:number,type?:string)=>{slices.push(String(type));return slice(start,end,type);}) as Blob['slice'];
   return {ok:true,blob:async()=>blob};
  });
  vi.stubGlobal('fetch',fetchMock);
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:pixcut-track');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  const track=MUSIC_TRACKS[0];
  const [first,second]=await Promise.all([musicTrackPreviewUrl(track),musicTrackPreviewUrl(track)]);
  expect(first).toBe('blob:pixcut-track');expect(second).toBe(first);
  expect(create).toHaveBeenCalledTimes(1);expect(fetchMock).toHaveBeenCalledTimes(1);
  // The bundled files are M4A; WebKit mislabels them, so the type is fixed.
  expect(slices).toEqual(['audio/mp4']);
  expect(await musicTrackPreviewUrl(track)).toBe(first);expect(fetchMock).toHaveBeenCalledTimes(1);
  releaseMusicPreviewUrls();
  await vi.waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:pixcut-track'));
  await musicTrackPreviewUrl(track);expect(fetchMock).toHaveBeenCalledTimes(2);
 });
 it('reports an unreadable bundled track and retries on the next preview',async()=>{
  const fetchMock=vi.fn(async()=>({ok:false,blob:async()=>new Blob([])}));
  vi.stubGlobal('fetch',fetchMock);
  const track=MUSIC_TRACKS[1];
  await expect(musicTrackPreviewUrl(track)).rejects.toThrow('This bundled track could not be opened. Reinstall PixCut or import another audio file.');
  await expect(musicTrackPreviewUrl(track)).rejects.toThrow('could not be opened');
  expect(fetchMock).toHaveBeenCalledTimes(2);
 });

 describe('preview cache',()=>{
  afterEach(()=>{releaseMusicPreviewUrls();vi.unstubAllGlobals();});
  function stub(){
   let n=0;const created:string[]=[],revoked:string[]=[];
   vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob(['x'])})));
   vi.stubGlobal('URL',{createObjectURL:()=>{const url=`blob:${n++}`;created.push(url);return url;},revokeObjectURL:(url:string)=>{revoked.push(url);}});
   return {created,revoked};
  }
  it('reads a track once and reuses its blob',async()=>{
   const {created}=stub();
   const first=await musicTrackPreviewUrl(MUSIC_TRACKS[0]);
   expect(await musicTrackPreviewUrl(MUSIC_TRACKS[0])).toBe(first);
   expect(created).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps only the most recent few blobs and releases the older ones',async()=>{
   const {created,revoked}=stub();
   for(const track of MUSIC_TRACKS.slice(0,MAX_PREVIEW_BLOBS+2))await musicTrackPreviewUrl(track);
   await Promise.resolve();await Promise.resolve();
   expect(created).toHaveLength(MAX_PREVIEW_BLOBS+2);
   expect(revoked).toEqual(created.slice(0,2));
  });
  it('counts a replay as recent, so the track being heard is not the one released',async()=>{
   const {created,revoked}=stub();
   const tracks=MUSIC_TRACKS.slice(0,MAX_PREVIEW_BLOBS+1);
   for(const track of tracks.slice(0,MAX_PREVIEW_BLOBS))await musicTrackPreviewUrl(track);
   await musicTrackPreviewUrl(tracks[0]);
   await musicTrackPreviewUrl(tracks[MAX_PREVIEW_BLOBS]);
   await Promise.resolve();await Promise.resolve();
   expect(revoked).toEqual([created[1]]);
  });
 });
});
