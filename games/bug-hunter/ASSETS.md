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

Original procedural, articulated insect meshes with stylized colors, physically lit shells, detailed claws and wing veins; terrain, rooted trees, ferns, animated stream shader, and short synthesized notice tone.
No assets, characters, UI or code were copied from The Ants; it is a visual-quality reference only.

## Environment textures

Poly Haven CC0 photographs, original 1K JPEGs; Unity imports as compressed mipmapped textures.

- Forest Floor: https://polyhaven.com/a/forest_floor
  - eye-candy.xyz.
  - `Resources/Environment/Ground.jpg`, MD5 `d67f308e4b8be6a65989e8dc76ec40fe`.
- Forest Ground 04 (trail and stones): https://polyhaven.com/a/forest_ground_04
  - Rob Tuytel (photography/processing), Rico Cilliers (adjustment).
  - `Resources/Environment/Trail.jpg`, MD5 `6ad9df4d731a238299806f739a26af83`.
- Bark Brown 01: https://polyhaven.com/a/bark_brown_01
  - Rob Tuytel.
  - `Resources/Environment/Bark.jpg`, MD5 `b6d5dcde10b7cd1b36d70cd33a34724a`.
- Mossy Rock: https://polyhaven.com/a/mossy_rock
  - Rob Tuytel, CC0.
  - `Resources/Environment/Stone.jpg`, MD5 `a57fbbf55269eb64f8d40708fe3af26c`.
  - Used on the new boulders and river stones; the older Trail texture remains on paths only.
- License and redistribution permission: https://polyhaven.com/license
- Reproducible asset import: `../../tools/prepare-bug-hunter-art.cjs`.

## Generated foliage

- Built-in OpenAI image generation; genuinely transparent PNG, alpha retained.
- Canonical asset: `Assets/BugHunter/Resources/Environment/OakLeaves.png`.
- Final prompt: Use case: photorealistic-natural. Asset type: transparent foliage texture for cards on branches in a realtime 3D Japanese woodland game. Create one isolated natural spray of Japanese oak (Quercus acutissima) foliage, about 35 slender serrated green leaves connected by fine brown twigs, fanning organically outward from a short central branch. Botanical photographic realism with detailed veins, irregular natural leaf angles, rich medium and deep greens, several yellow-green new leaves, subtle mottling. Broad horizontal fan fills a square texture with comfortable transparent margin, branch base near bottom center. Flat diffuse daylight, neutral white balance, no cast shadow outside subject, no rim glow. Transparent background including real empty gaps between leaves. Entire twig and all leaf tips in frame, crisp anti-aliased cutout. No tree trunk, no pot, no insects, no ground, no scenery, no text, no border, no watermark. Not illustrated, not polygonal, not stylized, no clumps of triangles.
- Used on crossed 3D leaf cards with cutout shadows and slight wind displacement.
- Matching ground asset: `Assets/BugHunter/Resources/Environment/Fern.png`, also built-in image generation with alpha retained; imported at 512px.
- Fern final prompt: Use case: photorealistic-natural. Asset type: alpha-cutout fern texture for a realtime 3D woodland floor. One isolated realistic young Japanese woodland fern clump seen straight on at low eye level. Seven to nine arching delicate fronds radiate from a small base centered at the bottom, fine pinnate leaflets clearly visible, irregular organic silhouette, some fresh yellow-green tips and darker mature greens, detailed veins and natural variation. Photographic botanical realism, soft neutral diffuse daylight, no dramatic highlights or hard cast shadows. Whole plant entirely within square frame, compact mound about as wide as tall. Actual fully transparent background with transparent gaps between small leaflets. No pot, no ground, no soil, no scene, no insects, no text or watermark. Crisp cutout edges, no glow, no illustration, no triangular stylized leaves. The base rests just above the bottom transparent margin. Intended for crossed foliage cards in a 3D game, not an environment image.

## Interface icons

Lucide 0.468.0, from the repository's existing shared dependency.
128px white PNG rasterizations of the original SVG paths; no new icon library or runtime installed.
License: `Assets/BugHunter/Resources/UI/LICENSE.txt`.

## Navigation

Unity's built-in AI module supplies NavMesh building, pathfinding and local avoidance.
The battle simulation only applies an attack when its actor has reached and faced the opponent.
https://docs.unity3d.com/6000.0/Documentation/ScriptReference/AI.NavMeshBuilder.BuildNavMeshData.html

## Memory setting reference

Unity documentation: https://docs.unity.com/en-us/engine/6000.0/script-reference/unityeditor/playersettings/webgl

Web refresh-rate behavior: https://docs.unity3d.com/ja/6000.0/Manual/webgl-performance.html

Browser frame pacing API: https://emscripten.org/docs/api_reference/emscripten.h.html#c.emscripten_set_main_loop_timing
