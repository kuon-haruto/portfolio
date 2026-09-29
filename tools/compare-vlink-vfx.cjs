const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PNG } = require('../launcher/node_modules/playwright-core/lib/utilsBundle');

const [reference, candidate] = process.argv.slice(2);
if (!reference || !candidate) throw new Error('Usage: node tools/compare-vlink-vfx.cjs reference-folder candidate-folder');
const original = JSON.parse(fs.readFileSync(path.join(reference, 'reference.json')));
const updated = JSON.parse(fs.readFileSync(path.join(candidate, 'reference.json')));
const key = sample => sample.name + ':' + sample.frame;
const expected = new Set(original.samples.map(key));
const extraSamples = updated.samples.filter(sample => !expected.has(key(sample)));
assert.equal(new Set(updated.samples.map(key)).size, updated.samples.length, 'Duplicate candidate sample');
if (!process.argv.includes('--allow-extra-candidates')) assert.deepEqual(extraSamples, [], 'Unexpected candidate samples');
assert.deepEqual(updated.samples.filter(sample => expected.has(key(sample))).map(key), original.samples.map(key));
const comparisons = original.samples.map(sample => {
  const a = PNG.sync.read(fs.readFileSync(path.join(reference, sample.image)));
  const b = PNG.sync.read(fs.readFileSync(path.join(candidate, sample.image)));
  assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  let union = 0, intersection = 0, error = 0, referencePixels = 0, candidatePixels = 0;
  let comparedPixels = 0, differentPixels = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const x = i / 4 % a.width, y = Math.floor(i / 4 / a.width);
    // Exclude the development-build watermark, not any effect-specific difference.
    if (x >= 816 && y >= 696) continue;
    comparedPixels++;
    if ([0, 1, 2, 3].some(c => a.data[i+c] !== b.data[i+c])) differentPixels++;
    const foreground = png => Math.max(...[0, 1, 2].map(c => Math.abs(png.data[i+c] - png.data[c]))) > 12;
    const fa = foreground(a), fb = foreground(b);
    referencePixels += Number(fa); candidatePixels += Number(fb);
    if (fa && fb) intersection++;
    if (fa || fb) {
      union++;
      for (let c = 0; c < 3; c++) error += Math.abs(a.data[i+c] - b.data[i+c]);
    }
  }
  return { name: sample.name, frame: sample.frame, comparedPixels, differentPixels, referencePixels, candidatePixels,
    silhouetteIoU: union ? intersection / union : 1,
    foregroundMeanError: union ? error / (union * 3 * 255) : 0 };
});
const report = { reference: original.unity, candidate: updated.unity,
  candidateSamplesNotCompared: extraSamples.map(key),
  excludedRegion: { x: 816, y: 696, width: 144, height: 24, reason: 'Unity development-build watermark' }, comparisons };
fs.writeFileSync(path.join(candidate, 'comparison.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
// Metrics guide visual review; they are not a substitute for a fidelity judgment.
for (const name of new Set(original.samples.map(s => s.name))) {
  const frames = comparisons.filter(s => s.name === name);
  assert(frames.some(s => s.referencePixels > 100), 'Original reference is blank: ' + name);
  assert(frames.some(s => s.candidatePixels > 100), 'Candidate effect is missing: ' + name);
}
