// Pooled CPU-simulated point particles (one draw call per blend mode) + ambient motes.
import * as THREE from 'three';

const vert = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 pcolor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float pixelScale;
  void main() {
    vAlpha = alpha;
    vColor = pcolor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  uniform float softness;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = smoothstep(1.0, softness, r);
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }`;

export class ParticleSystem {
  constructor(capacity = 3000, additive = true) {
    this.cap = capacity;
    this.count = 0;
    const g = (this.geo = new THREE.BufferGeometry());
    this.pos = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.uniforms = { pixelScale: { value: 500 }, softness: { value: additive ? 0.0 : 0.3 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setViewport(h) { this.uniforms.pixelScale.value = h * 0.9; }

  spawn(x, y, z, vx, vy, vz, { life = 1, size = 0.3, sizeEnd = 0, color = [1, 1, 1], gravity = 0, drag = 0, alpha = 1 } = {}) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.colors[i3] = color[0]; this.colors[i3 + 1] = color[1]; this.colors[i3 + 2] = color[2];
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = size; this.size1[i] = sizeEnd;
    this.grav[i] = gravity; this.drag[i] = drag;
    this.a0[i] = alpha;
    this.sizes[i] = size; this.alphas[i] = alpha;
  }

  // Burst of particles in a sphere / cone.
  burst(p, n, { speed = 5, spread = 1, dir = null, color = [1, 0.9, 0.6], colorVar = 0.1, life = 0.6, lifeVar = 0.3, size = 0.35, sizeEnd = 0, gravity = 0, drag = 2, radius = 0, alpha = 1 } = {}) {
    for (let k = 0; k < n; k++) {
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (dir) {
        vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread;
        const l2 = Math.hypot(vx, vy, vz) || 1;
        vx /= l2; vy /= l2; vz /= l2;
      }
      const s = speed * (0.4 + Math.random() * 0.6);
      const cv = (Math.random() - 0.5) * colorVar;
      this.spawn(
        p.x + vx * radius, p.y + vy * radius, p.z + vz * radius,
        vx * s, vy * s, vz * s,
        {
          life: life + Math.random() * lifeVar, size: size * (0.6 + Math.random() * 0.8), sizeEnd,
          color: [color[0] + cv, color[1] + cv, color[2] + cv], gravity, drag, alpha,
        }
      );
    }
  }

  // Expanding ring of particles on the XZ plane (shockwaves).
  ring(p, n, { speed = 12, color = [1, 0.85, 0.5], life = 0.5, size = 0.5, y = 0.2, gravity = 0, drag = 3 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.1;
      const s = speed * (0.85 + Math.random() * 0.3);
      this.spawn(p.x, p.y + y, p.z, Math.sin(a) * s, Math.random() * 1.5, Math.cos(a) * s, {
        life: life * (0.8 + Math.random() * 0.4), size, sizeEnd: 0, color, gravity, drag,
      });
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) this.copy(last, i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.sizes[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alphas[i] = this.a0[i] * (t < 0.1 ? t * 10 : 1 - (t - 0.1) / 0.9);
      i++;
    }
    const g = this.geo;
    g.setDrawRange(0, this.count);
    for (const k of ['position', 'pcolor', 'size', 'alpha']) {
      const a = g.attributes[k];
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * a.itemSize);
    }
  }

  copy(from, to) {
    const f3 = from * 3, t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t3 + k] = this.pos[f3 + k];
      this.vel[t3 + k] = this.vel[f3 + k];
      this.colors[t3 + k] = this.colors[f3 + k];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.size0[to] = this.size0[from]; this.size1[to] = this.size1[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
    this.a0[to] = this.a0[from]; this.sizes[to] = this.sizes[from]; this.alphas[to] = this.alphas[from];
  }

  clear() { this.count = 0; }
}

// Ambient drifting motes (pollen, embers, ash) that wrap around the camera - fully GPU animated.
export function ambientMotes(count = 700, color = 0xffe0a0, box = 60, { rise = 0.4, size = 0.18, additive = true, opacity = 0.9 } = {}) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.random() * box;
    p[i * 3 + 1] = Math.random() * box;
    p[i * 3 + 2] = Math.random() * box;
    seed[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const uniforms = {
    time: { value: 0 }, center: { value: new THREE.Vector3() }, box: { value: box },
    color: { value: new THREE.Color(color) }, rise: { value: rise }, size: { value: size }, pixelScale: { value: 500 },
    opacity: { value: opacity },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float time, box, rise, size, pixelScale; uniform vec3 center; varying float vA;
      void main(){
        vec3 p = position;
        p.y += time * rise * (0.5 + seed);
        p.x += sin(time * 0.5 + seed * 30.0) * 1.5;
        p.z += cos(time * 0.4 + seed * 20.0) * 1.5;
        p = mod(p - center + box * 0.5, box) - box * 0.5 + center;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = length(p - center) / (box * 0.5);
        vA = (1.0 - smoothstep(0.6, 1.0, d)) * (0.5 + 0.5 * sin(time * 2.0 + seed * 50.0));
        gl_PointSize = size * (0.6 + seed) * pixelScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(color, a * vA * opacity); }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.uniforms = uniforms;
  return pts;
}
