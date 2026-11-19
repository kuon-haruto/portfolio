const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../node_modules/playwright');
const root=path.resolve(__dirname,'../../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{
  try{
    const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep))throw Error('Outside workspace');
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/launcher/test-output/title-home-review/`;
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const errors=[],results={assets:[],boards:[]};
  try{
    const page=await browser.newPage({viewport:{width:800,height:1000},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'model-stage.html');await page.waitForFunction(()=>window.modelReady,{timeout:60000});
    for(const pose of ['idle','peek','offer']){
      results.assets.push(await page.evaluate(p=>window.setPose(p),pose));
      await page.locator('canvas').screenshot({path:path.join(__dirname,`ame-${pose}.png`),omitBackground:true});
    }
    await page.setViewportSize({width:1600,height:1100});await page.goto(base+'design.html');await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    for(const id of ['a','b']){
      const board=page.locator('#board-'+id);
      await board.screenshot({path:path.join(__dirname,`comparison-${id}.png`)});
      const check=await board.evaluate(el=>{
        const overflow=[...el.querySelectorAll('h1,h2,h3,p,a,.speech')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.textContent);
        const clippedText=[...el.querySelectorAll('.screen h2,.screen h3,.screen p,.screen a')].filter(e=>{
          const clip=e.closest('.category')||e.closest('.screen');if(!clip)return false;
          const a=e.getBoundingClientRect(),b=clip.getBoundingClientRect();return a.bottom>b.bottom+1||a.right>b.right+1||a.left<b.left-1;
        }).map(e=>e.textContent);
        return {width:el.offsetWidth,height:el.offsetHeight,scenes:el.querySelectorAll('.screen').length,overflow,clippedText,missingImages:[...el.querySelectorAll('img')].filter(i=>!i.naturalWidth).length};
      });
      results.boards.push({id,...check});
      if(process.argv.includes('--qa'))for(const n of [0,1,2])await board.locator('.screen').nth(n).screenshot({path:path.join(__dirname,`scene-${id}-${n+1}.png`)});
    }
    results.errors=errors;fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
    if(errors.length||results.assets.some(a=>a.visible<10000)||results.boards.some(b=>b.overflow.length||b.clippedText.length||b.missingImages||b.scenes!==3))process.exitCode=1;
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
