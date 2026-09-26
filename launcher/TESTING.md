# Verification

Local verification on Windows x64, 2026-09-26.

## Version 0.2.0

- Renamed the visible application to `アプリインストーラー`; retained the internal app ID and the explicit `%APPDATA%/zenta-game-library` data directory.
- Generated a dedicated PNG icon and verified that all seven icon sizes in the ZIP executable's PE resources match electron-builder's ICO output. Windows file-association thumbnails are not used as evidence of the embedded icon.
- `node --test tests/*.test.cjs`: 9 tests passed, including identity preservation, branding, separate ZIP output, and portable distribution metadata.
- `node tests/portable-smoke.cjs`: built ZIP extracted into an isolated directory, app launched without setup, five games shown, app name and image verified. Installer-based update calls were rejected; the ZIP edition's release-page button was verified without opening an external browser.
- The extracted ZIP app passed renderer checks at 1220px and 880px widths and installed/launched Futago from its bundled archive using isolated test data.
- Portfolio regression checks: 12 Python tests and 7 JavaScript tests passed. Its download buttons now prefer the ZIP edition; unrelated existing portfolio changes are not part of the launcher release commit.
- The ZIP edition keeps game updates in-app but deliberately uses manual ZIP replacement for application updates. This avoids silently installing the normal edition.
- Public release: https://github.com/kuon-haruto/portfolio/releases/tag/launcher-v0.2.0 . All 11 assets were uploaded and verified against their local SHA-256 digests. The ZIP is 1,128,999,635 bytes and the installer is 1,058,043,551 bytes; both public download URLs returned HTTP 200.
- The final normal-edition packaged app fetched the public game catalog and `latest.yml` through `live-release-smoke.cjs`, reporting that version 0.2.0 is current. The final packaged UI and game-update success/failure smoke checks also passed.
- Upgrade of an existing 0.1.0 installation through its automatic updater remains unverified. Builds remain unsigned.

The following sections record the earlier 0.1.0 verification.

## Automated checks

- `pnpm test`: 7 tests passed. Catalog validation, numeric version ordering, Windows-safe paths, HTTPS allowlist, checksum and exact-size verification, cancellation, ZIP extraction limits, traversal/symlink/case-collision rejection, failed-update rollback.
- `pnpm test:ui`: Electron renderer passed at 1220px and 880px window widths. Five game entries, local images, search, metadata, tabs, and update dialog verified; no renderer exceptions or horizontal overflow.
- `pnpm test:update`: Update UI passed with a mocked transport in the isolated test process. Version 1.0.0 changed to 1.1.0; a corrupt 1.2.0 download was rejected without damaging 1.1.0. Production transport restrictions are unchanged.
- Portfolio regression checks: 7 JavaScript tests and 8 Python tests passed. Launcher work does not modify portfolio source files.

## Game builds and launch checks

- Futago: built from the recorded Git commit with Unity 6000.4.3f1; installed and launched through the launcher.
- Line Boundary: built from the recorded Git commit with Unity 6000.3.1f1; installed and launched through the launcher.
- Hanten Assassination: built from the recorded Git commit with Unity 6000.3.1f1; installed and launched through the launcher.
- V-Link Battle: packaged from the supplied existing Windows build; installed and launched through the launcher.
- Teruteru Wars: built from the recorded Git commit with Unity 6000.3.1f1 and launched through the launcher. An ASCII-only temporary clone resolved the original build's corrupted non-ASCII source path. No game source changes were needed.

Launch checks verify ZIP integrity, extracted files, the installed version marker, and a live Unity process after selecting Play. They do not establish that every level or gameplay interaction is correct. Screenshot and player-log output is stored locally in the ignored `test-output/` directory.

## Distribution

- Unpacked Windows launcher built successfully.
- NSIS installer built (1,056,973,775 bytes) and installed successfully into the per-user Programs directory. The installed, packaged app successfully installed and launched Futago with isolated test data.
- Public release: https://github.com/kuon-haruto/portfolio/releases/tag/launcher-v0.1.0 . All ten uploaded assets were verified against their local SHA-256 digests.
- The installed app downloaded Futago from the public GitHub asset, verified it, extracted it, and launched the executable successfully. Both the public game catalog and the launcher's latest-version feed were checked from the installed UI.
- A fresh sparse clone of source commit `9ad1465` successfully ran `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm fetch:games`, and `pnpm dist`. The resulting installer is in the local ignored clone-verification directory. It is not expected to be byte-identical because build timestamps and generated installer metadata differ.
- In-place launcher self-update across two different public app versions is not yet verified; this is the first public app version. Version detection, public feed access, the NSIS installer, and game-update success/failure paths have been verified separately.
- Builds are unsigned. Code-signing certificate setup is not included.
