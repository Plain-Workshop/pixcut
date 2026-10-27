// Local browser regression: selection owns the right inspector; libraries only select/create.
async page=>{
 await page.goto('http://127.0.0.1:1420/');await page.emulateMedia({reducedMotion:'no-preference'});
 const name=`Formats QA ${Date.now()}`;
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

 await page.getByRole('button',{name:/^Formats \d/}).click();
 const dialog=page.getByRole('dialog'),browser=dialog.locator('.format-browser'),selection=dialog.getByRole('complementary',{name:'Selected format settings'});
 const seen=[];
 async function tab(name){await dialog.getByRole('tab',{name,exact:true}).click();}
 async function geometry(){return await dialog.evaluate(el=>{const d=el.getBoundingClientRect(),done=el.querySelector('.format-studio-footer').getBoundingClientRect();return {height:d.height,overflow:el.scrollHeight>el.clientHeight+1,bottom:done.bottom,viewport:innerHeight};});}
 const initial=await geometry();if(initial.height>680||initial.overflow||initial.bottom>initial.viewport)throw Error('Unbounded dialog: '+JSON.stringify(initial));
 if(await browser.locator('.format-card').count()!==15)throw Error('Social presets are missing or include sizes');
 seen.push(...await browser.getByRole('checkbox').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))));
 await browser.getByLabel('Social platform').selectOption('Instagram');if(await browser.locator('.format-card').count()!==4)throw Error('Platform filter failed');
 await browser.getByLabel('Search formats').fill('square');if(await browser.locator('.format-card').count()!==1)throw Error('Search failed');
 await browser.getByLabel('Search formats').fill('no-such-format');if(!await browser.getByText('No matching formats. Try another search.').isVisible())throw Error('No empty search state');
 await browser.getByLabel('Search formats').fill('');await browser.getByLabel('Social platform').selectOption('all');
 await browser.locator('.format-card').filter({has:page.getByRole('checkbox',{name:'YouTube Shorts',exact:true})}).click();
 await selection.getByRole('button',{name:/^YouTube Shorts/}).waitFor();
 await browser.locator('.format-preset-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const scrolled=await geometry();if(scrolled.bottom!==initial.bottom)throw Error('Done moved while scrolling presets');
 await browser.locator('.format-preset-scroll').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:'output/playwright/formats-social.png'});
 await tab('Standard sizes');if(await browser.locator('.format-card').count()!==12)throw Error('Standard and 4K sizes missing');
 seen.push(...await browser.getByRole('checkbox').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))));
 const catalog=await page.evaluate(async()=>{const m=await import('/src/stores/formats.ts');return m.FORMAT_PRESETS.map(p=>p.name);});
 if(JSON.stringify(seen.sort())!==JSON.stringify(catalog.sort()))throw Error('Some presets are unreachable');
 if(await browser.getByLabel('Social platform').count())throw Error('Social filter leaked into sizes');
 await page.screenshot({path:'output/playwright/formats-sizes.png'});
 await tab('Custom');if(await browser.locator('.format-card').count())throw Error('Presets leaked into Custom');
 const custom=browser.locator('.custom-format-form');await custom.getByLabel('Name',{exact:true}).fill('Client portrait');await custom.getByLabel('Width',{exact:true}).fill('1200');await custom.getByLabel('Height',{exact:true}).fill('1600');
 await custom.getByRole('button',{name:'Add custom',exact:true}).click();
 await selection.getByRole('button',{name:/^Client portrait/}).waitFor();
 await selection.getByRole('combobox',{name:'Quality',exact:true}).selectOption('high');
 await tab('Social');await browser.getByRole('checkbox',{name:'YouTube Shorts',exact:true}).waitFor();if(!await browser.getByRole('checkbox',{name:'YouTube Shorts',exact:true}).isChecked())throw Error('Selection lost on tab change');
 await selection.getByRole('button',{name:/^Client portrait/}).click();if(await selection.getByRole('combobox',{name:'Quality',exact:true}).inputValue()!=='high')throw Error('Settings lost on tab change');
 await page.setViewportSize({width:1050,height:720});
 const small=await geometry();if(small.overflow||small.height>664||small.bottom>720)throw Error('Dialog does not fit minimum window: '+JSON.stringify(small));
 await page.screenshot({path:'output/playwright/formats-minimum-window.png'});
 await tab('Custom');await page.screenshot({path:'output/playwright/formats-custom.png'});
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.setViewportSize({width:1550,height:1100});
 return {allPresetsReachable:seen.length,separateSections:true,selectionAndSettingsPersist:true,footerFixed:true,initial,minimumWindow:small};
}
