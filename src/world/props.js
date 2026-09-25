// Procedural prop geometry (vertex coloured, merged) for instancing across the realms.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from '../core/utils.js';

const noise = new Noise2D(77);

export function colorize(geo, color, variance = 0, rng = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const v = (rng() - 0.5) * variance;
    for (let k = 0; k < 3 && i + k < n; k++) {
      arr[(i + k) * 3] = Math.max(0, c.r + v);
      arr[(i + k) * 3 + 1] = Math.max(0, c.g + v);
      arr[(i + k) * 3 + 2] = Math.max(0, c.b + v);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // Strip attributes that can break merging.
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

// Vertical gradient colouring (bottom -> top) for foliage and spires.
export function gradientize(geo, c0, c1, y0, y1, variance = 0.05) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  const p = g.attributes.position;
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0)));
    c.copy(a).lerp(b, t);
    const v = noise.noise(p.getX(i) * 3.1, p.getZ(i) * 3.1 + p.getY(i)) * variance;
    arr[i * 3] = c.r + v; arr[i * 3 + 1] = c.g + v; arr[i * 3 + 2] = c.b + v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

function jitter(geo, amt, seed = 1) {
  const p = geo.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = map.get(key);
    if (!d) {
      d = [noise.noise(p.getX(i) * 1.7 + seed, p.getZ(i) * 1.7) * amt, noise.noise(p.getY(i) * 1.7 + seed * 3, p.getX(i)) * amt, noise.noise(p.getZ(i) * 1.7, p.getY(i) + seed) * amt];
      map.set(key, d);
    }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

const T = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  ));
  return g;
};

// ---------------------------------------------------------------------- nature
export function goldenTree(variant = 0) {
  const parts = [];
  const h = 3.6 + variant * 0.6;
  parts.push(colorize(T(new THREE.CylinderGeometry(0.2, 0.42, h, 7), 0, h / 2, 0, 0.05, 0, 0.04), 0x5a3a28, 0.06));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.08, 0.14, 1.6, 5), 0.5, h * 0.7, 0, 0, 0, -0.9), 0x5a3a28, 0.05));
  const blobs = [[0, h + 0.8, 0, 2.1], [1.3, h + 0.2, 0.4, 1.5], [-1.1, h + 0.4, -0.3, 1.6], [0.2, h + 1.9, -0.2, 1.4], [-0.4, h - 0.2, 1.0, 1.2]];
  const cols = [[0xf2b233, 0xffe08a], [0xe88a2a, 0xffc860], [0xf6d06a, 0xfff2c0]];
  const [c0, c1] = cols[variant % cols.length];
  for (const [x, y, z, r] of blobs) {
    const g = jitter(new THREE.IcosahedronGeometry(r, 1), 0.35, x + y);
    T(g, x, y, z, 0, 0, 0, 1, 0.85, 1);
    parts.push(gradientize(g, c0, c1, y - r, y + r, 0.08));
  }
  return mergeGeometries(parts);
}

export function whiteTree() {
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(0.14, 0.3, 5, 6), 0, 2.5, 0), 0xefe9dd, 0.05));
  for (const [x, y, z, r] of [[0, 5.6, 0, 1.7], [0.9, 4.8, 0.3, 1.2], [-0.8, 5.0, -0.4, 1.3]]) {
    const g = jitter(new THREE.IcosahedronGeometry(r, 1), 0.3, x);
    T(g, x, y, z);
    parts.push(gradientize(g, 0xd8e8a0, 0xfff8d0, y - r, y + r, 0.06));
  }
  return mergeGeometries(parts);
}

export function pineTree(dark = false) {
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(0.15, 0.3, 2, 6), 0, 1, 0), dark ? 0x241a22 : 0x4a3428, 0.04));
  const c0 = dark ? 0x10262e : 0x1f5a4a, c1 = dark ? 0x2e4c56 : 0x5aa77a;
  for (let i = 0; i < 4; i++) {
    const r = 1.9 - i * 0.4, y = 1.6 + i * 1.3;
    const g = jitter(new THREE.ConeGeometry(r, 2.2, 7), 0.12, i);
    T(g, 0, y + 1.1, 0);
    parts.push(gradientize(g, c0, c1, y, y + 2.2, 0.05));
  }
  return mergeGeometries(parts);
}

export function deadTree(seed = 1) {
  const parts = [];
  const bark = 0x1c1420;
  parts.push(colorize(T(new THREE.CylinderGeometry(0.12, 0.45, 5, 6), 0, 2.5, 0, 0.1, 0, -0.05), bark, 0.04));
  const br = [[0.6, 3.5, 0, 0, 0, -0.9, 2.2], [-0.5, 4.1, 0.2, 0.3, 0, 0.8, 1.8], [0.1, 4.8, -0.4, -0.7, 0, 0.2, 1.5], [0.3, 2.6, 0.4, 0.8, 0, -0.5, 1.4]];
  br.forEach(([x, y, z, rx, ry, rz, l], i) => {
    parts.push(colorize(T(new THREE.CylinderGeometry(0.03, 0.12, l, 5), x, y, z, rx, ry + seed, rz), bark, 0.03));
    void i;
  });
  return mergeGeometries(parts);
}

export function rock(seed = 1, color = 0x8a8494, flat = true) {
  let g = new THREE.IcosahedronGeometry(1, 1);
  g = jitter(g, 0.35, seed);
  T(g, 0, 0.3, 0, 0, seed, 0, 1, 0.7, 1);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return gradientize(g, new THREE.Color(color).multiplyScalar(0.6), color, -0.4, 1.0, 0.06);
  void flat;
}

export function grassTuft(c0 = 0x3f7a3a, c1 = 0xd8d070) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.07, 0.6 + (i % 2) * 0.25, 3);
    T(g, Math.sin(a) * 0.1, 0.3, Math.cos(a) * 0.1, Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
    parts.push(gradientize(g, c0, c1, 0, 0.8, 0.04));
  }
  return mergeGeometries(parts);
}

export function flower(color = 0xfff4d0) {
  const parts = [colorize(T(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 3), 0, 0.2, 0), 0x3f7a3a)];
  parts.push(colorize(T(new THREE.IcosahedronGeometry(0.09, 0), 0, 0.42, 0), color, 0.05));
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------------- architecture
export function pillar(broken = 0, marble = 0xf2ece0, gold = 0xe0a83a) {
  const parts = [];
  const h = broken ? 2.5 + broken * 1.5 : 7;
  parts.push(colorize(T(new THREE.BoxGeometry(1.6, 0.4, 1.6), 0, 0.2, 0), marble, 0.03));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.55, 0.62, h, 10), 0, 0.4 + h / 2, 0), marble, 0.04));
  parts.push(colorize(T(new THREE.TorusGeometry(0.62, 0.07, 5, 14), 0, 0.55, 0, Math.PI / 2), gold, 0.02));
  if (!broken) {
    parts.push(colorize(T(new THREE.TorusGeometry(0.58, 0.07, 5, 14), 0, h + 0.2, 0, Math.PI / 2), gold, 0.02));
    parts.push(colorize(T(new THREE.BoxGeometry(1.5, 0.45, 1.5), 0, h + 0.6, 0), marble, 0.03));
  } else {
    parts.push(colorize(T(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 7), 0.1, h + 0.5, 0, 0.3, 0, 0.25), marble, 0.05));
  }
  return mergeGeometries(parts);
}

export function obsidianSpire(h = 12) {
  const parts = [];
  let g = new THREE.ConeGeometry(1.6, h, 5, 4);
  g = jitter(g, 0.35, h);
  T(g, 0, h / 2, 0);
  parts.push(gradientize(g, 0x0c0814, 0x3a2350, 0, h, 0.04));
  for (let i = 0; i < 3; i++) {
    let s = new THREE.ConeGeometry(0.6, h * 0.45, 4);
    s = jitter(s, 0.12, i + h);
    T(s, Math.cos(i * 2.1) * 1.2, h * 0.2, Math.sin(i * 2.1) * 1.2, Math.sin(i * 2.1) * 0.35, 0, -Math.cos(i * 2.1) * 0.35);
    parts.push(gradientize(s, 0x0c0814, 0x2a1a3c, 0, h * 0.4, 0.04));
  }
  return mergeGeometries(parts);
}

export function crystal() {
  let g = new THREE.OctahedronGeometry(0.6, 0);
  T(g, 0, 1.2, 0, 0, 0, 0, 1, 2.4, 1);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export function banner(color = 0x1d3b9c, trim = 0xe8b04a) {
  // Returns a group: pole + waving cloth (shader-animated)
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(
    colorize(T(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), 0, 3.5, 0), 0x3a2a20),
    new THREE.MeshToonMaterial({ vertexColors: true })
  );
  grp.add(pole);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshToonMaterial({ color: trim }));
  tip.position.y = 7.2;
  grp.add(tip);
  const cloth = new THREE.PlaneGeometry(1.4, 3.2, 6, 10);
  cloth.translate(0.72, -1.6, 0);
  const cols = [];
  const pa = cloth.attributes.position;
  const cA = new THREE.Color(color), cB = new THREE.Color(trim);
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i), x = pa.getX(i);
    const edge = y < -3.0 || x > 1.35 || x < 0.1;
    const emblem = Math.abs(x - 0.72) < 0.08 && y > -2.3 && y < -0.6 || (Math.abs(y + 1.1) < 0.08 && Math.abs(x - 0.72) < 0.4);
    const c = edge || emblem ? cB : cA;
    cols.push(c.r, c.g, c.b);
  }
  cloth.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const uni = { time: { value: Math.random() * 10 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = uni.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = transformed.x / 1.4;
        transformed.z += sin(time * 3.0 + transformed.x * 2.5 + transformed.y * 0.8) * 0.25 * w;
        transformed.x -= w * w * 0.1;`);
  };
  mat.customProgramCacheKey = () => 'banner';
  const cm = new THREE.Mesh(cloth, mat);
  cm.position.y = 6.8;
  cm.castShadow = true;
  grp.add(cm);
  grp.userData.uniforms = uni;
  return grp;
}

export function brazier() {
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(0.5, 0.8, 0.4, 8), 0, 0.2, 0), 0x3a3440));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.15, 0.25, 2.2, 6), 0, 1.4, 0), 0x2a2430));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.9, 0.4, 0.6, 8, 1, true), 0, 2.7, 0), 0xc89a3a));
  parts.push(colorize(T(new THREE.TorusGeometry(0.9, 0.08, 5, 12), 0, 3.0, 0, Math.PI / 2), 0xe8b04a));
  return mergeGeometries(parts);
}

export function hornAltar() {
  // Bell shrine of Kim: marble plinth, two posts, a beam and a great silver bell.
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(1.8, 2.1, 0.6, 8), 0, 0.3, 0), 0xe8e0cc, 0.04));
  for (const x of [-1.3, 1.3]) parts.push(colorize(T(new THREE.BoxGeometry(0.35, 4.2, 0.35), x, 2.7, 0), 0xe8e0cc, 0.04));
  parts.push(colorize(T(new THREE.BoxGeometry(3.3, 0.4, 0.5), 0, 4.8, 0), 0xe0a83a, 0.03));
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.25 + Math.pow(t, 2.2) * 0.85 + (i === 10 ? 0.12 : 0), 1.7 * (1 - t)));
  }
  const bell = new THREE.LatheGeometry(pts, 14);
  parts.push(colorize(T(bell, 0, 2.9, 0), 0xdfe4ee, 0.03));
  parts.push(colorize(T(new THREE.SphereGeometry(0.18, 8, 6), 0, 2.85, 0), 0xe0a83a));
  return mergeGeometries(parts);
}

// Simple gothic cathedral (Kim) built from primitives, returns {geo, windows:[{pos,rot,size}]}.
export function cathedral() {
  const parts = [];
  const marble = 0xf3eee2, gold = 0xe2aa3c, roof = 0x2c4ea8;
  // Nave
  parts.push(colorize(T(new THREE.BoxGeometry(14, 14, 34), 0, 7, 0), marble, 0.03));
  const roofG = new THREE.CylinderGeometry(0.01, 10.2, 7, 4, 1);
  T(roofG, 0, 17.5, 0, 0, Math.PI / 4, 0, 1, 1, 2.45);
  parts.push(colorize(roofG, roof, 0.03));
  // Transept
  parts.push(colorize(T(new THREE.BoxGeometry(28, 12, 10), 0, 6, -4), marble, 0.03));
  // Towers at facade
  for (const x of [-8.5, 8.5]) {
    parts.push(colorize(T(new THREE.BoxGeometry(6, 30, 6), x, 15, 16), marble, 0.03));
    parts.push(colorize(T(new THREE.ConeGeometry(4.3, 14, 4), x, 37, 16, 0, Math.PI / 4, 0), roof, 0.03));
    parts.push(colorize(T(new THREE.ConeGeometry(0.35, 3, 6), x, 45.2, 16), gold, 0.02));
    parts.push(colorize(T(new THREE.BoxGeometry(6.4, 0.6, 6.4), x, 30, 16), gold, 0.02));
  }
  // Central spire
  parts.push(colorize(T(new THREE.CylinderGeometry(3, 3.5, 10, 8), 0, 24, -4), marble, 0.03));
  parts.push(colorize(T(new THREE.ConeGeometry(3.2, 20, 8), 0, 39, -4), gold, 0.03));
  // Buttresses
  for (let i = 0; i < 5; i++) {
    for (const s of [-1, 1]) {
      parts.push(colorize(T(new THREE.BoxGeometry(1.2, 11, 2), s * 8.5, 5.5, -14 + i * 7), marble, 0.04));
      parts.push(colorize(T(new THREE.BoxGeometry(1, 7, 1.2), s * 7.6, 12, -14 + i * 7, 0, 0, s * 0.6), marble, 0.04));
    }
  }
  // Steps
  for (let i = 0; i < 4; i++) parts.push(colorize(T(new THREE.BoxGeometry(12 - i, 0.5, 3), 0, 0.25 + i * 0.5 - 2, 20 - i * 0.8), marble, 0.02));
  // Door
  parts.push(colorize(T(new THREE.BoxGeometry(4, 7, 0.4), 0, 3.5, 17.1), 0x3a2a1a, 0.02));
  parts.push(colorize(T(new THREE.TorusGeometry(2.2, 0.25, 5, 12, Math.PI), 0, 7, 17.2), gold, 0.02));
  const windows = [
    { pos: [0, 16.5, 17.05], rot: [0, 0, 0], size: 8.5 },
  ];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) windows.push({ pos: [s * 7.05, 8, -11 + i * 7], rot: [0, s * Math.PI / 2, 0], size: 3.2 });
  }
  return { geo: mergeGeometries(parts), windows };
}

export function tent(color = 0xf0e8d8, trim = 0x1d3b9c) {
  const parts = [];
  parts.push(colorize(T(new THREE.ConeGeometry(3, 4, 8), 0, 2, 0), color, 0.04));
  parts.push(colorize(T(new THREE.CylinderGeometry(3.02, 3.02, 0.4, 8, 1, true), 0, 0.6, 0), trim, 0.02));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), 0, 4.4, 0), 0x3a2a20));
  return mergeGeometries(parts);
}

export function wallSegment(len = 12, h = 10, thick = 3, stone = 0x3a3040, trim = 0x6a3a8a) {
  const parts = [];
  parts.push(colorize(T(new THREE.BoxGeometry(len, h, thick), 0, h / 2, 0), stone, 0.04));
  for (let i = 0; i < Math.floor(len / 2); i++) {
    parts.push(colorize(T(new THREE.BoxGeometry(1.1, 1.2, thick + 0.2), -len / 2 + 1 + i * 2, h + 0.6, 0), stone, 0.05));
  }
  parts.push(colorize(T(new THREE.BoxGeometry(len + 0.1, 0.4, thick + 0.3), 0, h * 0.7, 0), trim, 0.02));
  return mergeGeometries(parts);
}

export function tower(h = 16, r = 3.5, stone = 0x3a3040, roof = 0x241830) {
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(r, r * 1.15, h, 10), 0, h / 2, 0), stone, 0.04));
  parts.push(colorize(T(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 1.2, 10), 0, h + 0.6, 0), stone, 0.04));
  parts.push(colorize(T(new THREE.ConeGeometry(r * 1.3, r * 3, 10), 0, h + 1.2 + r * 1.5, 0), roof, 0.04));
  return mergeGeometries(parts);
}

export function kimSoldier(color = 0xdfe4ee, cape = 0x1d3b9c) {
  // Very low-poly allied soldier statue-like figure for army ranks.
  const parts = [];
  parts.push(colorize(T(new THREE.CylinderGeometry(0.25, 0.3, 1.0, 6), 0, 0.5, 0), color, 0.03));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.3, 0.26, 0.7, 6), 0, 1.3, 0), color, 0.03));
  parts.push(colorize(T(new THREE.SphereGeometry(0.2, 6, 5), 0, 1.85, 0), color, 0.03));
  parts.push(colorize(T(new THREE.BoxGeometry(0.5, 1.1, 0.06), 0, 1.1, -0.25), cape, 0.02));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 4), 0.35, 1.6, 0.1), 0x5a4030));
  parts.push(colorize(T(new THREE.ConeGeometry(0.08, 0.35, 4), 0.35, 3.3, 0.1), 0xe8e8f0));
  parts.push(colorize(T(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 8), -0.3, 1.2, 0.15, 0, 0, Math.PI / 2 - 0.2), 0xe8b04a, 0.02));
  return mergeGeometries(parts);
}

export function ruinArch(marble = 0xf2ece0) {
  const parts = [];
  for (const x of [-3, 3]) parts.push(colorize(T(new THREE.BoxGeometry(1.4, 7, 1.4), x, 3.5, 0), marble, 0.04));
  parts.push(colorize(T(new THREE.TorusGeometry(3, 0.7, 5, 12, Math.PI), 0, 7, 0), marble, 0.04));
  return mergeGeometries(parts);
}
