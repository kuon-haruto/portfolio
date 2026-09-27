(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const $ = id => document.getElementById(id);
  const selectedId = document.body.dataset.game;
  let unity = null;
  let failed = false;
  let started = false;
  let fullscreenPending = false;
  let exitTimer;
  const url = relative => new URL(relative, base).href;

  function startPlaying() {
    started = true;
    $('play-prompt').hidden = true;
    $('game-canvas').focus({ preventScroll: true });
  }

  async function enterFullscreen() {
    if (fullscreenPending) return;
    fullscreenPending = true;
    let timeout;
    try {
      // Call directly from the click: awaiting game loading would lose user activation.
      const request = $('player-stage').requestFullscreen({ navigationUI: 'hide' });
      await Promise.race([request, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Fullscreen response timed out')), 4000);
      })]);
      if (document.fullscreenElement !== $('player-stage')) throw new Error('Fullscreen was not entered');
      startPlaying();
      $('fullscreen-notice').hidden = true;
      $('launch-error').hidden = true;
    } catch {
      const message = '全画面表示が許可されていません。Edge / Chromeでこのページを開き直すか、ブラウザーの全画面表示（F11）をご利用ください。';
      for (const id of ['fullscreen-notice', 'launch-error']) {
        $(id).textContent = message;
        $(id).hidden = id === 'launch-error' ? $('play-prompt').hidden : !$('play-prompt').hidden;
      }
    } finally { clearTimeout(timeout); fullscreenPending = false; }
  }

  function syncFullscreen() {
    const active = document.fullscreenElement === $('player-stage');
    $('exit-fullscreen').hidden = !active;
    $('player-stage').classList.remove('show-fullscreen-exit');
    clearTimeout(exitTimer);
    if (active) {
      startPlaying();
      $('fullscreen-notice').hidden = true;
      $('launch-error').hidden = true;
    }
    else if (started) {
      if (document.pointerLockElement === $('game-canvas')) document.exitPointerLock();
      $('fullscreen').focus({ preventScroll: true });
    }
  }

  async function assembleData(parts) {
    const buffers = [];
    const total = parts.reduce((sum, part) => sum + part.bytes, 0);
    let downloaded = 0;
    for (const part of parts) {
      const response = await fetch(url(part.url));
      if (!response.ok) throw new Error('ゲームデータの取得に失敗しました。再試行してください。');
      const buffer = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (buffer.byteLength !== part.bytes || checksum !== part.sha256) throw new Error('ゲームデータを確認できませんでした。再試行してください。');
      buffers.push(buffer);
      downloaded += buffer.byteLength;
      $('loading-progress').value = .45 * downloaded / total;
      $('loading-message').textContent = 'ゲームデータを読み込んでいます ' + Math.round(downloaded / 1024 ** 2) + ' / ' + Math.ceil(total / 1024 ** 2) + ' MB';
    }
    return URL.createObjectURL(new Blob(buffers, { type: 'application/octet-stream' }));
  }

  function fail(error) {
    failed = true;
    $('player-stage').dataset.state = 'error';
    $('game-state').hidden = false;
    $('loading-message').textContent = 'ゲームを読み込めませんでした';
    $('loading-progress').hidden = true;
    $('loading-size').hidden = true;
    $('game-error').textContent = String(error?.message || error);
    $('game-error').hidden = false;
    $('retry').hidden = false;
    $('fullscreen').disabled = true;
    $('play-prompt').hidden = true;
  }

  function renderLibrary(games) {
    const fragment = document.createDocumentFragment();
    for (const game of games) {
      const card = document.createElement('a');
      card.className = 'game-card';
      card.href = url(game.id + '/');
      const art = document.createElement('div');
      art.className = 'game-card-art';
      const image = document.createElement('img');
      image.src = url(game.icon); image.alt = ''; image.width = 256; image.height = 256;
      art.append(image);
      const body = document.createElement('div');
      body.className = 'game-card-body';
      const title = document.createElement('h2'); title.textContent = game.title;
      const genre = document.createElement('p'); genre.textContent = game.genre;
      const action = document.createElement('div'); action.className = 'game-card-action';
      const label = document.createElement('span'); label.textContent = 'ブラウザーでプレイ';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.classList.add('icon'); icon.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#icon-play'); icon.append(use);
      action.append(label, icon); body.append(title, genre, action); card.append(art, body); fragment.append(card);
    }
    $('game-grid').replaceChildren(fragment);
    $('catalog-status').hidden = true;
  }

  async function loadGame(game) {
    $('library').hidden = true;
    $('player').hidden = false;
    $('game-title').textContent = game.title;
    document.title = game.title + ' | 島本善太';
    $('game-canvas').setAttribute('aria-label', game.title + 'のゲーム画面');
    $('loading-icon').src = url(game.icon);
    $('loading-size').textContent = '読み込み容量：約' + Math.ceil(game.downloadBytes / 1024 ** 2) + ' MB';
    $('game-description').textContent = game.description;
    $('game-meta').textContent = game.metadataLabel || game.teamSize + '人制作 / ' + game.duration;
    $('player-stage').classList.toggle('responsive-game', Boolean(game.responsiveCanvas));
    $('fullscreen').disabled = false;
    if (game.browserNotice || game.build.simplifiedEffects > 0) {
      $('player-notice').textContent = game.browserNotice || 'Web版では一部のエフェクトを簡易表示しています。';
      $('player-notice').hidden = false;
    }
    $('objective').textContent = game.objective;
    $('controls').replaceChildren(...game.howToPlay.map(text => {
      const item = document.createElement('li'); item.textContent = text; return item;
    }));
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url(game.build.loaderUrl);
      script.onload = resolve;
      script.onerror = () => reject(new Error('読み込み用ファイルを取得できません。通信状況を確認して再試行してください。'));
      document.body.append(script);
    });
    const build = game.build;
    let dataBlob;
    try {
      if (build.dataParts) dataBlob = await assembleData(build.dataParts);
      unity = await window.createUnityInstance($('game-canvas'), {
        dataUrl: dataBlob || url(build.dataUrl), frameworkUrl: url(build.frameworkUrl), codeUrl: url(build.codeUrl),
        ...(dataBlob ? { cacheControl: () => 'no-store' } : {}),
        streamingAssetsUrl: url(build.streamingAssetsUrl), companyName: build.companyName,
        productName: build.productName, productVersion: build.productVersion,
        // The original games use a fixed 1920x1080 UI; CSS scales that surface.
        matchWebGLToCanvasSize: Boolean(game.responsiveCanvas),
        devicePixelRatio: 1,
        showBanner(message, type) {
          if (type === 'error') fail(message);
          else if (type === 'warning') {
            $('player-notice').textContent = message;
            $('player-notice').hidden = false;
          }
        },
      }, progress => {
        if (failed) return;
        $('loading-progress').value = build.dataParts ? .45 + .55 * progress : progress;
        $('loading-message').textContent = build.dataParts || progress >= .9 ? 'ゲームを起動しています' : 'ゲームを読み込んでいます ' + Math.round(progress * 100) + '%';
      });
    } finally { if (dataBlob) URL.revokeObjectURL(dataBlob); }
    if (failed) return;
    $('game-state').hidden = true;
    $('player-stage').dataset.state = 'ready';
    $('play-prompt').hidden = started;
    if (started) $('game-canvas').focus({ preventScroll: true });
  }

  for (const id of ['reload', 'retry']) $(id).addEventListener('click', () => window.location.reload());
  $('fullscreen').addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await enterFullscreen();
  });
  $('start-fullscreen').addEventListener('click', enterFullscreen);
  $('start-windowed').addEventListener('click', startPlaying);
  $('exit-fullscreen').addEventListener('click', () => document.exitFullscreen().catch(() => {}));
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.fullscreenElement === $('player-stage')) {
      if (document.pointerLockElement === $('game-canvas')) document.exitPointerLock();
      document.exitFullscreen().catch(() => {});
    }
  }, true);
  $('player-stage').addEventListener('pointermove', event => {
    if (document.fullscreenElement !== $('player-stage') || document.pointerLockElement || event.clientY > 48) return;
    $('player-stage').classList.add('show-fullscreen-exit');
    clearTimeout(exitTimer);
    exitTimer = setTimeout(() => $('player-stage').classList.remove('show-fullscreen-exit'), 1800);
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) $('player-stage').classList.remove('show-fullscreen-exit');
  });
  $('game-canvas').addEventListener('pointerdown', () => $('game-canvas').focus({ preventScroll: true }));
  $('game-canvas').addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  });
  $('game-canvas').addEventListener('webglcontextlost', event => {
    event.preventDefault(); fail('ゲーム画面の描画が停止しました。再試行してください。');
  });
  if (selectedId) { $('library').hidden = true; $('player').hidden = false; }
  fetch(url('games.json')).then(async response => {
    if (!response.ok) throw new Error('作品情報を取得できません。ページを再読み込みしてください。');
    const { games } = await response.json();
    if (!Array.isArray(games) || !games.length) throw new Error('公開中の作品がありません。');
    if (!selectedId) return renderLibrary(games);
    const game = games.find(game => game.id === selectedId);
    if (!game) throw new Error('この作品のブラウザー版が見つかりません。作品一覧から選び直してください。');
    return loadGame(game);
  }).catch(error => {
    if (selectedId) fail(error);
    else { $('catalog-status').textContent = error.message; $('catalog-status').setAttribute('role', 'alert'); }
  });
})();
