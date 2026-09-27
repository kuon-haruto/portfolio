const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../games/bug-hunter/Assets/BugHunter/Plugins/Browser.jslib'), 'utf8');

for (const [hz, expected] of [[30, 1], [60, 1], [90, 2], [120, 2], [144, 3], [165, 3], [240, 4]]) {
  test(`Web frame pacing preserves rAF and reduces ${hz} Hz with divisor ${expected}`, () => {
    const callbacks = [], timings = [], module = {}, events = {};
    const library = {};
    const context = {
      LibraryManager: { library }, mergeInto: Object.assign, Module: module,
      window: { requestAnimationFrame: fn => callbacks.push(fn), addEventListener: (type, fn) => { events[type] = fn; } },
      document: { hidden: false, addEventListener: (type, fn) => { events[type] = fn; } },
      UTF8ToString: json => json, HEAPU8: { byteLength: 67108864 },
      _emscripten_set_main_loop_timing: (...args) => timings.push(args)
    };
    vm.runInNewContext(source, context);
    library.ReportStats('{"screen":"forest"}');
    for (let i = 0; i < 50; i++) callbacks.shift()?.((i + 1) * 1000 / hz);
    assert.deepEqual(timings, [[1, expected]]);
    assert.equal(context.window.__bugHunterStats.wasmHeapBytes, 67108864);
    library.ReportStats('{}');
    assert.equal(callbacks.length, 0, 'no new measurement on every report');
    events.resize();
    assert.equal(callbacks.length, 1, 'moving to a different display can remeasure');
  });
}
