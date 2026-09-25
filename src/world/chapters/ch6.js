// CHAPTER VI — The Drowned Sky. Island-hopping over Tehom, the sea of uncomforted grief.
import * as THREE from 'three';
import { P, V, shot, say, motes, placeCollectibles, grp, makeUpdraft } from './common.js';
import { TAU } from '../../core/utils.js';
import { glowSprite, glowMaterial } from '../../render/materials.js';
import { Leviathan } from '../../entities/bosses.js';
import { CHAPTERS } from '../../game/story.js';

export function chapter6(g) {
  const W = g.world;
  W.setAtmosphere({
    sky: { top: 0x06121e, horizon: 0x2a5a6a, bottom: 0x0a1a24, sun: 0x9af0ff, cloud: 0x2a4a5a, cloudShadow: 0x08121c, cloudiness: 0.9, stars: 0.4, sunDir: [-0.4, 0.3, 1], sunSize: 2 },
    fog: 0x10262e, fogNear: 40, fogFar: 380, hemiSky: 0x8ad0e0, hemiGround: 0x0a1418, hemiIntensity: 1.25, sunColor: 0xa8e8ff, sunIntensity: 2.0,
  });
  W.liquid({ y: 0, size: 1400, c1: 0x020a10, c2: 0x2ab8c0, emissive: 0.15, speed: 1.2, center: [0, 150], scale: 0.035 });
  W.killY = -0.5;
  W.bounds = { x: 0, z: 170, r: 260 };
  const A = [0, 330];
  const islands = [
    { x: 0, y: 8, z: 0, r: 12 },
    { x: 14, y: 10, z: 34, r: 7 }, { x: -6, y: 13, z: 62, r: 8 }, { x: 18, y: 12, z: 95, r: 11 },
    { x: -20, y: 16, z: 126, r: 7 }, { x: 6, y: 22, z: 158, r: 9 }, { x: 30, y: 26, z: 190, r: 12 },
    { x: 4, y: 20, z: 226, r: 8 }, { x: -18, y: 18, z: 260, r: 8 }, { x: 0, y: 14, z: 292, r: 7 },
    { x: A[0], y: 12, z: A[1], r: 17 }, // arena centre
    { x: A[0] + 26, y: 13, z: A[1] + 6, r: 8 }, { x: A[0] - 26, y: 13, z: A[1] - 4, r: 8 }, { x: A[0] + 6, y: 14, z: A[1] + 28, r: 8 }, { x: A[0] - 8, y: 11, z: A[1] - 26, r: 7 },
    // secret isles
    { x: -60, y: 30, z: 70, r: 6 }, { x: 70, y: 38, z: 140, r: 6 }, { x: -70, y: 44, z: 210, r: 5 }, { x: 60, y: 52, z: 262, r: 5 }, { x: -50, y: 20, z: 330, r: 6 },
  ];
  W.buildIslands(islands, { top: 0x2a3a3a, top2: 0x4a6a60, rock: 0x3a3a48, rockDark: 0x0a0a14 }, 61);
  const tops = W.platforms.filter((p) => p.island);
  W.instance(P.pillar(1, 0x6a7a80, 0x2ab8c0), W.scatter(22, { seed: 62, onPlatforms: tops, minDist: 6, avoid: [[A[0], A[1], 12]] }), { collide: 0.7, colliderH: 4 });
  W.instance(P.pillar(2, 0x6a7a80, 0x2ab8c0), W.scatter(14, { seed: 63, onPlatforms: tops, minDist: 6, avoid: [[A[0], A[1], 12]] }), { collide: 0.7, colliderH: 5 });
  W.instance(P.deadTree(7), W.scatter(16, { seed: 64, onPlatforms: tops, minDist: 6, avoid: [[A[0], A[1], 14]] }), { collide: 0.4 });
  W.instance(P.grassTuft(0x2a4a40, 0x6a9a8a), W.scatter(400, { seed: 65, onPlatforms: tops }), { outline: 0, shadow: false });
  const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 2.2) });
  W.instance(P.crystal(), W.scatter(30, { seed: 66, onPlatforms: tops, minDist: 5 }), { material: cm, outline: 0.03, emissive: true, shadow: false });
  // Distant sea-stacks
  W.instance(P.obsidianSpire(40), [[-120, 60], [130, 120], [-140, 260], [150, 330], [-60, 420], [80, -60]].map(([x, z]) => ({ x, z, y: -5, s: 1.5 })), { outline: 0.1 });
  motes(g, 0x9af0ff, { count: 400, rise: -1.5, size: 0.1 });
  // Lightning
  let lt = 3;
  W.addAnimated({ update: (t, dt) => {
    lt -= dt;
    if (lt < 0) {
      lt = 5 + Math.random() * 8;
      g.flash(0xd8f4ff, 0.35);
      setTimeout(() => g.audio.sfx('rumble', { dur: 2 }), 300 + Math.random() * 800);
    }
  } });
  makeUpdraft(W, { x: -8, z: 110, bottom: 0, top: 36, r: 5, color: 0x9af0ff });
  makeUpdraft(W, { x: 22, z: 140, bottom: 0, top: 44, r: 5, color: 0x9af0ff });
  makeUpdraft(W, { x: -36, z: 70, bottom: 0, top: 42, r: 4.5, color: 0x9af0ff });
  makeUpdraft(W, { x: 50, z: 150, bottom: 0, top: 50, r: 4.5, color: 0x9af0ff });
  makeUpdraft(W, { x: -45, z: 205, bottom: 0, top: 56, r: 4.5, color: 0x9af0ff });
  makeUpdraft(W, { x: 45, z: 250, bottom: 0, top: 64, r: 4.5, color: 0x9af0ff });

  const top = (i, dy = 1.5) => { const s = islands[i]; return [s.x, s.y + dy, s.z]; };
  placeCollectibles(g, 6, {
    feathers: [top(1), top(2), top(4), top(7), top(8), top(15), top(16), [-8, 30, 110], [22, 38, 140], top(19), [A[0] + 26, 14.5, A[1] + 6], [A[0] - 8, 12.5, A[1] - 26]],
    scrolls: [top(17), top(18), [A[0] + 6, 15.5, A[1] + 28]],
    relic: [30, 27.5, 196],
  });

  const ch = CHAPTERS[5];
  const spawn = [0, 8, 0];
  const intro = [
    { fade: 1, fadeDur: 0.01 },
    { music: 'zerk', intensity: 0 },
    { player: { pose: 'idle', pos: spawn, yaw: 0 } },
    shot([50, 30, -30], [0, 10, 120], [-40, 20, 60], [0, 12, 330], 9),
    { fade: 0, fadeDur: 2.5 },
    { card: ch, wait: 5.5 },
    { cardOut: true, wait: 0.5 },
    shot([4, 10, -5], [0, 9.4, 0], [2, 10.5, -7], [0, 12, 60], 7),
    say(null, 'Beneath the isles lies Tehom — not water, but every tear the Hollowed ever wept alone.', 5),
    say('Valkimsmor', 'Do not touch the sea. It remembers every grief. It will make you remember yours.', 4.5),
    { player: { pose: null } },
  ];
  const zek = { sprite: null };
  const temptation = [
    { player: { pose: 'idle' } },
    { do: (g) => {
      const s = glowSprite(0x8040ff, 80, 0.0);
      s.position.set(20, 60, 260);
      W.scene.add(s);
      zek.sprite = s;
      let o = 0;
      W.addAnimated({ update: (t, dt) => { if (zek.sprite) { o = Math.min(0.55, o + dt * 0.3); s.material.opacity = o; s.scale.setScalar(80 + Math.sin(t * 2) * 6); } } });
    }, stinger: 'dark', sfx: 'roar' },
    { shot: { from: () => [g.player.pos.x - 4, g.player.pos.y + 2, g.player.pos.z - 6], lookFrom: () => [20, 55, 260], dur: 9 } },
    say('Zekeriah', 'Val. My last student. Look how tired you are.', 4),
    say('Zekeriah', 'Three hundred and eleven feathers laid in the hands of the dead. I can give them all back to you.', 5),
    say('Zekeriah', 'Every Wingbearer. Every brother. Alive, and whole, and flying beside you again.', 5),
    say('Zekeriah', 'Only kneel. Kneel once, and the Order is restored.', 4),
    { shot: { from: () => [g.player.pos.x + 2.5, g.player.pos.y + 1.7, g.player.pos.z + 3], lookFrom: () => [g.player.pos.x, g.player.pos.y + 1.7, g.player.pos.z], dur: 7 } },
    { wait: 1.5 },
    say('Valkimsmor', 'They did not die so that I would kneel to you.', 4),
    say('Valkimsmor', 'What you offer is what I lost. What you ask for is the reason it was worth losing.', 5),
    say('Zekeriah', '...Then drown with them.', 3),
    { do: () => { if (zek.sprite) { W.scene.remove(zek.sprite); zek.sprite = null; } }, sfx: 'rumble', shake: 0.6 },
    { player: { pose: null } },
  ];
  const outro = [
    { player: { pose: 'idle' } },
    { shot: { from: () => [g.player.pos.x + 12, g.player.pos.y + 6, g.player.pos.z - 10], lookFrom: () => [A[0] + 20, 8, A[1] + 20], dur: 6 } },
    say(null, 'Tehomar sinks — and for a moment, the black sea turns clear, and the stars can be seen in it.', 5),
    { do: (g) => g.liftDarkness(0x2a5a6a), stinger: 'holy' },
    say(null, 'Somewhere below, a tear that was never wiped away finally is.', 4),
    say('Valkimsmor', 'I will speak only what was first spoken to me.', 3.5),
    { flash: 0xfff0c0, flashAmt: 0.6 },
    say(null, 'The Oathmark of the Voice is etched along the blade of Veritas.', 4),
    { player: { pose: 'hero' }, shot: { orbit: { center: () => [g.player.pos.x, g.player.pos.y, g.player.pos.z], radius: 7, height: 1.5, a0: 0, a1: 1, lookY: 2 }, dur: 5 } },
    { wait: 3.5 },
    { fade: 1, fadeDur: 1.5, wait: 1.6 },
    { player: { pose: null } },
  ];

  return {
    id: 6, spawn, yaw: 0, music: 'zerk', reward: 'sword',
    beats: [
      { type: 'cinematic', steps: intro },
      { type: 'goto', target: top(3, 0), radius: 8, objective: 'Cross the drowned isles', hint: 'The sea of Tehom is deadly. Chain glides and wing-beats between the islands, and ride the Rivers of Breath.' },
      { type: 'wave', objective: 'Scatter the wraith-flock', waves: [[grp('wraith', 4, [18, 95], 10)], [grp('wraith', 3, [18, 95], 10), grp('caster', 2, [18, 95], 6)]] },
      { type: 'goto', target: top(6, 0), radius: 10, objective: 'Climb toward the storm' },
      { type: 'wave', objective: 'Hold the high isle', waves: [[grp('thrall', 4, [30, 190], 8), grp('wraith', 2, [30, 190], 10)], [grp('brute', 1, [30, 190], 4), grp('wraith', 3, [30, 190], 10)]] },
      { type: 'goto', target: top(8, 0), radius: 8, objective: 'Follow the dying light' },
      { type: 'cinematic', steps: temptation },
      { type: 'goto', target: [A[0], 12, A[1]], radius: 12, objective: 'Face what rises from the deep' },
      {
        type: 'boss', objective: 'Defeat Tehomar', music: 'boss',
        spawn: (g, again) => {
          const b = new Leviathan(g, V(A[0] + 30, -10, A[1] + 30), 0);
          g.enemies.push(b);
          g.setBossTarget(b);
          if (!again) {
            g.playCinematic([
              { player: { pose: 'combat' } },
              { shot: { from: () => [A[0] - 10, 16, A[1] - 14], lookFrom: () => [b.pos.x, b.pos.y, b.pos.z], dur: 4 } },
              { sfx: 'roar', shake: 0.7, wait: 1 },
              say(null, 'Tehomar, the Deep That Hungers — loneliness grown vast in the dark.', 3.5),
              { player: { pose: null } },
            ], () => { b.startFight(); g.ui.hint('Tehomar is armored while it swims. Dodge its beam and bite — when its head strikes an island, it is <b>stuck</b>. Strike then!', 8); });
          } else b.startFight();
          return b;
        },
        outro,
      },
      { type: 'end' },
    ],
  };
}
