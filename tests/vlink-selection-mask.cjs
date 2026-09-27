const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const output = path.join(__dirname, '../launcher/test-output/web');

// Normalized regions from the native selection-screen reference supplied by the user.
const regions = {
  leftLeg: [.263, .835, .310, .918], rightLeg: [.695, .810, .736, .918],
  leftHead: [.292, .372, .330, .445], rightHead: [.657, .372, .695, .445],
  leftPanel: [.280, .700, .310, .800], rightPanel: [.655, .700, .680, .800],
};
function regionStats(buffer) {
  const image = PNG.sync.read(buffer);
  const result = {};
  for (const [name, [x1, y1, x2, y2]] of Object.entries(regions)) {
    let total = 0, dark = 0, gray = 0, white = 0;
    for (let y = Math.floor(y1 * image.height); y < y2 * image.height; y++) {
      for (let x = Math.floor(x1 * image.width); x < x2 * image.width; x++) {
        const offset = 4 * (y * image.width + x);
        const rgb = image.data.subarray(offset, offset + 3);
        const max = Math.max(...rgb), min = Math.min(...rgb);
        total++;
        if (max < 100) dark++;
        if (max - min < 35 && max < 180) gray++;
        if (min > 235) white++;
      }
    }
    result[name] = { dark: dark / total, gray: gray / total, white: white / total };
  }
  return result;
}

async function verify(page, width, label) {
  await page.evaluate(() => { window.stencilDraws = []; window.sampleStencil = true; });
  await page.waitForTimeout(300);
  const states = await page.evaluate(() => { window.sampleStencil = false; return window.stencilDraws; });
  assert(states.some(s => s.bits > 0 && s.enabled && s.ref === 1 && s.pass === 7681), 'No mask writer draw (GL_REPLACE)');
  assert(states.some(s => s.bits > 0 && s.enabled && s.ref === 1 && s.func === 514), 'No masked character draw (GL_EQUAL)');
  const buffer = await page.locator('canvas').screenshot();
  await fs.writeFile(path.join(output, `vlink-mask-${label}-${width}.png`), buffer);
  const stats = regionStats(buffer);
  for (const side of ['left', 'right']) {
    assert(stats[side + 'Leg'].dark < .06, `${side} leg extends in front of the frame: ${JSON.stringify(stats)}`);
    assert(stats[side + 'Head'].gray > .12, `${side} head is not visible in its reference region`);
    assert(stats[side + 'Panel'].white > .8, `${side} held panel disappeared`);
  }
  console.log(JSON.stringify({ width, label, stats, states }));
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.WEB_TEST_URL || `http://127.0.0.1:${server.address().port}/play/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1080 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        window.stencilDraws = [];
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const original = WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name] = function (...args) {
            if (window.sampleStencil) {
              const state = { bits: this.getParameter(this.STENCIL_BITS), enabled: this.isEnabled(this.STENCIL_TEST),
                ref: this.getParameter(this.STENCIL_REF), func: this.getParameter(this.STENCIL_FUNC),
                pass: this.getParameter(this.STENCIL_PASS_DEPTH_PASS) };
              if (!window.stencilDraws.some(item => JSON.stringify(item) === JSON.stringify(state))) window.stencilDraws.push(state);
            }
            return original.apply(this, args);
          };
        }
      });
      try {
        await page.goto(new URL('v-link-battle/', base).href);
        await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#player-stage').dataset.state), null, { timeout: 180000 });
        assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'ready');
        await page.waitForTimeout(6500);
        const canvas = page.locator('canvas');
        await canvas.focus();
        await page.keyboard.down('Enter');
        await page.waitForTimeout(150);
        await page.keyboard.up('Enter');
        await page.waitForTimeout(5000);
        for (let player = 0; player < 2; player++) {
          const box = await canvas.boundingBox();
          await canvas.click({ position: { x: box.width * .541, y: box.height * .833 }, delay: 150 });
          // The large START menu covers the heads after the second pick's 8s animation.
          await page.waitForTimeout(5500);
        }
        await verify(page, width, 'selected');
        if (width === 1440) {
          await page.locator('#fullscreen').click();
          await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
          await verify(page, width, 'fullscreen');
          await page.evaluate(() => document.exitFullscreen());
        }
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { regionStats };
