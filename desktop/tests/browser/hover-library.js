// Local browser regression: selection owns the right inspector; libraries only select/create.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Hover library QA ${Date.now()}`;
 await page.evaluate(async name=>{
  const m=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');const {createTextLayer}=await import('/src/components/text/layers.ts');const {bellSound}=await import('/src/components/elements/sound.ts');const media=await import('/src/templates/media.ts');
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#22364B';ctx.fillRect(0,0,640,360);
  const first={id:'photo',name:'Photo scene',image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:120,title:'First title',subtitle:'',color:'#FFFFFF',fit:'cover',textLayers:[createTextLayer(120,{id:'title-1',title:'First title',animation:'none'}),createTextLayer(120,{id:'title-2',title:'Second title',y:.3,animation:'none'})]};
  const second={...first,id:'video',name:'Video scene',image:await media.templateVideoDataUrl('aurora-motion'),videoPoster:await media.templateVideoPosterDataUrl('aurora-motion'),mediaKind:'video',sourceDurationSeconds:6,startTicks:120,textLayers:[],title:''};
  const p=m.edit(m.emptyProject(name),{type:'add',scenes:[first,second]});
  p.audio=[{id:'music',name:'Local audio',data:bellSound(8,true),lane:0,startTicks:0,durationTicks:240,sourceInSeconds:0,sourceDurationSeconds:8,volume:.7,fadeIn:0,fadeOut:0}];
  p.overlays=[{id:'nameplate',z:9000,kind:'name-tag',presetId:'lower-thirds-01',label:'Your name\nYour role',x:.5,y:.5,width:.4,height:.2,rotation:0,opacity:100,color:'#C5B4FF',startTicks:0,durationTicks:240,animation:'none',loop:false}];
  await lib.saveLibraryProject(p);
 },name);
 await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();

 const left=page.locator('.library'),right=page.getByRole('complementary',{name:'Selected item properties'});
 await page.evaluate(()=>{const Native=window.Audio;window.__hoverAudios=[];window.Audio=function(...args){const audio=new Native(...args);window.__hoverAudios.push(audio);return audio;};window.Audio.prototype=Native.prototype;});
 const videoTile=left.locator('.source-tile .media-source').last();await videoTile.hover();
 await left.locator('.source-hover-video.ready').waitFor();const video=left.locator('.source-hover-video');
 if(!await video.evaluate(v=>v.muted&&!v.paused))throw Error('Hover video is not muted/playing');const a=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(200);if(await video.evaluate(v=>v.currentTime)<=a)throw Error('Video preview did not advance');
 await page.locator('.editor-header').hover();if(await left.locator('.source-hover-video').count())throw Error('Video continues after leaving tile');
 await left.getByRole('button',{name:'Elements',exact:true}).click();await left.getByLabel('Element collection',{exact:true}).selectOption('buttons-motion');
 const card=left.getByRole('button',{name:'Add Subscribe click',exact:true}),canvas=card.locator('canvas');
 await page.locator('.editor-header').hover();await page.waitForTimeout(200);const still=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(180);if(still!==await canvas.evaluate(c=>c.toDataURL()))throw Error('Unhovered element animates');
 await card.hover();const samples=new Set();for(let i=0;i<8;i++){await page.waitForTimeout(130);samples.add(await canvas.evaluate(c=>c.toDataURL()));}if(samples.size<2)throw Error('Hovered element is static');
 await page.locator('.editor-header').hover();await page.waitForTimeout(200);const stopped=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(160);if(stopped!==await canvas.evaluate(c=>c.toDataURL()))throw Error('Element hover preview did not stop');
 await card.click();
 let saved;for(let i=0;i<30;i++){saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const p=(await lib.listProjects()).find(e=>e.name===name);return lib.getLibraryProject(p.id);},name);if(saved.overlays.some(e=>e.presetId==='buttons-motion-01'))break;await page.waitForTimeout(100);}
 if(saved.overlays.find(e=>e.presetId==='buttons-motion-01').z<=9000)throw Error('New element was added below a manually raised layer');
 await left.getByRole('button',{name:'Audio',exact:true}).click();await left.locator('.audio-list-select').hover();await left.locator('.audio-list-select.previewing').waitFor();
 if(!await page.evaluate(()=>window.__hoverAudios.some(a=>!a.paused)))throw Error('Audio hover did not play');await page.locator('.editor-header').hover();await page.waitForTimeout(100);if(!await page.evaluate(()=>window.__hoverAudios.every(a=>a.paused)))throw Error('Audio continues after leaving library item');
 await left.getByRole('tab',{name:'Music',exact:true}).click();if(await left.locator('.free-music-track').count()!==15)throw Error('Bundled music missing');
 await left.getByLabel('Music mood',{exact:true}).selectOption('Chill');if(await left.locator('.free-music-track').count()!==2)throw Error('Music mood filter failed');
 await left.getByRole('button',{name:'Listen to Solace',exact:true}).hover();await left.locator('.free-music-track.previewing').waitFor();
 await left.getByRole('button',{name:'Listen to Solace',exact:true}).click();await left.locator('.free-music-track.previewing').waitFor();
 await page.screenshot({path:'output/playwright/free-music-library.png'});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(100);if(!await page.evaluate(()=>window.__hoverAudios.every(a=>a.paused)))throw Error('Preview audio survives window blur');
 await left.getByRole('button',{name:'Add music Solace',exact:true}).click();
 for(let i=0;i<30;i++){saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const p=(await lib.listProjects()).find(e=>e.name===name);return lib.getLibraryProject(p.id);},name);if(saved.audio.some(a=>a.name==='Solace · Scott Buckley'))break;await page.waitForTimeout(100);}
 if(!saved.audio.some(a=>a.name==='Solace · Scott Buckley'))throw Error('Music did not save');
 await left.getByLabel('Music mood',{exact:true}).selectOption('All');await page.locator('.editor-header').hover();await page.screenshot({path:'output/playwright/free-music-all.png'});
 await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();await left.getByRole('button',{name:'Audio',exact:true}).click();if(!await left.getByRole('button',{name:/Solace · Scott Buckley/}).isVisible())throw Error('Reopened project lost bundled music');
 return {videoHoverMuted:true,elementHoverFrames:samples.size,audioHoverStops:true,newLayerOnTop:true,musicTracks:15,moodFilter:true,musicReopened:true};
}
