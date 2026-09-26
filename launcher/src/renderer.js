const $ = id => document.getElementById(id);
let state, selected, refreshing = false, refreshAgain = false;
const set = (id, text) => { $(id).textContent = text; };
function notice(message) { set('notice', message); $('notice').hidden = !message; }
async function run(action) {
  try {
    const result = await action();
    if (!result.ok) throw new Error(result.error);
    await refresh(); return result.value;
  } catch (error) { notice(error.message); throw error; }
}
function bind(id, action) {
  $(id).addEventListener('click', () => { notice(''); run(action).catch(() => {}); });
}
function renderList() {
  const search = $('search').value.toLocaleLowerCase();
  const filter = $('filter').value;
  const games = state.games.filter(g => g.title.toLocaleLowerCase().includes(search) &&
    (filter === 'all' || filter === 'installed' && g.installedVersion || filter === 'updates' && g.updateAvailable));
  const fragment = document.createDocumentFragment();
  for (const game of games) {
    const button = document.createElement('button');
    button.className = 'game-option'; button.setAttribute('aria-current', String(game.id === selected));
    const img = document.createElement('img'); img.src = game.icon; img.alt = ''; img.width = 42; img.height = 42;
    const title = document.createElement('span'); title.textContent = game.title;
    const status = document.createElement('small'); status.textContent = game.running ? '起動中' : game.updateAvailable ? '更新あり' : game.installedVersion ? 'インストール済み' : game.package ? 'インストール可能' : 'Windows版 準備中';
    title.append(status); button.append(img, title);
    button.addEventListener('click', () => { selected = game.id; notice(''); render(); });
    fragment.append(button);
  }
  $('games').replaceChildren(fragment);
  $('empty').hidden = games.length !== 0;
}
function render() {
  if (!state.games.some(g => g.id === selected)) selected = state.games.find(g => g.package)?.id || state.games[0]?.id;
  const game = state.games.find(g => g.id === selected);
  renderList();
  set('version', (state.portable ? 'ZIP版 / ' : '') + 'v' + state.appVersion);
  set('total', state.games.length + '作品 / インストール済み ' + state.games.filter(g => g.installedVersion).length);
  set('app-update-status', state.appUpdateStatus);
  $('restart-app').hidden = !state.appUpdateReady;
  $('check-app').hidden = state.portable;
  $('download-app').hidden = state.portable;
  $('open-release').hidden = !state.portable;
  $('check-app').disabled = !state.appUpdatesConfigured || ['checking', 'downloading', 'ready'].includes(state.appUpdatePhase);
  $('download-app').disabled = !state.appUpdatesConfigured || state.appUpdatePhase !== 'available';
  $('check-games').disabled = !state.updatesConfigured || state.busy || state.checkingGames;
  $('detail').hidden = !game;
  if (!game) return;
  $('art').src = game.icon;
  for (const key of ['title', 'description', 'genre', 'engine']) set(key, game[key]);
  set('team', game.teamSize == null ? '確認待ち' : game.teamSize + '人');
  set('duration', game.duration || '確認待ち');
  set('objective', game.objective || 'ゲームの目的は確認待ちです。');
  const instructions = game.howToPlay.length ? game.howToPlay : ['操作方法は確認待ちです。'];
  $('instructions').replaceChildren(...instructions.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  set('status', game.running ? '起動中' : game.updateAvailable ? '新しいバージョンがあります' : game.installedVersion ? 'プレイできます' : game.package ? 'Windows版を利用できます' : 'Windows版の配布準備中');
  set('play-label', game.running ? '起動中' : game.installedVersion ? 'プレイ' : 'インストールしてプレイ');
  $('play').disabled = state.busy || game.running || !game.package && !game.installedVersion;
  $('install').hidden = Boolean(game.installedVersion && !game.updateAvailable);
  $('install').disabled = state.busy || game.running || !game.package;
  set('install-label', game.updateAvailable ? 'ゲームを更新' : 'インストール');
  $('folder').disabled = !game.installedVersion;
  $('cancel').hidden = !game.progress || game.progress.phase === '反映中';
  set('installed-version', game.installedVersion ? 'インストール済み v' + game.installedVersion : '未インストール');
  $('progress-area').hidden = !game.progress;
  if (game.progress) {
    set('progress-label', game.progress.phase + (game.progress.percent == null ? '' : ' ' + game.progress.percent + '%'));
    if (game.progress.percent == null) $('progress').removeAttribute('value');
    else $('progress').value = game.progress.percent;
  }
  $('versions').replaceChildren(...[
    ['インストール済み', game.installedVersion || 'なし'],
    ['配布バージョン', game.package?.version || '準備中'],
    ['配布容量', game.package ? (game.package.size / 1024 ** 2).toFixed(1) + ' MB' : '未登録'],
  ].map(([label, value]) => { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row; }));
}
async function refresh() {
  if (refreshing) { refreshAgain = true; return; }
  refreshing = true;
  try {
    do {
      refreshAgain = false;
      const result = await window.library.snapshot();
      if (!result.ok) throw new Error(result.error);
      state = result.value; render();
    } while (refreshAgain);
  } catch (error) { notice(error.message); }
  finally { refreshing = false; }
}
for (const id of ['search', 'filter']) $(id).addEventListener('input', renderList);
bind('play', () => window.library.launch(selected));
bind('install', () => window.library.install(selected));
bind('folder', () => window.library.folder(selected));
bind('cancel', () => window.library.cancel());
$('updates').addEventListener('click', () => $('update-dialog').showModal());
$('close-updates').addEventListener('click', () => $('update-dialog').close());
bind('check-games', async () => {
  set('game-update-status', '確認中');
  const result = await window.library.check();
  set('game-update-status', result.ok ? result.value : result.error);
  return result;
});
bind('check-app', () => window.library.checkApp());
bind('download-app', () => window.library.downloadApp());
bind('restart-app', () => window.library.restartApp());
bind('open-release', () => window.library.openRelease());
const tabs = ['play', 'version'];
function selectTab(name) {
  for (const tab of tabs) {
    $('tab-' + tab).setAttribute('aria-selected', String(tab === name));
    $('tab-' + tab).tabIndex = tab === name ? 0 : -1;
    $('panel-' + tab).hidden = tab !== name;
  }
}
for (const tab of tabs) {
  $('tab-' + tab).addEventListener('click', () => selectTab(tab));
  $('tab-' + tab).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'play' : event.key === 'End' ? 'version' : tab === 'play' ? 'version' : 'play';
    selectTab(next); $('tab-' + next).focus();
  });
}
window.library.subscribe(refresh);
lucide.createIcons();
refresh();
