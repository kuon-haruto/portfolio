const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');

async function prepare() {
  const source = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'bug-hunter-web'));
  const files = await fs.readdir(path.join(source, 'Build'));
  const find = suffix => {
    const found = files.filter(file => file.endsWith(suffix));
    if (found.length !== 1) throw new Error(`Expected one ${suffix}, got ${found.length}`);
    return found[0];
  };
  const folder = 'builds/bug-hunter/v1';
  const destination = path.join(root, 'play', folder, 'Build');
  await fs.mkdir(destination, { recursive: true });
  const integrity = [];
  for (const file of files) {
    if (!/^[a-f0-9]{32}\.(loader\.js|data\.unityweb|framework\.js\.unityweb|wasm\.unityweb)$/.test(file)) continue;
    const bytes = await fs.readFile(path.join(source, 'Build', file));
    if (bytes.length >= 100 * 1024 ** 2) throw new Error('Build unexpectedly exceeds GitHub file limit');
    await fs.writeFile(path.join(destination, file), bytes);
    integrity.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const game = {
    id: 'bug-hunter', title: 'バグハンター', genre: '3D昆虫探索・育成 / 指示式バトル',
    description: '樹皮・草むら・水辺に暮らす6種類の虫を探して捕獲。個体差を見比べて育て、接近・回り込み・後退が交差する森の大会へ。体勢・疲労・転倒が勝負を左右するUnity製プロトタイプです。',
    objective: '虫を捕まえ、パートナーを選んで育成し、3連戦の森の大会で優勝する。',
    metadataLabel: 'Unity 6 / プレイ可能なプロトタイプ',
    howToPlay: [
      '探索：W / A / S / Dで移動、右ドラッグで見回します。縦画面では方向ボタンでも操作できます。木の幹や草の葉、水辺を探してみてください。',
      '近くの虫に狙いを合わせると捕獲ゲージがたまります。Spaceまたは「捕まえる」で捕獲します。',
      '「虫かご・育成」で個体を比較し、パートナーを選びます。樹液8で育成でき、同種でも成長量が異なります。',
      '戦闘：1＝攻撃、2＝防御、3＝技。選んだ指示を繰り返し、移動・接近は虫が自動で行います。',
      '防御で体勢とスタミナを回復します。転倒中は無防備になり、復帰に約3.4〜4.6秒かかります。復帰後3秒は再転倒しません。',
      'パワーはガードに、ガードはスピードに、スピードはパワーに有利です。進行状況はこのブラウザーに自動保存されます。'
    ],
    icon: '../files/game-icons/bug-hunter.png', sourceKind: 'workspace-unity',
    sourcePath: 'games/bug-hunter', responsiveCanvas: true,
    build: {
      loaderUrl: `${folder}/Build/${find('.loader.js')}`,
      dataUrl: `${folder}/Build/${find('.data.unityweb')}`,
      frameworkUrl: `${folder}/Build/${find('.framework.js.unityweb')}`,
      codeUrl: `${folder}/Build/${find('.wasm.unityweb')}`,
      streamingAssetsUrl: `${folder}/StreamingAssets`,
      companyName: 'Zenta Shimamoto', productName: 'Bug Hunter', productVersion: '0.2.0', unityVersion: '6000.0.54f1', simplifiedEffects: 0
    },
    downloadBytes: integrity.reduce((sum, file) => sum + file.bytes, 0), integrity
  };
  if (integrity.length !== 4) throw new Error('Build is incomplete');
  const manifestPath = path.join(root, 'play', 'games.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.games = [...manifest.games.filter(entry => entry.id !== game.id), game];
  const template = await fs.readFile(path.join(__dirname, 'web-player.html'), 'utf8');
  const page = template.replaceAll('{{PREFIX}}', '../').replaceAll('{{GAME_ID}}', game.id).replaceAll('{{TITLE}}', game.title);
  await fs.mkdir(path.join(root, 'play', game.id), { recursive: true });
  await fs.writeFile(path.join(root, 'play', game.id, 'index.html'), page);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const current = new Set(integrity.map(asset => asset.file));
  for (const old of await fs.readdir(destination)) {
    if (!current.has(old) && /^[a-f0-9]{32}\.(loader\.js|data\.unityweb|framework\.js\.unityweb|wasm\.unityweb)$/.test(old)) await fs.unlink(path.join(destination, old));
  }
  console.log(`Prepared Bug Hunter: ${(game.downloadBytes / 1024 ** 2).toFixed(2)} MiB`);
}
prepare().catch(error => { console.error(error); process.exitCode = 1; });
