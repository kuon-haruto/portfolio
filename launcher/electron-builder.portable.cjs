const { build } = require('./package.json');

module.exports = {
  ...build,
  directories: { ...build.directories, output: 'dist/portable' },
  extraMetadata: { distribution: 'portable' },
  win: {
    ...build.win,
    target: [{ target: 'zip', arch: ['x64'] }],
    artifactName: 'AppInstaller-Portable-${version}.${ext}',
  },
  publish: null,
};
