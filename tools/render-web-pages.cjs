const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.join(__dirname, '..');

async function renderPages() {
  const { games } = JSON.parse(await fs.readFile(path.join(root, 'play/games.json'), 'utf8'));
  const template = await fs.readFile(path.join(__dirname, 'web-player.html'), 'utf8');
  const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  for (const game of [{ id: '', title: 'ゲームライブラリ' }, ...games]) {
    if (game.id && !/^[a-z0-9-]+$/.test(game.id)) throw new Error('Invalid game id');
    const directory = path.join(root, 'play', game.id);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'index.html'), template.replaceAll('{{PREFIX}}', game.id ? '../' : './')
      .replaceAll('{{GAME_ID}}', game.id).replaceAll('{{TITLE}}', escape(game.title)));
  }
}
module.exports = { renderPages };
if (require.main === module) renderPages().catch(error => { console.error(error); process.exitCode = 1; });
