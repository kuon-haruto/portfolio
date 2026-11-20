const {chromium}=require('../../../node_modules/playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {join}=require('node:path');
const {performance}=require('node:perf_hooks');
const {setTimeout:sleep}=require('node:timers/promises');

(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 const full=process.argv.includes('--full');
 const background=process.argv.includes('--background');
 const first=process.argv.includes('--first');
 const totalFrames=12*(first?(full?45:23):background?15:full?34:13);
 try{
  for(const [label,width,height] of [['desktop',1440,900],['mobile',360,800]]){
   const page=await browser.newPage({viewport:{width,height}});
   if(background)await page.addInitScript(()=>sessionStorage.setItem('vlink-intro-seen',Date.now()));
   await page.goto('http://127.0.0.1:4188/launcher/test-output/title-home-review/#home');
   await page.waitForSelector('[data-puppet-ready]');
   const stage=page.locator('.home-hosts');
   const clip=full?'full':first?'first':background?'background':'intro';
   const encoder=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','12','-vcodec','mjpeg','-i','pipe:0','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-pix_fmt','yuv420p','-movflags','+faststart',join(__dirname,label+'-vlink-'+clip+'.mp4')],{stdio:['pipe','ignore','inherit'],windowsHide:true});
   const finished=once(encoder,'exit');
   try{
    await stage.scrollIntoViewIfNeeded();
    if(!background&&!first)await page.locator('[data-replay]').click();
    const start=performance.now();
    let offered=false;
    for(let frame=0;frame<totalFrames;){
     const jpeg=await stage.screenshot({type:'jpeg',quality:86});
     const due=Math.min(totalFrames,Math.max(frame+1,Math.round((performance.now()-start)*.012)));
     if(!offered&&frame>=120)offered=await page.locator('.puppet-cta').isVisible();
     while(frame<due){if(!encoder.stdin.write(jpeg))await once(encoder.stdin,'drain');frame++}
     await sleep(Math.max(0,frame*1000/12-(performance.now()-start)));
    }
    if(background?offered:!offered)throw Error(label+' unexpected presentation state');
    if(full&&await page.locator('.puppet-cta').isVisible())throw Error(label+' presentation did not end');
    if(full){
     const scene=JSON.parse(await stage.locator('.puppet-root').getAttribute('data-scene'));
     if(scene.phase!=='background')throw Error(label+' did not resume the background scene');
    }
   }finally{encoder.stdin.end();const [status]=await finished;if(status!==0)throw Error('ffmpeg exited '+status)}
   console.log(label+' recording saved');await page.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
