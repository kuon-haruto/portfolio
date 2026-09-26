const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  if (!process.env.ZENTA_TEST_APP) throw new Error('Set ZENTA_TEST_APP to the installed launcher executable');
  const output = path.join(__dirname, '..', 'test-output');
  await fs.mkdir(output, { recursive: true });
  const env = { ...process.env, ZENTA_USER_DATA: await fs.mkdtemp(path.join(output, 'live-data-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: process.env.ZENTA_TEST_APP, args: [], env, timeout: 60000 });
  try {
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const page = await app.firstWindow();
    page.setDefaultTimeout(120000);
    await page.locator('#games button').first().waitFor();
    await page.locator('#updates').click();
    await page.locator('#check-games').click();
    await page.locator('#game-update-status').filter({ hasText: '確認しました' }).waitFor();
    await page.locator('#check-app').click();
    await page.locator('#app-update-status').filter({ hasText: '最新バージョンです' }).waitFor();
    await page.screenshot({ path: path.join(output, 'live-update-check.png') });
    console.log('PASS: installed app fetched the public GitHub game catalog and latest.yml; launcher is current.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
