/** Original offline recordings, dedicated to CC0 by PixCut. No remote catalog. */
export type MusicTrack = { id:string; title:string; mood:string; bpm?:number; seconds:number; file:string; license:'CC0 1.0'; author:'PixCut' };
export const MUSIC_TRACKS:MusicTrack[] = [
 {id:'morning-coffee',title:'Morning coffee',mood:'Chill',bpm:92,seconds:64*60/92,file:'music/morning-coffee.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'golden-reel',title:'Golden reel',mood:'Upbeat',bpm:110,seconds:64*60/110,file:'music/golden-reel.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'quiet-horizon',title:'Quiet horizon',mood:'Ambient',bpm:78,seconds:64*60/78,file:'music/quiet-horizon.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'neon-walk',title:'Neon walk',mood:'Upbeat',bpm:118,seconds:64*60/118,file:'music/neon-walk.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'little-memories',title:'Little memories',mood:'Piano',bpm:84,seconds:64*60/84,file:'music/little-memories.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'fresh-start',title:'Fresh start',mood:'Chill',bpm:104,seconds:64*60/104,file:'music/fresh-start.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'soft-pulse',title:'Soft pulse',mood:'Minimal',seconds:20,file:'templates/media/soft-pulse.m4a',license:'CC0 1.0',author:'PixCut'},
 {id:'night-drive',title:'Night drive',mood:'Minimal',seconds:20,file:'templates/media/night-drive.m4a',license:'CC0 1.0',author:'PixCut'},
];
export const MUSIC_LICENSE = 'PixCut original music — CC0 1.0 Universal. The compositions and recordings in this bundled collection are created for PixCut and dedicated to the public domain. To the extent possible under law, PixCut waives copyright and related rights. You may copy, edit and use them in personal and commercial videos on any platform without attribution. No third-party recordings or samples are included. License: https://creativecommons.org/publicdomain/zero/1.0/ . Automated copyright claims are still possible; keep this license information with your project.';
export const musicTrackUrl=(track:MusicTrack)=>`${import.meta.env.BASE_URL}${track.file}`;
const data=new Map<string,Promise<string>>();
export function musicTrackData(track:MusicTrack):Promise<string>{
 const existing=data.get(track.id);if(existing)return existing;
 const task=fetch(musicTrackUrl(track)).then(async response=>{
  if(!response.ok)throw Error('This bundled track could not be opened. Reinstall PixCut or import another audio file.');
  const blob=await response.blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('The music file could not be read.'));reader.readAsDataURL(new Blob([blob],{type:'audio/mp4'}));});
 }).catch(error=>{data.delete(track.id);throw error;});data.set(track.id,task);return task;
}
