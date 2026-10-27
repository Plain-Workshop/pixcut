// Local browser regression: selection owns the right inspector; libraries only select/create.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Social media QA ${Date.now()}`;
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

 const left=page.locator('.library'),right=page.getByRole('complementary',{name:'Selected item properties'});
 const stored=async()=>await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);return await lib.getLibraryProject(entry.id);},name);
 const before=await stored(),source=before.tracks[0].clips[1].image;
 await left.locator('.source-tile').last().dragTo(page.locator('.scene-track .timeline-clip').first());
 await page.waitForFunction(()=>document.querySelectorAll('.scene-track .timeline-clip').length===3);
 let saved=await stored();for(let i=0;i<20&&saved.tracks[0].clips.length!==3;i++){await page.waitForTimeout(100);saved=await stored();}
 if(saved.tracks[0].clips[2].image!==source||saved.tracks[0].clips[2].mediaKind!=='video')throw Error('Dragging template media changed its source');
 if(await page.getByText('That file needs a different format',{exact:false}).count())throw Error('Internal media drag reported unsupported format');
 await left.getByRole('button',{name:'Elements',exact:true}).click();await left.getByLabel('Element collection').selectOption('buttons-motion');
 if(await left.locator('.element-card').count()!==10)throw Error('New social actions missing');
 await page.screenshot({path:'output/playwright/social-actions-library.png'});
 await left.getByRole('button',{name:'Add Notification click',exact:true}).click();
 await right.getByRole('heading',{name:'Element properties',exact:true}).waitFor();
 await right.locator('.overlay-action > summary').click();await right.getByLabel('Element action',{exact:true}).selectOption('ring');
 await right.locator('.element-sounds > summary').click();await right.getByLabel('Element sound effect',{exact:true}).selectOption('bell');
 await right.getByRole('button',{name:'At action',exact:true}).click();
 let cue;for(let i=0;i<25;i++){saved=await stored();cue=saved.audio.find(a=>a.name==='Bell ring');if(cue)break;await page.waitForTimeout(100);}
 const element=saved.overlays.find(e=>e.presetId==='buttons-motion-03');if(!cue||cue.startTicks!==element.startTicks+element.action.startTicks)throw Error('Bell cue is not aligned with timed ring action');
 await right.locator('.element-sounds > summary').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/social-element-sound.png'});
 await left.getByRole('button',{name:'Audio',exact:true}).click();await left.locator('.sound-library > summary').click();await left.getByRole('button',{name:'Add Subscribe click at playhead',exact:true}).click();
 for(let i=0;i<25;i++){saved=await stored();if(saved.audio.some(a=>a.name==='Subscribe click'))break;await page.waitForTimeout(100);}
 if(!saved.audio.some(a=>a.name==='Subscribe click'))throw Error('General sound effect was not added');
 await page.screenshot({path:'output/playwright/sound-effects-library.png'});
 const samples=await page.evaluate(async()=>{
  const {ELEMENT_CATALOG}=await import('/src/components/elements/catalog.ts'),{drawElementOverlay}=await import('/src/components/preview/render.ts');
  const p=ELEMENT_CATALOG.filter(p=>p.collection==='buttons-motion'),hashes=[];
  for(const preset of p){
   const element={id:'e',kind:preset.kind,presetId:preset.id,label:preset.text,x:.5,y:.5,width:.8,height:.5,color:preset.color,opacity:100,rotation:0,startTicks:0,durationTicks:120,animation:'none'};
   const scene={id:'s',name:'',image:'',startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#ffffff',fit:'cover',elements:[element]};
   const c=document.createElement('canvas');await drawElementOverlay(c,scene,'e',.2,'16:9',undefined,{width:320,height:180},[],true);const a=c.toDataURL();await drawElementOverlay(c,scene,'e',1.3,'16:9',undefined,{width:320,height:180},[],true);if(a===c.toDataURL())throw Error(`${preset.id} does not animate internally`);hashes.push(a);
  }
  if(new Set(hashes).size!==10)throw Error('Duplicate social compositions');return hashes.length;
 });
 return {templateVideoDrag:'appended same source',newSocialActions:samples,bellCueAligned:true,generalSoundAdded:true};
}
