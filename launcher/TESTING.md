# Verification

Local verification on Windows x64, 2026-09-26.

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
- GitHub Release has not been published. Live GitHub download and in-place launcher self-update across two public releases are not yet verified.
- Builds are unsigned. Code-signing certificate setup is not included.
