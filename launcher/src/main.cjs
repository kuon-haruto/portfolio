const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { validateCatalog, relativePath, newer } = require('./catalog.cjs');
const { copyVerified, readJson, trustedUrl } = require('./transfer.cjs');
const { extractZip, readInstalled, commitInstallation } = require('./packages.cjs');
const { autoUpdater } = require('electron-updater');

if (process.env.ZENTA_USER_DATA) app.setPath('userData', path.resolve(process.env.ZENTA_USER_DATA));

const base = path.join(__dirname, '..');
const publisher = require('../data/publisher.json');
const bundled = app.isPackaged ? path.join(process.resourcesPath, 'bundled') : path.join(base, 'bundled');
let catalog = validateCatalog(require('../data/catalog.json'));
let win, library, data, catalogFile, busy = null, appUpdateReady = false, checkingGames = false;
let appUpdateStatus = '未確認';
let appUpdatePhase = 'idle';
const running = new Map();
const launching = new Set();
const statuses = new Map();
function notify() { if (win && !win.isDestroyed()) win.webContents.send('library:changed'); }
function errorMessage(error) {
  if (error.name === 'AbortError') return '処理をキャンセルしました。';
  if (['HTTP_404', 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'].includes(error.code)) return '更新ファイルはまだ公開されていません。';
  return error.message;
}
function gameById(id) {
  const game = catalog.games.find(g => g.id === id);
  if (!game) throw new Error('ゲームが見つかりません。');
  return game;
}
async function saveCatalog(value) {
  const temp = catalogFile + '.tmp';
  await fs.writeFile(temp, JSON.stringify({ ...value, launcherVersion: app.getVersion() }, null, 2));
  await fs.rename(temp, catalogFile);
}
async function snapshot() {
  const games = await Promise.all(catalog.games.map(async game => {
    const installed = await readInstalled(library, game.id);
    return { ...game, icon: '../assets/' + game.icon, installedVersion: installed?.version || null,
      updateAvailable: Boolean(installed && game.package && newer(game.package.version, installed.version)),
      running: running.has(game.id) || launching.has(game.id), progress: statuses.get(game.id) || null };
  }));
  return { games, busy: Boolean(busy), appVersion: app.getVersion(), appUpdateReady, appUpdateStatus,
    checkingGames, appUpdatePhase,
    updatesConfigured: Boolean(publisher.catalogUrl), appUpdatesConfigured: Boolean(publisher.appUpdateFeed) };
}
async function install(id) {
  if (busy) throw new Error('現在の処理が完了してから操作してください。');
  const game = gameById(id);
  if (!game.package) throw new Error('Windows版の配布ファイルがまだ登録されていません。');
  if (running.has(id)) throw new Error('ゲームを終了してから更新してください。');
  const pkg = game.package;
  const controller = new AbortController();
  const work = path.join(data, 'staging', randomUUID());
  const archive = path.join(work, 'package.zip');
  const stage = path.join(work, 'game');
  busy = { id, controller };
  const status = value => { statuses.set(id, value); notify(); };
  try {
    await fs.mkdir(work, { recursive: true });
    let source;
    if (pkg.bundled) {
      const file = path.join(bundled, relativePath(pkg.bundled));
      if (await fs.stat(file).then(s => s.isFile()).catch(() => false)) source = { file };
    }
    if (!source && pkg.url) source = { url: pkg.url };
    if (!source) throw new Error('配布ファイルが見つかりません。発行者に確認してください。');
    status({ phase: '取得・検証中', percent: 0 });
    let last = 0;
    await copyVerified(source, archive, pkg, publisher.downloadHosts, controller.signal, ({ bytes, total }) => {
      if (Date.now() - last > 120 || bytes === total) { last = Date.now(); status({ phase: '取得・検証中', percent: Math.round(bytes / total * 100) }); }
    });
    status({ phase: '展開中', percent: null });
    await extractZip(archive, stage, controller.signal);
    const exe = path.join(stage, relativePath(pkg.executable));
    if (!(await fs.stat(exe)).isFile()) throw new Error('ゲームの実行ファイルが含まれていません。');
    controller.signal.throwIfAborted();
    status({ phase: '反映中', percent: null });
    await commitInstallation(library, id, stage, { id, version: pkg.version, executable: pkg.executable, installedAt: new Date().toISOString() });
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    busy = null; statuses.delete(id); notify();
  }
}
async function launchGame(id) {
  gameById(id);
  if (busy) throw new Error('インストール処理が完了してから起動してください。');
  if (running.has(id)) throw new Error('このゲームは起動中です。');
  if (!await readInstalled(library, id)) await install(id);
  const installed = await readInstalled(library, id);
  if (!installed) throw new Error('インストールを確認できません。');
  const exe = path.join(library, id, relativePath(installed.executable));
  await new Promise((resolve, reject) => {
    const child = spawn(exe, [], { cwd: path.dirname(exe), shell: false, stdio: 'ignore', detached: false });
    child.once('error', reject);
    child.once('spawn', () => { running.set(id, child); notify(); resolve(); });
    child.once('exit', () => { running.delete(id); notify(); });
  });
}
async function launch(id) {
  if (launching.has(id)) throw new Error('ゲームの起動処理中です。');
  launching.add(id); notify();
  try { await launchGame(id); } finally { launching.delete(id); notify(); }
}
async function checkGames() {
  if (busy) throw new Error('インストール中は更新確認できません。');
  if (checkingGames) throw new Error('更新確認中です。');
  if (!publisher.catalogUrl) throw new Error('更新先がまだ設定されていません。');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  checkingGames = true; notify();
  try {
    const updated = validateCatalog(await readJson(publisher.catalogUrl, publisher.downloadHosts, controller.signal));
    for (const game of updated.games) {
      if (game.package?.url) trustedUrl(game.package.url, publisher.downloadHosts);
      if (!await fs.stat(path.join(base, 'assets', game.icon)).then(s => s.isFile()).catch(() => false)) {
        throw new Error('新しい作品の追加にはランチャー本体の更新が必要です。');
      }
    }
    await saveCatalog(updated); catalog = updated; notify();
    return 'ゲーム情報と配布バージョンを確認しました。';
  } finally { clearTimeout(timer); checkingGames = false; notify(); }
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
        event.senderFrame.url !== pathToFileURL(path.join(__dirname, 'index.html')).href) throw new Error('Unauthorized request');
    try { return { ok: true, value: await action(...args) }; }
    catch (error) { return { ok: false, error: errorMessage(error) }; }
  });
}
function setupUpdates() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  if (publisher.appUpdateFeed) autoUpdater.setFeedURL(publisher.appUpdateFeed);
  autoUpdater.on('error', error => { appUpdatePhase = 'idle'; appUpdateStatus = errorMessage(error); notify(); });
  autoUpdater.on('update-available', () => { appUpdatePhase = 'available'; appUpdateStatus = '新しいバージョンがあります'; notify(); });
  autoUpdater.on('update-not-available', () => { appUpdatePhase = 'idle'; appUpdateStatus = '最新バージョンです'; notify(); });
  autoUpdater.on('download-progress', p => { appUpdateStatus = '本体を取得中 ' + Math.round(p.percent) + '%'; notify(); });
  autoUpdater.on('update-downloaded', () => { appUpdatePhase = 'ready'; appUpdateReady = true; appUpdateStatus = '再起動して更新できます'; notify(); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    data = app.getPath('userData');
    library = path.join(data, 'games');
    catalogFile = path.join(data, 'catalog.json');
    await fs.mkdir(library, { recursive: true });
    try {
      const cached = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
      if (cached.launcherVersion === app.getVersion()) catalog = validateCatalog(cached);
    } catch {}
    for (const game of catalog.games) {
      if (!await readInstalled(library, game.id)) {
        const backup = path.join(library, game.id + '.previous');
        const current = path.join(library, game.id);
        if (!await fs.stat(current).catch(() => null) && await fs.stat(backup).catch(() => null)) await fs.rename(backup, current);
      }
    }
    setupUpdates();
    handle('library:snapshot', snapshot);
    handle('library:install', install);
    handle('library:launch', launch);
    handle('library:cancel', () => busy?.controller.abort());
    handle('library:check', checkGames);
    handle('library:folder', async id => {
      gameById(id);
      if (!await readInstalled(library, id)) throw new Error('インストールされていません。');
      const result = await shell.openPath(path.join(library, id));
      if (result) throw new Error(result);
    });
    handle('app:check', async () => {
      if (!app.isPackaged || !publisher.appUpdateFeed) throw new Error('配布版と更新先の設定が必要です。');
      if (['checking', 'downloading', 'ready'].includes(appUpdatePhase)) throw new Error('更新の処理中です。');
      appUpdatePhase = 'checking'; appUpdateStatus = '本体の更新を確認中'; notify();
      await autoUpdater.checkForUpdates();
    });
    handle('app:download', async () => {
      if (!publisher.appUpdateFeed) throw new Error('更新先が未設定です。');
      if (appUpdatePhase !== 'available') throw new Error('先に本体の更新を確認してください。');
      appUpdatePhase = 'downloading'; notify();
      await autoUpdater.downloadUpdate();
    });
    handle('app:restart', () => {
      if (!appUpdateReady || busy || running.size || launching.size) throw new Error('ゲームとインストール処理を終了してください。');
      autoUpdater.quitAndInstall(false, true);
    });
    win = new BrowserWindow({ width: 1220, height: 850, minWidth: 880, minHeight: 640,
      backgroundColor: '#151819', title: 'Zenta Game Library', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    win.on('close', event => {
      if (busy || launching.size || running.size) { event.preventDefault(); dialog.showMessageBox(win, { message: 'ゲームとインストール処理を終了してから閉じてください。' }); }
    });
    await win.loadFile(path.join(__dirname, 'index.html'));
  }).catch(error => { dialog.showErrorBox('起動できませんでした', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
