const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const payloadPattern = /^[a-f0-9]{32}\.(loader\.js|data\.unityweb(?:\.part-\d{3})?|framework\.js\.unityweb|wasm\.unityweb)$/;

async function preserveWebGL(previous, id) {
  if (!previous) throw new Error('A verified WebGL build is required before migrating to WebGPU.');
  const existing = previous.build.graphicsApi === 'WebGPU' ? previous.fallback : previous;
  if (!existing?.integrity?.length || existing.build.graphicsApi === 'WebGPU') throw new Error('Missing WebGL compatibility build.');
  const from = `builds/${id}/${previous.build.graphicsApi === 'WebGPU' ? 'webgl' : 'v1'}/Build/`;
  const to = `builds/${id}/webgl/Build/`;
  const remap = value => {
    if (!value?.startsWith(from) || !payloadPattern.test(value.slice(from.length))) throw new Error('Unexpected compatibility payload path.');
    return to + value.slice(from.length);
  };
  const build = { ...existing.build, graphicsApi: 'WebGL2' };
  for (const key of ['loaderUrl', 'dataUrl', 'frameworkUrl', 'codeUrl']) build[key] = remap(build[key]);
  if (build.dataParts) build.dataParts = build.dataParts.map(part => ({ ...part, url: remap(part.url) }));
  // The original video asset URLs are baked into the game and remain in v1.
  const destination = path.join(root, 'play', to);
  const verified = [];
  for (const asset of existing.integrity) {
    if (!payloadPattern.test(asset.file)) throw new Error('Unexpected compatibility payload name.');
    const bytes = await fs.readFile(path.join(root, 'play', from, asset.file));
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
      throw new Error(`Compatibility payload failed integrity: ${asset.file}`);
    verified.push({ asset, bytes });
  }
  if (from !== to) {
    await fs.mkdir(destination, { recursive: true });
    for (const { asset, bytes } of verified) await fs.writeFile(path.join(destination, asset.file), bytes);
  }
  return { build, integrity: existing.integrity, downloadBytes: existing.downloadBytes,
    browserNotice: '動作優先版（WebGL）です。一部のエフェクトは簡易表示になり、通知ウィンドウはゲーム画面内に表示されます。' };
}

async function prepare() {
  const args = process.argv.slice(2);
  const outputRoot = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(os.tmpdir(), 'portfolio-web-builds', 'output'));
  const sources = require('../launcher/data/game-sources.json').games;
  const ids = args.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
  if (ids?.some(id => !sources.some(source => source.id === id))) throw new Error('Unknown game id.');
  const catalog = require('../launcher/data/catalog.json').games;
  const previous = JSON.parse(await fs.readFile(path.join(root, 'play', 'games.json'), 'utf8').catch(() => '{"games":[]}'));
  // In-repository Unity games have their own build pipeline, separate from the five Windows imports.
  const games = previous.games.filter(game => game.sourceKind === 'workspace-unity' || (ids && !ids.includes(game.id)));
  for (const source of sources) {
    if (ids && !ids.includes(source.id)) continue;
    if (!/^[a-z0-9-]+$/.test(source.id)) throw new Error('Invalid game id.');
    const original = catalog.find(game => game.id === source.id);
    const output = path.join(outputRoot, source.id);
    if (args.includes('--ready') && !(await fs.stat(path.join(output, 'portfolio-build.json')).catch(() => null))) continue;
    const metadata = JSON.parse(await fs.readFile(path.join(output, 'portfolio-build.json'), 'utf8'));
    const fallback = metadata.graphicsApi === 'WebGPU'
      ? await preserveWebGL(previous.games.find(game => game.id === source.id), source.id) : null;
    const files = await fs.readdir(path.join(output, 'Build'));
    const find = ending => {
      const matching = files.filter(file => file.endsWith(ending));
      if (matching.length !== 1) throw new Error(`Expected one ${ending} file for ${source.id}`);
      return matching[0];
    };
    const folder = `builds/${source.id}/v1`;
    const build = {
      loaderUrl: `${folder}/Build/${find('.loader.js')}`,
      dataUrl: `${folder}/Build/${find('.data.unityweb')}`,
      frameworkUrl: `${folder}/Build/${find('.framework.js.unityweb')}`,
      codeUrl: `${folder}/Build/${find('.wasm.unityweb')}`,
      streamingAssetsUrl: `${folder}/StreamingAssets`,
      ...metadata,
    };
    const integrity = [];
    const destination = path.join(root, 'play', folder);
    const destinationBuild = path.join(destination, 'Build');
    await fs.mkdir(destinationBuild, { recursive: true });
    const save = async (file, bytes) => {
      const info = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
      await fs.writeFile(path.join(destinationBuild, file), bytes);
      integrity.push(info);
      return info;
    };
    for (const file of files) {
      const bytes = await fs.readFile(path.join(output, 'Build', file));
      if (bytes.length >= 100 * 1024 ** 2) {
        if (!file.endsWith('.data.unityweb')) throw new Error(`GitHub file limit exceeded: ${file}`);
        build.dataParts = [];
        const size = 48 * 1024 ** 2;
        for (let offset = 0, index = 0; offset < bytes.length; offset += size, index++) {
          const name = file + '.part-' + String(index).padStart(3, '0');
          const part = await save(name, bytes.subarray(offset, offset + size));
          build.dataParts.push({ url: `${folder}/Build/${name}`, bytes: part.bytes, sha256: part.sha256 });
        }
      } else await save(file, bytes);
    }
    const currentFiles = new Set(integrity.map(asset => asset.file));
    for (const old of await fs.readdir(destinationBuild).catch(() => [])) {
      // The manifest and content-hashed payloads are deployed together; Git retains old revisions.
      if (!currentFiles.has(old) && payloadPattern.test(old)) {
        await fs.unlink(path.join(destinationBuild, old));
      }
    }
    if (await fs.stat(path.join(output, 'StreamingAssets')).catch(() => null)) {
      await fs.cp(path.join(output, 'StreamingAssets'), path.join(destination, 'StreamingAssets'), { recursive: true });
    }
    const { id, title, genre, description, objective, duration, teamSize, howToPlay, icon } = original;
    games.push({ id, title, genre, description, objective, duration, teamSize, howToPlay,
      icon: '../files/game-icons/' + icon, build, sourceCommit: source.commit,
      ...(id === 'v-link-battle' ? { browserNotice: fallback
        ? '演出優先版（WebGPU）です。元の氷VFXを使用し、通知ウィンドウはゲーム画面内に表示します。動きが重い場合は描画モードを「動作優先」に変更してください。'
        : 'Web版では通知ウィンドウをゲーム画面内に表示し、一部のエフェクトを簡易表示しています。' } : {}),
      ...(fallback ? { fallback } : {}),
      downloadBytes: integrity.reduce((total, file) => total + file.bytes, 0), integrity });
    console.log(`Prepared ${id}: ${(games.at(-1).downloadBytes / 1024 ** 2).toFixed(1)} MB`);
  }
  if (!games.length) throw new Error('No completed Web builds found.');
  games.sort((a, b) => Number(b.id === 'v-link-battle') - Number(a.id === 'v-link-battle'));
  await fs.writeFile(path.join(root, 'play', 'games.json'), JSON.stringify({ games }, null, 2) + '\n');
  const template = await fs.readFile(path.join(__dirname, 'web-player.html'), 'utf8');
  const escape = text => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  for (const game of [{ id: '', title: 'ゲームライブラリ' }, ...games]) {
    const directory = path.join(root, 'play', game.id);
    await fs.mkdir(directory, { recursive: true });
    const html = template.replaceAll('{{PREFIX}}', game.id ? '../' : './')
      .replaceAll('{{GAME_ID}}', game.id).replaceAll('{{TITLE}}', escape(game.title));
    await fs.writeFile(path.join(directory, 'index.html'), html);
  }
}
prepare().catch(error => { console.error(error.message); process.exitCode = 1; });
