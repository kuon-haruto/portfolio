const fs = require('node:fs/promises');
const path = require('node:path');
const { validateCatalog, version } = require('../src/catalog.cjs');
const { verifyFile } = require('./fetch-games.cjs');

(async () => {
  const root = path.join(__dirname, '..');
  const appVersion = version(require('../package.json').version);
  const tag = 'launcher-v' + appVersion;
  const catalog = validateCatalog(require('../data/catalog.json'));
  const output = path.join(root, 'artifacts', tag);
  await fs.mkdir(output, { recursive: true });
  for (const game of catalog.games) {
    if (!game.package) throw new Error('Windows package is not ready: ' + game.id);
    const pkg = game.package;
    if (!pkg.bundled) throw new Error('Bundled filename missing: ' + game.id);
    const source = path.join(root, 'bundled', pkg.bundled);
    if (!await verifyFile(source, pkg)) throw new Error('Package missing or corrupt: ' + game.id);
    pkg.url = `https://github.com/kuon-haruto/portfolio/releases/download/${tag}/${pkg.bundled}`;
    await fs.copyFile(source, path.join(output, pkg.bundled));
  }
  const json = JSON.stringify(validateCatalog(catalog), null, 2) + '\n';
  await fs.writeFile(path.join(root, 'data/catalog.json'), json);
  await fs.writeFile(path.join(output, 'games.json'), json);
  await fs.copyFile(path.join(root, 'data/game-sources.json'), path.join(output, 'game-sources.json'));
  console.log('Prepared local release files: ' + output);
  console.log('Next: pnpm dist. Publish the installer, latest.yml, blockmap and all files above together.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
