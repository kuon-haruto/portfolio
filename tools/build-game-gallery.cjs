// Build with: node tools/build-game-gallery.cjs (pnpm on PATH or PNPMPATH set).
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const cache = path.join(root, 'launcher/test-output/gallery-build');

async function build() {
  await fs.mkdir(cache, { recursive: true });
  const core = path.join(cache, 'three.core.js');
  const version = '0.180.0';
  for (const [remote, local] of [
    [`https://unpkg.com/three@${version}/build/three.core.js`, core],
    [`https://unpkg.com/three@${version}/LICENSE`, path.join(root, 'scripts/THREE-LICENSE.txt')],
  ]) {
    const response = await fetch(remote);
    if (!response.ok) throw new Error(`Dependency download failed: ${response.status}`);
    await fs.writeFile(local, await response.text());
  }
  const args = ['--package=esbuild@0.25.10', 'dlx', 'esbuild', 'src/game-gallery.js', '--bundle', '--minify', '--format=iife', `--alias:three=${core}`, '--outfile=scripts/game-gallery.js', '--legal-comments=inline', '--banner:js=/* Generated from src/game-gallery.js. Three.js 0.180.0: see THREE-LICENSE.txt. */'];
  const command = process.env.PNPMPATH || 'pnpm';
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    const quote = value => `"${value}"`;
    execFileSync('cmd.exe', ['/d', '/s', '/c', `"${[command, ...args].map(quote).join(' ')}"`], { cwd: root, stdio: 'inherit', windowsVerbatimArguments: true });
  } else execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}
build().catch(error => { console.error(error); process.exitCode = 1; });
