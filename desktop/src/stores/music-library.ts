/**
 * Bundled music library — real recordings, licensed CC BY 4.0 (not public
 * domain). Every track needs its artist credited where the finished video is
 * published; the panel and the export studio surface the credit line. The
 * template beds in `templates/media/` stay original PixCut CC0 recordings.
 */
export type MusicTrack = {
  id: string; title: string; mood: string; seconds: number; file: string;
  license: 'CC BY 4.0'; author: string; source: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { id:'tears-in-rain', title:'Tears in Rain', mood:'Chill', seconds:110, file:'music/tears-in-rain.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/tears-in-rain/' },
  { id:'solace', title:'Solace', mood:'Chill', seconds:110, file:'music/solace.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/solace/' },
  { id:'unrealness', title:'Unrealness', mood:'Beats', seconds:110, file:'music/unrealness.m4a', license:'CC BY 4.0', author:'Ketsa', source:'https://freemusicarchive.org/music/Ketsa/upbeat-street/unrealness/' },
  { id:'funk-you', title:'Funk You (Go Funk Yoself)', mood:'Beats', seconds:110, file:'music/funk-you.m4a', license:'CC BY 4.0', author:'Ketsa', source:'https://freemusicarchive.org/music/Ketsa/upbeat-street/funk-you-go-funk-yoself/' },
  { id:'cuban-crunch', title:'Cuban Crunch', mood:'Beats', seconds:110, file:'music/cuban-crunch.m4a', license:'CC BY 4.0', author:'Ketsa', source:'https://freemusicarchive.org/music/Ketsa/upbeat-street/cuban-crunch/' },
  { id:'origami', title:'Origami', mood:'Upbeat', seconds:110, file:'music/origami.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/origami/' },
  { id:'electric-dreams', title:'Electric Dreams', mood:'Upbeat', seconds:110, file:'music/electric-dreams.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/electric-dreams/' },
  { id:'solecism', title:'Solecism', mood:'Upbeat', seconds:110, file:'music/solecism.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/solecism/' },
  { id:'aurora', title:'Aurora', mood:'Ambient', seconds:110, file:'music/aurora.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/aurora/' },
  { id:'ephemera', title:'Ephemera', mood:'Ambient', seconds:110, file:'music/ephemera.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/ephemera/' },
  { id:'aphelion', title:'Aphelion', mood:'Cinematic', seconds:110, file:'music/aphelion.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/aphelion/' },
  { id:'convergence', title:'Convergence', mood:'Cinematic', seconds:110, file:'music/convergence.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/convergence/' },
  { id:'clear-skies', title:'Clear Skies', mood:'Cinematic', seconds:110, file:'music/clear-skies.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/clear-skies/' },
  { id:'in-this-moment', title:'In This Moment', mood:'Piano', seconds:110, file:'music/in-this-moment.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/in-this-moment/' },
  { id:'with-these-hands', title:'With These Hands', mood:'Piano', seconds:110, file:'music/with-these-hands.m4a', license:'CC BY 4.0', author:'Scott Buckley', source:'https://www.scottbuckley.com.au/library/with-these-hands/' },
];

export const MUSIC_MOODS = ['All', 'Chill', 'Beats', 'Upbeat', 'Ambient', 'Cinematic', 'Piano'];

/** Attribution each artist asks for, ready to paste into a video description. */
export function musicTrackCredit(track: MusicTrack): string {
  if (track.author === 'Scott Buckley') return `“${track.title}” by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au`;
  return `“${track.title}” by ${track.author} – licensed under CC BY 4.0 (${track.source})`;
}

export const musicTrackClipName = (track: MusicTrack) => `${track.title} · ${track.author}`;

/** The credit for a bundled clip, matched by the name `addMusic` writes. */
export function creditForClipName(name: string): string | null {
  const track = MUSIC_TRACKS.find(item => musicTrackClipName(item) === name);
  return track ? musicTrackCredit(track) : null;
}

export const MUSIC_LICENSE = 'Bundled music is licensed CC BY 4.0, not public domain: it is free for personal and commercial videos, but the artist must be credited wherever the video is published — usually the description. The Music panel and the export studio copy the exact line for every track. The files are the artists’ published MP3s, trimmed to 110 seconds and re-encoded; derive new works under the same licence and do not register them with Content ID or upload them to streaming platforms. Full attribution: https://creativecommons.org/licenses/by/4.0/ .';

export const musicTrackUrl=(track:MusicTrack)=>`${import.meta.env.BASE_URL}${track.file}`;
const previews=new Map<string,Promise<string>>();
/**
 * A playable source for a bundled track.
 *
 * The desktop shell serves the app from its own `tauri://` scheme, and WebKit
 * will not decode audio straight from that scheme, so a raw `/music/…` source
 * stayed silent there while the browser preview played it. Reading the file
 * into a blob keeps the bundled URL for the fetch and hands the audio element
 * something both builds can decode. The URL is cached per track and released
 * when the editor unmounts.
 */
export function musicTrackPreviewUrl(track:MusicTrack):Promise<string>{
 const existing=previews.get(track.id);if(existing)return existing;
 const task=fetch(musicTrackUrl(track)).then(async response=>{
  if(!response.ok)throw Error('This bundled track could not be opened. Reinstall PixCut or import another audio file.');
  const blob=await response.blob();
  return URL.createObjectURL(blob.slice(0,blob.size,'audio/mp4'));
 }).catch(error=>{previews.delete(track.id);throw error;});
 previews.set(track.id,task);return task;
}
export function releaseMusicPreviewUrls(){
 for(const task of previews.values())void task.then(url=>URL.revokeObjectURL(url),()=>{});
 previews.clear();
}
const data=new Map<string,Promise<string>>();
export function musicTrackData(track:MusicTrack):Promise<string>{
 const existing=data.get(track.id);if(existing)return existing;
 const task=fetch(musicTrackUrl(track)).then(async response=>{
  if(!response.ok)throw Error('This bundled track could not be opened. Reinstall PixCut or import another audio file.');
  const blob=await response.blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('The music file could not be read.'));reader.readAsDataURL(new Blob([blob],{type:'audio/mp4'}));});
 }).catch(error=>{data.delete(track.id);throw error;});data.set(track.id,task);return task;
}
