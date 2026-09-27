mergeInto(LibraryManager.library, {
  ReportStats__deps: ['emscripten_set_main_loop_timing'],
  ReportStats: function (json) {
    window.__bugHunterStats = JSON.parse(UTF8ToString(json));
    window.__bugHunterStats.wasmHeapBytes = HEAPU8.byteLength;
    if (!Module['bugHunterPacing']) {
      Module['bugHunterPacing'] = true;
      // Unity assumes a 60 Hz display on Web. Measure rAF and use the supported
      // Emscripten timing API to avoid rendering 240 frames on a 240 Hz monitor.
      var measuring = false;
      var tune = function () {
        if (measuring || document.hidden) return;
        measuring = true;
        var intervals = [], previous = 0;
        var sample = function (time) {
          if (document.hidden) { measuring = false; return; }
          if (previous) intervals.push(time - previous);
          previous = time;
          if (intervals.length < 48) { window.requestAnimationFrame(sample); return; }
          intervals.sort(function (a, b) { return a - b; });
          var hz = 1000 / Math.max(1, intervals[24]);
          var divisor = Math.max(1, Math.round(hz / 60));
          if (hz / divisor > 65) divisor = Math.ceil(hz / 60);
          _emscripten_set_main_loop_timing(1, divisor);
          measuring = false;
        };
        window.requestAnimationFrame(sample);
      };
      tune();
      window.addEventListener('resize', tune);
      document.addEventListener('visibilitychange', tune);
    }
  },
  SyncSave: function () {
    if (typeof FS !== 'undefined') FS.syncfs(false, function (err) { if (err) console.error('Bug Hunter save sync failed', err); });
  }
});
