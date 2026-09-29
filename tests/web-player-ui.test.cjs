const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { chromium } = require('../launcher/node_modules/playwright');
const { createServer } = require('../tools/web-test-server.cjs');
const { createHash } = require('node:crypto');
let server, browser, base;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
});

test('library errors remain readable at a narrow mobile width', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  try {
    await page.route('**/games.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto(base + '/play/');
    await page.locator('#catalog-status[role="alert"]').waitFor();
    assert.match(await page.locator('#catalog-status').textContent(), /作品情報/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await page.close(); }
});

test('library images stay square and contained across phone, tablet and desktop sizes', async () => {
  const page = await browser.newPage();
  try {
    for (const width of [320, 390, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/play/');
      await page.locator('.game-card').first().waitFor();
      await page.locator('.game-card-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const boxes = await page.locator('.game-card-art img').evaluateAll(images => images.map(image => {
        const img = image.getBoundingClientRect();
        const frame = image.parentElement.getBoundingClientRect();
        return { imageRatio: img.width / img.height, frameRatio: frame.width / frame.height,
          contained: img.top >= frame.top && img.bottom <= frame.bottom && img.left >= frame.left && img.right <= frame.right };
      }));
      for (const box of boxes) {
        assert(box.contained, `Image extends beyond frame at ${width}px`);
        assert(Math.abs(box.imageRatio - 1) < .01);
        assert(Math.abs(box.frameRatio - 1) < .01);
      }
    }
  } finally { await page.close(); }
});

test('failed loader offers retry; retry starts only the selected game', async () => {
  const page = await browser.newPage();
  try {
    let attempts = 0;
    await page.route('**/*.loader.js', route => {
      attempts++;
      if (attempts === 1) return route.abort();
      return route.fulfill({ contentType: 'text/javascript', body: `
        window.createUnityInstance = async (canvas, config, onProgress) => {
          window.testConfig = config; onProgress(1); return {};
        };` });
    });
    await page.goto(base + '/play/line-boundary/');
    await page.locator('#retry').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#fullscreen').isDisabled(), true);
    assert.match(await page.locator('#game-error').textContent(), /通信状況/);
    await page.locator('#retry').click();
    await page.waitForFunction(() => document.getElementById('player-stage').dataset.state === 'ready');
    assert.equal(attempts, 2);
    assert.equal(await page.locator('#game-state').isVisible(), false);
    assert.equal(await page.evaluate(() => window.testConfig.matchWebGLToCanvasSize), false);
    assert.equal(await page.locator('canvas').getAttribute('width'), '1920');
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
    await page.evaluate(() => document.exitFullscreen());
    await page.locator('#reload').click();
    await page.waitForFunction(() => document.getElementById('player-stage').dataset.state === 'ready');
    assert.equal(attempts, 3);
    await page.getByRole('link', { name: '作品一覧へ戻る' }).click();
    await page.locator('.game-card').first().waitFor();
    assert.equal(attempts, 3);
  } finally { await page.close(); }
});

test('Bug Hunter uses responsive portrait rendering and honest prototype metadata', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  try {
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.createUnityInstance = async (canvas, config, onProgress) => {
        window.testConfig = config; onProgress(1); return {};
      };` }));
    await page.goto(base + '/play/bug-hunter/');
    await page.waitForFunction(() => document.getElementById('player-stage').dataset.state === 'ready');
    assert.equal(await page.evaluate(() => window.testConfig.matchWebGLToCanvasSize), true);
    const stage = await page.locator('#player-stage').boundingBox();
    assert(stage.height > stage.width);
    assert.match(await page.locator('#game-meta').textContent(), /プロトタイプ/);
    assert.doesNotMatch(await page.locator('#game-meta').textContent(), /undefined/);
  } finally { await page.close(); }
});

test('cached pre-WebGPU HTML still loads and offers normal retry', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/play/line-boundary/', async route => {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<button id="retry-webgl"[^\n]+<\/button>/, '');
      await route.fulfill({ response, body: html });
    });
    let attempts = 0;
    await page.route('**/*.loader.js', route => ++attempts === 1 ? route.abort()
      : route.fulfill({ contentType: 'text/javascript', body: 'window.createUnityInstance = async () => ({});' }));
    await page.goto(base + '/play/line-boundary/');
    assert.equal(await page.locator('#retry-webgl').count(), 0);
    await page.locator('#retry').waitFor({ state: 'visible' });
    await page.locator('#retry').click();
    await page.waitForFunction(() => document.getElementById('player-stage').dataset.state === 'ready');
    assert.equal(attempts, 2);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('runtime errors do not become false successful loads', async () => {
  const page = await browser.newPage();
  try {
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.createUnityInstance = async (canvas, config, onProgress) => {
        config.showBanner('WebGL startup failed', 'error'); onProgress(1); return {};
      };` }));
    await page.goto(base + '/play/line-boundary/');
    await page.locator('#retry').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'error');
    assert.match(await page.locator('#game-error').textContent(), /WebGL startup failed/);
    assert.equal(await page.locator('#fullscreen').isDisabled(), true);
  } finally { await page.close(); }
});

test('responsive fullscreen canvas fits short, ultrawide and portrait viewports after resizing', async () => {
  const page = await browser.newPage();
  try {
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body:
      'window.createUnityInstance = async () => ({});' }));
    await page.goto(base + '/play/bug-hunter/');
    await page.waitForFunction(() => document.getElementById('player-stage').dataset.state === 'ready');
    for (const [width, height] of [[1366,768], [1920,1080], [2560,1080], [3440,1440], [1920,800], [1024,768], [390,960]]) {
      await page.setViewportSize({ width, height });
      await page.locator('#fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
      for (const intrinsic of [[1920,1080], [390,960], [3440,1440]]) {
        const bounds = await page.locator('canvas').evaluate((canvas, size) => {
          [canvas.width, canvas.height] = size;
          const rect = canvas.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
        }, intrinsic);
        assert(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= bounds.width + .1 && bounds.bottom <= bounds.height + .1,
          `Canvas clipped at ${width}x${height}, intrinsic ${intrinsic}: ${JSON.stringify(bounds)}`);
      }
      await page.evaluate(() => document.exitFullscreen());
      const normal = await page.locator('canvas').boundingBox();
      const stage = await page.locator('#player-stage').boundingBox();
      assert(Math.abs(normal.height-stage.height)<.1, 'exiting fullscreen restores the normal frame');
    }
  } finally { await page.close(); }
});

test('all six games offer genuine fullscreen startup and windowed fallback', async () => {
  const page = await browser.newPage();
  try {
    const manifest = structuredClone(require('../play/games.json'));
    for (const game of manifest.games) {
      delete game.build.dataParts;
      if (game.fallback) delete game.fallback.build.dataParts;
    }
    await page.route('**/games.json', route => route.fulfill({ json: manifest }));
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.createUnityInstance = async () => ({});' }));
    await page.addInitScript(() => {
      const request = Element.prototype.requestFullscreen;
      Element.prototype.requestFullscreen = function(options) { window.fullscreenOptions = options; return request.call(this, options); };
    });
    for (const game of manifest.games) {
      await page.goto(base + '/play/' + game.id + '/');
      await page.locator('#start-fullscreen').waitFor();
      assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'Never request fullscreen without a user gesture');
      await page.locator('#start-fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
      assert.deepEqual(await page.evaluate(() => window.fullscreenOptions), { navigationUI: 'hide' });
      assert.equal(await page.locator('#play-prompt').isVisible(), false);
      for (const [width, height] of [[2560,1080], [1024,768], [390,844]]) {
        await page.setViewportSize({ width, height });
        const box = await page.locator('canvas').boundingBox();
        assert(box.x>=-.1 && box.y>=-.1 && box.x+box.width<=width+.1 && box.y+box.height<=height+.1, game.id+' cropped');
        if (!game.responsiveCanvas) assert(Math.abs(box.width/box.height-16/9)<.01);
      }
      await page.mouse.move(195, 12);
      await page.locator('#exit-fullscreen').click();
      await page.waitForFunction(() => !document.fullscreenElement);
      assert.equal(await page.locator('#play-prompt').isVisible(), false, 'Exiting must not block gameplay again');
      await page.reload();
      await page.locator('#start-windowed').click();
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.equal(await page.locator('#play-prompt').isVisible(), false);
    }
  } finally { await page.close(); }
});

test('denied fullscreen is reported, and windowed play still works', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Denied')); });
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.createUnityInstance = async () => ({});' }));
    await page.goto(base + '/play/line-boundary/');
    await page.locator('#start-fullscreen').click();
    await page.locator('#launch-error').waitFor();
    assert.match(await page.locator('#launch-error').textContent(), /Edge.*Chrome/);
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    await page.locator('#start-windowed').click();
    assert.equal(await page.locator('#play-prompt').isVisible(), false);
    await page.locator('#fullscreen').click();
    await page.locator('#fullscreen-notice').waitFor();
  } finally { await page.close(); }
});

test('Escape releases fullscreen and mouse lock so the toolbar works again', async () => {
  const page = await browser.newPage();
  try {
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.createUnityInstance = async canvas => {
        canvas.addEventListener('click', () => canvas.requestPointerLock()); return {};
      };` }));
    await page.goto(base + '/play/line-boundary/');
    await page.locator('#start-fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement);
    await page.locator('canvas').click();
    await page.waitForFunction(() => document.pointerLockElement);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement && !document.pointerLockElement);
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement);
  } finally { await page.close(); }
});

test('embedded hosts that never complete fullscreen still offer windowed play', async () => {
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => { Element.prototype.requestFullscreen = () => new Promise(() => {}); });
    await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.createUnityInstance = async () => ({});' }));
    await page.goto(base + '/play/line-boundary/');
    await page.locator('#start-fullscreen').click();
    await page.locator('#launch-error').waitFor({timeout:6000});
    await page.locator('#start-windowed').click();
    assert.equal(await page.locator('#play-prompt').isVisible(), false);
  } finally { await page.close(); }
});

for (const mode of ['success', 'missing', 'corrupt']) {
  test(`split data: ${mode}, with verified parts and temporary URL cleanup`, async () => {
    const page = await browser.newPage();
    try {
      const manifest = structuredClone(require('../play/games.json'));
      const game = manifest.games.find(game => game.id === 'line-boundary');
      const buffers = [Buffer.from([1, 2, 3]), Buffer.from([4, 5])];
      game.build.dataParts = buffers.map((bytes, index) => ({
        url: `builds/test/${index}.part`, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }));
      await page.addInitScript(() => {
        window.revoked = [];
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = url => { window.revoked.push(url); revoke(url); };
      });
      await page.route('**/games.json', route => route.fulfill({ json: manifest }));
      await page.route('**/builds/test/*.part', route => {
        const index = Number(new URL(route.request().url()).pathname.split('/').at(-1).split('.')[0]);
        if (mode === 'missing' && index === 1) return route.fulfill({ status: 404 });
        return route.fulfill({ body: mode === 'corrupt' && index === 1 ? Buffer.from([9, 9]) : buffers[index] });
      });
      await page.route('**/*.loader.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        window.createUnityInstance = async (canvas, config, progress) => {
          window.started = true;
          window.bytes = Array.from(new Uint8Array(await (await fetch(config.dataUrl)).arrayBuffer()));
          window.blobPolicy = config.cacheControl(config.dataUrl); progress(1); return {};
        };` }));
      await page.goto(base + '/play/line-boundary/');
      await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('player-stage').dataset.state));
      if (mode === 'success') {
        assert.deepEqual(await page.evaluate(() => window.bytes), [1, 2, 3, 4, 5]);
        assert.equal(await page.evaluate(() => window.blobPolicy), 'no-store');
        assert.equal(await page.evaluate(() => window.revoked.length), 1);
      } else {
        assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'error');
        assert.equal(await page.evaluate(() => Boolean(window.started)), false);
        assert.equal(await page.locator('#retry').isVisible(), true);
      }
    } finally { await page.close(); }
  });
}

for (const mode of ['available', 'missing', 'rejected', 'forced', 'failed']) {
  test(`WebGPU selection and compatibility recovery: ${mode}`, async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      const manifest = structuredClone(require('../play/games.json'));
      const game = manifest.games.find(game => game.id === 'v-link-battle');
      game.build = { ...game.build, graphicsApi: 'WebGPU', loaderUrl: 'builds/test/gpu.loader.js' };
      delete game.build.dataParts;
      game.fallback = { build: { ...game.build, graphicsApi: 'OpenGLES3', loaderUrl: 'builds/test/gl.loader.js' },
        browserNotice: '互換版・一部のエフェクトは簡易表示', downloadBytes: 1024 };
      const requests = [];
      await page.addInitScript(mode => {
        Object.defineProperty(navigator, 'gpu', { value: mode === 'missing' ? undefined : { requestAdapter: async () => {
          if (mode === 'rejected') throw new Error('GPU unavailable');
          return {};
        } } });
      }, mode);
      await page.route('**/games.json', route => route.fulfill({ json: manifest }));
      await page.route('**/*.loader.js', route => {
        const gpu = route.request().url().endsWith('gpu.loader.js');
        requests.push(gpu ? 'webgpu' : 'webgl');
        return route.fulfill({ contentType: 'text/javascript', body: mode === 'failed' && gpu
          ? 'window.createUnityInstance = async () => { throw new Error("GPU runtime error"); };'
          : 'window.createUnityInstance = async () => ({});' });
      });
      await page.goto(base + '/play/v-link-battle/' + (mode === 'forced' ? '?renderer=webgl' : ''));
      await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#player-stage').dataset.state));
      if (mode === 'failed') {
        await page.locator('#retry-webgl').click();
        await page.waitForURL('**/?renderer=webgl');
        await page.waitForFunction(() => document.querySelector('#player-stage').dataset.state === 'ready');
        assert.deepEqual(requests, ['webgpu', 'webgl']);
      } else assert.deepEqual(requests, [mode === 'available' ? 'webgpu' : 'webgl']);
      assert.equal(await page.locator('#player-stage').getAttribute('data-renderer'), mode === 'available' ? 'webgpu' : 'webgl');
      assert.equal(await page.locator('#retry-webgl').isVisible(), false);
      if (mode !== 'available') assert.match(await page.locator('#player-notice').textContent(), /互換版/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    } finally { await page.close(); }
  });
}

test('test server does not expose other portfolio files', async () => {
  for (const route of ['/', '/index.html', '/tools/WEB-GAMES.md', '/play/%2e%2e%5cindex.html']) {
    const response = await fetch(base + route);
    assert.notEqual(response.status, 200, route);
  }
});
