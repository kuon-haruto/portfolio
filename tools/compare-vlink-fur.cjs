const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');

const folder = process.argv[2] || path.resolve(__dirname, '../launcher/test-output/vlink-vfx/fur');
const candidate = process.argv[3] || folder;
const read = (directory, name) => PNG.sync.read(fs.readFileSync(path.join(directory, name + '.png')));
const images = [read(folder, 'native'), read(candidate, 'portable'), read(folder, 'no-fur'), read(candidate, 'no-fur')];
const [native, portable, nativeBare, portableBare] = images;
for (const image of images) {
  assert.equal(image.width, native.width);
  assert.equal(image.height, native.height);
}
let nativeFurPixels = 0, portableFurPixels = 0, sharedFurPixels = 0, error = 0, originalContribution = 0;
let differentPixels = 0;
for (let i = 0; i < native.data.length; i += 4) {
  const x = i / 4 % native.width, y = Math.floor(i / 4 / native.width);
  if (x >= 816 && y >= 936) continue; // Same development watermark exclusion for every image.
  let a = 0, b = 0, delta = 0;
  for (let c = 0; c < 3; c++) {
    a += Math.abs(native.data[i + c] - nativeBare.data[i + c]);
    b += Math.abs(portable.data[i + c] - portableBare.data[i + c]);
    delta += Math.abs(native.data[i + c] - portable.data[i + c]);
  }
  nativeFurPixels += a > 6;
  portableFurPixels += b > 6;
  sharedFurPixels += a > 6 && b > 6;
  differentPixels += delta > 0;
  error += delta;
  originalContribution += a;
}
const report = {
  nativeFurPixels, portableFurPixels, sharedFurPixels, differentPixels,
  furCoverageIoU: sharedFurPixels / (nativeFurPixels + portableFurPixels - sharedFurPixels),
  errorRelativeToMissingFur: error / originalContribution,
  normalizedMeanError: error / (native.width * native.height * 3 * 255),
};
fs.writeFileSync(path.join(candidate, 'comparison.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert(nativeFurPixels > 100, 'Native fur reference is missing.');
assert(portableFurPixels > 100, 'Portable fur is missing.');
assert(report.furCoverageIoU > .98, 'Fur silhouette diverges from the native reference.');
assert(report.errorRelativeToMissingFur < .05, 'Fur color/position error is too large.');
