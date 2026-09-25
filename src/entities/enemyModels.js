// Models for the forces of Zerkskis: obsidian-armoured humanoids with violet soul-fire.
import * as THREE from 'three';
import { toon, part, glowSprite } from '../render/materials.js';
import { Rig } from './knightModel.js';

export function enemyMaterials(p) {
  return {
    armor: toon(p.armor, { rim: 0.6, rimColor: p.rim, rimPower: 2.2, gradient: 'three', unique: true }),
    trim: toon(p.trim, { rim: 0.5, rimColor: p.rim, emissive: p.trimGlow || 0x000000, gradient: 'three', unique: true }),
    cloth: toon(p.cloth, { rim: 0.3, rimColor: p.rim, side: THREE.DoubleSide, unique: true }),
    skin: toon(p.skin || 0x2a2030, { rim: 0.4, rimColor: p.rim, unique: true }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(p.eye).multiplyScalar(3), fog: false }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(p.eye).multiplyScalar(2.2), fog: false }),
  };
}

export const PALETTES = {
  zerk: { armor: 0x1d1828, trim: 0x5a2f7a, cloth: 0x2a1030, rim: 0xb070ff, eye: 0xc060ff, trimGlow: 0x250a35 },
  caster: { armor: 0x221a2e, trim: 0x2f7a78, cloth: 0x14202e, rim: 0x60fff0, eye: 0x40ffe0, trimGlow: 0x06302a },
  brute: { armor: 0x2a1f24, trim: 0x8a3a2a, cloth: 0x301410, rim: 0xff7050, eye: 0xff5030, trimGlow: 0x301005 },
  elite: { armor: 0x120e18, trim: 0xb08a2a, cloth: 0x3a0c1a, rim: 0xff60a0, eye: 0xff3070, trimGlow: 0x300818 },
  fire: { armor: 0x1a0c08, trim: 0xff7a1a, cloth: 0x3a1004, rim: 0xffa040, eye: 0xffb020, trimGlow: 0xa03000, skin: 0x301008 },
  wizard: { armor: 0x0c0a14, trim: 0x8a5ad8, cloth: 0x140a24, rim: 0xc080ff, eye: 0xd080ff, trimGlow: 0x3a1060 },
};

// Generic humanoid; returns { root, joints, rig, M, weaponTip, weaponBase, eyes }
export function buildHumanoid({ palette = PALETTES.zerk, weapon = 'blade', helm = 'horned', bulk = 1, scale = 1, cape = true } = {}) {
  const M = enemyMaterials(palette);
  const root = new THREE.Group();
  const J = {};
  const G = (name, parent, x = 0, y = 0, z = 0, order = 'XYZ') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.order = order;
    parent.add(g);
    J[name] = g;
    return g;
  };
  const scaler = new THREE.Group();
  scaler.scale.setScalar(scale);
  root.add(scaler);
  const b = bulk;
  const body = G('body', scaler, 0, 0, 0, 'YXZ');
  const hips = G('hips', body, 0, 0.98, 0, 'YXZ');
  const spine = G('spine', hips, 0, 0.12, 0, 'YXZ');
  const chest = G('chest', spine, 0, 0.26, 0, 'YXZ');
  const neck = G('neck', chest, 0, 0.3 + (b - 1) * 0.08, 0.02);
  const head = G('head', neck, 0, 0.08, 0);

  part(new THREE.CylinderGeometry(0.2 * b, 0.24 * b, 0.22, 8), M.armor, hips, { pos: [0, 0, 0] });
  // Tattered loin cloth
  part(new THREE.PlaneGeometry(0.34 * b, 0.55, 1, 3), M.cloth, hips, { pos: [0, -0.35, 0.2 * b], rot: [-0.08, 0, 0], outline: 0 });
  part(new THREE.PlaneGeometry(0.4 * b, 0.6, 1, 3), M.cloth, hips, { pos: [0, -0.35, -0.2 * b], rot: [0.08, 0, 0], outline: 0 });
  part(new THREE.CylinderGeometry(0.17 * b, 0.19 * b, 0.22, 8), M.skin, spine, { pos: [0, 0.08, 0] });
  // Chest — angular obsidian cuirass with glowing rune crack
  const cu = part(new THREE.DodecahedronGeometry(0.27 * b, 0), M.armor, chest, { pos: [0, 0.1, 0], scale: [1.2, 1.05, 0.8] });
  void cu;
  part(new THREE.BoxGeometry(0.04, 0.26, 0.02), M.glow, chest, { pos: [0, 0.1, 0.22 * b], outline: 0, shadow: false });
  part(new THREE.BoxGeometry(0.16, 0.03, 0.02), M.glow, chest, { pos: [0, 0.16, 0.215 * b], outline: 0, shadow: false });
  // Shoulder spikes
  for (const s of [1, -1]) {
    const sp = part(new THREE.ConeGeometry(0.13 * b, 0.34 * b, 5), M.armor, chest, { pos: [0.3 * s * b, 0.28, 0], rot: [0, 0, -0.9 * s], outline: 0.015 });
    part(new THREE.ConeGeometry(0.04 * b, 0.28 * b, 4), M.trim, sp, { pos: [0, 0.22 * b, 0], outline: 0.01 });
  }
  if (cape) {
    const c = part(new THREE.PlaneGeometry(0.6 * b, 1.1, 2, 4), M.cloth, chest, { pos: [0, -0.2, -0.2 * b], rot: [0.15, 0, 0], outline: 0 });
    c.geometry = c.geometry.clone();
    const pa = c.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      if (y < -0.4) pa.setY(i, y - Math.random() * 0.2); // ragged hem
    }
  }

  // Head
  part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), M.skin, neck, { pos: [0, 0.02, 0] });
  if (helm === 'horned') {
    part(new THREE.SphereGeometry(0.16, 10, 8), M.armor, head, { pos: [0, 0.12, 0], scale: [0.95, 1.05, 1.05] });
    part(new THREE.BoxGeometry(0.2, 0.08, 0.1), M.armor, head, { pos: [0, 0.08, 0.1], outline: 0.01 });
    for (const s of [1, -1]) {
      const h = part(new THREE.ConeGeometry(0.05, 0.42, 6), M.trim, head, { pos: [0.13 * s, 0.24, -0.02], rot: [-0.5, 0, -0.9 * s], outline: 0.01 });
      h.geometry = h.geometry.clone().translate(0, 0.21, 0);
    }
  } else if (helm === 'hood') {
    part(new THREE.ConeGeometry(0.22, 0.5, 8, 1, true), M.cloth, head, { pos: [0, 0.2, -0.03], rot: [-0.25, 0, 0], outline: 0.015 });
    part(new THREE.SphereGeometry(0.13, 8, 6), M.skin, head, { pos: [0, 0.1, 0.02] });
  } else if (helm === 'crown') {
    part(new THREE.SphereGeometry(0.14, 10, 8), M.skin, head, { pos: [0, 0.12, 0] });
    part(new THREE.ConeGeometry(0.2, 0.45, 8, 1, true), M.cloth, head, { pos: [0, 0.22, -0.04], rot: [-0.3, 0, 0], outline: 0.015 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      part(new THREE.ConeGeometry(0.025, 0.22, 4), M.trim, head, { pos: [Math.sin(a) * 0.13, 0.3, Math.cos(a) * 0.13], rot: [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3], outline: 0.006 });
    }
  } else if (helm === 'demon') {
    part(new THREE.SphereGeometry(0.17, 10, 8), M.armor, head, { pos: [0, 0.12, 0], scale: [1.1, 1, 1.1] });
    for (const s of [1, -1]) {
      const h = part(new THREE.TorusGeometry(0.2, 0.045, 6, 10, Math.PI * 0.9), M.trim, head, { pos: [0.12 * s, 0.22, 0], rot: [0, Math.PI / 2, s > 0 ? 0.3 : Math.PI - 0.3], outline: 0.01 });
      void h;
    }
    part(new THREE.BoxGeometry(0.2, 0.05, 0.05), M.glow, head, { pos: [0, 0.07, 0.15], outline: 0 });
  }
  const eyes = [];
  for (const s of [1, -1]) {
    const e = part(new THREE.SphereGeometry(0.022, 6, 4), M.eye, head, { pos: [0.055 * s, 0.13, 0.145], outline: 0, shadow: false });
    eyes.push(e);
  }
  const eyeGlow = glowSprite(palette.eye, 0.5, 0.6);
  eyeGlow.position.set(0, 0.13, 0.2);
  head.add(eyeGlow);

  // Arms
  const arm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const sh = G('sh' + side, chest, 0.29 * s * b, 0.2, 0, 'YXZ');
    const el = G('el' + side, sh, 0, -0.32 * (0.9 + b * 0.1), 0);
    const ha = G('ha' + side, el, 0, -0.3, 0);
    part(new THREE.CylinderGeometry(0.075 * b, 0.065 * b, 0.3, 7), M.skin, sh, { pos: [0, -0.15, 0] });
    part(new THREE.SphereGeometry(0.12 * b, 8, 6), M.armor, sh, { pos: [0.02 * s, 0, 0], scale: [1.1, 0.8, 1] });
    part(new THREE.CylinderGeometry(0.09 * b, 0.065 * b, 0.28, 7), M.armor, el, { pos: [0, -0.14, 0] });
    part(new THREE.ConeGeometry(0.035, 0.14, 4), M.trim, el, { pos: [0.07 * s * b, -0.12, 0], rot: [0, 0, -1.4 * s], outline: 0.008 });
    part(new THREE.BoxGeometry(0.09 * b, 0.1, 0.1), M.skin, ha, { pos: [0, -0.04, 0] });
    return { sh, el, ha };
  };
  arm('L');
  const R = arm('R');
  const L = { ha: J.haL };

  // Legs
  const leg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const th = G('th' + side, hips, 0.12 * s * b, -0.06, 0);
    const kn = G('kn' + side, th, 0, -0.45, 0);
    const ft = G('ft' + side, kn, 0, -0.44, 0);
    part(new THREE.CylinderGeometry(0.1 * b, 0.08 * b, 0.44, 7), M.skin, th, { pos: [0, -0.22, 0] });
    part(new THREE.CylinderGeometry(0.09 * b, 0.065 * b, 0.42, 7), M.armor, kn, { pos: [0, -0.21, 0] });
    part(new THREE.ConeGeometry(0.05, 0.16, 4), M.trim, kn, { pos: [0, 0.02, 0.08], rot: [1.2, 0, 0], outline: 0.008 });
    part(new THREE.BoxGeometry(0.12 * b, 0.08, 0.26), M.armor, ft, { pos: [0, -0.02, 0.05] });
  };
  leg('L');
  leg('R');

  // Weapon
  const wp = new THREE.Group();
  wp.position.set(0, -0.05, 0);
  R.ha.add(wp);
  const weaponBase = new THREE.Object3D();
  const weaponTip = new THREE.Object3D();
  wp.add(weaponBase, weaponTip);
  if (weapon === 'blade') {
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), M.skin, wp, { rot: [Math.PI / 2, 0, 0], outline: 0.006 });
    part(new THREE.BoxGeometry(0.2, 0.03, 0.04), M.trim, wp, { pos: [0, 0, 0.11], outline: 0.006 });
    const sh = new THREE.Shape();
    sh.moveTo(-0.04, 0);
    sh.lineTo(0.04, 0);
    sh.quadraticCurveTo(0.1, 0.5, 0.02, 1.0);
    sh.lineTo(-0.06, 0.85);
    sh.quadraticCurveTo(0.0, 0.5, -0.04, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false });
    part(g, M.armor, wp, { pos: [0, 0, 0.12], rot: [Math.PI / 2, 0, 0], outline: 0.008 });
    part(new THREE.BoxGeometry(0.012, 0.012, 0.8), M.glow, wp, { pos: [0.02, 0.012, 0.55], outline: 0, shadow: false });
    weaponBase.position.set(0, 0, 0.3);
    weaponTip.position.set(0, 0, 1.1);
  } else if (weapon === 'hammer') {
    part(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), M.skin, wp, { pos: [0, 0, 0.45], rot: [Math.PI / 2, 0, 0], outline: 0.008 });
    const hd = part(new THREE.BoxGeometry(0.45, 0.35, 0.35), M.armor, wp, { pos: [0, 0, 1.2], outline: 0.012 });
    part(new THREE.BoxGeometry(0.47, 0.06, 0.37), M.glow, hd, { outline: 0, shadow: false });
    for (const s of [1, -1]) part(new THREE.ConeGeometry(0.08, 0.25, 4), M.trim, hd, { pos: [0.3 * s, 0, 0], rot: [0, 0, -Math.PI / 2 * s], outline: 0.008 });
    weaponBase.position.set(0, 0, 0.8);
    weaponTip.position.set(0, 0, 1.3);
  } else if (weapon === 'orb' || weapon === 'staff') {
    if (weapon === 'staff') {
      part(new THREE.CylinderGeometry(0.025, 0.03, 2.0, 6), M.armor, wp, { pos: [0, 0, 0.3], rot: [Math.PI / 2, 0, 0], outline: 0.008 });
      const crook = part(new THREE.TorusGeometry(0.14, 0.03, 6, 10, Math.PI * 1.4), M.trim, wp, { pos: [0, 0.1, 1.35], rot: [0, Math.PI / 2, 0], outline: 0.008 });
      void crook;
      weaponTip.position.set(0, 0.12, 1.3);
    } else {
      weaponTip.position.set(0, -0.12, 0.08);
    }
    const orb = part(new THREE.IcosahedronGeometry(0.1, 1), M.glow, weapon === 'staff' ? wp : L.ha, { pos: weapon === 'staff' ? [0, 0.12, 1.3] : [0, -0.14, 0.05], outline: 0, shadow: false });
    const og = glowSprite(palette.eye, 0.9, 0.9);
    orb.add(og);
    weaponBase.position.set(0, 0, 0);
  } else if (weapon === 'club') {
    part(new THREE.CylinderGeometry(0.12, 0.06, 1.6, 7), M.skin, wp, { pos: [0, 0, 0.7], rot: [Math.PI / 2, 0, 0], outline: 0.01 });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      part(new THREE.ConeGeometry(0.05, 0.2, 4), M.trim, wp, { pos: [Math.sin(a) * 0.12, Math.cos(a) * 0.12, 1.1 + (i % 3) * 0.12], rot: [Math.cos(a) * 1.5, 0, -Math.sin(a) * 1.5], outline: 0.006 });
    }
    weaponBase.position.set(0, 0, 0.6);
    weaponTip.position.set(0, 0, 1.45);
  }

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const rig = new Rig(J);
  return { root, joints: J, rig, M, weaponTip, weaponBase, eyes, eyeGlow, scaler };
}

// Wraith: legless flying cloak with claws.
export function buildWraith(palette = PALETTES.zerk) {
  const M = enemyMaterials({ ...palette, cloth: 0x140a1e });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const cloakG = new THREE.ConeGeometry(0.55, 1.8, 8, 4, true);
  const pa = cloakG.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    if (pa.getY(i) < -0.5) pa.setY(i, pa.getY(i) - Math.random() * 0.5);
  }
  cloakG.computeVertexNormals();
  const cloak = part(cloakG, M.cloth, body, { pos: [0, 0, 0], outline: 0.02 });
  part(new THREE.SphereGeometry(0.28, 8, 6), M.cloth, body, { pos: [0, 0.85, 0.05], scale: [1, 1.2, 1] });
  part(new THREE.SphereGeometry(0.18, 8, 6), M.skin, body, { pos: [0, 0.8, 0.12] });
  const eyes = [];
  for (const s of [1, -1]) eyes.push(part(new THREE.SphereGeometry(0.035, 6, 4), M.eye, body, { pos: [0.07 * s, 0.84, 0.28], outline: 0 }));
  const eyeGlow = glowSprite(palette.eye, 0.8, 0.7);
  eyeGlow.position.set(0, 0.84, 0.35);
  body.add(eyeGlow);
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.35 * s, 0.4, 0.1);
    body.add(a);
    part(new THREE.CylinderGeometry(0.04, 0.03, 0.8, 5), M.skin, a, { pos: [0, -0.35, 0], outline: 0.01 });
    for (let k = -1; k <= 1; k++) part(new THREE.ConeGeometry(0.025, 0.3, 4), M.trim, a, { pos: [k * 0.04, -0.85, 0.02], rot: [0.3, 0, k * 0.2 + Math.PI], outline: 0.006 });
    arms.push(a);
  }
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { root, body, cloak, arms, M, eyes, eyeGlow };
}
