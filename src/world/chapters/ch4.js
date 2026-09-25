// CHAPTER IV — The Walls of Kor. Compass the fortress, sound seven horns, and the walls fall.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, npc, KIM_NPC, grp, makeUpdraft, Interactable } from './common.js';
import { Noise2D, smoothstep, TAU } from '../../core/utils.js';
import { toon, outlineMaterial, glowSprite, beamMaterial } from '../../render/materials.js';
import { Brute } from '../../entities/enemies.js';
import { PALETTES } from '../../entities/enemyModels.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter4(g) {
  const W = g.world;
  const n = new Noise2D(41);
  const C = [0, 120];
  const fn = (x, z) => {
    const r = Math.hypot(x - C[0], z - C[1]);
    let h = n.fbm(x * 0.015, z * 0.015, 4) * 5;
    h *= smoothstep(20, 60, r) * 0.8 + 0.2;
    h += smoothstep(150, 220, r) * 55 * (0.5 + n.ridged(x * 0.02, z * 0.02, 3));
    return h;
  };
  W.setAtmosphere({
    sky: { top: 0x4a7ac8, horizon: 0xf0d0a0, bottom: 0xe0b890, sun: 0xfff0d0, cloud: 0xfff4e8, cloudShadow: 0xc89880, cloudiness: 0.35, sunDir: [0.6, 0.45, -0.4] },
    fog: 0xe8c8a0, fogNear: 80, fogFar: 480, hemiSky: 0xd0e0ff, hemiGround: 0x806048, hemiIntensity: 1.2, sunColor: 0xfff0d0, sunIntensity: 2.6,
  });
  W.buildTerrain({ size: 520, segs: 150, seed: 41, fn, center: C, palette: { low: 0xb89868, mid: 0xc8a878, high: 0x8a6a58, cliff: 0x7a5a4a, heights: [0, 4, 20], rim: 0xffe0b0 } });
  W.killY = -30;
  W.bounds = { x: C[0], z: C[1], r: 150 };
  W.instance(P.rock(6, 0xa08870), W.scatter(80, { seed: 42, area: 140, center: C, minDist: 5, avoid: [[C[0], C[1], 75]] }), { collide: 0.8, colliderH: 1.4 });
  W.instance(P.grassTuft(0x8a8a50, 0xd8c890), W.scatter(600, { seed: 43, area: 140, center: C, avoid: [[C[0], C[1], 55]] }), { outline: 0, shadow: false });
  W.instance(P.deadTree(3), W.scatter(30, { seed: 44, area: 140, center: C, minDist: 10, avoid: [[C[0], C[1], 80]] }), { collide: 0.4 });
  motes(g, 0xffe0b0, { count: 250, rise: 0.1, size: 0.12 });

  // --- Fortress: ring wall of 14 segments + 7 towers + central keep
  const R = 50, segs = 14;
  const stone = toon(0xffffff, { vertexColors: true, rim: 0.25, gradient: 'four' });
  const wallGeo = P.wallSegment(2 * R * Math.sin(Math.PI / segs) + 1.5, 11, 3.2);
  const wallMeshes = [];
  const wallColliders = [];
  const rahabSeg = 9;
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * TAU;
    const x = C[0] + Math.sin(a) * R, z = C[1] + Math.cos(a) * R;
    if (i === 0) continue; // the southern gate gap (sealed by a portcullis)
    const m = new THREE.Mesh(wallGeo, stone);
    m.position.set(x, 0, z);
    m.rotation.y = a + Math.PI / 2;
    m.castShadow = m.receiveShadow = true;
    m.add(new THREE.Mesh(wallGeo, outlineMaterial(0.08)));
    W.scene.add(m);
    const cols = [];
    for (let k = -3; k <= 3; k++) {
      const t = (k / 3) * Math.PI / segs;
      const c = { x: C[0] + Math.sin(a + t) * R, z: C[1] + Math.cos(a + t) * R, r: 2.2, y0: -5, y1: 11.5 };
      W.circles.push(c);
      cols.push(c);
    }
    wallMeshes.push({ mesh: m, seg: i, cols });
    wallColliders.push(...cols);
    if (i === rahabSeg) {
      // Rahab's house in the wall, with the scarlet cord in the window
      const house = new THREE.Mesh(P.colorize(new THREE.BoxGeometry(6, 5, 4), 0xc8a878, 0.05), stone);
      house.position.set(0, 13.5, 0);
      m.add(house);
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.1, 0.1) }));
      cord.position.set(1.5, 12.5, 2.1);
      m.add(cord);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.5) }));
      win.position.set(1.5, 14, 2.02);
      m.add(win);
      W.platforms.push({ x, z, r: 3, top: 16 });
    }
  }
  // Gate
  const gateA = 0.5 / segs * TAU;
  const gx = C[0] + Math.sin(gateA) * R, gz = C[1] + Math.cos(gateA) * R;
  const gate = new THREE.Mesh(P.colorize(new THREE.BoxGeometry(22, 12, 1.5), 0x2a2020, 0.03), stone);
  gate.position.set(gx, 6, gz);
  gate.rotation.y = gateA + Math.PI / 2;
  W.scene.add(gate);
  const gateCols = [];
  for (let k = -3; k <= 3; k++) { const t = (k / 3) * Math.PI / segs; const c = { x: C[0] + Math.sin(gateA + t) * R, z: C[1] + Math.cos(gateA + t) * R, r: 2.2, y0: -5, y1: 12 }; W.circles.push(c); gateCols.push(c); }
  // Towers
  const towers = [];
  const towerGeo = P.tower(18, 4);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.2;
    const x = C[0] + Math.sin(a) * R, z = C[1] + Math.cos(a) * R;
    towers.push({ x, z, s: 1, ry: a });
    W.circles.push({ x, z, r: 4.6, y0: -5, y1: 30 });
    W.platforms.push({ x, z, r: 4.6, top: 19.2 });
  }
  W.instance(towerGeo, towers, { outline: 0.08 });
  // Keep
  const keep = new THREE.Mesh(P.tower(34, 9, 0x2a2430, 0x1a1020), stone);
  keep.position.set(C[0], 0, C[1] + 10);
  keep.castShadow = true;
  W.scene.add(keep);
  { const ko = new THREE.Mesh(keep.geometry, outlineMaterial(0.1)); ko.position.copy(keep.position); W.scene.add(ko); }
  W.circles.push({ x: C[0], z: C[1] + 10, r: 10.5, y0: -5, y1: 36 });
  W.platforms.push({ x: C[0], z: C[1] + 10, r: 10.5, top: 35.4 });
  for (const [x, z] of [[-20, 60], [20, 60], [-8, 55], [8, 55]]) {
    const b = P.banner(0x3a1450, 0x9a50ff);
    b.position.set(C[0] + x * 0.3 + x, 11.5, C[1] + z - 110 + 0);
    b.visible = false;
  }
  makeUpdraft(W, { x: C[0] + 64, z: C[1] - 20, bottom: 0, top: 40, r: 4.5 });
  makeUpdraft(W, { x: C[0] - 60, z: C[1] + 38, bottom: 0, top: 40, r: 4.5 });
  makeUpdraft(W, { x: C[0] + 20, z: C[1] - 5, bottom: 0, top: 46, r: 4.5 });

  const ang = (a, r, dy = 1.5) => { const x = C[0] + Math.sin(a) * r, z = C[1] + Math.cos(a) * r; return [x, W.surfaceAt(x, z) + dy, z]; };
  const tw = (i) => { const a = (i / 7) * TAU + 0.2; return [C[0] + Math.sin(a) * R, 20.7, C[1] + Math.cos(a) * R]; };
  placeCollectibles(g, 4, {
    feathers: [tw(0), tw(2), tw(4), tw(6), ang(0.9, 95), ang(2.4, 100), ang(3.6, 95), ang(5.1, 100), ang(1.6, 125), ang(4.4, 125), [C[0], 37, C[1] + 10], ang(0.3, 30)],
    scrolls: [tw(1), tw(5), ang(3.1, 20)],
    relic: [C[0] + Math.sin(((rahabSeg + 0.5) / segs) * TAU) * R, 17.5, C[1] + Math.cos(((rahabSeg + 0.5) / segs) * TAU) * R],
  });

  // Horn altars around the walls
  const hornGeo = P.hornAltar();
  const hornMat = toon(0xffffff, { vertexColors: true, rim: 0.4, rimColor: 0xffe0a0 });
  let blown = 0;
  const altars = [];
  const makeAltars = () => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + TAU / 14 + 0.2;
      const p = ang(a, 72, 0);
      const m = new THREE.Mesh(hornGeo, hornMat);
      m.position.set(...p);
      m.rotation.y = a;
      m.castShadow = true;
      W.scene.add(m);
      W.circles.push({ x: p[0], z: p[2], r: 1.7, y0: p[1] - 1, y1: p[1] + 2 });
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 50, 12, 1, true), beamMaterial(0xffe0a0, 0.3));
      beacon.position.set(p[0], p[1] + 25, p[2]);
      W.scene.add(beacon);
      W.addAnimated({ update: (t) => { beacon.material.uniforms.time.value = t; } });
      let guarded = false;
      const it = new Interactable(g, {
        pos: p, prompt: 'Ring the Bell', radius: 4,
        onUse: () => {
          blown++;
          beacon.visible = false;
          g.audio.sfx('bigbell', { note: [50, 52, 53, 55, 57, 58, 62][blown - 1] });
          g.fx.ring(V(p[0], p[1] + 1, p[2]), 60, { speed: 20, color: [1.6, 1.3, 0.7], life: 0.8, size: 0.8 });
          g.cam.shake(0.15 + blown * 0.06);
          g.ui.toast(`A bell of Kim rings out — <b>${blown}/7</b>. Inside the walls, someone whispers a forgotten name.`);
          for (const w of wallMeshes) w.mesh.position.y = -blown * 0.08;
        },
      });
      it.onUpdateGuard = () => {
        if (guarded || it.used) return;
        const d = Math.hypot(g.player.pos.x - p[0], g.player.pos.z - p[2]);
        if (d < 34) {
          guarded = true;
          const waves = [
            [grp('thrall', 3, [p[0], p[2]], 8)],
            [grp('thrall', 2, [p[0], p[2]], 8), grp('caster', 1, [p[0], p[2]], 12)],
            [grp('brute', 1, [p[0], p[2]], 5), grp('thrall', 1, [p[0], p[2]], 8)],
            [grp('wraith', 2, [p[0], p[2]], 8), grp('thrall', 2, [p[0], p[2]], 8)],
            [grp('caster', 2, [p[0], p[2]], 12), grp('thrall', 2, [p[0], p[2]], 8)],
            [grp('brute', 1, [p[0], p[2]], 5), grp('caster', 1, [p[0], p[2]], 10)],
            [grp('elite', 1, [p[0], p[2]], 4), grp('thrall', 2, [p[0], p[2]], 8)],
          ];
          g.spawnWave(waves[i]);
        }
      };
      it.resetGuard = () => { if (!it.used) guarded = false; };
      g.interactables.push(it);
      altars.push(it);
    }
    return altars;
  };

  const collapse = (g, skipping) => {
    wallMeshes.forEach((w, k) => {
      if (w.seg === rahabSeg) return;
      w.cols.forEach((c) => { c.disabled = true; });
      const start = g.time;
      const m = w.mesh;
      if (skipping) { m.visible = false; return; }
      W.addAnimated({ update: () => {
        const u = Math.min(1, (g.time - start - k * 0.12) / 2.2);
        if (u <= 0) return;
        m.position.y = -u * u * 13;
        m.rotation.z = u * 0.25 * (k % 2 ? 1 : -1);
        if (u < 1 && Math.random() < 0.3) g.smoke.spawn(m.position.x + (Math.random() - 0.5) * 20, 1, m.position.z + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4, { life: 3, size: 7, color: [0.55, 0.45, 0.38], alpha: 0.6 });
        if (u >= 1) m.visible = false;
      } });
    });
    gateCols.forEach((c) => { c.disabled = true; });
    gate.visible = false;
  };

  const ch = CHAPTERS[3];
  const spawn = [C[0], W.surfaceAt(C[0], C[1] - 110), C[1] - 110];
  const dorian = npc(g, V(C[0] + 5, W.surfaceAt(C[0] + 5, C[1] - 104), C[1] - 104), -2.4, { palette: KIM_NPC, helm: 'horned', weapon: 'blade', name: 'Captain Dorian' });
  void dorian;
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'kim', intensity: 0 },
    { player: { pose: 'idle', pos: spawn, yaw: 0 } },
    shot([C[0] + 90, 40, C[1] - 60], [C[0], 10, C[1]], [C[0] + 40, 30, C[1] - 110], [C[0], 12, C[1]], 9),
    { fade: 0, fadeDur: 2.5 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 0.5 },
    shot([spawn[0] + 8, spawn[1] + 2.2, spawn[2] + 3], [spawn[0] + 3, spawn[1] + 1.8, spawn[2] + 5], null, null, 8),
    say('Captain Dorian', 'Kor-Jerah. Every stone of those walls was sealed with a vow of forgetting. They have never been breached.'),
    say('Captain Dorian', 'We have no rams, no siege towers. What would you have us do?'),
    shot([spawn[0] - 2, spawn[1] + 1.8, spawn[2] + 4], [spawn[0], spawn[1] + 1.8, spawn[2]], null, null, 4),
    say('Valkimsmor', 'We will not breach them. A wall built of forgetting cannot stand against remembering.', 4.5),
    say('Valkimsmor', 'The Seven Bells of Kim still hang outside the city. Ring them, and the people inside will hear the Anthem again.', 5),
    { player: { pose: null } },
  ];
  const fall = [
    { player: { pose: 'hero' } },
    shot([C[0] - 110, 45, C[1] - 60], [C[0], 5, C[1]], [C[0] - 90, 30, C[1] - 90], [C[0], 5, C[1]], 9),
    say(null, 'The seventh bell rings — and ten thousand people inside the walls remember their names at once...', 4.5),
    { sfx: 'bigbell', sfxOpt: { note: 38 }, stinger: 'epic' },
    { sfx: 'rumble', sfxOpt: { dur: 5 }, shake: 1, do: collapse },
    say(null, '...and every oath of forgetting breaks in the same heartbeat.', 4.5),
    { wait: 1 },
    shot([C[0] + 30, 30, C[1] + 70], [C[0] + Math.sin(((rahabSeg + 0.5) / segs) * TAU) * R, 12, C[1] + Math.cos(((rahabSeg + 0.5) / segs) * TAU) * R], null, null, 4),
    say(null, 'Only one house stands — Mira\'s, where a lamp burned in the window through every year of the forgetting.', 5),
    { player: { pose: null } },
  ];
  const endScene = [
    { player: { pose: 'idle' } },
    { shot: { orbit: { center: () => [g.player.pos.x, g.player.pos.y, g.player.pos.z], radius: 8, height: 2.5, a0: 0, a1: 0.8, lookY: 1.8 }, dur: 8 } },
    say('Valkimsmor', 'What is thrown at the weak, I will throw back.', 3.5),
    { flash: 0xfff0c0, flashAmt: 0.6, stinger: 'holy' },
    say(null, 'The Oathmark of Shelter is etched upon his gauntlet. Perfect parries now hurl bolts back at their casters.', 5),
    { player: { pose: 'hero' }, wait: 2 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 4, spawn, yaw: 0, music: 'kim', reward: 'shield',
    beats: [
      { type: 'cinematic', steps: intro },
      {
        type: 'interact', objective: 'Ring the Seven Bells of Remembrance (0/7)',
        hint: 'Follow the pillars of light around the fortress and press <kbd>E</kbd> to ring each bell.',
        progress: (a, b) => `Ring the Seven Bells of Remembrance (${a}/${b})`,
        items: () => makeAltars(),
        onUpdate: () => altars.forEach((a) => a.onUpdateGuard()),
        onRestart: () => altars.forEach((a) => a.resetGuard()),
      },
      { type: 'cinematic', steps: fall },
      { type: 'wave', objective: 'Storm the keep of Kor', intensity: 1, checkpoint: [gx, 0, gz - 10],
        waves: [[grp('thrall', 4, [C[0], C[1]], 14), grp('caster', 2, [C[0], C[1] + 10], 18)], [grp('brute', 2, [C[0], C[1]], 10), grp('thrall', 2, [C[0], C[1]], 12)], [grp('wraith', 3, [C[0], C[1]], 12), grp('caster', 2, [C[0], C[1]], 16)]] },
      {
        type: 'boss', objective: 'Defeat the Warden of Kor', music: 'boss',
        spawn: (g) => {
          const b = new Brute(g, V(C[0], 0, C[1] - 8), { scale: 2.1, hp: 1100, name: 'Harrakh, Warden of Kor', palette: PALETTES.elite });
          g.enemies.push(b);
          g.setBossTarget(b);
          g.spawnWave([grp('caster', 2, [C[0], C[1]], 16)]);
          return b;
        },
        outro: endScene,
      },
      { type: 'end' },
    ],
  };
}
