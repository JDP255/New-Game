// Procedurally built model of Valkimsmor, the winged knight of Kim: rig, armour, wings, cape, sword.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, part, glowMaterial, glowSprite } from '../render/materials.js';

// ------------------------------------------------------------------ geometry helpers
export function bladeGeometry(length = 1.25, width = 0.1, thick = 0.028, segs = 10) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // Slightly leaf-shaped blade, tapering to a sharp point.
    const w = width * (t < 0.82 ? 1 - t * 0.18 + Math.sin(t * Math.PI) * 0.05 : (1 - t) / 0.18 * 0.85) * 0.5;
    const th = thick * 0.5 * (t < 0.9 ? 1 : (1 - t) / 0.1);
    const z = t * length;
    pos.push(-w, 0, z, 0, th, z, w, 0, z, 0, -th, z);
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

function featherGeometry(len, width, colBase, colTip, curl = 0.05, tint = null) {
  const s = new THREE.Shape();
  const w = width;
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.9, -len * 0.1, w * 1.05, -len * 0.55, w * 0.35, -len * 0.92);
  s.quadraticCurveTo(w * 0.1, -len * 1.02, 0, -len);
  s.quadraticCurveTo(-w * 0.55, -len * 0.9, -w * 0.7, -len * 0.5);
  s.bezierCurveTo(-w * 0.75, -len * 0.2, -w * 0.4, -len * 0.05, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  const colors = [];
  const cb = new THREE.Color(colBase), ct = new THREE.Color(colTip);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = Math.min(1, -y / len);
    p.setZ(i, Math.sin(t * Math.PI) * curl * len + Math.abs(p.getX(i)) * 0.15);
    c.copy(cb).lerp(ct, Math.pow(t, 2.2));
    // Dark rachis (quill) line down the middle.
    if (Math.abs(p.getX(i)) < w * 0.06) c.multiplyScalar(0.8);
    if (tint) c.lerp(tint, 0.15);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function placed(geo, x, y, z, rz = 0, ry = 0, rx = 0, s = 1) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')),
    new THREE.Vector3(s, s, s)
  );
  g.applyMatrix4(m);
  return g;
}

// Builds the three merged feather meshes for one wing's segments.
function buildWingFeathers(colors) {
  const { base, tip, covert, covertTip } = colors;
  const segs = { w1: [], w2: [], w3: [] };
  // Primaries on the "hand": fan outward to the tip.
  const prim = 10;
  for (let i = 0; i < prim; i++) {
    const t = i / (prim - 1);
    const len = 1.15 + Math.sin(t * Math.PI * 0.85) * 0.5;
    const ang = 0.35 + t * 1.2;
    segs.w3.push(placed(featherGeometry(len, 0.13, base, tip, 0.04), 0.05 + t * 0.62, 0, -0.01 - t * 0.005, ang, 0, 0));
  }
  // Secondaries on the forearm.
  const sec = 9;
  for (let i = 0; i < sec; i++) {
    const t = i / (sec - 1);
    const len = 1.05 + t * 0.12;
    segs.w2.push(placed(featherGeometry(len, 0.14, base, tip, 0.05), 0.02 + t * 0.72, 0, -0.012, -0.08 + t * 0.35, 0, 0));
  }
  // Tertials near the body.
  const ter = 6;
  for (let i = 0; i < ter; i++) {
    const t = i / (ter - 1);
    segs.w1.push(placed(featherGeometry(0.85 + t * 0.15, 0.14, base, tip, 0.05), 0.05 + t * 0.5, 0, -0.012, -0.35 + t * 0.25, 0, 0));
  }
  // Golden coverts layered on top of each segment.
  const cov = (arr, n, x0, x1, len, a0, a1) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      arr.push(placed(featherGeometry(len * (0.9 + Math.sin(t * 3.1) * 0.15), 0.1, covert, covertTip, 0.06), x0 + (x1 - x0) * t, 0.02, 0.018, a0 + (a1 - a0) * t, 0, 0));
    }
  };
  cov(segs.w1, 5, 0.05, 0.55, 0.42, -0.25, -0.05);
  cov(segs.w2, 7, 0.0, 0.72, 0.45, -0.05, 0.25);
  cov(segs.w3, 6, 0.0, 0.6, 0.5, 0.3, 0.9);
  // Small top coverts (second row) for richness.
  cov(segs.w2, 6, 0.05, 0.7, 0.22, 0.0, 0.2);
  cov(segs.w1, 4, 0.1, 0.5, 0.22, -0.15, 0.0);
  const out = {};
  for (const k of Object.keys(segs)) out[k] = mergeGeometries(segs[k]);
  return out;
}

// ------------------------------------------------------------------ rig
export const JOINTS = [
  'body', 'hips', 'spine', 'chest', 'neck', 'head',
  'shL', 'elL', 'haL', 'shR', 'elR', 'haR',
  'thL', 'knL', 'ftL', 'thR', 'knR', 'ftR',
  'w1L', 'w2L', 'w3L', 'w1R', 'w2R', 'w3R',
];

export class Rig {
  constructor(joints) {
    this.j = joints;
    this.cur = {};
    for (const n of JOINTS) this.cur[n] = [0, 0, 0];
    this.curPos = [0, 0, 0];
  }
  // Apply target pose with exponential smoothing (lambda ~ responsiveness).
  apply(pose, dt, lambda = 18, wingLambda = null) {
    const k = 1 - Math.exp(-lambda * dt);
    const kw = 1 - Math.exp(-(wingLambda || lambda) * dt);
    for (const n of JOINTS) {
      const t = pose[n];
      const c = this.cur[n];
      const kk = n[0] === 'w' ? kw : k;
      if (t) {
        c[0] += (t[0] - c[0]) * kk;
        c[1] += (t[1] - c[1]) * kk;
        c[2] += (t[2] - c[2]) * kk;
      } else {
        c[0] += -c[0] * kk; c[1] += -c[1] * kk; c[2] += -c[2] * kk;
      }
      const o = this.j[n];
      if (o) o.rotation.set(c[0], c[1], c[2]);
    }
    const bp = pose.bodyPos || [0, 0, 0];
    for (let i = 0; i < 3; i++) this.curPos[i] += (bp[i] - this.curPos[i]) * k;
    this.j.body.position.set(this.curPos[0], this.curPos[1], this.curPos[2]);
  }
  snap(pose) {
    for (const n of JOINTS) {
      const t = pose[n] || [0, 0, 0];
      this.cur[n] = [...t];
      if (this.j[n]) this.j[n].rotation.set(t[0], t[1], t[2]);
    }
  }
}

// Pose helpers ----------------------------------------------------------------
export function emptyPose() {
  const p = {};
  for (const n of JOINTS) p[n] = [0, 0, 0];
  p.bodyPos = [0, 0, 0];
  return p;
}
export function copyPose(dst, src) {
  for (const n of JOINTS) {
    const s = src[n];
    if (s) { dst[n][0] = s[0]; dst[n][1] = s[1]; dst[n][2] = s[2]; }
  }
  if (src.bodyPos) { dst.bodyPos[0] = src.bodyPos[0]; dst.bodyPos[1] = src.bodyPos[1]; dst.bodyPos[2] = src.bodyPos[2]; }
  return dst;
}
// Blend b into a by weight w, only for joints present in b.
export function blendInto(a, b, w) {
  for (const n in b) {
    const s = b[n];
    const d = a[n];
    if (!d || !s) continue;
    d[0] += (s[0] - d[0]) * w;
    d[1] += (s[1] - d[1]) * w;
    d[2] += (s[2] - d[2]) * w;
  }
  return a;
}

// Sample a keyframed clip at normalised time t -> partial pose.
export function sampleClip(clip, time, out = {}) {
  const keys = clip.keys;
  let i = 0;
  while (i < keys.length - 1 && time > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const span = b.t - a.t;
  let u = span > 0 ? Math.min(1, Math.max(0, (time - a.t) / span)) : 1;
  if (b.ease) u = b.ease(u);
  for (const n in b.p) {
    const va = a.p[n] || b.p[n];
    const vb = b.p[n];
    if (!out[n]) out[n] = [0, 0, 0];
    out[n][0] = va[0] + (vb[0] - va[0]) * u;
    out[n][1] = va[1] + (vb[1] - va[1]) * u;
    out[n][2] = va[2] + (vb[2] - va[2]) * u;
  }
  for (const n in a.p) {
    if (!b.p[n]) {
      if (!out[n]) out[n] = [0, 0, 0];
      out[n][0] = a.p[n][0]; out[n][1] = a.p[n][1]; out[n][2] = a.p[n][2];
    }
  }
  return out;
}

// ------------------------------------------------------------------ model builder
export function buildKnight(opts = {}) {
  const palette = {
    steel: 0xdfe4ee, steelDark: 0x7d869c, gold: 0xe8b04a, under: 0x1f2336, cape: 0x2a52c8,
    capeTrim: 0xe8b04a, visor: new THREE.Color(0.9, 1.6, 2.6), feather: 0xfffaf0, featherTip: 0xf2c46a,
    covert: 0xfff2d6, covertTip: 0xe7a93f, ...opts.palette,
  };
  const M = {
    steel: toon(palette.steel, { rim: 0.55, rimColor: 0xcfe4ff, gradient: 'four', unique: true }),
    steelDark: toon(palette.steelDark, { rim: 0.3, rimColor: 0xcfe4ff, gradient: 'four' }),
    gold: toon(palette.gold, { rim: 0.7, rimColor: 0xffe2a0, rimPower: 2, emissive: 0x2a1400, gradient: 'four' }),
    under: toon(palette.under, { rim: 0.25, rimColor: 0x8fa8ff }),
    cape: toon(palette.cape, { rim: 0.5, rimColor: 0x6f9bff, emissive: 0x0c1a48, side: THREE.DoubleSide, vertexColors: true, unique: true }),
    feathers: toon(0xffffff, { rim: 0.45, rimColor: 0xfff0c8, vertexColors: true, side: THREE.DoubleSide, gradient: 'soft', emissive: 0xffc860, emissiveIntensity: 0, unique: true }),
    visor: new THREE.MeshBasicMaterial({ color: palette.visor, fog: false }),
    bladeCore: glowMaterial(0x9fd4ff, 0.9),
    blade: toon(0xf4f7ff, { rim: 0.9, rimColor: 0xbfe0ff, rimPower: 1.6, emissive: 0x10223a, gradient: 'four', unique: true }),
    gem: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.4, 2.8) }),
  };

  const root = new THREE.Group();
  root.name = 'Valkimsmor';
  const J = {};
  const G = (name, parent, x = 0, y = 0, z = 0, order = 'XYZ') => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.order = order;
    parent.add(g);
    J[name] = g;
    return g;
  };

  const body = G('body', root, 0, 0, 0, 'YXZ');
  const hips = G('hips', body, 0, 1.0, 0, 'YXZ');
  const spine = G('spine', hips, 0, 0.12, 0, 'YXZ');
  const chest = G('chest', spine, 0, 0.26, 0, 'YXZ');
  const neck = G('neck', chest, 0, 0.3, 0.01);
  const head = G('head', neck, 0, 0.08, 0);

  // --- Pelvis & faulds
  part(new THREE.CylinderGeometry(0.19, 0.23, 0.2, 12), M.steel, hips, { pos: [0, -0.02, 0] });
  part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), M.gold, hips, { pos: [0, 0.08, 0], outline: 0.012 });
  const tassetG = new THREE.BoxGeometry(0.16, 0.26, 0.03);
  for (const [x, z, ry] of [[0.1, 0.19, -0.25], [-0.1, 0.19, 0.25], [0.21, 0.02, Math.PI / 2 - 0.1], [-0.21, 0.02, -Math.PI / 2 + 0.1], [0, -0.2, 0]]) {
    const t = part(tassetG, M.steel, hips, { pos: [x, -0.15, z], rot: [z > 0 ? -0.12 : z < -0.1 ? 0.12 : 0, ry, x > 0.15 ? 0.12 : x < -0.15 ? -0.12 : 0], outline: 0.012 });
    part(new THREE.BoxGeometry(0.165, 0.03, 0.035), M.gold, t, { pos: [0, -0.13, 0], outline: 0 });
  }
  // --- Abdomen
  part(new THREE.CylinderGeometry(0.17, 0.18, 0.2, 12), M.under, spine, { pos: [0, 0.08, 0] });
  for (let i = 0; i < 2; i++) part(new THREE.TorusGeometry(0.175, 0.018, 6, 16), M.steel, spine, { pos: [0, 0.04 + i * 0.08, 0], rot: [Math.PI / 2, 0, 0], outline: 0 });

  // --- Breastplate
  const bp = part(new THREE.SphereGeometry(0.25, 16, 12), M.steel, chest, { pos: [0, 0.1, 0.02], scale: [1.15, 1.0, 0.82] });
  part(new THREE.BoxGeometry(0.03, 0.3, 0.06), M.steel, chest, { pos: [0, 0.1, 0.2], rot: [-0.15, 0, Math.PI / 4], scale: [1, 1, 1], outline: 0.01 });
  // Chest sigil: the Cross of Kim within a halo ring.
  const sig = new THREE.Group();
  sig.position.set(0, 0.14, 0.215);
  sig.rotation.x = -0.25;
  chest.add(sig);
  part(new THREE.TorusGeometry(0.07, 0.012, 6, 20), M.gold, sig, { outline: 0 });
  part(new THREE.BoxGeometry(0.02, 0.14, 0.02), M.gold, sig, { outline: 0 });
  part(new THREE.BoxGeometry(0.1, 0.02, 0.02), M.gold, sig, { pos: [0, 0.025, 0], outline: 0 });
  const sigGlow = glowSprite(0xffd27a, 0.35, 0.5);
  sig.add(sigGlow);
  // Backplate & gorget
  part(new THREE.CylinderGeometry(0.13, 0.19, 0.12, 12), M.steel, chest, { pos: [0, 0.3, 0] });
  part(new THREE.TorusGeometry(0.14, 0.02, 6, 16), M.gold, chest, { pos: [0, 0.27, 0], rot: [Math.PI / 2, 0, 0], outline: 0 });

  // --- Helm (great helm with T-visor and swept wing crests)
  part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), M.under, neck, { pos: [0, 0.02, 0] });
  const helm = part(new THREE.SphereGeometry(0.15, 16, 12), M.steel, head, { pos: [0, 0.13, 0], scale: [0.95, 1.12, 1.05] });
  part(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 12, 1, false), M.steel, head, { pos: [0, 0.06, 0.02], scale: [1, 1, 1.1] });
  // Face plate with a sharp prow.
  part(new THREE.ConeGeometry(0.12, 0.2, 4), M.steel, head, { pos: [0, 0.08, 0.1], rot: [Math.PI / 2 + 0.1, Math.PI / 4, 0], scale: [1, 1, 0.6], outline: 0.01 });
  // Glowing visor slits
  const visorH = part(new THREE.BoxGeometry(0.2, 0.022, 0.03), M.visor, head, { pos: [0, 0.14, 0.14], outline: 0, shadow: false });
  part(new THREE.BoxGeometry(0.022, 0.09, 0.03), M.visor, head, { pos: [0, 0.095, 0.155], outline: 0, shadow: false });
  const visorGlow = glowSprite(0x9fd8ff, 0.3, 0.35);
  visorGlow.position.set(0, 0.13, 0.2);
  head.add(visorGlow);
  // Crest ridge
  part(new THREE.BoxGeometry(0.025, 0.08, 0.3), M.gold, head, { pos: [0, 0.29, -0.02], rot: [0.2, 0, 0], outline: 0.01 });
  // Swept wing crests — the iconic silhouette.
  const crestShape = new THREE.Shape();
  crestShape.moveTo(0, 0);
  crestShape.bezierCurveTo(0.05, 0.12, 0.2, 0.3, 0.42, 0.42);
  crestShape.bezierCurveTo(0.3, 0.26, 0.26, 0.22, 0.34, 0.2);
  crestShape.bezierCurveTo(0.24, 0.16, 0.2, 0.12, 0.27, 0.08);
  crestShape.bezierCurveTo(0.15, 0.06, 0.08, 0.02, 0.06, -0.04);
  crestShape.lineTo(0, 0);
  const crestG = new THREE.ExtrudeGeometry(crestShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 8 });
  for (const s of [1, -1]) {
    part(crestG, M.gold, head, { pos: [0.13 * s - (s < 0 ? 0.02 : 0), 0.13, 0.08], rot: [0, Math.PI / 2 - 0.2 * s, 0], scale: [1.1, 0.62, 1], outline: 0.008 });
  }

  // --- Arms
  const makeArm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const sh = G('sh' + side, chest, 0.27 * s, 0.22, 0, 'YXZ');
    const el = G('el' + side, sh, 0, -0.32, 0);
    const ha = G('ha' + side, el, 0, -0.29, 0);
    // Pauldron: layered, flared plates with golden trim and a swept fin.
    const pd = new THREE.Group();
    pd.position.set(0.04 * s, 0.03, 0);
    pd.rotation.z = -0.45 * s;
    sh.add(pd);
    const hemi = new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    part(hemi, M.steel, pd, { pos: [0, 0.02, 0], scale: [1.15, 0.95, 1.1] });
    part(new THREE.TorusGeometry(0.18, 0.015, 6, 20), M.gold, pd, { pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1.12, 1], outline: 0 });
    part(hemi, M.steel, pd, { pos: [0.02 * s, -0.05, 0], scale: [1.08, 0.7, 1.05] });
    part(new THREE.TorusGeometry(0.17, 0.013, 6, 20), M.gold, pd, { pos: [0.02 * s, -0.05, 0], rot: [Math.PI / 2, 0, 0], scale: [1.0, 1.1, 1], outline: 0 });
    const fin = part(new THREE.ConeGeometry(0.04, 0.22, 4), M.gold, pd, { pos: [0.03 * s, 0.15, -0.05], rot: [-0.6, 0, -0.3 * s], outline: 0.008 });
    fin.scale.set(1, 1, 0.35);
    // Upper arm & elbow
    part(new THREE.CylinderGeometry(0.065, 0.058, 0.28, 10), M.under, sh, { pos: [0, -0.15, 0] });
    part(new THREE.CylinderGeometry(0.07, 0.065, 0.14, 10), M.steel, sh, { pos: [0, -0.2, 0] });
    part(new THREE.SphereGeometry(0.068, 10, 8), M.steel, el, { pos: [0, 0, -0.01] });
    part(new THREE.ConeGeometry(0.03, 0.09, 6), M.gold, el, { pos: [0, 0, -0.07], rot: [-Math.PI / 2, 0, 0], outline: 0.008 });
    // Gauntlet
    part(new THREE.CylinderGeometry(0.085, 0.058, 0.24, 10), M.steel, el, { pos: [0, -0.14, 0] });
    part(new THREE.TorusGeometry(0.083, 0.014, 6, 14), M.gold, el, { pos: [0, -0.03, 0], rot: [Math.PI / 2, 0, 0], outline: 0 });
    part(new THREE.BoxGeometry(0.085, 0.1, 0.1), M.steelDark, ha, { pos: [0, -0.04, 0.01] });
    return { sh, el, ha };
  };
  makeArm('L');
  const armR = makeArm('R');

  // --- Sword "Veritas"
  const sword = new THREE.Group();
  sword.name = 'Veritas';
  sword.position.set(0, -0.05, 0.0);
  armR.ha.add(sword);
  part(new THREE.CylinderGeometry(0.022, 0.025, 0.24, 8), M.under, sword, { pos: [0, 0, 0.0], rot: [Math.PI / 2, 0, 0], outline: 0.008 });
  part(new THREE.SphereGeometry(0.04, 10, 8), M.gold, sword, { pos: [0, 0, -0.14], outline: 0.008 });
  part(new THREE.SphereGeometry(0.022, 8, 6), M.gem, sword, { pos: [0, 0, -0.17], outline: 0 });
  // Winged crossguard
  const guardShape = new THREE.Shape();
  guardShape.moveTo(0, -0.03);
  guardShape.bezierCurveTo(0.08, -0.03, 0.18, 0.0, 0.26, 0.09);
  guardShape.bezierCurveTo(0.18, 0.04, 0.1, 0.04, 0.07, 0.035);
  guardShape.lineTo(0, 0.045);
  guardShape.lineTo(-0.07, 0.035);
  guardShape.bezierCurveTo(-0.1, 0.04, -0.18, 0.04, -0.26, 0.09);
  guardShape.bezierCurveTo(-0.18, 0.0, -0.08, -0.03, 0, -0.03);
  const guardG = new THREE.ExtrudeGeometry(guardShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  guardG.translate(0, 0, -0.02);
  part(guardG, M.gold, sword, { pos: [0, 0, 0.13], rot: [-Math.PI / 2, 0, 0], outline: 0.008 });
  part(new THREE.SphereGeometry(0.03, 8, 6), M.gem, sword, { pos: [0, 0, 0.14], scale: [1, 1, 0.6], outline: 0 });
  const bladeLen = 1.3;
  part(bladeGeometry(bladeLen, 0.11, 0.03), M.blade, sword, { pos: [0, 0, 0.15], outline: 0.008 });
  // Luminous fuller (runic core)
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.022, bladeLen * 0.8), M.bladeCore);
  core.rotation.x = -Math.PI / 2;
  core.position.set(0, 0.017, 0.15 + bladeLen * 0.42);
  sword.add(core);
  const core2 = core.clone();
  core2.position.y = -0.017;
  sword.add(core2);
  const swordBase = new THREE.Object3D();
  swordBase.position.set(0, 0, 0.3);
  sword.add(swordBase);
  const swordTip = new THREE.Object3D();
  swordTip.position.set(0, 0, 0.15 + bladeLen);
  sword.add(swordTip);
  const swordGlow = glowSprite(0xa8dcff, 1.1, 0);
  swordGlow.position.set(0, 0, 0.15 + bladeLen * 0.6);
  swordGlow.scale.set(0.7, 0.7, 1);
  sword.add(swordGlow);

  // --- Legs
  const makeLeg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const th = G('th' + side, hips, 0.12 * s, -0.06, 0);
    const kn = G('kn' + side, th, 0, -0.45, 0);
    const ft = G('ft' + side, kn, 0, -0.45, 0);
    part(new THREE.CylinderGeometry(0.1, 0.08, 0.42, 10), M.under, th, { pos: [0, -0.21, 0] });
    part(new THREE.CylinderGeometry(0.105, 0.085, 0.3, 10), M.steel, th, { pos: [0, -0.2, 0.012], scale: [1, 1, 1.05] });
    part(new THREE.SphereGeometry(0.075, 10, 8), M.steel, kn, { pos: [0, 0, 0.03] });
    part(new THREE.ConeGeometry(0.035, 0.1, 5), M.gold, kn, { pos: [0, 0.02, 0.1], rot: [Math.PI / 2 - 0.3, 0, 0], outline: 0.008 });
    part(new THREE.CylinderGeometry(0.085, 0.062, 0.42, 10), M.steel, kn, { pos: [0, -0.22, 0] });
    part(new THREE.BoxGeometry(0.03, 0.34, 0.05), M.gold, kn, { pos: [0, -0.2, 0.07], outline: 0.008 });
    const sab = part(new THREE.BoxGeometry(0.12, 0.08, 0.28), M.steel, ft, { pos: [0, -0.02, 0.06] });
    const toe = part(new THREE.ConeGeometry(0.06, 0.14, 4), M.steel, ft, { pos: [0, -0.03, 0.25], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.6], outline: 0.01 });
    return { th, kn, ft, sab, toe };
  };
  makeLeg('L');
  makeLeg('R');

  // --- Wings
  const wingGeos = buildWingFeathers({ base: palette.feather, tip: palette.featherTip, covert: palette.covert, covertTip: palette.covertTip });
  const wingParts = [];
  const makeWing = (side) => {
    const s = side === 'L' ? 1 : -1;
    const rootW = new THREE.Group();
    rootW.position.set(0.1 * s, 0.2, -0.2);
    rootW.scale.x = s;
    chest.add(rootW);
    const w1 = G('w1' + side, rootW, 0, 0, 0);
    const w2 = G('w2' + side, w1, 0.6, 0, 0);
    const w3 = G('w3' + side, w2, 0.78, 0, 0);
    // Armoured leading edge (golden wing bones)
    part(new THREE.CylinderGeometry(0.045, 0.035, 0.62, 8), M.gold, w1, { pos: [0.3, 0.02, 0], rot: [0, 0, Math.PI / 2], outline: 0.01 });
    part(new THREE.CylinderGeometry(0.035, 0.028, 0.8, 8), M.steel, w2, { pos: [0.4, 0.02, 0], rot: [0, 0, Math.PI / 2], outline: 0.01 });
    part(new THREE.SphereGeometry(0.05, 8, 6), M.gold, w2, { pos: [0, 0.02, 0], outline: 0.008 });
    part(new THREE.SphereGeometry(0.045, 8, 6), M.gold, w3, { pos: [0, 0.02, 0], outline: 0.008 });
    part(new THREE.ConeGeometry(0.035, 0.5, 6), M.gold, w3, { pos: [0.25, 0.02, 0], rot: [0, 0, -Math.PI / 2], outline: 0.008 });
    part(new THREE.ConeGeometry(0.025, 0.16, 5), M.gold, w3, { pos: [0.02, 0.1, 0], rot: [0, 0, 0.3], outline: 0.006 });
    for (const [w, g] of [[w1, wingGeos.w1], [w2, wingGeos.w2], [w3, wingGeos.w3]]) {
      const m = new THREE.Mesh(g, M.feathers);
      m.castShadow = true;
      w.add(m);
      wingParts.push(m);
    }
    return rootW;
  };
  makeWing('L');
  makeWing('R');

  // --- Cape (CPU-simulated cloth strip)
  const capeW = 0.46, capeL = 1.25, cols = 5, rows = 9;
  const capeGeo = new THREE.PlaneGeometry(capeW, capeL, cols - 1, rows - 1);
  const cc = [];
  const blue = new THREE.Color(palette.cape), goldC = new THREE.Color(palette.capeTrim), deep = new THREE.Color(0x0c1640);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const edge = r === rows - 1 || c === 0 || c === cols - 1;
      const col = r === rows - 1 ? goldC : c === 0 || c === cols - 1 ? blue.clone().lerp(goldC, 0.6) : blue.clone().lerp(deep, r / rows * 0.6);
      cc.push(col.r, col.g, col.b);
      void edge;
    }
  }
  capeGeo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  const cape = new THREE.Mesh(capeGeo, M.cape);
  cape.castShadow = true;
  cape.frustumCulled = false;
  const capeAnchor = new THREE.Group();
  capeAnchor.position.set(0, 0.24, -0.19);
  chest.add(capeAnchor);
  capeAnchor.add(cape);
  const capeSim = { rows, cols, w: capeW, l: capeL, ang: new Float32Array(rows), vel: new Float32Array(rows), side: new Float32Array(rows), sideVel: new Float32Array(rows) };
  for (let i = 0; i < rows; i++) capeSim.ang[i] = 0.15;

  // Collect meshes for hit-flash etc.
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const rig = new Rig(J);
  return {
    root, joints: J, rig, materials: M, sword, swordTip, swordBase, swordGlow, core,
    visorGlow, sigGlow, cape, capeSim, wingParts, helm, visorH,
  };
}

// Update the cape strip from simple per-row angular springs.
export function updateCape(model, dt, localVel, time, fallSpeed = 0) {
  const s = model.capeSim;
  const fwd = Math.max(-4, Math.min(20, localVel.z));
  const lateral = Math.max(-8, Math.min(8, localVel.x));
  for (let i = 0; i < s.rows; i++) {
    const t = i / (s.rows - 1);
    const flutter = Math.sin(time * (6 + fwd * 0.4) - i * 0.8) * (0.05 + Math.min(1, Math.abs(fwd) / 12) * 0.12) * t;
    let target = 0.12 + fwd * 0.055 * (0.6 + t) + Math.max(0, fallSpeed) * 0.05 + flutter;
    target = Math.min(1.45, target);
    const ks = 60, kd = 9;
    const a = (target - s.ang[i]) * ks - s.vel[i] * kd;
    s.vel[i] += a * dt;
    s.ang[i] += s.vel[i] * dt;
    const st = -lateral * 0.04 * t + Math.sin(time * 3.1 + i) * 0.03 * t;
    const as = (st - s.side[i]) * 40 - s.sideVel[i] * 7;
    s.sideVel[i] += as * dt;
    s.side[i] += s.sideVel[i] * dt;
  }
  const pos = model.cape.geometry.attributes.position;
  const seg = s.l / (s.rows - 1);
  let y = 0, z = 0, x = 0;
  for (let r = 0; r < s.rows; r++) {
    if (r > 0) {
      const a = Math.max(0.05, s.ang[r]);
      y -= Math.cos(a) * seg;
      z -= Math.sin(a) * seg;
      x += s.side[r] * seg;
    }
    const widen = 1 + (r / (s.rows - 1)) * 0.5;
    for (let c = 0; c < s.cols; c++) {
      const u = c / (s.cols - 1) - 0.5;
      const idx = r * s.cols + c;
      const curve = Math.abs(u) * 0.12 * widen;
      pos.setXYZ(idx, u * s.w * widen + x, y, z + curve);
    }
  }
  pos.needsUpdate = true;
  model.cape.geometry.computeVertexNormals();
}
