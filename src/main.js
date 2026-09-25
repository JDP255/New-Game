// VALKIMSMOR — Wings of Kim. Game orchestrator: loop, state machine, events, menus, saving.
import * as THREE from 'three';
import { Renderer } from './render/renderer.js';
import { ParticleSystem } from './render/particles.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { Save } from './core/save.js';
import { clamp, damp, wrapAngle } from './core/utils.js';
import { UI } from './ui/ui.js';
import { World } from './world/world.js';
import { CameraRig } from './game/camera.js';
import { Director, Cinematic } from './game/director.js';
import { Player } from './entities/player.js';
import { makeEnemy } from './entities/enemies.js';
import { glowSprite } from './render/materials.js';
import { CHAPTERS, ARMOR, ARMOR_BY_CHAPTER, SCROLLS, RELICS, CODEX, DEATH_QUOTES, TIPS } from './game/story.js';
import { chapter1, buildKimIsles } from './world/chapters/ch1.js';
import { chapter2 } from './world/chapters/ch2.js';
import { chapter3 } from './world/chapters/ch3.js';
import { chapter4 } from './world/chapters/ch4.js';
import { chapter5 } from './world/chapters/ch5.js';
import { chapter6 } from './world/chapters/ch6.js';
import { chapter7 } from './world/chapters/ch7.js';
import { trial } from './world/chapters/trial.js';

const BUILDERS = [null, chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7, trial];
const DAWN = { top: 0x3a6ad8, horizon: 0xffd6a0, bottom: 0xffe8c8, sun: 0xfff0c0, cloud: 0xfffaf0, cloudShadow: 0xd89a9a };
const _v = new THREE.Vector3();

class Game {
  constructor() {
    this.save = new Save();
    const S = this.save.data.settings;
    this.renderer = new Renderer(document.getElementById('app'), S.quality);
    this.input = new Input(this.renderer.canvas);
    this.input.sensitivity = S.sens;
    this.input.invertY = S.invertY;
    this.audio = audio;
    this.ui = new UI();
    this.cam = new CameraRig(innerWidth / innerHeight);
    this.fx = new ParticleSystem(4000, true);
    this.smoke = new ParticleSystem(1200, false);
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];
    this.interactables = [];
    this.souls = [];
    this.time = 0;
    this.hitstopT = 0;
    this.slowT = 0;
    this.slowScale = 1;
    this.flashAmt = 0;
    this.hurtAmt = 0;
    this.state = 'boot';
    this.attackTokens = 2;
    this.lockTarget = null;
    this.bossTarget = null;
    this.markerPos = null;
    this.cinematic = null;
    this.cinematicActive = false;
    this.skyLerp = null;
    this.renderer.onResize = (w, h) => {
      this.cam.camera.aspect = w / h;
      this.cam.camera.updateProjectionMatrix();
      this.fx.setViewport(h);
      this.smoke.setViewport(h);
    };
    this.renderer.onResize(innerWidth, innerHeight);
    this.renderer.onQualityChange = (q) => { if (this.world) this.world.setShadowQuality(q); };
    this.applyUpgrades();
    audio.setVolumes(S.music, S.sfx);

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.cinematicActive && performance.now() - (this.cineEndT || 0) > 600) this.pause();
    });
    this.renderer.canvas.addEventListener('click', () => { if (this.state === 'playing') this.input.requestLock(); });

    this.last = performance.now();
    this.fpsAcc = 0; this.fpsN = 0;
    this.boot();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------------ setup / worlds
  applyUpgrades() {
    const p = this.player;
    p.upgrades = { ...this.save.data.upgrades };
    const feathers = Object.keys(this.save.data.found).filter((k) => k.startsWith('f-')).length;
    p.featherBonus = Math.floor(feathers / 12);
    p.recalcStats(true);
  }

  newWorld() {
    if (this.world) this.world.dispose();
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];
    this.interactables = [];
    this.souls = [];
    this.lockTarget = null;
    this.bossTarget = null;
    this.markerPos = null;
    this.fx.clear();
    this.smoke.clear();
    this.skyLerp = null;
    const w = (this.world = new World(this.renderer));
    w.camera = this.cam.camera;
    w.setShadowQuality(this.renderer.q);
    w.scene.add(this.fx.points, this.smoke.points, this.player.root, this.player.trail.mesh);
    this.ui.setBoss(null);
    this.ui.prompt(null);
    return w;
  }

  boot() {
    this.state = 'boot';
    this.newWorld();
    buildKimIsles(this, { title: true });
    this.player.spawn(new THREE.Vector3(0, 20, 0), 0.6);
    this.player.scripted = { pose: 'hero', yaw: 0.6 };
    this.cam.playShot({ orbit: { center: [0, 20, 0], radius: 5.2, height: 0.9, a0: 2.2, a1: 3.4, lookY: 2.0 }, dur: 70 });
    this.ui.showScreen('title-screen', true);
    document.getElementById('title-menu').innerHTML = '';
    document.getElementById('press-start').classList.remove('hidden');
    const start = () => {
      removeEventListener('pointerdown', start);
      removeEventListener('keydown', start);
      audio.init();
      audio.playTheme('title', 0);
      document.getElementById('press-start').classList.add('hidden');
      this.showTitle();
    };
    addEventListener('pointerdown', start);
    addEventListener('keydown', start);
  }

  showTitle() {
    this.state = 'title';
    this.ui.fade(0, 0.6);
    this.input.releaseLock();
    this.ui.showHUD(false);
    this.ui.setCine(false);
    this.ui.showScreen('title-screen', true);
    const d = this.save.data;
    const resume = d.resume;
    this.ui.buildMenu(document.getElementById('title-menu'), [
      resume && { label: 'Continue', note: `${CHAPTERS[resume.chapter - 1] ? CHAPTERS[resume.chapter - 1].title : 'The Proving'}`, action: () => this.startChapter(resume.chapter, resume.beat) },
      { label: 'New Journey', action: () => this.confirmNew() },
      { label: 'Chapters', action: () => this.chapterSelect() },
      { label: 'Codex', action: () => this.journal('scrolls', () => this.showTitle()) },
      { label: 'Options', action: () => this.options(() => this.showTitle()) },
      { label: 'Controls', action: () => this.controls(() => this.showTitle()) },
    ]);
  }

  confirmNew() {
    if (!this.save.hasProgress) return this.startChapter(1, 0);
    this.ui.showScreen('title-screen', false);
    this.ui.panel('A New Journey', '<p style="text-align:center">Begin again from the first chapter? Your collectibles and Oathmarks are kept; your chapter progress resets.</p>', [
      { label: 'Begin', action: () => { this.save.data.resume = null; this.save.data.unlocked = Math.max(1, this.save.data.unlocked); this.save.write(); this.ui.closePanel(); this.startChapter(1, 0); } },
      { label: 'Back', action: () => { this.ui.closePanel(); this.showTitle(); } },
    ]);
  }

  chapterSelect() {
    this.ui.showScreen('title-screen', false);
    const d = this.save.data;
    const rows = CHAPTERS.map((c) => {
      const locked = c.id > d.unlocked;
      const f = Object.keys(d.found).filter((k) => k.startsWith(`f-${c.id}-`)).length;
      const s = Object.keys(d.found).filter((k) => k.startsWith(`s-${c.id}-`)).length;
      const r = d.found[`r-${c.id}`] ? 1 : 0;
      return `<div class="chap ${locked ? 'locked' : ''}" data-ch="${locked ? '' : c.id}"><span class="n">${c.numeral}</span><span class="tt">${locked ? '— Sealed —' : c.title}</span><span class="pc">${locked ? '' : `✦ ${f}/12 · ❖ ${s}/3 · ✧ ${r}/1${d.completed[c.id] ? ' · ✓' : ''}`}</span></div>`;
    });
    const trialLocked = d.unlocked < 4;
    rows.push(`<div class="chap ${trialLocked ? 'locked' : ''}" data-ch="${trialLocked ? '' : 8}"><span class="n">✦</span><span class="tt">${trialLocked ? '— Sealed until Chapter IV —' : 'The Proving of the Ninth Feather'}</span><span class="pc">${trialLocked ? '' : `Best: wave ${d.trialBest}/10`}</span></div>`);
    const body = this.ui.panel('Chapters', `<div class="chapters">${rows.join('')}</div><p style="text-align:center;margin-top:14px">Completion: <b style="color:var(--gold2)">${this.completion()}%</b></p>`, [{ label: 'Back', action: () => { this.ui.closePanel(); this.showTitle(); } }]);
    body.querySelectorAll('.chap').forEach((el) => el.addEventListener('click', () => {
      const id = +el.dataset.ch;
      if (!id) return;
      audio.sfx('uiConfirm');
      this.ui.closePanel();
      this.startChapter(id, 0);
    }));
  }

  completion() {
    const d = this.save.data;
    const found = Object.keys(d.found);
    const f = found.filter((k) => k.startsWith('f-')).length;
    const s = found.filter((k) => k.startsWith('s-')).length;
    const r = found.filter((k) => k.startsWith('r-')).length;
    const c = Object.keys(d.completed).filter((k) => +k <= 7).length;
    const t = d.trialBest >= 10 ? 1 : 0;
    return Math.round((c / 7) * 40 + (f / 84) * 30 + (s / 21) * 15 + (r / 7) * 10 + t * 5);
  }

  // ------------------------------------------------------------------ chapters
  startChapter(id, beat = 0) {
    this.ui.showScreen('title-screen', false);
    this.ui.closePanel();
    this.ui.showScreen('death', false);
    this.ui.loading(true, TIPS[Math.floor(Math.random() * TIPS.length)]);
    this.state = 'loading';
    this.cinematic = null;
    this.cinematicActive = false;
    this.ui.setCine(false);
    audio.stopMusic(0.5);
    setTimeout(() => {
      try {
        this.loadChapter(id, beat);
      } catch (e) {
        console.error(e);
        this.ui.loading(false);
        this.showTitle();
      }
    }, 60);
  }

  loadChapter(id, beat) {
    this.chapterId = id;
    this.newWorld();
    this.applyUpgrades();
    this.player.revived = false;
    this.player.scripted = null;
    this.player.dead = false;
    this.player.glory = 0;
    this.player.fireWard = false;
    const def = (this.chapterDef = BUILDERS[id](this));
    this.chapterStart = this.time;
    let spawn = new THREE.Vector3(...def.spawn);
    // Resume at a later beat: spawn at the latest waypoint/checkpoint before it.
    for (let i = beat - 1; i >= 0 && beat > 0; i--) {
      const b = def.beats[i];
      if (b.checkpoint) { spawn = new THREE.Vector3(...b.checkpoint); break; }
      if (b.target) { spawn = new THREE.Vector3(...b.target); break; }
    }
    this.player.spawn(spawn, def.yaw || 0);
    this.cam.endCinematic(this.player);
    this.cam.snapBehind(this.player);
    this.director = new Director(this, def);
    this.director.checkpoint = { pos: spawn.clone(), yaw: def.yaw || 0 };
    audio.playTheme(def.music || 'kim', 0);
    this.ui.loading(false);
    this.ui.showHUD(true);
    this.ui.fade(0, 0.8);
    this.state = 'playing';
    this.updateCounts();
    this.director.start(beat);
    this.input.requestLock();
    // Pre-compile shaders to avoid hitches.
    try { this.renderer.renderer.compile(this.world.scene, this.cam.camera); } catch (e) { /* ignore */ }
  }

  saveResume(beat) {
    if (!this.chapterDef || this.chapterDef.trial) return;
    this.save.data.resume = { chapter: this.chapterId, beat };
    this.save.write();
  }

  onChapterComplete() {
    const id = this.chapterId;
    this.ui.fade(0, 0.8);
    this.ui.setCine(false);
    this.ui.subtitle(null, null);
    const d = this.save.data;
    if (this.chapterDef.trial) {
      d.trialBest = 10;
      this.save.write();
      this.state = 'menu';
      this.input.releaseLock();
      this.ui.panel('The Proving Complete', '<p style="text-align:center">Ten waves, and you did not stay fallen.<br/>The ninth feather of your wing shines gold.</p>', [{ label: 'Return to Title', action: () => { this.ui.closePanel(); this.boot(); this.showTitle(); } }]);
      return;
    }
    d.completed[id] = true;
    d.unlocked = Math.max(d.unlocked, Math.min(7, id + 1));
    const reward = ARMOR_BY_CHAPTER[id];
    if (reward) d.upgrades[reward] = true;
    d.resume = id < 7 ? { chapter: id + 1, beat: 0 } : null;
    this.save.write();
    this.applyUpgrades();
    if (id === 7) return this.credits();
    this.state = 'menu';
    this.input.releaseLock();
    this.ui.showHUD(false);
    const f = Object.keys(d.found).filter((k) => k.startsWith(`f-${id}-`)).length;
    const s = Object.keys(d.found).filter((k) => k.startsWith(`s-${id}-`)).length;
    const r = d.found[`r-${id}`] ? 1 : 0;
    const mins = Math.floor((this.time - this.chapterStart) / 60);
    const a = reward ? ARMOR[reward] : null;
    const body = `
      <p style="text-align:center;font-family:Cinzel;letter-spacing:.3em;color:var(--gold)">CHAPTER ${CHAPTERS[id - 1].numeral} COMPLETE</p>
      <h3 style="text-align:center;font-family:Cinzel;font-size:28px;margin:6px 0 18px">${CHAPTERS[id - 1].title}</h3>
      ${a ? `<div class="entry" style="text-align:center;margin-bottom:18px"><div class="t">✦ ${a.name} ✦</div><div class="d">${a.desc}</div><div class="d" style="color:var(--gold)">${a.ref}</div></div>` : ''}
      <div class="stat-row"><span>Seraph Feathers</span><b>${f} / 12</b></div>
      <div class="stat-row"><span>Leaves of the Canticle</span><b>${s} / 3</b></div>
      <div class="stat-row"><span>Hidden Relic</span><b>${r} / 1</b></div>
      <div class="stat-row"><span>Time in Chapter</span><b>${mins} min</b></div>
      <div class="stat-row"><span>Total Completion</span><b>${this.completion()}%</b></div>`;
    this.ui.panel('Victory', body, [
      { label: 'Next Chapter', action: () => { this.ui.closePanel(); this.startChapter(id + 1, 0); } },
      { label: 'Replay Chapter', action: () => { this.ui.closePanel(); this.startChapter(id, 0); } },
      { label: 'Return to Title', action: () => { this.ui.closePanel(); this.boot(); this.showTitle(); } },
    ]);
  }

  onTrialWave(n) {
    const d = this.save.data;
    if (n > d.trialBest) { d.trialBest = n; this.save.write(); }
    this.player.heal(25);
    this.ui.toast(`Wave <b>${n}</b> overcome. Your wounds are mended.`);
  }

  credits() {
    this.state = 'credits';
    this.ui.fade(0, 0.6);
    this.ui.setCine(false);
    this.input.releaseLock();
    this.ui.showHUD(false);
    audio.playTheme('hope', 0);
    const roll = document.getElementById('credits-roll');
    roll.innerHTML = `
      <h1>VALKIMSMOR</h1><p style="letter-spacing:.5em;font-family:Cinzel">WINGS OF KIM</p>
      <div class="v">“I did not lift the land away from you. I lifted it so you could see the way home.”<br/><span style="font-size:18px;font-family:Cinzel;letter-spacing:.3em;color:var(--gold)">— The Canticle, the Final Leaf</span></div>
      <h3>THE WINGBEARER</h3><p>Valkimsmor of Kim, Oath Unbroken</p>
      <h3>THE FALLEN TEACHER</h3><p>Zekeriah, First of the Wingbearers</p>
      <h3>THE KEEPER OF THE CATHEDRAL</h3><p>Elder Ithiel</p>
      <h3>THE CAPTAIN OF THE ISLES</h3><p>Dorian</p>
      <h3>THOSE WHO WERE FREED</h3><p>Gorlath's Hundred · The Citizens of Kor-Jerah · Molochar the Smith · Tehomar of the Deep · The People of Zerkskis</p>
      <h3>AND</h3><p>The Stranger in the Flame, who was never named</p>
      <h3>MADE WITH</h3><p>three.js · the Web Audio API · a procedurally sung soundtrack</p>
      <h3>YOUR JOURNEY</h3><p>Completion ${this.completion()}% · Hollowed freed: ${this.save.data.stats.kills} · Perfect parries: ${this.save.data.stats.parries} · Falls: ${this.save.data.stats.deaths}</p>
      <div class="v">The last leaf of the Canticle is no longer blank.</div>
      <p style="margin-top:120px;font-family:Cinzel;letter-spacing:.4em">THANK YOU FOR PLAYING</p>`;
    this.ui.showScreen('credits', true);
    const end = () => { removeEventListener('keydown', end); this.ui.showScreen('credits', false); this.boot(); this.showTitle(); };
    setTimeout(() => addEventListener('keydown', end), 3000);
    setTimeout(end, 72000);
  }

  // ------------------------------------------------------------------ menus
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    const back = () => this.pause2();
    this.pauseBack = back;
    this.pause2();
  }
  pause2() {
    this.state = 'paused';
    this.ui.panel('Paused', `<p style="text-align:center;font-style:italic">${CHAPTERS[this.chapterId - 1] ? CHAPTERS[this.chapterId - 1].title : 'The Proving'} · Completion ${this.completion()}%</p>`, [
      { label: 'Resume', action: () => this.resume() },
      { label: 'Codex', action: () => this.journal('scrolls', () => this.pause2()) },
      { label: 'Options', action: () => this.options(() => this.pause2()) },
      { label: 'Controls', action: () => this.controls(() => this.pause2()) },
      { label: 'Restart from Checkpoint', action: () => { this.ui.closePanel(); this.resume(); this.respawn(); } },
      { label: 'Quit to Title', action: () => { this.ui.closePanel(); this.boot(); this.showTitle(); } },
    ]);
  }
  resume() {
    this.ui.closePanel();
    this.state = 'playing';
    this.input.requestLock();
  }

  journal(tab, back) {
    const d = this.save.data;
    const unlocked = d.unlocked;
    const render = (t) => {
      let html = `<div class="tabs">${['scrolls', 'codex', 'relics', 'oathmarks', 'stats'].map((k) => `<button class="${k === t ? 'on' : ''}" data-tab="${k}">${{ scrolls: 'The Canticle', codex: 'Lore', relics: 'Relics', oathmarks: 'Oathmarks', stats: 'Journey' }[k]}</button>`).join('')}</div>`;
      if (t === 'scrolls') {
        html += '<div class="grid">' + SCROLLS.map((s, i) => {
          const id = `s-${Math.floor(i / 3) + 1}-${i % 3}`;
          const has = d.found[id];
          return `<div class="entry ${has ? '' : 'locked'}" data-scroll="${has ? i : ''}"><div class="t">${has ? s.title : '— Undiscovered Leaf —'}</div><div class="d">${has ? s.ref : 'Chapter ' + CHAPTERS[Math.floor(i / 3)].numeral}</div></div>`;
        }).join('') + '</div>';
      } else if (t === 'codex') {
        html += CODEX.map((c) => c.ch <= unlocked ? `<div class="entry" style="margin-bottom:10px;cursor:default"><div class="t">${c.cat} · ${c.title}</div><div class="d" style="font-size:18px;line-height:1.5">${c.text}</div></div>` : `<div class="entry locked" style="margin-bottom:10px"><div class="t">— Sealed —</div></div>`).join('');
      } else if (t === 'relics') {
        html += '<div class="grid">' + RELICS.map((r, i) => {
          const has = d.found[`r-${i + 1}`];
          return `<div class="entry ${has ? '' : 'locked'}"><div class="t">${has ? r.name : '— Hidden Relic —'}</div><div class="d">${has ? r.text : 'Somewhere in Chapter ' + CHAPTERS[i].numeral}</div></div>`;
        }).join('') + '</div>';
      } else if (t === 'oathmarks') {
        html += '<div class="grid">' + Object.entries(ARMOR).map(([k, a]) => `<div class="entry ${d.upgrades[k] ? '' : 'locked'}"><div class="t">${d.upgrades[k] ? a.name : '— Unsworn —'}</div><div class="d">${d.upgrades[k] ? a.desc : ''}</div></div>`).join('') + '</div>';
      } else {
        const f = Object.keys(d.found).filter((k) => k.startsWith('f-')).length;
        const st = d.stats;
        html += [['Completion', this.completion() + '%'], ['Seraph Feathers', `${f} / 84`], ['Wing-beats', 2 + Math.floor(f / 12)], ['Hollowed Freed', st.kills], ['Perfect Parries', st.parries], ['Judgments Called', st.judgments], ['Times Fallen (and Risen)', st.deaths], ['Time Aloft', Math.floor(st.playTime / 60) + ' min'], ['Proving Best Wave', `${d.trialBest} / 10`]]
          .map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`).join('');
      }
      const body = this.ui.panel('Codex', html, [{ label: 'Back', action: () => { this.ui.closePanel(); back(); } }]);
      body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { audio.sfx('ui'); render(b.dataset.tab); }));
      body.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.scroll === '') return;
        const s = SCROLLS[+b.dataset.scroll];
        this.readerBack = () => render('scrolls');
        this.ui.closePanel();
        this.openReader('Leaf of the Canticle', s.title, s.verse, s.ref, s.text);
      }));
    };
    this.ui.showScreen('title-screen', false);
    render(tab);
  }

  options(back) {
    const S = this.save.data.settings;
    const render = () => {
      const row = (label, key, opts) => `<div class="opt"><span>${label}</span><div class="ctl">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(S[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
      const slider = (label, key, min, max, step) => `<div class="opt"><span>${label}</span><div class="ctl"><input type="range" data-s="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}"/></div></div>`;
      const html = row('Graphics Quality', 'quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) +
        row('Difficulty', 'difficulty', [['story', 'Story'], ['normal', 'Normal'], ['hard', 'Hard']]) +
        slider('Music Volume', 'music', 0, 1, 0.05) + slider('Effects Volume', 'sfx', 0, 1, 0.05) +
        slider('Look Sensitivity', 'sens', 0.3, 2.5, 0.05) + slider('Screen Shake', 'shake', 0, 1.5, 0.1) +
        row('Invert Look Y', 'invertY', [[false, 'Off'], [true, 'On']]) +
        row('Show FPS', 'fps', [[false, 'Off'], [true, 'On']]) +
        '<p style="margin-top:12px;font-size:16px;color:#b8ae98">Medium is tuned for integrated graphics (Intel Iris Xe) at 60 fps with adaptive resolution. Choose Low if frames dip in heavy battles.</p>';
      const body = this.ui.panel('Options', html, [{ label: 'Back', action: () => { this.ui.closePanel(); back(); } }]);
      body.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => {
        let v = b.dataset.v;
        if (v === 'true') v = true; else if (v === 'false') v = false;
        S[b.dataset.k] = v;
        this.applySettings();
        audio.sfx('ui');
        render();
      }));
      body.querySelectorAll('input[data-s]').forEach((inp) => inp.addEventListener('input', () => { S[inp.dataset.s] = +inp.value; this.applySettings(); }));
    };
    this.ui.showScreen('title-screen', false);
    render();
  }

  applySettings() {
    const S = this.save.data.settings;
    if (S.quality !== this.renderer.qualityName) this.renderer.setQuality(S.quality);
    audio.setVolumes(S.music, S.sfx);
    this.input.sensitivity = S.sens;
    this.input.invertY = S.invertY;
    this.save.write();
    this.showFps(S.fps);
  }

  showFps(on) {
    let el = document.getElementById('fps');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fps';
      el.style.cssText = 'position:fixed;right:8px;bottom:6px;font:12px monospace;color:#cfc;z-index:99;text-shadow:0 1px 2px #000';
      document.body.appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
  }

  controls(back) {
    const k = [['Move', 'W A S D'], ['Look', 'Mouse'], ['Jump / Wing-beat', 'Space'], ['Glide', 'Hold Space (air)'], ['Dash (invulnerable)', 'Shift'], ['Strike / Combo', 'Left Click'], ['Heavy Blow', 'Right Click'], ['Wing Dive', 'Right Click (air)'], ['Parry', 'Q'], ['Judgment', 'F (halo full)'], ['Interact / Read', 'E'], ['Lock On', 'Tab / Middle Click'], ['Codex', 'I'], ['Pause', 'Esc'], ['Gamepad', 'A jump · B dash · X strike · Y heavy'], ['', 'LB parry · RB Judgment · LT interact · RT lock']];
    this.ui.showScreen('title-screen', false);
    this.ui.panel('Controls', `<div class="controls">${k.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>`, [{ label: 'Back', action: () => { this.ui.closePanel(); back(); } }]);
  }

  openReader(kind, title, verse, ref, text) {
    this.prevState = this.state === 'reading' ? this.prevState : this.state;
    this.state = 'reading';
    this.input.releaseLock();
    this.ui.reader(kind, title, verse, ref, text);
    this.readerOpenT = performance.now();
  }
  closeReader() {
    this.ui.closeReader();
    if (this.readerBack) { const b = this.readerBack; this.readerBack = null; this.state = this.prevState; return b(); }
    this.state = this.prevState === 'paused' ? 'paused' : 'playing';
    if (this.state === 'playing') this.input.requestLock();
  }

  // ------------------------------------------------------------------ gameplay events
  difficultyDamage() { return { story: 1.35, normal: 1, hard: 0.85 }[this.save.data.settings.difficulty] || 1; }
  difficultyTaken() { return { story: 0.5, normal: 1, hard: 1.5 }[this.save.data.settings.difficulty] || 1; }
  get inCombat() { return this.enemies.some((e) => e.alive && e.pos.distanceTo(this.player.pos) < 25); }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(scale, dur) { this.slowScale = scale; this.slowT = dur; }
  flash(color, amt) { this.renderer.grade.uniforms.flashColor.value.set(color); this.flashAmt = Math.max(this.flashAmt, amt); }
  cameraShake(a) { this.cam.shake(a * (this.save.data.settings.shake ?? 1)); }
  cameraKick(f) { this.cam.kick(f); }
  spawnProjectile(p) { this.projectiles.push(p); }
  setMarker(p) { this.markerPos = p ? p.clone() : null; }
  setBossTarget(b) { this.bossTarget = b; }

  spawnWave(groups) {
    for (const g of groups) {
      for (let i = 0; i < g.n; i++) {
        let pos = null;
        for (let k = 0; k < 20 && !pos; k++) {
          const a = Math.random() * Math.PI * 2, r = (g.spread || 8) * (0.4 + Math.random() * 0.6);
          const x = g.at[0] + Math.sin(a) * r, z = g.at[1] + Math.cos(a) * r;
          const y = this.world.surfaceAt(x, z);
          if (isFinite(y) && y > this.world.killY + 2 && (!this.world.lava || y > this.world.lava.y + 0.3)) pos = new THREE.Vector3(x, y + (g.type === 'wraith' ? 5 : 0), z);
        }
        if (!pos) { const y = this.world.surfaceAt(g.at[0], g.at[1]); pos = new THREE.Vector3(g.at[0], isFinite(y) ? y : this.player.pos.y, g.at[1]); }
        const e = makeEnemy(this, g.type, pos, g.opts);
        this.enemies.push(e);
        this.fx.burst(pos.clone().add(_v.set(0, 1, 0)), 16, { speed: 4, color: [0.9, 0.3, 1.4], life: 0.8, size: 0.6, dir: _v.clone(), spread: 0.5 });
        if (e.isBoss || g.type === 'elite') this.ui.toast(`<b>${e.name}</b> joins the fray!`, 'warn');
      }
    }
    this.audio.sfx('teleport');
  }

  clearEnemies(keepBoss = false) {
    for (const e of this.enemies) {
      if (keepBoss && e === this.bossTarget) continue;
      e.releaseToken && e.releaseToken();
      if (e.model) this.world.dynamic.remove(e.model.root);
    }
    this.enemies = keepBoss ? this.enemies.filter((e) => e === this.bossTarget) : [];
    for (const p of this.projectiles) p.kill && p.kill(false);
    this.projectiles = [];
    this.attackTokens = 2;
    if (!keepBoss) this.lockTarget = null;
  }

  onEnemyHit(e, hit, dmg, armored) {
    this.audio.sfx('hit', { heavy: hit.power > 1.5 });
    this.renderer.grade.uniforms.aberration.value = 0.25 * hit.power;
  }

  onEnemyKilled(e, silent) {
    this.save.data.stats.kills++;
    this.player.addGlory(e.xp || 8);
    if (!silent) this.audio.sfx('enemyDie');
    if (e === this.bossTarget && !e.isBoss) return this.onBossDefeated(e);
    const left = this.enemies.filter((o) => o.alive).length;
    if (left === 0 && !silent) { this.slowmo(0.3, 0.5); this.cam.kick(8); }
  }

  releaseSoul(pos, size = 1) {
    const s = glowSprite(0xfff4d8, 1.6 * size, 1);
    s.position.copy(pos);
    this.world.dynamic.add(s);
    this.souls.push({ s, pos: pos.clone(), t: 0, size, heal: size <= 1.5 });
  }

  updateSouls(dt) {
    const p = this.player;
    for (const so of this.souls) {
      so.t += dt;
      if (so.t < 1.0 || !so.heal) {
        so.pos.y += dt * 3 * (1 - so.t * 0.3);
        so.pos.x += Math.sin(so.t * 5) * dt;
      } else {
        const target = p.chestPos(_v);
        so.pos.lerp(target, Math.min(1, dt * 6));
        if (so.pos.distanceTo(target) < 0.8) {
          p.heal(4);
          so.done = true;
          this.fx.burst(so.pos, 8, { speed: 3, color: [1.6, 1.5, 1.2], life: 0.4, size: 0.4 });
        }
      }
      if (!so.heal && so.t > 3) so.done = true;
      so.s.position.copy(so.pos);
      so.s.material.opacity = so.heal ? 1 : Math.max(0, 1 - so.t / 3);
      if (Math.random() < 0.4) this.fx.spawn(so.pos.x, so.pos.y, so.pos.z, 0, 0.5, 0, { life: 0.5, size: 0.3 * so.size, color: [1.6, 1.5, 1.2] });
      if (so.done) this.world.dynamic.remove(so.s);
    }
    this.souls = this.souls.filter((s) => !s.done);
  }

  onParry(att, pos) {
    this.save.data.stats.parries++;
    this.audio.sfx('parry');
    this.slowmo(0.2, 0.45);
    this.flash(0xfff4d8, 0.35);
    this.cam.kick(10);
    this.cameraShake(0.2);
    this.fx.burst(pos, 30, { speed: 10, color: [1.8, 1.6, 1.0], life: 0.4, size: 0.5 });
    this.fx.ring(this.player.pos, 30, { speed: 10, color: [1.6, 1.4, 0.8], life: 0.4, size: 0.5, y: 1.2 });
    if (!this.parryTaught) { this.parryTaught = true; this.ui.toast('<b>Perfect Parry!</b> Strike now for a riposte.', 'hint'); }
  }

  onPlayerHurt(dmg, src) {
    this.audio.sfx('hurt');
    this.hurtAmt = Math.min(1, this.hurtAmt + 0.6);
    this.cameraShake(0.3);
    this.hitstop(0.05);
  }

  onPlayerDeath() {
    this.save.data.stats.deaths++;
    this.save.write();
    this.slowmo(0.3, 1.5);
    this.lockTarget = null;
    setTimeout(() => {
      if (!this.player.dead) return;
      this.state = 'dead';
      this.input.releaseLock();
      const [q, r] = DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)];
      this.ui.death(q, r, [
        { label: 'Rise Again', action: () => { this.ui.showScreen('death', false); this.respawn(); this.state = 'playing'; this.input.requestLock(); } },
        { label: 'Quit to Title', action: () => { this.ui.showScreen('death', false); this.boot(); this.showTitle(); } },
      ]);
    }, 2200);
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.revived = false;
    p.scripted = null;
    p.fireWard = false;
    this.ui.setBoss(null);
    if (this.world.lava && this.world.lava.target !== undefined) this.world.lava.target = 0;
    this.director.restart();
    this.ui.fade(1, 0.01);
    setTimeout(() => this.ui.fade(0, 1), 50);
  }

  onSalvation() {
    this.flash(0xffe8a0, 0.8);
    this.slowmo(0.2, 0.8);
    this.audio.stinger('holy');
    this.fx.burst(this.player.chestPos(), 80, { speed: 8, color: [1.8, 1.6, 0.9], life: 1, size: 0.6 });
    this.ui.toast('<b>Oathmark of Rising</b> — you will not stay fallen!', 'hint');
  }

  onFell() {
    this.audio.sfx('hurt');
    this.ui.toast('The winds failed you... you are carried back to solid ground.');
    this.ui.fade(1, 0.01);
    setTimeout(() => this.ui.fade(0, 0.6), 60);
  }

  onJudgmentStart() {
    this.save.data.stats.judgments++;
    this.slowmo(0.5, 1.2);
    this.cam.kick(-8);
    this.audio.stinger('epic');
  }

  onBossDefeated(boss) {
    boss.defeated = true;
    this.ui.setBoss(null);
    this.slowmo(0.2, 2);
    this.flash(0xfff0d0, 0.7);
    this.audio.sfx('impact');
    this.lockTarget = null;
    const b = this.director && this.director.beat;
    setTimeout(() => {
      if (!b || b.type !== 'boss') return;
      this.clearEnemies(true);
      const steps = typeof b.outro === 'function' ? b.outro(this) : b.outro;
      this.playCinematic(steps || [], () => {
        if (boss.vanish && boss.state !== 'dead') boss.vanish();
        b.state.outroDone = true;
      });
    }, 1600);
  }

  onFurnaceHeated(boss) { this.chapterDef.onFurnaceHeated && this.chapterDef.onFurnaceHeated(boss); }
  onZekeriahPhase(n) { this.chapterDef.onZekeriahPhase && this.chapterDef.onZekeriahPhase(n, this.bossTarget); }

  landingFx(pos) {
    this.fx.ring(pos, 70, { speed: 18, color: [1.6, 1.4, 0.9], life: 0.7, size: 0.9 });
    this.fx.burst(pos, 40, { speed: 10, color: [1.6, 1.4, 1], life: 0.8, size: 0.6, dir: _v.set(0, 1, 0).clone(), spread: 1 });
    this.smoke.burst(pos, 14, { speed: 6, color: [0.9, 0.85, 0.8], life: 1.5, size: 3.5, alpha: 0.5 });
    this.flash(0xfff4e0, 0.3);
  }

  liftDarkness(arg) {
    const W = this.world;
    const u = W.sky.uniforms;
    const to = arg === 'dawn' || !arg ? DAWN : { ...DAWN, horizon: arg };
    this.skyLerp = {
      t: 0, dur: 6,
      from: { top: u.topColor.value.clone(), horizon: u.horizonColor.value.clone(), bottom: u.bottomColor.value.clone(), sun: u.sunColor.value.clone(), cloud: u.cloudColor.value.clone(), cloudShadow: u.cloudShadow.value.clone(), fog: W.scene.fog.color.clone(), far: W.scene.fog.far, near: W.scene.fog.near, stars: u.stars.value, hemi: W.hemi.intensity, sunI: W.sun.intensity },
      to: { ...Object.fromEntries(Object.entries(to).map(([k, v]) => [k, new THREE.Color(v)])), fog: new THREE.Color(0xffd8b0), far: 600, near: 90, stars: 0, hemi: 1.3, sunI: 2.4 },
    };
  }

  updateSkyLerp(dt) {
    const L = this.skyLerp;
    if (!L) return;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    const e = k * k * (3 - 2 * k);
    const u = this.world.sky.uniforms;
    for (const [key, uni] of [['top', 'topColor'], ['horizon', 'horizonColor'], ['bottom', 'bottomColor'], ['sun', 'sunColor'], ['cloud', 'cloudColor'], ['cloudShadow', 'cloudShadow']]) {
      u[uni].value.copy(L.from[key]).lerp(L.to[key], e);
    }
    const W = this.world;
    W.scene.fog.color.copy(L.from.fog).lerp(L.to.fog, e);
    W.scene.fog.far = L.from.far + (L.to.far - L.from.far) * e;
    W.scene.fog.near = L.from.near + (L.to.near - L.from.near) * e;
    u.stars.value = L.from.stars * (1 - e);
    W.hemi.intensity = L.from.hemi + (L.to.hemi - L.from.hemi) * e;
    W.sun.intensity = L.from.sunI + (L.to.sunI - L.from.sunI) * e;
    if (k >= 1) this.skyLerp = null;
  }

  collect(c) {
    if (c.taken) return;
    c.take();
    this.save.mark(c.id);
    this.collectibles = this.collectibles.filter((o) => o !== c);
    if (c.kind === 'feather') {
      this.audio.sfx('feather');
      const total = Object.keys(this.save.data.found).filter((k) => k.startsWith('f-')).length;
      if (total % 12 === 0) {
        this.applyUpgradesKeepHp();
        this.audio.stinger('holy');
        this.ui.toast(`<b>${total} Seraph Feathers</b> — your wings grow stronger: +1 wing-beat, +10 Vigor.`, 'hint');
      } else this.ui.toast(`Seraph Feather <b>${total}</b> / 84`);
    } else if (c.kind === 'scroll') {
      this.audio.sfx('scroll');
      const s = c.data.scroll;
      this.openReader('Leaf of the Canticle', s.title, s.verse, s.ref, s.text);
    } else {
      this.audio.sfx('relic');
      const r = c.data.relic;
      this.openReader('Hidden Relic', r.name, '', '', r.text);
    }
    this.updateCounts();
  }

  applyUpgradesKeepHp() {
    const hp = this.player.hp;
    this.applyUpgrades();
    this.player.hp = Math.min(this.player.maxHp, hp + 10);
  }

  updateCounts() {
    const f = Object.keys(this.save.data.found);
    this.ui.setCounts(f.filter((k) => k.startsWith('f-')).length, 84, f.filter((k) => k.startsWith('s-')).length, 21, f.filter((k) => k.startsWith('r-')).length, 7);
  }

  playCinematic(steps, onDone) {
    this.cinematicActive = true;
    this.ui.setCine(true);
    this.ui.prompt(null);
    this.ui.marker(0, 0, 0, false);
    this.lockTarget = null;
    this.player.action = null;
    this.player.trail.active = false;
    this.cinematic = new Cinematic(this, steps, (skipped) => {
      this.cinematic = null;
      this.cinematicActive = false;
      this.cineEndT = performance.now();
      this.ui.setCine(false);
      this.player.scripted = null;
      this.cam.endCinematic(this.player);
      // Make sure the player isn't left floating in mid-air from a scripted flight.
      this.player.vel.set(0, 0, 0);
      onDone && onDone(skipped);
    });
  }

  // ------------------------------------------------------------------ main loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let raw = (now - this.last) / 1000;
    this.last = now;
    if (raw > 0.1) raw = 0.1;
    this.renderer.adapt(raw);
    this.fpsAcc += raw; this.fpsN++;
    if (this.fpsAcc > 0.5) {
      const el = document.getElementById('fps');
      if (el) el.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps · ${(this.renderer.dynScale * 100).toFixed(0)}% res`;
      this.fpsAcc = 0; this.fpsN = 0;
    }
    try {
      this.step(raw);
    } catch (e) {
      console.error(e);
    }
    this.input.endFrame();
  }

  step(raw) {
    const input = this.input;
    input.pollGamepad();
    this.ui.update(raw);

    if (this.state === 'reading') {
      if ((input.pressed('KeyE') || input.pressed('Enter') || input.pressed('Escape') || input.gpPressed(0) || input.gpPressed(1)) && performance.now() - this.readerOpenT > 300) this.closeReader();
    }
    if (this.state === 'paused' && input.pressed('Escape') && this.ui.activeMenu) { /* handled via menu */ }
    if (this.state === 'playing' && !this.cinematicActive) {
      if (input.pausePressed) { this.pause(); }
      else if (input.journalPressed) { this.state = 'paused'; this.input.releaseLock(); this.journal('scrolls', () => this.pause2()); }
    }

    const running = this.state === 'playing' || this.state === 'boot' || this.state === 'title' || this.state === 'dead' || this.state === 'loading';
    if (!running || !this.world) {
      this.render();
      return;
    }
    // Time scaling: hitstop freezes, slowmo stretches.
    let scale = 1;
    if (this.hitstopT > 0) { this.hitstopT -= raw; scale = 0.03; }
    else if (this.slowT > 0) { this.slowT -= raw; scale = this.slowScale; }
    const dt = raw * scale;
    this.time += dt;
    if (this.state === 'playing') this.save.data.stats.playTime += raw;

    const inGame = this.state === 'playing' || this.state === 'dead';
    const controls = this.state === 'playing' && !this.cinematicActive;
    if (this.cinematic) this.cinematic.update(raw, input);

    // Player
    this.player.update(dt, input, this.cam.yaw, controls);
    if (inGame && this.world.lava && !this.player.dead) {
      const L = this.world.lava;
      if (this.player.pos.y < L.y + 0.05 && this.player.onGround && !this.player.fireWard && !this.cinematicActive) {
        this.player.hp -= L.dps * dt * this.difficultyTaken();
        this.player.hurtFlash = 0.1;
        this.hurtAmt = Math.min(1, this.hurtAmt + dt * 2);
        if (Math.random() < 0.3) this.fx.spawn(this.player.pos.x, this.player.pos.y + 0.3, this.player.pos.z, (Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2, { life: 0.5, size: 0.6, color: [1.8, 0.6, 0.1] });
        if (this.player.hp <= 0) this.player.die();
      }
    }
    // Enemies & projectiles
    if (inGame) {
      for (const e of this.enemies) e.update(dt);
      this.enemies = this.enemies.filter((e) => e.state !== 'dead' || e === this.bossTarget);
      for (const p of this.projectiles) p.update(dt);
      this.projectiles = this.projectiles.filter((p) => p.alive);
    }
    // Collectibles & interaction prompt
    let promptObj = null;
    if (inGame) {
      for (const c of this.collectibles) { c.update(dt, this.player); if (c.near && c.interact) promptObj = c; }
      for (const it of this.interactables) { it.update(dt, this.player); if (it.near) promptObj = it; }
    }
    if (controls && promptObj) {
      this.ui.prompt(promptObj.prompt || (promptObj.kind === 'scroll' ? 'Read the Leaf of the Canticle' : 'Take the Relic'));
      if (input.interactPressed) {
        if (promptObj.use) promptObj.use(); else this.collect(promptObj);
        this.ui.prompt(null);
      }
    } else this.ui.prompt(null);

    if (inGame && this.director && !this.player.dead) this.director.update(dt);
    if (this.chapterDef && this.chapterDef.update && inGame) this.chapterDef.update(dt);

    // Lock-on
    if (controls && input.lockPressed) this.toggleLock();
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.pos.distanceTo(this.player.pos) > 45)) this.lockTarget = null;
    this.cam.lockTarget = this.lockTarget;
    this.player.bossCam = this.bossTarget && this.bossTarget.alive && this.bossTarget.isBoss ? 9 + this.bossTarget.radius : 0;

    this.cam.update(raw, input, this.player, this.world, controls);
    this.world.update(this.time, dt, this.player.pos);
    this.updateSkyLerp(dt);
    this.fx.update(dt);
    this.smoke.update(dt);
    if (inGame) this.updateSouls(dt);
    this.updateHUD(raw);
    this.render();
  }

  toggleLock() {
    if (this.lockTarget) { this.lockTarget = null; return; }
    const cam = this.cam.camera;
    let best = null, bestScore = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.player.pos);
      if (d > 40) continue;
      _v.copy(e.pos).project(cam);
      if (_v.z > 1) continue;
      const score = Math.hypot(_v.x, _v.y) * 20 + d * 0.3;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    this.lockTarget = best;
    if (best) this.audio.sfx('ui', { f: 1100 });
  }

  project(p) {
    _v.copy(p).project(this.cam.camera);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - 40; }
    return { x, y, behind };
  }

  updateHUD(raw) {
    const p = this.player;
    const g = this.renderer.grade.uniforms;
    this.flashAmt = damp(this.flashAmt, 0, 3, raw);
    g.flash.value = this.flashAmt;
    const low = p.hp / p.maxHp < 0.25 && !p.dead ? 0.35 + Math.sin(this.time * 6) * 0.15 : 0;
    this.hurtAmt = damp(this.hurtAmt, 0, 2.5, raw);
    g.hurt.value = Math.max(this.hurtAmt * 0.8, low);
    g.aberration.value = damp(g.aberration.value, this.hitstopT > 0 ? 0.6 : 0, 8, raw);
    g.desat.value = damp(g.desat.value, p.dead ? 0.8 : 0, 2, raw);
    if (this.state !== 'playing') { this.ui.marker(0, 0, 0, false); this.ui.lock(0, 0, false); return; }
    this.ui.updateVitals(p);
    const b = this.bossTarget;
    if (b && !b.defeated && b.hp > 0 && !this.cinematicActive && (b.state !== 'intro' || !b.isBoss) && (b.state !== 'spawn' || b.stateT > 0.8)) this.ui.setBoss(b.name, b.hp / b.maxHp);
    else if (!b || b.defeated) this.ui.setBoss(null);
    if (this.markerPos && !this.cinematicActive) {
      const s = this.project(_v.copy(this.markerPos).add(new THREE.Vector3(0, 2, 0)));
      const cx = clamp(s.x, 40, innerWidth - 40), cy = clamp(s.y, 60, innerHeight - 60);
      this.ui.marker(cx, cy, this.markerPos.distanceTo(p.pos), true);
    } else this.ui.marker(0, 0, 0, false);
    if (this.lockTarget && !this.cinematicActive) {
      const lt = this.lockTarget;
      const s = this.project(new THREE.Vector3(lt.pos.x, lt.pos.y + lt.height * 0.6, lt.pos.z));
      this.ui.lock(s.x, s.y, !s.behind);
    } else this.ui.lock(0, 0, false);
  }

  render() {
    if (!this.world) return;
    this.renderer.render(this.world.scene, this.cam.camera, this.time);
  }
}

window.game = new Game();
