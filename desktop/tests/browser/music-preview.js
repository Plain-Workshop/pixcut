// Regression: the bundled music library must preview through a decodable source.
// The desktop shell serves the app from its own scheme, where WebKit refuses to
// decode a raw /music/… URL, so the Listen button reads the file into a blob.
// Run with playwright-cli run-code against :1420.
async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:1420/');
 const name=`Music preview ${Date.now()}`;
 await page.evaluate(async name=>{
  const m=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#22364B';ctx.fillRect(0,0,640,360);
  const first={id:'photo',name:'Photo scene',image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:120,title:'First title',subtitle:'',color:'#FFFFFF',fit:'cover',textLayers:[]};
  await lib.saveLibraryProject(m.edit(m.emptyProject(name),{type:'add',scenes:[first]}));
 },name);
 await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();
 await page.evaluate(()=>{
  window.__previews=[];
  const Native=window.Audio;
  window.Audio=function(...args){const audio=new Native(...args);window.__previews.push(audio);return audio;};
  window.Audio.prototype=Native.prototype;
 });
 const left=page.locator('.library');
 await left.getByRole('button',{name:'Audio',exact:true}).click();
 await left.getByRole('tab',{name:'Music',exact:true}).click();
 if(await left.locator('.free-music-track').count()!==15)throw Error('Bundled music missing');

 const listen=left.getByRole('button',{name:'Listen to Origami',exact:true});
 await listen.click();
 await left.locator('.free-music-track.previewing').waitFor();
 const started=await page.evaluate(()=>{const audio=window.__previews.at(-1);return {source:audio.currentSrc||audio.src,paused:audio.paused,time:audio.currentTime,readyState:audio.readyState};});
 if(!started.source.startsWith('blob:'))throw Error(`Music preview still streams the bundled URL: ${started.source}`);
 if(started.paused)throw Error('Music preview did not start');
 await page.waitForTimeout(900);
 const advanced=await page.evaluate(()=>{const audio=window.__previews.at(-1);return {time:audio.currentTime,paused:audio.paused,error:audio.error&&audio.error.code};});
 if(advanced.time<=started.time)throw Error(`Music preview did not advance: ${started.time} → ${advanced.time}`);
 if(advanced.error)throw Error(`Music preview reported media error ${advanced.error}`);
 // Clicking Listen twice reuses the same blob rather than re-reading the file.
 await listen.click();
 await page.waitForTimeout(300);
 const reused=await page.evaluate(()=>{const audio=window.__previews.at(-1);return {source:audio.currentSrc||audio.src,count:window.__previews.length};});
 if(!reused.source.startsWith('blob:'))throw Error('Second preview lost the blob source');
 if(reused.count!==2)throw Error(`Expected one audio element per click, got ${reused.count}`);
 await page.screenshot({path:'output/playwright/music-preview.png'});
 // Adding the same track still stores project-ready data, not the preview URL.
 await left.getByRole('button',{name:'Add music Origami',exact:true}).click();
 let saved;
 for(let i=0;i<40;i++){
  saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);return lib.getLibraryProject(entry.id);},name);
  if(saved.audio.some(a=>a.name==='Origami · Scott Buckley'))break;
  await page.waitForTimeout(100);
 }
 const clip=saved.audio.find(a=>a.name==='Origami · Scott Buckley');
 if(!clip)throw Error('Music did not reach the timeline');
 if(!clip.data.startsWith('data:audio/mp4')&&!clip.data.startsWith('pixcut-asset:'))throw Error(`Timeline audio is not self-contained: ${clip.data.slice(0,24)}`);
 try { await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:1420'}); }
 catch { await page.context().grantPermissions(['clipboard-read'],{origin:'http://127.0.0.1:1420'}).catch(()=>{}); }

 // CC BY 4.0 means every bundled track carries a credit the user can copy.
 await left.getByRole('tab',{name:'Project',exact:true}).click();
 await left.locator('.audio-list-select').first().click();
 const inspector=page.getByRole('complementary',{name:'Selected item properties'});
 await inspector.locator('.music-credit-note').waitFor();
 const note=await inspector.locator('.music-credit-note span').innerText();
 if(!note.includes('Scott Buckley')||!note.includes('CC-BY 4.0'))throw Error(`Inspector credit is wrong: ${note}`);
 await page.screenshot({path:'output/playwright/music-credit-inspector.png'});
 await left.getByRole('tab',{name:'Music',exact:true}).click();
 await left.locator('.music-license > summary').click();
 const listed=await left.locator('.music-credits > div').count();
 if(listed!==15)throw Error(`Music licence lists ${listed} credits instead of 15`);
 await left.getByRole('button',{name:'Copy all credits'}).click();
 const copied=await page.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
 if(copied&&(!copied.includes('Scott Buckley')||!copied.includes('Ketsa')||!copied.includes('CC-BY 4.0')))throw Error(`Copied credits are incomplete: ${copied.slice(0,80)}`);
 await page.screenshot({path:'output/playwright/music-license.png'});
 await page.getByRole('button',{name:/^Export/}).click();
 const exportCredits=page.locator('.export-credits');
 await exportCredits.waitFor();
 if(!(await exportCredits.innerText()).includes('Scott Buckley'))throw Error('Export studio lost the music credit');
 await page.screenshot({path:'output/playwright/export-credit-music.png'});
 await page.keyboard.press('Escape');
 if(errors.length)throw Error(`Console errors: ${errors.join(' | ')}`);
 return {source:started.source.slice(0,5),advancedSeconds:Number((advanced.time-started.time).toFixed(2)),clicks:reused.count,timelineAudio:clip.data.slice(0,15),credits:listed};
}
