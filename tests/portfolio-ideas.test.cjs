const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../launcher/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const home = pathToFileURL(path.join(root, 'index.html')).href;
const url = pathToFileURL(path.join(root, 'ideas.html')).href;
const output = path.join(root, 'launcher/test-output/portfolio');
let browser;
let records;
before(async () => {
  records = JSON.parse(await fs.readFile(path.join(root, 'src/idea-catalog.json'), 'utf8'));
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
});
after(async () => { await browser?.close(); });

test('portfolio stays compact and links to the complete separate catalog and back', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(home);
    assert.equal(await page.locator('#ideas details').count(), 0);
    assert.equal(await page.locator('#proposals .proposal-card').count(), 10);
    assert.equal(await page.locator('.game-gallery-group .game-icon-link').count(), 8);
    await page.locator('#ideas a[href="ideas.html"]').click();
    assert.equal(page.url(), url);
    assert.equal(await page.locator('.idea-card').count(), 24);
    assert.deepEqual((await page.locator('.idea-card h3').allTextContents()).sort(), records.map(r => r.title).sort());
    await page.locator('.ideas-header a[href="index.html#ideas"]').click();
    assert.equal(page.url(), home + '#ideas');
    await page.locator('#ideas').screenshot({ path: path.join(output, 'ideas-entry-1440.png'), style: '.site-header { visibility: hidden !important; }' });
  } finally { await page.close(); }
});

test('all concepts disclose real content with keyboard and mouse', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url);
    for (const record of records) {
      const card = page.locator(`#idea-${record.id}`);
      const details = card.locator('details');
      const summary = details.locator('summary');
      assert.equal(await details.getAttribute('open'), null);
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await card.locator('.idea-content').isVisible(), true);
      assert.deepEqual(await card.locator('dt').allTextContents(), ['面白さの狙い', '考えている一場面', '検討中の点', '確かめたいこと']);
      await page.keyboard.press('Space');
      assert.equal(await card.locator('.idea-content').isVisible(), false);
      await summary.click();
      assert.equal(await card.locator('.idea-content').isVisible(), true);
      await summary.click();
    }
    assert.match(await page.locator('#idea-adventurers-shop').textContent(), /AI制作/);
    assert.equal(await page.locator('#idea-adventurers-shop').getAttribute('data-stage'), 'implemented');
    assert.doesNotMatch(await page.locator('main').textContent(), /D:\/|codex:|制作期間|販売実績/);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('search, stage filters, empty state, reset and deep links work together', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const search = page.locator('#idea-search');
    const stage = page.locator('#idea-stage');
    const visible = page.locator('.idea-card:visible');
    for (const value of ['idea', 'unknown', 'validation', 'developing', 'implemented']) {
      await stage.selectOption(value);
      assert.equal(await visible.count(), records.filter(r => r.stage === value).length);
    }
    await stage.selectOption('all');
    await search.fill('３分');
    assert.equal(await visible.count(), 1);
    assert.match(await visible.innerText(), /3分ダンジョン/);
    await search.fill('配色 会話');
    assert.equal(await visible.count(), 1);
    await stage.selectOption('developing');
    assert.equal(await visible.count(), 0);
    assert.equal(await page.locator('#ideas-empty').isVisible(), true);
    assert.equal(await page.locator('#idea-count').innerText(), '0 / 24件');
    await page.getByRole('button', { name: '条件をリセット' }).click();
    assert.equal(await visible.count(), 24);
    assert.equal(await search.inputValue(), '');
    await stage.selectOption('developing');
    await page.evaluate(() => { location.hash = '#idea-colors-you-like'; });
    await page.waitForFunction(() => document.querySelector('#idea-colors-you-like details').open);
    assert.equal(await visible.count(), 24);
    await page.reload();
    assert.equal(await page.locator('#idea-colors-you-like .idea-content').isVisible(), true);
  } finally { await page.close(); }
});

test('responsive catalog and expanded text fit; every image loads', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url);
    const badImages = await page.locator('.idea-art img').evaluateAll(async images => {
      await Promise.all(images.map(img => { img.loading = 'eager'; return img.decode(); }));
      return images.filter(img => !img.naturalWidth).map(img => img.src);
    });
    assert.deepEqual(badImages, []);
    assert.equal(await page.locator('.idea-art img').count(), 19);
    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('details').evaluateAll(notes => notes.forEach(note => { note.open = true; }));
      const overflow = await page.locator('main').evaluate(main => [...main.querySelectorAll('h1,h2,h3,p,dt,dd,summary,input,select,button')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.left < 0 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
      }).map(el => el.textContent));
      assert.deepEqual(overflow, [], `${width}px`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if ([320, 1440].includes(width)) {
        await page.locator('#idea-werewolf-building').screenshot({ path: path.join(output, `idea-expanded-${width}.png`) });
        await page.locator('details').evaluateAll(notes => notes.forEach(note => { note.open = false; }));
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `ideas-catalog-${width}.png`) });
      }
    }
  } finally { await page.close(); }
});

test('all content and return navigation remain available without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(url);
    assert.equal(await page.locator('.idea-card').count(), 24);
    assert.equal(await page.locator('#ideas-controls').isVisible(), false);
    const card = page.locator('#idea-colors-you-like');
    await card.locator('summary').click();
    assert.equal(await card.locator('.idea-content').isVisible(), true);
    await card.locator('summary').click();
    assert.equal(await card.locator('.idea-content').isVisible(), false);
    await page.locator('.ideas-header a[href="index.html#ideas"]').click();
    assert.equal(page.url(), home + '#ideas');
  } finally { await context.close(); }
});
