// Run in an isolated playwright-cli browser session against local Vite :1420.
async page => {
  await page.goto('http://127.0.0.1:1420/');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const name=`Designer library QA ${Date.now()}`;
  const archive=page.waitForEvent('download');
  const visual=await page.evaluate(async name=>{
    const {ELEMENT_CATALOG:presets}=await import('/src/components/elements/catalog.ts');
    const {presetAspect,prepareDesignerFonts}=await import('/src/components/elements/designer.ts');
    const {drawProjectOverlays}=await import('/src/components/preview/render.ts');
    const model=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');
    const {bellSound}=await import('/src/components/elements/sound.ts');
    await prepareDesignerFonts();
    const bg=document.createElement('canvas');bg.width=960;bg.height=540;const bc=bg.getContext('2d');const g=bc.createLinearGradient(0,0,960,540);g.addColorStop(0,'#222939');g.addColorStop(1,'#10151E');bc.fillStyle=g;bc.fillRect(0,0,960,540);
    const p=model.edit(model.emptyProject(name),{type:'add',scenes:[{id:'background',name:'Background',image:bg.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:360,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'}]});await lib.saveLibraryProject(p);
    const audio=[{id:'demo',name:'Demo audio',data:bellSound(5,true),lane:0,startTicks:0,durationTicks:150,sourceInSeconds:0,sourceDurationSeconds:5,volume:.8,fadeIn:0,fadeOut:.2}];
    const chunks=[],enc=new TextEncoder();
    const add=(name,bytes)=>{const h=new Uint8Array(512),put=(at,s)=>h.set(enc.encode(s),at);put(0,name);put(100,'0000644\0');put(108,'0000000\0');put(116,'0000000\0');put(124,bytes.length.toString(8).padStart(11,'0')+'\0');put(136,'00000000000\0');h.fill(32,148,156);h[156]=48;put(257,'ustar\0');put(263,'00');put(148,h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ');chunks.push(h,bytes,new Uint8Array((512-bytes.length%512)%512));};
    const png=async c=>new Uint8Array(await(await new Promise(resolve=>c.toBlob(resolve))).arrayBuffer());
    const thumb=async(preset,seconds)=>{
      const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle='#1A202C';ctx.fillRect(0,0,320,180);
      const ratio=presetAspect(preset),width=Math.min(.91,.82*180/320*ratio),height=width*320/180/ratio;
      await drawProjectOverlays(c,[{id:'sample',kind:preset.kind,presetId:preset.id,label:preset.text,behavior:preset.behavior,x:.5,y:.5,width,height,color:preset.color,rotation:0,opacity:100,startTicks:0,durationTicks:360,animation:'none'}],seconds,p.timebase,true,audio);
      return c;
    };
    const hashes=new Set();
    for(let sheet=0;sheet<5;sheet++){
      const c=document.createElement('canvas');c.width=1920;c.height=1400;const ctx=c.getContext('2d');ctx.fillStyle='#10141D';ctx.fillRect(0,0,1920,1400);
      for(let i=0;i<40;i++){const preset=presets[sheet*40+i],tile=await thumb(preset,2.3);hashes.add(tile.toDataURL());const x=i%6*320,y=Math.floor(i/6)*200;ctx.drawImage(tile,x,y);ctx.fillStyle='#C4CDDF';ctx.font='12px sans-serif';ctx.fillText(preset.label,x+12,y+193);}
      add(`designer-contact-${sheet+1}.png`,await png(c));
    }
    // Representative motion, audio, typography and illustrated stickers in export frames.
    const indices=[0,15,20,30,42,52,61,70,89,90,100,110,120,140,160,190];
    for(let frame=0;frame<90;frame++){
      const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');ctx.fillStyle='#10141D';ctx.fillRect(0,0,1280,720);
      for(let i=0;i<indices.length;i++)ctx.drawImage(await thumb(presets[indices[i]],frame/30),i%4*320,Math.floor(i/4)*180);
      add(`designer-frames/frame-${String(frame).padStart(3,'0')}.png`,await png(c));
    }
    chunks.push(new Uint8Array(1024));const url=URL.createObjectURL(new Blob(chunks,{type:'application/x-tar'}));const a=document.createElement('a');a.href=url;a.download='designer-library.tar';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    if(hashes.size!==200)throw Error(`Only ${hashes.size} visually distinct presets`);
    return {rendered:200,distinctArtwork:hashes.size,exportFrames:90};
  },name);
  await(await archive).saveAs('output/playwright/designer-library.tar');
  await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();await page.getByRole('button',{name:'Elements',exact:true}).click();
  if(await page.locator('.element-grid .element-card').count()!==40)throw Error('Gallery did not start with 40 bounded previews');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:/Show 40 more/}).click();
  if(await page.locator('.element-grid .element-card').count()!==200)throw Error('200 presets are not reachable');
  for(const label of ['Add Rectangle','Add Circle','Add Triangle','Add Sparkle','Add Arrow'])if(await page.getByRole('button',{name:label,exact:true}).count())throw Error('Primitive shape is still offered');
  await page.getByLabel('Search elements',{exact:true}).fill('boarding pass');
  if(await page.locator('.element-grid .element-card').count()!==1)throw Error('Search failed');
  await page.getByRole('button',{name:'Add Boarding pass',exact:true}).click();
  await page.getByLabel('Element text',{exact:true}).fill('KIERUNEK\nNowa historia · 東京');await page.getByLabel('Element text',{exact:true}).press('Tab');
  let saved;
  for(let i=0;i<30;i++){saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);const p=await lib.getLibraryProject(entry.id);return p.overlays.map(({presetId,label,kind})=>({presetId,label,kind}));},name);if(saved[0]?.label==='KIERUNEK\nNowa historia · 東京')break;if(i===29)throw Error('Preset text did not persist');await page.waitForTimeout(200);}
  if(saved[0].presetId!=='travel-01')throw Error('Preset identity was lost');
  await page.getByLabel('Search elements',{exact:true}).fill('');await page.getByLabel('Element collection',{exact:true}).selectOption('travel');
  if(await page.locator('.element-grid .element-card').count()!==10)throw Error('Travel collection failed');
  await page.getByLabel('Preview playhead',{exact:true}).focus();
  await page.getByLabel('Preview playhead',{exact:true}).press('End');
  await page.screenshot({path:'output/playwright/designer-library-editor.png'});
  await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();await page.locator('.element-row .element-clip').filter({hasText:'Boarding pass'}).click();
  if(await page.getByLabel('Element text',{exact:true}).inputValue()!=='KIERUNEK\nNowa historia · 東京')throw Error('Reopen lost the text');
  if(errors.length)throw Error(errors.join('\n'));
  return {...visual,search:true,collections:true,all200Reachable:true,reopened:true};
}
