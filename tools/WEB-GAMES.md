# Browser Games

The portfolio links to `play/`. Four Unity games run in the browser without
installing the Windows app or manually downloading an archive. Browsers still
download and cache the selected game's assets. The library does not preload all
four games. These games are designed for a PC with a keyboard and mouse.
Portfolio play links use the published HTTPS URLs, including when the portfolio
itself is opened as a local HTML file from a USB drive.

V-Link Battle remains available in the Windows release because its Unity source
project is not present in this workspace.

## Build

1. Install the exact editors listed in `launcher/data/game-sources.json`, including
   Web Build Support, using Unity Hub. A valid Unity license is required.
2. Prepare the source clones in `launcher/game-sources/` as described in the
   launcher README. Builds use the pinned commits, not uncommitted local edits.
3. Run `./tools/build-web-games.ps1`. Sources and intermediate outputs are isolated
   under `%TEMP%/portfolio-web-builds/` to avoid Unicode toolchain path issues.
   Logs are written to `launcher/test-output/*-web-build.log`.
4. Run `node tools/prepare-web-games.cjs`. This copies the four builds to `play/`,
   records their checksums, and generates the library and individual game pages.
   `--ready` is for local incremental testing only; it includes completed builds.
5. Run `python build.py`, `python -m unittest discover -s tests`,
   `node --test tests/game-gallery.test.cjs tests/web-player-ui.test.cjs`,
   and `node tests/web-games-smoke.cjs`.
   Browser tests require the launcher's Playwright dependency and Microsoft Edge.
   Set `PLAYWRIGHT_CHANNEL` to test another installed Chromium browser.

## Hosting

Commit the generated `play/` assets and `.nojekyll` with the portfolio changes.
GitHub Pages publishes the `main` branch. Use an HTTP(S) server, not `file://`,
to run Web games. `node tools/web-test-server.cjs` serves just the Web player
and its images for local testing, using a free port printed at startup.

Unity's gzip decompression fallback is enabled because GitHub Pages cannot add
custom Content-Encoding headers. The `.unityweb` files therefore load without
special server configuration. Each file must stay below GitHub's 100 MiB limit.
Different game URL directories isolate Unity's browser save-data paths.
The player uses a fixed 1920x1080 drawing buffer and scales it with CSS, including
fullscreen mode. This preserves the fixed-pixel UI in the original Unity scenes;
automatically resizing Unity's drawing buffer clips those menus on small screens.

Teruteru Wars and Futago use VFX Graph, which requires compute shaders and does
not support OpenGL ES. Their Web builds replace those effect components with
small, colored CPU particle effects. Gameplay scripts and original source clones
are unchanged. The editor helper restores the temporary prefab bytes after the
build, and the player displays a simplified-effects notice. This adaptation is
recorded as `simplifiedEffects` in the build metadata.

Compatibility reference:
https://docs.unity3d.com/Packages/com.unity.visualeffectgraph@17.3/manual/System-Requirements.html

Builds are currently stored under `v1`. For later releases use a new version
directory and regenerate the manifest, retaining old assets during deployment.
Do not silently replace a published build with a different source revision.

## Verification Scope

The smoke test checks desktop/mobile page layout (1440x1080 and 390x844), actual
WebGL startup, nonblank canvas pixels, fullscreen, and that browsing the library
does not load game payloads. Recorded actions cover stage selection and movement
in Line Boundary and Hanten, unit placement in Teruteru, and battle commands in
Futago. The wrapper tests also cover failed requests, retry, runtime errors and
image containment at widths of 320, 390, 900 and 1440 pixels.
Screenshots and logs are saved under `launcher/test-output/web/` (not published).
This is not a full playthrough or a guarantee of touch-only/mobile gameplay.
