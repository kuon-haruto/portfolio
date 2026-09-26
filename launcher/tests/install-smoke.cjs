const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readInstalled } = require('../src/packages.cjs');

(async () => {
  const root = path.join(__dirname, '..');
  const game = require('../data/catalog.json').games.find(g => g.id === (process.argv[2] || 'futago'));
  if (!game?.package) throw new Error('Game package is required');
  const output = path.join(root, 'test-output');
  await fs.mkdir(output, { recursive: true });
  const data = await fs.mkdtemp(path.join(output, 'install-data-'));
  if (process.env.ZENTA_TEST_REMOTE === '1') {
    const catalog = structuredClone(require('../data/catalog.json'));
    for (const entry of catalog.games) if (entry.package) entry.package.bundled = null;
    await fs.writeFile(path.join(data, 'catalog.json'), JSON.stringify({ ...catalog, launcherVersion: require('../package.json').version }));
  }
  const env = { ...process.env, ZENTA_USER_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.ZENTA_TEST_APP || undefined;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : [root], env, timeout: 60000 });
  let gamePid;
  try {
    const page = await app.firstWindow();
    await page.locator('#search').fill(game.title);
    await page.locator('#games button').click();
    await page.locator('#install').click();
    await page.locator('#installed-version').filter({ hasText: 'インストール済み v' + game.package.version }).waitFor({ timeout: 180000 });
    const installed = await readInstalled(path.join(data, 'games'), game.id);
    assert.equal(installed.version, game.package.version);
    assert.equal(await page.locator('#play').isEnabled(), true);
    // Capture only the child created by this test's launch, never other game processes.
    await app.evaluate((_electron, { executable, log }) => {
      const { ChildProcess } = process.getBuiltinModule('child_process');
      const spawn = ChildProcess.prototype.spawn;
      ChildProcess.prototype.spawn = function(options) {
        const isGame = options.file?.endsWith(executable);
        if (isGame) options.args.push('-logFile', log, '-screen-fullscreen', '0', '-screen-width', '960', '-screen-height', '540');
        const result = spawn.call(this, options);
        if (isGame) globalThis.testGameProcess = this;
        return result;
      };
    }, { executable: game.package.executable, log: path.join(output, game.id + '-player.log') });
    await page.locator('#play').click();
    await page.locator('#status').filter({ hasText: '起動中' }).waitFor({ timeout: 30000 });
    gamePid = await app.evaluate(() => globalThis.testGameProcess?.pid);
    assert.ok(gamePid > 0);
    await page.waitForTimeout(6000);
    assert.equal(await app.evaluate(() => globalThis.testGameProcess?.exitCode), null);
    await page.screenshot({ path: path.join(output, 'installed-' + game.id + '.png') });
    console.log('PASS: ' + (process.env.ZENTA_TEST_REMOTE === '1' ? 'GitHub ZIP' : 'bundled ZIP') + ', checksum, extraction, installed manifest, Play button launched ' + game.package.executable + '; PID ' + gamePid);
  } finally {
    await app.evaluate(async () => {
      const child = globalThis.testGameProcess;
      if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    }).catch(() => {});
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
