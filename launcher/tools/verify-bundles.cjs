const fs = require('node:fs/promises');
const path = require('node:path');
const { validateCatalog } = require('../src/catalog.cjs');
const { verifyFile } = require('./fetch-games.cjs');

module.exports = async function verifyBundles() {
  const root = path.join(__dirname, '..');
  const catalog = validateCatalog(JSON.parse(await fs.readFile(path.join(root, 'data/catalog.json'), 'utf8')));
  for (const game of catalog.games) {
    const pkg = game.package;
    if (!pkg?.bundled || !await verifyFile(path.join(root, 'bundled', pkg.bundled), pkg)) {
      throw new Error(`Missing or corrupt offline package: ${game.id}. Run pnpm fetch:games, or build and pack the game first.`);
    }
    if (!(await fs.stat(path.join(root, 'assets', game.icon))).isFile()) throw new Error('Game icon missing: ' + game.id);
  }
  console.log(`Verified ${catalog.games.length} offline game packages.`);
};
