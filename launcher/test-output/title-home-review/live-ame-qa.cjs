const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../node_modules/playwright');
const base='http://127.0.0.1:4177/launcher/test-output/title-home-review/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}), results=[];
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'#title');await page.getByRole('link',{name:'ポートフォリオを開く',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameReady==='true',{timeout:60000});
   await page.waitForTimeout(1100);
   const first=await page.locator('.live-ame canvas').evaluate(c=>c.toDataURL());
   await page.waitForTimeout(350);
   const second=await page.locator('.live-ame canvas').evaluate(c=>c.toDataURL());assert.notEqual(first,second);
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameState==='holding',{timeout:60000});
   const stage=page.locator('#ame-stage');await stage.scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(__dirname,`live-ame-${name}.png`),fullPage:true});
   const pixels=await stage.locator('canvas').evaluate(c=>{
    const gl=c.getContext('webgl2'),data=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>32)count++;return {count,total:c.width*c.height};
   });assert(pixels.count>1000);
   await page.getByRole('button',{name:'あめに手を振る',exact:true}).click({position:{x:20,y:25}});
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameState==='wave');
   await page.waitForTimeout(600);
   await stage.screenshot({path:path.join(__dirname,`live-ame-${name}-wave.png`)});
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameState==='holding');
   await page.getByRole('link',{name:'すべる宇宙駐車場の作品を見る',exact:true}).click();
   await page.waitForURL('**/#parking');assert.equal(await page.locator('.live-ame').count(),0);
   await page.getByRole('link',{name:'ホームへ戻る',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameReady==='true');
   assert.equal(await page.locator('.live-ame canvas').count(),1);
   await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameState==='gone',{timeout:30000});
   const gone=await page.locator('.ame-icon').isHidden();assert(gone);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);
   await page.locator('header nav').getByRole('link',{name:'制作ゲーム',exact:true}).click();await page.waitForURL('**/#games');
   await page.locator('header nav').getByRole('link',{name:'ホーム',exact:true}).click();await page.waitForURL('**/#home');
   results.push({name,pixels,movingPixels:true,menuUsable:true,journey:'title -> home -> wave -> offer -> parking -> home -> reclaim -> leave',overflow,errors});
   assert.equal(errors.length,0);await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(base+'#home');await page.waitForFunction(()=>document.querySelector('#ame-stage')?.dataset.ameState==='holding');
  await page.locator('#ame-stage').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname,'live-ame-reduced.png'),fullPage:true});
  await page.getByRole('button',{name:'あめに手を振る',exact:true}).click({position:{x:15,y:15}});
  await page.waitForTimeout(2000);assert.equal(await page.locator('#ame-stage').getAttribute('data-ame-state'),'holding');
  await page.getByRole('link',{name:'すべる宇宙駐車場の作品を見る',exact:true}).click();await page.waitForURL('**/#parking');
  results.push({reducedMotion:'static offer, text greeting, working icon'});
  await page.goto(base+'#home');await page.goto(base+'#title');await page.waitForTimeout(2000);
  assert.equal(await page.locator('.live-ame').count(),0);
  fs.writeFileSync(path.join(__dirname,'live-ame-qa.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
