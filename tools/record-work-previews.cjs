const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('./web-test-server.cjs');
const actions = require('../tests/web-game-actions.json');

const root = path.resolve(__dirname, '..');
const temporary = path.join(root, 'launcher/test-output/portfolio');
const output = path.join(root, 'files/videos');
const ids = ['line-boundary', 'hanten-assassination', 'teruteru-wars', 'futago'];

async function act(page, action) {
  const canvas = page.locator('canvas');
  if (action.key) {
    await canvas.focus();
    await page.keyboard.down(action.key);
    await page.waitForTimeout(action.milliseconds);
    await page.keyboard.up(action.key);
  } else {
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * action.x, y: box.height * action.y }, delay: 150 });
  }
  await page.waitForTimeout(action.wait ?? 1800);
}

async function main() {
  await fs.mkdir(temporary, { recursive: true });
  await fs.mkdir(output, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/play/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const id of ids) {
      if (process.env.PREVIEW_GAME && process.env.PREVIEW_GAME !== id) continue;
      const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
      try {
        await page.goto(base + id + '/');
        await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#player-stage').dataset.state), null, { timeout: 180000 });
        assert.equal(await page.locator('#player-stage').getAttribute('data-state'), 'ready');
        await page.locator('#start-fullscreen').click();
        await page.waitForFunction(() => document.fullscreenElement?.id === 'player-stage');
        await page.waitForTimeout(5000);
        const sequence = actions[id];
        const start = sequence.findIndex(action => ['stage-one', 'start-battle'].includes(action.name));
        for (const action of sequence.slice(0, start + 1)) await act(page, action);

        // Record only the real game canvas, excluding the browser/player toolbar.
        await page.evaluate(() => {
          const stream = document.querySelector('canvas').captureStream(24);
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1800000 });
          const chunks = [];
          window.workPreview = { recorder, done: new Promise(resolve => {
            recorder.ondataavailable = event => chunks.push(event.data);
            recorder.onstop = async () => {
              stream.getTracks().forEach(track => track.stop());
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result.split(',')[1]);
              reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
            };
          }) };
          recorder.start(1000);
        });
        for (const action of sequence.slice(start + 1)) await act(page, action);
        await page.waitForTimeout(2500);
        const screenshot = await page.locator('canvas').screenshot();
        const pixels = PNG.sync.read(screenshot);
        const colors = new Set();
        for (let i = 0; i < pixels.data.length; i += 64) colors.add(`${pixels.data[i] >> 4},${pixels.data[i + 1] >> 4},${pixels.data[i + 2] >> 4}`);
        assert(colors.size > 20, `${id}: blank canvas`);
        await fs.writeFile(path.join(root, `files/images/${id}-gameplay.png`), screenshot);
        const encoded = await page.evaluate(async () => {
          window.workPreview.recorder.stop();
          return await window.workPreview.done;
        });
        const raw = path.join(temporary, `${id}-recording.webm`);
        await fs.writeFile(raw, Buffer.from(encoded, 'base64'));
        execFileSync(process.env.FFMPEG || 'ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
          '-vf', 'scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart', '-an', path.join(output, `${id}.mp4`),
        ]);
        await fs.unlink(raw);
        console.log(JSON.stringify({ game: id, colors: colors.size, bytes: (await fs.stat(path.join(output, `${id}.mp4`))).size }));
      } finally { await page.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
