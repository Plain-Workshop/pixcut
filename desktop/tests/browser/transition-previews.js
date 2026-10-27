// Local browser regression: selection owns the right inspector; libraries only select/create.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Transition QA ${Date.now()}`;
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

 const right=page.getByRole('complementary',{name:'Selected item properties'});
 await page.locator('.scene-track .timeline-clip').first().click();await right.getByRole('tab',{name:'Transitions',exact:true}).click();
 const previews=right.locator('canvas[data-transition]');if(await previews.count()!==9)throw Error('Missing transition examples');
 const checks={};
 for(let i=0;i<9;i++){
  const canvas=previews.nth(i);await canvas.scrollIntoViewIfNeeded();const type=await canvas.getAttribute('data-transition'),frames=new Set();
  for(let sample=0;sample<13;sample++){frames.add(await canvas.evaluate(c=>c.toDataURL()));await page.waitForTimeout(150);}
  if(frames.size<2)throw Error(`${type} example does not animate`);checks[type]=frames.size;
 }
 await right.locator('canvas[data-transition="wipe"]').click();
 let saved;
 for(let i=0;i<20;i++){
  saved=await page.evaluate(async name=>{const lib=await import('/src/stores/library.ts');const entry=(await lib.listProjects()).find(e=>e.name===name);return (await lib.getLibraryProject(entry.id)).tracks[0].clips[0].transition?.type;},name);
  if(saved==='wipe')break;await page.waitForTimeout(150);
 }
 if(saved!=='wipe')throw Error('Transition selection did not save');
 await right.getByRole('tab',{name:'Transitions',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/animated-transitions.png'});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(let i=0;i<9;i++){
  const c=previews.nth(i);await c.scrollIntoViewIfNeeded();await page.waitForTimeout(80);const frame=await c.evaluate(el=>el.toDataURL());await page.waitForTimeout(120);if(frame!==await c.evaluate(el=>el.toDataURL()))throw Error('Reduced-motion preview still animates');
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 const parity=await page.evaluate(async()=>{
  const {drawScene,drawTransition}=await import('/src/components/preview/render.ts');const {drawTransitionFrames}=await import('/src/components/preview/transitions.ts');
  const {DEFAULT_TIMEBASE}=await import('/src/stores/model.ts');
  function scene(id,color){const c=document.createElement('canvas');c.width=192;c.height=108;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,192,108);ctx.fillStyle='#ffffff';ctx.fillRect(id==='a'?20:90,25,50,40);return {id,name:id,image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:120,title:'',subtitle:'',color:'#ffffff',fit:'cover'};}
  const a=scene('a','#8A65C5'),b=scene('b','#65C5A8'),ac=document.createElement('canvas'),bc=document.createElement('canvas'),example=document.createElement('canvas'),exported=document.createElement('canvas'),size={width:192,height:108};
  example.getContext('2d',{willReadFrequently:true});exported.getContext('2d',{willReadFrequently:true});
  await drawScene(ac,a,'16:9','export',0,DEFAULT_TIMEBASE,size);await drawScene(bc,b,'16:9','export',0,DEFAULT_TIMEBASE,size);
  let maxDifference=0;
  for(const type of ['fade','slide','wipe','zoom','blur','circle','slide-up','spin'])for(const progress of [0,.25,.5,.75,1]){
   drawTransitionFrames(example,ac,bc,type,progress);await drawTransition(exported,a,b,type,'16:9','export',progress,0,0,DEFAULT_TIMEBASE,size);
   const x=example.getContext('2d').getImageData(0,0,192,108).data,y=exported.getContext('2d').getImageData(0,0,192,108).data;
   let difference=0;for(let i=0;i<x.length;i++)difference=Math.max(difference,Math.abs(x[i]-y[i]));maxDifference=Math.max(maxDifference,difference);
   if(difference!==0)throw Error(`${type} sample/export mismatch at ${progress}: max channel difference ${difference}`);
  }
  return {frames:40,maxChannelDifference:maxDifference};
 });
 await right.getByRole('tab',{name:'Transitions',exact:true}).scrollIntoViewIfNeeded();
 return {animatedExamples:checks,reducedMotionStatic:true,selectionSaved:saved,matchingExportFrames:parity};
}
