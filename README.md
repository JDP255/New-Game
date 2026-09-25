# VALKIMSMOR — Wings of Kim

A cinematic third-person action game for the browser, built with **three.js**.

You play **Valkimsmor**, the last Wingbearer of the floating land of **Kim**. He's an armoured, winged knight at war with **Zerkskis**, the people of the dark, and their ruler **Zekeriah**. Zekeriah is the fallen first Wingbearer, and he was Valkimsmor's own teacher.

The full story and world are in **[docs/LORE.md](docs/LORE.md)**.

## Running it

**Easiest:** double-click **`Valkimsmor.html`** in the project folder. It opens in your browser and plays straight away, with no install and no server. Chrome or Edge is recommended.

If you change the code, run `npm run build:single` to rebuild that file.

**For development:**

```bash
npm install
npm run dev        # then open the printed http://localhost:5173 link
```

To make a production build: `npm run build`, then `npm run preview`, or serve the `dist/` folder from any static web server.

Chrome or Edge is recommended. Click once on the title screen to start the audio.

## What's in the game

- **7-chapter campaign.** Floating sky-isles, a fog-drowned valley, a sunset battlefield, a fortress city, a volcanic forge, a stormy sea of grief, and a tower climb at an eclipse. Every chapter opens and closes with a cinematic.
- **5 boss fights, each with its own mechanics:**
  - **The Whisperer in the Fog**
  - **Gorlath, the Many-in-One**: exhaust him to open a damage window.
  - **Molochar**: the lava rises mid-fight, and the Stranger in the Flame walks beside you.
  - **Tehomar the Leviathan**: strike its head when it gets stuck on an island.
  - **Zekeriah**: three phases, including shadow clones and a transformation.
- **Combat:**
  - A 3-hit combo, heavy blows, and air spin-slashes.
  - The **Wing Dive** plunge attack.
  - **Perfect parry** into a riposte, and an invulnerable dash.
  - Lock-on, and **Judgment**, a super move that calls down pillars of light.
  - Hit-stop, slow-motion kill-cams and sword trails.
- **Flight:** jump, beat your wings in the air, glide, and ride golden updrafts (the "Rivers of Breath") to secret places.
- **Enemies:**
  - Thralls with attack telegraphs and a turn-taking attack-token AI.
  - Shade Casters who teleport.
  - Armoured Brutes whose shockwaves you jump over.
  - Wraiths that dive from the sky.
  - Elite captains.
  - Defeated foes release **souls of light** that heal you.
- **Collectibles for 100%:**
  - 84 Seraph Feathers; every 12 gives you an extra wing-beat and more HP.
  - 21 Leaves of the Canticle, the world's holy book.
  - 7 hidden Relics.
  - 6 Oathmark upgrades.
  - The bonus arena, **The Proving of the Ninth Feather** (10 waves).
  - A Codex with deep lore entries.
- **Original procedural soundtrack.** All the music is synthesised live with the Web Audio API: choir, strings, brass, harp, taiko and bells. There's a recurring main theme, and the music gets more intense when you fight.
- **Art style:** banded toon lighting, ink outlines, glowing rim light, painted skies, stained glass, bloom and a warm "illuminated manuscript" colour grade.
- Saves automatically to your browser's local storage. Includes a chapter select and difficulty options (Story / Normal / Hard).

## Controls

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move / Look | WASD / Mouse | Left / Right stick |
| Jump / Wing-beat | Space | A |
| Glide | Hold Space in the air | Hold A |
| Dash (invulnerable) | Shift | B |
| Strike (combo) | Left Click | X |
| Heavy / Wing Dive (in the air) | Right Click | Y |
| Parry | Q | LB |
| Judgment (when the halo is full) | F | RB |
| Interact / Read | E | LT |
| Lock on | Tab / Middle Click | RT |
| Codex | I | Back |
| Pause | Esc | Start |

## Performance (Intel Iris Xe and other integrated GPUs)

The game is built to run at 60 fps on integrated graphics:

- Props are instanced, and geometry is merged to keep draw calls low.
- There's only one real-time shadow-casting light, and its shadow map follows the player.
- Bloom runs at half resolution.
- **Adaptive resolution** automatically lowers the internal render scale when frame time goes above about 16.7 ms.
- **Options → Graphics Quality:** Low, Medium or High. Medium is the default and is tuned for Iris Xe. Turn on **Show FPS** to see the frame rate and the current render scale.
