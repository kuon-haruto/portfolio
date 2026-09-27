const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../launcher/node_modules/playwright');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');
const { createServer } = require('../tools/web-test-server.cjs');
const games = require('../play/games.json').games;
const output = path.join(__dirname, '../launcher/test-output/web');

(async () => {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = process.env.WEB_TEST_URL || `http://127.0.0.1:${server.address().port}/play/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  try {
    const cdp = await browser.newBrowserCDPSession();
    // A raw target avoids Playwright's focus emulation, which suppresses native fullscreen.
    // No window maximization, kiosk flags or fullscreen CDP commands are used.
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', newWindow: true });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: false });
    let id = 0;
    const pending = new Map();
    cdp.on('Target.receivedMessageFromTarget', event => {
      const message = JSON.parse(event.message);
      if (event.sessionId === sessionId && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error('CDP timeout: '+method)); }, 30000);
      pending.set(requestId, result => { clearTimeout(timeout); result.error ? reject(Error(JSON.stringify(result.error))) : resolve(result.result); });
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: requestId, method, params }) }).catch(reject);
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (expression, timeout = 20000) => {
      const start = Date.now();
      while (Date.now()-start<timeout) {
        if (await evaluate(expression)) return;
        await new Promise(r => setTimeout(r, 250));
      }
      throw Error('Wait timed out: '+expression);
    };
    const click = async selector => {
      const point = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    };
    await fs.mkdir(output, { recursive: true });
    const results = [];
    for (const game of games) {
      if (process.env.WEB_TEST_GAME && game.id !== process.env.WEB_TEST_GAME) continue;
      await send('Page.navigate', { url: new URL(game.id+'/', base).href });
      await cdp.send('Target.activateTarget', { targetId });
      await wait("['ready','error'].includes(document.querySelector('#player-stage')?.dataset.state)", 180000);
      assert.equal(await evaluate("document.querySelector('#player-stage').dataset.state"), 'ready');
      await click('#start-fullscreen');
      await wait("document.fullscreenElement?.id === 'player-stage' && innerHeight === screen.height");
      const { bounds } = await cdp.send('Browser.getWindowForTarget', { targetId });
      assert.equal(bounds.windowState, 'fullscreen');
      const geometry = await evaluate("(() => { const r=document.querySelector('canvas').getBoundingClientRect(); return {width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height,availableHeight:screen.availHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom,canvasWidth:r.width,canvasHeight:r.height}; })()");
      assert.equal(geometry.width, geometry.screenWidth);
      assert.equal(geometry.height, geometry.screenHeight);
      assert(geometry.x>=-.1 && geometry.y>=-.1 && geometry.right<=geometry.width+.1 && geometry.bottom<=geometry.height+.1);
      if (!game.responsiveCanvas) assert(Math.abs(geometry.canvasWidth/geometry.canvasHeight-16/9)<.01);
      await new Promise(r=>setTimeout(r, 5000));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const bytes = Buffer.from(shot.data, 'base64');
      const png = PNG.sync.read(bytes), colors = new Set();
      for(let n=0;n<png.data.length;n+=64) colors.add(`${png.data[n]>>4},${png.data[n+1]>>4},${png.data[n+2]>>4}`);
      assert(colors.size>40, game.id+' blank');
      await fs.writeFile(path.join(output, game.id+'-native-fullscreen.png'), bytes);
      await send('Input.dispatchMouseEvent', { type:'mouseMoved', x:geometry.width/2,y:12 });
      await click('#exit-fullscreen');
      await wait('!document.fullscreenElement');
      await click('#fullscreen');
      await wait("document.fullscreenElement?.id === 'player-stage' && innerHeight === screen.height");
      for(const type of ['keyDown','keyUp']) await send('Input.dispatchKeyEvent', {type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await wait('!document.fullscreenElement');
      results.push({game:game.id,windowState:bounds.windowState,...geometry,colors:colors.size});
      console.log(JSON.stringify(results.at(-1)));
    }
    await fs.writeFile(path.join(output,'native-fullscreen.json'),JSON.stringify(results,null,2));
  } finally {
    await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
