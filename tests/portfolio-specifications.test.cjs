const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../launcher/node_modules/playwright');

test('seven specification cards have usable links, images and responsive layout', async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'launcher/test-output/specifications');
  const data = JSON.parse(await fs.readFile(path.join(root, 'documents/specifications/specifications.json'), 'utf8'));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await fs.mkdir(output, { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '#specifications');
      const cards = page.locator('#specifications .proposal-card');
      assert.equal(await cards.count(), 7);
      for (const game of data.games) {
        const card = cards.filter({ has: page.locator(`a[href="files/${game.pdf}"]`) });
        assert.equal(await card.count(), 1);
        assert.match(await card.innerText(), new RegExp(`制作人数：${game.team}人`));
        assert.equal(await card.locator('a').getAttribute('data-missing'), null);
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').evaluate(img => img.decode());
        const fits = await card.evaluate(element => {
          const parent = element.getBoundingClientRect();
          return element.scrollWidth <= element.clientWidth &&
            [...element.querySelectorAll('h3, h3 span, img, .tag, a')].every(child => {
              const box = child.getBoundingClientRect();
              return box.left >= parent.left && box.right <= parent.right &&
                box.top >= parent.top && box.bottom <= parent.bottom;
            });
        });
        assert(fits, `${game.id} overflows at ${width}px`);
        assert.equal((await fs.readFile(path.join(root, 'files', game.pdf))).subarray(0, 5).toString(), '%PDF-');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if ([320, 1440].includes(width)) {
        await page.locator('#specifications').screenshot({
          path: path.join(output, `specifications-web-${width}.png`), animations: 'disabled',
          style: '.site-header { visibility: hidden !important; }',
        });
      }
    }
    const opened = page.waitForEvent('popup');
    await page.locator('#specifications a[href="files/sliding-space-parking_spec.pdf"]').click();
    const pdf = await opened;
    await pdf.waitForLoadState();
    assert.match(pdf.url(), /sliding-space-parking_spec\.pdf$/);
    await pdf.close();
  } finally {
    await browser.close();
  }
});
