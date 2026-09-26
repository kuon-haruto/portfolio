const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const output = path.join(__dirname, '../launcher/test-output/web');
const games = require('../play/games.json').games;
const actions = require('./web-game-actions.json');

function canvasStats(buffer) {
  const { width, height, data } = PNG.sync.read(buffer);
  const colors = new Set();
  let light = 0;
  for (let offset = 0; offset < data.length; offset += 16) {
    colors.add(`${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`);
    if (data[offset] + data[offset + 1] + data[offset + 2] > 90) light++;
  }
  return { width, height, colors: colors.size, nonblack: light / (data.length / 16) };
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.WEB_TEST_URL || `http://127.0.0.1:${server.address().port}/play/`;
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
    for (const viewport of [{ width: 1440, height: 1080 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const libraryRequests = [];
      page.on('request', request => libraryRequests.push(request.url()));
      await page.goto(base);
      await page.waitForFunction(count => document.querySelectorAll('.game-card').length === count, games.length);
      assert(!libraryRequests.some(url => url.includes('/Build/')), 'Library must not download game payloads');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `library-${viewport.width}.png`), fullPage: true });
      for (const game of games) {
        if (process.env.WEB_TEST_GAME && game.id !== process.env.WEB_TEST_GAME) continue;
        const errors = [];
        const messages = [];
        const handler = error => errors.push(error.message);
        page.on('pageerror', handler);
        page.on('console', message => {
          messages.push(`${message.type()}: ${message.text()}`);
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto(new URL(game.id + '/', base).href);
        await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('player-stage').dataset.state), null, { timeout: 180000 });
        assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'ready', await page.locator('#game-error').textContent());
        await page.waitForTimeout(6500);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const pixels = canvasStats(await page.locator('canvas').screenshot());
        assert(pixels.colors > 20 && pixels.nonblack > .05, `Canvas is blank: ${game.id}`);
        await page.screenshot({ path: path.join(output, `${game.id}-${viewport.width}.png`), fullPage: true });
        if (game.id === 'line-boundary' && viewport.width === 1440) {
          await page.locator('#fullscreen').click();
          await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
          const box = await page.locator('canvas').boundingBox();
          assert(Math.abs(box.width / box.height - 16 / 9) < .01);
          const fullscreenPixels = canvasStats(await page.locator('canvas').screenshot());
          assert(fullscreenPixels.colors > 20 && fullscreenPixels.nonblack > .05);
          await page.screenshot({ path: path.join(output, 'line-boundary-fullscreen.png') });
          await page.evaluate(() => document.exitFullscreen());
        }
        for (const action of actions[game.id] || []) {
          const canvas = page.locator('canvas');
          if (action.key) {
            await canvas.focus();
            await page.keyboard.down(action.key);
            await page.waitForTimeout(action.milliseconds);
            await page.keyboard.up(action.key);
          } else {
            const box = await canvas.boundingBox();
            await canvas.click({ position: { x: box.width * action.x, y: box.height * action.y }, delay: 150 });
          }
          await page.waitForTimeout(action.wait ?? 2500);
          if (action.capture === false) continue;
          const actionPixels = canvasStats(await canvas.screenshot());
          assert(actionPixels.colors > 20 && actionPixels.nonblack > .05, `Blank frame after ${game.id}: ${action.name}`);
          await page.screenshot({ path: path.join(output, `${game.id}-${action.name}-${viewport.width}.png`), fullPage: true });
        }
        results.push({ game: game.id, viewport, pixels, actions: (actions[game.id] || []).map(action => action.name), errors });
        console.log(JSON.stringify(results.at(-1)));
        await fs.writeFile(path.join(output, `${game.id}-${viewport.width}.log`), messages.join('\n'));
        assert.deepEqual(errors, [], `Browser/runtime errors: ${game.id}`);
        page.removeListener('pageerror', handler);
        page.removeAllListeners('console');
      }
      await context.close();
    }
    await fs.writeFile(path.join(output, 'smoke.json'), JSON.stringify(results, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
