const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { validateCatalog } = require('../src/catalog.cjs');
const { copyVerified } = require('../src/transfer.cjs');

async function verifyFile(file, pkg) {
  try {
    if ((await fs.stat(file)).size !== pkg.size) return false;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex') === pkg.sha256;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function main() {
  const root = path.join(__dirname, '..');
  const catalog = validateCatalog(require('../data/catalog.json'));
  const publisher = require('../data/publisher.json');
  await fs.mkdir(path.join(root, 'bundled'), { recursive: true });
  for (const game of catalog.games) {
    const pkg = game.package;
    if (!pkg) continue;
    if (!pkg.bundled) throw new Error('Bundled filename required: ' + game.id);
    const file = path.join(root, 'bundled', pkg.bundled);
    if (await verifyFile(file, pkg)) { console.log('Verified: ' + game.id); continue; }
    if (!pkg.url) throw new Error('Build and pack this game first: ' + game.id);
    const temp = file + '.' + randomUUID() + '.tmp';
    try {
      console.log('Downloading: ' + game.id);
      await copyVerified({ url: pkg.url }, temp, pkg, publisher.downloadHosts, AbortSignal.timeout(30 * 60 * 1000));
      await fs.rename(temp, file);
    } finally { await fs.rm(temp, { force: true }); }
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verifyFile };
