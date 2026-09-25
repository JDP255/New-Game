// CHAPTER I — In the Beginning. The Aerie of Kim: floating isles above a golden sea of clouds.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, npc, ELDER_NPC, stainedWindow, godRays, grp, makeUpdraft } from './common.js';
import { toon, outlineMaterial } from '../../render/materials.js';
import { CHAPTERS } from '../../game/story.js';

export const KIM_ATMOS = {
  sky: { top: 0x2f5fd0, horizon: 0xffd2a0, bottom: 0xffe6c8, sun: 0xfff0c0, cloud: 0xfffaf0, cloudShadow: 0xd89a9a, cloudiness: 0.45, sunDir: [0.45, 0.16, 0.85] },
  fog: 0xffdcb8, fogNear: 90, fogFar: 560, hemiSky: 0xd8e6ff, hemiGround: 0xa08060, hemiIntensity: 1.35, sunColor: 0xfff0d8, sunIntensity: 2.6,
};

export function buildKimIsles(g, { title = false } = {}) {
  const W = g.world;
  W.setAtmosphere(KIM_ATMOS);
  W.killY = -30;
  W.bounds = { x: 0, z: 100, r: 200 };
  W.addCloudSea(0xfff2de, 0xd8a8b8, -40);
  const islands = [
    { x: 0, y: 20, z: 0, r: 14 }, // A spawn
    { x: 0, y: 21, z: 38, r: 11 }, // B
    { x: 25, y: 21, z: 78, r: 17 }, // C arena
    { x: -5, y: 26, z: 118, r: 11 }, // D
    { x: 38, y: 44, z: 122, r: 8 }, // E high
    { x: 0, y: 24, z: 182, r: 32 }, // F cathedral
    { x: -42, y: 26, z: 58, r: 9 }, // G
    { x: 58, y: 32, z: 28, r: 7 }, // H
    { x: -38, y: 38, z: 140, r: 8 }, // I
    { x: 55, y: 22, z: 165, r: 10 }, // J
    { x: -58, y: 20, z: 200, r: 9 }, // K
    { x: 34, y: 58, z: 205, r: 6 }, // L
    { x: -20, y: 34, z: 80, r: 5 }, // M
    { x: 22, y: 30, z: -30, r: 8 }, // N
    { x: -30, y: 23, z: -15, r: 7 }, // O
    { x: 70, y: 40, z: 110, r: 6 }, // P
    { x: -72, y: 55, z: 105, r: 5 }, // Q relic
    { x: 12, y: 18, z: 20, r: 3 }, { x: -12, y: 22, z: 60, r: 3.5 }, { x: 10, y: 23, z: 100, r: 3 },
    { x: -90, y: 10, z: 30, r: 16, depth: 30 }, { x: 110, y: 5, z: 60, r: 22, depth: 40 }, { x: 90, y: 30, z: 240, r: 18, depth: 34 },
    { x: -100, y: 40, z: 240, r: 14, depth: 28 }, { x: 0, y: 70, z: 320, r: 26, depth: 50 }, { x: -140, y: 20, z: 140, r: 20, depth: 36 },
  ];
  W.buildIslands(islands, { top: 0x8cc860, top2: 0xe8e080, rock: 0xe0cfb0, rockDark: 0x7a6a8a }, 5);
  const tops = W.platforms.filter((p) => p.island);
  const small = tops.filter((p) => p.r < 30);
  // Golden trees, marble ruins, flowers and grass.
  const avoid = [[0, 0, 6], [0, 38, 5], [25, 78, 9], [0, 182, 22]];
  const trees = W.scatter(46, { seed: 11, onPlatforms: small, minDist: 4, avoid });
  const tg = [P.goldenTree(0), P.goldenTree(1), P.goldenTree(2)];
  tg.forEach((geo, k) => W.instance(geo, trees.filter((_, i) => i % 3 === k), { collide: 0.5, colliderH: 6 }));
  W.instance(P.whiteTree(), W.scatter(12, { seed: 12, onPlatforms: small, minDist: 5, avoid }), { collide: 0.4 });
  const pillars = W.scatter(18, { seed: 13, onPlatforms: small, minDist: 6, avoid });
  W.instance(P.pillar(0), pillars.filter((_, i) => i % 3 === 0), { collide: 0.7, colliderH: 8 });
  W.instance(P.pillar(1), pillars.filter((_, i) => i % 3 === 1), { collide: 0.7, colliderH: 4 });
  W.instance(P.pillar(2), pillars.filter((_, i) => i % 3 === 2), { collide: 0.7, colliderH: 5 });
  W.instance(P.ruinArch(), [{ x: 0, z: 26, ry: 0, s: 1 }, { x: 22, z: 62, ry: 0.4, s: 1 }, { x: -3, z: 150, ry: 0, s: 1.3 }], { outline: 0.05 });
  W.instance(P.rock(3, 0xd8c8b0), W.scatter(40, { seed: 14, onPlatforms: tops, minDist: 3, avoid }).map((r) => ({ ...r, s: r.s * 0.8 })), { collide: 0.7, colliderH: 1.2 });
  W.instance(P.grassTuft(0x5a9a40, 0xf0e070), W.scatter(900, { seed: 15, onPlatforms: tops }), { outline: 0, shadow: false });
  W.instance(P.flower(0xfff8e0), W.scatter(300, { seed: 16, onPlatforms: tops }), { outline: 0, shadow: false });
  W.instance(P.flower(0xffc8e0), W.scatter(150, { seed: 17, onPlatforms: tops }), { outline: 0, shadow: false });

  // The Cathedral of Kim
  const cat = new THREE.Group();
  cat.position.set(0, 24, 190);
  cat.rotation.y = Math.PI;
  const { geo, windows } = P.cathedral();
  const cm = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, rim: 0.3, rimColor: 0xfff0d0, gradient: 'four' }));
  cm.castShadow = true;
  cm.receiveShadow = true;
  cat.add(cm);
  cat.add(new THREE.Mesh(geo, outlineMaterial(0.12)));
  const mats = windows.map((w) => stainedWindow(cat, w.pos, w.rot, w.size));
  W.scene.add(cat);
  W.addAnimated({ update: (t) => mats.forEach((m) => { m.uniforms.time.value = t; }) });
  const box = (minX, maxX, minZ, maxZ, bottom, top) => W.boxes.push({ minX, maxX, minZ, maxZ, bottom, top, solid: true });
  box(-7, 7, 173, 207, 24, 38);
  box(-14, 14, 189, 199, 24, 36);
  box(5.5, 11.5, 171, 177, 24, 54);
  box(-11.5, -5.5, 171, 177, 24, 54);
  // Banners of Kim before the cathedral
  for (const [x, z] of [[-9, 160], [9, 160], [-9, 140], [9, 140], [18, 70], [32, 70]]) {
    const b = P.banner();
    b.position.set(x, W.surfaceAt(x, z), z);
    b.rotation.y = Math.PI / 2;
    W.scene.add(b);
    W.addAnimated({ update: (t) => { b.userData.uniforms.time.value = t; } });
  }
  godRays(g, [[40, 80, 260, 16, 200, 0.35], [-30, 90, 230, 12, 200, 0.3], [80, 90, 150, 10, 220, 0.4], [-70, 80, 60, 14, 180, 0.3]]);
  motes(g, 0xffe6a0, { count: 500, rise: 0.3, size: 0.16 });
  if (title) return;

  makeUpdraft(W, { x: 8, z: 100, bottom: 5, top: 50, r: 5 });
  makeUpdraft(W, { x: -26, z: 45, bottom: 5, top: 42, r: 4.5 });
  makeUpdraft(W, { x: 45, z: 12, bottom: 5, top: 42, r: 4.5 });
  makeUpdraft(W, { x: 40, z: 172, bottom: 5, top: 68, r: 5 });
  makeUpdraft(W, { x: -18, z: 160, bottom: 10, top: 54, r: 4.5 });
  makeUpdraft(W, { x: -52, z: 118, bottom: 5, top: 62, r: 4.5 });
}

export function chapter1(g) {
  buildKimIsles(g);
  const W = g.world;
  placeCollectibles(g, 1, {
    feathers: [[22, 31.5, -30], [-30, 24.5, -15], [-42, 27.5, 58], [-20, 35.5, 80], [58, 33.5, 28], [8, 38, 100], [70, 41.5, 110], [-38, 39.5, 140], [55, 23.5, 165], [-58, 21.5, 200], [12, 37.5, 194], [-18, 52, 160]],
    scrolls: [[38, 45.5, 122], [34, 59.5, 205], [0, 25.5, 209.5]],
    relic: [-72, 56.5, 105],
  });
  const elder = npc(g, V(0, 24, 164), Math.PI, { palette: ELDER_NPC, helm: 'hood', weapon: 'staff', name: 'Elder Ithiel' });
  const ch = CHAPTERS[0];
  const p = g.player;
  const pp = () => p.pos;

  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'title', intensity: 0 },
    { player: { pose: 'glide', pos: [-40, 55, -90], yaw: 0.35, vel: [4.5, -1.2, 13] } },
    shot([70, 45, -60], [0, 26, 80], [30, 34, 60], [0, 30, 185], 10),
    { fade: 0, fadeDur: 3, wait: 1 },
    say(null, 'Before the first dawn there was a Voice. It sang — and the singing became the world.', 5),
    say(null, 'It lifted the land of Kim upon its breath, and gave wings of living light to those who would guard it: the Wingbearers.', 5.5),
    shot([-28, 30, 150], [0, 36, 185], [-16, 34, 160], [0, 40, 186], 6),
    say(null, 'But the first and brightest of them reached for the light itself... and fell. Now Zekeriah rules the people of the dark, and the Last Lantern grows dimmer every year.', 7),
    { player: { pose: 'glide', pos: [-18, 42, -48], yaw: 0.28, vel: [4, -2.6, 13.5] } },
    { shot: { from: () => [pp().x + 9, pp().y + 1.5, pp().z - 6], lookFrom: () => [pp().x, pp().y + 1, pp().z + 2], dur: 3.2 } },
    say(null, 'Of three hundred and twelve Wingbearers, one remains.', 3.2),
    { player: { pose: 'fly', pos: [0, 34, -3], yaw: 0, vel: [0, -30, 0.8] } },
    shot([0, 20.6, 7.5], [0, 26, 0], null, null, 0.45),
    { wait: 0.45 },
    { player: { pose: 'kneel', pos: [0, 20, 0], yaw: 0 }, do: (g) => g.landingFx(V(0, 20, 0)), shake: 0.9, sfx: 'impact' },
    shot([0, 20.5, 5.5], [0, 20.8, 0], [2.2, 21.2, 5], [0, 21.4, 0], 2.4),
    { wait: 2.2 },
    { player: { pose: 'hero' }, stinger: 'epic' },
    { shot: { orbit: { center: [0, 20, 0], radius: 7.5, height: 1.2, a0: 0.3, a1: -0.4, lookY: 2.2 }, dur: 6 } },
    { wait: 1.2 },
    { bigTitle: true, wait: 4 },
    { bigTitle: false, wait: 1 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 1.2 },
    { player: { pose: null }, music: 'kim', intensity: 0 },
  ];

  const cathedralScene = [
    { player: { pose: 'idle', pos: [0, 24, 150], yaw: 0 } },
    shot([8, 26.5, 147], [0, 25.8, 164], [5, 26, 152], [0, 25.5, 162], 5),
    { do: () => { elder.npc.pose = null; } },
    say('Elder Ithiel', 'Valkimsmor. The raiders you scattered were only the first drops of the storm.'),
    shot([-3, 25.8, 159.5], [0, 25.8, 164], null, null, 5),
    say('Elder Ithiel', 'Zekeriah has woken every legion of Zerkskis. His Spire climbs toward the Lantern, and Ashmourn is already lost to his fog.'),
    shot([2.5, 26, 154], [0, 25.4, 150], null, null, 3),
    say('Valkimsmor', 'I stood beside him the night he fell, Elder. I did nothing. I will not stand still again.'),
    shot([-4, 26, 160], [0, 25.6, 164], null, null, 7),
    say('Elder Ithiel', 'Then hear me. The Zerkskis are Rootfolk — our own kin, who gave away their names to be rid of fear.'),
    say('Elder Ithiel', 'When your blade strikes them down, it does not end them. It sets them free. Never forget whom you are fighting for.'),
    { stinger: 'dark', shake: 0.3 },
    shot([0, 30, 140], [0, 34, 110], null, null, 3),
    say('Elder Ithiel', 'Look — they come again! Defend the Cathedral!', 3),
    { player: { pose: null } },
  ];

  const endScene = [
    { player: { pose: 'idle', pos: [0, 24, 158], yaw: 0 } },
    shot([6, 27, 154], [0, 25.5, 162], null, null, 5, { fov: 50 }),
    say('Elder Ithiel', 'It is done. Kneel, Valkimsmor.', 3),
    { player: { pose: 'kneel' } },
    shot([0, 25, 154], [0, 24.8, 158], [-3, 26, 155], [0, 25, 160], 6),
    say('Elder Ithiel', 'Speak the First Vow, Wingbearer.', 3),
    say('Valkimsmor', 'I will not lie — not even to spare myself.', 3.5),
    { flash: 0xfff0c0, flashAmt: 0.7, stinger: 'holy', do: (g) => g.fx.burst(V(0, 25, 158), 80, { speed: 6, color: [1.8, 1.5, 0.8], life: 1.4, size: 0.6, gravity: -2 }) },
    say(null, 'The Oathmark of Truth is etched into his belt in living gold.', 3.5),
    { player: { pose: 'idle' } },
    shot([3, 26, 152], [0, 25.8, 162], null, null, 6),
    say('Elder Ithiel', 'Go down to Ashmourn. Rekindle the hearths of the Lanternkeepers. Where there is light, the Hollowed can remember.'),
    say('Valkimsmor', 'It will be done.', 2.5),
    { player: { pose: 'hero' }, shot: { orbit: { center: [0, 24, 158], radius: 9, height: 2, a0: 0, a1: 1, lookY: 2 }, dur: 5 } },
    { wait: 3.5 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 1, spawn: [0, 20, 0], yaw: 0, music: 'kim', reward: 'belt',
    beats: [
      { type: 'cinematic', steps: intro },
      { type: 'goto', target: [0, 21, 38], radius: 7, objective: 'Follow the light to the training grounds', hint: 'Move with <kbd>W A S D</kbd> · Look with the <kbd>Mouse</kbd> · <kbd>Space</kbd> to jump — hold <kbd>Space</kbd> in the air to <b>glide</b>' },
      { type: 'wave', objective: 'Drive off the Zerk scouts', waves: [[grp('thrall', 3, [0, 40], 6)]], hint: '<kbd>Left Click</kbd> to strike — chain three for a combo · <kbd>Right Click</kbd> heavy blow · <kbd>Shift</kbd> to dash through attacks', hintDur: 9 },
      { type: 'goto', target: [25, 21, 78], radius: 10, objective: 'Glide to the eastern isle', hint: 'Press <kbd>Space</kbd> in the air to beat your wings and climb higher' },
      { type: 'wave', objective: 'Repel the raiding party', waves: [[grp('thrall', 4, [25, 80], 8)], [grp('thrall', 2, [25, 80], 8), grp('caster', 2, [25, 80], 12)]], hint: 'Press <kbd>Q</kbd> just as a foe strikes to <b>parry</b> — then strike back for a devastating riposte', hintDur: 8 },
      { type: 'goto', target: [-5, 26, 118], radius: 8, objective: 'Rise toward the Cathedral of Kim', hint: 'Golden <b>updrafts</b> lift you high while gliding. Seraph Feathers and Scrolls hide where only wings can reach.' },
      { type: 'goto', target: [0, 24, 150], radius: 9, objective: 'Reach the Cathedral of Kim' },
      { type: 'cinematic', steps: cathedralScene },
      { type: 'wave', objective: 'Defend the Cathedral', checkpoint: [0, 24, 150], intensity: 1,
        waves: [[grp('thrall', 5, [0, 150], 10), grp('caster', 1, [0, 140], 14)], [grp('wraith', 3, [0, 150], 12), grp('thrall', 2, [0, 150], 10)], [grp('elite', 1, [0, 145], 4, { name: 'Varkoth, Zerk Captain' }), grp('thrall', 2, [0, 150], 10)]],
        hint: 'Wraiths strike from the sky — take to the air to meet them. When your halo is full, press <kbd>F</kbd> to call down <b>Judgment</b>', hintDur: 8 },
      { type: 'cinematic', steps: endScene },
      { type: 'end' },
    ],
  };
}
