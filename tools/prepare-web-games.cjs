const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');

async function prepare() {
  const args = process.argv.slice(2);
  const outputRoot = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(os.tmpdir(), 'portfolio-web-builds', 'output'));
  const sources = require('../launcher/data/game-sources.json').games;
  const catalog = require('../launcher/data/catalog.json').games;
  const previous = JSON.parse(await fs.readFile(path.join(root, 'play', 'games.json'), 'utf8').catch(() => '{"games":[]}'));
  // In-repository Unity games have their own build pipeline, separate from the five Windows imports.
  const games = previous.games.filter(game => game.sourceKind === 'workspace-unity');
  for (const source of sources) {
    if (!/^[a-z0-9-]+$/.test(source.id)) throw new Error('Invalid game id.');
    const original = catalog.find(game => game.id === source.id);
    const output = path.join(outputRoot, source.id);
    if (args.includes('--ready') && !(await fs.stat(path.join(output, 'portfolio-build.json')).catch(() => null))) continue;
    const metadata = JSON.parse(await fs.readFile(path.join(output, 'portfolio-build.json'), 'utf8'));
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
      if (!currentFiles.has(old) && /^[a-f0-9]{32}\.(loader\.js|data\.unityweb(?:\.part-\d{3})?|framework\.js\.unityweb|wasm\.unityweb)$/.test(old)) {
        await fs.unlink(path.join(destinationBuild, old));
      }
    }
    if (await fs.stat(path.join(output, 'StreamingAssets')).catch(() => null)) {
      await fs.cp(path.join(output, 'StreamingAssets'), path.join(destination, 'StreamingAssets'), { recursive: true });
    }
    const { id, title, genre, description, objective, duration, teamSize, howToPlay, icon } = original;
    games.push({ id, title, genre, description, objective, duration, teamSize, howToPlay,
      icon: '../files/game-icons/' + icon, build, sourceCommit: source.commit,
      ...(id === 'v-link-battle' ? { browserNotice: 'Web版では通知ウィンドウをゲーム画面内に表示し、一部のエフェクトを簡易表示しています。' } : {}),
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
