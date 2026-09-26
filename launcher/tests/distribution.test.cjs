const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const portable = require('../electron-builder.portable.cjs');

test('both distributions keep the application identity and use dedicated branding', () => {
  assert.equal(pkg.name, 'zenta-game-library');
  assert.equal(pkg.build.appId, 'jp.zentashimamoto.gamelibrary');
  assert.equal(pkg.build.productName, 'アプリインストーラー');
  assert.equal(portable.productName, pkg.build.productName);
  assert.equal(pkg.build.win.icon, 'assets/app-installer.png');
  assert.equal(portable.win.icon, pkg.build.win.icon);
  const icon = fs.readFileSync(path.join(__dirname, '..', pkg.build.win.icon));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(icon.readUInt32BE(16) >= 256);
  assert.equal(icon.readUInt32BE(16), icon.readUInt32BE(20));
});

test('ZIP edition is marked portable and cannot replace the installed update feed', () => {
  assert.equal(portable.extraMetadata.distribution, 'portable');
  assert.equal(pkg.build.extraMetadata?.distribution, undefined);
  assert.deepEqual(portable.win.target, [{ target: 'zip', arch: ['x64'] }]);
  assert.notEqual(portable.directories.output, pkg.build.directories.output);
  assert.equal(portable.publish, null);
  assert.match(portable.win.artifactName, /Portable.*\.\$\{ext\}$/);
  assert.match(pkg.build.win.artifactName, /Setup.*\.\$\{ext\}$/);
  assert.deepEqual(portable.extraResources, pkg.build.extraResources);
});
