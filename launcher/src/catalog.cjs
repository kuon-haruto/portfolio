const path = require('node:path');

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 ||
      /[\\:<>"|?*\x00-\x1f]/.test(value) || value.startsWith('/')) {
    throw new Error('Invalid package path');
  }
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) {
    throw new Error('Unsafe package path');
  }
  return parts.join(path.sep);
}
function version(value) {
  if (typeof value !== 'string' || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value)) throw new Error('Invalid version');
  return value;
}
function newer(a, b) {
  const aa = version(a).split('.').map(Number);
  const bb = version(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i];
  return false;
}
function text(value, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) throw new Error('Invalid text');
  return value;
}
function validateCatalog(input) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.games) || input.games.length > 100) throw new Error('Invalid catalog');
  const ids = new Set();
  const games = input.games.map(game => {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(game.id) || ids.has(game.id)) throw new Error('Invalid or duplicate game ID');
    ids.add(game.id);
    const icon = text(game.icon);
    if (path.basename(relativePath(icon)) !== icon || !/\.(png|jpe?g|webp)$/i.test(icon)) throw new Error('Invalid icon');
    if (game.teamSize != null && (!Number.isInteger(game.teamSize) || game.teamSize < 1 || game.teamSize > 10000)) throw new Error('Invalid team size');
    if (!Array.isArray(game.howToPlay) || game.howToPlay.length > 50) throw new Error('Invalid controls');
    let pkg = null;
    if (game.package) {
      const p = game.package;
      const executable = text(p.executable);
      relativePath(executable);
      if (!executable.toLowerCase().endsWith('.exe')) throw new Error('Windows executable required');
      if (!/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.size) || p.size < 1 || p.size > 25 * 1024 ** 3) throw new Error('Invalid package integrity');
      if (p.bundled && (path.basename(relativePath(p.bundled)) !== p.bundled || !p.bundled.endsWith('.zip'))) throw new Error('Invalid bundled file');
      if (!p.bundled && !p.url) throw new Error('Package source missing');
      if (p.url && new URL(p.url).protocol !== 'https:') throw new Error('HTTPS package URL required');
      pkg = { version: version(p.version), executable, sha256: p.sha256, size: p.size, url: p.url || null, bundled: p.bundled || null };
    }
    return {
      id: game.id, title: text(game.title), genre: text(game.genre), description: text(game.description),
      objective: text(game.objective, false), engine: text(game.engine), duration: text(game.duration, false),
      teamSize: game.teamSize ?? null, howToPlay: game.howToPlay.map(v => text(v)), icon, package: pkg,
    };
  });
  return { schemaVersion: 1, games };
}
module.exports = { relativePath, version, newer, validateCatalog };
