// Local browser regression: selection owns the right inspector; libraries only select/create.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Inspector QA ${Date.now()}`;
 await page.evaluate(async name=>{
  const m=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');const {createTextLayer}=await import('/src/components/text/layers.ts');const {bellSound}=await import('/src/components/elements/sound.ts');const media=await import('/src/templates/media.ts');
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#22364B';ctx.fillRect(0,0,640,360);
  const first={id:'photo',name:'Photo scene',image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:120,title:'First title',subtitle:'',color:'#FFFFFF',fit:'cover',textLayers:[createTextLayer(120,{id:'title-1',title:'First title',animation:'none'}),createTextLayer(120,{id:'title-2',title:'Second title',y:.3,animation:'none'})]};
  const second={...first,id:'video',name:'Video scene',image:await media.templateVideoDataUrl('aurora-motion'),videoPoster:await media.templateVideoPosterDataUrl('aurora-motion'),mediaKind:'video',sourceDurationSeconds:6,startTicks:120,textLayers:[],title:''};
  const p=m.edit(m.emptyProject(name),{type:'add',scenes:[first,second]});
  p.audio=[{id:'music',name:'Local audio',data:bellSound(8,true),lane:0,startTicks:0,durationTicks:240,sourceInSeconds:0,sourceDurationSeconds:8,volume:.7,fadeIn:0,fadeOut:0}];
  p.overlays=[{id:'nameplate',kind:'name-tag',presetId:'lower-thirds-01',label:'Your name\nYour role',x:.5,y:.5,width:.4,height:.2,rotation:0,opacity:100,color:'#C5B4FF',startTicks:0,durationTicks:240,animation:'none',loop:false}];
  await lib.saveLibraryProject(p);
 },name);
 await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();
 const originalSource=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);return (await lib.getLibraryProject(entry.id)).tracks[0].clips[0].image;},name);
 const left=page.locator('.library'),right=page.getByRole('complementary',{name:'Selected item properties'});
 const header=page.locator('.editor-header');
 for(const compact of [false,true]){
  await page.locator('.app.editor').evaluate((el,value)=>el.classList.toggle('compact',value),compact);
  const bounds=await header.boundingBox();if(bounds.height!==44)throw Error(`Header height is ${bounds.height} in compact=${compact}`);
  for(const name of ['Back to home','Save project','Export']){
   const button=header.getByRole('button',{name:new RegExp(`^${name}`)}),box=await button.boundingBox();
   if(box.height<32||box.y<bounds.y||box.y+box.height>bounds.y+bounds.height)throw Error(`${name} is clipped or too small`);
  }
 }
 await page.locator('.app.editor').evaluate(el=>el.classList.remove('compact'));
 await page.screenshot({path:'output/playwright/compact-editor-header.png'});

 const libraryOffsets={};
 for(const [tab,selector] of [['Media','.source-tile'],['Titles','.title-preset'],['Elements','.element-card'],['Audio','.audio-list-item'],['Templates','.template-tab-card']]){
  await left.getByRole('button',{name:tab,exact:true}).click();
  await left.evaluate(el=>{el.scrollTop=0;});
  const first=left.locator(selector).first();await first.waitFor({state:'visible'});
  const bounds=await first.boundingBox(),panel=await left.boundingBox();
  libraryOffsets[tab]=Math.round(bounds.y-panel.y);
  if(bounds.y-panel.y>250)throw Error(`${tab} library content is buried: ${libraryOffsets[tab]}px`);
  if(await left.evaluate(el=>el.scrollWidth>el.clientWidth))throw Error(`${tab} library overflows horizontally`);
  await page.screenshot({path:`output/playwright/compact-library-${tab.toLowerCase()}.png`});
 }
 await left.getByRole('button',{name:'Titles',exact:true}).click();
 if(await left.getByRole('button',{name:'Import font',exact:true}).isVisible())throw Error('Occasional title tools are expanded by default');
 await left.locator('.title-tools > summary').click();
 for(const name of ['Import font','Export SRT','Add project text'])if(!await left.getByRole('button',{name,exact:true}).isVisible())throw Error(`${name} is no longer accessible`);
 async function leftHasNoProperties(){if(await left.locator('input[type="range"],input[type="number"],.element-controls,.audio-editor').count())throw Error('Properties leaked into the left library');}
 await page.locator('.scene-track .timeline-clip').first().click();
 if(!await right.getByRole('button',{name:'Replace selected scene media',exact:true}).isVisible())throw Error('Framing lost media replacement');
 await left.getByRole('button',{name:'Titles',exact:true}).click();await left.getByRole('button',{name:'First title',exact:true}).click();
 await right.getByRole('heading',{name:'Text properties',exact:true}).waitFor();
 if(await right.getByRole('button',{name:'Replace selected scene media',exact:true}).count())throw Error('Text inspector still has scene media actions');
 if(await right.getByRole('tab',{name:'Framing',exact:true}).count())throw Error('Text inspector still has scene tabs');
 await right.getByLabel('Text layer content',{exact:true}).fill('Updated title');await right.getByLabel('Text layer content',{exact:true}).press('Tab');
 await right.locator('summary').filter({hasText:/^Animation$/}).click();
 if(await right.locator('canvas[data-motion]').count()!==5)throw Error('Text motions are missing');
 await right.getByRole('button',{name:'Text motion Fade',exact:true}).click();
 await leftHasNoProperties();await page.screenshot({path:'output/playwright/inspector-text.png'});
 await left.getByRole('button',{name:'Audio',exact:true}).click();await left.locator('.audio-list-select').click();
 await right.getByRole('heading',{name:'Audio properties',exact:true}).waitFor();await leftHasNoProperties();
 await right.getByLabel('Audio volume',{exact:true}).focus();await right.getByLabel('Audio volume',{exact:true}).press('End');
 if(await right.getByLabel('Text layer content',{exact:true}).count())throw Error('Text controls leaked into audio');
 await page.screenshot({path:'output/playwright/inspector-audio.png'});
 await page.locator('.scene-track .timeline-clip').first().click();
 for(const tab of ['Transitions','Color','Fades','Looks']){await right.getByRole('tab',{name:tab,exact:true}).click();if(await right.getByRole('button',{name:'Replace selected scene media',exact:true}).count())throw Error(`Replace media leaked into ${tab}`);await leftHasNoProperties();}
 if(await right.getByRole('tab',{name:'Speed',exact:true}).count())throw Error('A photo has video speed controls');
 await page.locator('.scene-track .timeline-clip').last().click();await right.getByRole('tab',{name:'Speed',exact:true}).click();
 if(!await right.getByLabel('Speed slider',{exact:true}).isVisible())throw Error('Video speed is missing');
 await right.getByRole('tab',{name:'Transitions',exact:true}).click();if(await right.locator('.transition-card').count())throw Error('Last scene still offers a transition to nowhere');
 await page.locator('.element-row .element-clip').first().click();await right.getByRole('heading',{name:'Element properties',exact:true}).waitFor();
 if(await right.getByRole('tab',{name:'Framing',exact:true}).count())throw Error('Element has unrelated scene tabs');
 if(await right.getByLabel('Overlay start slider',{exact:true}).count())throw Error('Duplicate element timing sliders remain');
 const canvases=right.locator('canvas[data-motion]');if(await canvases.count()!==13)throw Error('Not all element motions are visible');
 const motionChecks={};
 for(let i=0;i<13;i++){
  const canvas=canvases.nth(i);await canvas.scrollIntoViewIfNeeded();const id=await canvas.getAttribute('data-motion');const frames=new Set();
  for(let sample=0;sample<6;sample++){await page.waitForTimeout(140);frames.add(await canvas.evaluate(c=>c.toDataURL()));}
  if(id==='none'&&frames.size!==1)throw Error('Still is animated');if(id!=='none'&&frames.size<2)throw Error(`${id} preview is frozen`);motionChecks[id]=frames.size;
 }
 await right.getByRole('button',{name:'Pulse',exact:true}).click();if(!await right.getByRole('checkbox',{name:'Repeat motion',exact:true}).isChecked())throw Error('Pulse stops after one cycle');
 await right.getByRole('button',{name:'Float',exact:true}).click();if(!await right.getByRole('checkbox',{name:'Repeat motion',exact:true}).isChecked())throw Error('Float stops after one cycle');
 await right.getByLabel('Element text',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/inspector-element.png'});
 let saved;
 for(let i=0;i<30;i++){saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);const p=await lib.getLibraryProject(entry.id);return {title:p.tracks[0].clips[0].textLayers[0].title,source:p.tracks[0].clips[0].image,scenes:p.tracks[0].clips.length,audio:p.audio[0].volume,animation:p.overlays[0].animation,loop:p.overlays[0].loop};},name);if(saved.title==='Updated title'&&saved.audio===1&&saved.animation==='float'&&saved.loop)break;if(i===29)throw Error('Property edits did not persist: '+JSON.stringify(saved));await page.waitForTimeout(200);}
 if(saved.scenes!==2||saved.source!==originalSource)throw Error('Text editing replaced scene media');
 return {libraryOffsets,selectionScopes:['scene','text','audio','element'],leftProperties:0,motionChecks,continuousMotionsRepeat:true,propertyEditsSaved:true};
}
