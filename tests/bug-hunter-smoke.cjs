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
  async function shot(name) {
    const bytes = await page.locator('canvas').screenshot({ path: path.join(output, name + '.png') });
    const png = PNG.sync.read(bytes), colors = new Set();
    for (let y = Math.floor(png.height * .3); y < png.height * .7; y += 5) for (let x = 0; x < png.width; x += 5) {
      let i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
    }
    assert(colors.size > 25, `${name}: canvas appears blank (${colors.size} colors)`);
    console.log(name, await stats(), 'colors=' + colors.size);
    measurements.push({ name, ...(await stats()), colors: colors.size });
  }
  try {
    await page.goto(url);
    await waitState('forest');
    await page.waitForTimeout(3000);
    await shot('forest-desktop');
    assert((await stats()).fps < 80, 'high-refresh displays do not cause unnecessary rendering');
    await page.locator('canvas').focus();
    await page.keyboard.down('w'); await page.waitForTimeout(650); await page.keyboard.up('w');
    await page.waitForFunction(() => window.__bugHunterStats?.target && window.__bugHunterStats?.focus > .9);
    for (let attempt = 0; attempt < 5 && (await stats()).count === 0; attempt++) {
      await page.keyboard.press('Space'); await page.waitForTimeout(1500);
    }
    assert((await stats()).count > 0, 'capture must add an individual');
    await page.keyboard.press('Tab'); await waitState('collection');
    await shot('collection-desktop');
    await tap(800, 572); await page.waitForTimeout(1300);
    assert((await stats()).level >= 2, 'training levels up the captured insect');
    await tap(150, 673); await waitState('battle');
    await shot('battle-desktop');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bugHunterStats?.paused === true);
    const pausedHp = (await stats()).hp;
    await page.waitForTimeout(2000);
    assert.equal((await stats()).hp, pausedHp, 'pause freezes battle');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bugHunterStats?.paused === false);
    await page.keyboard.press('3');
    let downSeen = false;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline && (await stats()).screen === 'battle') {
      const status = await stats();
      if (!downSeen && status.falls > 0) { downSeen = true; await shot('knockdown-desktop'); }
      await page.waitForTimeout(2000);
    }
    await waitState('result'); await shot('result-desktop');
    await tap(640, 442); await waitState('collection');
    // A real UI-only tournament, including rewards and the next-round transition.
    if (!process.env.BUG_HUNTER_QUICK) {
      let champion = false;
      for (let attempt = 0; attempt < 5 && !champion; attempt++) {
        while ((await stats()).nectar >= 8 && (await stats()).level < 5) {
          await tap(800, 572); await page.waitForTimeout(1100);
        }
        await tap(450, 673); await waitState('battle');
        let resting = false;
        for (let round = 1; round <= 3; round++) {
          const deadline = Date.now() + 165000;
          while (Date.now() < deadline && (await stats()).screen === 'battle') {
            const state = await stats();
            if (state.energy < 26 || state.balance < 24) resting = true;
            if (state.energy > 78 && state.balance > 78) resting = false;
            await page.keyboard.press(resting ? '2' : state.enemyDown > 0 || state.energy > 75 ? '3' : '1');
            await page.waitForTimeout(1000);
          }
          await waitState('result');
          const result = await stats();
          console.log('Tournament', attempt + 1, 'round', result.round, result.victory ? 'win' : 'loss');
          if (!result.victory) { await tap(640, 442); await waitState('collection'); break; }
          if (round === 3) {
            assert(result.trophies > 0, 'championship awards a trophy');
            await shot('tournament-champion'); champion = true;
            await tap(640, 442); await waitState('collection');
          } else { await tap(640, 442); await waitState('battle'); }
        }
      }
      assert(champion, 'tournament can be completed through normal controls');
    }
    const beforeReload = await stats();
    await page.reload(); await waitState('forest');
    assert.equal((await stats()).count, beforeReload.count, 'captured insects persist after reload');
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
    await shot('forest-fullscreen');
    await page.evaluate(() => document.exitFullscreen());
    await page.setViewportSize({ width: 390, height: 960 });
    await page.waitForTimeout(2000); await shot('forest-mobile');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await tap(600, 1220, 720, 1280); await waitState('collection'); await shot('collection-mobile');
    await tap(150, 1230, 720, 1280); await waitState('battle'); await shot('battle-mobile');
    assert(measurements.every(item => item.memory < 64 * 1024 ** 2), 'Unity allocated memory stays under 64 MiB in sampled scenes');
    assert(measurements.every(item => item.wasmHeapBytes <= 128 * 1024 ** 2), 'WASM heap stays under 128 MiB in sampled scenes');
    assert.equal(errors.length, 0, errors.join('\n'));
    await fs.writeFile(path.join(output, 'smoke.json'), JSON.stringify({ measurements, errors, downSeen }, null, 2));
    console.log('BUG_HUNTER_BROWSER_OK');
  } finally {
    await browser.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
