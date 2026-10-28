// Local browser regression: real decoded audio paints the timeline, and hover previews move only while engaged.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Spectrogram QA ${Date.now()}`;
 await page.evaluate(async name=>{
  const m=await import('/src/stores/model.ts'),lib=await import('/src/stores/library.ts');const {bellSound}=await import('/src/components/elements/sound.ts');
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');const gradient=ctx.createLinearGradient(0,0,640,360);gradient.addColorStop(0,'#FF6B6B');gradient.addColorStop(.5,'#7C4DFF');gradient.addColorStop(1,'#0EE7B7');ctx.fillStyle=gradient;ctx.fillRect(0,0,640,360);
  const scene={id:'scene',name:'Colour scene',image:c.toDataURL(),startTicks:0,sourceInTicks:0,durationTicks:240,title:'Colour scene',subtitle:'',color:'#FFFFFF',fit:'cover',textLayers:[]};
  const next={...scene,id:'next',name:'Next colour scene',startTicks:240,image:c.toDataURL(),title:'Next colour scene'};
  const project=m.edit(m.emptyProject(name),{type:'add',scenes:[scene,next]});
  project.audio=[{id:'bell',name:'Bell spectrum',data:bellSound(8,true),lane:0,startTicks:0,durationTicks:240,sourceInSeconds:0,sourceDurationSeconds:8,volume:.8,fadeIn:0,fadeOut:0}];
  project.overlays=[{id:'motion',kind:'name-tag',label:'Hover motion',x:.5,y:.5,width:.3,height:.12,rotation:0,opacity:100,color:'#C5B4FF',startTicks:0,durationTicks:480,animation:'fade',loop:false}];
  await lib.saveLibraryProject(project);
 },name);
 await page.reload();await page.getByRole('button',{name:new RegExp(`^16:9 ${name}`)}).click();
 const spectrum=page.locator('canvas.audio-spectrogram').last();await spectrum.waitFor({state:'visible'});
 await page.waitForFunction(el=>el.dataset.ready==='true',await spectrum.elementHandle(),{timeout:30000});
 const sample=await spectrum.evaluate(canvas=>{const c=canvas.getContext('2d');const data=c.getImageData(0,0,canvas.width,canvas.height).data;let min=255,max=0,colors=new Set();for(let i=0;i<data.length;i+=4){const v=data[i]+data[i+1]+data[i+2];min=Math.min(min,v);max=Math.max(max,v);colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);}return {min,max,colors:colors.size,columns:canvas.dataset.columns};});
 if(Number(sample.columns)<2||sample.colors<12||sample.max-sample.min<30)throw Error('Timeline spectrogram is blank or synthetic');
 const display=page.getByLabel('Timeline audio display');await display.selectOption('waveform');if(!await page.locator('.audio-waveform').last().isVisible())throw Error('Waveform fallback is unavailable');await display.selectOption('spectrogram');
 const right=page.getByRole('complementary',{name:'Selected item properties'});await page.locator('.scene-track .timeline-clip').first().click();await right.getByRole('tab',{name:'Looks',exact:true}).click();
 const looks=right.locator('canvas[data-look]');if(await looks.count()<4)throw Error('Looks lack real preview canvases');
 const lookFrames=[];for(let i=0;i<Math.min(4,await looks.count());i++)lookFrames.push(await looks.nth(i).evaluate(c=>c.toDataURL()));if(new Set(lookFrames).size<3)throw Error('Looks previews do not show distinct visual grades');
 await right.getByRole('tab',{name:'Transitions',exact:true}).click();const transition=right.locator('canvas[data-transition="wipe"]');await transition.hover();const transitionFrames=new Set();for(let i=0;i<8;i++){transitionFrames.add(await transition.evaluate(c=>c.toDataURL()));await page.waitForTimeout(150);}if(transitionFrames.size<2)throw Error('Transition does not preview while hovered');
 await page.locator('.element-row .element-clip').first().click();const entrance=right.locator('canvas[data-motion="fade"]');await entrance.hover();const entranceFrames=new Set();for(let i=0;i<8;i++){entranceFrames.add(await entrance.evaluate(c=>c.toDataURL()));await page.waitForTimeout(150);}if(entranceFrames.size<2)throw Error('Element entrance does not preview while hovered');
 await page.screenshot({path:'output/playwright/spectrogram-and-hover-previews.png'});
 return {spectrogram:sample,looks:new Set(lookFrames).size,hoveredTransition:true,hoveredEntrance:true};
}
