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

## Ice Effects And Native Windows Audit (2026-09-27)

The local source still uses Unity 2022.3.50f1, URP 14.0.11 and VFX Graph 14.0.11,
at the same pinned commit as the published build. No Unity upgrade or upstream
source edits were made for this audit.

- `IceWall`, `Ame_IceSlash`, `Ame_IceExplosion`, `Ame_FlyingSlash` and `BladeStorm`
  contain VisualEffect components. The shared `PortfolioWebEffects` build helper
  removes those components and adds generic CPU particles. The build log and
  published manifest both record 14 replacements in total (not 14 distinct moves).
- The fallback does not inspect the graph's mesh, texture, emission shape or
  exposed properties. It emits up to 48 small particles, fading after 0.3-0.7s.
  Ice has no dedicated color/shape rule. Consequently the original ice wall,
  slash and explosion silhouettes are not reproduced. This is a fidelity gap in
  our Web adaptation, not proof that an older Unity version alone is responsible.
- The mesh-based ice guard is visible in actual Web battle screenshots. Not
  every ice object is missing; a blanket shader/version diagnosis is inaccurate.
- `WindowClassManager` originally calls Win32 `CreateWindowEx`. The Web adapter
  replaces handles with `BrowserWindowSurface` entries and draws their textures
  and text through `OnGUI`. Position, visibility, pooling and the original
  animation methods are retained. These are in-canvas imitations, not Windows
  desktop windows; OS taskbar entries, native chrome and external-window behavior
  cannot be preserved by that implementation.
- The source battle prefab (`Prefabs/InGame/InGame.prefab`, component
  `7102736807134503929`) already has `BattleGimmickManager.m_Enabled: 0`.
  `WorkScene_A` instantiates it without an enable override; `GameStartUp.Init`
  initializes the manager but neither it nor `Singleton.Init` enables it.
  In addition `BattleGimmickManager.cs` comments out registration of the moving
  window-wall gimmick. Thus periodic notifications/window walls cannot simply
  be assumed active even in the native source. This is distinct from Web API
  compatibility. Do not re-enable disabled gameplay features without confirming
  the intended source behavior.
- Countdown and special-attack popup code use the same adapted window factory.
  The ordinary battle smoke test does not verify every notification, countdown
  or ultimate popup; source adaptation is not evidence that all those cases
  rendered correctly. An exact native/Web comparison remains necessary for
  those sequences before claiming complete visual equivalence.

Recommended repair: retain the current Unity version initially and create
per-effect Web-compatible mesh/ParticleSystem replacements using the original
ice materials/textures, preserving attack lifetimes and colliders. A version
upgrade alone does not remove this WebGL rendering limit, and the currently
published CPU fallback would still replace the graphs until changed.

References: [VFX Graph 14 requirements](https://docs.unity3d.com/Packages/com.unity.visualeffectgraph@14.0/manual/System-Requirements.html),
[Unity 6 WebGL graphics](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-graphics.html),
[Web native plug-ins](https://docs.unity3d.com/2022.3/Documentation/Manual/webgl-native-plugins-with-emscripten.html).
