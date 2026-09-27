const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const output = path.resolve(__dirname,'../launcher/test-output/bug-hunter');

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[],records=[];let mouseX=700,mouseY=450;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const stats=()=>page.evaluate(()=>window.__bugHunterStats);
  const fresh=async()=>{await page.waitForTimeout(1150);return stats();};
  const state=s=>page.waitForFunction(s=>window.__bugHunterStats?.screen===s,s,{timeout:90000});
  async function control(name,fraction=.5){
    await page.waitForFunction(n=>window.__bugHunterStats?.ui?.some(c=>c.name===n&&c.enabled),name);
    const c=(await stats()).ui.find(c=>c.name===name),b=await page.locator('canvas').boundingBox();
    mouseX=b.x+b.width*(c.x+c.width*fraction);mouseY=b.y+b.height*(c.y+c.height*.5);
    await page.mouse.click(mouseX,mouseY,{delay:120});await fresh();
  }
  async function lock(){
    const b=await page.locator('canvas').boundingBox();mouseX=b.x+b.width/2;mouseY=b.y+b.height/2;
    await page.mouse.click(mouseX,mouseY,{delay:140});
    await page.waitForFunction(()=>document.pointerLockElement&&window.__bugHunterStats?.lookLocked);await fresh();
  }
  async function delta(x,y){mouseX+=x;mouseY+=y;await page.mouse.move(mouseX,mouseY,{steps:10});await fresh();}
  async function turn(yaw,pitch=8){
    const s=await stats();let d=((yaw-s.viewYaw+540)%360)-180;
    await delta(d/(.22*s.sensitivity),(pitch-s.viewPitch)/(.22*s.sensitivity));
  }
  async function walk(x,z){
    for(let n=0;n<25;n++){
      const s=await stats(),dx=x-s.playerPosition.x,dz=z-s.playerPosition.z,d=Math.hypot(dx,dz);
      if(d<.45)return;
      await turn(Math.atan2(dx,dz)*180/Math.PI,8);
      await page.keyboard.down('w');await page.waitForTimeout(Math.min(750,(d-.2)/2.8*1000));await page.keyboard.up('w');await fresh();
    }
    throw Error(`Cannot walk to ${x},${z}: ${JSON.stringify((await stats()).playerPosition)}`);
  }
  async function shot(name){
    const bytes=await page.locator('canvas').screenshot({path:path.join(output,name+'.png')});const png=PNG.sync.read(bytes);
    let sum=0,dark=0,light=0,n=0;const colors=new Set();
    for(let y=Math.floor(png.height*.18);y<png.height*.8;y+=3)for(let x=0;x<png.width;x+=3){
      const i=(y*png.width+x)*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2],l=.2126*r+.7152*g+.0722*b;
      sum+=l;n++;if(l<65)dark++;if(l>145)light++;colors.add(`${r>>3},${g>>3},${b>>3}`);
    }
    assert(colors.size>45,'nonblank scene: '+name);
    const s=await stats();assert(s.settingsLayoutValid,'slider fill and handle stay inside the control');for(const c of s.ui)assert(c.x>=-.001&&c.y>=-.001&&c.x+c.width<=1.001&&c.y+c.height<=1.001,'UI in bounds: '+c.name);
    const record={name,...s,luminance:sum/n,dark:dark/n,light:light/n,colors:colors.size};records.push(record);
    console.log(name,JSON.stringify({fps:s.fps,memory:s.memory,heap:s.wasmHeapBytes,trees:s.trees,rocks:s.rocks,triangles:s.terrainTriangles,luminance:record.luminance,dark:record.dark,light:record.light}));
  }
  try{
    await page.goto(process.env.BUG_HUNTER_URL||`http://127.0.0.1:${server.address().port}/play/bug-hunter/`);await state('forest');await page.waitForTimeout(4000);
    assert(!(await stats()).ui.some(c=>c.name==='Capture'),'desktop text capture button is removed');
    await shot('quality-forest');
    await lock();const start=await stats();await delta(80,0);const baseline=((await stats()).viewYaw-start.viewYaw+360)%360;await delta(-80,0);
    await page.keyboard.press('Escape');await fresh();await control('Settings');assert((await stats()).settingsOpen);
    const position=(await stats()).playerPosition;await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');await fresh();assert.deepEqual((await stats()).playerPosition,position,'settings freeze movement');
    await control('Sensitivity',.75);await control('Volume',.20);await shot('quality-settings');
    const configured=await stats();assert(configured.sensitivity>2&&configured.volume>.1&&configured.volume<.3,'sliders change actual values');
    await control('ApplySettings');await lock();const before=await stats();await delta(80,0);const changed=((await stats()).viewYaw-before.viewYaw+360)%360;
    assert(Math.abs(changed/baseline-configured.sensitivity)<.12,'sensitivity changes measured camera rotation');await delta(-80,0);
    await page.reload();await state('forest');await fresh();let restored=await stats();
    assert(Math.abs(restored.sensitivity-configured.sensitivity)<.01&&Math.abs(restored.volume-configured.volume)<.01,'preferences survive reload');
    await control('Settings');await control('Volume',0);assert.equal((await stats()).volume,0,'volume can mute completely');await control('TestSound');
    await control('ResetSettings');assert.equal((await stats()).sensitivity,1);assert.equal((await stats()).volume,.75);await control('CloseSettings');
    await lock();await page.keyboard.down('w');await page.waitForTimeout(850);await page.keyboard.up('w');
    await page.waitForFunction(()=>window.__bugHunterStats?.target&&window.__bugHunterStats?.focus>.9);
    for(let i=0;i<5&&(await stats()).count===0;i++){await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();await page.waitForTimeout(2200);}
    assert((await stats()).count>0,'left-click capture survives UI removal');await page.keyboard.press('Tab');await state('collection');await shot('quality-specimen');
    await control('Explore');await state('forest');await lock();
    await walk(1.7,-11);await turn(70,15);await shot('quality-stream');
    const still=PNG.sync.read(await fs.readFile(path.join(output,'quality-stream.png')));
    await page.waitForTimeout(700);
    const moving=PNG.sync.read(await page.locator('canvas').screenshot({path:path.join(output,'quality-stream-flow.png')}));
    let waterPixels=0,movingWaterPixels=0;
    for(let y=Math.floor(still.height*.55);y<still.height*.8;y++)for(let x=0;x<still.width*.4;x++){
      const i=(y*still.width+x)*4,r=still.data[i],g=still.data[i+1],b=still.data[i+2];
      if(b>r*1.12&&g>r*1.12&&b>65){waterPixels++;if(Math.abs(r-moving.data[i])+Math.abs(g-moving.data[i+1])+Math.abs(b-moving.data[i+2])>8)movingWaterPixels++;}
    }
    assert(waterPixels>100&&movingWaterPixels>waterPixels*.1,'the visible stream surface animates while the camera stays still');
    await turn(270,-50);await shot('quality-canopy');
    for(const [x,z] of [[-1,-6],[-1,0],[0,5],[0,10],[-2,13]])await walk(x,z);
    await turn(35,-8);await shot('quality-clearing');
    assert(records.find(r=>r.name==='quality-clearing').light>records.find(r=>r.name==='quality-canopy').light+.1,'open meadow receives visibly more daylight than closed canopy');
    await page.keyboard.press('Escape');await fresh();await control('Settings');await page.locator('#fullscreen').click();
    await page.waitForFunction(()=>document.fullscreenElement);await page.waitForTimeout(1500);await shot('quality-settings-fullscreen');
    await page.setViewportSize({width:390,height:960});await page.waitForTimeout(2000);await shot('quality-settings-portrait');
    assert(records.every(r=>r.wasmHeapBytes<=256*1024**2&&r.memory<64*1024**2),'detailed assets stay inside measured memory bounds');
    assert(records.every(r=>r.fps>30),'sampled scenes remain interactive');
    assert.equal(errors.length,0,errors.join('\n'));
    await fs.writeFile(path.join(output,'quality.json'),JSON.stringify({records,errors,baseline,configured},null,2));
    console.log('BUG_HUNTER_QUALITY_OK');
  }catch(error){console.error(await stats());await page.locator('canvas').screenshot({path:path.join(output,'quality-failure.png')});throw error;}
  finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
