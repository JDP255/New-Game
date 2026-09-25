// CHAPTER II — The Valley of the Shadow. Fog-drowned Ashmourn; kindle five shepherd braziers.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, brazierObj, grp, makeUpdraft } from './common.js';
import { Noise2D, smoothstep } from '../../core/utils.js';
import { glowMaterial } from '../../render/materials.js';
import { Brute } from '../../entities/enemies.js';
import { PALETTES } from '../../entities/enemyModels.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter2(g) {
  const W = g.world;
  const n = new Noise2D(21);
  const curve = (z) => Math.sin(z * 0.011) * 18 + Math.sin(z * 0.027) * 6;
  const fn = (x, z) => {
    const dx = Math.abs(x - curve(z));
    const wall = smoothstep(15, 44, dx);
    let h = wall * wall * 42 + n.fbm(x * 0.02, z * 0.02, 4) * 6 * (0.3 + wall) + n.ridged(x * 0.05, z * 0.05, 3) * 5 * wall;
    h += n.noise(x * 0.08, z * 0.08) * 0.7;
    h += smoothstep(-10, -45, z) * 45 + smoothstep(455, 490, z) * 45;
    // Ledges on the cliffs (flat shelves)
    h = h > 18 && h < 24 ? 18 + (h - 18) * 0.2 : h;
    return h;
  };
  W.setAtmosphere({
    sky: { top: 0x070a1e, horizon: 0x2c2848, bottom: 0x14142a, sun: 0xb8c8ff, cloud: 0x3a3a5a, cloudShadow: 0x141428, cloudiness: 0.6, stars: 1, sunDir: [-0.3, 0.35, 0.9], sunSize: 3 },
    fog: 0x283048, fogNear: 8, fogFar: 105, hemiSky: 0x8a9ad8, hemiGround: 0x302838, hemiIntensity: 1.25, sunColor: 0xa8c0ff, sunIntensity: 1.7,
  });
  W.buildTerrain({ size: 700, segs: 170, seed: 21, fn, center: [0, 220], palette: { low: 0x2a3a34, mid: 0x3a4a44, high: 0x4a4658, cliff: 0x2a2436, heights: [0, 6, 30], rim: 0x8aa0ff } });
  W.killY = -40;
  W.bounds = { x: 0, z: 220, r: 300 };
  const along = (z, off = 0, dy = 1.5) => { const x = curve(z) + off; return [x, fn(x, z) + dy, z]; };

  const avoid = [];
  const deadT = W.scatter(160, { seed: 22, area: 90, center: [0, 220], minDist: 5, maxSlope: 0.9 });
  W.instance(P.deadTree(1), deadT.filter((_, i) => i % 2), { collide: 0.4, colliderH: 5 });
  W.instance(P.deadTree(2.3), deadT.filter((_, i) => !(i % 2)), { collide: 0.4, colliderH: 5 });
  W.instance(P.pineTree(true), W.scatter(140, { seed: 23, area: 160, center: [0, 220], minDist: 6, minH: 12 }), { collide: 0.5 });
  W.instance(P.rock(4, 0x4a4a5a), W.scatter(90, { seed: 24, area: 100, center: [0, 220], minDist: 3 }), { collide: 0.8, colliderH: 1.4 });
  W.instance(P.grassTuft(0x1f3a30, 0x5a7a60), W.scatter(900, { seed: 25, area: 60, center: [0, 220], maxH: 8 }), { outline: 0, shadow: false });
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.4, 1.8) });
  W.instance(P.crystal(), W.scatter(40, { seed: 26, area: 80, center: [0, 220], minDist: 8 }).map((c) => ({ ...c, s: 0.6 + Math.random() * 0.8, rx: (Math.random() - 0.5) * 0.6, rz: (Math.random() - 0.5) * 0.6 })), { material: crystalMat, outline: 0.03, shadow: false, emissive: true });
  motes(g, 0x8a9ac8, { count: 260, rise: -0.05, size: 3.2, additive: false, opacity: 0.18, box: 60 });
  motes(g, 0xc0a0ff, { count: 200, rise: 0.2, size: 0.12 });
  void avoid;

  // Updrafts to cliff-top secrets
  makeUpdraft(W, { x: curve(95) - 16, z: 95, bottom: fn(curve(95) - 16, 95), top: 50, r: 4 });
  makeUpdraft(W, { x: curve(250) + 16, z: 250, bottom: fn(curve(250) + 16, 250), top: 52, r: 4 });
  makeUpdraft(W, { x: curve(350) - 15, z: 350, bottom: fn(curve(350) - 15, 350), top: 50, r: 4 });

  placeCollectibles(g, 2, {
    feathers: [along(20, 12), along(75, -26, 1.5), along(110, -34), along(160, 20), along(190, -14), along(235, 30), along(262, 34), along(290, -22), along(330, 14), along(360, -30), along(385, 22), along(440, 0, 5)],
    scrolls: [along(100, -38), along(245, 40), along(345, -36)],
    relic: along(262, 46),
  });

  // Braziers
  const bz = [[60, 8], [140, -9], [220, 10], [300, -8], [372, 9]];
  const braziers = [];
  const gateZ = 398;
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), glowMaterial(0x8a40ff, 0.35));
  gate.position.set(curve(gateZ), fn(curve(gateZ), gateZ) + 10, gateZ);
  W.scene.add(gate);
  const gateBox = { minX: curve(gateZ) - 40, maxX: curve(gateZ) + 40, minZ: gateZ - 1, maxZ: gateZ + 1, bottom: -50, top: 80, solid: true };
  W.boxes.push(gateBox);
  W.addAnimated({ update: (t) => { gate.material.opacity = gateBox.disabled ? Math.max(0, gate.material.opacity - 0.01) : 0.3 + Math.sin(t * 2) * 0.08; } });

  const ch = CHAPTERS[1];
  const pp = () => g.player.pos;
  const s0 = along(0, 0, 0);
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'zerk', intensity: 0 },
    { player: { pose: 'glide', pos: [s0[0] - 10, s0[1] + 30, -40], yaw: 0.2, vel: [2, -5, 14] } },
    shot([s0[0] + 30, s0[1] + 40, 60], [s0[0], s0[1] + 5, 150], [s0[0] - 20, s0[1] + 25, 120], [s0[0], s0[1] + 4, 260], 8),
    { fade: 0, fadeDur: 2.5 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 1 },
    { shot: { from: () => [pp().x + 6, pp().y + 2, pp().z + 12], lookFrom: () => [pp().x, pp().y + 1, pp().z], dur: 2 } },
    { wait: 1.8 },
    { player: { pose: 'kneel', pos: s0, yaw: 0 }, shake: 0.5, sfx: 'impact', do: (g) => g.landingFx(V(...s0)) },
    shot([s0[0] + 3, s0[1] + 1, s0[2] + 5], [s0[0], s0[1] + 1.2, s0[2]], [s0[0] + 1, s0[1] + 2, s0[2] - 5], [s0[0], s0[1] + 2, s0[2] + 20], 7),
    say(null, 'Ashmourn. Where the Lanternkeepers once kept five hearths so no traveller walked an hour in the dark.', 5),
    { player: { pose: 'combat' } },
    say(null, 'Now the Fog of Unmaking lies upon it, whispering to all who breathe it: you are alone.', 4.5),
    say('Valkimsmor', 'I have heard that whisper for three hundred years. It has never once been true.', 4.5),
    { player: { pose: null } },
  ];

  let lit = 0;
  const boss = { ref: null };
  const bossPos = along(425, 0, 0);
  const outro = [
    { player: { pose: 'idle' } },
    shot([bossPos[0] + 10, bossPos[1] + 4, bossPos[2] - 14], [bossPos[0], bossPos[1] + 2, bossPos[2]], null, null, 4),
    say(null, 'The Whisperer unravels — and inside the smoke, a Lanternkeeper remembers his own name.', 3.5),
    { do: (g) => g.liftDarkness(), stinger: 'holy' },
    shot([bossPos[0] - 6, bossPos[1] + 3, bossPos[2] - 18], [bossPos[0], bossPos[1] + 12, bossPos[2] + 40], [bossPos[0] - 2, bossPos[1] + 8, bossPos[2] - 26], [bossPos[0], bossPos[1] + 20, bossPos[2] + 60], 8),
    say(null, 'The fog breaks. For the first time in forty nights, the Lantern\'s light reaches the vale — and somewhere in the dark, a shepherd\'s song begins again.', 5.5),
    { player: { pose: 'kneel' }, flash: 0xfff0c0, flashAmt: 0.6, do: (g) => g.fx.burst(g.player.chestPos(), 80, { speed: 6, color: [1.8, 1.5, 0.8], life: 1.4, size: 0.6, gravity: -2 }) },
    say('Valkimsmor', 'I will stand where others ran.', 3),
    say(null, 'The Oathmark of the Steadfast Heart is etched over his heart.', 4),
    { player: { pose: 'hero' }, shot: { orbit: { center: bossPos, radius: 8, height: 2, a0: 0.5, a1: -0.5, lookY: 2 }, dur: 5 } },
    { wait: 3 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 2, spawn: s0, yaw: 0, music: 'zerk', reward: 'breastplate',
    beats: [
      { type: 'cinematic', steps: intro },
      {
        type: 'interact', objective: 'Light the shepherds’ braziers (0/5)', hint: 'Press <kbd>E</kbd> beside a brazier to kindle it. Each flame pushes back the shadow — and heals you.',
        progress: (a, b) => `Light the shepherds’ braziers (${a}/${b})`,
        items: (g) => {
          const list = bz.map(([z, off], i) => {
            const p = along(z, off, 0);
            const o = brazierObj(g, V(...p), () => {
              lit++;
              W.scene.fog.far += 22;
              W.scene.fog.near += 2;
              const groups = [
                [grp('thrall', 3, [p[0], p[2] + 10], 8)],
                [grp('thrall', 2, [p[0], p[2] + 10], 8), grp('caster', 2, [p[0], p[2] + 16], 10)],
                [grp('brute', 1, [p[0], p[2] + 12], 4), grp('thrall', 2, [p[0], p[2] + 8], 8)],
                [grp('wraith', 3, [p[0], p[2]], 10), grp('caster', 1, [p[0], p[2] + 14], 8)],
                [grp('brute', 1, [p[0], p[2] + 12], 4), grp('thrall', 3, [p[0], p[2] + 10], 10), grp('caster', 1, [p[0], p[2] + 18], 8)],
              ];
              g.ui.toast(`The shadow recedes — <b>${lit}/5</b> braziers kindled`);
              setTimeout(() => { if (g.world === W) g.spawnWave(groups[Math.min(lit - 1, 4)]); }, 900);
            });
            return o;
          });
          list.forEach((o) => g.interactables.push(o));
          braziers.push(...list);
          return list;
        },
        onDone: (g) => { gateBox.disabled = true; g.ui.toast('The veil of shadow parts...', 'hint'); g.audio.stinger('holy'); },
      },
      { type: 'goto', target: along(410, 0, 0), radius: 10, objective: 'Pass through the veil' },
      {
        type: 'boss', objective: 'Silence the Whisperer in the Fog',
        spawn: (g) => {
          const b = new Brute(g, V(...bossPos), { scale: 2.4, hp: 950, name: 'The Whisperer in the Fog', palette: { ...PALETTES.elite, armor: 0x0a0812, trim: 0x4a2a8a } });
          b.isBossLike = true;
          g.enemies.push(b);
          g.setBossTarget(b);
          boss.ref = b;
          g.audio.sfx('roar');
          g.ui.hint('Brutes shrug off light blows. Break their guard with <kbd>Right Click</kbd>, a full combo, or a <b>Wing Dive</b> (heavy attack in the air). Jump over their shockwaves!', 8);
          return b;
        },
        outro: outro,
      },
      { type: 'end' },
    ],
  };
}
