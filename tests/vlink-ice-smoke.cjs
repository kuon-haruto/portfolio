const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const actions = require('./web-game-actions.json')['v-link-battle'].slice(0, 4);
const output = path.join(__dirname, '../launcher/test-output/vlink-ice');

(async () => {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = process.env.WEB_TEST_URL || `http://127.0.0.1:${server.address().port}/play/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.addInitScript(() => {
      window.__iceRendering = { programs: 0, draws: 0, vertices: 0, canvasSubmitted: false };
      // Observe actual WebGL submissions; do not change Unity objects or gameplay.
      for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const proto = type.prototype, sources = new WeakMap(), shaders = new WeakMap(), ice = new WeakSet();
        let current;
        const source = proto.shaderSource, attach = proto.attachShader, link = proto.linkProgram, use = proto.useProgram;
        proto.shaderSource = function(shader, text) { sources.set(shader, text); return source.call(this, shader, text); };
        proto.attachShader = function(program, shader) {
          shaders.set(program, [...(shaders.get(program) || []), shader]); return attach.call(this, program, shader);
        };
        proto.linkProgram = function(program) {
          if ((shaders.get(program) || []).some(shader => sources.get(shader)?.includes('_IceTexture'))) {
            ice.add(program); window.__iceRendering.programs++;
          }
          return link.call(this, program);
        };
        proto.useProgram = function(program) { current = program; return use.call(this, program); };
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const draw = proto[name]; if (!draw) continue;
          proto[name] = function(...args) {
            if (this.canvas.id === 'game-canvas') window.__iceRendering.canvasSubmitted = true;
            if (current && ice.has(current)) { window.__iceRendering.draws++; window.__iceRendering.vertices += args[name.includes('Elements') ? 1 : 2]; }
            return draw.apply(this, args);
          };
        }
      }
    });
    await fs.mkdir(output, { recursive: true });
    // Exercise the public default on the browser's normal GPU, without GPU flags.
    await page.goto(new URL('v-link-battle/', base).href);
    await page.locator('#start-fullscreen').waitFor({ timeout: 180000 });
    assert.equal(await page.locator('#player-stage').getAttribute('data-renderer'), 'webgl');
    await page.locator('#start-fullscreen').click();
    await page.waitForTimeout(6500);
    for (const action of actions) {
      if (action.key) await page.keyboard.press(action.key, { delay: action.milliseconds });
      else {
        const box = await page.locator('canvas').boundingBox();
        await page.mouse.click(box.x + box.width * action.x, box.y + box.height * action.y, { delay: 150 });
      }
      await page.waitForTimeout(action.wait || 1500);
    }
    const results = [];
    const moves = [
      ...Array.from({ length: 6 }, (_, i) => ({ name: 'slash-repeat-' + i, keys: ['j'], wait: 100 })),
      { name: 'flying-slash', keys: ['d', 'j'], wait: 150 },
      { name: 'ice-wall', keys: ['d', 'k'], wait: 550 },
      { name: 'blade-storm', keys: ['w', 'k'], wait: 400 },
    ];
    for (const move of moves) {
      const before = await page.evaluate(() => window.__iceRendering.draws);
      for (const key of move.keys) await page.keyboard.down(key);
      await page.waitForTimeout(140);
      for (const key of [...move.keys].reverse()) await page.keyboard.up(key);
      await page.waitForTimeout(move.wait);
      const bytes = await page.screenshot();
      await fs.writeFile(path.join(output, move.name + '-web.png'), bytes);
      const png = PNG.sync.read(bytes);
      let cyan = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b] = png.data.subarray(i, i + 3);
        if (b > 120 && g > 100 && b > r * 1.3 && g > r * 1.3) cyan++;
      }
      const rendering = await page.evaluate(() => window.__iceRendering);
      results.push({ move: move.name, iceDraws: rendering.draws - before, cyanPixels: cyan });
      console.log(JSON.stringify(results.at(-1)));
      await page.waitForTimeout(1000);
    }
    assert((await page.evaluate(() => window.__iceRendering.programs)) > 0, 'Web-compatible ice shader was never compiled');
    assert(results.filter(r => r.iceDraws > 0).length >= 6, 'Ice did not render repeatedly during combat');
    assert(results.every(r => r.cyanPixels > 100), 'Battle canvas lost its rendered content');
    const timing = await page.evaluate(() => new Promise(resolve => {
      const canvas = document.querySelector('#game-canvas');
      const gl = canvas.getContext('webgl2');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
      let start, previous, callbacks = 0, renderedFrames = 0;
      const intervals = [];
      function sample(now) {
        if (start === undefined) { start = previous = now; window.__iceRendering.canvasSubmitted = false; }
        else {
          callbacks++;
          if (window.__iceRendering.canvasSubmitted) {
            renderedFrames++;
            intervals.push(now - previous);
            previous = now;
          }
          window.__iceRendering.canvasSubmitted = false;
        }
        if (now - start < 10000) return requestAnimationFrame(sample);
        intervals.sort((a, b) => a - b);
        resolve({ renderer, elapsedMs: now - start, browserCallbacks: callbacks, renderedFrames,
          renderedFramesPerSecond: renderedFrames * 1000 / (now - start),
          p95RenderedIntervalMs: intervals[Math.floor(intervals.length * .95)],
          over100Ms: intervals.filter(ms => ms > 100).length });
      }
      requestAnimationFrame(sample);
    }));
    console.log(JSON.stringify({ timing }));
    assert(timing.renderedFrames > 0, 'Battle stopped submitting frames');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'browser.json'), JSON.stringify({ base, browser: browser.version(), results, timing, errors }, null, 2));
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
