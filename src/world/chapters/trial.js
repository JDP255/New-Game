// Bonus: The Proving of the Ninth Feather — ten escalating waves on a moonlit isle of Kim.
import { buildKimIsles } from './ch1.js';
import { grp } from './common.js';

export function trial(g) {
  buildKimIsles(g, { title: true });
  const W = g.world;
  W.setAtmosphere({
    sky: { top: 0x06081e, horizon: 0x2a3a6a, bottom: 0x10142a, sun: 0xd8e4ff, cloud: 0x2a3050, cloudShadow: 0x0a0c1a, cloudiness: 0.4, stars: 1, sunDir: [0.3, 0.5, 0.8], sunSize: 3 },
    fog: 0x141a34, fogNear: 60, fogFar: 420, hemiSky: 0x8a9ad8, hemiGround: 0x202030, hemiIntensity: 1.0, sunColor: 0xc8d8ff, sunIntensity: 1.6,
  });
  const c = [25, 78];
  const w = (...groups) => [groups];
  const waves = [
    w(grp('thrall', 4, c, 10)),
    w(grp('thrall', 4, c, 10), grp('caster', 2, c, 14)),
    w(grp('brute', 1, c, 6), grp('thrall', 3, c, 10)),
    w(grp('wraith', 4, c, 10), grp('caster', 2, c, 14)),
    w(grp('elite', 1, c, 4), grp('thrall', 4, c, 10)),
    w(grp('brute', 2, c, 8), grp('caster', 2, c, 14)),
    w(grp('wraith', 5, c, 10), grp('elite', 1, c, 4)),
    w(grp('brute', 2, c, 8), grp('thrall', 4, c, 10), grp('caster', 2, c, 14)),
    w(grp('elite', 2, c, 6), grp('wraith', 4, c, 10)),
    w(grp('brute', 3, c, 8), grp('elite', 2, c, 6), grp('caster', 3, c, 14)),
  ];
  return {
    id: 8, trial: true, spawn: [25, 21, 70], yaw: 0, music: 'battle',
    beats: waves.map((wv, i) => ({
      type: 'wave', objective: `The Proving of the Ninth Feather — wave ${i + 1} of 10`, intensity: i > 6 ? 2 : 1, waves: wv,
      onDone: (g) => g.onTrialWave(i + 1),
    })).concat([{ type: 'end' }]),
  };
}
