const assert=require('node:assert/strict');
const {chromium}=require('../../../node_modules/playwright');
const url='http://127.0.0.1:4188/launcher/test-output/title-home-review/';
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{
  for(const width of [1440,360]){
   const unavailable=await browser.newPage({viewport:{width,height:850}});
   await unavailable.route('**/puppet/*.png',route=>route.abort());
   await unavailable.goto(url+'#title');
   await unavailable.getByRole('link',{name:/代表作をすぐ見る/}).click();
   await unavailable.waitForURL('**/#parking');
   for(const category of ['games','proposals','specifications','ideas','about']){
    await unavailable.goto(url+'#home');
    await unavailable.locator('.cats a[href="#'+category+'"]').click();
    await unavailable.waitForURL('**/#'+category);
   }
   await unavailable.goto(url+'#home');
   await unavailable.locator('.host-work-card[href="#v-link-battle"]').click();
   await unavailable.waitForURL('**/#v-link-battle');
   await unavailable.close();
   console.log(width+': title shortcut, five categories and V-Link link with character assets blocked');
   const page=await browser.newPage({viewport:{width,height:850},hasTouch:width===360});
   page.setDefaultTimeout(5500);
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.clock.install();
   await page.goto(url+'#title');
   await page.getByRole('link',{name:'ポートフォリオを開く'}).click();
   await page.waitForURL('**/#home');
   await page.locator('.cats a[href="#proposals"]').click();
   await page.waitForURL('**/#proposals');
   await page.locator('header a[href="#home"]').first().click();
   await page.waitForSelector('[data-puppet-ready]');
   await page.clock.runFor(2800);
   const host=page.locator('.home-hosts');
   const character=host.locator('[data-actor="ame"]');
   await character.focus();await page.keyboard.press('Enter');
   assert.equal(await host.getAttribute('data-reaction'),'ame');
   await page.clock.runFor(17500);
   await host.locator('[data-skip]').click();
   assert.equal(await host.locator('.puppet-cta').isVisible(),false);
   await host.locator('[data-replay]').click();
   await page.clock.runFor(26800);
   const sample=()=>host.locator('.puppet-root').evaluate(el=>({
    depth:JSON.parse(el.dataset.scene).depth,card:JSON.parse(el.dataset.card||'null')
   }));
   let prior=await sample(),crossed=false;
   for(let f=0;f<55;f++){
    await page.clock.runFor(16);
    const next=await sample();
    if(prior.depth>=.78&&next.depth<.78){
     assert(prior.card&&next.card);
     for(const [key,max] of [['x',6],['y',4],['size',2]])assert(Math.abs(prior.card[key]-next.card[key])<max,'retreat card '+key);
     crossed=true;break;
    }
    prior=next;
   }
   assert(crossed,'retreat crossover was reached');
   await host.locator('[data-replay]').click();
   await page.clock.runFor(9460);
   const beforeOffer=await sample();
   assert(beforeOffer.card,'card exists before presentation');
   assert.equal(await host.locator('.puppet-cta').isVisible(),false);
   await page.clock.runFor(2040);
   assert((await sample()).card.size>beforeOffer.card.size,'card advances before the offer appears');
   await host.locator('.puppet-icon').click();
   await page.waitForURL('**/#v-link-battle');
   await page.locator('header a[href="#home"]').first().click();
   await page.waitForSelector('[data-puppet-ready]');
   await page.clock.runFor(11500);
   assert.equal(await host.locator('.puppet-cta').isVisible(),false);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.clock.runFor(250);
   await host.locator('.puppet-cta').waitFor({state:'visible'});
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.clock.runFor(250);
   await host.locator('.puppet-cta').waitFor({state:'hidden'});
   await page.emulateMedia({reducedMotion:'reduce'});
   await host.locator('.puppet-cta').click();
   await page.waitForURL('**/#v-link-battle');
   assert.deepEqual(errors,[]);
   await page.close();
   console.log(width+': category, character reaction, skip, replay, detail, return cooldown, reduced motion');
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
