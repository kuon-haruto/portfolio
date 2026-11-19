# Live 2D Puppet Duo

Canonical component: `puppet.js`. No deployment or Git operations performed.
All authored files and browser evidence are contained in this directory.

```js
import {mount} from './puppet/puppet.js';
const cleanup = mount(stage, {mode: 'home'}); // or 'title'
// On route teardown:
cleanup();
```

The parent owns stage dimensions and placement. The component fills the stage,
leaves central title copy interactive, and does not change parent markup or CSS.
The existing local integration imports it on both routes:
http://127.0.0.1:4188/launcher/test-output/title-home-review/#title
http://127.0.0.1:4188/launcher/test-output/title-home-review/#home

## Artwork and Sources

`art.js` contains original, clothed, layered SVG illustration, not isolated model
renders, a generic placeholder, or a copy of the user's mood/composition image.
The game's available select/cut-in images were inspected; they are flattened
model imagery, not separable illustrated puppet parts. The authored rig follows
the actual game's identity and clothing rather than the reference image's costume:

- Ame: silver-blue asymmetric fringe, animal ears, star ornament, collar ring,
  pale shirt, purple tie, dark lapelled vest, snowflake-like brooch/chain,
  fur-trim cape, belt and dark gloves.
- Terami: short blue hair, ruffled cap, diamond earring, brown puff sleeves,
  dark gold-buttoned waistcoat, neck ribbon and belt.

Observed sources (read only): `../ame-idle.png`, `../terami/desktop-duo.png`,
`D:/Vlink/Assets/TechC/VBattle/Images/Ame/CutInTransparent.png`, and the existing
Terami model-conversion provenance in `../terami/conversion.json`.
The real featured app icon is reused directly from
`files/game-icons/sliding-space-parking.png` in the portfolio root.
This is an authored 2D interpretation, not an official character illustration.

## Motion and Interaction

One requestAnimationFrame loop coordinates breath, lean, delayed hair movement,
blink, pupils, idle glances, periodic invitations, and two-bone arm articulation.
Both characters present the icon with two hands; a greeting lifts one outer arm,
then the partner responds after 450 ms. Foreground finger layers overlap the icon.
Hit buttons remain fixed while the illustration moves. The icon and CTA both
open the existing local work detail. Title mode has no icon or extra CTA.
Reduced motion does not schedule a continuous animation loop; direct interaction
still updates gaze/text. Visibility changes suspend animation. Cleanup removes
DOM, handlers, resize observation and pending animation frames.

## Verification

Run with the existing server on port 4188 and existing launcher dependencies:

```powershell
node launcher/test-output/title-home-review/puppet/qa.cjs
```

The test uses local Edge through existing Playwright, with 1440px desktop,
360px mobile, and reduced-motion 360px viewports on title and home. `qa.json`
records results. PNGs are overwritten in place on each run. Assertions cover
real screenshot pixel changes, reduced-motion stillness, pointer tracking,
fixed hit boxes, greetings, loaded app art, absence of canvas, title icon
absence, no horizontal overflow, both work links and cleanup. No new packages,
WebGL, Unity runtime, external assets, or remote services are used.

Mobile testing is browser emulation, not a physical-device test.
