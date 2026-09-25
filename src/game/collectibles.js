// Seraph Feathers, Scrolls of Wisdom, hidden Relics, interactable objects and updraft columns.
import * as THREE from 'three';
import { glowSprite, glowMaterial, beamMaterial, toon } from '../render/materials.js';

const featherShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.18, 0.15, 0.22, 0.6, 0.05, 1.1);
  s.quadraticCurveTo(0, 1.2, -0.05, 1.1);
  s.bezierCurveTo(-0.2, 0.7, -0.16, 0.2, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  g.translate(0, -0.55, 0);
  return g;
})();

export class Collectible {
  constructor(game, kind, id, pos, data = {}) {
    this.game = game;
    this.kind = kind; // 'feather' | 'scroll' | 'relic'
    this.id = id;
    this.pos = new THREE.Vector3(...pos);
    this.data = data;
    this.taken = false;
    this.t = Math.random() * 10;
    const g = new THREE.Group();
    g.position.copy(this.pos);
    if (kind === 'feather') {
      const m = new THREE.Mesh(featherShape, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.5, 0.8) }));
      m.scale.setScalar(0.9);
      g.add(m);
      g.add(glowSprite(0xffd27a, 2.4, 0.7));
      this.spin = m;
      this.radius = 1.6;
    } else if (kind === 'scroll') {
      const paper = toon(0xf4e6c4, { rim: 0.6, rimColor: 0xffffff });
      const gold = toon(0xe8b04a, { rim: 0.6, rimColor: 0xffe0a0 });
      const s = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12), paper);
      body.rotation.z = Math.PI / 2;
      s.add(body);
      for (const x of [-0.5, 0.5]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), gold);
        cap.rotation.z = Math.PI / 2;
        cap.position.x = x;
        s.add(cap);
      }
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.2) }));
      seal.rotation.x = Math.PI / 2;
      seal.position.z = 0.16;
      s.add(seal);
      g.add(s);
      g.add(glowSprite(0xaee0ff, 3, 0.55));
      this.spin = s;
      this.radius = 2.2;
      this.interact = true;
    } else {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.4, 2.4) }));
      g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 32), glowMaterial(0xd8b0ff, 0.9));
      g.add(ring);
      this.ring = ring;
      g.add(glowSprite(0xd0a0ff, 4, 0.7));
      this.spin = m;
      this.radius = 2.2;
      this.interact = true;
    }
    // Faint beacon of light so collectibles can be spotted from afar.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 14, 8, 1, true), beamMaterial(kind === 'feather' ? 0xffd070 : kind === 'scroll' ? 0x9fd8ff : 0xc890ff, kind === 'feather' ? 0.18 : 0.3));
    beam.position.y = 6;
    g.add(beam);
    this.beam = beam;
    this.group = g;
    game.world.scene.add(g);
  }

  update(dt, player) {
    if (this.taken) return;
    this.t += dt;
    this.group.position.y = this.pos.y + Math.sin(this.t * 2) * 0.2;
    this.spin.rotation.y += dt * 1.8;
    if (this.ring) { this.ring.rotation.x = this.t; this.ring.rotation.y = this.t * 0.7; }
    this.beam.material.uniforms.time.value = this.t;
    const d = this.group.position.distanceTo(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z));
    this.near = d < this.radius;
    if (this.kind === 'feather' && d < this.radius) this.game.collect(this);
    if (Math.random() < dt * 6) {
      const c = this.kind === 'feather' ? [1.6, 1.3, 0.6] : this.kind === 'scroll' ? [0.8, 1.2, 1.6] : [1.3, 0.9, 1.7];
      this.game.fx.spawn(this.pos.x + (Math.random() - 0.5), this.pos.y + (Math.random() - 0.5), this.pos.z + (Math.random() - 0.5), 0, 0.8, 0, { life: 1, size: 0.25, color: c });
    }
  }

  take() {
    this.taken = true;
    this.game.world.scene.remove(this.group);
    const c = this.kind === 'feather' ? [1.8, 1.5, 0.8] : this.kind === 'scroll' ? [0.9, 1.3, 1.8] : [1.5, 1.0, 1.9];
    this.game.fx.burst(this.pos, 40, { speed: 6, color: c, life: 0.9, size: 0.5, gravity: -2 });
  }
}

// Something the player can activate with E (brazier, horn altar, lever...).
export class Interactable {
  constructor(game, { pos, radius = 3.2, prompt = 'Interact', onUse, group = null, once = true }) {
    this.game = game;
    this.pos = new THREE.Vector3(...pos);
    this.radius = radius;
    this.prompt = prompt;
    this.onUse = onUse;
    this.group = group;
    this.once = once;
    this.used = false;
    this.enabled = true;
  }
  update(dt, player) {
    if (this.used && this.once) { this.near = false; return; }
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, dy = player.pos.y - this.pos.y;
    this.near = this.enabled && dx * dx + dz * dz < this.radius * this.radius && Math.abs(dy) < 4;
  }
  use() {
    if (this.used && this.once) return;
    this.used = true;
    this.onUse && this.onUse(this);
  }
}

// Rising column of golden wind: glide into it to soar.
export function makeUpdraft(world, { x, z, bottom, top, r = 4, strength = 26, color = 0xffe2a0 }) {
  world.updrafts = world.updrafts || [];
  world.updrafts.push({ x, z, r, bottom, top, strength });
  const group = new THREE.Group();
  group.position.set(x, bottom, z);
  const h = top - bottom;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 20, 1, true), beamMaterial(color, 0.16));
  beam.position.y = h / 2;
  group.add(beam);
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(r * 0.8, 0.06, 4, 32);
  ringGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(ringGeo, glowMaterial(color, 0.5));
    group.add(ring);
    rings.push(ring);
  }
  world.scene.add(group);
  world.addAnimated({
    update: (t) => {
      beam.material.uniforms.time.value = t;
      rings.forEach((ring, i) => {
        const u = ((t * 0.25 + i / rings.length) % 1);
        ring.position.y = u * h;
        ring.material.opacity = 0.55 * Math.sin(u * Math.PI);
        ring.scale.setScalar(0.8 + u * 0.3);
      });
    },
  });
  return group;
}
