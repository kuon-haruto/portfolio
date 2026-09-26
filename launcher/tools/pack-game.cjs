const fs = require('node:fs/promises');
const { createWriteStream, createReadStream } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { parseArgs } = require('node:util');
const yazl = require('yazl');
const { relativePath, version, validateCatalog } = require('../src/catalog.cjs');

async function packGame({ source, destination, executable }) {
  source = await fs.realpath(source);
  destination = path.resolve(destination);
  const rel = path.relative(source, destination);
  if (!rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)) throw new Error('ZIP output must be outside the source directory');
  const exe = relativePath(executable);
  if (!exe.toLowerCase().endsWith('.exe') || !(await fs.stat(path.join(source, exe))).isFile()) throw new Error('Game executable missing');
  const entries = [];
  async function walk(directory, prefix = '') {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || /(?:_DoNotShip$|\.pdb$|\.log$)/i.test(entry.name)) continue;
      const name = prefix + entry.name;
      relativePath(name);
      if (entry.isSymbolicLink()) throw new Error('Symlinks cannot be packaged: ' + name);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), name + '/');
      else if (entry.isFile()) entries.push({ file: path.join(directory, entry.name), name });
    }
  }
  await walk(source);
  if (!entries.some(e => e.name === executable)) throw new Error('Executable was excluded');
  const keys = entries.map(e => e.name.toLowerCase());
  if (new Set(keys).size !== keys.length) throw new Error('Case-insensitive file collision');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = destination + '.' + randomUUID() + '.tmp';
  const zip = new yazl.ZipFile();
  const done = pipeline(zip.outputStream, createWriteStream(temporary, { flags: 'wx' }));
  zip.on('error', error => zip.outputStream.destroy(error));
  try {
    for (const entry of entries) zip.addFile(entry.file, entry.name);
    zip.end();
    await done;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(temporary)) hash.update(chunk);
    const size = (await fs.stat(temporary)).size;
    // Versions are immutable. Never replace an archive that may already be published.
    await fs.copyFile(temporary, destination, require('node:fs').constants.COPYFILE_EXCL);
    return { size, sha256: hash.digest('hex'), files: entries.length };
  } finally { await fs.rm(temporary, { force: true }); }
}

async function main() {
  const { values: args } = parseArgs({ options: Object.fromEntries(['id', 'source', 'exe', 'version', 'url', 'catalog'].map(k => [k, { type: 'string' }])) });
  if (!args.id || !args.source || !args.exe || !args.version) throw new Error('Required: --id GAME --source BUILD_FOLDER --exe GAME.exe --version 1.0.0 [--url HTTPS_URL]');
  version(args.version);
  const root = path.join(__dirname, '..');
  const catalogFile = path.resolve(args.catalog || path.join(root, 'data/catalog.json'));
  const catalog = validateCatalog(JSON.parse(await fs.readFile(catalogFile, 'utf8')));
  const game = catalog.games.find(g => g.id === args.id);
  if (!game) throw new Error('Unknown game ID');
  const bundled = `${game.id}-${args.version}.zip`;
  game.package = { version: args.version, executable: args.exe, sha256: '0'.repeat(64), size: 1, bundled, url: args.url || null };
  validateCatalog(catalog);
  const destination = path.join(root, 'bundled', bundled);
  const result = await packGame({ source: args.source, destination, executable: args.exe });
  game.package = { version: args.version, executable: args.exe, sha256: result.sha256, size: result.size, bundled, url: args.url || null };
  validateCatalog(catalog);
  await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify({ id: game.id, ...result, archive: destination }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { packGame };
