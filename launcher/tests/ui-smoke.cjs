const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const root = path.join(__dirname, '..');
  const output = path.join(root, 'test-output');
  await fs.mkdir(output, { recursive: true });
  const env = { ...process.env, ZENTA_USER_DATA: await fs.mkdtemp(path.join(output, 'ui-data-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.ZENTA_TEST_APP || undefined;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : [root], env, timeout: 60000 });
  try {
    const page = await app.firstWindow({ timeout: 60000 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.locator('#games button').first().waitFor();
    assert.equal(await page.title(), 'アプリインストーラー');
    assert.equal(await app.evaluate(({ app }) => app.getName()), 'アプリインストーラー');
    assert.equal(await page.locator('.brand strong').textContent(), 'アプリインストーラー');
    assert.equal(await page.locator('.brand img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    assert.equal(await page.locator('#games button').count(), 5);
    for (const width of [1220, 880]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 850), width);
      for (let i = 0; i < 5; i++) {
        await page.locator('#games button').nth(i).click();
        assert.equal(await page.locator('#art').evaluate(img => img.complete && img.naturalWidth > 0), true);
        assert.equal(await page.evaluate(() => document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth), true);
        assert.equal(await page.locator('.brand').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      }
      await page.screenshot({ path: path.join(output, `library-${width}.png`) });
    }
    await page.locator('#search').fill('双子');
    assert.equal(await page.locator('#games button').count(), 1);
    await page.locator('#games button').click();
    assert.equal(await page.locator('#team').textContent(), '6人');
    await page.locator('#tab-version').click();
    assert.equal(await page.locator('#panel-version').isVisible(), true);
    await page.locator('#updates').click();
    assert.equal(await page.locator('#update-dialog').isVisible(), true);
    await page.locator('#close-updates').click();
    assert.deepEqual(errors, []);
    console.log('PASS: Electron renderer, five games, assets, widths 1220/880, search, metadata, tabs, update dialog');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
