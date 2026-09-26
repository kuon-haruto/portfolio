const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extractZip } = require('../src/packages.cjs');
const ResEdit = require('resedit');

(async () => {
  const root = path.join(__dirname, '..');
  const version = require('../package.json').version;
  const output = path.join(root, 'test-output');
  await fs.mkdir(output, { recursive: true });
  const folder = await fs.mkdtemp(path.join(output, 'portable-'));
  await extractZip(path.join(root, 'dist', 'portable', `AppInstaller-Portable-${version}.zip`), folder);
  const executablePath = path.join(folder, 'アプリインストーラー.exe');
  const executable = ResEdit.NtExecutable.from(await fs.readFile(executablePath));
  const resources = ResEdit.NtExecutableResource.from(executable);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const embedded = groups[0].getIconItemsFromEntries(resources.entries);
  const expected = ResEdit.Data.IconFile.from(await fs.readFile(path.join(root, 'dist', 'portable', '.icon-ico', 'icon.ico')));
  const bytes = icon => Buffer.from(icon.isRaw() ? icon.bin : icon.generate());
  for (const icon of expected.icons) assert.ok(embedded.some(item => bytes(item).equals(bytes(icon.data))));
  const preview = embedded.find(icon => icon.isRaw() && icon.width === 64);
  assert.ok(preview);
  await fs.writeFile(path.join(output, 'portable-exe-icon.png'), bytes(preview));
  const env = { ...process.env, ZENTA_USER_DATA: await fs.mkdtemp(path.join(output, 'portable-data-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath, args: [], env, timeout: 60000 });
  try {
    const page = await app.firstWindow({ timeout: 60000 });
    await page.locator('#games button').first().waitFor();
    assert.equal(await page.title(), 'アプリインストーラー');
    assert.equal(await page.locator('#games button').count(), 5);
    assert.equal(await page.locator('.brand img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    const state = await page.evaluate(async () => (await window.library.snapshot()).value);
    assert.equal(state.portable, true);
    assert.equal(state.appUpdatesConfigured, false);
    assert.equal(state.updatesConfigured, true);
    for (const method of ['checkApp', 'downloadApp', 'restartApp']) {
      const response = await page.evaluate(method => window.library[method](), method);
      assert.equal(response.ok, false);
      assert.match(response.error, /ZIP版/);
    }
    await app.evaluate(({ shell }) => {
      shell.openExternal = async url => { globalThis.testReleaseUrl = url; };
    });
    await page.locator('#updates').click();
    assert.equal(await page.locator('#check-app').isVisible(), false);
    assert.equal(await page.locator('#download-app').isVisible(), false);
    await page.locator('#open-release').click();
    assert.equal(await app.evaluate(() => globalThis.testReleaseUrl), 'https://github.com/kuon-haruto/portfolio/releases/latest');
    await page.screenshot({ path: path.join(output, 'portable-updates.png') });
    await page.locator('#close-updates').click();
    await page.screenshot({ path: path.join(output, 'portable-app.png') });
    console.log('PASS: extracted ZIP launches without setup, dedicated branding, portable updater guards and release link.');
  } finally { await app.close(); }
  for (const script of ['ui-smoke.cjs', 'install-smoke.cjs']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
      env: { ...env, ZENTA_TEST_APP: executablePath }, stdio: 'inherit', timeout: 300000,
    });
    if (result.error || result.status !== 0) throw result.error || new Error(`${script} failed: ${result.status}`);
  }
  console.log('Verified portable executable: ' + executablePath);
})().catch(error => { console.error(error); process.exitCode = 1; });
