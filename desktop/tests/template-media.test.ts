import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
describe('bundled media MIME compatibility',()=>{
 it.each(['audio/x-m4a', 'audio/m4a', 'application/octet-stream'])('canonicalizes %s without changing the bytes',async(sourceType)=>{
  vi.resetModules();
  const { templateAudioDataUrl, templateVideoDataUrl, templateVideoPosterDataUrl } = await import('../src/templates/media');
  const types:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob([new Uint8Array([1,2,3])],{type:sourceType}))));
  vi.stubGlobal('FileReader',class{
   result:string|null=null;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
   async readAsDataURL(blob:Blob){types.push(blob.type);expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([1,2,3]);this.result=`data:${blob.type};base64,AQID`;this.onload?.();}
  });
  expect(await templateAudioDataUrl('soft-pulse')).toBe('data:audio/mp4;base64,AQID');
  expect(await templateAudioDataUrl('night-drive')).toBe('data:audio/mp4;base64,AQID');
  expect(await templateVideoDataUrl('aurora-motion')).toBe('data:video/mp4;base64,AQID');
  expect(await templateVideoPosterDataUrl('aurora-motion')).toBe('data:image/jpeg;base64,AQID');
  expect(types).toEqual(['audio/mp4','audio/mp4','video/mp4','image/jpeg']);
 });
});
