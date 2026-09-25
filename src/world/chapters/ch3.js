// CHAPTER III — The Giant of Gath-Zerk. A sunset battlefield; a champion forty cubits tall.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, npc, KIM_NPC, grp, makeUpdraft } from './common.js';
import { Noise2D, smoothstep } from '../../core/utils.js';
import { toon, glowSprite } from '../../render/materials.js';
import { Gorlath } from '../../entities/bosses.js';
import { PALETTES } from '../../entities/enemyModels.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter3(g) {
  const W = g.world;
  const n = new Noise2D(31);
  const brookZ = (x) => 60 + Math.sin(x * 0.03) * 8;
  const fn = (x, z) => {
    let h = n.fbm(x * 0.012, z * 0.012, 4) * 7;
    h += 12 * smoothstep(-10, -70, z) + 14 * smoothstep(150, 210, z);
    const dz = z - brookZ(x);
    h -= 3.2 * Math.exp(-(dz * dz) / 22);
    const r = Math.hypot(x, z - 60);
    h += smoothstep(170, 240, r) * 60 * (0.6 + n.noise(x * 0.02, z * 0.02));
    return h;
  };
  W.setAtmosphere({
    sky: { top: 0x3a2a6a, horizon: 0xff8a4a, bottom: 0xffb070, sun: 0xffc080, cloud: 0xffc8a0, cloudShadow: 0x8a3a5a, cloudiness: 0.7, sunDir: [-0.7, 0.08, 0.6], sunSize: 2.2 },
    fog: 0xe8906a, fogNear: 50, fogFar: 420, hemiSky: 0xffc8a8, hemiGround: 0x5a3a3a, hemiIntensity: 1.2, sunColor: 0xffb070, sunIntensity: 2.6,
  });
  W.buildTerrain({ size: 560, segs: 160, seed: 31, fn, center: [0, 60], palette: { low: 0x8a8a3a, mid: 0xb8a048, high: 0x8a7a5a, cliff: 0x6a5048, heights: [-2, 6, 20], rim: 0xffd0a0 } });
  W.liquid({ y: -1.4, size: 520, c1: 0x2a5a7a, c2: 0x9ad0e0, center: [0, 60], scale: 0.08 });
  W.killY = -30;
  W.bounds = { x: 0, z: 60, r: 175 };
  W.instance(P.grassTuft(0x8a8a30, 0xffe080), W.scatter(1400, { seed: 32, area: 150, center: [0, 60] }), { outline: 0, shadow: false });
  W.instance(P.goldenTree(1), W.scatter(24, { seed: 33, area: 160, center: [0, 60], minDist: 12, avoid: [[0, 60, 45]] }), { collide: 0.5 });
  W.instance(P.rock(5, 0x9a8a7a), W.scatter(60, { seed: 34, area: 160, center: [0, 60], minDist: 5, avoid: [[0, 90, 40]] }), { collide: 0.8, colliderH: 1.4 });
  // Army of Kim on the southern ridge
  const ranks = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 18; i++) ranks.push({ x: -34 + i * 4 + (r % 2) * 2, z: -48 - r * 4, ry: 0, s: 1 });
  W.instance(P.kimSoldier(), ranks, { outline: 0.03 });
  W.instance(P.tent(), [[-50, -70], [-30, -80], [30, -78], [52, -68], [0, -90]].map(([x, z]) => ({ x, z, ry: Math.random() * 3, s: 1 })), { collide: 3 });
  // Army of Zerkskis on the northern ridge
  const zr = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 20; i++) zr.push({ x: -40 + i * 4 + (r % 2) * 2, z: 172 + r * 4, ry: Math.PI, s: 1.05 });
  W.instance(P.kimSoldier(0x1d1828, 0x5a2f7a), zr, { outline: 0.03 });
  W.instance(P.obsidianSpire(14), [[-60, 175], [60, 180], [-20, 195], [25, 200]].map(([x, z]) => ({ x, z, s: 1 })), { collide: 1.5 });
  for (const [x, z, c] of [[-12, -38, 0x1d3b9c], [12, -38, 0x1d3b9c], [-25, 165, 0x3a1450], [25, 165, 0x3a1450], [0, 168, 0x3a1450]]) {
    const b = P.banner(c, c === 0x1d3b9c ? 0xe8b04a : 0x9a50ff);
    b.position.set(x, W.surfaceAt(x, z), z);
    W.scene.add(b);
    W.addAnimated({ update: (t) => { b.userData.uniforms.time.value = t; } });
  }
  // Burning wreckage across the field
  const fires = [[-30, 20], [22, 30], [-8, 95], [40, 110], [-45, 120], [15, -10]];
  for (const [x, z] of fires) {
    const y = W.surfaceAt(x, z);
    const s = glowSprite(0xff7020, 5, 0.9);
    s.position.set(x, y + 1.5, z);
    W.scene.add(s);
    W.addAnimated({ update: (t) => { s.scale.setScalar(5 + Math.sin(t * 11 + x) * 0.6); if (Math.random() < 0.3) g.smoke.spawn(x, y + 2, z, (Math.random() - 0.5), 2.5, (Math.random() - 0.5), { life: 3, size: 4, color: [0.15, 0.12, 0.12], alpha: 0.5 }); if (Math.random() < 0.4) g.fx.spawn(x + (Math.random() - 0.5) * 2, y + 1, z + (Math.random() - 0.5) * 2, 0, 3, 0, { life: 0.8, size: 0.4, color: [1.8, 0.7, 0.2] }); } });
  }
  motes(g, 0xffb060, { count: 300, rise: 0.8, size: 0.14 });
  makeUpdraft(W, { x: -70, z: 40, bottom: W.surfaceAt(-70, 40), top: 45, r: 4.5 });
  makeUpdraft(W, { x: 75, z: 90, bottom: W.surfaceAt(75, 90), top: 45, r: 4.5 });
  makeUpdraft(W, { x: 88, z: 38, bottom: W.surfaceAt(88, 38), top: 52, r: 4.5 });
  makeUpdraft(W, { x: 22, z: 138, bottom: W.surfaceAt(22, 138), top: 56, r: 4.5 });
  // High rock pillar with a secret
  const pil = [[-95, 60, 30], [100, 20, 28], [0, 150, 34]];
  W.instance(P.pillar(0, 0x9a8a7a, 0x6a5a4a), pil.map(([x, z, h]) => ({ x, z, s: h / 7.6 })), { collide: 0.8, colliderH: 8 });
  for (const [x, z, h] of pil) W.platforms.push({ x, z, r: 1.6 * h / 7.6 * 0.5, top: W.surfaceAt(x, z) + h + 0.2 });

  const on = (x, z, dy = 1.5) => [x, W.surfaceAt(x, z) + dy, z];
  placeCollectibles(g, 3, {
    feathers: [on(-60, 0), on(55, 10), on(-82, 70), on(88, 70), on(0, 60, 1), on(-40, 120), on(45, 140), on(-20, -30), on(-70, 42, 40), on(75, 92, 40), on(30, 60, 1), on(-110, 110)],
    scrolls: [on(-95, 60, 31.5), on(100, 20, 29.5), on(0, 150, 35.5)],
    relic: on(-24, 58, 0.6),
  });

  const dorian = npc(g, V(4, W.surfaceAt(4, -30), -30), Math.PI - 0.4, { palette: KIM_NPC, helm: 'horned', weapon: 'blade', name: 'Captain Dorian' });
  const ch = CHAPTERS[2];
  const spawn = on(0, -26, 0);
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'kim', intensity: 0 },
    { player: { pose: 'idle', pos: spawn, yaw: 0.4 } },
    shot([-40, 20, -70], [0, 5, 60], [30, 16, -60], [0, 8, 160], 9),
    { fade: 0, fadeDur: 2.5 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 0.5 },
    shot([spawn[0] + 7, spawn[1] + 2, spawn[2] - 6], [4, spawn[1] + 1.8, -30], null, null, 8),
    say('Captain Dorian', 'Forty days, Valkimsmor. Every dawn their champion walks into the valley and waits. Not one of us has gone to meet him.'),
    say('Captain Dorian', 'Gorlath. They call him the Many-in-One. The scouts swear they can hear a hundred voices when he breathes.'),
    shot([spawn[0] - 3, spawn[1] + 1.7, spawn[2] + 4], [spawn[0], spawn[1] + 1.7, spawn[2]], null, null, 3),
    say('Valkimsmor', 'Because there are a hundred of them in there. A hundred men who wanted never to feel small again.', 4.5),
    say('Valkimsmor', 'I will go down and give them back their names.', 3.5),
    shot([2, spawn[1] + 2, -32], [4, spawn[1] + 1.8, -30], null, null, 3.5),
    say('Captain Dorian', 'He is the size of a tower. You are one knight.', 3),
    shot([spawn[0] - 5, spawn[1] + 1, spawn[2] - 5], [spawn[0], spawn[1] + 2, spawn[2]], [spawn[0] - 4, spawn[1] + 3, spawn[2] - 8], [0, 10, 160], 5),
    say('Valkimsmor', 'The Voice has always preferred small things.', 3),
    { player: { pose: null }, music: 'battle', intensity: 1 },
  ];
  const bossPos = on(0, 105, 0);
  const gorIntro = [
    { player: { pose: 'combat', pos: on(0, 72, 0), yaw: 0 } },
    shot([8, 4, 70], [0, 12, 108], [3, 2, 74], [0, 16, 106], 5, { fov: 55 }),
    { sfx: 'roar', shake: 0.6 },
    say('Gorlath', 'ONE KNIGHT? WE ARE A HUNDRED. WE ARE NEVER AFRAID. WE ARE NEVER SMALL.', 4.5),
    shot([-4, 3, 66], [0, 3, 72], null, null, 5.5),
    say('Valkimsmor', 'Then why are all hundred of you shaking?', 3.5),
    say('Gorlath', '...BE SILENT!', 2.5),
    { player: { pose: null } },
  ];
  const gorOutro = [
    { player: { pose: 'combat' } },
    { shot: { from: () => [bossPos[0] + 14, bossPos[1] + 3, bossPos[2] - 10], lookFrom: () => [bossPos[0], bossPos[1] + 5, bossPos[2]], dur: 4 } },
    say(null, 'The colossus falls to its knees — and breaks apart into a hundred lights, each one rising with a name.', 5),
    { do: (g) => g.cam.shake(0.8), sfx: 'rumble' },
    shot([0, 10, -20], [0, 4, 60], [0, 14, -30], [0, 6, 170], 6),
    say(null, 'Across the valley, the Hollowed soldiers of Zerkskis lower their blades. For the first time in years, some of them are weeping.', 5),
    { stinger: 'epic', do: (g) => g.flash(0xfff0c0, 0.5) },
    say(null, 'The Oathmark of the Swift Tiding is etched upon his greaves.', 4),
    { player: { pose: 'hero' }, shot: { orbit: { center: () => [g.player.pos.x, g.player.pos.y, g.player.pos.z], radius: 7, height: 1.5, a0: 0, a1: 1, lookY: 2 }, dur: 5 } },
    { wait: 3.5 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 3, spawn, yaw: 0, music: 'battle', reward: 'shoes',
    beats: [
      { type: 'cinematic', steps: intro },
      { type: 'wave', objective: 'Break the Zerk vanguard', waves: [[grp('thrall', 5, [0, 20], 10)], [grp('brute', 1, [0, 30], 4), grp('thrall', 3, [0, 25], 10)], [grp('caster', 3, [0, 40], 14), grp('wraith', 2, [0, 30], 10), grp('thrall', 2, [0, 25], 8)]] },
      { type: 'goto', target: on(0, 62, 0), radius: 8, objective: 'Go down to the brook of Elah', hint: 'Something glints in the shallows of the brook — an iron tag, stamped with a name...' },
      {
        type: 'boss', objective: 'Defeat Gorlath', music: 'boss',
        spawn: (g, again) => {
          const b = new Gorlath(g, V(...bossPos));
          g.enemies.push(b);
          g.setBossTarget(b);
          if (!again) g.playCinematic(gorIntro, () => { b.setState('idle'); });
          else b.setState('idle');
          return b;
        },
        outro: gorOutro,
      },
      { type: 'end' },
    ],
  };
}
