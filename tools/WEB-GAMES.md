# Browser Games

The portfolio links to `play/`. Six Unity games run in the browser without
installing the Windows app or manually downloading an archive. Browsers still
download and cache the selected game's assets. The library does not preload all
six games. These games are designed for a PC with a keyboard and mouse.
Portfolio play links use the published HTTPS URLs, including when the portfolio
itself is opened as a local HTML file from a USB drive.

V-Link Battle uses the user's current `D:/Vlink` project in an isolated build copy.
Its native Windows effects are adapted to the game canvas. Details and provenance
are recorded in [vlink-web/README.md](vlink-web/README.md).
The original-VFX Unity 6/WebGPU migration and its current validation gates are
tracked in [vlink-web/WEBGPU-MIGRATION.md](vlink-web/WEBGPU-MIGRATION.md).
Its build command is `./tools/build-web-games.ps1 -Ids v-link-battle -VLinkWebGPU`;
do not run the older editor against the migrated temporary project.

## Build

1. Install the exact editors listed in `launcher/data/game-sources.json`, including
   Web Build Support, using Unity Hub. A valid Unity license is required.
2. Prepare the source clones in `launcher/game-sources/` as described in the
   launcher README. Builds use the pinned commits, not uncommitted local edits.
3. Run `./tools/build-web-games.ps1` for an initial legacy build. When reusing the
   migrated V-Link cache, build the other four imported games with `-Ids`, then
   build V-Link separately with `-Ids v-link-battle -VLinkWebGPU`. Sources and intermediate outputs are isolated
   under `%TEMP%/portfolio-web-builds/` to avoid Unicode toolchain path issues.
   Logs are written to `launcher/test-output/*-web-build.log`.
4. Run `node tools/prepare-web-games.cjs` (or `--ids=v-link-battle` for its update only). This copies the selected builds to `play/`,
   records their checksums, and generates the library and individual game pages.
   `--ready` is for local incremental testing only; it includes completed builds.
5. Run `python build.py`, `python -m unittest discover -s tests`,
   `node --test tests/game-gallery.test.cjs tests/web-player-ui.test.cjs`,
   and `node tests/web-games-smoke.cjs`.
   Browser tests require the launcher's Playwright dependency and Microsoft Edge.
   Set `PLAYWRIGHT_CHANNEL` to test another installed Chromium browser.
   Set `WEB_TEST_GPU=hardware` to use the installed GPU for V-Link's 3D scenes;
   software rendering can exceed screenshot timeouts on those scenes.

## Hosting

All six player pages offer a primary fullscreen play command after loading.
The click calls `requestFullscreen({ navigationUI: 'hide' })` directly, preserving
the browser's required user gesture. Windowed play remains an explicit alternative.
Esc exits fullscreen and releases pointer lock; a minimize control also appears
when the pointer is at the screen's top edge. It stays hidden during mouse look.
Fullscreen denial is reported without silently pretending the page is fullscreen.
Embedded browsers that deny fullscreen need a regular Edge/Chrome window.

Run `node tools/render-web-pages.cjs` to regenerate all seven HTML pages from the
shared template without rebuilding or copying any Unity payloads.

Commit the generated `play/` assets and `.nojekyll` with the portfolio changes.
GitHub Pages publishes the `main` branch. Use an HTTP(S) server, not `file://`,
to run Web games. `node tools/web-test-server.cjs` serves just the Web player
and its images for local testing, using a free port printed at startup.

Unity's gzip decompression fallback is enabled because GitHub Pages cannot add
custom Content-Encoding headers. The `.unityweb` files therefore load without
special server configuration. Each file must stay below GitHub's 100 MiB limit.
Data payloads exceeding that limit are split into 48 MiB parts without recompressing
or changing game assets. The player verifies each part's size and SHA-256, assembles
a temporary blob URL, and releases it after Unity loads. Other games retain their
original single-file loading and Unity cache behavior.
Different game URL directories isolate Unity's browser save-data paths.
The player uses a fixed 1920x1080 drawing buffer and scales it with CSS, including
fullscreen mode. This preserves the fixed-pixel UI in the original Unity scenes;
automatically resizing Unity's drawing buffer clips those menus on small screens.
Bug Hunter uses its own responsive canvas/UI instead of the fixed drawing buffer.

V-Link's Unity 6 WebGPU build retains all 14 original VisualEffect components,
the original stencil shaders, and a vertex-based adaptation of the original fur.
Its manifest records `graphicsApi: WebGPU`, `originalVfxComponents: 14` and zero
CPU replacements. V-Link now defaults to the WebGL motion-priority mode with
an explicit simplified-effects notice. A visible rendering-mode selector keeps
the original-effects WebGPU mode available at `?renderer=webgpu`; choosing
`?renderer=webgl` switches back. Mode changes restart the game, and reloads retain
the URL's choice. Normal library links always start in motion-priority mode.
Only an explicit WebGPU choice probes an adapter before downloading the game;
unsupported environments use WebGL with a notice and the selector reflects the
actual mode. GPU startup failures also offer a motion-priority retry. GPU allocation
and performance vary by browser/hardware; see the migration report's measured
Intel/NVIDIA results. The WebGPU build is not universally pixel-identical to Windows.

Teruteru Wars, Futago and the retained V-Link WebGL compatibility build use CPU
replacements because VFX Graph requires compute shaders unavailable with OpenGL ES.
V-Link's five legacy ice replacements have dedicated mesh/flipbook
reconstructions using original assets; other graphs retain the small generic
particles. Original source checkouts are unchanged.
The editor helper restores the temporary prefab bytes after the
build, and the player displays a simplified-effects notice. This adaptation is
recorded as `simplifiedEffects` in the build metadata, with V-Link's dedicated
ice replacements also counted in `iceEffects`.

Compatibility reference:
https://docs.unity3d.com/Packages/com.unity.visualeffectgraph@17.3/manual/System-Requirements.html

Builds use content-hashed payload filenames under the canonical `v1` directory.
For a rebuild, regenerate and deploy the manifest with its matching payloads in
one GitHub Pages deployment. Changed content gets new URLs, not overwritten
cached bytes; Git retains previous revisions without duplicate project folders.
An in-progress download crossing deployments may need the player's Retry button.
Keep `sourceCommit` accurate when the upstream source revision changes.

## Verification Scope

The smoke test checks desktop/mobile page layout (1440x1080 and 390x844), actual
WebGL startup, nonblank canvas pixels, fullscreen, and that browsing the library
does not load game payloads. Recorded actions cover stage selection and movement
in Line Boundary and Hanten, unit placement in Teruteru, battle commands in
Futago, and character selection, battle startup, movement, attack and guard input
in V-Link. The wrapper tests also cover failed requests, retry, runtime errors and
image containment at widths of 320, 390, 900 and 1440 pixels.
Screenshots and logs are saved under `launcher/test-output/web/` (not published).
`node tests/vlink-selection-mask.cjs` checks V-Link's selection mask separately,
including actual WebGL stencil operations and reference-based image regions.
The selection test explicitly selects `?renderer=webgl`.
`tests/vlink-ice-smoke.cjs` exercises the default URL without GPU-selection flags,
checks repeated ice attacks and records ten seconds of battle frame submissions
on the browser's normal GPU. These observations are not cross-hardware FPS guarantees.
`node tests/vlink-webgpu-smoke.cjs` explicitly selects `?renderer=webgpu`, including selection
text/fur, real GPU compute work, four exercised attacks and fullscreen sizing.
`node tests/vlink-vfx-reference.cjs` captures the separate nine-prefab diagnostic;
its 36 frames cover all original effect graphs, including effects not triggered
by the normal attack smoke test. Reproduction commands and visual limitations are
documented in the migration report.
This is not a full playthrough or a guarantee of touch-only/mobile gameplay.

`node tests/web-fullscreen-native.cjs` checks all six actual Unity builds in a
headed Edge window, including startup, exit control, re-entry and Esc. A raw CDP
target avoids Playwright's focus emulation, which deliberately keeps native
windows out of fullscreen. The test does not force window bounds or use kiosk
mode: only the page's play button requests fullscreen. It checks the native
window state and that the viewport equals the monitor, not its taskbar-reduced
work area. On the verification PC these are 1920x1080 versus 1920x1032.
The fullscreen, canvas-containment and input tests run separately at desktop,
ultrawide, 4:3 and portrait sizes. Artifacts reuse `launcher/test-output/web/`.
