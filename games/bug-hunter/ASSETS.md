# Asset provenance

## App icon

- Tool: built-in OpenAI image generation, reference-image edit.
- Canonical asset: `Assets/BugHunter/Art/bug-hunter.png`.
- Website export: `../../files/game-icons/bug-hunter.png` (same bytes).
- Generated on 2026-09-27. No copied commercial game characters or logos.
- Reference: the earlier icon generated for this same project; changed from realism to anime style.

Final prompt:

> Edit this game app icon to match a cheerful anime-styled low-poly 3D insect collecting game, not realistic insect photography. Keep the rhinoceros beetle identity, branching horn, six legs, clear sunny woodland setting, cyan sky, square opaque composition and no text. Completely restyle the beetle: round compact lavender-purple armor shell, simple cel shading with broad flat color shapes and ivory highlights, large appealing black-and-white anime eyes, short segmented dark legs, exaggerated chunky Y-shaped horn. A charming brave creature, not a humanoid. The shell must be smooth stylized color without real microtexture, hairs or realistic pores. Simplify background into clean painterly green forest shapes and a warm wooden log, avoid detailed foliage clutter. Whole beetle and its horn and feet comfortably inside square frame, large central silhouette readable as a small game icon. Polished Japanese all-ages console game key art, dynamic front three-quarter view. No text, no watermark, no rounded border, no gradients or sparkles.

## Font

- Noto Sans JP Regular, language-specific subset OTF from the official Noto CJK repository.
- Source: https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf
- License: https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE
- Local filename: `Assets/BugHunter/Fonts/WoodlandJP.otf`; font contents unmodified.
- Bundled license: `Assets/BugHunter/Fonts/OFL.txt`.

## 3D and audio

Original procedural low-poly insect meshes, forest meshes, and short synthesized notice tone.
No external model packages, scanned textures or music recordings.

## Memory setting reference

Unity documentation: https://docs.unity.com/en-us/engine/6000.0/script-reference/unityeditor/playersettings/webgl

Web refresh-rate behavior: https://docs.unity3d.com/ja/6000.0/Manual/webgl-performance.html

Browser frame pacing API: https://emscripten.org/docs/api_reference/emscripten.h.html#c.emscripten_set_main_loop_timing
