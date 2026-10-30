const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');

const output = path.join(__dirname, '../launcher/test-output/portfolio');
const url = process.env.PORTFOLIO_TEST_URL || pathToFileURL(path.join(__dirname, '../index.html')).href;
const recordedGames = ['line-boundary', 'hanten-assassination', 'teruteru-wars', 'futago'];
let browser;

test('Sanshoku uses its existing icon and both unityroom games have direct play links', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url);
    const game = page.locator('#game-sanshoku-bunki');
    assert.equal(await game.count(), 1);
    assert.equal(await page.locator('#game-sliding-space-parking').count(), 1);
    const text = await game.innerText();
    for (const value of ['制作人数：5人', 'プランナー', '企画立案', 'システム・ルール設計', 'タスク振り分け', '画像・SEの用意']) assert(text.includes(value));
    for (const [id, target] of [
      ['sanshoku-bunki', 'https://unityroom.com/games/sansyokunobunkigakari'],
      ['sliding-space-parking', 'https://unityroom.com/games/sliding-space-parking'],
    ]) {
      const link = page.locator(`#game-${id} .work-play-link`);
      assert.equal(await link.getAttribute('href'), target);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noopener/);
      // Verify the click destination without loading the third-party game during regression tests.
      await page.context().route(target, route => route.fulfill({ contentType: 'text/html', body: '<title>Destination</title>' }));
      const opened = page.waitForEvent('popup');
      await link.click();
      const popup = await opened;
      await popup.waitForLoadState();
      assert.equal(popup.url(), target);
      await popup.close();
    }
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await game.scrollIntoViewIfNeeded();
      await game.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      await game.screenshot({ path: path.join(output, `sanshoku-bunki-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
  } finally { await page.close(); }
});

before(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
});
after(async () => { await browser?.close(); });

test('V-Link offers both editions with explicit limits and responsive explanations', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url);
    const section = page.locator('#featured-works');
    assert.equal(await section.locator('.work-play-link').getAttribute('href'), 'https://kuon-haruto.github.io/portfolio/play/v-link-battle/');
    assert.equal(await section.locator('.vlink-windows-link').getAttribute('href'), 'https://github.com/kuon-haruto/portfolio/releases/download/launcher-v0.2.0/v-link-battle-1.0.0.zip');
    assert.equal(await section.locator('.vlink-play-actions a[href="#featured-video"]').count(), 1);
    const copy = await section.locator('.vlink-editions').innerText();
    for (const phrase of ['セキュリティ方針', '約724 MB', '未署名', '通信・読み込み', '疑似ウィンドウ', '再現していません', '簡易表示', '完全な表示一致を保証するものではありません']) assert(copy.includes(phrase), phrase);
    for (const link of await section.locator('.vlink-play-actions a[aria-describedby]').all()) {
      const id = await link.getAttribute('aria-describedby');
      assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
    }
    // Block the archive request: this checks the destination without downloading an executable.
    const downloadUrl = await section.locator('.vlink-windows-link').getAttribute('href');
    let requested = false;
    await page.route(downloadUrl, route => { requested = true; return route.abort(); });
    await section.locator('.vlink-windows-link').click();
    assert(requested);
    await page.goto(url);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await section.locator('.vlink-editions').scrollIntoViewIfNeeded();
      const overflow = await section.evaluate(el => [...el.querySelectorAll('.vlink-editions, .vlink-editions *, .vlink-play-actions a')].filter(node => {
        const box = node.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1;
      }).map(node => node.tagName));
      assert.deepEqual(overflow, [], `width ${width}`);
      if ([320, 1440].includes(width)) await section.locator('.vlink-editions').screenshot({ path: path.join(output, `vlink-editions-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
  } finally { await page.close(); }
});

test('proposals identify developed games without inventing a development environment for paper concepts', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url + '#proposals');
    const cards = page.locator('#proposals .proposal-card');
    assert.equal(await cards.count(), 10);
    const icons = ['v-link-battle.png', 'sliding-space-parking.png', 'sanshoku-bunki.png', 'line-boundary.png', 'hanten-assassination.jpeg', 'teruteru-wars.png', 'futago.png', null, null, 'bug-hunter.png'];
    for (let i = 0; i < icons.length; i++) {
      const card = cards.nth(i);
      const title = card.locator('h3');
      assert(await title.innerText());
      if (icons[i]) {
        assert.equal(await title.locator('img').getAttribute('src'), 'files/game-icons/' + icons[i]);
        assert.match(await card.locator('.meta').innerText(), i === 0 ? /開発環境：Unity/ : /開発環境：Unity 6/);
      } else {
        assert.equal(await title.locator('img').count(), 0);
        assert.equal(await card.locator('.meta').innerText(), '企画書のみ');
        assert.doesNotMatch(await card.innerText(), /Unity/);
      }
      assert.equal(await card.locator('a[href$=".pdf"]').count(), 1);
      assert.equal(await card.locator('a[data-missing]').count(), 0);
      if (i < 3) {
        const pdfLink = card.locator('a[href$=".pdf"]');
        const href = await pdfLink.getAttribute('href');
        const opened = page.waitForEvent('popup');
        await pdfLink.click();
        const popup = await opened;
        await popup.waitForURL(target => target.href.endsWith(href));
        await popup.waitForLoadState();
        assert(popup.url().endsWith(href), popup.url());
        await popup.close();
        const pptx = card.locator('a[href$=".pptx"]');
        assert.equal(await pptx.count(), 1);
        assert.notEqual(await pptx.getAttribute('download'), null);
        await fs.access(path.join(__dirname, '..', await pptx.getAttribute('href')));
        await fs.access(path.join(__dirname, '..', await card.locator('a[href$=".pdf"]').getAttribute('href')));
        assert.match(await card.innerText(), /制作人数：[845]人/);
      }
    }
    const bug = page.locator('#proposal-bug-hunter');
    const items = await bug.locator('li').allTextContents();
    assert.equal(items.length, 3);
    assert.match(items[0], /^コンセプト：/);
    assert.match(items[1], /^ターゲット：/);
    assert.match(items[2], /^特徴：/);
    for (const feature of ['個体差', '指示式', '転倒', '起き上がるまで無防備', '運']) assert(items[2].includes(feature));
    assert.doesNotMatch(await bug.innerText(), /探索：|育成：|対戦：/);
    assert.equal(await bug.locator('.meta').innerText(), '開発環境：Unity 6');
    assert.doesNotMatch(await page.locator('body').innerText(), /試作|プロトタイプ/);
    assert.equal(await bug.locator('a').count(), 1);
    assert.equal(await bug.locator('a').getAttribute('href'), 'files/mushi-shooting.pdf');
    assert.doesNotMatch(await bug.innerText(), /ブラウザー?でプレイ/);
    assert.equal(await page.locator('#game-bug-hunter .work-play-link').getAttribute('href'), 'https://kuon-haruto.github.io/portfolio/play/bug-hunter/');
  } finally { await page.close(); }
});

test('proposal headings, icons and text fit phone and desktop layouts', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#proposals');
      const cards = page.locator('#proposals .proposal-card');
      for (const card of await cards.all()) {
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const bounds = await card.evaluate(card => {
          const heading = card.querySelector('h3');
          const image = heading.querySelector('img');
          const box = card.getBoundingClientRect();
          const h = heading.getBoundingClientRect();
          const title = heading.querySelector('span').getBoundingClientRect();
          const icon = image?.getBoundingClientRect();
          return { overflow: card.scrollWidth > card.clientWidth,
            contained: [...card.querySelectorAll('h3, h3 span, h3 img, .tag')].every(element => {
              const r = element.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            }),
            iconLoaded: !image || image.naturalWidth > 0,
            separated: !icon || icon.right + 10 <= title.left,
            headingAboveMeta: h.bottom <= card.querySelector('.meta').getBoundingClientRect().top,
            iconSize: icon ? [icon.width, icon.height] : null };
        });
        assert.equal(bounds.overflow, false, `${width}px: ${JSON.stringify(bounds)}`);
        assert(bounds.contained && bounds.iconLoaded && bounds.separated && bounds.headingAboveMeta, `${width}px: ${JSON.stringify(bounds)}`);
        if (bounds.iconSize) assert.deepEqual(bounds.iconSize, [64, 64]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if ([320, 1440].includes(width)) {
        await page.locator('#proposals').screenshot({ path: path.join(output, `proposals-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
        await page.locator('#proposal-bug-hunter').screenshot({ path: path.join(output, `bug-hunter-proposal-${width}.png`), animations: 'disabled' });
        await cards.first().screenshot({ path: path.join(output, `vlink-proposal-${width}.png`), animations: 'disabled' });
      }
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('new work cards show verified production details and playable destinations', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url + '#works');
    assert.equal(await page.locator('#works .work-detail').count(), 7);
    const bug = page.locator('#works #game-bug-hunter');
    assert.equal(await bug.locator('h3').innerText(), 'バグハンター');
    assert.equal(await bug.locator('.work-play-link').getAttribute('href'), 'https://kuon-haruto.github.io/portfolio/play/bug-hunter/');
    for (const feature of ['個体差', '指示式', '転倒', '無防備', '運']) assert((await bug.innerText()).includes(feature));
    const parking = page.locator('#works #game-sliding-space-parking');
    assert.equal(await parking.locator('h3').innerText(), 'すべる宇宙駐車場');
    const metadata = await parking.locator('.meta').innerText();
    for (const detail of ['開発環境：Unity 6', '制作人数：4人', '担当：企画立案 / 整理 / 画像作成 / SE']) assert(metadata.includes(detail));
    for (const [id, count] of [['line-boundary', 4], ['hanten-assassination', 4], ['teruteru-wars', 4], ['futago', 6], ['bug-hunter', 1], ['sliding-space-parking', 4]]) {
      assert((await page.locator(`#game-${id} .meta`).innerText()).includes(`制作人数：${count}人`));
    }
    assert.equal(await parking.locator('.work-play-link').getAttribute('href'), 'https://unityroom.com/games/sliding-space-parking');
    assert.equal(await parking.locator('.work-play-link').innerText(), 'すべる宇宙駐車場をプレイ');
    assert.match(await parking.locator('.work-play-link').getAttribute('rel'), /noopener/);
    assert.doesNotMatch(await page.locator('body').innerText(), /試作|プロトタイプ/);
  } finally { await page.close(); }
});

test('all work media, titles and tags fit mobile and desktop widths', async () => {
  const page = await browser.newPage();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#game-bug-hunter');
      for (const id of [...recordedGames.map(id => 'game-' + id), 'game-bug-hunter', 'game-sliding-space-parking']) {
        const card = page.locator('#' + id);
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const bounds = await card.evaluate(card => {
          const box = card.getBoundingClientRect();
          const icon = card.querySelector('h3 img').getBoundingClientRect();
          const title = card.querySelector('h3 span').getBoundingClientRect();
          const preview = card.querySelector('.work-game-preview');
          return {
            overflow: card.scrollWidth > card.clientWidth,
            contained: [...card.querySelectorAll('h3, h3 span, img, video, .tag, .work-play-link')].every(element => {
              const r = element.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            }),
            separated: icon.right + 10 <= title.left,
            imageLoaded: [...card.querySelectorAll('img')].every(image => image.naturalWidth > 0),
            previewRatio: preview.clientWidth / preview.clientHeight,
          };
        });
        assert(!bounds.overflow && bounds.contained && bounds.separated && bounds.imageLoaded, `${id} at ${width}: ${JSON.stringify(bounds)}`);
        assert(Math.abs(bounds.previewRatio - 16 / 9) < 0.02);
        const maxButtonHeight = id === 'game-line-boundary' ? 88 : 60;
        assert((await card.locator('.work-play-link').boundingBox()).height <= maxButtonHeight, `${id}: play button should not break mid-word at ${width}px`);
        if ([320, 1440].includes(width)) {
          await card.screenshot({ path: path.join(output, `${id}-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
        }
      }
      const featured = page.locator('#featured-works .case-game-heading');
      await featured.scrollIntoViewIfNeeded();
      await featured.locator('img').evaluate(image => image.decode());
      assert(await featured.evaluate(heading => {
        const box = heading.getBoundingClientRect();
        const icon = heading.querySelector('img').getBoundingClientRect();
        const title = heading.querySelector('span').getBoundingClientRect();
        return heading.scrollWidth <= heading.clientWidth && icon.right + 10 <= title.left && title.right <= box.right;
      }), `V-Link heading should fit at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
  } finally { await page.close(); }
});

test('recorded previews use matching icons and posters, play correctly and do not download before play', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(url + '#works');
    assert.equal(await page.locator('#works video.work-game-preview').count(), 4);
    assert(!requests.some(url => url.includes('/files/videos/')), 'Previews should not download before play');
    for (const id of recordedGames) {
      const card = page.locator('#game-' + id);
      const extension = id === 'hanten-assassination' ? 'jpeg' : 'png';
      assert.equal(await card.locator('h3 img').getAttribute('src'), `files/game-icons/${id}.${extension}`);
      const video = card.locator('video');
      assert.equal(await video.getAttribute('preload'), 'none');
      assert.equal(await video.getAttribute('autoplay'), null);
      assert.equal(await video.getAttribute('poster'), `files/images/${id}-gameplay.png`);
      assert.equal(await video.locator('source').getAttribute('src'), `files/videos/${id}.mp4`);
      await video.scrollIntoViewIfNeeded();
      const info = await video.evaluate(async video => {
        await new Promise((resolve, reject) => {
          const poster = new Image();
          poster.onload = resolve;
          poster.onerror = () => reject(new Error('Poster did not load'));
          poster.src = video.poster;
        });
        video.muted = true;
        await video.play();
        return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, controls: video.controls, inline: video.playsInline };
      });
      assert.equal(info.width, 960);
      assert.equal(info.height, 540);
      assert(info.duration > 4 && info.duration < 90 && info.controls && info.inline, JSON.stringify(info));
      await page.waitForFunction(id => document.querySelector(`#game-${id} video`).currentTime > 0.1, id);
      await video.evaluate(video => { video.pause(); video.controls = false; });
      const frames = [];
      for (const time of [0.5, info.duration - 1]) {
        await video.evaluate((video, time) => new Promise(resolve => {
          video.addEventListener('seeked', resolve, { once: true });
          video.currentTime = time;
        }), time);
        frames.push(PNG.sync.read(await video.screenshot()));
      }
      let changed = 0;
      let light = 0;
      for (let i = 0; i < frames[0].data.length; i += 16) {
        if (Math.abs(frames[0].data[i] - frames[1].data[i]) + Math.abs(frames[0].data[i + 1] - frames[1].data[i + 1]) + Math.abs(frames[0].data[i + 2] - frames[1].data[i + 2]) > 40) changed++;
        if (frames[1].data[i] + frames[1].data[i + 1] + frames[1].data[i + 2] > 90) light++;
      }
      const samples = frames[0].data.length / 16;
      assert(light / samples > 0.05, `${id}: blank video`);
      assert(changed / samples > 0.001, `${id}: video should show actual gameplay changes`);
      await video.evaluate(video => { video.controls = true; });
    }
    assert.equal(await page.locator('#featured-works .case-game-heading img').getAttribute('src'), 'files/game-icons/v-link-battle.png');
    assert.equal(await page.locator('#featured-video video source').first().getAttribute('src'), 'files/Vlinkvideo.mp4');
  } finally { await page.close(); }
});

test('eight upright icons auto-orbit even with reduced motion and retain pause and keyboard access', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url);
    const gallery = page.locator('[data-game-gallery]');
    const group = gallery.locator('.game-gallery-group');
    assert.equal(await group.locator('a').count(), 8);
    assert.equal(await page.locator('.game-gallery-copy').count(), 0);
    for (const id of ['game-bug-hunter', 'featured-parking']) {
      assert.equal(await group.locator(`a[href="#${id}"]`).count(), 1);
      assert.equal(await page.locator(`#${id}`).count(), 1);
    }
    await group.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.waitForFunction(() => document.querySelector('[data-game-gallery]').classList.contains('is-orbit'));
    const first = group.locator('li').first();
    const before = await first.getAttribute('style');
    await page.waitForFunction(previous => document.querySelector('.game-gallery-group li').getAttribute('style') !== previous, before);
    assert.equal(await group.locator('img').evaluateAll(images => images.every(image => getComputedStyle(image).animationName === 'none')), true);
    await gallery.locator('.gallery-toggle').click();
    assert.equal(await gallery.locator('.gallery-toggle').getAttribute('aria-label'), '自動巡回を再開');
    const paused = await first.getAttribute('style');
    await page.waitForTimeout(180);
    assert.equal(await first.getAttribute('style'), paused);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await gallery.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      const sizes = await group.locator('.is-in-orbit img').evaluateAll(images => images.map(image => {
        const rect = image.getBoundingClientRect();
        return { width: rect.width, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }));
      assert(Math.max(...sizes.map(rect => rect.width)) / Math.min(...sizes.map(rect => rect.width)) > 1.1, 'perspective size difference');
      assert(sizes.length >= (width <= 640 ? 2 : 4) && sizes.length <= (width <= 640 ? 3 : 5), `visible window at ${width}`);
      const rear = await group.locator('.is-rear-orbit').evaluateAll(items => items.map(item => ({
        opacity: Number(getComputedStyle(item).opacity),
        blur: parseFloat(item.style.getPropertyValue('--orbit-blur')),
        width: item.querySelector('img').getBoundingClientRect().width,
        titleOpacity: getComputedStyle(item.querySelector('a > span:last-child')).opacity,
        layer: Number(item.style.zIndex),
      })));
      assert(rear.length >= 2, `rear works remain visible at ${width}`);
      for (const item of rear) {
        assert(item.opacity > 0 && item.opacity <= 0.42);
        assert(item.blur >= 3);
        assert(item.width < Math.max(...sizes.map(rect => rect.width)));
        assert.equal(item.titleOpacity, '0');
        assert(item.layer < 70);
      }
      assert.equal(Math.round((await gallery.boundingBox()).width), width, 'full-width carousel');
      const fits = await gallery.evaluate(el => {
        const viewport = el.querySelector('.game-gallery-viewport').getBoundingClientRect();
        return [...el.querySelectorAll('.is-front .game-icon-art, .is-front .game-icon-link > span:last-child')].every(node => {
          const box = node.getBoundingClientRect();
          return box.left >= viewport.left - 1 && box.right <= viewport.right + 1 && box.top >= viewport.top - 1 && box.bottom <= viewport.bottom + 1;
        });
      });
      assert(fits, `icons and visible name must fit the orbit at ${width}`);
      const painted = await gallery.locator('canvas').evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count++;
        return count;
      });
      assert(painted > 200, 'orbit canvas must not be blank');
      await gallery.screenshot({ path: path.join(output, `gallery-3d-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
    await gallery.locator('.gallery-toggle').click();
    await page.waitForFunction(previous => document.querySelector('.game-gallery-group li').getAttribute('style') !== previous, paused);
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion });
      const previous = await first.getAttribute('style');
      await page.waitForFunction(value => document.querySelector('.game-gallery-group li').getAttribute('style') !== value, previous);
      assert.equal(await gallery.evaluate(el => el.classList.contains('is-paused')), false);
    }
    await gallery.locator('.gallery-toggle').focus();
    await page.keyboard.press('Tab');
    assert.equal(await gallery.evaluate(el => el.classList.contains('is-orbit')), false);
    assert.equal(await group.locator('a').first().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => location.hash), '#game-sanshoku-bunki');
  } finally { await page.close(); }
});

test('3D carousel stays framed through a full lap on desktop and mobile', async () => {
  const page = await browser.newPage();
  try {
    await page.clock.install();
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('[data-game-gallery]').classList.contains('is-orbit'));
    const frontNames = new Set();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('[data-game-gallery]').scrollIntoViewIfNeeded();
      for (let step = 0; step < 16; step++) {
        await page.clock.runFor(2100);
        const state = await page.locator('[data-game-gallery]').evaluate(el => {
          const viewport = el.querySelector('.game-gallery-viewport').getBoundingClientRect();
          const visible = [...el.querySelectorAll('.is-front .game-icon-art, .is-front .game-icon-link > span:last-child')];
          return {
            front: el.querySelector('.is-front a').title,
            visibleCount: el.querySelectorAll('.is-in-orbit').length,
            rearCount: el.querySelectorAll('.is-rear-orbit').length,
            clipped: visible.filter(node => {
              const box = node.getBoundingClientRect();
              return box.left < viewport.left - 1 || box.right > viewport.right + 1 || box.top < viewport.top - 1 || box.bottom > viewport.bottom + 1;
            }).map(node => node.tagName),
          };
        });
        assert.deepEqual(state.clipped, [], `width ${width}, step ${step}`);
        assert(state.visibleCount <= (width <= 640 ? 3 : 5), `too many icons at ${width}`);
        assert(state.rearCount >= 2, 'rear works must keep circulating');
        frontNames.add(state.front);
      }
    }
    assert.equal(frontNames.size, 8);
  } finally { await page.close(); }
});

test('expanded carousel keeps five visible slots and large icons with sixteen works', async () => {
  const fixture = path.join(output, 'gallery-expanded.html');
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    let html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
    html = html.replace('<head>', `<head><base href="${pathToFileURL(path.join(__dirname, '../')).href}">`);
    html = html.replace(/(<ul class="game-gallery-group">)([\s\S]*?)(<\/ul>)/, (_, start, body, end) => {
      const entries = body.match(/<li>[\s\S]*?<\/li>/g);
      return start + Array.from({ length: 16 }, (_, i) => entries[i % entries.length].replace(/<span>([^<]*)<\/span><\/a>/, `<span>作品${i + 1}</span></a>`)).join('') + end;
    });
    await fs.writeFile(fixture, html);
    await page.clock.install();
    await page.goto(pathToFileURL(fixture).href);
    await page.waitForFunction(() => document.querySelector('[data-game-gallery]').classList.contains('is-orbit'));
    assert.equal(await page.locator('.game-gallery-heading strong').innerText(), '16');
    const seen = new Set();
    for (let step = 0; step < 16; step++) {
      await page.clock.runFor(4200);
      const state = await page.locator('[data-game-gallery]').evaluate(el => ({
        count: el.querySelectorAll('.is-in-orbit').length,
        front: el.querySelector('.is-front a').title,
        size: el.querySelector('.is-front img').getBoundingClientRect().width,
      }));
      assert(state.count >= 4 && state.count <= 5);
      assert(state.size > 230, 'future works must not shrink existing icons');
      seen.add(state.front);
    }
    assert.equal(seen.size, 16);
  } finally { await page.close(); await fs.rm(fixture, { force: true }); }
});

test('tool icons use valid PNGs and preserve their brand colors', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(url + '#skills');
    const icons = page.locator('#skills .app-icon');
    assert.equal(await icons.count(), 15);
    const sources = await icons.evaluateAll(images => [...new Set(images.map(image => image.getAttribute('src')))]);
    assert.equal(sources.length, 8);
    for (const source of sources) {
      assert(source.endsWith('.png'));
      const png = PNG.sync.read(await fs.readFile(path.join(__dirname, '..', source)));
      assert.equal(png.width, 256);
      let visible = 0;
      let colored = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b, a] = png.data.subarray(i, i + 4);
        if (a > 128 && Math.min(r, g, b) < 200) visible++;
        if (a > 128 && Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
      }
      assert(visible > 1000, `${source} is blank`);
      if (!/\/(unity|unrealengine)\.png$/.test(source)) assert(colored > 1000, `${source} lost its color`);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await icons.evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('.tool-bars').screenshot({ path: path.join(output, `tool-colors-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
  } finally { await page.close(); }
});

test('profile panels have consistent borders on phone and desktop', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#about');
      const panels = page.locator('#about .profile-panel, #about .strengths-grid article');
      const borders = await panels.evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return ['Top', 'Right', 'Bottom', 'Left'].map(side => ({
          width: style[`border${side}Width`], color: style[`border${side}Color`], style: style[`border${side}Style`]
        }));
      }));
      assert.equal(borders.length, 7);
      for (const edges of borders) for (const edge of edges) {
        assert.equal(edge.width, '1px');
        assert.equal(edge.style, 'solid');
        assert.equal(edge.color, borders[0][0].color);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#about .profile-story').screenshot({ path: path.join(output, `profile-borders-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
  } finally { await page.close(); }
});

test('student strengths describe self-study, specifications and completed team work', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#about');
      const strengths = page.locator('#about .strengths-grid');
      assert.equal(await strengths.locator('article').count(), 3);
      assert.match(await strengths.innerText(), /自分で学び、柔軟に考える/);
      assert.match(await strengths.innerText(), /仕様書を作った経験/);
      assert.match(await strengths.innerText(), /仲間と完成させた経験/);
      assert.match(await strengths.innerText(), /プランナーの役割を一人で担い/);
      assert.match(await strengths.innerText(), /状況に合わせて企画を見直す/);
      assert.doesNotMatch(await page.locator('#about').innerText(), /主体性と完遂力/);
      assert(await strengths.locator('article').evaluateAll(cards => cards.every(card =>
        [...card.querySelectorAll('h3, p')].every(element => element.scrollWidth <= element.clientWidth + 1)
      )));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width !== 320) await strengths.screenshot({ path: path.join(output, `student-strengths-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
    }
  } finally { await page.close(); }
});

test('App Store release is a leading featured work with original assets and mobile-safe links', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '#featured-parking');
      const featured = page.locator('#featured-parking');
      assert.equal(await page.locator('.case-section').count(), 2);
      assert(await page.evaluate(() => {
        const sections = [...document.querySelectorAll('main > section')].map(section => section.id);
        return sections.indexOf('featured-parking') < sections.indexOf('featured-works') && sections.indexOf('featured-works') < sections.indexOf('about');
      }));
      assert.equal(await featured.locator('.app-store-link').getAttribute('href'), 'https://apps.apple.com/jp/app/id6816609277');
      assert.match(await featured.locator('.app-store-link').getAttribute('rel'), /noopener/);
      assert.match(await featured.innerText(), /2026年10月7日/);
      assert.match(await featured.locator('.case-role').innerText(), /制作人数：4人/);
      assert.equal(await featured.locator('h2 img').getAttribute('src'), 'files/game-icons/sliding-space-parking.png');
      await featured.scrollIntoViewIfNeeded();
      await featured.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert(await featured.evaluate(section => {
        const box = section.getBoundingClientRect();
        return [...section.querySelectorAll('h2, img, .button, .selection-note')].every(element => {
          const r = element.getBoundingClientRect();
          return r.left >= box.left && r.right <= box.right && element.scrollWidth <= element.clientWidth + 1;
        });
      }), `Featured release overflows at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if ([390, 1440].includes(width)) {
        await featured.screenshot({ path: path.join(output, `featured-parking-${width}.png`), animations: 'disabled', style: '.site-header { visibility: hidden !important; }' });
      }
    }
  } finally { await page.close(); }
});
