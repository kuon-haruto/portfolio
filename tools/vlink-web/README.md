# V-Link Web Adaptation

Source: `Allow-hub/VBattle`, commit `f880cf1582ccda1e9aae945cea72e2a5159514f5`,
Unity 2022.3.50f1. The user's active checkout is `D:/Vlink`; never modify it for a
Web build. Clone it into `%TEMP%/portfolio-web-builds/sources/v-link-battle`, or
prepare the pinned repository under `launcher/game-sources/v-link-battle` before
running `tools/build-web-games.ps1 -Ids v-link-battle`.
When no local source clone is available, the build script clones the pinned
repository directly. The temporary import cache can therefore be removed after
verification; do not keep duplicate projects merely as version history.

`prepare-vlink-web.cjs` restricts its writes to that isolated temporary checkout.
It verifies the commit and checks previously generated file hashes before
updating the known adaptations. Unexpected edits in those files cause a failure,
not an overwrite. The original C# animation methods are retained verbatim.

## Differences From Windows

- Native notification, image and gimmick windows are drawn inside the Unity
  canvas. The original factory, pooling, animation and collider logic use the
  same window API and coordinate system through `BrowserWindowSurface`.
- Windows system-tray controls and OS mouse injection are omitted. Browser
  close/fullscreen controls and Unity's existing gamepad UI event path are used.
- The unused external-browser window class does not launch another application.
- The existing game-view utilities use the Web canvas origin rather than an OS
  window position. Original combat, characters, controls and NPC logic remain.
- VFX Graph components use the shared CPU particle fallback.
- The built battle scene disables its development-only debug roster, so actual
  character and NPC selections are respected. The source prefab is unchanged.
- Selection-screen materials using stencil reference 1 get a scene-local Web
  shader that preserves their stencil operations, textures, blending and render
  queues. The original lilToon shaders fall back to URP Unlit on the tested WebGL
  build; that fallback omits stencil state, exposing the characters' legs in front
  of the frames. `SelectionUnlit.shader` uses the same URP Unlit forward shading
  with the missing stencil state restored. Character transforms, animations,
  source materials and battle-scene materials are not changed by this fix.
- Scene video clips are served as separate MP4 URLs rather than embedded clips;
  see [Unity video sources](https://docs.unity3d.com/2022.3/Documentation/Manual/Video.html).
- The user's uncommitted `Ame_Neutral_W.asset` edit (`hitTiming: 0`) is preserved
  in the isolated Web copy. The source checkout and its Git history are unchanged.

The generated game icon is in `files/game-icons/v-link-battle.png`. Its generation
prompt and reference provenance are saved alongside it in `v-link-battle-icon.md`.

Run `WEB_TEST_GAME=v-link-battle node tests/web-games-smoke.cjs` (set the environment
variable with the current shell's syntax). This verifies actual WebGL startup and
the actions in `tests/web-game-actions.json`; it is not an exhaustive playthrough.

`node tests/vlink-selection-mask.cjs` additionally checks actual stencil writer
and reader draws, hidden legs, visible heads and held panels at desktop/mobile
sizes and desktop fullscreen. Its image regions come from the user's native
selection-screen reference. The unpatched build fails this regression check.
