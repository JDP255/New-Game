// Painted sky dome with banded toon clouds, sun halo and stars; plus a sea-of-clouds layer.
import * as THREE from 'three';

export class Sky {
  constructor() {
    this.uniforms = {
      topColor: { value: new THREE.Color(0x2a4fa0) },
      horizonColor: { value: new THREE.Color(0xf7c98b) },
      bottomColor: { value: new THREE.Color(0x6a5a8a) },
      sunDir: { value: new THREE.Vector3(0.3, 0.25, -1).normalize() },
      sunColor: { value: new THREE.Color(0xfff0c0) },
      cloudColor: { value: new THREE.Color(0xfff4e6) },
      cloudShadow: { value: new THREE.Color(0xc58f7a) },
      cloudiness: { value: 0.5 },
      stars: { value: 0 },
      time: { value: 0 },
      sunSize: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor, horizonColor, bottomColor, sunDir, sunColor, cloudColor, cloudShadow;
        uniform float cloudiness, stars, time, sunSize;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
          return s;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(horizonColor, topColor, pow(smoothstep(0.0, 0.65, h), 0.7));
          c = mix(c, bottomColor, smoothstep(0.0, -0.35, h));
          float sd = max(dot(d, sunDir), 0.0);
          c += sunColor * pow(sd, 8.0) * 0.45 + sunColor * pow(sd, 64.0) * 0.6;
          c = mix(c, sunColor * 2.2, smoothstep(0.9993 - 0.0006 * sunSize, 0.9996, sd));
          // Stars
          if (stars > 0.0) {
            vec2 sp = d.xz / (abs(d.y) + 0.35) * 90.0;
            float st = step(0.985, hash(floor(sp))) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
            c += vec3(st) * stars * smoothstep(0.0, 0.3, h) * (0.6 + 0.4 * sin(time * 3.0 + hash(floor(sp)) * 40.0));
          }
          // Banded painterly clouds
          if (h > -0.05) {
            vec2 uv = d.xz / (h + 0.18) * 1.2 + vec2(time * 0.008, time * 0.003);
            float n = fbm(uv * 1.3);
            float cl = smoothstep(0.62 - cloudiness * 0.35, 0.72 - cloudiness * 0.3, n);
            float band = floor(smoothstep(0.55, 0.9, n) * 3.0) / 3.0;
            vec3 cc = mix(cloudShadow, cloudColor, 0.35 + band * 0.65);
            cc += sunColor * pow(sd, 6.0) * 0.5;
            float fade = smoothstep(-0.05, 0.12, h) * (1.0 - smoothstep(0.55, 0.95, h) * 0.5);
            c = mix(c, cc, cl * fade * 0.92);
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  setPalette(p) {
    const u = this.uniforms;
    u.topColor.value.set(p.top);
    u.horizonColor.value.set(p.horizon);
    u.bottomColor.value.set(p.bottom);
    u.sunColor.value.set(p.sun);
    u.cloudColor.value.set(p.cloud);
    u.cloudShadow.value.set(p.cloudShadow);
    u.cloudiness.value = p.cloudiness ?? 0.5;
    u.stars.value = p.stars ?? 0;
    u.sunDir.value.set(...(p.sunDir || [0.3, 0.25, -1])).normalize();
    u.sunSize.value = p.sunSize ?? 1;
  }

  update(camera, t) {
    this.mesh.position.copy(camera.position);
    this.uniforms.time.value = t;
  }
}

// A vast animated sea of clouds (or ash/void) below floating lands.
export function cloudSea(color = 0xfff1dc, shadow = 0xb88fa0, y = -30, size = 2400) {
  const uniforms = {
    time: { value: 0 },
    c1: { value: new THREE.Color(color) },
    c2: { value: new THREE.Color(shadow) },
    fogColor: { value: new THREE.Color(0xffffff) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time; uniform vec3 c1, c2, fogColor; varying vec2 vUv; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=noise(p)*a; p=p*2.1+3.1; a*=0.5;} return s; }
      void main(){
        vec2 p = vW.xz * 0.012 + vec2(time*0.01, time*0.004);
        float n = fbm(p) * 0.7 + fbm(p*3.0 - time*0.02) * 0.3;
        float band = floor(n * 5.0) / 5.0;
        vec3 c = mix(c2, c1, smoothstep(0.25, 0.75, band));
        float dist = length(vW.xz - cameraPosition.xz);
        c = mix(c, fogColor, smoothstep(250.0, 1100.0, dist));
        gl_FragColor = vec4(c, 1.0);
      }`,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.userData.uniforms = uniforms;
  return mesh;
}
