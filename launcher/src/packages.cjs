const fs = require('node:fs/promises');
const path = require('node:path');
const yauzl = require('yauzl');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const { relativePath, version } = require('./catalog.cjs');

async function extractZip(file, target, signal, maximum = 25 * 1024 ** 3) {
  await fs.mkdir(target, { recursive: true });
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(error);
      let expanded = 0;
      let count = 0;
      let finished = false;
      const seen = new Set();
      const fail = error => { if (!finished) { finished = true; zip.close(); reject(error); } };
      zip.on('error', fail);
      zip.on('end', () => { if (!finished) { finished = true; resolve(); } });
      zip.on('entry', entry => {
        (async () => {
          signal?.throwIfAborted();
          const directory = entry.fileName.endsWith('/');
          const relative = relativePath(directory ? entry.fileName.slice(0, -1) : entry.fileName);
          const key = relative.toLowerCase();
          if (seen.has(key)) throw new Error('重複したファイルを含むZIPです。');
          seen.add(key);
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if ((entry.generalPurposeBitFlag & 1) || (mode && mode !== 0x8000 && mode !== 0x4000)) throw new Error('リンクや暗号化ファイルは展開できません。');
          expanded += entry.uncompressedSize;
          if (++count > 100000 || expanded > maximum) throw new Error('展開サイズの上限を超えました。');
          const destination = path.join(target, relative);
          if (directory) await fs.mkdir(destination, { recursive: true });
          else {
            await fs.mkdir(path.dirname(destination), { recursive: true });
            const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (err, value) => err ? reject(err) : resolve(value)));
            await pipeline(stream, createWriteStream(destination, { flags: 'wx' }), { signal });
          }
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  });
}
async function readInstalled(root, id) {
  try {
    const directory = path.join(root, id);
    const manifest = JSON.parse(await fs.readFile(path.join(directory, '.installed.json'), 'utf8'));
    if (manifest.id !== id || !manifest.executable?.toLowerCase().endsWith('.exe')) throw new Error('Invalid installation');
    version(manifest.version);
    const executable = path.join(directory, relativePath(manifest.executable));
    const stat = await fs.stat(executable);
    if (!stat.isFile()) throw new Error('Executable missing');
    return manifest;
  } catch { return null; }
}
async function commitInstallation(root, id, stage, metadata) {
  const current = path.join(root, id);
  const backup = path.join(root, id + '.previous');
  await fs.writeFile(path.join(stage, '.installed.json'), JSON.stringify(metadata, null, 2));
  await fs.rm(backup, { recursive: true, force: true });
  let moved = false;
  try {
    try { await fs.rename(current, backup); moved = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(stage, current);
  } catch (error) {
    if (moved) await fs.rename(backup, current);
    throw error;
  }
  // Retain the previous version until the next successful install.
}
module.exports = { extractZip, readInstalled, commitInstallation };
