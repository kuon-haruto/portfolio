const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const output = path.resolve(__dirname, '../launcher/test-output/bug-hunter');

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const measurements = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  const url = process.env.BUG_HUNTER_URL || `http://127.0.0.1:${server.address().port}/play/bug-hunter/`;
  const stats = () => page.evaluate(() => window.__bugHunterStats);
  const waitState = screen => page.waitForFunction(screen => window.__bugHunterStats?.screen === screen, screen, { timeout: 90000 });
  const tap = async (x, y, w = 1280, h = 720) => {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x + box.width * x / w, box.y + box.height * y / h);
  };
  const click = async name => {
    await page.waitForFunction(name => window.__bugHunterStats?.ui?.some(b => b.name === name && b.enabled), name);
    const button = (await stats()).ui.find(b => b.name === name);
    await tap(button.x + button.width / 2, button.y + button.height / 2, 1, 1);
  };
  async function shot(name) {
    if (await page.evaluate(() => Boolean(document.fullscreenElement))) {
      const bounds = await page.locator('canvas').evaluate(canvas => {
        const r=canvas.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};
      });
      assert(bounds.left>=0&&bounds.top>=0&&bounds.right<=bounds.w+.1&&bounds.bottom<=bounds.h+.1,
        `${name}: rendered canvas must fit the actual fullscreen viewport: ${JSON.stringify(bounds)}`);
    }
    const bytes = await page.locator('canvas').screenshot({ path: path.join(output, name + '.png') });
    const png = PNG.sync.read(bytes), colors = new Set();
    for (let y = Math.floor(png.height * .3); y < png.height * .7; y += 5) for (let x = 0; x < png.width; x += 5) {
      let i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
    }
    assert(colors.size > 25, `${name}: canvas appears blank (${colors.size} colors)`);
    const current=await stats();
    for(const control of current.ui) {
      assert(control.x>=-.001 && control.y>=-.001 && control.x+control.width<=1.001 && control.y+control.height<=1.001, `${name}: control stays in canvas: ${control.name}`);
    }
    for(let a=0;a<current.ui.length;a++)for(let b=a+1;b<current.ui.length;b++) {
      const x=current.ui[a],y=current.ui[b];
      const overlapX=Math.min(x.x+x.width,y.x+y.width)-Math.max(x.x,y.x);
      const overlapY=Math.min(x.y+x.height,y.y+y.height)-Math.max(x.y,y.y);
      assert(overlapX<.001 || overlapY<.001, `${name}: overlapping controls ${x.name} / ${y.name}`);
    }
    if(name==='battle-moving-desktop'||name==='battle-mobile'||name==='battle-fullscreen') {
      let purple=0,cyan=0;
      for(let y=Math.floor(png.height*.31);y<png.height*.70;y++)for(let x=0;x<png.width;x++) {
        const i=(y*png.width+x)*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2];
        if(r>g*1.25&&b>r*1.1&&b>70)purple++;
        if(g>r*1.6&&b>r*1.8&&g>150&&b>180)cyan++;
      }
      assert(purple>60 && cyan>8, `${name}: partner and team marker must be visible, not hidden behind scenery (${purple}/${cyan})`);
    }
    const {screen,count,fps,memory,wasmHeapBytes,navigation,travelA,travelB} = await stats();
    console.log(name, {screen,count,fps,memory,wasmHeapBytes,navigation,travelA,travelB}, 'colors=' + colors.size);
    measurements.push({ name, ...(await stats()), colors: colors.size });
  }
  try {
    await page.goto(url);
    await waitState('forest');
    await page.waitForTimeout(3000);
    await shot('forest-desktop');
    const forest = await stats();
    assert.equal(forest.wildCount, 8, 'sparse habitat population');
    assert(forest.visibleWild <= 3, 'initial view is not crowded with insects');
    assert.equal(forest.habitats.filter(h => h.normal.y === 0).length, 3, 'three insects cling to tree sides');
    assert(forest.habitats.every(h => h.scale < .3), 'wild insects use a small environmental scale');
    assert(forest.habitats.every(h => Math.abs(h.position.x-h.home.x)+Math.abs(h.position.y-h.home.y)+Math.abs(h.position.z-h.home.z)<.1), 'crawl remains attached to habitat');
    assert((await stats()).fps < 80, 'high-refresh displays do not cause unnecessary rendering');
    await page.locator('canvas').focus();
    const canvasBox=await page.locator('canvas').boundingBox();
    const mx=canvasBox.x+canvasBox.width/2,my=canvasBox.y+canvasBox.height/2;
    await page.mouse.click(mx,my,{delay:150});
    await page.waitForFunction(()=>document.pointerLockElement?.id==='game-canvas'&&window.__bugHunterStats?.lookLocked);
    assert.equal((await stats()).count,0,'entry click only starts free look');
    const original=await stats();
    await page.mouse.move(mx+80,my+30,{steps:8});await page.waitForTimeout(1200);
    const turned=await stats();
    assert(Math.abs(turned.viewYaw-original.viewYaw)>5&&Math.abs(turned.viewPitch-original.viewPitch)>2,'mouse movement without any held button turns the camera');
    await page.mouse.move(mx,my,{steps:8});await page.waitForTimeout(1200);
    assert(Math.abs((await stats()).viewYaw-original.viewYaw)<1,'opposite movement restores yaw');
    await page.keyboard.down('w'); await page.waitForTimeout(850); await page.keyboard.up('w');
    await page.waitForFunction(() => window.__bugHunterStats?.target && window.__bugHunterStats?.focus > .9);
    await shot('tree-capture-desktop');
    assert.equal((await stats()).targetHabitat, 'クヌギの幹');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.pointerLockElement&&!window.__bugHunterStats?.lookLocked);
    const released=await stats();
    await page.mouse.move(mx+80,my+30);await page.waitForTimeout(1200);
    assert.equal((await stats()).viewYaw,released.viewYaw,'released cursor does not rotate the view');
    await click('Collection');await waitState('collection');
    assert.equal((await stats()).count,0,'clicking the collection UI does not capture the targeted insect');
    assert.equal(await page.evaluate(()=>document.pointerLockElement),null,'menu click does not lock the cursor');
    await click('Explore');await waitState('forest');
    assert.equal(await page.evaluate(()=>document.pointerLockElement),null,'return click is not reused as a forest click');
    await page.mouse.click(mx,my,{delay:150});
    await page.waitForFunction(()=>document.pointerLockElement?.id==='game-canvas'&&window.__bugHunterStats?.lookLocked);
    await page.waitForTimeout(1200);
    assert.equal((await stats()).count,0,'re-entry click does not capture');
    assert(Math.abs((await stats()).viewYaw-released.viewYaw)<1,'re-entering free look does not jerk the camera');
    await page.waitForFunction(()=>window.__bugHunterStats?.target&&window.__bugHunterStats?.focus>.9);
    for (let attempt = 0; attempt < 5 && (await stats()).count === 0; attempt++) {
      await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();await page.waitForTimeout(1800);
    }
    assert((await stats()).count > 0, 'capture must add an individual');
    await page.keyboard.press('Tab'); await waitState('collection');
    assert.equal(await page.evaluate(()=>document.pointerLockElement),null,'opening the collection releases the pointer');
    await shot('collection-desktop');
    await click('Train'); await page.waitForTimeout(1300);
    assert((await stats()).level >= 2, 'training levels up the captured insect');
    await click('Practice'); await waitState('battle');
    await shot('battle-desktop');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bugHunterStats?.paused === true);
    const pausedHp = (await stats()).hp;
    await page.waitForTimeout(2000);
    assert.equal((await stats()).hp, pausedHp, 'pause freezes battle');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bugHunterStats?.paused === false);
    assert((await stats()).navigation, 'both fighters are on the navigation mesh');
    const movement = [];
    for (let i=0; i<10 && (await stats()).screen==='battle'; i++) {
      await page.keyboard.press(i<3 ? '2' : '1');
      await page.waitForTimeout(1000);
      movement.push(await stats());
      if(i===2)await shot('battle-moving-desktop');
    }
    assert(movement.at(-1).travelA > 4 && movement.at(-1).travelB > 4, 'both insects navigate real distances');
    for (const side of ['positionA','positionB']) {
      const xs=movement.map(s=>s[side].x),zs=movement.map(s=>s[side].z);
      assert(Math.max(...xs)-Math.min(...xs)>.5 && Math.max(...zs)-Math.min(...zs)>.5, 'movement is two-dimensional: '+side);
      assert(movement.every(s=>Math.hypot(s[side].x-260,s[side].z)<6.5), 'fighters stay in arena');
    }
    await page.keyboard.press('3');
    let downSeen = false;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline && (await stats()).screen === 'battle') {
      const status = await stats();
      if (!downSeen && (status.down > 1.5 || status.enemyDown > 1.5)) { downSeen = true; await shot('knockdown-desktop'); }
      await page.waitForTimeout(1000);
    }
    await waitState('result'); await shot('result-desktop');
    assert((await stats()).maxHitDistance>0 && (await stats()).maxHitDistance<=1.96, 'hits occur only within contact range');
    await click('Camp'); await waitState('collection');
    // A real UI-only tournament, including rewards and the next-round transition.
    if (!process.env.BUG_HUNTER_QUICK) {
      let champion = false;
      for (let attempt = 0; attempt < 5 && !champion; attempt++) {
        while ((await stats()).nectar >= 8 && (await stats()).level < 5) {
          await click('Train'); await page.waitForTimeout(1100);
        }
        await click('Tournament'); await waitState('battle');
        let resting = false;
        for (let round = 1; round <= 3; round++) {
          const deadline = Date.now() + 165000;
          while (Date.now() < deadline && (await stats()).screen === 'battle') {
            const state = await stats();
            if(!downSeen && (state.down>1.5 || state.enemyDown>1.5)){downSeen=true;await shot('knockdown-desktop');}
            if (state.energy < 26 || state.balance < 24) resting = true;
            if (state.energy > 78 && state.balance > 78) resting = false;
            await page.keyboard.press(resting ? '2' : state.enemyDown > 0 || state.energy > 75 ? '3' : '1');
            await page.waitForTimeout(1000);
          }
          await waitState('result');
          const result = await stats();
          console.log('Tournament', attempt + 1, 'round', result.round, result.victory ? 'win' : 'loss');
          if (!result.victory) { await click('Camp'); await waitState('collection'); break; }
          if (round === 3) {
            assert(result.trophies > 0, 'championship awards a trophy');
            await shot('tournament-champion'); champion = true;
            await click('Camp'); await waitState('collection');
          } else { await click('NextRound'); await waitState('battle'); }
        }
      }
      assert(champion, 'tournament can be completed through normal controls');
    }
    const beforeReload = await stats();
    await page.reload(); await waitState('forest');
    assert.equal((await stats()).count, beforeReload.count, 'captured insects persist after reload');
    // The old grid grew to 1440px inside a 1080px-tall ultrawide screen.
    await page.setViewportSize({width:2560,height:1080});
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
    await page.waitForTimeout(2500);
    await shot('forest-fullscreen');
    await click('Collection');await waitState('collection');await shot('collection-fullscreen');
    await click('Practice');await waitState('battle');await shot('battle-fullscreen');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__bugHunterStats?.paused);
    await click('Retreat');await waitState('collection');await click('Explore');await waitState('forest');
    for(const [width,height] of [[1920,1080],[1366,768],[1920,800],[1024,768],[390,960]]) {
      await page.setViewportSize({width,height});await page.waitForTimeout(2200);
      await shot(`forest-fullscreen-${width}x${height}`);
      await click('Collection');await waitState('collection');await shot(`collection-fullscreen-${width}x${height}`);
      await click('Practice');await waitState('battle');await shot(`battle-fullscreen-${width}x${height}`);
      await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__bugHunterStats?.paused);
      await click('Retreat');await waitState('collection');await click('Explore');await waitState('forest');
    }
    await page.evaluate(() => document.exitFullscreen());
    await page.setViewportSize({ width: 390, height: 960 });
    await page.waitForTimeout(2000); await shot('forest-mobile');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await click('Collection'); await waitState('collection'); await shot('collection-mobile');
    await click('Practice'); await waitState('battle'); await shot('battle-mobile');
    assert(measurements.every(item => item.memory < 64 * 1024 ** 2), 'Unity allocated memory stays under 64 MiB in sampled scenes');
    assert(measurements.every(item => item.wasmHeapBytes <= 128 * 1024 ** 2), 'WASM heap stays under 128 MiB in sampled scenes');
    assert.equal(errors.length, 0, errors.join('\n'));
    await fs.writeFile(path.join(output, 'smoke.json'), JSON.stringify({ measurements, errors, downSeen }, null, 2));
    console.log('BUG_HUNTER_BROWSER_OK');
  } catch (error) {
    console.error('Last browser state',await stats());
    await page.locator('canvas').screenshot({path:path.join(output,'failure.png')});
    throw error;
  } finally {
    await browser.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
