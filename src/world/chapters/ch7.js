// CHAPTER VII — The Last Lantern. Ascend the Spire of Ascension and face the First Wingbearer.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, grp, makeUpdraft } from './common.js';
import { Noise2D, smoothstep, TAU } from '../../core/utils.js';
import { toon, outlineMaterial, glowSprite, beamMaterial } from '../../render/materials.js';
import { Zekeriah, ZekeriahClone } from '../../entities/bosses.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter7(g) {
  const W = g.world;
  const n = new Noise2D(71);
  const TR = 20, TH = 170, RING = 36;
  const fn = (x, z) => {
    const r = Math.hypot(x, z);
    return n.fbm(x * 0.02, z * 0.02, 3) * 4 + smoothstep(100, 150, r) * 45 * (0.5 + n.ridged(x * 0.03, z * 0.03, 3));
  };
  W.setAtmosphere({
    sky: { top: 0x0c0418, horizon: 0x5a2a6a, bottom: 0x1a0a24, sun: 0xd8a0ff, cloud: 0x3a1a4a, cloudShadow: 0x0a0414, cloudiness: 0.7, stars: 1, sunDir: [0.3, 0.55, 1], sunSize: 6 },
    fog: 0x3a1a48, fogNear: 60, fogFar: 520, hemiSky: 0xc8a0f0, hemiGround: 0x2a1a2a, hemiIntensity: 1.35, sunColor: 0xe0b8ff, sunIntensity: 2.3,
  });
  W.buildTerrain({ size: 420, segs: 120, seed: 71, fn, palette: { low: 0x2a2228, mid: 0x3a2e34, high: 0x4a3a44, cliff: 0x1a1218, heights: [0, 3, 20], rim: 0xc080ff } });
  W.killY = -30;
  W.bounds = { x: 0, z: 0, r: 125 };
  // The Spire
  const spireGeo = P.colorize(new THREE.CylinderGeometry(TR * 0.8, TR, TH, 20, 12), 0x3a2448, 0.06);
  const spire = new THREE.Mesh(spireGeo, toon(0xffffff, { vertexColors: true, rim: 0.4, rimColor: 0xa060ff, gradient: 'four' }));
  spire.position.y = TH / 2;
  spire.castShadow = true;
  W.scene.add(spire);
  { const so = new THREE.Mesh(spireGeo, outlineMaterial(0.2)); so.position.copy(spire.position); W.scene.add(so); }
  for (let i = 0; i < 9; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(TR * (1 - (i * 18 / TH) * 0.2) + 0.2, 0.3, 4, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.4, 2.0) }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 10 + i * 18;
    W.scene.add(band);
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 8, 400, 16, 1, true), beamMaterial(0xb060ff, 0.35));
  beacon.position.y = TH + 200;
  W.scene.add(beacon);
  W.addAnimated({ update: (t) => { beacon.material.uniforms.time.value = t; } });
  W.circles.push({ x: 0, z: 0, r: TR + 0.5, y0: -10, y1: TH - 0.5 });
  // Tiers of floating platforms around the spire, and the summit crown.
  const tiers = [40, 85, 130];
  const isl = [];
  tiers.forEach((y, ti) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + ti * 0.5;
      isl.push({ x: Math.sin(a) * RING, y, z: Math.cos(a) * RING, r: 8, depth: 7 });
    }
  });
  isl.push({ x: 0, y: TH, z: 0, r: 28, depth: 6 });
  W.buildIslands(isl, { top: 0x3a2a44, top2: 0x5a3a6a, rock: 0x2a1e30, rockDark: 0x0a0610 }, 72);
  // Ruins of Zerkskis homes at the base
  W.instance(P.pillar(1, 0x4a3a44, 0x8a50c0), W.scatter(40, { seed: 73, area: 100, minDist: 6, avoid: [[0, 0, 30]] }), { collide: 0.7, colliderH: 4 });
  W.instance(P.deadTree(9), W.scatter(40, { seed: 74, area: 100, minDist: 8, avoid: [[0, 0, 32]] }), { collide: 0.4 });
  W.instance(P.rock(8, 0x4a3a44), W.scatter(60, { seed: 75, area: 110, minDist: 4, avoid: [[0, 0, 28]] }), { collide: 0.8, colliderH: 1.4 });
  const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.4, 2.0) });
  W.instance(P.crystal(), W.scatter(40, { seed: 76, area: 100, minDist: 6, avoid: [[0, 0, 28]] }), { material: cm, outline: 0.03, emissive: true, shadow: false });
  motes(g, 0xc080ff, { count: 500, rise: 0.6, size: 0.14 });
  // Rivers of Breath between tiers
  const up = (a, bottom, top) => makeUpdraft(W, { x: Math.sin(a) * (RING + 4), z: Math.cos(a) * (RING + 4), bottom, top, r: 5, color: 0xe0c0ff });
  up(0.5, 0, 50);
  up(0.5 + TAU / 12 + 0.5, 30, 96);
  up(1.0 + TAU / 12 + 0.5, 75, 141);
  up(1.5 + TAU / 12 + 0.5, 120, TH + 12);

  const tierTop = (ti, i, dy = 1.5) => { const a = (i / 6) * TAU + ti * 0.5; return [Math.sin(a) * RING, tiers[ti] + dy, Math.cos(a) * RING]; };
  placeCollectibles(g, 7, {
    feathers: [tierTop(0, 1), tierTop(0, 3), tierTop(0, 5), tierTop(1, 0), tierTop(1, 2), tierTop(1, 4), tierTop(2, 1), tierTop(2, 3), tierTop(2, 5), [60, W.surfaceAt(60, 60) + 1.5, 60], [-70, W.surfaceAt(-70, 20) + 1.5, 20], [0, TH + 7, 0]],
    scrolls: [tierTop(0, 4), tierTop(1, 3), tierTop(2, 0)],
    relic: [0, TH + 1.5, -22],
  });

  const arena = { x: 0, z: 0, r: 24, y: TH };
  const ch = CHAPTERS[6];
  const spawn = [0, W.surfaceAt(0, -80), -80];
  const pp = () => g.player.pos;
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'zekeriah', intensity: 0 },
    { player: { pose: 'idle', pos: spawn, yaw: 0 } },
    shot([0, 5, -110], [0, 60, 0], [0, 40, -140], [0, TH + 20, 0], 10, { fov: 50 }),
    { fade: 0, fadeDur: 2.5 },
    say(null, 'The Spire of Ascension. Built from the walls of every home in Zerkskis — each stone given by someone who was promised the dark would end.', 7),
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 0.5 },
    shot([spawn[0] + 3, spawn[1] + 1.2, spawn[2] - 4], [0, 90, 0], null, null, 6),
    say('Valkimsmor', 'The Lantern is almost gone. He is nearly at the top.', 3.5),
    say('Zekeriah', 'Climb, Val. You were always my best climber. Come and see what I see.', 4.5),
    { player: { pose: null }, music: 'zerk', intensity: 1 },
  ];
  const summit = [
    { player: { pose: 'combat', pos: [0, TH, -20], yaw: 0 } },
    shot([8, TH + 3, -26], [0, TH + 2, 6], [4, TH + 2, -24], [0, TH + 2.5, 6], 5, { fov: 50 }),
    say('Zekeriah', 'Three hundred years I asked. Three hundred years the Voice only sang. Never once did it answer ME.', 5.5),
    say('Zekeriah', 'So I will take the light, and I will never need to ask for anything again.', 4.5),
    shot([-2, TH + 1.8, -24], [0, TH + 1.8, -20], null, null, 5),
    say('Valkimsmor', 'It was always given freely, master. That was the answer.', 4),
    say('Zekeriah', 'Then I reject the answer.', 3),
    { stinger: 'dark', shake: 0.5 },
    { player: { pose: null } },
  ];
  const finale = [
    { player: { pose: 'combat', pos: [0, TH, -6], yaw: 0 } },
    { do: (g) => g.clearEnemies(true) },
    shot([5, TH + 2, -10], [0, TH + 1, 3], null, null, 6, { fov: 48 }),
    say(null, 'The darkness drains out of him. What kneels on the summit is only an old man, with smoke where his wings should be.', 6),
    say('Zekeriah', 'Finish it, Val. It is what I would do.', 4),
    { player: { pose: 'hero' }, sfx: 'swing' },
    shot([-3, TH + 1, -9], [0, TH + 3.5, -6], null, null, 4),
    { wait: 2 },
    say('Valkimsmor', 'I know. That is why I will not.', 3.5),
    { player: { pose: 'kneel' }, sfx: 'land' },
    shot([3, TH + 1.2, -2], [0, TH + 1.1, -4], [2, TH + 1.4, -1], [0, TH + 1, -4], 12),
    say('Valkimsmor', 'The Rule of the Ninth Feather, master. You taught it to me. It is for the one who falls beside you.', 6),
    { do: (g) => g.fx.burst(V(0, TH + 1.3, -4), 60, { speed: 2, color: [1.8, 1.6, 1.1], life: 2, size: 0.5, gravity: -0.5 }), stinger: 'holy' },
    say(null, 'Valkimsmor plucks the ninth feather from his own wing and lays it in his teacher’s hand.', 5),
    say('Zekeriah', 'I fell three hundred years ago, Val. You were not beside me.', 4.5),
    say('Valkimsmor', 'I am now.', 3),
    { music: 'hope', intensity: 0 },
    { do: (g) => { g.liftDarkness('dawn'); g.releaseSoul(V(0, TH + 2, 0), 3); for (let i = 0; i < 24; i++) setTimeout(() => g.releaseSoul(V((Math.random() - 0.5) * 200, 5 + Math.random() * 20, (Math.random() - 0.5) * 200), 1.5), i * 150); }, flash: 0xfff6e0, flashAmt: 0.9 },
    shot([30, TH + 20, -60], [0, TH, 0], [60, TH + 30, -100], [0, TH - 20, 0], 10),
    say(null, 'The eclipse breaks. The Last Lantern blazes back to life — and across Zerkskis, ten thousand lights rise from the dark, each one carrying a name.', 7),
    say(null, 'Zekeriah weeps. From inside his robe he draws out a single white feather he has kept hidden for three hundred years.', 6),
    { shot: { orbit: { center: [0, TH, -6], radius: 9, height: 2, a0: -0.3, a1: 1.2, lookY: 2 }, dur: 12 } },
    { player: { pose: 'majestic' } },
    say(null, 'The last leaf of the Canticle had always been left blank.', 4),
    say(null, 'That morning, it was written.', 4),
    { wait: 1.5 },
    { bigTitle: true, wait: 4.5 },
    { bigTitle: false, fade: 1, fadeDur: 2, wait: 2.2 },
  ];

  let cloneSpawned = false;
  return {
    id: 7, spawn, yaw: 0, music: 'zerk',
    onZekeriahPhase: (phase, boss) => {
      if (phase === 2 && !cloneSpawned) {
        cloneSpawned = true;
        g.ui.subtitle('Zekeriah', 'Which of me will you strike, student? I taught you to see through shadows. Did you listen?', 5);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + 0.5;
          const c = new ZekeriahClone(g, V(Math.sin(a) * 14, TH + 1.2, Math.cos(a) * 14), arena);
          g.enemies.push(c);
          g.fx.burst(c.pos.clone().add(V(0, 1, 0)), 30, { speed: 6, color: [1, 0.4, 1.6], life: 0.6, size: 0.7 });
        }
      }
      if (phase === 3) {
        g.flash(0x8040ff, 0.7);
        g.audio.sfx('roar');
        g.cam.shake(0.8);
        g.audio.playTheme('zekeriah', 2);
        g.ui.subtitle('Zekeriah', 'If the light will not answer me, then I will become the dark it cannot ignore!', 5);
      }
    },
    beats: [
      { type: 'cinematic', steps: intro },
      { type: 'wave', objective: 'Fight through the Spire’s gate', waves: [[grp('thrall', 5, [0, -40], 12), grp('caster', 2, [0, -30], 12)], [grp('brute', 2, [0, -40], 8), grp('wraith', 2, [0, -40], 10)]] },
      { type: 'goto', target: tierTop(0, 0, 0), radius: 9, objective: 'Ascend — ride the River of Breath to the first ring', hint: 'Glide into the violet updrafts to climb the Spire.' },
      { type: 'wave', objective: 'Hold the first ring', waves: [[grp('wraith', 4, [tierTop(0, 0)[0], tierTop(0, 0)[2]], 10), grp('elite', 1, [tierTop(0, 0)[0], tierTop(0, 0)[2]], 3)]] },
      { type: 'goto', target: tierTop(1, 1, 0), radius: 9, objective: 'Ascend to the second ring' },
      { type: 'wave', objective: 'Hold the second ring', waves: [[grp('caster', 2, [tierTop(1, 1)[0], tierTop(1, 1)[2]], 6), grp('wraith', 4, [tierTop(1, 1)[0], tierTop(1, 1)[2]], 10)]] },
      { type: 'goto', target: tierTop(2, 2, 0), radius: 9, objective: 'Ascend to the third ring' },
      { type: 'wave', objective: 'Hold the third ring', waves: [[grp('elite', 1, [tierTop(2, 2)[0], tierTop(2, 2)[2]], 3, { name: 'Sorn, Last Captain of the Spire' }), grp('wraith', 4, [tierTop(2, 2)[0], tierTop(2, 2)[2]], 10)]] },
      { type: 'goto', target: [0, TH, -20], radius: 10, objective: 'Reach the summit' },
      { type: 'cinematic', steps: summit },
      {
        type: 'boss', objective: 'Defeat Zekeriah', music: 'zekeriah',
        spawn: (g) => {
          cloneSpawned = false;
          const b = new Zekeriah(g, V(0, TH + 1.2, 8), arena);
          g.enemies.push(b);
          g.setBossTarget(b);
          b.setState('idle');
          return b;
        },
        outro: finale,
      },
      { type: 'end' },
    ],
  };
}
