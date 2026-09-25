// CHAPTER V — The Forge of Ash. Molochar, the smith who became his own fire.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, grp, makeUpdraft } from './common.js';
import { Noise2D, smoothstep, TAU, damp } from '../../core/utils.js';
import { glowSprite } from '../../render/materials.js';
import { Molochar } from '../../entities/bosses.js';
import { buildHumanoid } from '../../entities/enemyModels.js';
import { idlePose, runPose } from '../../entities/knightPoses.js';
import { Eruption } from '../../entities/projectiles.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter5(g) {
  const W = g.world;
  const n = new Noise2D(51);
  const A = [0, 280]; // arena centre
  const pathX = (z) => Math.sin(z * 0.013) * 22;
  const fn = (x, z) => {
    const ra = Math.hypot(x - A[0], z - A[1]);
    if (ra < 40) return 1.2 + (ra > 36 ? (ra - 36) * 2 : 0);
    let h = n.fbm(x * 0.03, z * 0.03, 4) * 6 + 2.5;
    const dp = Math.abs(x - pathX(z));
    h += smoothstep(8, 30, dp) * (n.ridged(x * 0.04, z * 0.04, 3) * 14 - 9); // lava pools beside the path
    h += smoothstep(60, 110, dp) * 50;
    h += smoothstep(-5, -40, z) * 40;
    // lava channels crossing the path
    for (const cz of [70, 140, 205]) h -= 7 * Math.exp(-((z - cz) ** 2) / 30);
    return h;
  };
  W.setAtmosphere({
    sky: { top: 0x1a0608, horizon: 0xb8401a, bottom: 0x3a0a08, sun: 0xff6a2a, cloud: 0x5a2018, cloudShadow: 0x1a0406, cloudiness: 0.85, sunDir: [0.2, 0.25, 1], sunSize: 3 },
    fog: 0x4a1a10, fogNear: 30, fogFar: 300, hemiSky: 0xff9a70, hemiGround: 0x3a0a08, hemiIntensity: 0.9, sunColor: 0xff9060, sunIntensity: 2.0,
  });
  W.buildTerrain({ size: 520, segs: 160, seed: 51, fn, center: [0, 150], palette: { low: 0x1a1214, mid: 0x2e2224, high: 0x4a3434, cliff: 0x120c10, heights: [-4, 2, 20], rim: 0xff8a50 } });
  const lava = W.liquid({ y: 0, size: 600, c1: 0x6a0e00, c2: 0xffa020, emissive: 0.9, speed: 0.5, center: [0, 150], scale: 0.06 });
  W.lava = { y: 0, dps: 30, mesh: lava };
  W.killY = -30;
  W.bounds = { x: 0, z: 150, r: 210 };
  W.instance(P.obsidianSpire(10), W.scatter(40, { seed: 52, area: 150, center: [0, 150], minDist: 12, minH: 3, avoid: [[A[0], A[1], 45]] }), { collide: 1.4 });
  W.instance(P.rock(7, 0x3a2a2a), W.scatter(80, { seed: 53, area: 150, center: [0, 150], minDist: 4, minH: 1.5 }), { collide: 0.8, colliderH: 1.4 });
  W.instance(P.deadTree(5), W.scatter(20, { seed: 54, area: 150, center: [0, 150], minDist: 12, minH: 2 }), { collide: 0.4 });
  const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.8, 0.2) });
  W.instance(P.crystal(), W.scatter(40, { seed: 55, area: 150, center: [0, 150], minDist: 8, minH: 1 }), { material: cm, outline: 0.03, emissive: true, shadow: false });
  motes(g, 0xff8a30, { count: 600, rise: 1.2, size: 0.14 });
  motes(g, 0x2a1a1a, { count: 200, rise: -0.3, size: 0.6, additive: false, opacity: 0.5 });

  // Stepping platforms across lava channels.
  for (const cz of [70, 140, 205]) for (let k = -1; k <= 1; k++) {
    const x = pathX(cz) + k * 7, z = cz + k * 3;
    W.platforms.push({ x, z, r: 3.2, top: 2.2 });
  }
  const platGeo = P.colorize(new THREE.CylinderGeometry(3.3, 2.4, 4, 7), 0x2a1e20, 0.06);
  const pl = W.platforms.filter((p) => p.r === 3.2).map((p) => ({ x: p.x, z: p.z, y: p.top - 2, s: 1 }));
  // Arena refuge pillars (for when the lava rises)
  const refuge = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const x = A[0] + Math.sin(a) * 22, z = A[1] + Math.cos(a) * 22;
    W.platforms.push({ x, z, r: 3.4, top: 4.5 });
    refuge.push({ x, z, y: 0.5, s: 1, sy: 1.0 });
  }
  W.instance(platGeo, pl, { outline: 0.05 });
  W.instance(P.colorize(new THREE.CylinderGeometry(3.4, 3.8, 4, 8), 0x3a2a2a, 0.06), refuge, { outline: 0.05 });
  // The Furnace itself — a giant glowing mouth behind the arena.
  const furnace = new THREE.Mesh(P.colorize(new THREE.SphereGeometry(40, 16, 10, 0, TAU, 0, Math.PI / 2), 0x1a1012, 0.05), W.terrain.material);
  furnace.position.set(A[0], -8, A[1] + 75);
  W.scene.add(furnace);
  const mouth = glowSprite(0xff7020, 60, 0.9);
  mouth.position.set(A[0], 14, A[1] + 42);
  W.scene.add(mouth);
  W.addAnimated({ update: (t) => mouth.scale.setScalar(60 + Math.sin(t * 2) * 4) });

  // Periodic fire geysers along the path.
  const geysers = [[pathX(40) + 10, 40], [pathX(100) - 9, 100], [pathX(170) + 8, 170], [pathX(235) - 7, 235]];
  let gT = 0;
  W.addAnimated({ update: (t, dt) => {
    if (!g.director || g.cinematicActive) return;
    gT += dt;
    if (gT > 3.5) {
      gT = 0;
      for (const [x, z] of geysers) {
        if (Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 60) g.spawnProjectile(new Eruption(g, { pos: V(x, W.surfaceAt(x, z), z), radius: 3, delay: 1.4, dmg: 14, color: 0xff6a10 }));
      }
    }
  } });
  makeUpdraft(W, { x: pathX(120) + 30, z: 120, bottom: 0, top: 40, r: 4.5, color: 0xffb070 });
  makeUpdraft(W, { x: pathX(190) - 30, z: 190, bottom: 0, top: 40, r: 4.5, color: 0xffb070 });

  const on = (x, z, dy = 1.5) => [x, Math.max(W.surfaceAt(x, z), 0) + dy, z];
  placeCollectibles(g, 5, {
    feathers: [on(pathX(20) - 14, 20), on(pathX(55) + 16, 55), on(pathX(70), 70, 4), on(pathX(90) - 20, 90), on(pathX(120) + 30, 120, 30), on(pathX(140) + 7, 143, 3), on(pathX(160) - 18, 160), on(pathX(190) - 30, 190, 30), on(pathX(215) + 16, 215), on(A[0] - 22, A[1], 5), on(A[0] + 22, A[1], 5), on(A[0], A[1] - 22, 5)],
    scrolls: [on(pathX(125) + 42, 125, 1.5), on(pathX(185) - 42, 185, 1.5), on(A[0], A[1] + 22, 5)],
    relic: on(pathX(10), 5, 2),
  });

  // The Stranger in the Flame: a figure of light who walks beside you once the furnace rages.
  let stranger = null;
  const strangerState = { active: false, t: 0 };
  const summonStranger = () => {
    const m = buildHumanoid({ palette: { armor: 0xffffff, trim: 0xfff0c0, cloth: 0xfff6e0, rim: 0xffffff, eye: 0xffffff, skin: 0xffffff }, weapon: 'none', helm: 'hood', scale: 1.1 });
    m.root.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.set(0xfff0d0); o.material.emissiveIntensity = 1.4; } });
    const aura = glowSprite(0xfff4d8, 7, 0.8);
    aura.position.y = 1.3;
    m.root.add(aura);
    W.scene.add(m.root);
    const pose = {};
    stranger = { m, pose, pos: g.player.pos.clone().add(V(2, 0, -2)) };
    strangerState.active = true;
    g.player.fireWard = true;
    W.addAnimated({ update: (t, dt) => {
      if (!strangerState.active) return;
      const p = g.player.pos;
      const want = V(p.x + Math.sin(g.player.yaw + 2.2) * 2.4, 0, p.z + Math.cos(g.player.yaw + 2.2) * 2.4);
      const sp = stranger.pos;
      sp.x = damp(sp.x, want.x, 3, dt);
      sp.z = damp(sp.z, want.z, 3, dt);
      sp.y = damp(sp.y, Math.max(p.y, W.lava.y), 5, dt);
      m.root.position.copy(sp);
      m.root.rotation.y = g.player.yaw;
      const moving = Math.hypot(want.x - sp.x, want.z - sp.z) > 0.5;
      if (moving) runPose(pose, t * 8, 0.3, t); else idlePose(pose, t, 0);
      pose.w1L = pose.w1R = undefined;
      m.rig.apply(pose, dt, 8);
      if (Math.random() < 0.4) g.fx.spawn(sp.x + (Math.random() - 0.5), sp.y + Math.random() * 2, sp.z + (Math.random() - 0.5), 0, 1, 0, { life: 0.8, size: 0.3, color: [1.8, 1.7, 1.4] });
    } });
  };
  const dismissStranger = () => {
    if (!stranger) return;
    strangerState.active = false;
    g.fx.burst(stranger.pos.clone().add(V(0, 1.2, 0)), 80, { speed: 8, color: [1.8, 1.7, 1.4], life: 1.2, size: 0.6 });
    W.scene.remove(stranger.m.root);
    stranger = null;
    g.player.fireWard = false;
  };

  const ch = CHAPTERS[4];
  const spawn = on(pathX(0), 0, 0);
  const pp = () => g.player.pos;
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'zerk', intensity: 0 },
    { player: { pose: 'idle', pos: spawn, yaw: 0 } },
    shot([60, 50, 150], [A[0], 10, A[1] + 30], [-40, 40, 220], [A[0], 12, A[1] + 40], 9),
    { fade: 0, fadeDur: 2.5 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 0.5 },
    shot([spawn[0] + 4, spawn[1] + 1.8, spawn[2] + 5], [spawn[0], spawn[1] + 1.6, spawn[2]], [spawn[0] + 2, spawn[1] + 2.2, spawn[2] + 6], [spawn[0], spawn[1] + 3, spawn[2] + 40], 9),
    say(null, 'Every blade of the Hollowed is forged here — in the Furnace that never goes out.', 4.5),
    say('Valkimsmor', 'Molochar forged my sword. He taught me that a smith fears impurity, never heat.', 4.5),
    say('Valkimsmor', 'I wonder if he remembers.', 3),
    { player: { pose: null } },
  ];
  const mIntro = [
    { player: { pose: 'combat', pos: on(A[0], A[1] - 30, 0), yaw: 0 } },
    shot([A[0] + 10, 3, A[1] - 26], [A[0], 8, A[1] + 5], [A[0] + 4, 2, A[1] - 30], [A[0], 12, A[1] + 5], 5, { fov: 55 }),
    { sfx: 'roar', shake: 0.5 },
    say('Molochar', 'Little Val. I remember the day I gave you that blade. You held it like it might break.', 4.5),
    say('Molochar', 'Now I make a thousand a day. None of them ever break. None of them ever MEAN anything.', 5),
    shot([A[0] - 3, 2.5, A[1] - 35], [A[0], 2.4, A[1] - 30], null, null, 3.5),
    say('Valkimsmor', 'Put down the hammer, master. Come home.', 3.5),
    say('Molochar', 'HOME IS ASH.', 2.5),
    { player: { pose: null } },
  ];
  const outro = [
    { player: { pose: 'idle' } },
    { do: () => dismissStranger() },
    { shot: { from: () => [pp().x + 8, pp().y + 3, pp().z - 8], lookFrom: () => [A[0], 4, A[1]], dur: 5 } },
    say(null, 'The fire goes out of Molochar all at once, like a held breath released.', 4),
    say('Molochar', '...Val? Your blade. Is it... still true?', 3.5),
    say('Valkimsmor', 'It never bent once, master.', 3),
    say('Molochar', 'Good. Good. Then I made one thing right.', 3.5),
    { do: (g) => { g.flash(0xfff0c0, 0.5); }, stinger: 'holy', do2: null },
    { do: (g) => { W.lava.target = -3; g.liftDarkness(0x3a1a18); } },
    say(null, 'The Furnace falls silent. In the cooling ash, a smith’s leather apron lies untouched by any flame.', 5),
    say('Valkimsmor', 'I will fall. I will not stay fallen.', 3),
    say(null, 'The Oathmark of Rising is etched upon his brow.', 4),
    { player: { pose: 'hero' }, shot: { orbit: { center: () => [pp().x, pp().y, pp().z], radius: 7, height: 1.5, a0: 0, a1: 1, lookY: 2 }, dur: 5 } },
    { wait: 3.5 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 5, spawn, yaw: 0, music: 'zerk', reward: 'helmet',
    onFurnaceHeated: (boss) => {
      W.lava.target = 2.6;
      g.ui.toast('The Furnace roars sevenfold — the lava is rising!', 'warn');
      g.audio.sfx('rumble', { dur: 4 });
      g.cam.shake(0.6);
      setTimeout(() => {
        if (g.world !== W) return;
        summonStranger();
        g.audio.stinger('holy');
        g.flash(0xfff4e0, 0.6);
        g.ui.subtitle('Molochar', 'WHO IS THAT? WHO WALKS WITH YOU IN MY FIRE?', 4);
        setTimeout(() => g.ui.subtitle(null, 'A figure of light walks beside Valkimsmor. The flames will not touch him now.', 5), 4200);
        boss.warded = true;
      }, 4200);
    },
    beats: [
      { type: 'cinematic', steps: intro },
      { type: 'goto', target: on(pathX(60), 60, 0), radius: 10, objective: 'Descend into the Forge of Ash', hint: 'Lava burns — stay on stone. Glide or leap across the channels, and watch for erupting geysers.' },
      { type: 'wave', objective: 'Break the forge-guard', waves: [[grp('thrall', 4, [pathX(80), 80], 10), grp('caster', 1, [pathX(90), 90], 10)], [grp('brute', 1, [pathX(85), 85], 4), grp('thrall', 2, [pathX(80), 80], 8)]] },
      { type: 'goto', target: on(pathX(160), 160, 0), radius: 10, objective: 'Press deeper toward the Furnace' },
      { type: 'wave', objective: 'Hold against the smith-born', waves: [[grp('thrall', 3, [pathX(175), 175], 10), grp('wraith', 2, [pathX(175), 175], 8)], [grp('brute', 2, [pathX(180), 180], 6), grp('caster', 2, [pathX(185), 185], 12)]] },
      { type: 'goto', target: on(A[0], A[1] - 30, 0), radius: 10, objective: 'Enter the Furnace' },
      {
        type: 'boss', objective: 'Defeat Molochar', music: 'boss',
        spawn: (g, again) => {
          dismissStranger();
          W.lava.target = 0;
          const b = new Molochar(g, V(A[0], 1.2, A[1] + 5));
          g.enemies.push(b);
          g.setBossTarget(b);
          if (!again) g.playCinematic(mIntro, () => b.setState('idle'));
          else b.setState('idle');
          return b;
        },
        outro,
      },
      { type: 'end' },
    ],
    update: (dt) => {
      const L = W.lava;
      if (L.target !== undefined) L.y = damp(L.y, L.target, 0.6, dt);
      L.mesh.position.y = L.y;
    },
  };
}
