const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

test('a V-Link-only update preserves every other published game', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-package-test-'));
  try {
    for (const folder of ['tools', 'launcher/data', 'play', 'output/v-link-battle/Build'])
      await fs.mkdir(path.join(root, folder), { recursive: true });
    await fs.copyFile(path.join(__dirname, '../tools/prepare-web-games.cjs'), path.join(root, 'tools/prepare-web-games.cjs'));
    await fs.copyFile(path.join(__dirname, '../tools/web-player.html'), path.join(root, 'tools/web-player.html'));
    const ids = ['v-link-battle', 'line-boundary', 'hanten-assassination', 'teruteru-wars', 'futago', 'bug-hunter'];
    const previous = ids.map(id => ({ id, title: id, build: { dataUrl: 'unchanged-' + id },
      ...(id === 'bug-hunter' ? { sourceKind: 'workspace-unity' } : {}) }));
    const write = (file, data) => fs.writeFile(path.join(root, file), JSON.stringify(data));
    await write('play/games.json', { games: previous });
    await write('launcher/data/game-sources.json', { games: ids.slice(0, 5).map(id => ({ id, commit: 'pinned' })) });
    await write('launcher/data/catalog.json', { games: [{ id: ids[0], title: 'V-Link Battle', icon: 'v-link-battle.png' }] });
    await write('output/v-link-battle/portfolio-build.json', { iceEffects: 5 });
    const hash = '1234567890abcdef1234567890abcdef';
    for (const ending of ['loader.js', 'data.unityweb', 'framework.js.unityweb', 'wasm.unityweb'])
      await fs.writeFile(path.join(root, 'output/v-link-battle/Build', hash + '.' + ending), 'fixture-' + ending);
    execFileSync(process.execPath, [path.join(root, 'tools/prepare-web-games.cjs'), path.join(root, 'output'), '--ids=v-link-battle']);
    const { games } = JSON.parse(await fs.readFile(path.join(root, 'play/games.json'), 'utf8'));
    assert.equal(games.length, 6);
    assert.equal(games[0].build.iceEffects, 5);
    assert.equal(games[0].integrity.length, 4);
    for (const original of previous.slice(1)) assert.deepEqual(games.find(g => g.id === original.id), original);
    for (const id of ids) assert.match(await fs.readFile(path.join(root, 'play', id, 'index.html'), 'utf8'), /start-fullscreen/);
    assert.throws(() => execFileSync(process.execPath, [path.join(root, 'tools/prepare-web-games.cjs'), '--ids=typo'], { stdio: 'pipe' }), /Unknown game id/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
