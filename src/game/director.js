// Runs a chapter's sequence of beats (cinematics, waypoints, waves, interactions, bosses)
// and plays scripted cinematics with camera shots, subtitles, music cues and events.
import * as THREE from 'three';
import { beamMaterial, glowSprite } from '../render/materials.js';

export class Cinematic {
  constructor(game, steps, onDone) {
    this.game = game;
    this.steps = steps;
    this.i = 0;
    this.wait = 0;
    this.done = false;
    this.onDone = onDone;
    this.t = 0;
    this.holdSkip = 0;
  }

  runStep(s, skipping = false) {
    const g = this.game;
    const ui = g.ui;
    if (s.shot && !skipping) g.cam.playShot(s.shot);
    if (s.say && !skipping) ui.subtitle(s.say[0], s.say[1], s.dur || 4);
    if (s.do) s.do(g, skipping);
    if (s.player) {
      const p = g.player;
      const sp = s.player;
      if (sp.pose === null) p.scripted = null;
      else {
        const prev = p.scripted || {};
        p.scripted = {
          pose: sp.pose ?? prev.pose ?? 'idle',
          yaw: sp.yaw ?? prev.yaw ?? p.yaw,
          clip: sp.clip, clipT: 0, lambda: sp.lambda,
          vel: sp.vel ? new THREE.Vector3(...sp.vel) : null,
        };
        if (sp.pos) { p.pos.set(...sp.pos); p.vel.set(0, 0, 0); }
      }
    }
    if (s.music && !skipping) g.audio.playTheme(s.music, s.intensity ?? 0);
    if (s.stinger && !skipping) g.audio.stinger(s.stinger);
    if (s.sfx && !skipping) g.audio.sfx(s.sfx, s.sfxOpt || {});
    if (s.fade !== undefined && !skipping) ui.fade(s.fade, s.fadeDur || 1, s.white);
    if (s.card && !skipping) ui.chapterCard(s.card, true);
    if (s.cardOut && !skipping) ui.chapterCard(null, false);
    if (s.bigTitle !== undefined && !skipping) ui.bigTitle(s.bigTitle);
    if (s.shake && !skipping) g.cam.shake(s.shake);
    if (s.flash && !skipping) g.flash(s.flash, s.flashAmt || 0.8);
    if (skipping) return 0;
    if (s.wait !== undefined) return s.wait;
    if (s.say) return s.dur || 4;
    return 0;
  }

  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    // Hold/press to skip.
    if (input.skipPressed && this.t > 0.8) return this.skip();
    this.wait -= dt;
    while (this.wait <= 0 && !this.done) {
      if (this.i >= this.steps.length) { this.finish(); break; }
      this.wait += this.runStep(this.steps[this.i++]);
    }
  }

  skip() {
    while (this.i < this.steps.length) this.runStep(this.steps[this.i++], true);
    this.finish(true);
  }

  finish(skipped = false) {
    if (this.done) return;
    this.done = true;
    const g = this.game;
    g.ui.subtitle(null, null);
    if (skipped) { g.ui.fade(0, 0.4); g.ui.chapterCard(null, false); g.ui.bigTitle(false); }
    this.onDone && this.onDone(skipped);
  }
}

// Waypoint beacon shown for 'goto' beats.
function makeBeacon(scene, pos) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 60, 16, 1, true), beamMaterial(0xffe2a0, 0.35));
  beam.position.y = 30;
  g.add(beam);
  const s = glowSprite(0xffe2a0, 5, 0.8);
  s.position.y = 1.5;
  g.add(s);
  g.position.copy(pos);
  scene.add(g);
  return { group: g, beam };
}

export class Director {
  constructor(game, chapter) {
    this.game = game;
    this.chapter = chapter;
    this.beats = chapter.beats;
    this.index = -1;
    this.beat = null;
    this.checkpoint = { pos: new THREE.Vector3(...chapter.spawn), yaw: chapter.yaw || 0 };
    this.finished = false;
  }

  start(index = 0) {
    this.begin(index);
  }

  begin(index) {
    const g = this.game;
    this.cleanupBeat();
    this.index = index;
    if (index >= this.beats.length) { this.finished = true; g.onChapterComplete(); return; }
    const b = (this.beat = { ...this.beats[index], state: {}, t: 0 });
    if (b.type !== 'cinematic' && b.type !== 'end' && !g.player.dead) {
      this.checkpoint = { pos: g.player.pos.clone(), yaw: g.player.yaw, index };
      if (b.checkpoint) this.checkpoint.pos.set(...b.checkpoint);
      g.saveResume(index);
    }
    if (b.objective !== undefined) g.ui.setObjective(b.objective);
    if (b.hint) g.ui.hint(b.hint, b.hintDur || 7);
    if (b.onStart) b.onStart(g, b);
    switch (b.type) {
      case 'cinematic':
        g.playCinematic(typeof b.steps === 'function' ? b.steps(g) : b.steps, () => { b.state.done = true; });
        break;
      case 'goto': {
        const p = new THREE.Vector3(...b.target);
        b.state.target = p;
        b.state.beacon = makeBeacon(g.world.scene, p);
        g.setMarker(p);
        g.audio.setIntensity(0);
        break;
      }
      case 'wave':
        b.state.sub = 0;
        this.spawnSub(b);
        g.audio.setIntensity(b.intensity ?? 1);
        break;
      case 'interact':
        b.state.items = b.items(g, b);
        break;
      case 'boss':
        b.state.boss = b.spawn(g);
        g.audio.playTheme(b.music || 'boss', 2);
        break;
      case 'custom':
        break;
      case 'end':
        g.onChapterComplete();
        break;
    }
  }

  spawnSub(b) {
    const g = this.game;
    const waves = b.waves;
    const groups = waves[b.state.sub];
    b.state.delay = 0;
    g.spawnWave(groups);
    if (waves.length > 1 && b.state.sub > 0) g.ui.toast(`Wave <b>${b.state.sub + 1}</b> of ${waves.length}`, 'warn');
  }

  cleanupBeat() {
    const b = this.beat;
    if (!b) return;
    if (b.state.beacon) { this.game.world.scene.remove(b.state.beacon.group); }
    this.game.setMarker(null);
    if (b.onEnd) b.onEnd(this.game, b);
  }

  // Restart current beat after death (keeps interact progress).
  restart() {
    const g = this.game;
    const b = this.beat;
    g.clearEnemies();
    g.player.spawn(this.checkpoint.pos.clone(), this.checkpoint.yaw);
    g.cam.snapBehind(g.player);
    if (b && b.type === 'boss' && b.state.boss) {
      b.state.boss.dispose && b.state.boss.dispose();
      if (b.state.boss.model) g.world.dynamic.remove(b.state.boss.model.root);
      if (b.onRestart) b.onRestart(g, b);
      b.state.boss = b.spawn(g, true);
      g.ui.setBoss(null);
      return;
    }
    if (b && b.type === 'wave') {
      this.spawnSub(b);
      return;
    }
    if (b && b.type === 'interact' && b.onRestart) b.onRestart(g, b);
  }

  update(dt) {
    const g = this.game;
    const b = this.beat;
    if (!b || this.finished) return;
    b.t += dt;
    if (b.onUpdate) b.onUpdate(g, b, dt);
    let done = false;
    switch (b.type) {
      case 'cinematic': done = b.state.done; break;
      case 'goto': {
        const d = g.player.pos.distanceTo(b.state.target);
        b.state.beacon.beam.material.uniforms.time.value = b.t;
        if (d < (b.radius || 6)) done = true;
        break;
      }
      case 'wave': {
        const alive = g.enemies.some((e) => e.alive);
        if (!alive) {
          b.state.delay += dt;
          if (b.state.delay > 1.2) {
            if (b.state.sub < b.waves.length - 1) { b.state.sub++; this.spawnSub(b); }
            else done = true;
          }
        }
        break;
      }
      case 'interact': {
        const items = b.state.items;
        const allUsed = items.every((it) => it.used);
        const alive = g.enemies.some((e) => e.alive);
        if (b.progress) g.ui.setObjective(b.progress(items.filter((i) => i.used).length, items.length));
        if (allUsed && !alive) done = true;
        break;
      }
      case 'boss': {
        const boss = b.state.boss;
        if (boss && boss.defeated && b.state.outroDone) done = true;
        break;
      }
      case 'custom': done = b.update ? b.update(g, b, dt) : true; break;
    }
    if (done) {
      if (b.type === 'wave' || b.type === 'boss' || b.type === 'interact') g.audio.setIntensity(0);
      if (b.onDone) b.onDone(g, b);
      if (b.type !== 'cinematic' && b.type !== 'end') g.audio.sfx('objective');
      this.begin(this.index + 1);
    }
  }
}
