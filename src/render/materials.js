// Stylised "gilded manuscript" toon materials: banded light, glowing rims and ink outlines.
import * as THREE from 'three';

function makeGradient(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const GRADIENTS = {
  three: makeGradient([70, 165, 255]),
  four: makeGradient([55, 120, 190, 255]),
  soft: makeGradient([95, 140, 185, 225, 255]),
};

const cache = new Map();

// Toon material with a fresnel rim term injected into the emissive channel.
export function toon(color, opts = {}) {
  const {
    rim = 0.35, rimColor = 0xfff1d0, rimPower = 2.6, emissive = 0x000000, emissiveIntensity = 1,
    gradient = 'three', vertexColors = false, side = THREE.FrontSide, flat = false, cacheKey = null,
    transparent = false, opacity = 1, fog = true,
  } = opts;
  const key = cacheKey || [color, rim, rimColor, rimPower, emissive, emissiveIntensity, gradient, vertexColors, side, flat, transparent, opacity].join('|');
  if (cache.has(key) && !opts.unique) return cache.get(key);
  const m = new THREE.MeshToonMaterial({
    color, gradientMap: GRADIENTS[gradient], emissive, emissiveIntensity, vertexColors, side,
    transparent, opacity, fog,
  });
  m.flatShading = flat;
  m.userData.rim = { value: rim };
  m.userData.rimColor = { value: new THREE.Color(rimColor) };
  m.userData.rimPower = { value: rimPower };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = m.userData.rim;
    shader.uniforms.rimColor = m.userData.rimColor;
    shader.uniforms.rimPower = m.userData.rimPower;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimStrength; uniform vec3 rimColor; uniform float rimPower;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float fres = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          totalEmissiveRadiance += rimColor * rimStrength * pow(fres, rimPower);
        }`
      );
  };
  m.customProgramCacheKey = () => 'toonrim';
  if (!opts.unique) cache.set(key, m);
  return m;
}

// Inverted hull outline: pushes back faces out along the normal and draws them in ink.
const outlineMats = new Map();
export function outlineMaterial(width = 0.025, color = 0x0b0712) {
  const key = width + '|' + color;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const w = { value: width };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = w;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float outlineWidth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * outlineWidth;');
  };
  m.customProgramCacheKey = () => 'outline';
  outlineMats.set(key, m);
  return m;
}

// Add a mesh to a parent with optional outline shell.
export function part(geo, mat, parent, { pos, rot, scale, outline = 0.022, shadow = true, name } = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) {
    if (typeof scale === 'number') mesh.scale.setScalar(scale);
    else mesh.scale.set(scale[0], scale[1], scale[2]);
  }
  mesh.castShadow = shadow;
  mesh.receiveShadow = false;
  if (name) mesh.name = name;
  parent.add(mesh);
  if (outline) {
    const s = mesh.scale;
    // Scale-compensate so the outline stays roughly uniform on stretched parts.
    const avg = (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3;
    const o = new THREE.Mesh(geo, outlineMaterial(+(outline / avg).toFixed(3)));
    o.castShadow = false;
    o.raycast = () => {};
    mesh.add(o);
  }
  return mesh;
}

// Additive glow material (for magic, halos, beams).
export function glowMaterial(color, opacity = 1, { side = THREE.DoubleSide, depthWrite = false } = {}) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite, side, fog: false,
  });
}

// Soft radial gradient texture generated on a canvas (used for glows / sprites).
let _glowTex;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

// Vertical-gradient beam used for god rays and pillars of light.
export function beamMaterial(color, opacity = 0.35) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.5);
        float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float shimmer = 0.8 + 0.2 * sin(vUv.y * 20.0 - time * 2.0 + vUv.x * 30.0);
        gl_FragColor = vec4(color, opacity * edge * fade * shimmer);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// Stained glass shader: animated voronoi cells with lead lines — Kim's signature motif.
export function stainedGlassMaterial(palette = [0x2a5bd7, 0xe8b53a, 0xc0303a, 0x3aa876, 0x8a4fd8], intensity = 1.6) {
  const cols = palette.map((c) => new THREE.Color(c));
  while (cols.length < 5) cols.push(cols[0]);
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, cols: { value: cols }, intensity: { value: intensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float time; uniform vec3 cols[5]; uniform float intensity; varying vec2 vUv;
      vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
      void main(){
        vec2 uv = vUv * 2.0 - 1.0;
        float r = length(uv); float a = atan(uv.y, uv.x);
        // Radial symmetry like a rose window.
        float seg = 3.14159 / 6.0;
        float aa = mod(a, seg * 2.0) - seg;
        vec2 p = vec2(r * 5.0, abs(aa) * 6.0);
        vec2 ip = floor(p), fp = fract(p);
        float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0);
        for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
          vec2 g = vec2(float(x), float(y)); vec2 o = h2(ip + g);
          float d = length(g + o - fp);
          if (d < d1) { d2 = d1; d1 = d; id = ip + g; } else if (d < d2) d2 = d;
        }
        float lead = smoothstep(0.02, 0.09, d2 - d1);
        float ring = smoothstep(0.015, 0.04, abs(fract(r * 3.0) - 0.5) * 0.5);
        float k = fract(sin(dot(id, vec2(41.3, 17.7))) * 91.7);
        vec3 c = cols[int(k * 4.99)];
        c *= 0.75 + 0.35 * sin(time * 0.8 + k * 20.0);
        float center = smoothstep(0.22, 0.18, r);
        c = mix(c, vec3(1.0, 0.9, 0.6) * 1.4, center);
        float mask = step(r, 1.0);
        vec3 lc = vec3(0.04, 0.03, 0.05);
        vec3 fin = mix(lc, c * intensity, lead * ring);
        if (mask < 0.5) discard;
        gl_FragColor = vec4(fin, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}
