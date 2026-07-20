const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

const navLinks = document.querySelectorAll('.nav a');
const sections = [...document.querySelectorAll('main section[id]')];

// ---- タイトル画面（クリックまたはキー入力でポートフォリオを開く） ----
const titleScreen = document.getElementById('title-screen');
if (titleScreen) {
  document.body.classList.add('title-lock');

  const closeTitle = () => {
    titleScreen.classList.add('closing');
    document.body.classList.remove('title-lock');
    document.removeEventListener('keydown', closeTitle);
    // フェードアウト後に取り除く
    setTimeout(() => titleScreen.remove(), 600);
  };

  titleScreen.addEventListener('click', closeTitle, { once: true });
  document.addEventListener('keydown', closeTitle);
}

const storage = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* プライベートモード等で保存できない場合は無視 */
    }
  },
};

// ---- 実績解除トースト ----
const achievements = {
  'featured-works': '注目作品を発見！',
  works: 'ゲーム作品をチェック',
  proposals: '企画書コーナーに到達',
  specifications: '仕様書コーナーに到達',
  contact: '最後まで読破！ありがとう',
};
const unlocked = new Set();
let toastStack = null;

const showToast = ({ icon, label, text, tone = '' }) => {
  if (!toastStack) {
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    toastStack.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastStack);
  }

  const toast = document.createElement('div');
  toast.className = tone ? `toast toast--${tone}` : 'toast';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-text">
      <small>${label}</small>
      <strong>${text}</strong>
    </div>
  `;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 4300);
};

const unlockAchievement = id => {
  if (unlocked.has(id)) return;
  unlocked.add(id);
  showToast({ icon: '🏆', label: 'Achievement', text: `実績解除：${achievements[id]}` });
};

// ---- まだ用意できていない資料リンクは「制作中」の案内を出す ----
// ファイルの有無を自動チェックするので、あとからPDFを置くだけで通常のリンクに戻る
const setupFileLinks = () => {
  document.querySelectorAll('a[href^="files/"]').forEach(link => {
    fetch(link.getAttribute('href'), { method: 'HEAD' })
      .then(res => {
        if (!res.ok) link.dataset.missing = '1';
      })
      .catch(() => {
        /* ローカル環境などで確認できない場合は通常リンクのまま */
      });

    link.addEventListener('click', e => {
      if (link.dataset.missing) {
        e.preventDefault();
        showToast({
          icon: '🚧',
          label: 'Coming Soon',
          text: 'この資料は現在制作中です。もうしばらくお待ちください。',
          tone: 'notice',
        });
      }
    });
  });
};

// ---- 案内キャラ（ナビ） ----
const guideMessages = {
  '': 'ようこそ！ナビの「プラン」です。ポートフォリオをご案内いたします。',
  about: 'まずはプロフィールです。人柄や強みをぜひご覧ください。',
  'featured-works': 'こちらは注目作品です。実績のあるイチオシ作品で、プレイ動画もご覧いただけます。',
  works: '制作したゲームの一覧です。「ゲームをプレイ」ボタンから実際にお楽しみいただけます。',
  proposals: '企画書はPDFでご覧いただけます。企画の意図まで丁寧にまとめています。',
  specifications: '仕様書コーナーです。設計力はこちらでご確認ください。',
  thinking: '企画の際に大切にしている考え方をまとめています。',
  skills: 'スキルと使用ツールの一覧です。バーは経験年数を表しています。',
  contact: '最後までご覧いただきありがとうございます。ご連絡はこちらからどうぞ。',
};

// 3種類のキャラデザイン（すべて体付き）
const guideDesigns = {
  robot: {
    name: 'ロボ',
    svg: `
      <svg class="guide-char" viewBox="0 0 64 84" aria-hidden="true">
        <line x1="32" y1="8" x2="32" y2="14" stroke="#6fb0ff" stroke-width="2.5" />
        <circle cx="32" cy="5.5" r="3" fill="#2fd4b5" />
        <rect x="12" y="14" width="40" height="28" rx="9" fill="#1c2a4e" stroke="#6fb0ff" stroke-width="2.5" />
        <circle class="guide-eye" cx="25" cy="27" r="3.5" fill="#53dfff" />
        <circle class="guide-eye" cx="39" cy="27" r="3.5" fill="#53dfff" />
        <rect x="27" y="34" width="10" height="2.6" rx="1.3" fill="#6fb0ff" />
        <line x1="17" y1="52" x2="8" y2="60" stroke="#6fb0ff" stroke-width="2.5" stroke-linecap="round" />
        <line x1="47" y1="52" x2="56" y2="60" stroke="#6fb0ff" stroke-width="2.5" stroke-linecap="round" />
        <rect x="17" y="46" width="30" height="24" rx="8" fill="#1c2a4e" stroke="#6fb0ff" stroke-width="2.5" />
        <circle cx="32" cy="58" r="4.5" fill="#2fd4b5" opacity="0.9" />
        <rect x="20" y="72" width="9" height="6" rx="3" fill="#6fb0ff" />
        <rect x="35" y="72" width="9" height="6" rx="3" fill="#6fb0ff" />
      </svg>
    `,
  },
  slime: {
    name: 'スライム',
    svg: `
      <svg class="guide-char" viewBox="0 0 64 84" aria-hidden="true">
        <path d="M32 16 C15 16 7 38 7 53 C7 69 18 77 32 77 C46 77 57 69 57 53 C57 38 49 16 32 16 Z"
          fill="#175a50" stroke="#2fd4b5" stroke-width="2.5" />
        <ellipse cx="21" cy="32" rx="6" ry="9" fill="rgba(255,255,255,0.16)" />
        <circle class="guide-eye" cx="25" cy="48" r="4" fill="#7df0dc" />
        <circle class="guide-eye" cx="41" cy="48" r="4" fill="#7df0dc" />
        <path d="M27 58 Q33 63 39 58" stroke="#7df0dc" stroke-width="2.5" fill="none" stroke-linecap="round" />
      </svg>
    `,
  },
  ghost: {
    name: 'ゴースト',
    svg: `
      <svg class="guide-char" viewBox="0 0 64 84" aria-hidden="true">
        <path d="M32 12 C18 12 12 25 12 37 L12 72 L19 65 L26 72 L32 65 L38 72 L45 65 L52 72 L52 37 C52 25 46 12 32 12 Z"
          fill="#2b2350" stroke="#9d8cff" stroke-width="2.5" />
        <circle class="guide-eye" cx="25" cy="37" r="4" fill="#c3b8ff" />
        <circle class="guide-eye" cx="40" cy="37" r="4" fill="#c3b8ff" />
        <ellipse cx="32.5" cy="49" rx="4" ry="5.5" fill="#c3b8ff" opacity="0.85" />
        <path d="M12 46 Q5 50 6 57" stroke="#9d8cff" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M52 46 Q59 50 58 57" stroke="#9d8cff" stroke-width="2.5" fill="none" stroke-linecap="round" />
      </svg>
    `,
  },
};
const DESIGN_KEYS = Object.keys(guideDesigns);

const readStoredPos = () => {
  try {
    const raw = storage.get('guidePos');
    if (!raw) return null;
    const pos = JSON.parse(raw);
    if (['bl', 'br', 'tl', 'tr'].includes(pos.corner) && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      return pos;
    }
  } catch {
    /* 壊れた保存データは無視 */
  }
  return null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const guideState = {
  size: clamp(parseInt(storage.get('guideSize'), 10) || 60, 40, 96),
  design: DESIGN_KEYS.includes(storage.get('guideDesign')) ? storage.get('guideDesign') : 'robot',
  hidden: storage.get('guideHidden') === '1',
  chat: storage.get('guideChat') === '1', // 質問コーナーの表示状態
  bubbleW: clamp(parseInt(storage.get('guideBubbleW'), 10) || 280, 200, 1200), // 吹き出しの幅
  chatH: clamp(parseInt(storage.get('guideChatH'), 10) || 150, 80, 1000), // 質問エリアの高さ
  pos: readStoredPos(), // null なら既定の左下
};

let guideEl = null;
let restoreEl = null;
let promptEl = null;
let guideText = null;
let lastGuideId = null;
let placing = false;

// ---- 質問応答（選択式。データは scripts/profile-data.js に書く） ----
const qaData = typeof profileQA !== 'undefined' ? profileQA : [];

// ゲームの会話ウィンドウ風に1文字ずつ表示する
const typeMessage = (el, text, log) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    log.scrollTop = log.scrollHeight;
    return;
  }
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    el.textContent = text.slice(0, i);
    log.scrollTop = log.scrollHeight;
    if (i >= text.length) clearInterval(timer);
  }, 22);
};

// 要素の四隅アンカーに合わせて位置を適用する
const setInset = (el, corner, x, y) => {
  el.style.left = el.style.right = el.style.top = el.style.bottom = '';
  if (corner.includes('l')) el.style.left = `${x}px`;
  else el.style.right = `${x}px`;
  if (corner.includes('t')) el.style.top = `${y}px`;
  else el.style.bottom = `${y}px`;
};

const applyGuideState = () => {
  const corner = guideState.pos ? guideState.pos.corner : 'bl';
  guideEl.dataset.corner = corner;
  restoreEl.dataset.corner = corner;

  if (guideState.pos) {
    setInset(guideEl, corner, guideState.pos.x, guideState.pos.y);
    setInset(restoreEl, corner, guideState.pos.x, guideState.pos.y);
  } else {
    setInset(guideEl, 'bl', 18, 18);
    setInset(restoreEl, 'bl', 18, 18);
  }

  guideEl.style.setProperty('--guide-size', `${guideState.size}px`);
  guideEl.style.setProperty('--bubble-w', `${guideState.bubbleW}px`);
  guideEl.style.setProperty('--chat-h', `${guideState.chatH}px`);
  guideEl.classList.toggle('chat-open', guideState.chat);
  guideEl.style.display = guideState.hidden ? 'none' : 'flex';
  restoreEl.style.display = guideState.hidden ? 'flex' : 'none';

  guideEl.querySelector('[data-action="design"]').textContent =
    `🎨 デザイン：${guideDesigns[guideState.design].name}`;
  guideEl.querySelector('[data-action="chat"]').textContent = guideState.chat
    ? '💬 質問コーナーを隠す'
    : '💬 質問コーナーを表示';
  guideEl.querySelector('.guide-chat').hidden = !guideState.chat;

  storage.set('guideSize', String(guideState.size));
  storage.set('guideDesign', guideState.design);
  storage.set('guideHidden', guideState.hidden ? '1' : '0');
  storage.set('guideChat', guideState.chat ? '1' : '0');
  storage.set('guideBubbleW', String(guideState.bubbleW));
  storage.set('guideChatH', String(guideState.chatH));
  storage.set('guidePos', guideState.pos ? JSON.stringify(guideState.pos) : '');
};

const renderGuideChar = () => {
  guideEl.querySelector('.guide-char-btn').innerHTML = guideDesigns[guideState.design].svg;
  restoreEl.innerHTML = guideDesigns[guideState.design].svg;
};

// 「場所を移動」モード：次のクリック位置へ移動する
const startPlacing = () => {
  placing = true;
  guideEl.classList.remove('menu-open');
  promptEl.classList.add('show');
  document.body.classList.add('guide-placing');
};

const stopPlacing = () => {
  placing = false;
  promptEl.classList.remove('show');
  document.body.classList.remove('guide-placing');
};

const placeAt = (x, y) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const corner = (y > vh / 2 ? 'b' : 't') + (x > vw / 2 ? 'r' : 'l');
  const half = guideState.size / 2;
  const offX = Math.max(10, (corner.includes('l') ? x : vw - x) - half);
  const offY = Math.max(10, (corner.includes('t') ? y : vh - y) - half);
  guideState.pos = { corner, x: Math.round(offX), y: Math.round(offY) };
  applyGuideState();
};

const createGuide = () => {
  guideEl = document.createElement('div');
  guideEl.className = 'guide';
  guideEl.innerHTML = `
    <button class="guide-char-btn" aria-label="ナビのメニューを開く" title="クリックでメニュー"></button>
    <div class="guide-bubble">
      <button class="guide-close" aria-label="ナビを隠す">×</button>
      <p>${guideMessages['']}</p>
      <div class="guide-chat" hidden>
        <div class="guide-chat-log" hidden></div>
        <div class="guide-chips"></div>
      </div>
      <span class="guide-resize guide-resize-x" aria-hidden="true"></span>
      <span class="guide-resize guide-resize-y" aria-hidden="true"></span>
      <span class="guide-resize guide-resize-xy" aria-hidden="true"></span>
    </div>
    <div class="guide-menu">
      <button type="button" data-action="chat">💬 質問コーナーを表示</button>
      <button type="button" data-action="size">🔍 サイズ調整</button>
      <div class="guide-size-row">
        <input type="range" min="40" max="96" step="2" value="${guideState.size}" aria-label="ナビの大きさ" />
      </div>
      <button type="button" data-action="move">📍 場所を移動</button>
      <button type="button" data-action="design">🎨 デザイン：ロボ</button>
      <button type="button" data-action="hide">👻 非表示にする</button>
    </div>
  `;
  document.body.appendChild(guideEl);

  restoreEl = document.createElement('button');
  restoreEl.className = 'guide-restore';
  restoreEl.setAttribute('aria-label', 'ナビを表示');
  restoreEl.title = 'ナビを表示';
  document.body.appendChild(restoreEl);

  promptEl = document.createElement('div');
  promptEl.className = 'guide-prompt';
  promptEl.textContent = 'どこに移動しますか？ 移動したい場所をクリックしてください（Escで取消）';
  document.body.appendChild(promptEl);

  guideText = guideEl.querySelector('.guide-bubble p');
  renderGuideChar();

  // キャラをクリックでメニュー開閉（1回のクリックで必ず開くようにする）
  guideEl.querySelector('.guide-char-btn').addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !guideEl.classList.contains('menu-open');
    guideEl.classList.toggle('menu-open', willOpen);
    if (willOpen) {
      // 開き直したときはサイズスライダーを閉じた状態に戻す
      guideEl.querySelector('.guide-size-row').classList.remove('show');
    }
  });

  // メニューの各操作
  const sizeRow = guideEl.querySelector('.guide-size-row');
  guideEl.querySelector('.guide-menu').addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;

    if (action === 'chat') {
      guideState.chat = !guideState.chat;
      guideEl.classList.remove('menu-open');
      applyGuideState();
      return;
    }
    if (action === 'size') {
      sizeRow.classList.toggle('show');
      return;
    }
    if (action === 'move') {
      startPlacing();
      return;
    }
    if (action === 'design') {
      const next = (DESIGN_KEYS.indexOf(guideState.design) + 1) % DESIGN_KEYS.length;
      guideState.design = DESIGN_KEYS[next];
      renderGuideChar();
    } else if (action === 'hide') {
      guideState.hidden = true;
      guideEl.classList.remove('menu-open');
    }
    applyGuideState();
  });

  // サイズスライダー：動かすとリアルタイムに反映
  sizeRow.querySelector('input').addEventListener('input', e => {
    guideState.size = parseInt(e.target.value, 10);
    applyGuideState();
  });

  // 質問チャット（会話の選択肢のように、一覧から選んで質問する）
  const chatLog = guideEl.querySelector('.guide-chat-log');
  const chatChips = guideEl.querySelector('.guide-chips');

  const askQuestion = item => {
    chatLog.hidden = false;

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg chat-msg--user';
    userMsg.textContent = item.question;
    chatLog.appendChild(userMsg);

    const naviMsg = document.createElement('div');
    naviMsg.className = 'chat-msg chat-msg--navi';
    chatLog.appendChild(naviMsg);
    typeMessage(naviMsg, item.answer, chatLog);
  };

  // データから質問の選択肢を生成する
  qaData.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = item.question;
    chip.addEventListener('click', () => {
      chip.classList.add('asked');
      askQuestion(item);
    });
    chatChips.appendChild(chip);
  });

  // 質問データが無いときは質問メニューごと隠す
  if (qaData.length === 0) {
    guideEl.querySelector('[data-action="chat"]').style.display = 'none';
  }

  // 吹き出しのフチをドラッグしてサイズ変更（Windowsのウィンドウ風）
  // dirX: 幅を変える / dirY: 質問エリアの高さを変える
  const startResize = (e, dirX, dirY) => {
    e.preventDefault();
    const corner = guideEl.dataset.corner || 'bl';
    // アンカーの向きによってドラッグ方向と増減の関係が変わる
    const signX = corner.includes('l') ? 1 : -1;
    const signY = corner.includes('b') ? -1 : 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = guideState.bubbleW;
    const startH = guideState.chatH;
    // 上限は「画面に収まる範囲」まで（キャラや余白のぶんだけ引く）
    const maxW = window.innerWidth - 140;
    const maxH = window.innerHeight - 150;

    const onMove = ev => {
      if (dirX) {
        guideState.bubbleW = clamp(startW + signX * (ev.clientX - startX), 200, maxW);
        guideEl.style.setProperty('--bubble-w', `${guideState.bubbleW}px`);
      }
      if (dirY) {
        guideState.chatH = clamp(startH + signY * (ev.clientY - startY), 80, maxH);
        guideEl.style.setProperty('--chat-h', `${guideState.chatH}px`);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      document.body.classList.remove('guide-resizing');
      applyGuideState(); // 確定したサイズを保存
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    document.body.classList.add('guide-resizing');
  };

  guideEl.querySelector('.guide-resize-x').addEventListener('pointerdown', e => startResize(e, true, false));
  guideEl.querySelector('.guide-resize-y').addEventListener('pointerdown', e => startResize(e, false, true));
  guideEl.querySelector('.guide-resize-xy').addEventListener('pointerdown', e => startResize(e, true, true));

  // ×ボタンでも非表示にできる
  guideEl.querySelector('.guide-close').addEventListener('click', () => {
    guideState.hidden = true;
    guideEl.classList.remove('menu-open');
    applyGuideState();
  });

  // 非表示中は小さなボタンが残り、クリックで再表示
  restoreEl.addEventListener('click', () => {
    guideState.hidden = false;
    applyGuideState();
  });

  // 場所移動モード中のクリックで移動を確定
  // （capture指定なので「場所を移動」を押したクリック自体には反応しない）
  document.addEventListener(
    'click',
    e => {
      if (!placing) return;
      e.preventDefault();
      e.stopPropagation();
      stopPlacing();
      placeAt(e.clientX, e.clientY);
    },
    { capture: true }
  );

  document.addEventListener('keydown', e => {
    if (placing && e.key === 'Escape') {
      stopPlacing();
    }
  });

  // メニューの外を押したら閉じる
  // （clickではなくpointerdownで判定し、キャラのクリックと競合しないようにする）
  document.addEventListener('pointerdown', e => {
    if (!guideEl.contains(e.target)) {
      guideEl.classList.remove('menu-open');
    }
  });

  applyGuideState();
};

const updateGuide = id => {
  if (!guideText || id === lastGuideId || !(id in guideMessages)) return;
  lastGuideId = id;
  guideText.textContent = guideMessages[id];
  guideText.classList.remove('pop');
  // アニメーションを再生し直すためリフローを挟む
  void guideText.offsetWidth;
  guideText.classList.add('pop');
};

// ---- スクロール連動（ナビ強調・実績・案内キャラ） ----
const setActiveLink = () => {
  const scrollY = window.scrollY + 140;
  let currentId = '';

  for (const section of sections) {
    if (scrollY >= section.offsetTop) {
      currentId = section.id;
    }
  }

  // ページ最下部までスクロールしたら、最後のセクション（Contact）を必ずアクティブにする
  // （Contactが短いと通常の判定では届かないことがあるため）
  const atBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (atBottom && sections.length > 0) {
    currentId = sections[sections.length - 1].id;
  }

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
  });

  if (currentId in achievements) {
    unlockAchievement(currentId);
  }
  updateGuide(currentId);
};

window.addEventListener('scroll', setActiveLink);
window.addEventListener('load', () => {
  createGuide();
  setActiveLink();
  setupFileLinks();
});

// スクロールに合わせてカード類をふわっと表示する演出
// （reduced-motion設定時と非対応ブラウザでは何もしない＝常に表示）
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealTargets = document.querySelectorAll(
    '.section-heading, .card, .work-detail, .featured-card, .proposal-card, .skill-card, .contact-card, .thinking-box'
  );

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });

  revealTargets.forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}
