const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const { regionStats } = require('./vlink-selection-mask.cjs');
const actions = require('./web-game-actions.json')['v-link-battle'].slice(0, 4);
const output = path.join(__dirname, '../launcher/test-output/vlink-vfx/webgpu');
const gpuPreference = process.env.VLINK_TEST_GPU || 'default';
assert(['default', 'high-performance'].includes(gpuPreference), 'Unknown VLINK_TEST_GPU');

function selectionTextCoverage(buffer) {
  const png = PNG.sync.read(buffer);
  let cyan = 0, total = 0;
  // The native reference has ~24% cyan ink here; stale TMP shaders fill ~56%.
  for (let y = Math.floor(.793 * png.height); y < .875 * png.height; y++) {
    for (let x = Math.floor(.40 * png.width); x < .515 * png.width; x++) {
      const i = (y * png.width + x) * 4;
      total++;
      if (png.data[i] < 145 && png.data[i+1] > 140 && png.data[i+2] > 200
        && png.data[i+2] - png.data[i+1] > 20) cyan++;
    }
  }
  return cyan / total;
}

function selectionBackgroundReady(buffer) {
  const png = PNG.sync.read(buffer);
  let matches = 0;
  for (const y of [.20, .30, .40]) {
    for (const x of [.08, .92]) {
      const i = (Math.floor(y * png.height) * png.width + Math.floor(x * png.width)) * 4;
      const [r, g, b] = png.data.subarray(i, i + 3);
      if (x < .5 ? b > r + 20 && b > g + 15 : r > g + 25 && b > g + 15) matches++;
    }
  }
  return matches >= 5;
}

function selectionFurCoverage(buffer) {
  const png = PNG.sync.read(buffer);
  const coverage = {};
  // Regions from the supplied native pick-screen reference: 0.57 / 0.52.
  // The broken scaled adapter measures only 0.065 / 0.096 here.
  for (const [name, x0, x1, y0, y1] of [
    ['leftCuff', .2, .225, .548, .606], ['leftCollar', .263, .285, .441, .480],
  ]) {
    let lightFur = 0, total = 0;
    for (let y = Math.floor(y0 * png.height); y < y1 * png.height; y++) {
      for (let x = Math.floor(x0 * png.width); x < x1 * png.width; x++) {
        const i = (y * png.width + x) * 4;
        const rgb = png.data.subarray(i, i + 3);
        total++;
        if (Math.min(...rgb) > 130 && Math.max(...rgb) - Math.min(...rgb) < 35) lightFur++;
      }
    }
    coverage[name] = lightFur / total;
  }
  return coverage;
}

function measureBrowserFrames(page) {
  return page.evaluate(() => new Promise(resolve => {
    const intervals = [];
    const firstCanvasFrame = window.__gpuEvidence.canvasFrames;
    let start, previous;
    function sample(now) {
      if (start === undefined) start = now;
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      if (now - start < 3000) return requestAnimationFrame(sample);
      const sorted = [...intervals].sort((a, b) => a - b);
      const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
      resolve({ frames: intervals.length, elapsedMs: now - start,
        averageFps: intervals.length * 1000 / (now - start),
        canvasFrames: window.__gpuEvidence.canvasFrames - firstCanvasFrame,
        canvasFps: (window.__gpuEvidence.canvasFrames - firstCanvasFrame) * 1000 / (now - start),
        medianMs: percentile(.5), p95Ms: percentile(.95), maxMs: sorted.at(-1),
        over100Ms: intervals.filter(interval => interval > 100).length });
    }
    requestAnimationFrame(sample);
  }));
}

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.WEB_TEST_URL || `http://127.0.0.1:${server.address().port}/play/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: gpuPreference === 'high-performance' ? ['--force-high-performance-gpu'] : [] });
  const report = { base, browser: browser.version(), gpuPreference, messages: [], errors: [], frames: [] };
  let page;
  try {
    await fs.mkdir(output, { recursive: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      report.messages.push({ type: message.type(), text: message.text() });
      if (message.type() === 'error') report.errors.push(message.text());
    });
    await page.addInitScript(() => {
      window.__gpuEvidence = { devices: 0, adapters: [], canvasFrames: 0, shaderModules: 0, modules: [], dispatches: 0, stencils: [], errors: [], lost: [] };
      if (!window.GPUAdapter) return;
      const currentTexture = GPUCanvasContext.prototype.getCurrentTexture;
      GPUCanvasContext.prototype.getCurrentTexture = function(...args) {
        window.__gpuEvidence.canvasFrames++;
        return currentTexture.apply(this, args);
      };
      const request = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function(...args) {
        const device = await request.apply(this, args);
        window.__gpuEvidence.devices++;
        const info = this.info;
        if (info) window.__gpuEvidence.adapters.push({ vendor: info.vendor, architecture: info.architecture,
          device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter });
        device.addEventListener('uncapturederror', event => window.__gpuEvidence.errors.push(event.error.message));
        device.lost.then(info => window.__gpuEvidence.lost.push({ reason: info.reason, message: info.message }));
        return device;
      };
      const create = GPUDevice.prototype.createShaderModule;
      GPUDevice.prototype.createShaderModule = function(descriptor) {
        window.__gpuEvidence.shaderModules++;
        if (descriptor.code.includes('@compute')) window.__gpuEvidence.modules.push({ label: descriptor.label || '', code: descriptor.code });
        return create.call(this, descriptor);
      };
      for (const name of ['createRenderPipeline', 'createRenderPipelineAsync']) {
        const createPipeline = GPUDevice.prototype[name];
        GPUDevice.prototype[name] = function(descriptor) {
          if (descriptor.depthStencil) window.__gpuEvidence.stencils.push(descriptor.depthStencil);
          return createPipeline.call(this, descriptor);
        };
      }
      for (const name of ['dispatchWorkgroups', 'dispatchWorkgroupsIndirect']) {
        const dispatch = GPUComputePassEncoder.prototype[name];
        GPUComputePassEncoder.prototype[name] = function(...args) {
          window.__gpuEvidence.dispatches++;
          return dispatch.apply(this, args);
        };
      }
    });
    await page.goto(new URL('v-link-battle/', base).href);
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#player-stage')?.dataset.state), null, { timeout: 300000 });
    assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'ready', await page.locator('#game-error').textContent());
    await page.locator('#start-fullscreen').click();
    await page.waitForTimeout(6000);
    const screenshot = async name => {
      const bytes = await page.screenshot();
      await fs.writeFile(path.join(output, name + '.png'), bytes);
      const png = PNG.sync.read(bytes), colors = new Set();
      for (let i = 0; i < png.data.length; i += 64) colors.add(`${png.data[i] >> 4},${png.data[i+1] >> 4},${png.data[i+2] >> 4}`);
      report.frames.push({ name, colors: colors.size, dispatches: await page.evaluate(() => window.__gpuEvidence.dispatches) });
      assert(colors.size > 80, 'Blank or failed render: ' + name);
    };
    await screenshot('title');
    for (const action of actions) {
      if (action.key) await page.keyboard.press(action.key, { delay: action.milliseconds });
      else {
        const box = await page.locator('canvas').boundingBox();
        await page.mouse.click(box.x + box.width * action.x, box.y + box.height * action.y, { delay: 150 });
      }
      if (action.name === 'choose-opponent') {
        // Shader warm-up can make wall-clock time diverge from the pick animation.
        // Wait for the held panel's final pose, without changing visibility thresholds.
        let bytes;
        const deadline = Date.now() + 25000;
        do {
          await page.waitForTimeout(250);
          bytes = await page.locator('canvas').screenshot();
          report.selection = regionStats(bytes);
        } while (report.selection.rightPanel.white <= .8 && Date.now() < deadline);
        await fs.writeFile(path.join(output, 'selection-mask.png'), bytes);
        report.selectionTextCoverage = selectionTextCoverage(bytes);
        report.selectionFur = selectionFurCoverage(bytes);
        for (const [region, coverage] of Object.entries(report.selectionFur))
          assert(coverage > .22, 'Selection fur is missing from ' + region + ': ' + coverage);
        assert(report.selectionTextCoverage > .12 && report.selectionTextCoverage < .4,
          'Selection text is missing or rendered as solid glyph rectangles');
        for (const side of ['left', 'right']) {
          assert(report.selection[side + 'Leg'].dark < .06, side + ' character extends through the selection frame');
          assert(report.selection[side + 'Head'].gray > .12, side + ' selected character is missing');
          assert(report.selection[side + 'Panel'].white > .8, side + ' held panel is missing');
        }
        await page.waitForTimeout(6000);
      } else await page.waitForTimeout(action.wait || 5500);
      if (action.name === 'character-select') {
        const deadline = Date.now() + 60000;
        let ready = false;
        while (!ready && Date.now() < deadline) {
          ready = selectionBackgroundReady(await page.locator('canvas').screenshot());
          if (!ready) await page.waitForTimeout(500);
        }
        assert(ready, 'The selection scene did not finish loading');
      }
      await screenshot(action.name || action.label || 'selection-' + report.frames.length);
    }
    // Local browser-frame observations, not a cross-hardware performance gate.
    report.battleStartupFrameTiming = await measureBrowserFrames(page);
    for (const [name, keys, delay] of [['slash', ['j'], 80], ['flying', ['d','j'], 100], ['wall', ['d','k'], 400], ['storm', ['w','k'], 250]]) {
      for (let repeat = 0; repeat < 3; repeat++) {
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(100);
        for (const key of [...keys].reverse()) await page.keyboard.up(key);
        await page.waitForTimeout(delay);
        await screenshot(name + '-' + repeat);
        await page.waitForTimeout(1200);
      }
    }
    report.battleFrameTiming = await measureBrowserFrames(page);
    await page.evaluate(() => document.exitFullscreen());
    for (const viewport of [{ width: 390, height: 844 }, { width: 2560, height: 1080 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
      await page.waitForTimeout(500);
      const bounds = await page.locator('canvas').boundingBox();
      assert(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1
        && bounds.y + bounds.height <= viewport.height + 1, 'Fullscreen canvas exceeds viewport');
      assert(Math.abs(bounds.width / bounds.height - 16 / 9) < .01, 'Fullscreen distorts the original game aspect');
      await screenshot('fullscreen-' + viewport.width);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.fullscreenElement);
    }
    const evidence = await page.evaluate(() => window.__gpuEvidence);
    report.gpu = { ...evidence, modules: evidence.modules.length };
    assert(evidence.devices > 0, 'WebGPU device was never created');
    assert(evidence.dispatches > 0, 'No GPU compute work was submitted');
    assert(evidence.stencils.some(state => state.stencilFront?.passOp === 'replace'), 'No stencil-writing pipeline');
    assert(evidence.stencils.some(state => state.stencilFront?.compare === 'equal'), 'No masked character pipeline');
    assert.deepEqual(evidence.errors, [], 'GPU validation errors');
    assert.deepEqual(evidence.lost, [], 'GPU device was lost');
    assert.deepEqual(report.errors, [], 'Game runtime errors');
    report.furRenderers = report.messages.filter(message => message.text.includes('PORTFOLIO_FUR_READY: vertices=85536')).length;
    assert(report.furRenderers >= 4, 'Original fur was not initialized for both selection and battle characters');
    console.log(JSON.stringify({ gpu: { devices: evidence.devices, shaderModules: evidence.shaderModules,
      computeModules: evidence.modules.length, dispatches: evidence.dispatches,
      errors: evidence.errors, lost: evidence.lost }, furRenderers: report.furRenderers,
      battleFrameTiming: report.battleFrameTiming, frames: report.frames }));
  } finally {
    await fs.mkdir(output, { recursive: true });
    await page?.locator('canvas').screenshot({ path: path.join(output, 'last-frame.png'), timeout: 3000 }).catch(() => {});
    const evidence = await page?.evaluate(() => window.__gpuEvidence).catch(() => null);
    if (evidence) {
      await fs.writeFile(path.join(output, 'shaders.json'), JSON.stringify(evidence.modules));
      report.gpu = { ...evidence, modules: evidence.modules.length };
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    if (report.battleFrameTiming) {
      const timingPath = path.join(output, 'hardware-timing.json');
      const timings = JSON.parse(await fs.readFile(timingPath, 'utf8').catch(() => '{}'));
      timings[gpuPreference] = { adapters: report.gpu?.adapters, startup: report.battleStartupFrameTiming,
        battle: report.battleFrameTiming };
      await fs.writeFile(timingPath, JSON.stringify(timings, null, 2));
    }
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
