import { afterEach, describe, expect, it, vi } from 'vitest';
import { templateAudioDataUrl, templateVideoDataUrl, templateVideoPosterDataUrl } from '../src/templates/media';
afterEach(()=>vi.unstubAllGlobals());
describe('bundled media MIME compatibility',()=>{
 it('canonicalizes platform-specific MIME types without changing the bytes',async()=>{
  const types:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob([new Uint8Array([1,2,3])],{type:'application/octet-stream'}))));
  vi.stubGlobal('FileReader',class{
   result:string|null=null;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
   async readAsDataURL(blob:Blob){types.push(blob.type);expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([1,2,3]);this.result=`data:${blob.type};base64,AQID`;this.onload?.();}
  });
  expect(await templateAudioDataUrl('soft-pulse')).toBe('data:audio/mp4;base64,AQID');
  expect(await templateVideoDataUrl('aurora-motion')).toBe('data:video/mp4;base64,AQID');
  expect(await templateVideoPosterDataUrl('aurora-motion')).toBe('data:image/jpeg;base64,AQID');
  expect(types).toEqual(['audio/mp4','video/mp4','image/jpeg']);
 });
});
