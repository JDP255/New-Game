// World container: scene, lighting, terrain/platform ground queries, colliders, scattering & FX surfaces.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D, RNG, clamp, smoothstep } from '../core/utils.js';
import { toon, outlineMaterial } from '../render/materials.js';
import { Sky, cloudSea } from '../render/sky.js';
import { gradientize } from './props.js';

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5040, 1.3);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 220;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sunOffset = new THREE.Vector3(40, 80, 30);
    this.scene.fog = new THREE.Fog(0xf7d7a8, 60, 420);

    this.heightFn = null;
    this.platforms = []; // {x,z,r,top,bottom?} circular tops
    this.boxes = []; // {minX,maxX,minZ,maxZ,top,bottom}
    this.circles = []; // obstacles {x,z,r,y0,y1}
    this.killY = -60;
    this.bounds = { x: 0, z: 0, r: 200 };
    this.animated = []; // {update(t,dt)}
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
  }

  setShadowQuality(q) {
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  setAtmosphere(a) {
    this.sky.setPalette(a.sky);
    this.scene.fog.color.set(a.fog);
    this.scene.fog.near = a.fogNear ?? 60;
    this.scene.fog.far = a.fogFar ?? 420;
    this.hemi.color.set(a.hemiSky ?? 0xcfe0ff);
    this.hemi.groundColor.set(a.hemiGround ?? 0x6a5040);
    this.hemi.intensity = a.hemiIntensity ?? 1.3;
    this.sun.color.set(a.sunColor ?? 0xfff0d0);
    this.sun.intensity = a.sunIntensity ?? 2.4;
    const d = new THREE.Vector3(...(a.sky.sunDir || [0.3, 0.25, -1])).normalize();
    this.sunOffset.copy(d).multiplyScalar(100);
    if (this.sunOffset.y < 50) this.sunOffset.y = 50;
  }

  // ---------------------------------------------------------------- ground queries
  groundAt(x, z, y = Infinity, step = 0.8) {
    let best = -Infinity;
    if (this.heightFn) {
      const h = this.heightFn(x, z);
      if (h <= y + step) best = h;
    }
    for (const p of this.platforms) {
      if (p.disabled) continue;
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < p.r * p.r && p.top <= y + step && p.top > best) best = p.top;
    }
    for (const b of this.boxes) {
      if (b.disabled) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.top <= y + step && b.top > best) best = b.top;
    }
    return best;
  }

  // Highest solid surface regardless of current height (for spawning / camera).
  surfaceAt(x, z) { return this.groundAt(x, z, Infinity, 0); }

  // Push a position out of obstacles. Returns true if collided.
  collide(pos, radius, height = 2) {
    let hit = false;
    for (const c of this.circles) {
      if (c.disabled) continue;
      if (pos.y + height < c.y0 || pos.y > c.y1) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
        hit = true;
      }
    }
    for (const b of this.boxes) {
      if (b.disabled || !b.solid) continue;
      if (pos.y + height < b.bottom || pos.y >= b.top - 0.05) continue;
      const minX = b.minX - radius, maxX = b.maxX + radius, minZ = b.minZ - radius, maxZ = b.maxZ + radius;
      if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
        const dl = pos.x - minX, dr = maxX - pos.x, db = pos.z - minZ, df = maxZ - pos.z;
        const m = Math.min(dl, dr, db, df);
        if (m === dl) pos.x = minX; else if (m === dr) pos.x = maxX; else if (m === db) pos.z = minZ; else pos.z = maxZ;
        hit = true;
      }
    }
    // Soft level bounds
    const bx = pos.x - this.bounds.x, bz = pos.z - this.bounds.z;
    const bd = Math.hypot(bx, bz);
    if (bd > this.bounds.r) {
      pos.x = this.bounds.x + (bx / bd) * this.bounds.r;
      pos.z = this.bounds.z + (bz / bd) * this.bounds.r;
      hit = true;
    }
    return hit;
  }

  // Ceiling check for platforms/boxes above (used to stop flying through solid tops from below).
  ceilingAt(x, z, y) {
    let best = Infinity;
    for (const b of this.boxes) {
      if (b.disabled || !b.solid) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.bottom > y && b.bottom < best) best = b.bottom;
    }
    return best;
  }

  // ---------------------------------------------------------------- terrain
  buildTerrain({ size = 600, segs = 150, seed = 1, fn, palette, center = [0, 0] }) {
    this.heightFn = fn;
    const g = new THREE.PlaneGeometry(size, size, segs, segs);
    g.rotateX(-Math.PI / 2);
    g.translate(center[0], 0, center[1]);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, fn(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const n = g.attributes.normal;
    const noise = new Noise2D(seed + 5);
    const colors = new Float32Array(p.count * 3);
    const cLow = new THREE.Color(palette.low), cMid = new THREE.Color(palette.mid), cHigh = new THREE.Color(palette.high);
    const cCliff = new THREE.Color(palette.cliff), cPath = palette.path ? new THREE.Color(palette.path) : null;
    const c = new THREE.Color();
    const [h0, h1, h2] = palette.heights || [0, 8, 25];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nv = noise.fbm(x * 0.03, z * 0.03, 3);
      const hh = y + nv * 6;
      if (hh < h1) c.copy(cLow).lerp(cMid, smoothstep(h0, h1, hh));
      else c.copy(cMid).lerp(cHigh, smoothstep(h1, h2, hh));
      // Painterly patches
      const patch = noise.noise(x * 0.08, z * 0.08);
      c.offsetHSL(patch * 0.02, patch * 0.05, patch * 0.04);
      const slope = 1 - n.getY(i);
      c.lerp(cCliff, smoothstep(0.18, 0.4, slope));
      if (cPath && palette.pathFn) c.lerp(cPath, palette.pathFn(x, z));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = toon(0xffffff, { vertexColors: true, rim: 0.12, rimColor: palette.rim || 0xfff0d0, gradient: 'four', unique: true });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
    return mesh;
  }

  // Floating islands: merged into one mesh, each registered as a platform.
  buildIslands(list, palette = { top: 0x7fb85a, top2: 0xd9e27a, rock: 0xc9b89a, rockDark: 0x6a5a6a }, seed = 3) {
    const noise = new Noise2D(seed);
    const geos = [];
    for (const is of list) {
      const { x, y, z, r } = is;
      const depth = is.depth || r * 1.3;
      const pts = [];
      const steps = 10;
      pts.push(new THREE.Vector2(0.001, -depth));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const rr = r * Math.pow(t, 0.55) * (0.95 + 0.08 * Math.sin(i * 1.7));
        pts.push(new THREE.Vector2(rr, -depth + depth * t));
      }
      pts.push(new THREE.Vector2(r * 1.02, 0.35));
      pts.push(new THREE.Vector2(r * 0.9, 0.55));
      pts.push(new THREE.Vector2(0.001, 0.6));
      const g = new THREE.LatheGeometry(pts, 20);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        const rad = Math.hypot(vx, vz);
        if (vy < 0.3) {
          const k = 0.25 * r * (1 - Math.abs(vy) / depth * 0.3);
          const nn = noise.noise(vx * 0.25 + x, vz * 0.25 + z + vy * 0.2);
          pos.setX(i, vx + (vx / (rad + 0.01)) * nn * k);
          pos.setZ(i, vz + (vz / (rad + 0.01)) * nn * k);
          pos.setY(i, vy + noise.noise(vx * 0.4, vz * 0.4) * 0.8);
        }
      }
      g.translate(x, y - 0.6, z);
      const ng = g.toNonIndexed();
      ng.computeVertexNormals();
      const p2 = ng.attributes.position, n2 = ng.attributes.normal;
      const cols = new Float32Array(p2.count * 3);
      const top = new THREE.Color(palette.top), top2 = new THREE.Color(palette.top2), rk = new THREE.Color(palette.rock), rd = new THREE.Color(palette.rockDark);
      const c = new THREE.Color();
      for (let i = 0; i < p2.count; i++) {
        const ly = p2.getY(i) - (y - 0.6);
        if (n2.getY(i) > 0.6 && ly > 0.2) c.copy(top).lerp(top2, (noise.noise(p2.getX(i) * 0.1, p2.getZ(i) * 0.1) + 0.5) * 0.7);
        else c.copy(rd).lerp(rk, clamp(1 + ly / depth, 0, 1));
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      ng.deleteAttribute('uv');
      geos.push(ng);
      this.platforms.push({ x, z, r: r * 0.93, top: y, island: true });
    }
    const merged = mergeGeometries(geos);
    const mesh = new THREE.Mesh(merged, toon(0xffffff, { vertexColors: true, rim: 0.2, rimColor: 0xfff0d0, unique: true, gradient: 'four' }));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);
    const out = new THREE.Mesh(merged, outlineMaterial(0.08));
    this.scene.add(out);
    return mesh;
  }

  // Instance a geometry at many positions. items: [{x,y?,z,s,ry}]. Returns InstancedMesh.
  instance(geo, items, { material = null, outline = 0.04, collide = 0, colliderH = 6, shadow = true, emissive = false } = {}) {
    if (!items.length) return null;
    const mat = material || toon(0xffffff, { vertexColors: true, rim: 0.25, rimColor: 0xfff0d0, gradient: 'four' });
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    items.forEach((it, i) => {
      const y = it.y ?? this.surfaceAt(it.x, it.z);
      p.set(it.x, y + (it.dy || 0), it.z);
      q.setFromEuler(new THREE.Euler(it.rx || 0, it.ry || 0, it.rz || 0));
      const sc = it.s || 1;
      s.set(sc * (it.sx || 1), sc * (it.sy || 1), sc * (it.sz || 1));
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
      if (collide) this.circles.push({ x: it.x, z: it.z, r: collide * sc, y0: y - 1, y1: y + colliderH * sc });
    });
    im.castShadow = shadow;
    im.receiveShadow = !emissive;
    im.computeBoundingSphere();
    this.scene.add(im);
    if (outline) {
      const o = new THREE.InstancedMesh(geo, outlineMaterial(outline), items.length);
      for (let i = 0; i < items.length; i++) { im.getMatrixAt(i, m); o.setMatrixAt(i, m); }
      o.computeBoundingSphere();
      this.scene.add(o);
    }
    return im;
  }

  // Scatter positions on terrain with rules.
  scatter(n, { seed = 1, area = 200, center = [0, 0], minDist = 0, avoid = [], minH = -Infinity, maxH = Infinity, maxSlope = 0.6, onPlatforms = null }) {
    const rng = new RNG(seed);
    const out = [];
    let tries = 0;
    while (out.length < n && tries < n * 30) {
      tries++;
      let x, z;
      if (onPlatforms) {
        const p = rng.pick(onPlatforms);
        const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * p.r * 0.85;
        x = p.x + Math.cos(a) * rr;
        z = p.z + Math.sin(a) * rr;
      } else {
        x = center[0] + rng.range(-area, area);
        z = center[1] + rng.range(-area, area);
      }
      if (avoid.some((a) => (x - a[0]) ** 2 + (z - a[1]) ** 2 < a[2] * a[2])) continue;
      const y = this.surfaceAt(x, z);
      if (!isFinite(y) || y < minH || y > maxH) continue;
      if (this.heightFn && !onPlatforms) {
        const dx = this.heightFn(x + 1, z) - this.heightFn(x - 1, z);
        const dz = this.heightFn(x, z + 1) - this.heightFn(x, z - 1);
        if (Math.hypot(dx, dz) * 0.5 > maxSlope) continue;
      }
      if (minDist && out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < minDist * minDist)) continue;
      out.push({ x, z, y, s: rng.range(0.8, 1.3), ry: rng.range(0, Math.PI * 2) });
    }
    return out;
  }

  // Animated liquid surface (sea, lava, dark water).
  liquid({ y = 0, size = 1200, c1 = 0x0a1a3a, c2 = 0x4a8ad0, emissive = 0, speed = 1, center = [0, 0], scale = 0.05 }) {
    const uniforms = {
      time: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) },
      emissive: { value: emissive }, speed: { value: speed }, scale: { value: scale },
      fogColor: { value: this.scene.fog.color }, fogNear: { value: this.scene.fog.near }, fogFar: { value: this.scene.fog.far },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec3 vW; varying float vDepth; uniform float time; uniform float speed;
        void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p,1.0);
          w.y += sin(w.x*0.08 + time*speed) * 0.35 + cos(w.z*0.07 + time*0.8*speed) * 0.35;
          vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float time, emissive, speed, scale, fogNear, fogFar; uniform vec3 c1, c2, fogColor; varying vec3 vW; varying float vDepth;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
        void main(){
          vec2 p = vW.xz * scale;
          float n = noise(p + vec2(time*0.05*speed, time*0.03*speed)) * 0.6 + noise(p*2.7 - time*0.07*speed) * 0.4;
          float bands = floor(n * 4.0) / 4.0;
          vec3 c = mix(c1, c2, bands);
          float caustic = smoothstep(0.72, 0.8, noise(p*4.0 + time*0.1*speed));
          c += c2 * caustic * (0.4 + emissive);
          c *= 1.0 + emissive * 1.6;
          float f = smoothstep(fogNear, fogFar, vDepth);
          c = mix(c, fogColor, f);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 60, 60), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center[0], y, center[1]);
    this.scene.add(mesh);
    this.animated.push({ update: (t) => { uniforms.time.value = t; uniforms.fogNear.value = this.scene.fog.near; uniforms.fogFar.value = this.scene.fog.far; } });
    return mesh;
  }

  addCloudSea(c1, c2, y) {
    const cs = cloudSea(c1, c2, y);
    cs.userData.uniforms.fogColor.value = this.scene.fog.color;
    this.scene.add(cs);
    this.animated.push({ update: (t) => { cs.userData.uniforms.time.value = t; } });
    return cs;
  }

  addAnimated(obj) { this.animated.push(obj); }

  update(t, dt, focus) {
    this.sky.update(this.camera || { position: focus }, t);
    // Shadow camera follows the focus point, snapped to texels to avoid shimmer.
    const sz = this.sun.shadow.mapSize.x || 1024;
    const texel = 80 / sz;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.sunOffset.x, focus.y + this.sunOffset.y, fz + this.sunOffset.z);
    for (const a of this.animated) a.update(t, dt);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}

export { gradientize };
