const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../launcher/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const output = path.join(root, 'launcher/test-output/portfolio');
let browser;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
});
after(async () => { await browser?.close(); });

test('idea notes are separate from finished works and open with mouse and keyboard', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url);
    const section = page.locator('#ideas');
    const notes = section.locator('details');
    assert.equal(await notes.count(), 3);
    assert.deepEqual(await section.locator('.idea-title').allTextContents(), ['人狼×建築', '拍手にまぎれて', 'この色、好きですか']);
    assert.match(await section.innerText(), /ゲーム本体は未制作/);
    assert.equal(await page.locator('#proposals .proposal-card').count(), 10);
    assert.equal(await page.locator('.game-gallery-group .game-icon-link').count(), 8);
    const ids = await page.locator('main > section').evaluateAll(nodes => nodes.map(el => el.id));
    assert(ids.indexOf('ideas') > ids.indexOf('proposals'));
    assert(ids.indexOf('ideas') < ids.indexOf('specifications'));
    for (const note of await notes.all()) {
      assert.equal(await note.getAttribute('open'), null);
      assert.equal(await note.locator('.idea-content').isVisible(), false);
      const summary = note.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await note.locator('.idea-content').isVisible(), true);
      assert.deepEqual(await note.locator('dt').allTextContents(), ['遊びの核', '面白さの狙い', '検討中の点', 'まず確かめたいこと']);
      await page.keyboard.press('Space');
      assert.equal(await note.locator('.idea-content').isVisible(), false);
      await summary.click();
      assert.equal(await note.locator('.idea-content').isVisible(), true);
      await summary.click();
    }
    assert.doesNotMatch(await section.innerText(), /販売実績|制作人数|制作期間|試作|D:\/|codex:/);
    await page.locator('#proposals a[href="#ideas"]').click();
    assert.equal(await page.evaluate(() => location.hash), '#ideas');
  } finally { await page.close(); }
});

test('all expanded idea notes fit desktop and mobile', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url + '#ideas');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('#ideas details').evaluateAll(notes => notes.forEach(note => { note.open = true; }));
      const overflow = await page.locator('#ideas').evaluate(section => [...section.querySelectorAll('summary, .idea-title, .idea-hook, .idea-genre, dt, dd, h3, p')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.left < 0 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
      }).map(el => el.textContent));
      assert.deepEqual(overflow, [], `${width}px`);
      if ([320, 1440].includes(width)) {
        await page.locator('#idea-werewolf-building').screenshot({ path: path.join(output, `idea-expanded-${width}.png`), style: '.site-header { visibility: hidden !important; }' });
        await page.locator('#ideas details').evaluateAll(notes => notes.forEach(note => { note.open = false; }));
        await page.locator('#ideas').screenshot({ path: path.join(output, `ideas-collapsed-${width}.png`), style: '.site-header { visibility: hidden !important; }' });
      }
    }
  } finally { await page.close(); }
});

test('idea content remains usable without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(url + '#ideas');
    const note = page.locator('#idea-colors-you-like');
    await note.locator('summary').click();
    assert.equal(await note.locator('.idea-content').isVisible(), true);
    await note.locator('summary').click();
    assert.equal(await note.locator('.idea-content').isVisible(), false);
  } finally { await context.close(); }
});
