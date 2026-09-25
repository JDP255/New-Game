// WebGL renderer, post-processing chain (bloom + cinematic grade) and adaptive resolution
// tuned so integrated GPUs (e.g. Intel Iris Xe) can hold 60 fps.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    saturation: { value: 1.12 },
    contrast: { value: 1.06 },
    vignette: { value: 0.55 },
    shadowTint: { value: new THREE.Color(0.18, 0.22, 0.42) },
    highlightTint: { value: new THREE.Color(1.0, 0.86, 0.6) },
    toning: { value: 0.22 },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    hurt: { value: 0 },
    aberration: { value: 0.0 },
    grain: { value: 0.035 },
    desat: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, saturation, contrast, vignette, toning, flash, hurt, aberration, grain, desat;
    uniform vec3 shadowTint, highlightTint, flashColor;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      if (aberration > 0.0005) {
        float ca = aberration * r2;
        c.r = texture2D(tDiffuse, vUv + d * ca).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, vUv - d * ca).b;
      } else {
        c = texture2D(tDiffuse, vUv).rgb;
      }
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // Split toning: cool indigo shadows, warm gilded highlights (the "illuminated manuscript" look).
      c = mix(c, c * shadowTint * 2.4, (1.0 - smoothstep(0.0, 0.45, l)) * toning);
      c = mix(c, c * highlightTint * 1.15, smoothstep(0.5, 1.0, l) * toning);
      l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation * (1.0 - desat));
      c = (c - 0.5) * contrast + 0.5;
      float vig = smoothstep(0.18, 0.75, sqrt(r2) * 1.25);
      c *= 1.0 - vignette * vig * 0.75;
      c = mix(c, vec3(0.45, 0.0, 0.03), hurt * smoothstep(0.12, 0.7, sqrt(r2) * 1.3));
      c = mix(c, flashColor, clamp(flash, 0.0, 1.0));
      c += (hash(vUv * resolution + fract(time * 7.13) * 100.0) - 0.5) * grain;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export const QUALITY = {
  low: { scale: 0.7, bloom: false, shadows: false, shadowSize: 512, msaa: 0, maxScale: 0.85, minScale: 0.55 },
  medium: { scale: 0.85, bloom: true, shadows: true, shadowSize: 1024, msaa: 0, maxScale: 1.0, minScale: 0.6 },
  high: { scale: 1.0, bloom: true, shadows: true, shadowSize: 2048, msaa: 4, maxScale: 1.0, minScale: 0.7 },
};

export class Renderer {
  constructor(container, qualityName = 'medium') {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(1);
    container.appendChild(r.domElement);
    this.canvas = r.domElement;

    this.frameTimes = [];
    this.adaptTimer = 0;
    this.dynScale = 1;
    this.adaptive = true;
    this.setQuality(qualityName);
    addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'medium';
    this.q = QUALITY[this.qualityName];
    this.dynScale = this.q.scale;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.buildComposer();
    this.resize();
    this.onQualityChange && this.onQualityChange(this.q);
  }

  buildComposer() {
    if (this.composer) this.composer.dispose();
    const size = new THREE.Vector2(innerWidth, innerHeight);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: this.q.msaa,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(null, null);
    this.composer.addPass(this.renderPass);
    if (this.q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.5, 0.88);
      this.composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 1.25) * this.dynScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    this.grade.uniforms.resolution.value.set(w * pr, h * pr);
    this.onResize && this.onResize(w, h);
  }

  // Adaptive resolution: keep frame time under ~16.7ms by scaling the internal resolution.
  adapt(rawDt) {
    if (!this.adaptive) return;
    this.frameTimes.push(rawDt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    this.adaptTimer += rawDt;
    if (this.adaptTimer < 2 || this.frameTimes.length < 60) return;
    this.adaptTimer = 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    let s = this.dynScale;
    if (p75 > 1 / 52) s -= 0.08;
    else if (p75 < 1 / 64 && s < this.q.maxScale) s += 0.04;
    s = Math.min(this.q.maxScale, Math.max(this.q.minScale, s));
    if (Math.abs(s - this.dynScale) > 0.01) {
      this.dynScale = s;
      this.resize();
    }
  }

  render(scene, camera, time) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.grade.uniforms.time.value = time;
    this.composer.render();
  }
}
