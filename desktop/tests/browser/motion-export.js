// Export-path artwork check: every motion uses the same transform/compositor as project overlays.
async page=>{
 const download=page.waitForEvent('download');
 const result=await page.evaluate(async()=>{
  const {ELEMENT_ANIMATIONS}=await import('/src/components/elements/motion.ts');
  const {drawProjectOverlays}=await import('/src/components/preview/render.ts');
  const {prepareDesignerFonts}=await import('/src/components/elements/designer.ts');
  const {DEFAULT_TIMEBASE}=await import('/src/stores/model.ts');await prepareDesignerFonts();
  const chunks=[],enc=new TextEncoder(),hashes=Object.fromEntries(ELEMENT_ANIMATIONS.map(([id])=>[id,new Set()]));
  const add=(name,bytes)=>{const h=new Uint8Array(512),put=(at,s)=>h.set(enc.encode(s),at);put(0,name);put(100,'0000644\0');put(108,'0000000\0');put(116,'0000000\0');put(124,bytes.length.toString(8).padStart(11,'0')+'\0');put(136,'00000000000\0');h.fill(32,148,156);h[156]=48;put(257,'ustar\0');put(263,'00');put(148,h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ');chunks.push(h,bytes,new Uint8Array((512-bytes.length%512)%512));};
  const c=document.createElement('canvas');c.width=1280;c.height=720;
  const tile=document.createElement('canvas');tile.width=320;tile.height=180;
  for(let frame=0;frame<96;frame++){
   const ctx=c.getContext('2d');ctx.fillStyle='#121620';ctx.fillRect(0,0,c.width,c.height);
   for(let i=0;i<ELEMENT_ANIMATIONS.length;i++){
    const [animation,label]=ELEMENT_ANIMATIONS[i],tc=tile.getContext('2d');tc.clearRect(0,0,320,180);
    const element={id:'motion',kind:'counter',label:'Aa',x:.5,y:.4,width:.4,height:.65,rotation:0,color:'#C5B4FF',opacity:100,startTicks:0,durationTicks:300,animation,animationDuration:1.2,loop:true};
    await drawProjectOverlays(tile,[element],frame/30,DEFAULT_TIMEBASE,true);
    if([8,21,42,75].includes(frame))hashes[animation].add(tile.toDataURL());
    ctx.drawImage(tile,i%4*320,Math.floor(i/4)*180);
    ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillStyle='#E6DEF4';ctx.fillText(label,i%4*320+160,Math.floor(i/4)*180+162);
   }
   const blob=await new Promise(resolve=>c.toBlob(resolve));add(`motion-frames/frame-${String(frame).padStart(3,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
  }
  const counts=Object.fromEntries(Object.entries(hashes).map(([id,set])=>[id,set.size]));
  for(const[id,count]of Object.entries(counts))if(id==='none'?count!==1:count<2)throw Error(`Export motion ${id} failed: ${count}`);
  chunks.push(new Uint8Array(1024));const url=URL.createObjectURL(new Blob(chunks,{type:'application/x-tar'}));const a=document.createElement('a');a.href=url;a.download='motion-export.tar';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  return counts;
 });
 await(await download).saveAs('output/playwright/motion-export.tar');return {frames:96,motions:result};
}
