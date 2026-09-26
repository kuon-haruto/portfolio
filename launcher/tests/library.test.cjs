const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { relativePath, newer, validateCatalog } = require('../src/catalog.cjs');
const { copyVerified, trustedUrl } = require('../src/transfer.cjs');
const { extractZip, readInstalled, commitInstallation } = require('../src/packages.cjs');
const { packGame } = require('../tools/pack-game.cjs');
const yazl = require('yazl');
const { createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
async function temp(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zenta-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('catalog and semantic versions', () => {
  const catalog = require('../data/catalog.json');
  assert.equal(validateCatalog(catalog).games.length, catalog.games.length);
  assert.equal(newer('1.10.0', '1.9.9'), true);
  assert.equal(newer('1.0.0', '1.0.0'), false);
  assert.equal(newer('0.1.0', '1.0.0'), false);
  assert.throws(() => newer('broken', '1.0.0'));
  assert.throws(() => validateCatalog({ ...catalog, games: [catalog.games[0], catalog.games[0]] }));
});
test('Windows extraction paths reject traversal and aliases', () => {
  for (const value of ['../bad', 'a/../../bad', '/absolute', 'D:/bad', 'a\\bad', 'a//b', 'a/CON.txt', 'a/NUL', 'a/trailing.', 'a/trailing ', 'a:file', 'a/./b']) assert.throws(() => relativePath(value), value);
  assert.equal(relativePath('日本語/Game.exe'), path.join('日本語', 'Game.exe'));
});
test('downloads are limited to explicitly trusted HTTPS origins', () => {
  assert.equal(trustedUrl('https://github.com/a', ['github.com']).hostname, 'github.com');
  for (const url of ['http://github.com/a', 'https://github.com.evil.test/a', 'https://user:pw@github.com/a', 'https://github.com:9999/a']) assert.throws(() => trustedUrl(url, ['github.com']));
});
test('verified copy checks checksum, exact length, cancellation and existing files', async t => {
  const root = await temp(t), source = path.join(root, 'source'), dest = path.join(root, 'dest');
  const bytes = Buffer.from('test package');
  await fs.writeFile(source, bytes);
  const pkg = { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  await copyVerified({ file: source }, dest, pkg, []);
  assert.deepEqual(await fs.readFile(dest), bytes);
  await assert.rejects(copyVerified({ file: source }, dest, pkg, []));
  assert.deepEqual(await fs.readFile(dest), bytes);
  await fs.rm(dest);
  for (const invalid of [{ ...pkg, sha256: '0'.repeat(64) }, { ...pkg, size: 1 }, { ...pkg, size: 999 }]) {
    await assert.rejects(copyVerified({ file: source }, dest, invalid, []));
    await assert.rejects(fs.stat(dest));
  }
  await assert.rejects(copyVerified({ file: source }, dest, pkg, [], AbortSignal.abort()));
  await assert.rejects(fs.stat(dest));
});
test('real ZIP roundtrip, size limit, old version retention and invalid manifest', async t => {
  const root = await temp(t), source = path.join(root, 'source'), stage = path.join(root, 'stage'), library = path.join(root, 'games');
  await fs.mkdir(path.join(source, 'Test_Data'), { recursive: true });
  await fs.mkdir(library);
  await fs.writeFile(path.join(source, 'Game.exe'), 'MZ-test-fixture');
  await fs.writeFile(path.join(source, 'Test_Data', '日本語.txt'), 'asset');
  const archive = path.join(root, 'game.zip');
  const result = await packGame({ source, destination: archive, executable: 'Game.exe' });
  assert.equal(result.files, 2);
  await assert.rejects(packGame({ source, destination: archive, executable: 'Game.exe' }));
  await extractZip(archive, stage);
  assert.equal(await fs.readFile(path.join(stage, 'Test_Data', '日本語.txt'), 'utf8'), 'asset');
  await commitInstallation(library, 'test', stage, { id: 'test', version: '1.0.0', executable: 'Game.exe' });
  assert.equal((await readInstalled(library, 'test')).version, '1.0.0');
  await extractZip(archive, stage);
  await commitInstallation(library, 'test', stage, { id: 'test', version: '1.1.0', executable: 'Game.exe' });
  assert.equal((await readInstalled(library, 'test')).version, '1.1.0');
  assert.equal(JSON.parse(await fs.readFile(path.join(library, 'test.previous', '.installed.json'))).version, '1.0.0');
  await assert.rejects(extractZip(archive, path.join(root, 'limited'), undefined, 1));
  await fs.writeFile(path.join(library, 'test', '.installed.json'), JSON.stringify({ id: 'test', version: 'bad', executable: 'Game.exe' }));
  assert.equal(await readInstalled(library, 'test'), null);
});
test('ZIP extraction rejects traversal, case collisions and symlinks', async t => {
  const root = await temp(t);
  async function archive(name, entries) {
    const file = path.join(root, name + '.zip');
    const zip = new yazl.ZipFile();
    const done = pipeline(zip.outputStream, createWriteStream(file));
    for (const [name, mode] of entries) zip.addBuffer(Buffer.from('data'), name, mode ? { mode } : {});
    zip.end(); await done; return file;
  }
  const collision = await archive('collision', [['A.txt'], ['a.txt']]);
  await assert.rejects(extractZip(collision, path.join(root, 'collision')), /重複/);
  const symlink = await archive('symlink', [['link', 0o120777]]);
  await assert.rejects(extractZip(symlink, path.join(root, 'symlink')), /リンク/);
  const traversal = await archive('traversal', [['aaa/file.txt']]);
  const buffer = await fs.readFile(traversal);
  let offset = 0;
  while ((offset = buffer.indexOf('aaa/file.txt', offset)) !== -1) { buffer.write('../file.txt ', offset); offset += 12; }
  await fs.writeFile(traversal, buffer);
  await assert.rejects(extractZip(traversal, path.join(root, 'traversal')));
  await assert.rejects(fs.stat(path.join(root, 'file.txt')));
});
test('failed final rename restores the old installation', async t => {
  const root = await temp(t), current = path.join(root, 'test');
  const metadata = { id: 'test', version: '1.0.0', executable: 'Game.exe' };
  await fs.mkdir(path.join(current, 'stage'), { recursive: true });
  await fs.writeFile(path.join(current, 'Game.exe'), 'MZ-old');
  await fs.writeFile(path.join(current, '.installed.json'), JSON.stringify(metadata));
  // Moving current also moves this stage, inducing a final-rename failure.
  await assert.rejects(commitInstallation(root, 'test', path.join(current, 'stage'), { ...metadata, version: '2.0.0' }));
  assert.equal((await readInstalled(root, 'test')).version, '1.0.0');
  assert.equal(await fs.readFile(path.join(current, 'Game.exe'), 'utf8'), 'MZ-old');
});
