// Projectiles (shade bolts, fireballs, orbs), shockwave rings, telegraphed eruptions and light beams.
import * as THREE from 'three';
import { glowSprite, glowMaterial, beamMaterial } from '../render/materials.js';

const _v = new THREE.Vector3();
const ringGeo = new THREE.RingGeometry(0.85, 1, 48, 1);
ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 32);
discGeo.rotateX(-Math.PI / 2);
const orbGeo = new THREE.IcosahedronGeometry(0.22, 1);

export class Projectile {
  constructor(game, { pos, vel, color = 0xb070ff, dmg = 10, radius = 0.5, life = 5, owner = 'enemy', homing = 0, size = 1, kind = 'bolt', gravity = 0, source = null, parryable = true }) {
    this.game = game;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.dmg = dmg;
    this.radius = radius;
    this.life = life;
    this.owner = owner;
    this.homing = homing;
    this.kind = kind;
    this.gravity = gravity;
    this.source = source;
    this.parryable = parryable;
    this.alive = true;
    this.color = new THREE.Color(color);
    const g = new THREE.Group();
    const core = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: this.color.clone().multiplyScalar(2.5) }));
    core.scale.setScalar(size);
    g.add(core);
    this.glow = glowSprite(color, 2.2 * size, 0.9);
    g.add(this.glow);
    g.position.copy(this.pos);
    this.mesh = g;
    this.core = core;
    game.world.dynamic.add(g);
    this.trailT = 0;
  }

  update(dt) {
    const game = this.game;
    this.life -= dt;
    if (this.life <= 0) return this.kill(false);
    if (this.homing && this.owner === 'enemy') {
      const p = game.player;
      _v.set(p.pos.x, p.pos.y + 1.2, p.pos.z).sub(this.pos).normalize().multiplyScalar(this.vel.length());
      this.vel.lerp(_v, Math.min(1, this.homing * dt));
    } else if (this.owner === 'player' && this.target && this.target.alive) {
      _v.copy(this.target.pos);
      _v.y += this.target.height * 0.5;
      _v.sub(this.pos).normalize().multiplyScalar(this.vel.length());
      this.vel.lerp(_v, Math.min(1, 8 * dt));
    }
    this.vel.y -= this.gravity * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);
    this.core.rotation.x += dt * 5;
    this.core.rotation.y += dt * 7;
    this.trailT += dt;
    if (this.trailT > 0.02) {
      this.trailT = 0;
      game.fx.spawn(this.pos.x, this.pos.y, this.pos.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), {
        life: 0.35, size: 0.6 * (this.radius + 0.3), color: [this.color.r * 1.5, this.color.g * 1.5, this.color.b * 1.5],
      });
    }
    // Ground impact
    const g = game.world.groundAt(this.pos.x, this.pos.z, this.pos.y, 0);
    if (this.pos.y < g + 0.1) return this.kill(true);
    if (this.owner === 'enemy') {
      const p = game.player;
      _v.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
      if (_v.distanceTo(this.pos) < this.radius + 0.6) {
        const res = p.receiveAttack({ dmg: this.dmg, source: this.source, pos: this.pos.clone(), kind: this.kind, parryable: this.parryable, projectile: this });
        if (res === 'reflected') return;
        if (res !== 'dodged') return this.kill(true);
      }
    } else {
      for (const e of game.enemies) {
        if (!e.alive) continue;
        _v.copy(e.pos);
        _v.y += e.height * 0.5;
        if (_v.distanceTo(this.pos) < this.radius + e.radius) {
          e.takeHit({ dmg: this.dmg, dir: this.vel.clone().normalize(), power: 1.4, source: 'reflect' });
          return this.kill(true);
        }
      }
    }
  }

  reflect(target) {
    this.owner = 'player';
    this.target = target;
    this.vel.multiplyScalar(-1.6);
    this.dmg *= 2.5;
    this.life = 4;
    this.color.set(0xffe0a0);
    this.core.material.color.set(0xffe8b0).multiplyScalar(2.5);
    this.glow.material.color.set(0xffd080);
  }

  kill(impact) {
    if (!this.alive) return;
    this.alive = false;
    this.game.world.dynamic.remove(this.mesh);
    this.core.material.dispose();
    this.glow.material.dispose();
    if (impact) {
      const c = this.color;
      this.game.fx.burst(this.pos, 18, { speed: 7, color: [c.r * 1.6, c.g * 1.6, c.b * 1.6], life: 0.4, size: 0.5 });
      this.game.audio.sfx(this.kind === 'fire' ? 'fire' : 'bolt');
    }
  }
}

// Expanding ring on the ground; damages grounded player crossing its edge. Jump over it!
export class Shockwave {
  constructor(game, { pos, maxR = 9, speed = 14, dmg = 18, color = 0xff6a3a, width = 0.9, owner = 'enemy', height = 1.2 }) {
    this.game = game;
    this.pos = pos.clone();
    this.r = 0.5;
    this.maxR = maxR;
    this.speed = speed;
    this.dmg = dmg;
    this.width = width;
    this.owner = owner;
    this.height = height;
    this.hitSet = new Set();
    this.alive = true;
    this.mesh = new THREE.Mesh(ringGeo, glowMaterial(color, 0.9));
    this.mesh.position.copy(this.pos).add(_v.set(0, 0.15, 0));
    game.world.dynamic.add(this.mesh);
    this.color = new THREE.Color(color);
  }
  update(dt) {
    const game = this.game;
    this.r += this.speed * dt;
    const k = this.r / this.maxR;
    this.mesh.scale.setScalar(this.r);
    this.mesh.material.opacity = 0.9 * (1 - k);
    if (Math.random() < 0.8) {
      const a = Math.random() * Math.PI * 2;
      const c = this.color;
      game.fx.spawn(this.pos.x + Math.sin(a) * this.r, this.pos.y + 0.3, this.pos.z + Math.cos(a) * this.r, 0, 2 + Math.random() * 2, 0, { life: 0.4, size: 0.7, color: [c.r * 1.5, c.g * 1.5, c.b * 1.5] });
    }
    if (this.owner === 'enemy') {
      const p = game.player;
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (!this.hitSet.has(p) && Math.abs(d - this.r) < this.width && p.pos.y - this.pos.y < this.height) {
        this.hitSet.add(p);
        p.receiveAttack({ dmg: this.dmg, pos: this.pos.clone(), kind: 'shock', parryable: false, knock: 10 });
      }
    } else {
      for (const e of game.enemies) {
        if (!e.alive || this.hitSet.has(e)) continue;
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (Math.abs(d - this.r) < this.width + e.radius && e.pos.y - this.pos.y < 3) {
          this.hitSet.add(e);
          e.takeHit({ dmg: this.dmg, dir: _v.set(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize().clone(), power: 1.5, knock: 8, source: 'wave' });
        }
      }
    }
    if (this.r >= this.maxR) this.kill();
  }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.game.world.dynamic.remove(this.mesh);
    this.mesh.material.dispose();
  }
}

// A telegraphed circle that erupts after a delay (fire pillars, shadow runes, lightning).
export class Eruption {
  constructor(game, { pos, radius = 2.5, delay = 1.1, dmg = 20, color = 0xff7a20, owner = 'enemy', kind = 'fire', height = 8 }) {
    this.game = game;
    this.pos = pos.clone();
    this.radius = radius;
    this.delay = delay;
    this.t = 0;
    this.dmg = dmg;
    this.owner = owner;
    this.kind = kind;
    this.height = height;
    this.alive = true;
    this.fired = false;
    this.color = new THREE.Color(color);
    this.disc = new THREE.Mesh(discGeo, glowMaterial(color, 0.25));
    this.disc.scale.setScalar(radius);
    this.disc.position.copy(this.pos).add(_v.set(0, 0.12, 0));
    this.ring = new THREE.Mesh(ringGeo, glowMaterial(color, 0.9));
    this.ring.scale.setScalar(radius);
    this.ring.position.copy(this.disc.position);
    game.world.dynamic.add(this.disc, this.ring);
  }
  update(dt) {
    const game = this.game;
    this.t += dt;
    if (!this.fired) {
      const k = this.t / this.delay;
      this.disc.scale.setScalar(this.radius * k);
      this.disc.material.opacity = 0.2 + 0.3 * Math.sin(this.t * 25) * k;
      if (this.t >= this.delay) {
        this.fired = true;
        this.fireT = 0;
        const c = this.color;
        game.fx.burst(this.pos, 40, { dir: new THREE.Vector3(0, 1, 0), spread: 0.35, speed: this.height * 2.2, color: [c.r * 1.8, c.g * 1.8, c.b * 1.8], life: 0.7, size: 1.1, radius: this.radius * 0.5 });
        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(this.radius * 0.8, this.radius, this.height, 16, 1, true), beamMaterial(this.color, 0.9));
        this.beam.position.copy(this.pos).add(_v.set(0, this.height / 2, 0));
        game.world.dynamic.add(this.beam);
        game.audio.sfx(this.kind === 'fire' ? 'fire' : 'explode');
        const tgts = this.owner === 'enemy' ? [game.player] : game.enemies.filter((e) => e.alive);
        for (const t of tgts) {
          const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
          if (d < this.radius + (t.radius || 0.5) && t.pos.y - this.pos.y < this.height) {
            if (this.owner === 'enemy') t.receiveAttack({ dmg: this.dmg, pos: this.pos.clone(), kind: this.kind, parryable: false, knock: 6, launch: 8 });
            else t.takeHit({ dmg: this.dmg, dir: new THREE.Vector3(0, 1, 0), power: 2.5, launch: 10, source: 'judgment' });
          }
        }
      }
    } else {
      this.fireT += dt;
      const k = this.fireT / 0.5;
      this.beam.material.uniforms.opacity.value = 0.9 * (1 - k);
      this.beam.scale.set(1 - k * 0.5, 1, 1 - k * 0.5);
      this.ring.material.opacity = 0.9 * (1 - k);
      this.disc.material.opacity = 0.4 * (1 - k);
      if (k >= 1) this.kill();
    }
  }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.game.world.dynamic.remove(this.disc, this.ring);
    this.disc.material.dispose();
    this.ring.material.dispose();
    if (this.beam) {
      this.game.world.dynamic.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam.material.dispose();
    }
  }
}

// Sweeping laser/water beam from a source toward a moving aim point.
export class SweepBeam {
  constructor(game, { from, aimStart, aimEnd, dur = 2, dmg = 14, color = 0x60e0ff, width = 1.2, windup = 0.8 }) {
    this.game = game;
    this.from = from;
    this.aimStart = aimStart.clone();
    this.aimEnd = aimEnd.clone();
    this.dur = dur;
    this.windup = windup;
    this.dmg = dmg;
    this.width = width;
    this.t = 0;
    this.alive = true;
    this.hitCd = 0;
    this.color = new THREE.Color(color);
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.5, width * 0.5, 1, 10, 1, true), beamMaterial(color, 0.2));
    this.mesh.geometry.translate(0, 0.5, 0);
    this.mesh.geometry.rotateX(Math.PI / 2);
    game.world.dynamic.add(this.mesh);
    this.aim = new THREE.Vector3();
  }
  update(dt) {
    const game = this.game;
    this.t += dt;
    this.hitCd -= dt;
    const src = typeof this.from === 'function' ? this.from() : this.from;
    const firing = this.t > this.windup;
    const u = firing ? Math.min(1, (this.t - this.windup) / this.dur) : 0;
    this.aim.copy(this.aimStart).lerp(this.aimEnd, u);
    const dir = _v.copy(this.aim).sub(src);
    const len = dir.length() + 30;
    this.mesh.position.copy(src);
    this.mesh.lookAt(this.aim);
    this.mesh.scale.set(firing ? 1 : 0.15, firing ? 1 : 0.15, len);
    this.mesh.material.uniforms.opacity.value = firing ? 0.95 : 0.4 + 0.3 * Math.sin(this.t * 30);
    if (firing) {
      // distance from player to segment
      const p = game.player;
      const pp = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z);
      const d = dir.normalize();
      const w = pp.clone().sub(src);
      const proj = Math.max(0, w.dot(d));
      const closest = src.clone().addScaledVector(d, proj);
      if (closest.distanceTo(pp) < this.width * 0.5 + 0.5 && this.hitCd <= 0) {
        this.hitCd = 0.5;
        p.receiveAttack({ dmg: this.dmg, pos: closest, kind: 'beam', parryable: false, knock: 5 });
      }
      if (Math.random() < 0.6) {
        const c = this.color;
        const gp = game.world.groundAt(this.aim.x, this.aim.z, this.aim.y + 5, 0);
        game.fx.burst(new THREE.Vector3(this.aim.x, isFinite(gp) ? gp : this.aim.y, this.aim.z), 3, { speed: 6, color: [c.r * 1.5, c.g * 1.5, c.b * 1.5], life: 0.5, size: 0.8 });
      }
    }
    if (this.t > this.windup + this.dur) this.kill();
  }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.game.world.dynamic.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
