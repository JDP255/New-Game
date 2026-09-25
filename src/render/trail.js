// Ribbon trail that follows two points (sword base & tip) — the signature sweeping arcs.
import * as THREE from 'three';

const _t = new THREE.Vector3();

export class Trail {
  constructor(segments = 22, color = 0xfff0c8, color2 = 0x6fb8ff) {
    this.n = segments;
    this.base = [];
    this.tip = [];
    for (let i = 0; i < segments; i++) {
      this.base.push(new THREE.Vector3());
      this.tip.push(new THREE.Vector3());
    }
    const g = (this.geo = new THREE.BufferGeometry());
    this.positions = new Float32Array(segments * 2 * 3);
    this.ages = new Float32Array(segments * 2);
    this.sides = new Float32Array(segments * 2);
    for (let i = 0; i < segments; i++) {
      this.ages[i * 2] = this.ages[i * 2 + 1] = i / (segments - 1);
      this.sides[i * 2] = 0;
      this.sides[i * 2 + 1] = 1;
    }
    const idx = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('age', new THREE.BufferAttribute(this.ages, 1));
    g.setAttribute('side', new THREE.BufferAttribute(this.sides, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = {
      c1: { value: new THREE.Color(color) },
      c2: { value: new THREE.Color(color2) },
      intensity: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `attribute float age; attribute float side; varying float vAge; varying float vSide;
        void main(){ vAge = age; vSide = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 c1, c2; uniform float intensity; varying float vAge; varying float vSide;
        void main(){
          float a = pow(1.0 - vAge, 1.6) * smoothstep(0.0, 0.35, vSide) * intensity;
          vec3 c = mix(c1 * 2.2, c2 * 1.6, vAge);
          c = mix(c, vec3(1.8), smoothstep(0.85, 1.0, vSide) * (1.0 - vAge));
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.active = false;
    this.intensity = 0;
  }

  reset(b, t) {
    for (let i = 0; i < this.n; i++) {
      this.base[i].copy(b);
      this.tip[i].copy(t);
    }
  }

  setColors(a, b) {
    this.uniforms.c1.value.set(a);
    this.uniforms.c2.value.set(b);
  }

  update(b, t, dt) {
    const target = this.active ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * (this.active ? 30 : 9));
    if (this.intensity < 0.01 && !this.active) {
      this.reset(b, t);
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    // Shift history and insert new sample, sub-sampled via lerp for smoothness.
    for (let i = this.n - 1; i > 0; i--) {
      this.base[i].copy(this.base[i - 1]);
      this.tip[i].copy(this.tip[i - 1]);
    }
    this.base[0].copy(b);
    this.tip[0].copy(t);
    // Smooth the curve (one relaxation pass) to avoid jagged arcs at low frame rates.
    for (let i = 1; i < this.n - 1; i++) {
      _t.copy(this.tip[i + 1]).add(this.tip[i - 1]).multiplyScalar(0.5);
      this.tip[i].lerp(_t, 0.25);
    }
    const p = this.positions;
    for (let i = 0; i < this.n; i++) {
      p[i * 6] = this.base[i].x; p[i * 6 + 1] = this.base[i].y; p[i * 6 + 2] = this.base[i].z;
      p[i * 6 + 3] = this.tip[i].x; p[i * 6 + 4] = this.tip[i].y; p[i * 6 + 5] = this.tip[i].z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.uniforms.intensity.value = this.intensity;
  }
}
