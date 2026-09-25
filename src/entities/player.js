// Valkimsmor — controller, combat, flight and procedural animation.
import * as THREE from 'three';
import { buildKnight, emptyPose, sampleClip, blendInto, updateCape } from './knightModel.js';
import { CLIPS, idlePose, runPose, airPose, glidePose, kneelPose, heroPose, flyPose, flapWings, WING } from './knightPoses.js';
import { Trail } from '../render/trail.js';
import { Shockwave, Eruption } from './projectiles.js';
import { clamp, damp, dampAngle, wrapAngle, Ease } from '../core/utils.js';
import { glowMaterial } from '../render/materials.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(game) {
    this.game = game;
    this.model = buildKnight();
    this.trail = new Trail(24, 0xfff2c8, 0x7ab8ff);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.state = 'ground';
    this.action = null;
    this.pose = emptyPose();
    this.time = 0;
    this.phase = 0;
    this.flapPhase = 0;
    this.flapAmp = 0;
    this.speed = 0;
    this.runTime = 0;
    this.sprinting = false;
    this.invuln = 0;
    this.dashCd = 0;
    this.comboStep = 0;
    this.comboResetT = 0;
    this.bufferedAttack = false;
    this.riposteT = 0;
    this.glory = 0;
    this.stamina = 2;
    this.airDashes = 1;
    this.lastSafe = new THREE.Vector3();
    this.safeT = 0;
    this.scripted = null;
    this.dead = false;
    this.hurtFlash = 0;
    this.landDip = 0;
    this.revived = false;
    this.bank = 0;
    this.stepAcc = 0;
    this.upgrades = {};
    this.featherBonus = 0;
    this.recalcStats(true);

    // Halo of Glory
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 40), glowMaterial(0xffd27a, 0));
    halo.position.set(0, 0.2, -0.22);
    this.model.joints.head.add(halo);
    this.halo = halo;
  }

  get root() { return this.model.root; }

  recalcStats(fill = false) {
    const u = this.upgrades;
    this.maxHp = 100 + (u.breastplate ? 40 : 0) + this.featherBonus * 10;
    this.maxStamina = 2 + this.featherBonus;
    this.maxAirDashes = u.shoes ? 2 : 1;
    this.parryWindow = u.shield ? 0.26 : 0.17;
    this.gloryMult = u.belt ? 1.5 : 1;
    this.runSpeed = 8.6;
    this.sprintSpeed = u.shoes ? 13.5 : 12;
    if (fill) this.hp = this.maxHp;
    this.hp = Math.min(this.hp ?? this.maxHp, this.maxHp);
    this.stamina = Math.min(this.stamina, this.maxStamina);
  }

  spawn(pos, yaw = 0) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.lastSafe.copy(pos);
    this.action = null;
    this.dead = false;
    this.state = 'ground';
    this.invuln = 1;
    this.model.root.position.copy(pos);
    this.model.root.rotation.y = yaw;
    idlePose(this.pose, 0, 0);
    this.model.rig.snap(this.pose);
    this.trail.reset(this.pos, this.pos);
  }

  addGlory(n) { this.glory = Math.min(100, this.glory + n * this.gloryMult); }

  // ------------------------------------------------------------------ main update
  update(dt, input, camYaw, controls = true) {
    const g = this.game;
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.riposteT = Math.max(0, this.riposteT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.comboResetT -= dt;
    if (this.comboResetT <= 0) this.comboStep = 0;

    if (this.scripted) return this.updateScripted(dt);
    if (this.dead) return this.updateDead(dt);

    // Input direction relative to camera
    let mx = 0, my = 0;
    if (controls) { mx = input.moveX; my = input.moveY; }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    const wx = fx * my + rx * mx, wz = fz * my + rz * mx;
    const wantMove = Math.min(1, Math.hypot(wx, wz));
    const moveDir = _v2.set(wx, 0, wz);
    if (wantMove > 0.01) moveDir.normalize();

    // ---- action inputs
    if (controls) this.handleActions(input, moveDir, wantMove);

    // ---- physics per state
    const a = this.action;
    const w = g.world;
    if (a) this.updateAction(dt, moveDir, wantMove, input);
    else this.updateLocomotion(dt, moveDir, wantMove, input, controls);

    // Gravity (actions may override)
    if (!this.onGround && !(a && a.noGravity)) {
      let grav = 28;
      if (this.state === 'glide') grav = 0;
      if (a && a.hover) grav = 6;
      this.vel.y -= grav * dt;
    }
    // Updrafts
    this.inUpdraft = false;
    if (w.updrafts) {
      for (const u of w.updrafts) {
        const dx = this.pos.x - u.x, dz = this.pos.z - u.z;
        if (dx * dx + dz * dz < u.r * u.r && this.pos.y < u.top && this.pos.y > u.bottom - 2) {
          this.inUpdraft = true;
          if (this.state === 'glide') this.vel.y = Math.min(14, this.vel.y + u.strength * dt);
          else if (!this.onGround) this.vel.y = Math.min(8, this.vel.y + u.strength * 0.5 * dt);
        }
      }
    }

    // Integrate
    this.pos.addScaledVector(this.vel, dt);
    // Ceiling
    const ceil = w.ceilingAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y + 2 > ceil) { this.pos.y = ceil - 2; this.vel.y = Math.min(0, this.vel.y); }
    w.collide(this.pos, 0.45, 2);

    // Ground
    const gy = w.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1, this.onGround ? 0.9 : 0.25);
    const wasGround = this.onGround;
    if (this.pos.y <= gy + 0.02 && this.vel.y <= 0.01) {
      if (!wasGround) this.land(-this.vel.y);
      this.pos.y = gy;
      this.vel.y = 0;
      this.onGround = true;
    } else if (wasGround && this.vel.y <= 0 && this.pos.y - gy < 0.6 && isFinite(gy)) {
      // Stick to slopes / small steps down.
      this.pos.y = gy;
      this.vel.y = 0;
    } else {
      this.onGround = false;
    }
    if (this.onGround) {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 4);
      this.airDashes = this.maxAirDashes;
      this.safeT += dt;
      if (this.safeT > 0.4 && !this.action) { this.lastSafe.copy(this.pos); this.safeT = 0; }
    } else this.safeT = 0;
    if (this.pos.y < w.killY) this.fellIntoVoid();

    // Facing
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.animate(dt, moveDir, wantMove);
  }

  handleActions(input, moveDir, wantMove) {
    const a = this.action;
    const g = this.game;
    const busy = a && (a.type === 'judgment' || a.type === 'dive' || a.type === 'hurt' && a.t < 0.25);

    if (input.specialPressed && this.glory >= 100 && !busy) return this.startJudgment();

    if (input.dashPressed && this.dashCd <= 0 && !busy && (this.onGround || this.airDashes > 0)) {
      return this.startDash(wantMove > 0.1 ? moveDir : _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)));
    }
    if (input.parryPressed && !busy && (!a || a.type !== 'parry' || a.t > 0.3)) return this.startParry();

    if (input.jumpPressed && !busy) {
      if (this.onGround && (!a || a.type !== 'attack' || a.t > a.clip.hit[1])) {
        this.action = null;
        this.vel.y = 11;
        this.onGround = false;
        this.state = 'air';
        g.audio.sfx('jump');
        g.fx.burst(this.pos, 8, { speed: 3, color: [1, 0.95, 0.8], life: 0.4, size: 0.4 });
        return;
      } else if (!this.onGround && this.stamina >= 1 && (!a || a.type !== 'attack')) {
        this.stamina -= 1;
        this.vel.y = Math.max(this.vel.y, 10);
        this.flapPhase = -Math.PI / 2;
        this.flapAmp = 1.3;
        this.flapBoost = 0.35;
        this.action = null;
        g.audio.sfx('flap');
        this.featherBurst(10);
        return;
      }
    }

    const attackReady = !a || (a.type === 'attack' && a.t > a.clip.combo) || a.type === 'parry' && a.t > 0.12 || a.type === 'dash' && a.t > 0.1;
    if (input.attackPressed && !busy) {
      if (a && a.type === 'attack' && !attackReady) { this.bufferedAttack = true; return; }
      if (attackReady) return this.startAttack(moveDir, wantMove);
    }
    if (this.bufferedAttack && a && a.type === 'attack' && a.t > a.clip.combo) {
      this.bufferedAttack = false;
      return this.startAttack(moveDir, wantMove);
    }
    if (input.heavyPressed && !busy && attackReady) {
      const ground = this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y, 0);
      if (!this.onGround && this.pos.y - ground > 1.8) return this.startDive();
      if (this.onGround) return this.startClip('heavy', moveDir, wantMove);
    }
  }

  // ------------------------------------------------------------------ actions
  pickTarget(dir, wantMove, maxDist = 8.5) {
    const g = this.game;
    if (g.lockTarget && g.lockTarget.alive) return g.lockTarget;
    let best = null, bestScore = Infinity;
    const fwdYaw = wantMove > 0.1 ? Math.atan2(dir.x, dir.z) : this.yaw;
    for (const e of g.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > maxDist + (e.isBoss ? 6 : 0)) continue;
      if (Math.abs(e.pos.y - this.pos.y) > 4 + e.height * 0.5) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - fwdYaw));
      if (ang > 1.4 && d > 2.5) continue;
      const score = d + ang * 3;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  startAttack(moveDir, wantMove) {
    if (this.riposteT > 0 && this.onGround) {
      this.riposteT = 0;
      return this.startClip('riposte', moveDir, wantMove);
    }
    if (!this.onGround) return this.startClip('air', moveDir, wantMove);
    const names = ['light1', 'light2', 'light3'];
    const name = names[this.comboStep % 3];
    this.comboStep = (this.comboStep + 1) % 3;
    this.comboResetT = 1.0;
    this.startClip(name, moveDir, wantMove);
  }

  startClip(name, moveDir, wantMove) {
    const clip = CLIPS[name];
    const target = this.pickTarget(moveDir, wantMove);
    let lungeSpeed = clip.lunge || 0;
    let dir;
    if (target) {
      const dx = target.pos.x - this.pos.x, dz = target.pos.z - this.pos.z;
      this.yaw = Math.atan2(dx, dz);
      const d = Math.hypot(dx, dz);
      const stop = 1.2 + target.radius;
      const lungeTime = Math.max(0.12, clip.hit[0] + 0.02);
      lungeSpeed = clamp((d - stop) / lungeTime, 0, 22);
    } else if (wantMove > 0.1) {
      this.yaw = Math.atan2(moveDir.x, moveDir.z);
    }
    dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.action = { type: 'attack', name, clip, t: 0, dir, lunge: lungeSpeed, hitSet: new Set(), target, hover: !this.onGround, fxDone: false };
    if (!this.onGround) this.vel.y = Math.max(this.vel.y, name === 'air' ? 3 : 0);
    this.bufferedAttack = false;
    const pw = clip.power || 1;
    setTimeout(() => this.game.audio.sfx('swing', { power: pw }), Math.max(0, (clip.hit[0] - 0.08) * 1000));
    if (name === 'heavy') this.game.audio.sfx('charge');
  }

  startDash(dir) {
    const g = this.game;
    if (!this.onGround) this.airDashes--;
    this.action = { type: 'dash', t: 0, dir: dir.clone().normalize(), noGravity: true };
    this.yaw = Math.atan2(dir.x, dir.z);
    this.invuln = 0.3;
    this.dashCd = 0.42;
    this.vel.y = 0;
    g.audio.sfx('dash');
    g.cameraKick(6);
    this.featherBurst(18);
  }

  startParry() {
    this.action = { type: 'parry', t: 0, clip: CLIPS.parry };
    this.game.audio.sfx('guard');
  }

  startDive() {
    const g = this.game;
    this.action = { type: 'dive', t: 0, noGravity: true, phase: 'rise' };
    this.vel.set(0, 6, 0);
    g.audio.sfx('flap');
    this.invuln = 0.4;
  }

  startJudgment() {
    const g = this.game;
    this.glory = 0;
    this.action = { type: 'judgment', t: 0, clip: CLIPS.judgment, noGravity: true, struck: false, slammed: false, startY: this.pos.y };
    this.vel.set(0, 0, 0);
    this.invuln = 2.4;
    g.audio.sfx('judgment');
    g.onJudgmentStart();
  }

  featherBurst(n) {
    const c = this.chestPos();
    this.game.fx.burst(c, n, { speed: 6, color: [1.1, 1.05, 0.9], life: 0.7, size: 0.35, drag: 3, gravity: -1 });
  }

  chestPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.4, this.pos.z); }

  updateAction(dt, moveDir, wantMove, input) {
    const a = this.action;
    const g = this.game;
    a.t += dt;
    switch (a.type) {
      case 'attack': {
        const c = a.clip;
        const lungeEnd = c.hit[0] + 0.05;
        if (a.t < lungeEnd) {
          this.vel.x = a.dir.x * a.lunge;
          this.vel.z = a.dir.z * a.lunge;
        } else {
          this.vel.x = damp(this.vel.x, 0, 12, dt);
          this.vel.z = damp(this.vel.z, 0, 12, dt);
        }
        if (a.hover && this.vel.y < 0) this.vel.y = damp(this.vel.y, -1, 8, dt);
        if (a.name === 'light3' && !this.onGround && a.t > c.hit[0] - 0.05) this.vel.y = Math.min(this.vel.y, -18);
        if (a.name === 'light3' && a.t < 0.12 && this.onGround) { this.vel.y = 7; this.onGround = false; }
        this.trail.active = a.t > c.hit[0] - 0.06 && a.t < c.hit[1] + 0.06;
        if (a.t >= c.hit[0] && a.t <= c.hit[1]) this.doHits(a);
        if (a.t >= c.hit[0] && !a.fxDone) {
          a.fxDone = true;
          if (c.slam) this.slamFx(c.name === 'heavy' ? 1.4 : 1, a.name);
        }
        if (a.t >= c.dur) { this.action = null; this.trail.active = false; }
        break;
      }
      case 'dash': {
        const sp = a.t < 0.17 ? 27 : 27 * Math.max(0, 1 - (a.t - 0.17) / 0.12);
        this.vel.x = a.dir.x * Math.max(sp, 6);
        this.vel.z = a.dir.z * Math.max(sp, 6);
        this.vel.y = 0;
        if (Math.random() < 0.8) {
          const c = this.chestPos(_v);
          g.fx.spawn(c.x + (Math.random() - 0.5), c.y + (Math.random() - 0.5), c.z + (Math.random() - 0.5), -a.dir.x * 3, 0.5, -a.dir.z * 3, { life: 0.5, size: 0.3, color: [1, 1, 0.95] });
        }
        if (a.t > 0.29) { this.action = null; this.vel.y = 0; }
        break;
      }
      case 'parry': {
        this.vel.x = damp(this.vel.x, 0, 14, dt);
        this.vel.z = damp(this.vel.z, 0, 14, dt);
        if (a.t > a.clip.dur) this.action = null;
        break;
      }
      case 'hurt': {
        this.vel.x = damp(this.vel.x, 0, 6, dt);
        this.vel.z = damp(this.vel.z, 0, 6, dt);
        if (a.t > 0.4) this.action = null;
        break;
      }
      case 'dive': {
        if (a.phase === 'rise') {
          this.vel.y = damp(this.vel.y, 0, 10, dt);
          this.vel.x = damp(this.vel.x, 0, 10, dt);
          this.vel.z = damp(this.vel.z, 0, 10, dt);
          if (a.t > 0.22) {
            a.phase = 'fall';
            const tgt = this.pickTarget(moveDir, wantMove, 14);
            if (tgt) {
              const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z;
              this.yaw = Math.atan2(dx, dz);
              const h = Math.max(1, this.pos.y - tgt.pos.y);
              const tfall = h / 40;
              this.vel.x = dx / Math.max(0.1, tfall) * 0.8;
              this.vel.z = dz / Math.max(0.1, tfall) * 0.8;
              const hs = Math.hypot(this.vel.x, this.vel.z);
              if (hs > 30) { this.vel.x *= 30 / hs; this.vel.z *= 30 / hs; }
            } else {
              this.vel.x = Math.sin(this.yaw) * 6;
              this.vel.z = Math.cos(this.yaw) * 6;
            }
            this.vel.y = -42;
            g.audio.sfx('dash');
          }
        } else if (a.phase === 'fall') {
          this.trail.active = true;
          this.vel.y = -42;
          if (Math.random() < 0.9) {
            const c = this.chestPos(_v);
            g.fx.spawn(c.x, c.y + 1, c.z, 0, 6, 0, { life: 0.4, size: 0.6, color: [1.4, 1.2, 0.7] });
          }
          if (this.onGround) {
            a.phase = 'land';
            a.t = 0;
            this.diveImpact();
          }
          if (a.t > 3) this.action = null;
        } else {
          this.trail.active = false;
          this.vel.x = 0; this.vel.z = 0;
          if (a.t > 0.45) this.action = null;
        }
        break;
      }
      case 'judgment': {
        const t = a.t;
        this.vel.x = 0; this.vel.z = 0;
        if (t < 1.35) {
          const want = a.startY + 3.2 * Ease.outCubic(Math.min(1, t / 0.9));
          this.vel.y = (want - this.pos.y) * 10;
          this.onGround = false;
        }
        if (t > 0.5 && t < 1.35 && Math.random() < 0.9) {
          this.model.swordTip.getWorldPosition(_v);
          g.fx.burst(_v, 2, { speed: 4, color: [1.6, 1.4, 0.9], life: 0.6, size: 0.6 });
        }
        if (t >= 1.35 && !a.struck) {
          a.struck = true;
          this.judgmentStrike();
        }
        if (t >= 1.35 && t < 1.65) this.vel.y = -30;
        if (t >= 1.62 && !a.slammed && this.onGround) {
          a.slammed = true;
          this.slamFx(1.6, 'judgment');
        }
        this.trail.active = t > 1.35 && t < 1.7;
        if (t >= a.clip.dur) { this.action = null; this.trail.active = false; }
        break;
      }
    }
  }

  updateLocomotion(dt, moveDir, wantMove, input, controls) {
    const g = this.game;
    this.trail.active = false;
    if (this.onGround) {
      this.state = 'ground';
      this.runTime = wantMove > 0.6 ? this.runTime + dt : 0;
      this.sprinting = this.runTime > 1.1;
      const target = (this.sprinting ? this.sprintSpeed : this.runSpeed) * wantMove;
      const accel = wantMove > 0.1 ? 14 : 18;
      this.vel.x = damp(this.vel.x, moveDir.x * target, accel, dt);
      this.vel.z = damp(this.vel.z, moveDir.z * target, accel, dt);
      if (wantMove > 0.1) this.yaw = dampAngle(this.yaw, Math.atan2(moveDir.x, moveDir.z), 14, dt);
      // Footsteps
      if (this.speed > 2) {
        this.stepAcc += dt * this.speed;
        if (this.stepAcc > 2.4) { this.stepAcc = 0; g.audio.sfx('step'); }
      }
    } else {
      this.sprinting = false;
      const gliding = controls && input.jumpHeld && this.vel.y < 2 && !this.flapBoost;
      if (gliding) {
        if (this.state !== 'glide') g.audio.sfx('flap');
        this.state = 'glide';
        const turn = wantMove > 0.1 ? wrapAngle(Math.atan2(moveDir.x, moveDir.z) - this.yaw) : 0;
        const turnRate = clamp(turn, -1, 1) * 2.6;
        this.yaw += turnRate * dt;
        this.bank = damp(this.bank, clamp(turn, -1, 1), 4, dt);
        const sp = 15 + (wantMove > 0.1 ? 3 : 0);
        this.vel.x = damp(this.vel.x, Math.sin(this.yaw) * sp, 2.5, dt);
        this.vel.z = damp(this.vel.z, Math.cos(this.yaw) * sp, 2.5, dt);
        if (!this.inUpdraft) this.vel.y = damp(this.vel.y, -2.6, 3, dt);
        if (Math.random() < 0.25) {
          for (const s of [-1, 1]) {
            this.model.joints['w3' + (s > 0 ? 'L' : 'R')].getWorldPosition(_v);
            g.fx.spawn(_v.x, _v.y, _v.z, 0, 0, 0, { life: 0.6, size: 0.25, color: [1, 0.95, 0.8], alpha: 0.6 });
          }
        }
      } else {
        this.state = 'air';
        this.bank = damp(this.bank, 0, 4, dt);
        const target = this.runSpeed * 1.05 * wantMove;
        this.vel.x = damp(this.vel.x, moveDir.x * target, 4, dt);
        this.vel.z = damp(this.vel.z, moveDir.z * target, 4, dt);
        if (wantMove > 0.1) this.yaw = dampAngle(this.yaw, Math.atan2(moveDir.x, moveDir.z), 8, dt);
      }
      if (this.flapBoost) { this.flapBoost -= dt; if (this.flapBoost <= 0) this.flapBoost = 0; }
    }
  }

  land(impact) {
    const g = this.game;
    this.state = 'ground';
    this.landDip = Math.min(0.35, impact * 0.02);
    if (impact > 8) {
      g.audio.sfx('land', { power: Math.min(1.5, impact / 15) });
      g.smoke.burst(this.pos, 6, { speed: 3, color: [0.8, 0.75, 0.7], life: 0.8, size: 1.5, alpha: 0.4 });
    }
    if (impact > 20 && (!this.action || this.action.type !== 'dive')) g.cameraShake(0.15);
  }

  // Wing Dive impact: holy shockwave.
  diveImpact() {
    const g = this.game;
    const p = this.pos.clone();
    g.cameraShake(0.6);
    g.hitstop(0.08);
    g.audio.sfx('impact');
    g.fx.ring(p, 60, { speed: 16, color: [1.6, 1.3, 0.8], life: 0.6, size: 0.8 });
    g.fx.burst(p, 40, { speed: 12, color: [1.6, 1.4, 1.0], life: 0.7, size: 0.7, dir: UP, spread: 1 });
    g.smoke.burst(p, 12, { speed: 5, color: [0.85, 0.8, 0.75], life: 1.3, size: 3, alpha: 0.5 });
    const dmgMult = g.difficultyDamage();
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d < 5.5 + e.radius && Math.abs(e.pos.y - p.y) < 4) {
        const dir = new THREE.Vector3(e.pos.x - p.x, 0, e.pos.z - p.z).normalize();
        e.takeHit({ dmg: 45 * dmgMult * (d < 2.5 ? 1.5 : 1), dir, power: 2, knock: 10, launch: 9, source: 'dive' });
      }
    }
    g.spawnProjectile(new Shockwave(g, { pos: p, maxR: 8, speed: 20, dmg: 15 * dmgMult, color: 0xffd080, owner: 'player' }));
  }

  slamFx(power, name) {
    const g = this.game;
    this.model.swordTip.getWorldPosition(_v);
    const p = _v.clone();
    const gy = g.world.groundAt(p.x, p.z, p.y + 1, 0);
    if (isFinite(gy)) p.y = gy;
    g.fx.ring(p, 36 * power, { speed: 12 * power, color: [1.5, 1.25, 0.75], life: 0.45, size: 0.6 });
    g.fx.burst(p, 20, { speed: 7, color: [1.6, 1.4, 1], life: 0.5, size: 0.5, dir: UP, spread: 0.8 });
    g.smoke.burst(p, 5, { speed: 3, color: [0.8, 0.75, 0.7], life: 1, size: 2, alpha: 0.4 });
    g.cameraShake(0.2 * power);
    if (name === 'heavy' || name === 'judgment') g.audio.sfx('impact');
    if (this.upgrades.sword && name === 'heavy') {
      g.spawnProjectile(new Shockwave(g, { pos: p, maxR: 10, speed: 18, dmg: 25 * g.difficultyDamage(), color: 0xffe0a0, owner: 'player' }));
    }
  }

  judgmentStrike() {
    const g = this.game;
    const mult = (this.upgrades.sword ? 2 : 1) * g.difficultyDamage();
    let n = 0;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > 32) continue;
      n++;
      const dmg = e.isBoss ? Math.min(e.maxHp * 0.1 * mult, 140 * mult) : 140 * mult;
      g.spawnProjectile(new Eruption(g, { pos: new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), radius: 1.6 + e.radius, delay: 0.05 + n * 0.04, dmg, color: 0xffe2a0, owner: 'player', kind: 'holy', height: 60 }));
    }
    g.flash(0xfff6e0, 0.9);
    g.cameraShake(0.7);
    g.slowmo(0.3, 0.7);
  }

  doHits(a) {
    const g = this.game;
    const c = a.clip;
    const fwd = this.yaw;
    const dmgMult = g.difficultyDamage();
    for (const e of g.enemies) {
      if (!e.alive || a.hitSet.has(e)) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > c.range) continue;
      const dy = e.pos.y + e.height * 0.5 - (this.pos.y + 1.2);
      if (Math.abs(dy) > 2.2 + e.height * 0.5) continue;
      if (c.arc < 6.2 && Math.abs(wrapAngle(Math.atan2(dx, dz) - fwd)) > c.arc / 2 && d > 0.8) continue;
      a.hitSet.add(e);
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      const hit = e.takeHit({ dmg: c.dmg * dmgMult, dir, power: c.power, knock: c.knock, launch: a.name === 'light3' ? 0 : undefined, source: a.name });
      if (hit) {
        const pw = c.power;
        g.hitstop(0.045 + pw * 0.025);
        g.cameraShake(c.shake || 0.15);
        const cp = e.chest.clone().lerp(this.chestPos(_v), 0.3);
        g.fx.burst(cp, 14 + pw * 8, { speed: 9 * pw, color: [1.7, 1.45, 0.9], life: 0.35, size: 0.45, drag: 5 });
        g.fx.burst(cp, 6, { speed: 3, color: [1.2, 1.3, 1.8], life: 0.25, size: 1.4 });
        this.addGlory(3 + pw);
      }
    }
  }

  // Returns 'dodged' | 'parried' | 'reflected' | 'blocked' | 'hit'
  receiveAttack(att) {
    const g = this.game;
    if (this.dead || this.scripted || g.cinematicActive) return 'dodged';
    if (this.invuln > 0) return 'dodged';
    const a = this.action;
    const src = att.pos || this.chestPos();
    if (a && a.type === 'parry') {
      if (a.t <= this.parryWindow && att.parryable) {
        // Perfect parry!
        g.onParry(att, src);
        this.addGlory(15);
        this.invuln = 0.3;
        if (att.projectile) {
          if (this.upgrades.shield) {
            att.projectile.reflect(att.source && att.source.alive ? att.source : null);
            return 'reflected';
          }
          return 'parried';
        }
        if (att.source && att.source.parried) att.source.parried();
        this.riposteT = 2.2;
        return 'parried';
      }
      if (att.parryable || att.kind === 'bolt') {
        this.hp -= att.dmg * 0.25 * g.difficultyTaken();
        g.audio.sfx('clang');
        g.fx.burst(src, 12, { speed: 6, color: [1.5, 1.3, 0.8], life: 0.3, size: 0.4 });
        const dx = this.pos.x - src.x, dz = this.pos.z - src.z;
        const d = Math.hypot(dx, dz) || 1;
        this.vel.x = (dx / d) * 5; this.vel.z = (dz / d) * 5;
        if (this.hp <= 0) this.die();
        return 'blocked';
      }
    }
    const dmg = att.dmg * g.difficultyTaken();
    this.hp -= dmg;
    this.hurtFlash = 0.35;
    this.invuln = 0.55;
    const dx = this.pos.x - src.x, dz = this.pos.z - src.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = att.knock || 5;
    this.vel.x = (dx / d) * k;
    this.vel.z = (dz / d) * k;
    if (att.launch) { this.vel.y = att.launch; this.onGround = false; }
    const superArmor = a && (a.type === 'judgment' || a.type === 'dive');
    if (!superArmor) {
      this.action = { type: 'hurt', t: 0, clip: CLIPS.hurt };
      this.trail.active = false;
    }
    g.onPlayerHurt(dmg, src);
    if (this.hp <= 0) this.die();
    return 'hit';
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  die() {
    const g = this.game;
    if (this.upgrades.helmet && !this.revived) {
      this.revived = true;
      this.hp = this.maxHp * 0.45;
      this.invuln = 2;
      g.onSalvation();
      return;
    }
    this.hp = 0;
    this.dead = true;
    this.deadT = 0;
    this.action = null;
    this.trail.active = false;
    g.onPlayerDeath();
  }

  fellIntoVoid() {
    const g = this.game;
    this.pos.copy(this.lastSafe);
    this.pos.y += 0.5;
    this.vel.set(0, 0, 0);
    this.action = null;
    this.hp -= 12;
    this.hurtFlash = 0.4;
    this.invuln = 1;
    g.onFell();
    if (this.hp <= 0) this.die();
  }

  updateDead(dt) {
    this.deadT += dt;
    this.vel.x = damp(this.vel.x, 0, 4, dt);
    this.vel.z = damp(this.vel.z, 0, 4, dt);
    if (!this.onGround) this.vel.y -= 28 * dt;
    this.pos.addScaledVector(this.vel, dt);
    const gy = this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.2, 0.5);
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
    kneelPose(this.pose, this.time);
    this.pose.head = [0.7, 0, 0];
    this.pose.shR = [-0.2, -0.2, -0.4];
    this.pose.haR = [1.8, 0, 0];
    this.pose.shL = [-0.6, 0, 0.3];
    this.applyModel(dt, 6);
  }

  // Scripted (cinematic) posing: {pose:'kneel'|'hero'|'idle'|'fly'|'glide'|'run', pos?, yaw?, vel?}
  updateScripted(dt) {
    const s = this.scripted;
    if (s.pos) this.pos.copy(s.pos);
    if (s.vel) this.pos.addScaledVector(s.vel, dt);
    if (s.yaw !== undefined) this.yaw = s.yaw;
    this.flapPhase += dt * 7;
    switch (s.pose) {
      case 'kneel': kneelPose(this.pose, this.time); break;
      case 'hero': heroPose(this.pose, this.time); break;
      case 'fly': flyPose(this.pose, this.time, this.flapPhase, 0.3); break;
      case 'glide': glidePose(this.pose, this.time, 0, 0); break;
      case 'run': this.phase += dt * 11; runPose(this.pose, this.phase, 0.7, this.time); break;
      case 'combat': idlePose(this.pose, this.time, 1); break;
      case 'majestic': idlePose(this.pose, this.time, 0); flapWings(this.pose, 0, 0, WING.majestic); break;
      default: idlePose(this.pose, this.time, 0);
    }
    if (s.clip) {
      s.clipT = (s.clipT || 0) + dt;
      blendInto(this.pose, sampleClip(CLIPS[s.clip], Math.min(s.clipT, CLIPS[s.clip].dur), {}), 1);
    }
    this.speed = s.vel ? s.vel.length() : 0;
    this.applyModel(dt, s.lambda || 10);
  }

  // ------------------------------------------------------------------ animation
  animate(dt, moveDir, wantMove) {
    const p = this.pose;
    const a = this.action;
    const combat = this.game.inCombat ? 1 : 0;
    let lambda = 16;
    let wingLambda = 11;

    // Base locomotion
    if (this.onGround) {
      if (this.speed > 0.8) {
        const k = clamp(this.speed / this.sprintSpeed, 0, 1);
        this.phase += dt * (5 + this.speed * 0.95);
        const turn = a ? 0 : clamp(wrapAngle(Math.atan2(moveDir.x, moveDir.z) - this.yaw) * (wantMove > 0.1 ? 1 : 0), -1, 1);
        runPose(p, this.phase, k, this.time, turn);
      } else {
        idlePose(p, this.time, combat);
      }
      this.flapAmp = damp(this.flapAmp, 0, 5, dt);
    } else if (this.state === 'glide') {
      glidePose(p, this.time, this.bank, clamp(-this.vel.y / 10, -1, 1));
      wingLambda = 6;
    } else {
      this.flapAmp = damp(this.flapAmp, this.vel.y > 0 ? 1 : 0.6, 3, dt);
      this.flapPhase += dt * (this.flapBoost ? 14 : 8);
      airPose(p, this.time, this.vel.y, this.flapPhase, this.flapAmp);
      wingLambda = 14;
    }

    // Action overlays
    if (a) {
      if (a.clip) {
        const cp = sampleClip(a.clip, Math.min(a.t, a.clip.dur), this._clipPose || (this._clipPose = {}));
        let w = 1;
        if (a.type === 'attack' || a.type === 'parry' || a.type === 'hurt') {
          const out = a.clip.dur - a.t;
          w = clamp(a.t / 0.04, 0, 1) * clamp(out / 0.12, 0, 1);
          if (a.type === 'hurt') w = 1 - clamp(a.t / 0.4, 0, 1) * 0.3;
        }
        for (const k in cp) if (!p[k]) p[k] = [0, 0, 0];
        blendInto(p, cp, w);
        lambda = a.type === 'attack' ? 34 : 24;
        for (const k in cp) delete cp[k];
      } else if (a.type === 'dash') {
        p.body = [this.onGround ? 0.45 : 0.9, 0, 0];
        p.bodyPos = [0, this.onGround ? -0.15 : 0.2, 0];
        p.chest = [0.1, 0, 0];
        p.head = [-0.4, 0, 0];
        p.shL = [0.9, 0.2, 0.3]; p.elL = [-0.2, 0, 0];
        p.shR = [0.8, -0.2, -0.3]; p.elR = [-0.2, 0, 0]; p.haR = [1.6, 0, 0];
        p.thL = [-0.6, 0, 0]; p.knL = [1.2, 0, 0]; p.thR = [0.4, 0, 0]; p.knR = [0.6, 0, 0];
        const e = a.t < 0.08 ? 1 : 0;
        p.w1L = [0, 0.5 - e * 0.3, 0.9 - e * 0.3]; p.w1R = [...p.w1L];
        p.w2L = [0, 0.2, -0.3]; p.w2R = [...p.w2L]; p.w3L = [0, 0.3, -0.2]; p.w3R = [...p.w3L];
        lambda = 28;
        wingLambda = 22;
      } else if (a.type === 'dive') {
        if (a.phase === 'rise') {
          p.body = [-0.2, 0, 0]; p.shR = [-3.0, 0, 0.1]; p.elR = [-0.3, 0, 0]; p.haR = [1.4, 0, 0];
          p.shL = [-2.8, 0, -0.1]; p.elL = [-0.4, 0, 0];
          flapWings(p, 1.2, 1, WING.majestic);
        } else if (a.phase === 'fall') {
          p.body = [0.15, 0, 0]; p.bodyPos = [0, 0, 0];
          p.chest = [0.2, 0, 0]; p.head = [0.4, 0, 0];
          p.shR = [-0.25, 0.3, -0.1]; p.elR = [-0.05, 0, 0]; p.haR = [1.57, 0, 0];
          p.shL = [-0.35, -0.35, 0.1]; p.elL = [-0.3, 0, 0];
          p.thL = [-0.2, 0, 0.05]; p.knL = [0.2, 0, 0]; p.thR = [0.1, 0, -0.05]; p.knR = [0.4, 0, 0];
          p.w1L = [...WING.dive.w1]; p.w2L = [...WING.dive.w2]; p.w3L = [...WING.dive.w3];
          p.w1R = [...WING.dive.w1]; p.w2R = [...WING.dive.w2]; p.w3R = [...WING.dive.w3];
        } else {
          kneelPose(p, this.time);
          p.shR = [-0.5, 0.1, -0.1]; p.elR = [-0.1, 0, 0]; p.haR = [1.9, 0, 0];
          p.head = [0.1, 0, 0];
          p.w1L = [0, 0.3, 0.9]; p.w1R = [0, 0.3, 0.9];
          p.w2L = [0, -0.1, -0.2]; p.w2R = [0, -0.1, -0.2];
          p.w3L = [0, -0.2, -0.3]; p.w3R = [0, -0.2, -0.3];
        }
        lambda = 26;
        wingLambda = 18;
      }
      if (a.type === 'judgment') wingLambda = 8;
    }

    // Landing dip & secondary motion
    this.landDip = damp(this.landDip, 0, 8, dt);
    p.bodyPos[1] -= this.landDip;
    if (this.landDip > 0.05) { p.knL[0] += this.landDip * 2; p.knR[0] += this.landDip * 2; p.thL[0] -= this.landDip; p.thR[0] -= this.landDip; }
    // Lock-on head look
    const lt = this.game.lockTarget;
    if (lt && lt.alive && !a) {
      const look = wrapAngle(Math.atan2(lt.pos.x - this.pos.x, lt.pos.z - this.pos.z) - this.yaw);
      p.head[1] = clamp(look, -1, 1) * 0.6;
    }
    this.applyModel(dt, lambda, wingLambda);
  }

  applyModel(dt, lambda, wingLambda) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.rig.apply(this.pose, dt, lambda, wingLambda || lambda * 0.7);
    // Cape
    const lv = _v.copy(this.vel).applyAxisAngle(UP, -this.yaw);
    updateCape(m, Math.min(dt, 1 / 30), lv, this.time, -this.vel.y);
    // Effects: glory halo, sword glow, wing glow, hurt flash.
    const full = this.glory >= 100;
    this.halo.material.opacity = full ? 0.6 + Math.sin(this.time * 5) * 0.25 : 0;
    this.halo.rotation.z += dt * 0.6;
    const a = this.action;
    const swordHot = (a && (a.type === 'attack' || a.type === 'judgment' || a.type === 'dive')) || this.riposteT > 0;
    m.swordGlow.material.opacity = damp(m.swordGlow.material.opacity, swordHot ? 0.8 : 0.08, 10, dt);
    const wingGlow = this.state === 'glide' || (a && a.type === 'judgment') || full ? 0.35 : 0;
    m.materials.feathers.emissiveIntensity = damp(m.materials.feathers.emissiveIntensity, wingGlow, 3, dt);
    m.materials.steel.emissive.setRGB(this.hurtFlash > 0 ? 0.8 : 0, 0, 0);
    // Trail sample
    m.root.updateMatrixWorld(true);
    const b = m.swordBase.getWorldPosition(_v);
    const t = m.swordTip.getWorldPosition(new THREE.Vector3());
    this.trail.update(b, t, dt);
  }
}
