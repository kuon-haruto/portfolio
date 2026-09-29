const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../launcher/node_modules/playwright');

const output = path.join(__dirname, '../launcher/test-output/portfolio');
const url = process.env.PORTFOLIO_TEST_URL || pathToFileURL(path.join(__dirname, '../index.html')).href;
let browser;

before(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
});
after(async () => { await browser?.close(); });

test('proposals identify developed games without inventing a development environment for paper concepts', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url + '#proposals');
    const cards = page.locator('#proposals .proposal-card');
    assert.equal(await cards.count(), 7);
    const icons = ['line-boundary.png', 'hanten-assassination.jpeg', 'teruteru-wars.png', 'futago.png', null, null, 'bug-hunter.png'];
    for (let i = 0; i < icons.length; i++) {
      const card = cards.nth(i);
      const title = card.locator('h3');
      assert(await title.innerText());
      if (icons[i]) {
        assert.equal(await title.locator('img').getAttribute('src'), 'files/game-icons/' + icons[i]);
        assert.match(await card.locator('.meta').innerText(), /開発環境：Unity 6/);
      } else {
        assert.equal(await title.locator('img').count(), 0);
        assert.equal(await card.locator('.meta').innerText(), '企画書のみ');
        assert.doesNotMatch(await card.innerText(), /Unity/);
      }
      assert.equal(await card.locator('a[href$=".pdf"]').count(), 1);
    }
    const bug = page.locator('#proposal-bug-hunter');
    const items = await bug.locator('li').allTextContents();
    assert.equal(items.length, 3);
    assert.match(items[0], /^コンセプト：/);
    assert.match(items[1], /^ターゲット：/);
    assert.match(items[2], /^特徴：/);
    for (const feature of ['個体差', '指示式', '転倒', '起き上がるまで無防備', '運']) assert(items[2].includes(feature));
    assert.doesNotMatch(await bug.innerText(), /探索：|育成：|対戦：/);
    assert.equal(await bug.locator('.meta').innerText(), '開発環境：Unity 6');
    assert.doesNotMatch(await page.locator('body').innerText(), /試作|プロトタイプ/);
    assert.equal(await bug.locator('.prototype-play-link').innerText(), 'ブラウザーでプレイ');
    assert.equal(await bug.locator('.prototype-play-link').getAttribute('href'), 'https://kuon-haruto.github.io/portfolio/play/bug-hunter/');
  } finally { await page.close(); }
});

test('proposal headings, icons and text fit phone and desktop layouts', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#proposals');
      const cards = page.locator('#proposals .proposal-card');
      for (const card of await cards.all()) {
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const bounds = await card.evaluate(card => {
          const heading = card.querySelector('h3');
          const image = heading.querySelector('img');
          const box = card.getBoundingClientRect();
          const h = heading.getBoundingClientRect();
          const title = heading.querySelector('span').getBoundingClientRect();
          const icon = image?.getBoundingClientRect();
          return { overflow: card.scrollWidth > card.clientWidth,
            contained: [...card.querySelectorAll('h3, h3 span, h3 img, .tag')].every(element => {
              const r = element.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            }),
            iconLoaded: !image || image.naturalWidth > 0,
            separated: !icon || icon.right + 10 <= title.left,
            headingAboveMeta: h.bottom <= card.querySelector('.meta').getBoundingClientRect().top,
            iconSize: icon ? [icon.width, icon.height] : null };
        });
        assert.equal(bounds.overflow, false, `${width}px: ${JSON.stringify(bounds)}`);
        assert(bounds.contained && bounds.iconLoaded && bounds.separated && bounds.headingAboveMeta, `${width}px: ${JSON.stringify(bounds)}`);
        if (bounds.iconSize) assert.deepEqual(bounds.iconSize, [64, 64]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if ([320, 1440].includes(width)) {
        await page.locator('#proposals').screenshot({ path: path.join(output, `proposals-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
        await page.locator('#proposal-bug-hunter').screenshot({ path: path.join(output, `bug-hunter-proposal-${width}.png`), animations: 'disabled' });
        await cards.first().screenshot({ path: path.join(output, `line-boundary-proposal-${width}.png`), animations: 'disabled' });
      }
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('new work cards show verified production details and playable destinations', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url + '#works');
    assert.equal(await page.locator('#works .work-detail').count(), 6);
    const bug = page.locator('#works #game-bug-hunter');
    assert.equal(await bug.locator('h3').innerText(), 'バグハンター');
    assert.equal(await bug.locator('.work-play-link').getAttribute('href'), 'https://kuon-haruto.github.io/portfolio/play/bug-hunter/');
    for (const feature of ['個体差', '指示式', '転倒', '無防備', '運']) assert((await bug.innerText()).includes(feature));
    const parking = page.locator('#works #game-sliding-space-parking');
    assert.equal(await parking.locator('h3').innerText(), 'すべる宇宙駐車場');
    const metadata = await parking.locator('.meta').innerText();
    for (const detail of ['開発環境：Unity 6', '制作人数：4人', '制作期間：3日間', '担当：企画立案 / 整理 / 画像作成 / SE']) assert(metadata.includes(detail));
    assert.equal(await parking.locator('.work-play-link').getAttribute('href'), 'https://unityroom.com/games/sliding-space-parking');
    assert.equal(await parking.locator('.work-play-link').innerText(), 'すべる宇宙駐車場をプレイ');
    assert.match(await parking.locator('.work-play-link').getAttribute('rel'), /noopener/);
    assert.doesNotMatch(await page.locator('body').innerText(), /試作|プロトタイプ/);
  } finally { await page.close(); }
});

test('new work media, titles and tags fit mobile and desktop widths', async () => {
  const page = await browser.newPage();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#game-bug-hunter');
      for (const id of ['game-bug-hunter', 'game-sliding-space-parking']) {
        const card = page.locator('#' + id);
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const bounds = await card.evaluate(card => {
          const box = card.getBoundingClientRect();
          const icon = card.querySelector('h3 img').getBoundingClientRect();
          const title = card.querySelector('h3 span').getBoundingClientRect();
          const preview = card.querySelector('.work-game-preview');
          return {
            overflow: card.scrollWidth > card.clientWidth,
            contained: [...card.querySelectorAll('h3, h3 span, img, .tag, .work-play-link')].every(element => {
              const r = element.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            }),
            separated: icon.right + 10 <= title.left,
            imageLoaded: [...card.querySelectorAll('img')].every(image => image.naturalWidth > 0),
            previewRatio: preview.clientWidth / preview.clientHeight,
          };
        });
        assert(!bounds.overflow && bounds.contained && bounds.separated && bounds.imageLoaded, `${id} at ${width}: ${JSON.stringify(bounds)}`);
        assert(Math.abs(bounds.previewRatio - 16 / 9) < 0.02);
        assert((await card.locator('.work-play-link').boundingBox()).height <= 60, `${id}: play button should not break mid-word at ${width}px`);
        if ([320, 1440].includes(width)) {
          await card.screenshot({ path: path.join(output, `${id}-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
  } finally { await page.close(); }
});

test('all seven game icons circulate and new icons target their work cards', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const group = page.locator('.game-gallery-group:not(.game-gallery-copy)');
    assert.equal(await group.locator('a').count(), 7);
    assert.equal(await page.locator('.game-gallery-copy a').count(), 7);
    for (const id of ['game-bug-hunter', 'game-sliding-space-parking']) {
      assert.equal(await group.locator(`a[href="#${id}"]`).count(), 1);
      assert.equal(await page.locator(`#works #${id}`).count(), 1);
    }
    await group.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const track = page.locator('.game-gallery-track');
    const before = await track.evaluate(element => getComputedStyle(element).transform);
    await page.waitForFunction(previous => getComputedStyle(document.querySelector('.game-gallery-track')).transform !== previous, before);
    assert.equal(await track.evaluate(element => getComputedStyle(element).animationPlayState), 'running');
    assert.equal(await group.locator('img').evaluateAll(images => images.every(image => getComputedStyle(image).animationName === 'none')), true);
  } finally { await page.close(); }
});
