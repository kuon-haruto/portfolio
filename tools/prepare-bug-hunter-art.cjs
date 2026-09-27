const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('../launcher/node_modules/playwright');
const lucide = require('../launcher/node_modules/lucide');
const root = path.resolve(__dirname, '../games/bug-hunter/Assets/BugHunter/Resources');
const textures = [
  ['forest_floor', 'Ground', 'd67f308e4b8be6a65989e8dc76ec40fe'],
  ['forest_ground_04', 'Trail', '6ad9df4d731a238299806f739a26af83'],
  ['bark_brown_01', 'Bark', 'b6d5dcde10b7cd1b36d70cd33a34724a'],
];
function svg(node) {
  const [tag, attributes, children = []] = node;
  return `<${tag} ${Object.entries(attributes).map(([k,v]) => `${k}="${v}"`).join(' ')}>${children.map(svg).join('')}</${tag}>`;
}
(async () => {
  fs.mkdirSync(path.join(root, 'Environment'), {recursive:true});
  fs.mkdirSync(path.join(root, 'UI'), {recursive:true});
  for (const [asset, name, hash] of textures) {
    const file = path.join(root, 'Environment', name + '.jpg');
    if (fs.existsSync(file) && crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex') === hash) continue;
    const response = await fetch(`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${asset}/${asset}_diff_1k.jpg`);
    if (!response.ok) throw new Error(`Texture download: ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash('md5').update(data).digest('hex') !== hash) throw new Error('Texture checksum mismatch');
    fs.writeFileSync(file, data);
    console.log(name, data.length);
  }
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
    for (const name of ['Backpack','Swords','Shield','Zap','Leaf','Trophy','Pause','ArrowLeft','ChevronLeft','ChevronRight','Compass','Check','Search','Crosshair','Heart','Footprints','Play','X','Plus','ArrowUp','ArrowDown']) {
      const data = structuredClone(lucide[name]);
      data[1] = {...data[1], width:96, height:96, stroke:'#ffffff', 'stroke-width':1.6};
      await page.setContent(`<style>html,body{margin:0;background:transparent}body{width:128px;height:128px;display:grid;place-items:center}</style>${svg(data)}`);
      await page.screenshot({path:path.join(root,'UI',name+'.png'),omitBackground:true});
    }
  } finally { await browser.close(); }
})();
