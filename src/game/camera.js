// Third-person orbit camera with lock-on framing, trauma shake, FOV kicks and cinematic override.
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle, Ease } from '../core/utils.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const _look = new THREE.Vector3();

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 2000);
    this.yaw = 0;
    this.pitch = 0.22;
    this.distance = 6.2;
    this.targetDistance = 6.2;
    this.userZoom = 0;
    this.focus = new THREE.Vector3();
    this.baseFov = 62;
    this.fov = 62;
    this.fovKick = 0;
    this.trauma = 0;
    this.shakeT = 0;
    this.mode = 'follow';
    this.lockTarget = null;
    this.cine = null;
    this.idleTime = 0;
    this.shoulder = 0.55;
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  kick(amount) { this.fovKick = Math.max(this.fovKick, amount); }

  // Snap behind the player (used on spawn / after cinematics).
  snapBehind(player) {
    this.yaw = player.yaw;
    this.pitch = 0.22;
    this.focus.copy(player.pos).add(_v.set(0, 1.7, 0));
  }

  update(dt, input, player, world, allowInput = true) {
    const cam = this.camera;
    if (this.mode === 'cinematic' && this.cine) {
      this.updateCinematic(dt);
      this.applyShake(dt);
      return;
    }
    // Input
    if (allowInput) {
      const [lx, ly] = input.lookDelta();
      this.yaw -= lx;
      this.pitch = clamp(this.pitch + ly, -0.9, 1.25);
      if (input.wheel) this.userZoom = clamp(this.userZoom + input.wheel * 0.8, -2.5, 5);
      if (Math.abs(lx) + Math.abs(ly) > 0.0005) this.idleTime = 0;
    }
    this.idleTime += dt;

    // Lock-on: rotate to keep target framed.
    const lt = this.lockTarget;
    if (lt && lt.alive) {
      const dx = lt.pos.x - player.pos.x, dz = lt.pos.z - player.pos.z;
      const wantYaw = Math.atan2(dx, dz);
      this.yaw = dampAngle(this.yaw, wantYaw, 6, dt);
      const dist = Math.hypot(dx, dz);
      const dy = (lt.pos.y + lt.height * 0.5) - (player.pos.y + 1.5);
      const wantPitch = clamp(0.25 - Math.atan2(dy, Math.max(4, dist)) * 0.6, -0.4, 0.9);
      this.pitch = damp(this.pitch, wantPitch, 3, dt);
    } else if (player.state === 'glide' && this.idleTime > 0.6) {
      // Gently swing behind the glider.
      this.yaw = dampAngle(this.yaw, player.yaw, 1.6, dt);
      this.pitch = damp(this.pitch, 0.3, 1.2, dt);
    } else if (player.speed > 6 && this.idleTime > 1.5 && !lt) {
      this.yaw = dampAngle(this.yaw, player.yaw, 0.6, dt);
    }

    // Distance per state
    let want = 6.2;
    if (player.state === 'glide') want = 8.5;
    else if (!player.onGround) want = 7.2;
    if (player.sprinting) want = 7.0;
    if (lt && lt.alive) want = 7.5 + Math.min(6, (lt.radius || 1) * 1.5);
    if (player.bossCam) want = Math.max(want, player.bossCam);
    this.targetDistance = want + this.userZoom;
    this.distance = damp(this.distance, this.targetDistance, 3, dt);

    // Focus follows the player smoothly (faster vertically when falling fast).
    _v.copy(player.pos);
    _v.y += 1.65;
    const lam = player.state === 'dash' ? 20 : 12;
    this.focus.x = damp(this.focus.x, _v.x, lam, dt);
    this.focus.z = damp(this.focus.z, _v.z, lam, dt);
    this.focus.y = damp(this.focus.y, _v.y, Math.abs(player.vel.y) > 12 ? 18 : 8, dt);

    // Compute orbit position
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const back = _v2.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    // Over-the-shoulder offset (to the right of view).
    const right = _r.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(this.shoulder * Math.min(1, this.distance / 6));
    cam.position.copy(this.focus).addScaledVector(back, this.distance).add(right);
    // Keep camera above ground.
    const g = world.groundAt(cam.position.x, cam.position.z, cam.position.y + 2, 0);
    if (isFinite(g) && cam.position.y < g + 0.7) cam.position.y = g + 0.7;
    const look = _look.copy(this.focus).add(right);
    if (lt && lt.alive) {
      look.lerp(_v2.set(lt.pos.x, lt.pos.y + lt.height * 0.5, lt.pos.z), 0.3);
    }
    cam.lookAt(look);

    // FOV
    this.fovKick = damp(this.fovKick, 0, 4, dt);
    let fovWant = this.baseFov + (player.sprinting ? 6 : 0) + (player.state === 'glide' ? 8 : 0) + this.fovKick;
    this.fov = damp(this.fov, fovWant, 5, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.applyShake(dt);
  }

  applyShake(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.trauma <= 0) return;
    this.shakeT += dt * 40;
    const s = this.trauma * this.trauma;
    const cam = this.camera;
    cam.rotation.z += Math.sin(this.shakeT * 1.3) * 0.04 * s;
    cam.position.x += Math.sin(this.shakeT * 2.1) * 0.35 * s;
    cam.position.y += Math.cos(this.shakeT * 1.7) * 0.3 * s;
  }

  // ---------------------------------------------------------------- cinematic shots
  // shot: {from:[x,y,z], to:[x,y,z], lookFrom:[..], lookTo:[..], dur, ease, fov, fovTo, follow:obj}
  playShot(shot) {
    this.mode = 'cinematic';
    this.cine = { ...shot, t: 0 };
    if (shot.fov) { this.camera.fov = shot.fov; this.camera.updateProjectionMatrix(); }
  }

  endCinematic(player) {
    this.mode = 'follow';
    this.cine = null;
    if (player) this.snapBehind(player);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  updateCinematic(dt) {
    const c = this.cine;
    c.t += dt;
    const u = clamp(c.t / c.dur, 0, 1);
    const e = (c.ease || Ease.inOutSine)(u);
    const from = typeof c.from === 'function' ? c.from() : c.from;
    const to = typeof c.to === 'function' ? c.to() : (c.to || from);
    const lf = typeof c.lookFrom === 'function' ? c.lookFrom() : c.lookFrom;
    const lt = typeof c.lookTo === 'function' ? c.lookTo() : (c.lookTo || lf);
    const cam = this.camera;
    if (c.orbit) {
      // Orbit around a center point
      const { center, radius, height, a0, a1 } = c.orbit;
      const ctr = typeof center === 'function' ? center() : center;
      const a = a0 + (a1 - a0) * e;
      cam.position.set(ctr[0] + Math.sin(a) * radius, ctr[1] + height, ctr[2] + Math.cos(a) * radius);
      cam.lookAt(ctr[0], ctr[1] + (c.orbit.lookY || 1.2), ctr[2]);
    } else {
      cam.position.set(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e);
      cam.lookAt(lf[0] + (lt[0] - lf[0]) * e, lf[1] + (lt[1] - lf[1]) * e, lf[2] + (lt[2] - lf[2]) * e);
    }
    if (c.fovTo) {
      cam.fov = c.fov + (c.fovTo - c.fov) * e;
      cam.updateProjectionMatrix();
    }
    if (c.roll) cam.rotation.z += c.roll * Math.sin(u * Math.PI);
  }
}

export { wrapAngle };
