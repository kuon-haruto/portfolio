const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Pass the canonical game-idea folder as the first argument.');
  const root = path.resolve(__dirname, '..');
  const records = JSON.parse(await fs.readFile(path.join(root, 'src/idea-catalog.json'), 'utf8'));
  const extra = {
    'closing-check': ['閉店確認', '素材', '店内イメージ.png'],
    'home-on-a-giant': ['巨獣と旅する家', '素材', '共闘の画面イメージ.png'],
    'adventurers-shop': ['冒険者ショップ', '素材', 'ポーション制作画面.png'],
  };
  const output = path.join(root, 'files/idea-images');
  await fs.mkdir(output, { recursive: true });
  let bytes = 0;
  for (const record of records.filter(item => item.image)) {
    const input = extra[record.id]
      ? path.join(source, ...extra[record.id])
      : path.join(source, '共有ページ/dist/assets', record.sourceId, 'screen.png');
    const info = await sharp(input).rotate().resize({ width: 960, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toFile(path.join(output, `${record.id}.webp`));
    bytes += info.size;
  }
  console.log(`${records.filter(item => item.image).length} images, ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
