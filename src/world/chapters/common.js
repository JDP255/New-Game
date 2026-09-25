// Shared helpers for building chapters.
import * as THREE from 'three';
import * as P from '../props.js';
import { toon, glowSprite, stainedGlassMaterial, beamMaterial } from '../../render/materials.js';
import { ambientMotes } from '../../render/particles.js';
import { Collectible, Interactable, makeUpdraft } from '../../game/collectibles.js';
import { buildHumanoid } from '../../entities/enemyModels.js';
import { idlePose } from '../../entities/knightPoses.js';
import { SCROLLS, RELICS } from '../../game/story.js';

export { P, makeUpdraft, Interactable };

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Camera shot helper: from/to positions and look targets.
export function shot(from, look, to = null, lookTo = null, dur = 4, extra = {}) {
  return { shot: { from, to: to || from, lookFrom: look, lookTo: lookTo || look, dur, ...extra } };
}

export function say(who, line, dur) {
  return { say: [who, line], dur: dur || Math.max(2.6, line.length * 0.055) };
}

export function motes(g, color, opts) {
  const m = ambientMotes(opts?.count || 600, color, opts?.box || 70, opts);
  m.userData.uniforms.pixelScale.value = innerHeight * 0.9;
  g.world.scene.add(m);
  g.world.addAnimated({ update: (t) => { m.userData.uniforms.time.value = t; m.userData.uniforms.center.value.copy(g.cam.camera.position); } });
  return m;
}

// Registers the 12 feathers, 3 scrolls and 1 relic for a chapter.
export function placeCollectibles(g, ch, { feathers = [], scrolls = [], relic = null }) {
  feathers.forEach((p, i) => {
    const id = `f-${ch}-${i}`;
    if (!g.save.has(id)) g.collectibles.push(new Collectible(g, 'feather', id, p));
  });
  scrolls.forEach((p, i) => {
    const id = `s-${ch}-${i}`;
    const idx = (ch - 1) * 3 + i;
    if (!g.save.has(id)) g.collectibles.push(new Collectible(g, 'scroll', id, p, { scroll: SCROLLS[idx] }));
  });
  if (relic) {
    const id = `r-${ch}`;
    if (!g.save.has(id)) g.collectibles.push(new Collectible(g, 'relic', id, relic, { relic: RELICS[ch - 1] }));
  }
}

// Static NPC (Elder Ithiel, Captain Dorian, the Fourth Man...).
export function npc(g, pos, yaw, { palette, helm = 'hood', weapon = 'staff', scale = 1.05, name = 'npc' } = {}) {
  const m = buildHumanoid({ palette, helm, weapon, scale, cape: true });
  m.root.position.copy(pos);
  m.root.rotation.y = yaw;
  g.world.scene.add(m.root);
  const pose = {};
  const upd = {
    t: Math.random() * 5,
    update: (t, dt) => {
      upd.t += dt;
      idlePose(pose, upd.t, 0);
      pose.shR = [-0.6, -0.1, -0.15]; pose.elR = [-0.9, 0, 0]; pose.haR = [0.4, 0, 0];
      if (upd.pose) Object.assign(pose, upd.pose);
      m.rig.apply(pose, dt, 6);
    },
  };
  g.world.addAnimated(upd);
  m.npc = upd;
  m.name = name;
  return m;
}

export const KIM_NPC = { armor: 0xf0ece0, trim: 0xe8b04a, cloth: 0x1d3b9c, rim: 0xfff0c0, eye: 0x9fd8ff, skin: 0xd8b898 };
export const ELDER_NPC = { armor: 0xf4efe4, trim: 0xe8b04a, cloth: 0xf2ece0, rim: 0xfff4d0, eye: 0x9fd8ff, skin: 0xe0c0a0 };

// Waypoint/defense marker objects etc.
export function brazierObj(g, pos, onLit) {
  const geo = P.brazier();
  const mat = toon(0xffffff, { vertexColors: true, rim: 0.3 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos);
  m.castShadow = true;
  g.world.scene.add(m);
  g.world.circles.push({ x: pos.x, z: pos.z, r: 0.9, y0: pos.y - 1, y1: pos.y + 3 });
  const flame = glowSprite(0xffa040, 4, 0);
  flame.position.set(pos.x, pos.y + 3.3, pos.z);
  g.world.scene.add(flame);
  const light = new THREE.PointLight(0xffa050, 0, 30, 1.6);
  light.position.set(pos.x, pos.y + 4, pos.z);
  g.world.scene.add(light);
  const obj = new Interactable(g, {
    pos: [pos.x, pos.y, pos.z], prompt: 'Light the Brazier', radius: 3.5,
    onUse: () => {
      flame.material.opacity = 1;
      light.intensity = 60;
      g.audio.sfx('brazier');
      g.fx.burst(V(pos.x, pos.y + 3.2, pos.z), 50, { speed: 8, color: [1.8, 1.0, 0.4], life: 0.8, size: 0.7, dir: V(0, 1, 0), spread: 0.6 });
      g.player.heal(30);
      onLit && onLit(obj);
    },
  });
  g.world.addAnimated({ update: (t) => { if (obj.used) { flame.scale.setScalar(4 + Math.sin(t * 13) * 0.4 + Math.sin(t * 7.3) * 0.3); if (Math.random() < 0.3) g.fx.spawn(pos.x + (Math.random() - 0.5), pos.y + 3.3, pos.z + (Math.random() - 0.5), 0, 3, 0, { life: 0.6, size: 0.5, color: [1.8, 0.9, 0.3] }); } } });
  obj.light = light;
  obj.flame = flame;
  return obj;
}

export function stainedWindow(parent, pos, rot, size, palette) {
  const mat = stainedGlassMaterial(palette);
  const m = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 40), mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  parent.add(m);
  return mat;
}

// Distant god rays for the land of Kim.
export function godRays(g, list, color = 0xffe8b0) {
  for (const [x, y, z, r, h, tilt] of list) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r, h, 16, 1, true), beamMaterial(color, 0.12));
    m.position.set(x, y, z);
    m.rotation.z = tilt || 0.25;
    g.world.scene.add(m);
    g.world.addAnimated({ update: (t) => { m.material.uniforms.time.value = t * 0.2; } });
  }
}

// Simple ring of groups for spawning waves.
export const grp = (type, n, at, spread = 8, opts) => ({ type, n, at, spread, opts });
