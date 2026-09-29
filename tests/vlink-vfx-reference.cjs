const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('../launcher/node_modules/playwright');
const fur = process.argv.includes('--fur');
const height = fur ? 960 : 720;
const prefix = fur ? 'FUR' : 'VFX';
const controller = fur ? 'PortfolioFurDiagnostic' : 'PortfolioVfxDiagnostic';
const build = path.join(os.tmpdir(), `portfolio-web-builds/output/v-link-battle-${fur ? 'fur' : 'vfx'}-check`);
const output = path.join(__dirname, '../launcher/test-output/vlink-vfx', fur ? 'fur-webgpu' : 'webgpu-reference');
const names = ['IceWall', 'Ame_IceSlash', 'Ame_FlyingSlash', 'BladeStorm', 'Ame_IceExplosion',
  'HitEffect', 'Ame_CloneAttack', 'Ame_Flower', 'BreakShield'];

(async () => {
  const files = await fs.readdir(path.join(build, 'Build'));
  const asset = suffix => {
    const matches = files.filter(file => file.endsWith(suffix) || file.endsWith(suffix + '.unityweb'));
    assert.equal(matches.length, 1, 'Expected one ' + suffix);
    return 'Build/' + matches[0];
  };
  const config = { dataUrl: asset('.data'), frameworkUrl: asset('.framework.js'),
    codeUrl: asset('.wasm'), matchWebGLToCanvasSize: false, devicePixelRatio: 1,
    companyName: 'Portfolio', productName: 'VFX reference', productVersion: '1' };
  const html = `<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0}canvas{display:block;width:960px;height:${height}px}</style></head><body><canvas id="canvas" width="960" height="${height}"></canvas><script src="${asset('.loader.js')}"></script><script>createUnityInstance(document.getElementById('canvas'),${JSON.stringify(config)}).then(instance=>window.unity=instance).catch(error=>console.error(error));</script></body></html>`;
  // Serve only this generated diagnostic, not the source project or the workspace root.
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/play/vfx/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end(html); return; }
    const match = /^\/play\/vfx\/Build\/([a-f0-9]{32}\.(?:loader\.js|(?:data|framework\.js|wasm)(?:\.unityweb)?))$/.exec(pathname);
    if (!match || !files.includes(match[1])) { response.writeHead(404).end(); return; }
    try {
      const bytes = await fs.readFile(path.join(build, 'Build', match[1]));
      const type = match[1].endsWith('.js') ? 'text/javascript' : match[1].endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: process.env.VLINK_TEST_GPU === 'high-performance' ? ['--force-high-performance-gpu'] : [] });
  const messages = [], frames = [], errors = [], samples = [];
  let complete = false;
  try {
    await fs.mkdir(output, { recursive: true });
    await fs.rm(path.join(output, 'reference.json'), { force: true });
    const page = await browser.newPage({ viewport: { width: 960, height }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      window.__gpuEvidence = { devices: 0, errors: [], lost: [] };
      if (!window.GPUAdapter) return;
      const request = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function(...args) {
        const device = await request.apply(this, args);
        window.__gpuEvidence.devices++;
        device.addEventListener('uncapturederror', event => window.__gpuEvidence.errors.push(event.error.message));
        device.lost.then(info => window.__gpuEvidence.lost.push(info.message));
        return device;
      };
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      const text = message.text();
      messages.push({ type: message.type(), text });
      if (message.type() === 'error') errors.push(text);
      const match = fur ? /PORTFOLIO_FUR_FRAME: ([\w-]+)/.exec(text) : /PORTFOLIO_VFX_FRAME: ([^:]+):(\d+)/.exec(text);
      if (match) frames.push(fur ? { name: match[1] } : { name: match[1], frame: Number(match[2]) });
      if (text.includes(`PORTFOLIO_${prefix}_DIAGNOSTIC_COMPLETE`)) complete = true;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/play/vfx/`);
    await page.waitForFunction(() => !!window.unity, null, { timeout: 300000 });
    for (let i = 0; i < (fur ? 2 : names.length * 4); i++) {
      const deadline = Date.now() + 60000;
      while (frames.length <= i && !errors.length && Date.now() < deadline) await page.waitForTimeout(100);
      assert.deepEqual(errors, [], 'WebGPU diagnostic runtime errors');
      assert(frames[i], 'Reference frame timed out: ' + i);
      const sample = frames[i], image = fur ? `${sample.name}.png` : `${sample.name}-${sample.frame}.png`;
      await page.locator('canvas').screenshot({ path: path.join(output, image) });
      samples.push({ ...sample, image });
      await page.evaluate(name => window.unity.SendMessage(name, 'Continue'), controller);
    }
    for (let i = 0; i < 100 && !complete; i++) await page.waitForTimeout(100);
    assert(complete, 'Diagnostic sequence did not finish');
    assert(messages.some(message => message.text.includes(`PORTFOLIO_${prefix}_DEVICE: WebGPU`)), 'Not rendered using WebGPU');
    if (fur) assert.deepEqual(samples.map(sample => sample.name), ['portable', 'no-fur']);
    else {
      assert(messages.some(message => /PORTFOLIO_VFX_DEVICE: WebGPU compute=True/.test(message.text)), 'VFX compute is unavailable');
      assert.deepEqual(samples.map(sample => [sample.name, sample.frame]),
        names.flatMap(name => [6, 18, 42, 72].map(frame => [name, frame])));
    }
    const gpu = await page.evaluate(() => window.__gpuEvidence);
    assert(gpu.devices > 0, 'No actual WebGPU device');
    assert.deepEqual(gpu.errors, [], 'GPU validation errors');
    assert.deepEqual(gpu.lost, [], 'GPU device lost');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'reference.json'), JSON.stringify({
      unity: (await fs.readFile(path.join(build, 'unity-version.txt'), 'utf8')).trim(), device: 'WebGPU', compute: true,
      settings: messages.find(message => message.text.includes('PORTFOLIO_VFX_SETTINGS:'))?.text.trim(), gpu, samples,
    }, null, 2));
    console.log(`Captured ${samples.length} ${prefix} frames using WebGPU.`);
  } finally {
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'console.json'), JSON.stringify({ messages, errors }, null, 2));
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
