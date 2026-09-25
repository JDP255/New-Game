// Bosses: Gorlath the Giant, Molochar the Furnace-Warden, the Leviathan, and Zekeriah the Wizard.
import * as THREE from 'three';
import { Enemy, makeEnemy } from './enemies.js';
import { buildHumanoid, PALETTES } from './enemyModels.js';
import { idlePose, runPose } from './knightPoses.js';
import { blendInto } from './knightModel.js';
import { Projectile, Shockwave, Eruption, SweepBeam } from './projectiles.js';
import { clamp, damp, dampAngle, wrapAngle, TAU } from '../core/utils.js';
import { toon, part, glowSprite, glowMaterial } from '../render/materials.js';

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

class Boss extends Enemy {
  constructor(game, pos, cfg) {
    super(game, pos, cfg);
    this.isBoss = true;
    this.state = 'intro';
    this.attackCount = 0;
    this.defeated = false;
    this.phase = 1;
    this.poise = 99;
  }
  // Bosses don't vanish on death — they fall and await the finisher cinematic.
  die() {
    if (this.defeated) return;
    this.hp = 0;
    this.defeated = true;
    this.alive = false;
    this.releaseToken();
    this.setState('defeated');
    this.game.onBossDefeated(this);
  }
  takeHit(hit) {
    if (this.state === 'intro' || this.invuln) return false;
    const mult = this.damageMult ? this.damageMult() : 1;
    return super.takeHit({ ...hit, dmg: hit.dmg * mult, launch: 0 });
  }
  vanish() {
    const g = this.game;
    g.fx.burst(this.chest.clone(), 80, { speed: 12, color: [1.4, 0.6, 1.6], life: 1.2, size: 1.2, radius: this.radius });
    g.releaseSoul(this.chest.clone(), 2.5);
    g.world.dynamic.remove(this.model.root);
    this.state = 'dead';
  }
  update() {}
}

// ============================================================================ GORLATH
const G_RAISE = { chest: [-0.4, 0, 0], spine: [-0.2, 0, 0], shR: [-3.0, 0.1, 0.2], elR: [-0.5, 0, 0], haR: [1.2, 0, 0], shL: [-2.6, 0, -0.2], elL: [-0.6, 0, 0], head: [-0.3, 0, 0] };
const G_SLAM = { chest: [0.6, 0, 0], spine: [0.4, 0, 0], shR: [-0.6, 0, 0], elR: [0, 0, 0], haR: [1.6, 0, 0], shL: [-0.7, 0, 0], thL: [-0.9, 0, 0.2], knL: [1.1, 0, 0], thR: [0.4, 0, -0.2], knR: [0.9, 0, 0], bodyPos: [0, -0.35, 0] };
const G_SW0 = { chest: [0.3, -1.2, 0], spine: [0.3, -0.5, 0], shR: [-1.0, -2.2, 0], elR: [-0.2, 0, 0], haR: [1.9, 0, 0], thL: [-0.5, 0, 0.3], knL: [0.7, 0, 0], bodyPos: [0, -0.2, 0] };
const G_SW1 = { chest: [0.35, 1.3, 0], spine: [0.3, 0.5, 0], shR: [-1.0, 1.4, 0], elR: [0, 0, 0], haR: [1.9, 0, 0], thR: [-0.5, 0, -0.3], knR: [0.7, 0, 0], bodyPos: [0, -0.2, 0] };
const G_STOMP = { thL: [-1.3, 0, 0.2], knL: [0.6, 0, 0], chest: [-0.2, 0, 0], shL: [-0.6, 0.4, 0.8], shR: [-0.6, -0.4, -0.8] };
const G_KNEEL = { bodyPos: [0, -0.45, 0], spine: [0.4, 0, 0], chest: [0.3, 0, 0], head: [0.5, 0, 0], thL: [-1.45, 0, 0.1], knL: [1.5, 0, 0], thR: [0.25, 0, -0.08], knR: [1.9, 0, 0], ftR: [0.8, 0, 0], shR: [-0.3, 0, -0.3], elR: [-0.2, 0, 0], shL: [-0.9, 0, 0.2], elL: [-0.8, 0, 0] };
const G_ROAR = { chest: [-0.5, 0, 0], head: [-0.6, 0, 0], shR: [-1.2, -1.2, -0.6], shL: [-1.2, 1.2, 0.6], elR: [-0.6, 0, 0], elL: [-0.6, 0, 0] };

export class Gorlath extends Boss {
  constructor(game, pos) {
    super(game, pos, { hp: 1500, radius: 2.3, height: 9.5, glory: 60, palette: PALETTES.elite, name: 'Gorlath, the Many-in-One' });
    this.scale = 4.3;
    this.model = buildHumanoid({ palette: { ...PALETTES.elite, armor: 0x1a1418, trim: 0x9a7a2a }, weapon: 'club', helm: 'horned', bulk: 1.4, scale: this.scale });
    game.world.dynamic.add(this.model.root);
    // A great shield on his back, riveted with the name-tags of the hundred souls fused within.
    const M = this.model.M;
    const shield = part(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), M.trim, this.model.joints.chest, { pos: [0, 0.1, -0.32], rot: [Math.PI / 2, 0, 0] });
    part(new THREE.ConeGeometry(0.1, 0.25, 6), M.armor, shield, { pos: [0, 0.1, 0], outline: 0.008 });
    this.summoned = { 60: false, 30: false };
    this.pattern = ['slam', 'sweep', 'stomp', 'slam', 'stomp', 'sweep'];
    this.pi = 0;
    this.cd = 1.5;
  }
  damageMult() { return this.state === 'exhausted' ? 1.8 : 1; }
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    const g = this.game, p = g.player;
    const pose = this.pose;
    let clip = null, w = 1;
    const dist = this.distToPlayer();
    const eyes = this.model.eyeGlow;
    eyes.scale.setScalar(2);
    switch (this.state) {
      case 'intro': clip = G_ROAR; w = clamp(this.stateT, 0, 1); this.facePlayer(dt, 2); break;
      case 'idle': {
        this.facePlayer(dt, 1.8);
        if (dist > 7) this.moveToward(p.pos, 3.2, dt, 2); else this.brake(dt, 3);
        this.cd -= dt;
        const pct = this.hp / this.maxHp * 100;
        for (const th of [60, 30]) {
          if (pct < th && !this.summoned[th]) { this.summoned[th] = true; this.setState('roar'); g.audio.sfx('roar'); g.cameraShake(0.5); break; }
        }
        if (this.state === 'idle' && this.cd <= 0) {
          if (this.attackCount >= 3) { this.attackCount = 0; this.setState('exhausted'); g.ui.toast('Gorlath is exhausted — strike now!', 'hint'); break; }
          const atk = dist > 16 ? 'slam' : this.pattern[this.pi++ % this.pattern.length];
          this.setState(atk + 'Wind');
          g.audio.sfx('charge');
        }
        break;
      }
      case 'slamWind': {
        clip = G_RAISE; w = clamp(this.stateT / 0.8, 0, 1);
        this.facePlayer(dt, 2.5);
        this.brake(dt);
        eyes.scale.setScalar(2 + w * 3);
        if (this.stateT > 1.15) { this.setState('slam'); g.audio.sfx('swing', { power: 2 }); }
        break;
      }
      case 'slam': {
        clip = G_SLAM; w = clamp(this.stateT / 0.15, 0, 1);
        if (!this.hitThisSwing && this.stateT > 0.15) {
          this.hitThisSwing = true;
          const tip = this.model.weaponTip.getWorldPosition(_v).clone();
          tip.y = g.world.surfaceAt(tip.x, tip.z);
          if (!isFinite(tip.y)) tip.y = this.pos.y;
          g.spawnProjectile(new Shockwave(g, { pos: tip, maxR: 22, speed: 16, dmg: 22, color: 0xff9040, width: 1.1 }));
          g.fx.burst(tip, 60, { speed: 14, color: [1.6, 0.9, 0.4], life: 0.9, size: 1.2, gravity: 12, dir: UP, spread: 1 });
          g.smoke.burst(tip, 20, { speed: 6, color: [0.25, 0.2, 0.18], life: 2, size: 5, alpha: 0.7 });
          g.audio.sfx('impact');
          g.cameraShake(0.8, tip);
          if (Math.hypot(p.pos.x - tip.x, p.pos.z - tip.z) < 4 && p.pos.y - tip.y < 3) p.receiveAttack({ dmg: 35, source: this, pos: tip, kind: 'melee', parryable: false, knock: 14, launch: 8 });
        }
        if (this.stateT > 1.4) this.endAttack(1.2);
        break;
      }
      case 'sweepWind': {
        clip = G_SW0; w = clamp(this.stateT / 0.7, 0, 1);
        this.facePlayer(dt, 2.5);
        this.brake(dt);
        eyes.scale.setScalar(2 + w * 3);
        if (this.stateT > 1.0) { this.setState('sweep'); g.audio.sfx('swing', { power: 2 }); }
        break;
      }
      case 'sweep': {
        clip = G_SW1; w = clamp(this.stateT / 0.35, 0, 1);
        const tip = this.model.weaponTip.getWorldPosition(_v);
        if (Math.random() < 0.8) g.smoke.burst(new THREE.Vector3(tip.x, this.pos.y, tip.z), 1, { speed: 2, color: [0.4, 0.35, 0.3], life: 0.8, size: 2.5, alpha: 0.5 });
        if (!this.hitThisSwing && this.stateT > 0.1 && this.stateT < 0.4) {
          const d = Math.hypot(p.pos.x - tip.x, p.pos.z - tip.z);
          if ((d < 3.2 || (dist < 10 && this.facingPlayer(1.3))) && p.pos.y - this.pos.y < 2.4 && this.stateT > 0.18) {
            this.hitThisSwing = true;
            p.receiveAttack({ dmg: 28, source: this, pos: tip.clone(), kind: 'melee', parryable: false, knock: 16, launch: 6 });
          }
        }
        if (this.stateT > 1.1) this.endAttack(1.0);
        break;
      }
      case 'stompWind': {
        clip = G_STOMP; w = clamp(this.stateT / 0.6, 0, 1);
        this.brake(dt);
        if (this.stateT > 0.8) {
          this.setState('stomp');
          const fp = this.model.joints.ftL.getWorldPosition(_v).clone();
          fp.y = this.pos.y;
          g.spawnProjectile(new Shockwave(g, { pos: fp, maxR: 12, speed: 11, dmg: 16, color: 0xff7040 }));
          g.spawnProjectile(new Shockwave(g, { pos: fp, maxR: 14, speed: 8, dmg: 16, color: 0xff7040 }));
          g.audio.sfx('impact');
          g.cameraShake(0.5);
        }
        break;
      }
      case 'stomp': { clip = G_STOMP; w = 1 - clamp(this.stateT / 0.5, 0, 1); if (this.stateT > 1.3) this.endAttack(1.0); break; }
      case 'roar': {
        clip = G_ROAR; w = clamp(this.stateT / 0.4, 0, 1);
        this.brake(dt);
        if (this.stateT > 0.5 && !this.hitThisSwing) {
          this.hitThisSwing = true;
          g.spawnWave([{ type: 'thrall', n: 3, at: [this.pos.x, this.pos.z], spread: 12 }, { type: 'caster', n: 1, at: [this.pos.x, this.pos.z], spread: 16 }]);
          g.ui.toast('Gorlath calls his warband!', 'warn');
        }
        if (this.stateT > 2.2) { this.setState('idle'); this.cd = 1; }
        break;
      }
      case 'exhausted': {
        clip = G_KNEEL; w = clamp(this.stateT / 0.5, 0, 1);
        this.brake(dt, 6);
        eyes.scale.setScalar(0.8);
        if (Math.random() < 0.2) g.smoke.burst(this.chest.clone(), 1, { speed: 1, color: [0.5, 0.5, 0.5], life: 1.5, size: 3, alpha: 0.3, dir: UP });
        if (this.stateT > 4) { this.setState('idle'); this.cd = 1.2; }
        break;
      }
      case 'staggered': case 'parried': this.setState('idle'); break;
      case 'defeated': clip = G_KNEEL; w = 1; this.brake(dt, 5); break;
    }
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.4 && this.state === 'idle') {
      this.walkPhase = (this.walkPhase || 0) + dt * moving * 0.8;
      runPose(pose, this.walkPhase, 0.15, this.time);
      if (Math.sin(this.walkPhase) * Math.sin(this.walkPhase - dt) < 0) { g.cameraShake(0.08); g.audio.sfx('land', { power: 1.5 }); }
    } else idlePose(pose, this.time, 1);
    pose.shR = pose.shR || [0, 0, 0];
    if (!clip) { pose.shR = [-0.4, -0.2, -0.3]; pose.elR = [-0.6, 0, 0]; pose.haR = [1.8, 0, 0]; }
    if (clip) blendInto(pose, clip, w);
    this.physics(dt);
    this.updateVisual(dt, this.state === 'slam' || this.state === 'sweep' ? 14 : 7);
  }
  endAttack(cd) { this.attackCount++; this.cd = cd; this.setState('idle'); }
  physics(dt) {
    super.physics(dt);
  }
}

// ============================================================================ MOLOCHAR
const M_CAST = { shL: [-2.2, 0.4, 0.3], shR: [-2.2, -0.4, -0.3], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], chest: [-0.3, 0, 0], head: [-0.4, 0, 0] };
const M_THROW = { shR: [-1.4, 0.3, 0], elR: [0, 0, 0], chest: [0.3, 0.5, 0], shL: [-0.5, 0, 0.4] };

export class Molochar extends Boss {
  constructor(game, pos) {
    super(game, pos, { hp: 1900, radius: 2.0, height: 8, glory: 60, palette: PALETTES.fire, name: 'Molochar, Warden of the Furnace' });
    this.model = buildHumanoid({ palette: PALETTES.fire, weapon: 'hammer', helm: 'demon', bulk: 1.3, scale: 3.6 });
    game.world.dynamic.add(this.model.root);
    // Furnace heart
    const heart = glowSprite(0xff8a20, 2.2, 0.9);
    heart.position.set(0, 0.12, 0.25);
    this.model.joints.chest.add(heart);
    this.heart = heart;
    this.pattern = ['fireballs', 'pillars', 'charge', 'slam', 'fireballs', 'pillars'];
    this.pi = 0;
    this.cd = 2;
    this.heated = false;
  }
  damageMult() { return this.warded ? 1.6 : 1; }
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    const g = this.game, p = g.player;
    let clip = null, w = 1;
    const dist = this.distToPlayer();
    this.heart.scale.setScalar(2.2 + Math.sin(this.time * 6) * 0.4 + (this.heated ? 1.5 : 0));
    if (Math.random() < 0.5) {
      const c = this.chest;
      g.fx.spawn(c.x + (Math.random() - 0.5) * 3, c.y + (Math.random() - 0.5) * 4, c.z + (Math.random() - 0.5) * 3, 0, 3 + Math.random() * 3, 0, { life: 0.8, size: 0.7, color: [1.8, 0.7, 0.2] });
    }
    switch (this.state) {
      case 'intro': clip = M_CAST; w = clamp(this.stateT, 0, 1); this.facePlayer(dt, 2); break;
      case 'idle': {
        this.facePlayer(dt, 2.5);
        if (dist > 10) this.moveToward(p.pos, 3.5, dt, 2); else this.brake(dt, 3);
        this.cd -= dt;
        if (!this.heated && this.hp < this.maxHp * 0.5) { this.heated = true; g.onFurnaceHeated(this); this.setState('heat'); break; }
        if (this.cd <= 0) { this.setState(this.pattern[this.pi++ % this.pattern.length]); g.audio.sfx('charge'); }
        break;
      }
      case 'heat': {
        clip = M_CAST; w = clamp(this.stateT / 0.5, 0, 1);
        this.brake(dt);
        if (this.stateT > 3) { this.setState('idle'); this.cd = 1; }
        break;
      }
      case 'fireballs': {
        clip = this.stateT < 0.8 ? M_CAST : M_THROW;
        w = 1;
        this.brake(dt);
        this.facePlayer(dt, 4);
        const n = this.heated ? 7 : 5;
        if (this.stateT > 0.9 && !this.hitThisSwing) {
          this.hitThisSwing = true;
          const hand = this.model.joints.haR.getWorldPosition(_v).clone();
          for (let i = 0; i < n; i++) {
            const spread = (i - (n - 1) / 2) * 0.22;
            const ang = this.angleToPlayer() + spread;
            const d = dist;
            const tflight = 1.1;
            const vel = new THREE.Vector3(Math.sin(ang) * d / tflight, 0, Math.cos(ang) * d / tflight);
            vel.y = ((p.pos.y - hand.y) + 0.5 * 18 * tflight * tflight) / tflight;
            g.spawnProjectile(new Projectile(g, { pos: hand, vel, color: 0xff7a20, dmg: 14, radius: 0.8, size: 2, gravity: 18, kind: 'fire', source: this, parryable: true }));
          }
          g.audio.sfx('fire');
        }
        if (this.stateT > 1.8) this.endAttack(1.3);
        break;
      }
      case 'pillars': {
        clip = M_CAST; w = clamp(this.stateT / 0.4, 0, 1);
        this.brake(dt);
        const count = this.heated ? 9 : 6;
        if (!this.hitThisSwing && this.stateT > 0.5) {
          this.hitThisSwing = true;
          for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU + Math.random();
            const r = i === 0 ? 0 : 3 + Math.random() * 7;
            const x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r;
            const y = g.world.surfaceAt(x, z);
            if (!isFinite(y)) continue;
            g.spawnProjectile(new Eruption(g, { pos: new THREE.Vector3(x, y, z), radius: 2.2, delay: 1.1 + i * 0.12, dmg: 18, color: 0xff6a10 }));
          }
        }
        if (this.stateT > 2.6) this.endAttack(1.2);
        break;
      }
      case 'charge': {
        if (this.stateT < 0.7) {
          this.facePlayer(dt, 6);
          this.brake(dt);
          clip = { chest: [0.4, 0, 0], bodyPos: [0, -0.2, 0] }; w = this.stateT / 0.7;
        } else if (this.stateT < 1.7) {
          this.vel.x = Math.sin(this.yaw) * 22;
          this.vel.z = Math.cos(this.yaw) * 22;
          clip = { body: [0.5, 0, 0], chest: [0.3, 0, 0] };
          if (Math.random() < 0.8) g.fx.burst(this.pos.clone().add(UP), 2, { speed: 3, color: [1.8, 0.6, 0.1], life: 0.6, size: 1 });
          if (!this.hitThisSwing && dist < 3.5 && Math.abs(p.pos.y - this.pos.y) < 3) {
            this.hitThisSwing = true;
            p.receiveAttack({ dmg: 24, source: this, pos: this.chest.clone(), kind: 'melee', parryable: false, knock: 15, launch: 7 });
          }
        } else {
          this.brake(dt, 3);
          if (this.stateT > 2.3) this.endAttack(1.0);
        }
        break;
      }
      case 'slam': {
        clip = this.stateT < 0.9 ? G_RAISE : G_SLAM;
        w = 1;
        this.brake(dt);
        if (this.stateT < 0.9) this.facePlayer(dt, 3);
        if (!this.hitThisSwing && this.stateT > 1.0) {
          this.hitThisSwing = true;
          const tip = this.model.weaponTip.getWorldPosition(_v).clone();
          tip.y = this.pos.y;
          g.spawnProjectile(new Shockwave(g, { pos: tip, maxR: 16, speed: 14, dmg: 20, color: 0xff5010 }));
          g.fx.burst(tip, 50, { speed: 12, color: [1.8, 0.7, 0.2], life: 0.8, size: 1, dir: UP, spread: 1 });
          g.audio.sfx('impact');
          g.cameraShake(0.6);
        }
        if (this.stateT > 2) this.endAttack(1.2);
        break;
      }
      case 'staggered': case 'parried': this.setState('idle'); break;
      case 'defeated': clip = G_KNEEL; this.brake(dt, 5); break;
    }
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.4 && this.state === 'idle') {
      this.walkPhase = (this.walkPhase || 0) + dt * moving;
      runPose(this.pose, this.walkPhase, 0.2, this.time);
    } else idlePose(this.pose, this.time, 1);
    if (clip) blendInto(this.pose, clip, w);
    this.physics(dt);
    this.updateVisual(dt, 9);
  }
  endAttack(cd) { this.cd = cd * (this.heated ? 0.75 : 1); this.setState('idle'); }
}

// ============================================================================ TEHOMAR (the Leviathan)
export class Leviathan extends Boss {
  constructor(game, pos, seaY = 0) {
    super(game, pos, { hp: 2000, radius: 2.4, height: 3, glory: 60, palette: PALETTES.caster, name: 'Tehomar, the Deep That Hungers' });
    this.seaY = seaY;
    this.flying = true;
    const root = new THREE.Group();
    const M = {
      body: toon(0x0f2a3a, { rim: 0.7, rimColor: 0x60f0ff, gradient: 'three', unique: true }),
      belly: toon(0x2a6a6a, { rim: 0.4, rimColor: 0x60f0ff, unique: true }),
      fin: toon(0x0a4a5a, { rim: 0.6, rimColor: 0x80ffff, side: THREE.DoubleSide, unique: true }),
      eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 2.8) }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.2) }),
    };
    this.M = M;
    this.segments = [];
    const N = 26;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const r = 2.1 * (1 - t * 0.75) + (i < 3 ? 0.2 : 0);
      const s = new THREE.Group();
      part(new THREE.SphereGeometry(r, 12, 8), M.body, s, { scale: [1, 0.9, 1.5], outline: 0.06 });
      if (i % 2 === 0 && i > 1) {
        const fin = part(new THREE.ConeGeometry(r * 0.5, r * 1.6, 4), M.fin, s, { pos: [0, r * 0.95, 0], rot: [-0.6, 0, 0], scale: [0.3, 1, 1], outline: 0.03 });
        void fin;
        part(new THREE.SphereGeometry(r * 0.25, 6, 4), M.glow, s, { pos: [r * 0.8, r * 0.1, 0], outline: 0, shadow: false });
        part(new THREE.SphereGeometry(r * 0.25, 6, 4), M.glow, s, { pos: [-r * 0.8, r * 0.1, 0], outline: 0, shadow: false });
      }
      root.add(s);
      this.segments.push({ obj: s, pos: new THREE.Vector3(pos.x, seaY - 20, pos.z - i * 2.4), r });
    }
    // Head
    const head = this.segments[0].obj;
    part(new THREE.ConeGeometry(1.6, 4.5, 8), M.body, head, { pos: [0, 0, 2.6], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 0.7], outline: 0.05 });
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.8, 0.6);
    head.add(jaw);
    part(new THREE.ConeGeometry(1.3, 4, 8), M.belly, jaw, { pos: [0, 0, 2], rot: [Math.PI / 2, 0, 0], scale: [1.1, 1, 0.45], outline: 0.05 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 7 - 0.5) * 2;
      part(new THREE.ConeGeometry(0.12, 0.6, 4), toon(0xf0f0e0), head, { pos: [a * 0.9, -0.5, 2.4 + (1 - Math.abs(a)) * 1.2], rot: [Math.PI, 0, 0], outline: 0.01 });
    }
    this.jaw = jaw;
    for (const s of [1, -1]) {
      part(new THREE.SphereGeometry(0.35, 8, 6), M.eye, head, { pos: [1.1 * s, 0.7, 1.4], outline: 0, shadow: false });
      const hr = part(new THREE.ConeGeometry(0.35, 3.5, 6), M.fin, head, { pos: [0.9 * s, 1.4, -0.8], rot: [-1.1, 0, -0.35 * s], outline: 0.02 });
      void hr;
    }
    const eg = glowSprite(0x60fff0, 5, 0.6);
    eg.position.set(0, 0.7, 2);
    head.add(eg);
    this.model = { root, M };
    game.world.dynamic.add(root);
    this.pos.copy(this.segments[0].pos);
    this.headDir = new THREE.Vector3(0, 0, 1);
    this.attackIdx = 0;
    this.state = 'intro';
    this.anchor = new THREE.Vector3();
    this.path = null;
  }
  damageMult() { return this.state === 'stuck' ? 1.6 : 1; }
  takeHit(hit) {
    if (!['stuck', 'beam', 'rear', 'volley'].includes(this.state)) {
      if (this.state !== 'intro') this.game.audio.sfx('clang');
      return false;
    }
    return super.takeHit(hit);
  }
  get chest() { return _v.copy(this.pos); }

  // Head follows a curve; body segments follow the head (chain).
  updateChain(dt) {
    const segs = this.segments;
    segs[0].pos.copy(this.pos);
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i];
      const dir = _v.copy(b.pos).sub(a.pos);
      const d = dir.length() || 1;
      const L = (a.r + b.r) * 0.62;
      if (d > L) b.pos.copy(a.pos).addScaledVector(dir, L / d);
      // Sink tail slowly when idle
      b.pos.y = Math.max(b.pos.y - dt * 0.5, this.seaY - 25);
    }
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.obj.position.copy(s.pos);
      const next = i === 0 ? _v.copy(s.pos).add(this.headDir) : segs[i - 1].pos;
      s.obj.lookAt(next);
      s.obj.visible = s.pos.y > this.seaY - 6;
      if (Math.abs(s.pos.y - this.seaY) < s.r && Math.random() < 0.15) {
        this.game.smoke.spawn(s.pos.x, this.seaY + 0.3, s.pos.z, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, { life: 0.9, size: 3, color: [0.7, 0.9, 1], alpha: 0.6 });
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.stateT += dt;
    const g = this.game, p = g.player;
    const target = _v.set(p.pos.x, p.pos.y, p.pos.z).clone();
    this.jaw.rotation.x = 0.1 + (['beam', 'rear', 'volley'].includes(this.state) ? 0.5 : 0) + Math.sin(this.time * 3) * 0.05;
    switch (this.state) {
      case 'intro': {
        // Rise dramatically in front of player
        const t = this.stateT;
        this.anchor.set(p.pos.x + 30, this.seaY, p.pos.z + 30);
        this.pos.set(this.anchor.x, this.seaY - 10 + Math.min(1, t / 2.5) * 30, this.anchor.z);
        this.headDir.set(p.pos.x - this.pos.x, 0.3, p.pos.z - this.pos.z).normalize();
        break;
      }
      case 'submerged': {
        this.pos.y = damp(this.pos.y, this.seaY - 18, 2, dt);
        if (this.stateT > 2.5) this.surface();
        break;
      }
      case 'surface': {
        const u = clamp(this.stateT / 1.4, 0, 1);
        this.pos.lerpVectors(this.from, this.anchor, u);
        this.pos.y = this.seaY - 15 + Math.sin(u * Math.PI * 0.5) * (this.anchor.y - this.seaY + 15);
        this.headDir.copy(target).sub(this.pos).normalize();
        if (u >= 1) {
          g.audio.sfx('roar');
          g.cameraShake(0.4);
          const atk = ['bite', 'beam', 'volley', 'bite'][this.attackIdx++ % 4];
          this.setState(atk === 'bite' ? 'rear' : atk);
          this.nextAtk = atk;
        }
        break;
      }
      case 'rear': {
        this.headDir.lerp(_v.copy(target).sub(this.pos).normalize(), 0.1);
        this.pos.y += Math.sin(this.stateT * 4) * 0.02;
        if (this.stateT > 1.1) {
          this.biteFrom = this.pos.clone();
          this.biteTo = target.clone();
          this.biteTo.y += 0.5;
          this.setState('bite');
          g.audio.sfx('dash');
        }
        break;
      }
      case 'bite': {
        const u = clamp(this.stateT / 0.45, 0, 1);
        this.pos.lerpVectors(this.biteFrom, this.biteTo, u * u);
        if (!this.hitThisSwing && this.pos.distanceTo(_v.set(p.pos.x, p.pos.y + 1, p.pos.z)) < 3.4) {
          this.hitThisSwing = true;
          p.receiveAttack({ dmg: 26, source: this, pos: this.pos.clone(), kind: 'melee', parryable: false, knock: 14, launch: 8 });
        }
        if (u >= 1) {
          g.audio.sfx('impact');
          g.cameraShake(0.6);
          g.fx.burst(this.pos, 40, { speed: 10, color: [0.6, 1.4, 1.5], life: 0.7, size: 0.9 });
          this.setState('stuck');
          g.ui.toast('The Leviathan is stuck — strike its head!', 'hint');
        }
        break;
      }
      case 'stuck': {
        this.pos.y += Math.sin(this.stateT * 20) * 0.02;
        if (this.stateT > 3.2) this.dive();
        break;
      }
      case 'beam': {
        if (!this.beam) {
          const dir = _v.copy(target).sub(this.pos);
          const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(14);
          this.beam = new SweepBeam(g, { from: () => this.pos.clone().addScaledVector(this.headDir, 3), aimStart: target.clone().add(side), aimEnd: target.clone().sub(side), dur: 2.4, dmg: 16, color: 0x60f0ff, width: 1.6, windup: 0.9 });
          g.spawnProjectile(this.beam);
          g.audio.sfx('charge');
        }
        this.headDir.lerp(_v.copy(this.beam.aim).sub(this.pos).normalize(), 0.2);
        if (this.stateT > 3.6) { this.beam = null; this.dive(); }
        break;
      }
      case 'volley': {
        this.headDir.lerp(_v.copy(target).sub(this.pos).normalize(), 0.1);
        const shots = 6;
        const k = Math.floor(this.stateT / 0.35);
        if (k < shots && k !== this.lastShot) {
          this.lastShot = k;
          const mouth = this.pos.clone().addScaledVector(this.headDir, 3);
          const vel = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4)).sub(mouth).normalize().multiplyScalar(22);
          g.spawnProjectile(new Projectile(g, { pos: mouth, vel, color: 0x60f0ff, dmg: 12, radius: 0.8, size: 1.8, source: this, homing: 0.6 }));
          g.audio.sfx('bolt');
        }
        if (this.stateT > shots * 0.35 + 0.8) { this.lastShot = -1; this.dive(); }
        break;
      }
      case 'defeated': {
        this.pos.y = damp(this.pos.y, this.seaY + 2, 1, dt);
        this.headDir.y = damp(this.headDir.y, -0.4, 1, dt);
        break;
      }
    }
    this.updateChain(dt);
    this.flashT -= dt;
    const f = this.flashT > 0 ? 0.9 : 0;
    this.M.body.emissive.setScalar(f);
  }
  dive() {
    this.from = this.pos.clone();
    this.setState('submerged');
    this.game.audio.sfx('splash');
  }
  surface() {
    const p = this.game.player;
    const a = Math.random() * TAU;
    const r = 14 + Math.random() * 6;
    this.from = new THREE.Vector3(p.pos.x + Math.sin(a) * (r + 10), this.seaY - 15, p.pos.z + Math.cos(a) * (r + 10));
    this.anchor.set(p.pos.x + Math.sin(a) * r, Math.max(this.seaY + 8, p.pos.y + 6), p.pos.z + Math.cos(a) * r);
    this.setState('surface');
    this.game.audio.sfx('splash');
  }
  startFight() { this.dive(); }
  physics() {}
  vanish() {
    const g = this.game;
    for (const s of this.segments) g.fx.burst(s.pos, 8, { speed: 6, color: [0.5, 1.4, 1.5], life: 1, size: 1 });
    g.releaseSoul(this.pos.clone(), 2.5);
    g.world.dynamic.remove(this.model.root);
    this.state = 'dead';
  }
}

// ============================================================================ ZEKERIAH
const Z_CAST = { shR: [-2.4, -0.2, 0], elR: [-0.2, 0, 0], haR: [0.2, 0, 0], shL: [-1.8, 0.5, 0.4], elL: [-0.3, 0, 0], chest: [-0.2, 0, 0], head: [-0.2, 0, 0] };
const Z_THRUST = { shR: [-1.5, 0, 0], elR: [0, 0, 0], haR: [0.2, 0, 0], shL: [-1.4, 0.3, 0.3], chest: [0.3, 0, 0] };

export class Zekeriah extends Boss {
  constructor(game, pos, arena) {
    super(game, pos, { hp: 2600, radius: 0.8, height: 2.4, glory: 100, palette: PALETTES.wizard, name: 'Zekeriah, Lord of Zerkskis' });
    this.arena = arena; // {x,z,r,y}
    this.model = buildHumanoid({ palette: PALETTES.wizard, weapon: 'staff', helm: 'crown', bulk: 1.0, scale: 1.2, cape: true });
    // Long robe
    const robe = part(new THREE.ConeGeometry(0.6, 1.6, 10, 1, true), this.model.M.cloth, this.model.joints.hips, { pos: [0, -0.5, 0], outline: 0.02 });
    void robe;
    const aura = glowSprite(0x8040ff, 6, 0.35);
    aura.position.y = 1.4;
    this.model.root.add(aura);
    this.aura = aura;
    game.world.dynamic.add(this.model.root);
    this.flying = true;
    this.hover = 1.2;
    this.cd = 2;
    this.pattern = ['orbs', 'runes', 'orbs', 'teleport', 'summon', 'runes', 'orbs', 'teleport'];
    this.pi = 0;
    this.clones = [];
    this.scaleNow = 1;
    this.phase = 1;
    this.baseY = pos.y;
  }
  damageMult() { return 1; }
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    const g = this.game, p = g.player;
    const pct = this.hp / this.maxHp;
    let clip = null, w = 1;
    const dist = this.distToPlayer();
    this.aura.material.opacity = 0.3 + Math.sin(this.time * 3) * 0.1;
    if (this.state !== 'defeated' && this.state !== 'intro') {
      if (this.phase === 1 && pct < 0.66) { this.phase = 2; this.setState('phaseShift'); g.onZekeriahPhase(2); }
      else if (this.phase === 2 && pct < 0.33) { this.phase = 3; this.setState('phaseShift'); g.onZekeriahPhase(3); }
    }
    const floorY = this.arena.y;
    const wantY = floorY + (this.phase === 3 ? 4.5 : this.hover) + Math.sin(this.time * 1.5) * 0.3;
    this.pos.y = damp(this.pos.y, wantY, 3, dt);
    const targetScale = this.phase === 3 ? 2.6 : 1;
    this.scaleNow = damp(this.scaleNow, targetScale, 1.5, dt);
    this.model.scaler.scale.setScalar(1.2 * this.scaleNow);
    this.radius = 0.8 * this.scaleNow;
    this.height = 2.4 * this.scaleNow;
    if (Math.random() < 0.4) g.smoke.spawn(this.pos.x + (Math.random() - 0.5), this.pos.y, this.pos.z + (Math.random() - 0.5), 0, -0.5, 0, { life: 1, size: 1.5 * this.scaleNow, color: [0.1, 0.03, 0.18], alpha: 0.6 });

    switch (this.state) {
      case 'intro': clip = Z_CAST; w = clamp(this.stateT, 0, 1); this.facePlayer(dt, 3); break;
      case 'idle': {
        this.facePlayer(dt, 4);
        // Drift around the arena keeping distance
        const ang = this.angleToPlayer() + Math.PI + Math.sin(this.time * 0.4) * 0.8;
        const want = this.phase === 3 ? 14 : 10;
        const tx = p.pos.x + Math.sin(ang) * want, tz = p.pos.z + Math.cos(ang) * want;
        const clampP = this.clampArena(tx, tz);
        this.moveToward(_v.set(clampP[0], 0, clampP[1]), 5, dt, 2);
        this.cd -= dt;
        if (dist < 3.5 && this.cd < 1.5) { this.setState('repulse'); break; }
        if (this.cd <= 0) {
          let atk = this.pattern[this.pi++ % this.pattern.length];
          if (this.phase >= 2 && Math.random() < 0.35) atk = 'beam';
          if (this.phase === 3 && Math.random() < 0.35) atk = 'meteors';
          this.setState(atk);
          g.audio.sfx('charge');
        }
        break;
      }
      case 'orbs': {
        clip = Z_CAST; w = clamp(this.stateT / 0.3, 0, 1);
        this.brake(dt);
        this.facePlayer(dt, 6);
        const n = this.phase === 1 ? 3 : this.phase === 2 ? 5 : 8;
        const k = Math.floor((this.stateT - 0.6) / 0.18);
        if (this.stateT > 0.6 && k < n && k !== this.lastShot) {
          this.lastShot = k;
          const tip = this.model.weaponTip.getWorldPosition(_v).clone();
          const a = this.angleToPlayer() + (k - (n - 1) / 2) * 0.35;
          const vel = new THREE.Vector3(Math.sin(a) * 12, 3, Math.cos(a) * 12);
          g.spawnProjectile(new Projectile(g, { pos: tip, vel, color: 0xb060ff, dmg: 12, radius: 0.55, size: 1.3, source: this, homing: 1.4, life: 6 }));
          g.audio.sfx('bolt');
        }
        if (this.stateT > 0.8 + n * 0.18) { this.lastShot = -1; this.endAttack(1.4); }
        break;
      }
      case 'runes': {
        clip = Z_CAST; w = clamp(this.stateT / 0.3, 0, 1);
        this.brake(dt);
        if (!this.hitThisSwing && this.stateT > 0.5) {
          this.hitThisSwing = true;
          const n = this.phase === 1 ? 5 : 8;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, r = i === 0 ? 0 : 2 + Math.random() * 8;
            const x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r;
            const cl = this.clampArena(x, z);
            g.spawnProjectile(new Eruption(g, { pos: new THREE.Vector3(cl[0], floorY, cl[1]), radius: 2.3, delay: 1.0 + i * 0.1, dmg: 18, color: 0x9a40ff, kind: 'shadow' }));
          }
        }
        if (this.stateT > 2.2) this.endAttack(1.2);
        break;
      }
      case 'meteors': {
        clip = Z_CAST; w = 1;
        this.brake(dt);
        const k = Math.floor(this.stateT / 0.25);
        if (k < 14 && k !== this.lastShot) {
          this.lastShot = k;
          const a = Math.random() * TAU, r = Math.random() * this.arena.r * 0.9;
          const x = k % 3 === 0 ? p.pos.x : this.arena.x + Math.sin(a) * r, z = k % 3 === 0 ? p.pos.z : this.arena.z + Math.cos(a) * r;
          g.spawnProjectile(new Eruption(g, { pos: new THREE.Vector3(x, floorY, z), radius: 2.6, delay: 1.0, dmg: 20, color: 0xff40a0, kind: 'shadow', height: 30 }));
        }
        if (this.stateT > 4.2) { this.lastShot = -1; this.endAttack(1.5); }
        break;
      }
      case 'beam': {
        clip = Z_THRUST; w = 1;
        this.brake(dt);
        if (!this.beamObj) {
          const dir = _v.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(12);
          const base = new THREE.Vector3(p.pos.x, floorY + 1, p.pos.z);
          this.beamObj = new SweepBeam(g, { from: () => this.model.weaponTip.getWorldPosition(new THREE.Vector3()), aimStart: base.clone().add(side), aimEnd: base.clone().sub(side), dur: 2.2, dmg: 16, color: 0xc060ff, width: 1.3, windup: 0.9 });
          g.spawnProjectile(this.beamObj);
        }
        if (this.stateT > 3.3) { this.beamObj = null; this.endAttack(1.2); }
        break;
      }
      case 'teleport': {
        if (!this.hitThisSwing) {
          this.hitThisSwing = true;
          g.fx.burst(this.chest.clone(), 40, { speed: 8, color: [1, 0.4, 1.6], life: 0.6, size: 0.7 });
          g.audio.sfx('teleport');
          const a = Math.random() * TAU;
          const cl = this.clampArena(this.arena.x + Math.sin(a) * this.arena.r * 0.7, this.arena.z + Math.cos(a) * this.arena.r * 0.7);
          this.pos.x = cl[0]; this.pos.z = cl[1];
          g.fx.burst(this.chest.clone(), 40, { speed: 8, color: [1, 0.4, 1.6], life: 0.6, size: 0.7 });
        }
        if (this.stateT > 0.6) this.endAttack(0.6);
        break;
      }
      case 'summon': {
        clip = Z_CAST; w = 1;
        this.brake(dt);
        if (!this.hitThisSwing && this.stateT > 0.8) {
          this.hitThisSwing = true;
          const groups = this.phase === 3 ? [{ type: 'wraith', n: 3, at: [this.arena.x, this.arena.z], spread: 12 }] : [{ type: 'thrall', n: 2, at: [this.arena.x, this.arena.z], spread: 10 }, { type: 'caster', n: 1, at: [this.arena.x, this.arena.z], spread: 12 }];
          if (g.enemies.filter((e) => e.alive && !e.isBoss).length < 4) g.spawnWave(groups);
        }
        if (this.stateT > 1.8) this.endAttack(1.2);
        break;
      }
      case 'repulse': {
        clip = Z_CAST; w = clamp(this.stateT / 0.5, 0, 1);
        this.brake(dt);
        this.aura.scale.setScalar(6 + this.stateT * 8);
        if (!this.hitThisSwing && this.stateT > 0.55) {
          this.hitThisSwing = true;
          this.aura.scale.setScalar(6);
          g.spawnProjectile(new Shockwave(g, { pos: new THREE.Vector3(this.pos.x, floorY, this.pos.z), maxR: 10, speed: 16, dmg: 16, color: 0xb050ff, height: 3 }));
          g.audio.sfx('explode');
          g.cameraShake(0.3);
        }
        if (this.stateT > 1.2) this.endAttack(1.0);
        break;
      }
      case 'phaseShift': {
        clip = Z_CAST; w = 1;
        this.brake(dt);
        this.invuln = true;
        if (this.stateT > 3) { this.invuln = false; this.setState('idle'); this.cd = 1; }
        break;
      }
      case 'staggered': case 'parried': {
        clip = { chest: [-0.4, 0, 0], head: [-0.4, 0, 0] }; w = 1;
        this.brake(dt, 5);
        if (this.stateT > 0.5) this.setState('idle');
        break;
      }
      case 'defeated': {
        clip = G_KNEEL; w = 1;
        this.brake(dt, 5);
        this.pos.y = damp(this.pos.y, floorY, 3, dt);
        break;
      }
    }
    idlePose(this.pose, this.time, 0.3);
    this.pose.thL = [-0.2, 0, 0.05]; this.pose.thR = [0.05, 0, -0.05]; this.pose.knL = [0.3, 0, 0]; this.pose.knR = [0.2, 0, 0];
    this.pose.shR = [-0.8, -0.2, -0.2]; this.pose.elR = [-0.8, 0, 0]; this.pose.haR = [0.3, 0, 0];
    this.pose.shL = [-0.4, 0.3, 0.3]; this.pose.elL = [-0.9, 0, 0];
    if (clip) blendInto(this.pose, clip, w);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.game.world.collide(this.pos, this.radius, this.height);
    this.updateVisual(dt, 10);
  }
  clampArena(x, z) {
    const dx = x - this.arena.x, dz = z - this.arena.z;
    const d = Math.hypot(dx, dz);
    const m = this.arena.r * 0.85;
    if (d > m) return [this.arena.x + dx / d * m, this.arena.z + dz / d * m];
    return [x, z];
  }
  endAttack(cd) { this.cd = cd * (this.phase === 3 ? 0.7 : this.phase === 2 ? 0.85 : 1); this.setState('idle'); }
}

// Shadow clone used in phase 2 — dies in one hit.
export class ZekeriahClone extends Enemy {
  constructor(game, pos, arena) {
    super(game, pos, { hp: 1, radius: 0.8, height: 2.4, glory: 5, palette: PALETTES.wizard, name: 'Shadow of Zekeriah', flying: true });
    this.model = buildHumanoid({ palette: PALETTES.wizard, weapon: 'staff', helm: 'crown', scale: 1.2 });
    game.world.dynamic.add(this.model.root);
    this.arena = arena;
    this.cd = 1 + Math.random() * 2;
    this.state = 'idle';
  }
  update(dt) {
    this.time += dt;
    if (this.state === 'dying' || this.state === 'dead') return this.updateDying(dt);
    const g = this.game, p = g.player;
    this.facePlayer(dt, 4);
    this.pos.y = this.arena.y + 1.2 + Math.sin(this.time * 1.5) * 0.3;
    this.cd -= dt;
    if (this.cd <= 0) {
      this.cd = 2.5 + Math.random() * 2;
      const tip = this.model.weaponTip.getWorldPosition(_v).clone();
      const vel = new THREE.Vector3(p.pos.x - tip.x, p.pos.y + 1 - tip.y, p.pos.z - tip.z).normalize().multiplyScalar(13);
      g.spawnProjectile(new Projectile(g, { pos: tip, vel, color: 0xb060ff, dmg: 8, radius: 0.5, source: this, homing: 0.8 }));
    }
    idlePose(this.pose, this.time, 0.3);
    this.pose.shR = [-0.8, -0.2, -0.2]; this.pose.elR = [-0.8, 0, 0];
    this.updateVisual(dt);
  }
}

export { makeEnemy };
