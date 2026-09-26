const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { packGame } = require('../tools/pack-game.cjs');
const { readInstalled } = require('../src/packages.cjs');

(async () => {
  const root = path.join(__dirname, '..');
  const output = path.join(root, 'test-output');
  await fs.mkdir(output, { recursive: true });
  const data = await fs.mkdtemp(path.join(output, 'update-data-'));
  const old = path.join(data, 'games', 'futago');
  const source = path.join(data, 'fixture');
  await fs.mkdir(old, { recursive: true });
  await fs.mkdir(source);
  await fs.writeFile(path.join(old, 'Game.exe'), 'MZ-old-test-fixture-not-runnable');
  await fs.writeFile(path.join(old, '.installed.json'), JSON.stringify({ id: 'futago', version: '1.0.0', executable: 'Game.exe' }));
  await fs.writeFile(path.join(source, 'Game.exe'), 'MZ-new-test-fixture-not-runnable');
  const archive = path.join(data, 'fixture.zip');
  const integrity = await packGame({ source, destination: archive, executable: 'Game.exe' });
  const catalog = structuredClone(require('../data/catalog.json'));
  const game = catalog.games.find(g => g.id === 'futago');
  game.package = { version: '1.1.0', executable: 'Game.exe', size: integrity.size, sha256: integrity.sha256, bundled: null, url: 'https://github.com/kuon-haruto/portfolio/releases/download/test/fixture.zip' };
  const env = { ...process.env, ZENTA_USER_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [root], env, timeout: 60000 });
  app.process().stderr.on('data', value => process.stderr.write(value));
  try {
    // Replace the transport in this test process only. Production HTTPS rules stay intact.
    await app.evaluate((_electron, { catalog, archive }) => {
      const https = process.getBuiltinModule('https');
      const { EventEmitter } = process.getBuiltinModule('events');
      const { Readable } = process.getBuiltinModule('stream');
      const fs = process.getBuiltinModule('fs');
      const { Buffer } = process.getBuiltinModule('buffer');
      globalThis.testCatalog = catalog;
      https.get = (url, _options, callback) => {
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.destroy = error => request.emit('error', error);
        setImmediate(() => {
          const res = url.pathname.endsWith('games.json') ? Readable.from([Buffer.from(JSON.stringify(globalThis.testCatalog))]) : fs.createReadStream(archive);
          res.statusCode = 200; res.headers = {};
          callback(res);
        });
        return request;
      };
    }, { catalog, archive });
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await page.locator('#search').fill('双子');
    await page.locator('#games button').click();
    async function check() {
      await page.locator('#updates').click();
      await page.locator('#check-games').click();
      await page.locator('#game-update-status').filter({ hasText: '確認しました' }).waitFor();
      await page.locator('#close-updates').click();
    }
    await check();
    await page.locator('#install').click();
    await page.locator('#installed-version').filter({ hasText: 'v1.1.0' }).waitFor();
    assert.equal((await readInstalled(path.join(data, 'games'), 'futago')).version, '1.1.0');
    assert.equal(await fs.readFile(path.join(old, 'Game.exe'), 'utf8'), 'MZ-new-test-fixture-not-runnable');
    await app.evaluate(() => {
      const pkg = globalThis.testCatalog.games.find(g => g.id === 'futago').package;
      pkg.version = '1.2.0'; pkg.sha256 = '0'.repeat(64);
    });
    await check();
    await page.locator('#install').click();
    await page.locator('#notice').filter({ hasText: '検証に失敗' }).waitFor();
    assert.equal((await readInstalled(path.join(data, 'games'), 'futago')).version, '1.1.0');
    assert.equal(await fs.readFile(path.join(old, 'Game.exe'), 'utf8'), 'MZ-new-test-fixture-not-runnable');
    await page.screenshot({ path: path.join(output, 'update-integrity-check.png') });
    console.log('PASS: update check, remote ZIP installation 1.0.0 -> 1.1.0, corrupt 1.2.0 rejected and installed game preserved');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
