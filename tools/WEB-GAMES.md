# Browser Games

The portfolio links to `play/`. Five Unity games run in the browser without
installing the Windows app or manually downloading an archive. Browsers still
download and cache the selected game's assets. The library does not preload all
five games. These games are designed for a PC with a keyboard and mouse.
Portfolio play links use the published HTTPS URLs, including when the portfolio
itself is opened as a local HTML file from a USB drive.

V-Link Battle uses the user's current `D:/Vlink` project in an isolated build copy.
Its native Windows effects are adapted to the game canvas. Details and provenance
are recorded in [vlink-web/README.md](vlink-web/README.md).

## Build

1. Install the exact editors listed in `launcher/data/game-sources.json`, including
   Web Build Support, using Unity Hub. A valid Unity license is required.
2. Prepare the source clones in `launcher/game-sources/` as described in the
   launcher README. Builds use the pinned commits, not uncommitted local edits.
3. Run `./tools/build-web-games.ps1`. Sources and intermediate outputs are isolated
   under `%TEMP%/portfolio-web-builds/` to avoid Unicode toolchain path issues.
   Logs are written to `launcher/test-output/*-web-build.log`.
4. Run `node tools/prepare-web-games.cjs`. This copies the five builds to `play/`,
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

Teruteru Wars, Futago and V-Link use VFX Graph, which requires compute shaders and does
not support OpenGL ES. Their Web builds replace those effect components with
small, colored CPU particle effects. Original source checkouts are unchanged.
The editor helper restores the temporary prefab bytes after the
build, and the player displays a simplified-effects notice. This adaptation is
recorded as `simplifiedEffects` in the build metadata.

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
This is not a full playthrough or a guarantee of touch-only/mobile gameplay.
