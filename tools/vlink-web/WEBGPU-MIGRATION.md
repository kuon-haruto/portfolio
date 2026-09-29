# V-Link WebGPU Migration

## Target

Use an updated Unity editor and the original VFX Graph assets in WebGPU. Validate
the migration before publishing, then remove avoidable visual differences from
the Windows original. A successful build or nonblank canvas alone is not proof
of equivalent effects.

## Canonical Locations

- Original project: `D:/Vlink`, source commit `f880cf1582ccda1e9aae945cea72e2a5159514f5`.
- Reproducible build adapters: this portfolio's `tools/` directory.
- Single migration workspace: `%TEMP%/portfolio-web-builds/sources/v-link-battle`.
- Single build output: `%TEMP%/portfolio-web-builds/output/v-link-battle`.
- Small, separate VFX test program: `%TEMP%/portfolio-web-builds/output/v-link-battle-vfx-check`.
- Comparison evidence: `launcher/test-output/vlink-vfx/`.

The original checkout has pre-existing edits; preserve them. Do not publish the
migrated player until validation passes. The existing WebGL player is retained
as a compatibility build. Reference images for different rendering backends are test
fixtures, not duplicate project versions.

## Configuration

Unity `6000.3.17f1` with matching Web Build Support. Build with:

```powershell
./tools/build-web-games.ps1 -Ids v-link-battle -VLinkWebGPU
```

This explicitly selects WebGPU, disables CPU replacement effects and keeps the
original selection shaders for testing. It rejects a build that has lost the
original VFX components. It does not silently fall back to WebGL with missing VFX.
The preparation pins the package versions used by this migration, including
URP/VFX Graph 17.3.0 and uGUI 2.0.0 (which incorporates TMP). On a fresh source
checkout the wrapper installs the matching official TMP shader resources and
settings version from the Unity editor's bundled uGUI package before starting
the initial Unity 6 API/package import. Editor helpers are also installed before
that first compilation. Source reconstruction has now been exercised end to end:
177 audited tracked files were restored to the pinned original, and 68 generated
files were removed in the same workspace. Existing Library/package caches and
the user's .vscode settings were retained; this was not an empty-cache/network
installation test. The wrapper completed the initial API upgrade and full WebGPU
build, followed by the TMP startup check and actual-browser smoke test.

## Verification Gates

- [x] The local Edge browser can request a WebGPU adapter.
- [x] Matching Unity 6.3.17f1 Web Build Support installed.
- [x] Capture original Unity 2022 ice effects at fixed times/camera/seed (20 frames).
- [x] Upgrade/import and full build without C# or shader compilation errors (fur adaptation is under separate verification below).
- [x] Compare Unity 6 native captures with the original reference (differences still under review).
- [x] Build and run original VFX on actual WebGPU, without replacement particles.
- [x] Review the nine VFX prefabs' fixed-step silhouettes/colors, with live-time limitations recorded below.
- [x] Check character shaders, selection masking, exercised battle actions and three fullscreen sizes.
- [x] Handle unsupported browsers honestly and retain an appropriate working path.
- [x] Publish only validated artifacts and verify the public player.
- [x] Consolidate the reproducible source changes and remove disposable build data.

`PortfolioVfxReference.Begin` captures nine original effect prefabs using their
actual VisualEffect components. Set `PORTFOLIO_VFX_REFERENCE_OUTPUT` to an absolute
evidence directory and run without `-quit`; the capture exits the editor itself.

`tests/vlink-webgpu-smoke.cjs` checks real WebGPU creation, dispatches, runtime
errors and rendered battle frames. It records shader sources for identifying VFX
compute work. Dispatch counts include other GPU work and are not, by themselves,
proof that every original effect is visible. Image comparison remains required.

## Evidence So Far

The native Direct3D11 reference has 20 samples: five original ice prefabs at
6/18/42/72 simulation steps, seed 73 and a fixed camera. After Unity's upgrade to
6.3.17f1 / URP 17.3 / VFX Graph 17.3, all four ice-wall frames match exactly.
Explosion foreground mean RGB errors range from 0 to 0.0035 (normalized 0..1).
Slash/flying-slash particles and the storm's animated texture differ, so those
need further temporal/randomness analysis, not a claim of identical rendering.
An expired slash reports uint.MaxValue for aliveParticleCount in both versions;
particle counts alone must not be treated as reliable visibility evidence.

The WebGPU diagnostic now captures all 20 frames on a real Edge WebGPU device,
with compute shaders enabled and no GPU validation errors or device loss. All
five effects are visible. Matching the original reference's ARGB32 render target
removes the HDR/LDR capture mismatch: all four ice-wall frames match exactly.
Metrics exclude a fixed 144x24 bottom-right development-watermark region from
both images; original screenshots are retained unchanged. The diagnostic's
opaque presentation shader avoids applying render-target alpha a second time.
The opaque presentation test did not remove the later explosion brightness
difference (foreground normalized mean error 0.1102 at frame 72). It is not
merely a second application of render-target alpha. The connected Time nodes in
IceSlashShader and UpStrongShader explain part of the slash/storm pattern-phase
differences even with paused, fixed-step VFX simulation. Do not remove the
original animation just to make static test frames equal.
The texture audit then identified a concrete range loss: FireBall04_8x8.exr is
BC6H on Standalone but imports as RGBA_DXT5_SRGB for automatic Web compression.
The migration helper now overrides only the Web import to RGBAHalf, preserving
HDR without requiring optional BC support. Native texture settings stay intact.
The rebuilt diagnostic confirms the HDR correction: normalized foreground RGB
error at frame 72 fell from 0.1102 to 0.0174, with silhouette IoU 0.9905. Earlier
samples are 0.0002/0.0024/0.0111. The original native texture is BC6H-compressed;
the Web texture preserves the uncompressed half-float source. The explosion's
bright center, smoke and original particle structure are restored, not replaced.
Flying-slash particle positions match the upgraded native reference; their
difference from 2022 originates in the engine upgrade, not missing WebGPU VFX.
An all-pixel RGBA check, not just the foreground metric, confirms zero differing
pixels for all four flying-slash frames against native Unity 6, and all four
ice-wall frames against native Unity 2022: 687,744 pixels per frame after the
fixed watermark exclusion. `compare-vlink-vfx.cjs` now reports this count too.
Slash/storm global texture phase remains variable. Do not describe the entire
game or all individual particles as pixel-identical.

The migration exposed duplicate `skip_variants` shader errors in lilToon 1.10.3.
The WebGPU preparation backports the narrow importer fix described in upstream
[lilToon #407](https://github.com/lilxyzw/lilToon/pull/407). It keeps the original
shader version, material properties and fur behavior rather than changing them
through a major shader upgrade. `PortfolioVLinkMigration.Prepare` regenerates all
65 cached shader files using the installed package's settings and rejects any
remaining duplicate directives. The diagnostic build now passes that check.
The upgrade also leaves URP's deprecated compatibility flag enabled; the helper
explicitly selects Render Graph in the upgraded settings. Full-game shader
compilation and visual verification remain gates.

The first full-game build retains all 14 original VisualEffect components but
exposed two further lilToon/WebGPU issues: fragment-only reflection keywords are
undefined while parsing unused vertex lighting functions, and the fur motion
pass returns geometry-stage inputs instead of a vertex position. Narrow WebGPU
patches are prepared for those paths. Geometry-based fur itself is not supported
by WebGPU and must be reviewed separately; retaining the source shader is not
proof that fur renders. The second build still reports the reflection keyword
error in FORWARD_BACK, so the fallback now also covers disabled fragment
variants, not only vertex-stage preprocessing. The full build now succeeds with
zero shader errors, all 14 original VFX components, and zero CPU replacements.
The real-device browser test reaches battle and exercises four ice attacks, with
46 compute shader modules, over 112,000 dispatches, no GPU validation errors or
device loss, correct selection stencil masking and three fullscreen sizes.
First-use shader warm-up delays the pick animation; the test now waits for the
actual held-panel pose rather than weakening its visibility thresholds.

Visual review found an additional migration regression: selection TMP text
rendered as solid cyan quads. The old TMP shader reads SDF scale from UV1.y,
whereas uGUI 2.0's mesh uses UV0.w. The preparation script upgrades only the 17
existing shader/include assets from the installed official TMP Essential
Resources package, checks their original GUIDs and leaves fonts/settings intact.
The rebuilt player passed the real WebGPU smoke test on 2026-09-29, including the
text check: cyan ink coverage is 0.2397 instead of the broken shader's 0.5579.
The 20 captured game views include selection, four attacks and fullscreen at
390/2560/1024px. There were zero runtime/GPU errors or device losses, with 39
compute modules and 49,469 dispatches in this run. Timing/dispatch counts vary
with the live battle, so use the diagnostic's fixed-step comparisons for fidelity.
The test waits for the actual blue/pink selection background after loading and
records a final canvas image even on failure. Both panels remain visible, with
both characters clipped behind the lower selection frames.
This was local validation before publication.

The subsequent fur-enabled build was intentionally interrupted because this
batch-mode editor repeatedly opened an unresponsive TMP Importer window. The
upgraded shader resources were present, but the existing TMP Settings asset
lacked the official package's `assetVersion: 2` marker. Preparation now reads
that version from the installed Essential Resources package and updates only
the marker after successfully upgrading the shaders; original font references
and settings are preserved. The interrupted build's five temporary prefab
changes were reversed, without touching `D:/Vlink`. A separate editor startup
check exited successfully with
`PORTFOLIO_TMP_RESOURCES_VERIFIED: importerWindows=0` after a five-second check
(`launcher/test-output/vlink-tmp-resources.log`). The interrupted output was
discarded. Subsequent full rebuilds completed without reopening the importer;
their fur integration and runtime evidence are described below.

The packager preserves the previously verified WebGL payload exactly once in
`play/builds/v-link-battle/webgl/Build`; subsequent WebGPU updates reuse it after
SHA-256 verification. This is an intentional compatibility artifact, not an old
project copy. The player probes a real WebGPU adapter before downloading the
new payload, chooses WebGL when unavailable, and offers an explicit compatibility
retry after GPU startup failure. Unit/UI tests cover these paths. Actual-game
WebGPU battle, the updated TMP resources and WebGL compatibility checks have
passed. Remaining fidelity work is not waived by these smoke-test results.
The old WebGL mask/ice tests explicitly request `?renderer=webgl`; WebGPU has its
own real-device smoke test. The unchanged WebGL selection passed at desktop,
fullscreen and 390px-wide viewports with the updated wrapper.

The diagnostic build uses `PortfolioVfxDiagnosticBuild.Build` and the runtime
component in this directory, copied to the isolated project's Editor and runtime
folders only when requested:

```powershell
./tools/build-web-games.ps1 -Ids v-link-battle -VLinkWebGPU -VLinkVfxDiagnostic
```

It builds only the nine original effect prefabs and a camera, not
a second copy of the game. The component is excluded from non-development players.
`node tests/vlink-vfx-reference.cjs` drives that build, captures the same 36 WebGPU
frames, and refuses non-WebGPU rendering. Then use `tools/compare-vlink-vfx.cjs`
with the two evidence directories to measure silhouette/color differences.

The expanded diagnostic covers all 14 VisualEffect components across the nine
prefabs, including the original active/inactive child states. HitEffect,
Ame_CloneAttack, Ame_Flower and BreakShield are now compared against Unity 6
native captures at four simulation times each. All nine prefabs produce visible
WebGPU output; the 36-frame run has zero runtime/GPU errors or device loss.
IceWall and FlyingSlash match the native Unity 6 captures pixel-for-pixel at all
four times. HitEffect differs in only 38 pixels at frame 6 and matches thereafter;
Flower's silhouette IoU is 1.0, and BreakShield's is at least 0.99699.
CloneAttack retains its dense blue ring but differs in particle/texture pattern
(IoU 0.819..0.936); this is not a pixel-identity claim. Its Blue.vfx contains a
connected built-in time node with flag 1024, which the installed VFX package maps
to GameTotalTime, not the component's simulated time. Thus matching seed and
simulation steps does not synchronize that original animated deformation.
The live-time-dependent
slash/storm patterns also remain variable. Original 2022 evidence covers only
the first five ice prefabs (20 frames), not the four newly added subjects.
`compare-vlink-vfx.cjs --allow-extra-candidates` explicitly records extra samples
as unexamined when comparing against that smaller reference set.

The first-import TMP bootstrap now reads the official uGUI 2.0.0 resources from
the installed editor, without needing a pre-existing Library/PackageCache.
The bundled and imported package archives have identical SHA-256 hashes
(`58564ec64cef8a8cea3d0b8ffb5e6fecf4176d544a2f6a29a2b43a0a33256431`).
The new path successfully reapplied all 17 shader resources and the settings
version both in the existing workspace and after source reconstruction. The
reconstructed full build again records 14 original VFX components and zero CPU
replacements. A separate restart reports `importerWindows=0`. Its 20-view WebGPU
test passed with 46 compute modules, four fur renderers and zero runtime/GPU
errors or device loss. The packaged download is 301,469,910 bytes; the retained
WebGL compatibility payload is unchanged at 281,561,126 bytes.
The re-created wasm/framework/loader hashes equal the previously verified
build; regenerated asset data has a new content hash. Other five games are
unchanged, and all 16 integrity/portfolio tests and 21 UI/package tests pass.
The UI tests include a cached pre-WebGPU page without the new compatibility
button; it still initializes and can recover using its existing Retry button.

## Fur Fidelity

- The previous WebGPU player lacks the fur visible on the native reference's
  collar/cuffs. Its actual
  material uses `ltsmulti_fur.shader` (not the non-multi fur shader), with the
  third-party fin geometry branch in `lil_common_vert_fur_thirdparty.hlsl`.
  `robe.baked.asset` has 3,244 vertices and 5,346 triangles. Both Robe materials
  use two fur layers, mesh type 1, length 0.07, gravity 0.175 and randomness 0.61.
  The length mask is `Material/Texture/Mask/robe_far_mask.png`; vector texture is
  unassigned and vertex-color direction is disabled. Selection fur must retain
  stencil reference 1 / Equal. Native battle fur uses Always / reference 0.
  `PortfolioFurRenderer` now uploads the posed source vertices into a structured
  buffer. A static fin topology and vertex shader reproduce the original
  post-skinning geometry calculations, including vertex-ID noise, two layers,
  world-space gravity and the length mask. The fragment shader is generated from
  the installed original lilToon shader, not a new approximate material.
  Matching the source renderer's transparent sorting center was essential:
  the initial version lost some overlapping fur. On the Unity 6 D3D11 reference
  at 960x960, the corrected version matches all 27,236 fur-affected pixels in
  coverage, with only 47 pixels differing in RGB (normalized mean error
  0.0000001206). This is a fixed-pose Unity 6 native test, not yet evidence of
  full-game animation or browser fidelity. Its three images and metrics are in
  `launcher/test-output/vlink-vfx/fur/`.
  The dedicated WebGPU diagnostic also passed on an actual Edge WebGPU device,
  with zero runtime/GPU errors or device loss. Against the native geometry
  reference, fur coverage IoU is 0.99385 and normalized mean RGB error is
  0.00023115; evidence is in `launcher/test-output/vlink-vfx/fur-webgpu/`.
  VRM-aware update ordering and world-bounds changes retain the 47-pixel native
  result and have now been exercised in full-game browser tests.
  Full-game preparation found six renderers across five prefabs and attached
  two renderers in each of SelectScene and WorkScene_A. The first completed
  integration revealed a scale bug that the unit-scale pose had not covered:
  this mesh's CPU-baked positions, normals and tangents retain inherited model
  scale, which the new MeshRenderer applied a second time. Selection uses a
  scale of 573.30005. Fur disappeared there and was displaced in battle.
  The adapter now removes that scale before the original object-to-world
  transform. Native comparisons at scales 1, 3 and 573.30005 report respectively
  47, 88 and 49 differing pixels out of the 960x960 image, with fur coverage IoU
  1.0, 0.99990 and 0.99994. Evidence is in `fur/scale-1`, `fur/scale-3` and
  `fur/scale-573`. Nonuniform scaling is rejected rather than silently distorted.

The corrected full-game WebGPU build completed and passed the real-device smoke
test on 2026-09-29. Four fur components initialized across selection and battle;
visual inspection confirms collar/cuffs in selection and correctly attached fur
during attacks. The test now checks light-fur coverage in the native reference's
cuff/collar regions, not just component initialization: the NVIDIA run measures
0.383 / 0.355, versus 0.065 / 0.096 with the broken adapter. Both legs remain
hidden behind the selection frames, both held panels are visible, and TMP ink
coverage is 0.2396. Twenty views cover selection, four repeated ice attacks and
fullscreen at 390/2560/1024px. Runtime/GPU errors and device losses are zero.
This proves the exercised cases, not pixel identity for every animation frame.
The five temporary prefab edits were restored after each completed build.
This was local validation before publication.

## Hardware Timing

The default Edge test selects the Intel Gen-12LP adapter on this dual-GPU laptop,
whereas native Unity uses the RTX 4070. Default browser animation callbacks were
only about 3.6/s during battle. Both `low-power` and `high-performance` adapter
requests still returned Intel in that browser configuration. A temporary Edge
launch with `--force-high-performance-gpu` selects NVIDIA Lovelace; no persistent
Windows/browser settings were changed. The same payload passes on both adapters.
The final NVIDIA run recorded 125 canvas texture acquisitions over 3.012 seconds
(about 41.5/s), with 108.9 browser animation callbacks/s. The latter must not be
reported as game FPS. Counts and timings vary with the live NPC battle; they are
local observations, not performance guarantees. See
`launcher/test-output/vlink-vfx/webgpu/hardware-timing.json` and `report.json`.
The source-reconstruction retest recorded 135 acquisitions over 3.048 seconds
(44.3/s), but also ten browser callback intervals over 100 ms. These counts
must not be presented as a guarantee of smooth or constant game FPS.

This agrees with Chrome's documented
[Windows GPU-selection limitations](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips#windows-specific_limitations):
the browser's allocated GPU is reused, and the page's `powerPreference` cannot
switch it there. The real GPU requirement and any compatibility choice must
remain explicit; a WebGL run does not verify original WebGPU effect fidelity.
Use `$env:VLINK_TEST_GPU='high-performance'` before the smoke-test command to
repeat the discrete-GPU test; omit it to test normal browser selection.

## Motion-Priority Default

Following the user's severe-stutter report, the wrapper defaults to the existing
WebGL compatibility build instead of treating WebGPU availability as a performance
check. This changes only build selection, not either payload or the original Unity
project. The visible selector labels WebGL as motion-priority with simplified
effects, and WebGPU as original-effects/high-load. Selecting a mode reloads into
`?renderer=webgl` or `?renderer=webgpu`; no persistent high-load preference is saved.
Original WebGPU assets and the fidelity test remain available unchanged.

The default path makes no WebGPU adapter request and downloads only the selected
build. An unsupported explicit WebGPU choice falls back visibly, and successful
but slow WebGPU sessions can now switch modes without requiring a load failure.
The fixed 1920x1080 drawing buffer is preserved to avoid clipping the original UI.
`tests/vlink-ice-smoke.cjs` exercises the default path on normal browser settings
and records main-canvas draw submissions per animation interval separately from
the browser callback count. See `launcher/test-output/vlink-ice/browser.json`.
The local retest on normal Intel UHD/D3D11 recorded 391 rendered intervals in
10.011 seconds (about 39.1/s), a 30.4 ms 95th-percentile interval and no intervals
over 100 ms during that sample. Nine attack attempts also exercised the simplified
ice renderer. This is a local observation with a live NPC, not a guaranteed FPS
or a claim that WebGL matches the original VFX.

## Public Verification

Commit `bebf4893e8add29b2d540ff22e754196b840ebf3` was published successfully by
[GitHub Pages run 36543529860](https://github.com/kuon-haruto/portfolio/actions/runs/36543529860).
The public `play/games.json` matches the local verified manifest. The actual
[published player](https://kuon-haruto.github.io/portfolio/play/v-link-battle/)
passed the 20-view WebGPU smoke test in Edge 154.0.4258.37 on the NVIDIA adapter:
46 compute modules, 147,105 dispatches, four fur renderers, and zero runtime/GPU
errors or device losses. The tested selection, attacks and fullscreen sizes are
the same as the local reconstruction test; this was not a redirected local build.
The published WebGL compatibility URL also passed the actual-game selection-mask
test at widths 1440 and 390, including desktop fullscreen. Both held panels and
heads were visible, legs were clipped, stencil writer/reader states were recorded,
and no runtime errors occurred. Its binary payload remains byte-identical to the
previously published WebGL game, relocated to the explicit compatibility path.

Completed diagnostic players (`v-link-battle-vfx-check` and
`v-link-battle-fur-check`) and the temporary reconstruction script/recovery patch
were removed after validation: 396,765,249 bytes of files by logical size.
Comparison PNGs/reports, the original project, the one current migration cache,
the current full build and the WebGL compatibility payload remain. Diagnostic
players can be regenerated with the documented build commands. The cleanup
record is `launcher/test-output/vlink-cleanup.json`.

## Known Limits

- Preserve the original animated slash/storm texture behavior. Global shader
  time is not frozen by fixed-step VFX simulation; image-phase differences must
  not be hidden by removing the original animation.
- The nine-prefab comparisons and exercised gameplay paths do not prove pixel
  identity for every animation frame or equivalent performance on all hardware.
  Native Windows desktop windows remain in-canvas adaptations, as documented
  in the WebGL/native-window audit; browsers do not expose the original Win32 API.
- Source reconstruction passed with existing import/package caches retained.
  An empty-cache installation is not claimed. The manifest guard accepts
  equivalent JSON ordering without rewriting it, but rejects unknown dependency
  changes. Keep the single current cache for reproducible incremental builds.

## Fur Reproduction

Run `PortfolioFurReference.Begin` in the existing migration editor with
`PORTFOLIO_FUR_REFERENCE_OUTPUT` pointing at the absolute evidence directory.
It captures original geometry fur, portable vertex fur and a no-fur baseline
without saving the temporary scene to the source project. Build the small
browser diagnostic separately from the game:

Set `PORTFOLIO_FUR_REFERENCE_SCALE` to `1`, `3` or `573.30005` for scale-regression
captures, using the matching evidence directory in `PORTFOLIO_FUR_REFERENCE_OUTPUT`.

```powershell
./tools/build-web-games.ps1 -Ids v-link-battle -VLinkWebGPU -VLinkFurDiagnostic
node tests/vlink-vfx-reference.cjs --fur
node tools/compare-vlink-fur.cjs launcher/test-output/vlink-vfx/fur launcher/test-output/vlink-vfx/fur-webgpu
```

The full build adapter prepares only the two original Robe materials, preserves
their stencil/blend settings, and restores the cached source prefabs after the
build. It does not edit `D:/Vlink`. The diagnostic build output has its own small
`v-link-battle-fur-check` directory; it is not another full project copy.
