// Run with playwright-cli run-code in an isolated browser profile; local Vite on :1420.
async (page) => {
  await page.goto('http://127.0.0.1:1420/');
  const fixtureName = `Dynamic elements QA ${Date.now()}`;
  const results = await page.evaluate(async name => {
    const m = await import('/src/stores/model.ts'), lib = await import('/src/stores/library.ts');
    const { drawProjectOverlays } = await import('/src/components/preview/render.ts');
    const { ELEMENT_CATALOG } = await import('/src/components/elements/catalog.ts');
    const { defaultElementSize } = await import('/src/components/elements/geometry.ts');
    const { CARD_KINDS, waveformBars } = await import('/src/components/elements/dynamic.ts');
    const { bellSound } = await import('/src/components/elements/sound.ts');
    await document.fonts.ready;
    const bg = document.createElement('canvas'); bg.width=960; bg.height=540;
    const bc=bg.getContext('2d');bc.fillStyle='#151821';bc.fillRect(0,0,960,540);
    const p=m.edit(m.emptyProject(name),{type:'add',scenes:[{id:'background',name:'Background',image:bg.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:360,title:'',subtitle:'',color:'#FFFFFF',fit:'cover'}]});
    const base={id:'countdown',kind:'countdown',x:.25,y:.25,width:.18,height:.32,rotation:0,opacity:100,color:'#C5B4FF',animation:'none',startTicks:0,durationTicks:360,behavior:{atSeconds:1,intervalSeconds:1,countFrom:3,countTo:0}};
    p.audio=[{id:'bell-audio',name:'Local bell sample',data:bellSound(5,true),lane:0,startTicks:30,durationTicks:150,sourceInSeconds:0,sourceDurationSeconds:5,volume:.7,fadeIn:.1,fadeOut:.5}];
    p.overlays=[base,{...base,id:'mouse',kind:'mouse',x:.72,behavior:{atSeconds:1,variant:'double-click',repeat:true,intervalSeconds:1}},{...base,id:'checklist',kind:'checklist',x:.27,y:.73,width:.4,height:.3,behavior:{atSeconds:.5,intervalSeconds:1}},{...base,id:'waveform',kind:'waveform',x:.73,y:.73,width:.4,height:.25,behavior:{audioId:'bell-audio'}}];
    await lib.saveLibraryProject(p);
    const silent=await waveformBars(p.overlays[3],.5,p.audio,p.timebase), sounding=await waveformBars(p.overlays[3],1.15,p.audio,p.timebase), end=await waveformBars(p.overlays[3],7,p.audio,p.timebase);
    if(silent.some(v=>v!==0)||end.some(v=>v!==0)||!sounding.some(v=>v>.05))throw Error('Waveform does not follow real local audio');
    const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=960;const sc=sheet.getContext('2d');sc.fillStyle='#101219';sc.fillRect(0,0,1280,960);
    const cards=ELEMENT_CATALOG.filter(e=>CARD_KINDS.includes(e.kind));
    for(let i=0;i<cards.length;i++){
      const preset=cards[i],c=document.createElement('canvas');c.width=320;c.height=210;const cx=c.getContext('2d');cx.fillStyle='#20242E';cx.fillRect(0,0,320,210);
      const size=defaultElementSize(preset.kind,{width:320,height:210}),ratio=size.height/size.width,width=Math.min(.85,.78/ratio);
      await drawProjectOverlays(c,[{...base,...preset,label:undefined,animation:'none',behavior:undefined,x:.5,y:.5,width,height:width*ratio}],2.25,p.timebase,true,p.audio);
      const left=(i%4)*320,top=Math.floor(i/4)*240;sc.drawImage(c,left,top);sc.fillStyle='#D6D9E4';sc.font='15px sans-serif';sc.fillText(preset.label,left+20,top+230);
    }
    const q=document.createElement('canvas');q.width=600;q.height=600;await drawProjectOverlays(q,[{...base,kind:'qr',x:.5,y:.5,width:1,height:1,label:'https://example.com/東京'}],2,p.timebase,true);
    window.__dynamicQA={project:p,sheet:sheet.toDataURL(),qr:q.toDataURL(),frames:[]};
    return {catalog:cards.length,reactivePeak:Math.max(...sounding),silenceFlat:true};
  },fixtureName);
  const archiveDownload=page.waitForEvent('download');
  await page.evaluate(async()=>{
    const {drawProjectOverlays}=await import('/src/components/preview/render.ts');
    const {project:p,sheet,qr}=window.__dynamicQA, chunks=[];
    const add=(name,bytes)=>{
      const header=new Uint8Array(512), enc=new TextEncoder();
      const put=(at,value)=>header.set(enc.encode(value),at);
      put(0,name);put(100,'0000644\0');put(108,'0000000\0');put(116,'0000000\0');put(124,bytes.length.toString(8).padStart(11,'0')+'\0');put(136,'00000000000\0');
      header.fill(32,148,156);header[156]=48;put(257,'ustar\0');put(263,'00');
      put(148,header.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ');
      chunks.push(header,bytes,new Uint8Array((512-bytes.length%512)%512));
    };
    add('dynamic-elements-contact.png',new Uint8Array(await(await fetch(sheet)).arrayBuffer()));
    add('dynamic-audio.wav',new Uint8Array(await(await fetch(p.audio[0].data)).arrayBuffer()));
    add('dynamic-project.json',new TextEncoder().encode(JSON.stringify(p)));
    add('dynamic-elements-qr.png',new Uint8Array(await(await fetch(qr)).arrayBuffer()));
    const c=document.createElement('canvas');c.width=960;c.height=540;
    for(let i=0;i<120;i++){
      const ctx=c.getContext('2d');ctx.fillStyle='#151821';ctx.fillRect(0,0,960,540);
      await drawProjectOverlays(c,p.overlays,i/30,p.timebase,true,p.audio);
      const blob=await new Promise(resolve=>c.toBlob(resolve));
      add(`dynamic-frames/frame-${String(i).padStart(3,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
    }
    chunks.push(new Uint8Array(1024));
    const url=URL.createObjectURL(new Blob(chunks,{type:'application/x-tar'}));const a=document.createElement('a');a.href=url;a.download='dynamic-elements.tar';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  await(await archiveDownload).saveAs('output/playwright/dynamic-elements.tar');
  await page.reload();
  await page.getByRole('button',{name:new RegExp(`^16:9 ${fixtureName}`)}).click();
  await page.locator('.element-row .element-clip').filter({hasText:'Countdown'}).click();
  await page.getByLabel('Count from',{exact:true}).fill('8');await page.getByLabel('Count from',{exact:true}).press('Tab');
  await page.getByLabel('Step interval (s)',{exact:true}).fill('0.5');await page.getByLabel('Step interval (s)',{exact:true}).press('Tab');
  await page.getByLabel('Element exit',{exact:true}).selectOption('fade');
  await page.getByLabel('Overlay start',{exact:true}).fill('1');await page.getByLabel('Overlay start',{exact:true}).press('Tab');
  await page.getByLabel('Overlay duration',{exact:true}).fill('8');await page.getByLabel('Overlay duration',{exact:true}).press('Tab');
  await page.getByRole('button',{name:'Dynamic',exact:true}).click();
  if(await page.locator('.element-grid .element-card').count()!==8)throw Error('Dynamic category missing presets');
  await page.getByRole('button',{name:'Add Mouse interaction',exact:true}).click();
  await page.getByLabel('Mouse interaction',{exact:true}).selectOption('drag');
  await page.getByLabel('Action starts after (s)',{exact:true}).fill('2');await page.getByLabel('Action starts after (s)',{exact:true}).press('Tab');
  await page.screenshot({path:'output/playwright/dynamic-elements-editor.png'});
  let saved;
  for(let attempt=0;attempt<30;attempt++){
    saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entries=await lib.listProjects();const entry=entries.find(p=>p.name===name);const p=await lib.getLibraryProject(entry.id);return p.overlays.map(({kind,behavior,startTicks,durationTicks,exit})=>({kind,behavior,startTicks,durationTicks,exit}));},fixtureName);
    const counter=saved.find(e=>e.kind==='countdown'),mouse=saved.at(-1);
    if(counter.behavior.countFrom===8&&counter.behavior.intervalSeconds===.5&&counter.startTicks===30&&counter.durationTicks===240&&counter.exit==='fade'&&mouse.behavior.variant==='drag'&&mouse.behavior.atSeconds===2)break;
    if(attempt===29)throw Error('Dynamic settings did not persist: '+JSON.stringify(saved));
    await page.waitForTimeout(200);
  }
  await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${fixtureName}`)}).click();await page.locator('.element-row .element-clip').filter({hasText:'Countdown'}).click();
  if(await page.getByLabel('Count from',{exact:true}).inputValue()!=='8')throw Error('Reopening lost dynamic settings');
  return {...results,timingControlsPersisted:true,reopened:true,exportFrames:120};
}
