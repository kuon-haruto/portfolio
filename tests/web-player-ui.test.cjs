const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { chromium } = require('../launcher/node_modules/playwright');
const { createServer } = require('../tools/web-test-server.cjs');
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

test('test server does not expose other portfolio files', async () => {
  for (const route of ['/', '/index.html', '/tools/WEB-GAMES.md', '/play/%2e%2e%5cindex.html']) {
    const response = await fetch(base + route);
    assert.notEqual(response.status, 200, route);
  }
});
