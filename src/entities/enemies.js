// Enemy AI for the armies of Zerkskis. Telegraphed attacks, attack tokens, stagger & launch.
import * as THREE from 'three';
import { buildHumanoid, buildWraith, PALETTES } from './enemyModels.js';
import { emptyPose, blendInto } from './knightModel.js';
import { idlePose, runPose } from './knightPoses.js';
import { Projectile, Shockwave } from './projectiles.js';
import { clamp, damp, dampAngle, wrapAngle, TAU } from '../core/utils.js';
import { glowSprite } from '../render/materials.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Enemy {
  constructor(game, pos, cfg) {
    this.game = game;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.atan2(game.player.pos.x - pos.x, game.player.pos.z - pos.z);
    this.cfg = cfg;
    this.hp = this.maxHp = cfg.hp;
    this.radius = cfg.radius || 0.6;
    this.height = cfg.height || 2;
    this.poise = cfg.poise || 0;
    this.flying = !!cfg.flying;
    this.alive = true;
    this.state = 'spawn';
    this.stateT = 0;
    this.flashT = 0;
    this.hasToken = false;
    this.onGround = true;
    this.name = cfg.name || 'Zerk';
    this.pose = emptyPose();
    this.time = Math.random() * 10;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.decisionT = 1 + Math.random() * 1.5;
    this.hitThisSwing = false;
    this.isBoss = false;
    this.xp = cfg.glory || 10;
  }

  get chest() { return _v2.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.hitThisSwing = false;
  }

  distToPlayer() {
    const p = this.game.player.pos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }
  angleToPlayer() {
    const p = this.game.player.pos;
    return Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }
  facingPlayer(maxAngle) { return Math.abs(wrapAngle(this.angleToPlayer() - this.yaw)) < maxAngle; }

  requestToken() {
    if (this.hasToken) return true;
    const g = this.game;
    if (g.attackTokens > 0) {
      g.attackTokens--;
      this.hasToken = true;
      return true;
    }
    return false;
  }
  releaseToken() {
    if (this.hasToken) {
      this.game.attackTokens++;
      this.hasToken = false;
    }
  }

  // Ground movement & collisions
  physics(dt) {
    const w = this.game.world;
    if (!this.flying) {
      this.vel.y -= 30 * dt;
      const prevY = this.pos.y;
      this.pos.addScaledVector(this.vel, dt);
      const g = w.floorAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y) + 0.5, 1.0);
      if (this.pos.y <= g) {
        this.pos.y = g;
        if (this.vel.y < -12 && this.state === 'launched') this.game.fx.burst(this.pos, 10, { speed: 4, color: [0.5, 0.4, 0.5], life: 0.5, size: 0.8 });
        this.vel.y = 0;
        this.onGround = true;
      } else this.onGround = false;
      if (!isFinite(g) || this.pos.y < w.killY) {
        // Fell into the void.
        this.hp = 0;
        this.die(true);
        return;
      }
    } else {
      this.pos.addScaledVector(this.vel, dt);
    }
    w.collide(this.pos, this.radius * 0.8, this.height);
    // Separation from other enemies and the player.
    for (const o of this.game.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const rr = this.radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-5 && Math.abs(this.pos.y - o.pos.y) < 2) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    const p = this.game.player;
    const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
    const rr = this.radius + 0.45;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-5 && Math.abs(this.pos.y - p.pos.y) < this.height) {
      const d = Math.sqrt(d2);
      this.pos.x += (dx / d) * (rr - d);
      this.pos.z += (dz / d) * (rr - d);
    }
  }

  moveToward(target, speed, dt, accel = 10) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.x = damp(this.vel.x, (dx / d) * speed, accel, dt);
    this.vel.z = damp(this.vel.z, (dz / d) * speed, accel, dt);
  }
  brake(dt, k = 10) {
    this.vel.x = damp(this.vel.x, 0, k, dt);
    this.vel.z = damp(this.vel.z, 0, k, dt);
  }
  facePlayer(dt, rate = 8) { this.yaw = dampAngle(this.yaw, this.angleToPlayer(), rate, dt); }

  // Hit resolution from the player.
  takeHit(hit) {
    if (!this.alive || this.state === 'spawn' && this.stateT < 0.4) return false;
    if (this.invuln) return false;
    const g = this.game;
    let dmg = hit.dmg;
    const armored = this.poise > 0 && hit.power < this.poise && !['staggered', 'parried', 'launched', 'down'].includes(this.state);
    if (armored) dmg *= 0.5;
    if (this.state === 'parried') dmg *= 1.5;
    this.hp -= dmg;
    this.flashT = 0.12;
    this.lastHitDir = hit.dir ? hit.dir.clone() : new THREE.Vector3(0, 0, 1);
    g.onEnemyHit(this, hit, dmg, armored);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    if (!armored) {
      const knock = hit.knock || 3.5 * hit.power;
      if (hit.dir) { this.vel.x = hit.dir.x * knock; this.vel.z = hit.dir.z * knock; }
      if (hit.launch && !this.flying && !this.isBoss) {
        this.vel.y = hit.launch;
        this.releaseToken();
        this.setState('launched');
      } else if (this.state !== 'parried' || hit.power > 1.5) {
        this.releaseToken();
        this.setState('staggered');
        this.staggerDur = 0.28 + hit.power * 0.12;
      }
    } else {
      g.audio.sfx('clang');
    }
    return true;
  }

  parried() {
    this.releaseToken();
    this.setState('parried');
    this.vel.set(-Math.sin(this.yaw) * 4, 0, -Math.cos(this.yaw) * 4);
  }

  die(silent = false) {
    if (this.state === 'dying' || this.state === 'dead') return;
    this.releaseToken();
    this.setState('dying');
    this.alive = false;
    this.game.onEnemyKilled(this, silent);
  }

  // Shared visual update: flash, rig pose.
  updateVisual(dt, lambda = 16) {
    const m = this.model;
    if (this.flashT > 0) this.flashT -= dt;
    const f = this.flashT > 0 ? 1 : 0;
    if (m.M && m.M.armor) {
      m.M.armor.emissive.setScalar(f * 0.9);
      m.M.skin.emissive.setScalar(f * 0.9);
      m.M.cloth.emissive.setScalar(f * 0.6);
    }
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    if (m.rig) m.rig.apply(this.pose, dt, lambda);
  }

  // Death: collapse, then shatter into violet shards and release a soul of light.
  updateDying(dt) {
    this.stateT += dt;
    const g = this.game;
    this.brake(dt, 4);
    if (!this.flying) this.physics(dt);
    else { this.pos.addScaledVector(this.vel, dt); this.vel.y -= 12 * dt; }
    if (this.pose.body) {
      const k = clamp(this.stateT / 0.6, 0, 1);
      this.pose.body[0] = -1.3 * k;
      this.pose.bodyPos[1] = -0.3 * k;
      this.pose.chest[0] = -0.4 * k;
    }
    this.updateVisual(dt, 10);
    const s = 1 - clamp((this.stateT - 0.55) / 0.3, 0, 1);
    if (this.stateT > 0.55 && !this.shattered) {
      this.shattered = true;
      const c = this.chest.clone();
      const col = new THREE.Color(this.cfg.palette ? this.cfg.palette.eye : 0xb070ff);
      g.fx.burst(c, 30, { speed: 7, color: [col.r * 1.4, col.g * 1.4, col.b * 1.4], life: 0.8, size: 0.5, gravity: 4 });
      g.smoke.burst(c, 10, { speed: 2.5, color: [0.08, 0.05, 0.1], life: 1.2, size: 2.2, alpha: 0.7, drag: 2 });
      g.releaseSoul(c);
    }
    this.model.root.scale.setScalar(Math.max(0.001, s * (this.baseScale || 1)));
    if (this.stateT > 0.9) {
      this.state = 'dead';
      g.world.dynamic.remove(this.model.root);
    }
  }

  dispose() {
    this.game.world.dynamic.remove(this.model.root);
  }
}

// ---------------------------------------------------------------------------- THRALL
const THRALL_WINDUP = { chest: [-0.15, -0.6, 0], spine: [0, -0.2, 0], shR: [-2.7, -0.7, 0], elR: [-0.9, 0, 0], haR: [1.2, 0, 0], shL: [-0.8, 0.5, 0.4], elL: [-0.6, 0, 0], thL: [-0.4, 0, 0.1], knL: [0.5, 0, 0], thR: [0.3, 0, -0.1], knR: [0.4, 0, 0], bodyPos: [0, -0.12, 0] };
const THRALL_STRIKE = { chest: [0.35, 0.5, 0], spine: [0.15, 0.2, 0], shR: [-0.8, 0.6, 0], elR: [-0.1, 0, 0], haR: [1.6, 0, 0], shL: [0.2, 0, 0.5], thL: [-0.7, 0, 0.1], knL: [0.6, 0, 0], thR: [0.5, 0, -0.1], knR: [0.2, 0, 0], bodyPos: [0, -0.2, 0] };
const STAGGER = { chest: [-0.45, 0.2, 0], head: [-0.4, 0, 0], spine: [-0.2, 0, 0], shR: [-0.2, -0.6, -0.7], shL: [-0.3, 0.6, 0.7], bodyPos: [0, -0.05, 0] };
const LAUNCHED = { body: [-0.8, 0, 0], chest: [-0.4, 0, 0], head: [-0.4, 0, 0], shR: [-2.2, -0.6, 0], shL: [-2.2, 0.6, 0], thL: [-0.8, 0, 0], knL: [1.2, 0, 0], thR: [-0.3, 0, 0], knR: [0.8, 0, 0] };
const DOWN = { body: [-1.5, 0, 0], bodyPos: [0, -0.6, -0.2], chest: [-0.1, 0, 0], shR: [-2.5, -0.4, 0], shL: [-2.5, 0.4, 0], thL: [-0.2, 0, 0.1], knL: [0.3, 0, 0], thR: [0.1, 0, 0], knR: [0.2, 0, 0] };

export class Thrall extends Enemy {
  constructor(game, pos, opts = {}) {
    const elite = !!opts.elite;
    super(game, pos, {
      hp: elite ? 260 : 60, radius: 0.55, height: 2.1, poise: elite ? 1.3 : 0, glory: elite ? 30 : 10,
      palette: elite ? PALETTES.elite : PALETTES.zerk, name: elite ? (opts.name || 'Zerk Captain') : 'Zerk Thrall',
    });
    this.elite = elite;
    this.speed = elite ? 5.2 : 4.4;
    this.dmg = elite ? 18 : 11;
    this.windup = elite ? 0.45 : 0.62;
    this.baseScale = elite ? 1.25 : 1;
    this.model = buildHumanoid({ palette: this.cfg.palette, weapon: 'blade', helm: 'horned', bulk: elite ? 1.15 : 1 });
    this.model.root.scale.setScalar(0.001);
    game.world.dynamic.add(this.model.root);
    this.combo = 0;
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'dying' || this.state === 'dead') return this.updateDying(dt);
    this.stateT += dt;
    const g = this.game, p = g.player;
    const dist = this.distToPlayer();
    const pose = this.pose;
    const combatStance = dist < 9 ? 1 : 0;
    let clip = null, w = 0;
    const eyes = this.model.eyeGlow;
    eyes.material.opacity = 0.6;

    switch (this.state) {
      case 'spawn': {
        const k = clamp(this.stateT / 0.9, 0, 1);
        this.model.root.scale.setScalar(Math.max(0.001, k * this.baseScale));
        if (Math.random() < 0.5) g.smoke.burst(this.pos, 1, { speed: 1.5, color: [0.12, 0.04, 0.18], life: 1, size: 2, alpha: 0.6, dir: UP, spread: 0.6 });
        this.facePlayer(dt);
        if (k >= 1) this.setState('approach');
        break;
      }
      case 'approach': {
        this.facePlayer(dt, 10);
        if (dist > 4.2) this.moveToward(p.pos, this.speed, dt);
        else this.setState('circle');
        break;
      }
      case 'circle': {
        this.facePlayer(dt, 10);
        const ang = this.angleToPlayer() + Math.PI;
        const want = 4.2;
        const tx = p.pos.x + Math.sin(ang + this.strafeDir * 0.6) * want;
        const tz = p.pos.z + Math.cos(ang + this.strafeDir * 0.6) * want;
        this.moveToward(_v.set(tx, 0, tz), this.speed * 0.45, dt, 5);
        this.decisionT -= dt;
        if (dist > 8) this.setState('approach');
        else if (this.decisionT <= 0) {
          this.decisionT = 0.6 + Math.random() * 1.6;
          if (Math.random() < 0.25) this.strafeDir *= -1;
          if (this.requestToken()) this.setState('engage');
        }
        break;
      }
      case 'engage': {
        this.facePlayer(dt, 12);
        if (dist > 2.3) this.moveToward(p.pos, this.speed * 1.25, dt);
        else { this.brake(dt); this.setState('windup'); g.audio.sfx('guard'); }
        if (this.stateT > 3) { this.releaseToken(); this.setState('circle'); }
        break;
      }
      case 'windup': {
        this.facePlayer(dt, 6);
        this.brake(dt);
        clip = THRALL_WINDUP;
        w = clamp(this.stateT / this.windup, 0, 1);
        eyes.material.opacity = 1;
        eyes.scale.setScalar(0.5 + w * 1.4);
        if (this.stateT >= this.windup) {
          this.setState('strike');
          this.vel.x = Math.sin(this.yaw) * 9;
          this.vel.z = Math.cos(this.yaw) * 9;
          g.audio.sfx('swing', { power: 0.8 });
        }
        break;
      }
      case 'strike': {
        clip = THRALL_STRIKE;
        w = 1;
        this.brake(dt, 6);
        eyes.scale.setScalar(0.5);
        if (!this.hitThisSwing && this.stateT > 0.06) {
          this.hitThisSwing = true;
          if (dist < 2.8 && this.facingPlayer(1.1) && Math.abs(p.pos.y - this.pos.y) < 2) {
            const r = p.receiveAttack({ dmg: this.dmg, source: this, pos: this.chest.clone(), kind: 'melee', parryable: true, knock: 5 });
            if (r === 'parried') return;
          }
        }
        if (this.stateT > 0.25) {
          if (this.elite && this.combo < 1) {
            this.combo++;
            this.setState('windup');
            this.stateT = this.windup * 0.45;
          } else {
            this.combo = 0;
            this.setState('recover');
          }
        }
        break;
      }
      case 'recover': {
        clip = THRALL_STRIKE;
        w = 1 - clamp(this.stateT / 0.5, 0, 1);
        this.brake(dt);
        if (this.stateT > (this.elite ? 0.5 : 0.75)) { this.releaseToken(); this.setState('circle'); }
        break;
      }
      case 'staggered': {
        clip = STAGGER;
        w = 1 - clamp((this.stateT - this.staggerDur * 0.5) / this.staggerDur, 0, 1);
        this.brake(dt, 5);
        if (this.stateT > this.staggerDur) this.setState('circle');
        break;
      }
      case 'parried': {
        clip = STAGGER;
        w = 1;
        eyes.material.opacity = 0.2;
        this.brake(dt, 4);
        if (this.stateT > 1.3) this.setState('circle');
        break;
      }
      case 'launched': {
        clip = LAUNCHED;
        w = 1;
        if (this.onGround && this.stateT > 0.15) { this.setState('down'); this.brake(dt, 20); }
        break;
      }
      case 'down': {
        clip = DOWN;
        w = 1 - clamp((this.stateT - 0.7) / 0.35, 0, 1);
        this.brake(dt, 8);
        if (this.stateT > 1.05) this.setState('circle');
        break;
      }
    }

    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.8 && ['approach', 'circle', 'engage'].includes(this.state)) {
      this.phase = (this.phase || 0) + dt * moving * 1.6;
      runPose(pose, this.phase, clamp(moving / 7, 0, 1), this.time);
      pose.shR = [-0.5, -0.3, -0.3]; pose.elR = [-0.6, 0, 0]; pose.haR = [1.3, 0, 0];
    } else {
      idlePose(pose, this.time, combatStance);
      pose.shR = [-0.6, -0.2, -0.25]; pose.elR = [-0.7, 0, 0]; pose.haR = [1.2, 0, 0];
    }
    if (clip) blendInto(pose, clip, w);
    this.physics(dt);
    this.updateVisual(dt, this.state === 'strike' ? 30 : 14);
  }
}

// ---------------------------------------------------------------------------- CASTER
const CAST_POSE = { shL: [-1.8, 0.2, 0.2], elL: [-0.2, 0, 0], chest: [-0.1, 0.3, 0], shR: [-0.4, -0.4, -0.4], head: [-0.1, 0, 0] };

export class Caster extends Enemy {
  constructor(game, pos) {
    super(game, pos, { hp: 45, radius: 0.5, height: 2.0, glory: 12, palette: PALETTES.caster, name: 'Shade Caster' });
    this.model = buildHumanoid({ palette: PALETTES.caster, weapon: 'orb', helm: 'hood', bulk: 0.9, cape: true });
    this.model.root.scale.setScalar(0.001);
    game.world.dynamic.add(this.model.root);
    this.castCd = 1.5 + Math.random() * 2;
    this.blinkCd = 0;
  }
  update(dt) {
    this.time += dt;
    if (this.state === 'dying' || this.state === 'dead') return this.updateDying(dt);
    this.stateT += dt;
    const g = this.game, p = g.player;
    const dist = this.distToPlayer();
    this.blinkCd -= dt;
    let clip = null, w = 0;
    switch (this.state) {
      case 'spawn': {
        const k = clamp(this.stateT / 0.8, 0, 1);
        this.model.root.scale.setScalar(Math.max(0.001, k));
        if (k >= 1) this.setState('keepaway');
        break;
      }
      case 'keepaway': {
        this.facePlayer(dt, 8);
        const want = 13;
        const ang = this.angleToPlayer();
        if (dist < want - 3) this.moveToward(_v.set(this.pos.x - Math.sin(ang) * 5, 0, this.pos.z - Math.cos(ang) * 5), 3.6, dt);
        else if (dist > want + 5) this.moveToward(p.pos, 3.6, dt);
        else {
          const sa = ang + Math.PI / 2 * this.strafeDir;
          this.moveToward(_v.set(this.pos.x + Math.sin(sa) * 3, 0, this.pos.z + Math.cos(sa) * 3), 2, dt, 4);
        }
        this.castCd -= dt;
        if (dist < 4.5 && this.blinkCd <= 0) this.blink();
        else if (this.castCd <= 0 && dist < 30) this.setState('cast');
        break;
      }
      case 'cast': {
        this.facePlayer(dt, 10);
        this.brake(dt);
        clip = CAST_POSE;
        w = clamp(this.stateT / 0.3, 0, 1);
        const orb = this.model.weaponTip;
        if (Math.random() < 0.6) {
          orb.getWorldPosition(_v);
          g.fx.spawn(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, { life: 0.4, size: 0.4, color: [0.3, 1.4, 1.3] });
        }
        if (this.stateT > 0.85) {
          orb.getWorldPosition(_v);
          const tgt = _v2.set(p.pos.x + p.vel.x * 0.35, p.pos.y + 1.1, p.pos.z + p.vel.z * 0.35);
          const vel = tgt.clone().sub(_v).normalize().multiplyScalar(17);
          g.spawnProjectile(new Projectile(g, { pos: _v, vel, color: 0x40ffe0, dmg: 10, radius: 0.45, source: this, homing: 0.4 }));
          g.audio.sfx('bolt');
          this.castCd = 2.2 + Math.random() * 2;
          this.setState('keepaway');
        }
        break;
      }
      case 'staggered': case 'parried': {
        clip = STAGGER; w = 1;
        this.brake(dt, 5);
        if (this.stateT > (this.staggerDur || 0.5)) this.setState('keepaway');
        break;
      }
      case 'launched': {
        clip = LAUNCHED; w = 1;
        if (this.onGround && this.stateT > 0.15) this.setState('down');
        break;
      }
      case 'down': {
        clip = DOWN; w = 1 - clamp((this.stateT - 0.7) / 0.3, 0, 1);
        this.brake(dt, 8);
        if (this.stateT > 1) { if (this.blinkCd <= 0) this.blink(); else this.setState('keepaway'); }
        break;
      }
    }
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.8 && this.state === 'keepaway') {
      this.phase = (this.phase || 0) + dt * moving * 1.7;
      runPose(this.pose, this.phase, 0.3, this.time);
    } else idlePose(this.pose, this.time, 0.5);
    this.pose.shL = this.pose.shL || [0, 0, 0];
    if (!clip) { this.pose.shL = [-0.9, 0.3, 0.3]; this.pose.elL = [-0.9, 0, 0]; }
    if (clip) blendInto(this.pose, clip, w);
    this.physics(dt);
    this.updateVisual(dt);
  }
  blink() {
    const g = this.game;
    g.fx.burst(this.chest.clone(), 25, { speed: 6, color: [0.3, 1.3, 1.2], life: 0.5, size: 0.5 });
    g.audio.sfx('teleport');
    const ang = this.angleToPlayer() + Math.PI + (Math.random() - 0.5) * 1.5;
    for (let i = 0; i < 6; i++) {
      const d = 10 + Math.random() * 5;
      const nx = g.player.pos.x + Math.sin(ang + i * 0.5) * d, nz = g.player.pos.z + Math.cos(ang + i * 0.5) * d;
      const gy = g.world.surfaceAt(nx, nz);
      if (isFinite(gy) && Math.abs(gy - this.pos.y) < 6) {
        this.pos.set(nx, gy, nz);
        break;
      }
    }
    g.fx.burst(this.chest.clone(), 25, { speed: 6, color: [0.3, 1.3, 1.2], life: 0.5, size: 0.5 });
    this.blinkCd = 5;
    this.setState('keepaway');
  }
}

// ---------------------------------------------------------------------------- BRUTE
const BRUTE_RAISE = { chest: [-0.35, 0, 0], spine: [-0.15, 0, 0], shR: [-3.0, 0, 0.2], elR: [-0.4, 0, 0], haR: [1.2, 0, 0], shL: [-2.9, 0, -0.2], elL: [-0.5, 0, 0], bodyPos: [0, 0.1, 0] };
const BRUTE_SLAM = { chest: [0.55, 0, 0], spine: [0.35, 0, 0], shR: [-0.7, 0, 0], elR: [0, 0, 0], haR: [1.57, 0, 0], shL: [-0.7, 0, 0], elL: [0, 0, 0], thL: [-0.8, 0, 0.2], knL: [1, 0, 0], thR: [0.4, 0, -0.2], knR: [0.8, 0, 0], bodyPos: [0, -0.35, 0] };
const BRUTE_SWEEP0 = { chest: [0, -1.1, 0], spine: [0, -0.4, 0], shR: [-1.4, -2.0, 0], elR: [-0.3, 0, 0], haR: [1.5, 0, 0] };
const BRUTE_SWEEP1 = { chest: [0.1, 1.1, 0], spine: [0, 0.4, 0], shR: [-1.5, 1.2, 0], elR: [0, 0, 0], haR: [1.57, 0, 0] };

export class Brute extends Enemy {
  constructor(game, pos, opts = {}) {
    const big = opts.scale || 1.55;
    super(game, pos, {
      hp: opts.hp || 280, radius: 0.9 * big, height: 2.2 * big, poise: 1.55, glory: 30, palette: opts.palette || PALETTES.brute,
      name: opts.name || 'Obsidian Brute',
    });
    this.baseScale = 1;
    this.big = big;
    this.model = buildHumanoid({ palette: this.cfg.palette, weapon: 'hammer', helm: 'horned', bulk: 1.35, scale: big });
    this.model.root.scale.setScalar(0.001);
    game.world.dynamic.add(this.model.root);
    this.speed = 3.1;
    this.attackCd = 1.5;
  }
  update(dt) {
    this.time += dt;
    if (this.state === 'dying' || this.state === 'dead') return this.updateDying(dt);
    this.stateT += dt;
    const g = this.game, p = g.player;
    const dist = this.distToPlayer();
    let clip = null, w = 0;
    const eyes = this.model.eyeGlow;
    switch (this.state) {
      case 'spawn': {
        const k = clamp(this.stateT / 1.0, 0, 1);
        this.model.root.scale.setScalar(Math.max(0.001, k));
        if (k >= 1) { this.setState('approach'); g.audio.sfx('roar'); }
        break;
      }
      case 'approach': {
        this.facePlayer(dt, 4);
        this.attackCd -= dt;
        if (dist > 3.2 * this.big * 0.8) this.moveToward(p.pos, this.speed, dt, 4);
        else this.brake(dt);
        if (this.attackCd <= 0 && dist < 5.5 * this.big * 0.75 && this.requestToken()) {
          this.setState(Math.random() < 0.55 ? 'raise' : 'sweepWind');
          g.audio.sfx('charge');
        }
        break;
      }
      case 'raise': {
        this.facePlayer(dt, 3);
        this.brake(dt);
        clip = BRUTE_RAISE;
        w = clamp(this.stateT / 0.6, 0, 1);
        eyes.scale.setScalar(0.5 + w * 1.5);
        if (this.stateT > 1.0) { this.setState('slam'); g.audio.sfx('swing', { power: 1.5 }); }
        break;
      }
      case 'slam': {
        clip = BRUTE_SLAM;
        w = clamp(this.stateT / 0.12, 0, 1);
        if (!this.hitThisSwing && this.stateT > 0.12) {
          this.hitThisSwing = true;
          const tip = this.model.weaponTip.getWorldPosition(_v).clone();
          tip.y = this.pos.y;
          g.spawnProjectile(new Shockwave(g, { pos: tip, maxR: 9, speed: 13, dmg: 18, color: 0xff6030 }));
          g.fx.burst(tip, 30, { speed: 9, color: [1.6, 0.6, 0.3], life: 0.6, size: 0.8, gravity: 10, dir: UP, spread: 0.9 });
          g.smoke.burst(tip, 10, { speed: 4, color: [0.2, 0.15, 0.15], life: 1.2, size: 3, alpha: 0.6 });
          g.audio.sfx('impact');
          g.cameraShake(0.35, tip);
          if (Math.hypot(p.pos.x - tip.x, p.pos.z - tip.z) < 2.2 && p.pos.y - this.pos.y < 2) {
            p.receiveAttack({ dmg: 26, source: this, pos: tip, kind: 'melee', parryable: false, knock: 9 });
          }
        }
        if (this.stateT > 1.0) { this.releaseToken(); this.attackCd = 1.6 + Math.random(); this.setState('approach'); }
        break;
      }
      case 'sweepWind': {
        this.facePlayer(dt, 5);
        this.brake(dt);
        clip = BRUTE_SWEEP0;
        w = clamp(this.stateT / 0.5, 0, 1);
        eyes.scale.setScalar(0.5 + w * 1.5);
        if (this.stateT > 0.75) { this.setState('sweep'); g.audio.sfx('swing', { power: 1.4 }); }
        break;
      }
      case 'sweep': {
        clip = BRUTE_SWEEP1;
        w = clamp(this.stateT / 0.18, 0, 1);
        this.pose.chest && (clip = { ...BRUTE_SWEEP0 });
        clip = w < 1 ? BRUTE_SWEEP1 : BRUTE_SWEEP1;
        if (!this.hitThisSwing && this.stateT > 0.1) {
          this.hitThisSwing = true;
          if (dist < 4.2 * this.big * 0.75 && this.facingPlayer(1.6) && p.pos.y - this.pos.y < 2.5) {
            p.receiveAttack({ dmg: 20, source: this, pos: this.chest.clone(), kind: 'melee', parryable: true, knock: 12 });
          }
        }
        if (this.stateT > 0.8) { this.releaseToken(); this.attackCd = 1.4 + Math.random(); this.setState('approach'); }
        break;
      }
      case 'staggered': case 'parried': {
        clip = STAGGER; w = 1;
        this.brake(dt, 5);
        if (this.stateT > (this.state === 'parried' ? 1.6 : 0.8)) this.setState('approach');
        break;
      }
      case 'launched': case 'down': {
        clip = STAGGER; w = 1;
        this.brake(dt, 5);
        if (this.stateT > 1) this.setState('approach');
        break;
      }
    }
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.5 && this.state === 'approach') {
      this.phase = (this.phase || 0) + dt * moving * 1.3;
      runPose(this.pose, this.phase, 0.25, this.time);
      this.pose.shR = [-0.3, -0.2, -0.3]; this.pose.elR = [-0.5, 0, 0]; this.pose.haR = [1.9, 0, 0];
    } else {
      idlePose(this.pose, this.time, 1);
      this.pose.shR = [-0.3, -0.2, -0.3]; this.pose.elR = [-0.5, 0, 0]; this.pose.haR = [1.9, 0, 0];
    }
    if (clip) blendInto(this.pose, clip, w);
    this.physics(dt);
    this.updateVisual(dt, this.state === 'slam' || this.state === 'sweep' ? 22 : 10);
  }
}

// ---------------------------------------------------------------------------- WRAITH
export class Wraith extends Enemy {
  constructor(game, pos) {
    super(game, pos, { hp: 40, radius: 0.6, height: 1.6, flying: true, glory: 12, palette: PALETTES.zerk, name: 'Wraith' });
    this.model = buildWraith();
    this.model.root.scale.setScalar(0.001);
    game.world.dynamic.add(this.model.root);
    this.orbitA = Math.random() * TAU;
    this.attackCd = 2 + Math.random() * 2;
    this.alt = 4 + Math.random() * 3;
  }
  update(dt) {
    this.time += dt;
    if (this.state === 'dying' || this.state === 'dead') {
      if (this.state === 'dying') {
        this.stateT += dt;
        this.pos.addScaledVector(this.vel, dt);
        this.vel.y -= 10 * dt;
        this.model.root.position.copy(this.pos);
        this.model.root.rotation.x += dt * 4;
        if (this.stateT > 0.5 && !this.shattered) {
          this.shattered = true;
          this.game.fx.burst(this.chest.clone(), 30, { speed: 7, color: [1.2, 0.5, 1.6], life: 0.8, size: 0.5 });
          this.game.releaseSoul(this.chest.clone());
        }
        this.model.root.scale.setScalar(Math.max(0.001, 1 - clamp((this.stateT - 0.5) / 0.3, 0, 1)));
        if (this.stateT > 0.8) { this.state = 'dead'; this.game.world.dynamic.remove(this.model.root); }
      }
      return;
    }
    this.stateT += dt;
    const g = this.game, p = g.player;
    const m = this.model;
    const ground = g.world.surfaceAt(p.pos.x, p.pos.z);
    const baseY = Math.max(isFinite(ground) ? ground : p.pos.y, p.pos.y) + this.alt;
    switch (this.state) {
      case 'spawn': {
        const k = clamp(this.stateT / 0.7, 0, 1);
        m.root.scale.setScalar(Math.max(0.001, k));
        if (k >= 1) this.setState('orbit');
        break;
      }
      case 'orbit': {
        this.orbitA += dt * 0.6;
        const tx = p.pos.x + Math.sin(this.orbitA) * 8, tz = p.pos.z + Math.cos(this.orbitA) * 8;
        const ty = baseY + Math.sin(this.time * 2) * 0.8;
        this.vel.x = damp(this.vel.x, (tx - this.pos.x) * 1.5, 3, dt);
        this.vel.z = damp(this.vel.z, (tz - this.pos.z) * 1.5, 3, dt);
        this.vel.y = damp(this.vel.y, (ty - this.pos.y) * 1.5, 3, dt);
        this.facePlayer(dt, 6);
        this.attackCd -= dt;
        if (this.attackCd <= 0 && this.requestToken()) { this.setState('screech'); g.audio.sfx('roar'); }
        break;
      }
      case 'screech': {
        this.facePlayer(dt, 10);
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        m.eyeGlow.scale.setScalar(0.8 + this.stateT * 3);
        this.pos.y += Math.sin(this.stateT * 30) * 0.02;
        if (this.stateT > 0.6) {
          const tgt = _v.set(p.pos.x, p.pos.y + 1, p.pos.z);
          this.vel.copy(tgt.sub(this.pos).normalize().multiplyScalar(22));
          this.setState('swoop');
          g.audio.sfx('dash');
        }
        break;
      }
      case 'swoop': {
        m.eyeGlow.scale.setScalar(0.8);
        const d = _v.set(p.pos.x, p.pos.y + 1, p.pos.z).distanceTo(this.pos);
        if (!this.hitThisSwing && d < 1.6) {
          this.hitThisSwing = true;
          p.receiveAttack({ dmg: 10, source: this, pos: this.pos.clone(), kind: 'melee', parryable: true, knock: 7 });
        }
        if (this.stateT > 0.7) { this.releaseToken(); this.attackCd = 2.5 + Math.random() * 2; this.setState('orbit'); }
        break;
      }
      case 'staggered': case 'parried': case 'launched': case 'down': {
        this.vel.multiplyScalar(Math.exp(-3 * dt));
        if (this.stateT > 0.6) this.setState('orbit');
        break;
      }
    }
    // Don't clip into ground.
    const gy = g.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 0);
    if (isFinite(gy) && this.pos.y < gy + 0.8) { this.pos.y = gy + 0.8; this.vel.y = Math.max(0, this.vel.y); }
    this.pos.addScaledVector(this.vel, dt);
    this.flashT -= dt;
    const f = this.flashT > 0 ? 1 : 0;
    m.M.cloth.emissive.setScalar(f * 0.8);
    m.M.skin.emissive.setScalar(f * 0.8);
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    const sway = Math.sin(this.time * 3);
    m.body.rotation.x = this.state === 'swoop' ? 0.9 : 0.1 + sway * 0.05;
    m.body.position.y = Math.sin(this.time * 2.2) * 0.1;
    m.cloak.rotation.y = this.time * 0.8;
    m.arms[0].rotation.x = this.state === 'screech' ? -2.4 : -0.3 + sway * 0.2;
    m.arms[1].rotation.x = this.state === 'screech' ? -2.4 : -0.3 - sway * 0.2;
    if (Math.random() < 0.3) g.smoke.spawn(this.pos.x, this.pos.y - 0.4, this.pos.z, 0, -0.5, 0, { life: 0.8, size: 1.2, color: [0.1, 0.04, 0.14], alpha: 0.5 });
  }
}

export const ENEMY_TYPES = { thrall: Thrall, caster: Caster, brute: Brute, wraith: Wraith };

export function makeEnemy(game, type, pos, opts) {
  if (type === 'elite') return new Thrall(game, pos, { elite: true, ...opts });
  const C = ENEMY_TYPES[type];
  return new C(game, pos, opts);
}

export { glowSprite };
