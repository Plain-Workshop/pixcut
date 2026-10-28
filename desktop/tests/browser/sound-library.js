// Regression: the grouped sound library lives in the left sidebar Audio tab.
// Run with playwright-cli run-code against :1420.
async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:1420/');
 const name=`Sound library ${Date.now()}`;
 await page.evaluate(async name=>{
  const m=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#22364B';ctx.fillRect(0,0,640,360);
  const scene={id:'photo',name:'Photo scene',image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#FFFFFF',fit:'cover',textLayers:[]};
  await lib.saveLibraryProject(m.edit(m.emptyProject(name),{type:'add',scenes:[scene]}));
 },name);
 await page.reload();
 await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();

 const left=page.locator('.library');
 await left.getByRole('button',{name:'Audio',exact:true}).click();
 await left.getByRole('tab',{name:'Sounds',exact:true}).click();

 const groups=await left.locator('.sound-group').count();
 if(groups!==10)throw Error(`Expected 10 sound groups, found ${groups}`);
 const total=await left.locator('.sound-group-head small').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.textContent),0));
 if(total!==300)throw Error(`Sound catalog should hold 300 effects: ${total}`);
 if(await left.locator('.sound-group').first().getAttribute('data-open')!==null)throw Error('unexpected marker');

 // Search opens the matching group, filters rows and hides the others.
 await left.getByLabel('Search sound effects').fill('whoosh');
 const rows=await left.locator('.sound-effect-list > div').count();
 if(rows<4)throw Error(`Search did not find the whoosh group: ${rows} rows`);
 if(await left.locator('.sound-group').count()!==1)throw Error('Search left empty groups visible');
 await left.getByLabel('Search sound effects').fill('no such sound at all');
 if(await left.locator('.sound-effect-list > div').count()!==0)throw Error('Empty search still shows rows');
 await left.getByLabel('Search sound effects').fill('');

 // Groups start collapsed; expanding one reveals its rows.
 await left.getByRole('button',{name:/^Interface/}).click();
 const interfaceRows=await left.locator('.sound-effect-list > div').count();
 if(interfaceRows!==30)throw Error(`Interface group should list 30 sounds, found ${interfaceRows}`);

 // Listen renders the WAV locally and plays it through a data URL.
 await page.evaluate(()=>{
  window.__sounds=[];
  const Native=window.Audio;
  window.Audio=function(...args){const audio=new Native(...args);window.__sounds.push(audio);return audio;};
  window.Audio.prototype=Native.prototype;
 });
 await left.getByRole('button',{name:'Listen to Click',exact:true}).click();
 await left.locator('.sound-effect-list > div.previewing').waitFor();
 const started=await page.evaluate(()=>{const audio=window.__sounds.at(-1);return {source:audio.currentSrc||audio.src,paused:audio.paused,error:audio.error&&audio.error.code};});
 if(!started.source.startsWith('data:audio/wav'))throw Error(`Sound preview did not use local PCM: ${started.source.slice(0,40)}`);
 if(started.paused)throw Error('Sound preview did not start');

 // Add drops the clip on the audio timeline at the playhead.
 await left.getByRole('button',{name:'Add Click at playhead',exact:true}).click();
 await left.getByRole('tab',{name:'Project',exact:true}).click();
 const clips=left.locator('.audio-list-item');
 if(await clips.count()!==1)throw Error(`Add did not create exactly one audio clip: ${await clips.count()}`);
 if(!(await clips.first().innerText()).includes('Click'))throw Error('Added clip has the wrong name');
 if(errors.length)throw Error(`Console errors: ${errors.join(' | ')}`);
 return 'sound library: 10 groups, 300 sounds, search, preview and add work';
}
