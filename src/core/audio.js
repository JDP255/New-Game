// Procedural orchestral soundtrack + sound effects built entirely on the Web Audio API.
// No samples are loaded: choir, strings, brass, harp, taiko and bells are synthesised live.

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// Themes. Notes are MIDI numbers. Each chord lasts one bar (16 sixteenth steps).
// melody: array of [midi|null, steps]. The main "Valkimsmor motif" is shared and
// re-harmonised across themes so it becomes the identity of the whole game.
// ---------------------------------------------------------------------------
const MOTIF = [
  [74, 4], [69, 2], [74, 2], [76, 4], [77, 4],
  [76, 6], [74, 2], [72, 4], [69, 4],
  [70, 4], [74, 2], [77, 2], [79, 4], [77, 4],
  [76, 8], [73, 4], [69, 4],
  [74, 4], [69, 2], [74, 2], [76, 4], [77, 4],
  [79, 6], [77, 2], [76, 4], [72, 4],
  [77, 4], [74, 4], [70, 4], [74, 4],
  [73, 4], [76, 4], [81, 8],
];
const transpose = (mel, s) => mel.map(([n, d]) => [n == null ? null : n + s, d]);

const THEMES = {
  title: {
    bpm: 74,
    chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [45, 52, 57, 61]],
    melody: MOTIF, melodyVoice: 'brass', arp: true, choir: true,
    drums: 'slow', ostinato: false, bassOct: 38,
  },
  kim: {
    bpm: 84,
    chords: [[50, 57, 62, 65], [53, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]],
    melody: [
      [74, 4], [69, 2], [74, 2], [76, 4], [77, 4], [76, 6], [74, 2], [72, 8],
      [72, 4], [74, 2], [76, 2], [79, 8], [78, 8], [null, 8], [74, 8],
      [null, 16], [null, 16],
    ],
    melodyVoice: 'flute', arp: true, choir: false, drums: 'light', ostinato: true, bassOct: 38,
  },
  battle: {
    bpm: 128,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]],
    melody: MOTIF, melodyVoice: 'brass', arp: false, choir: true, drums: 'battle', ostinato: true, bassOct: 38,
  },
  zerk: {
    bpm: 78,
    chords: [[48, 55, 60, 63], [49, 56, 61, 65], [48, 55, 60, 63], [46, 53, 58, 61]],
    melody: [
      [72, 8], [73, 4], [72, 4], [70, 8], [67, 8], [null, 16],
      [68, 6], [67, 2], [65, 8], [67, 12], [null, 4],
      [null, 16], [null, 16],
    ],
    melodyVoice: 'choir', arp: false, choir: true, drums: 'slow', ostinato: true, bassOct: 36,
  },
  boss: {
    bpm: 140,
    chords: [[52, 59, 64, 67], [53, 60, 65, 69], [52, 59, 64, 67], [50, 57, 62, 66]],
    melody: transpose(MOTIF, 2), melodyVoice: 'brass', arp: false, choir: true, drums: 'boss', ostinato: true, bassOct: 40,
  },
  zekeriah: {
    bpm: 136,
    chords: [[48, 55, 60, 63], [44, 51, 56, 60], [41, 53, 56, 60], [43, 50, 55, 59]],
    melody: [
      [72, 4], [75, 4], [79, 8], [80, 6], [79, 2], [75, 8],
      [77, 4], [75, 4], [72, 8], [74, 8], [71, 8],
      [72, 4], [67, 2], [72, 2], [74, 4], [75, 4], [74, 6], [72, 2], [71, 8],
      [68, 8], [67, 8], [67, 16],
    ],
    melodyVoice: 'organ', arp: false, choir: true, drums: 'boss', ostinato: true, bassOct: 36,
  },
  hope: {
    bpm: 70,
    chords: [[50, 57, 62, 66], [45, 57, 61, 64], [47, 54, 59, 62], [43, 55, 59, 62]],
    melody: transpose([
      [74, 4], [69, 2], [74, 2], [76, 4], [78, 4], [76, 6], [74, 2], [73, 4], [69, 4],
      [71, 4], [74, 2], [78, 2], [79, 4], [78, 4], [76, 8], [74, 8],
    ], 0),
    melodyVoice: 'flute', arp: true, choir: true, drums: 'slow', ostinato: false, bassOct: 38,
  },
};

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.musicVolume = 0.7;
    this.sfxVolume = 0.85;
    this.intensity = 0; // 0 explore, 1 combat, 2 boss/epic
    this.theme = null;
    this.pendingTheme = null;
    this.step = 0;
    this.melodyIdx = 0;
    this.melodyStepLeft = 0;
    this.bar = 0;
  }

  init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeIR(3.4, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.55;
    this.musicBus.connect(this.master);
    this.musicSend = ctx.createGain();
    this.musicSend.gain.value = 0.5;
    this.musicBus.connect(this.musicSend).connect(this.reverb);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.sfxSend = ctx.createGain();
    this.sfxSend.gain.value = 0.25;
    this.sfxBus.connect(this.sfxSend).connect(this.reverb);

    // Layer buses so intensity can crossfade smoothly.
    this.layers = {};
    for (const name of ['pad', 'arp', 'bass', 'ost', 'drums', 'mel', 'choir']) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.layers[name] = g;
    }

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.ready = true;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
    this.applyLayerMix(true);
  }

  makeIR(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ready) return;
    this.musicBus.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1);
  }

  playTheme(name, intensity = null) {
    if (intensity !== null) this.intensity = intensity;
    if (!this.ready) { this.theme = THEMES[name]; this.themeName = name; return; }
    if (this.themeName === name) { this.applyLayerMix(); return; }
    this.themeName = name;
    if (!this.theme) {
      this.theme = THEMES[name];
      this.resetSeq();
    } else {
      this.pendingTheme = THEMES[name];
      // Duck the current music so the change lands on the next downbeat gracefully.
      this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.25, this.ctx.currentTime, 0.4);
    }
    this.applyLayerMix();
  }

  stopMusic(fade = 1.5) {
    this.themeName = null;
    this.pendingTheme = null;
    this.theme = null;
    if (!this.ready) return;
    for (const g of Object.values(this.layers)) g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
  }

  setIntensity(level) {
    if (this.intensity === level) return;
    this.intensity = level;
    this.applyLayerMix();
  }

  applyLayerMix(instant = false) {
    if (!this.ready) return;
    const i = this.intensity;
    const th = this.theme || this.pendingTheme;
    const mix = {
      pad: 0.5,
      arp: th && th.arp ? (i === 0 ? 0.55 : 0.25) : 0,
      bass: i === 0 ? 0.35 : 0.55,
      ost: th && th.ostinato ? (i === 0 ? 0.0 : i === 1 ? 0.42 : 0.5) : 0,
      drums: i === 0 ? (th && th.drums === 'light' ? 0.0 : 0.3) : i === 1 ? 0.75 : 0.9,
      mel: i === 0 ? 0.42 : 0.55,
      choir: th && th.choir ? (i === 2 ? 0.55 : 0.3) : 0.15,
    };
    if (th && (this.themeName === 'title' || this.themeName === 'hope')) { mix.drums = 0.45; mix.ost = 0.2; }
    const t = this.ctx.currentTime;
    for (const [k, v] of Object.entries(mix)) {
      if (instant) this.layers[k].gain.value = v;
      else this.layers[k].gain.setTargetAtTime(v, t, 0.8);
    }
  }

  resetSeq() {
    this.step = 0;
    this.bar = 0;
    this.melodyIdx = 0;
    this.melodyStepLeft = 0;
  }

  schedule() {
    if (!this.ready || this.ctx.state !== 'running') {
      if (this.ready) this.nextTime = this.ctx.currentTime + 0.05;
      return;
    }
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextTime < ahead) {
      if (this.theme) {
        const stepDur = 60 / this.theme.bpm / 4;
        this.playStep(this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
        if (this.step % 16 === 0) {
          this.bar++;
          if (this.pendingTheme) {
            this.theme = this.pendingTheme;
            this.pendingTheme = null;
            this.resetSeq();
            this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.55, this.nextTime, 0.3);
            this.cymbal(this.nextTime, 0.25);
          }
        }
      } else {
        this.nextTime += 0.1;
      }
    }
  }

  playStep(t, sd) {
    const th = this.theme;
    const s = this.step % 16;
    const chord = th.chords[this.bar % th.chords.length];
    const barDur = sd * 16;
    const L = this.layers;

    if (s === 0) {
      this.padChord(chord.map((n) => n + 12), t, barDur * 1.02, L.pad);
      if (th.choir) this.choirChord([chord[1] + 12, chord[2] + 12, chord[3] + 12], t, barDur, L.choir);
      const bassNote = th.bassOct + ((chord[0] - th.bassOct) % 12 + 12) % 12;
      this.bass(midiToFreq(bassNote), t, barDur * 0.95, L.bass);
    }
    if (th.arp && s % 2 === 0) {
      const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
      const n = chord[pattern[(s / 2) % 8]] + 12 + (s >= 8 ? 12 : 0);
      this.pluck(midiToFreq(n), t, L.arp, 0.22);
    }
    if (th.ostinato) {
      const pat = [0, 0, 2, 0, 1, 0, 2, 3, 0, 0, 2, 0, 1, 3, 2, 1];
      const n = chord[pat[s]] + (pat[s] === 0 ? 12 : 0);
      this.stacc(midiToFreq(n), t, L.ost, s % 4 === 0 ? 0.2 : 0.13);
    }
    this.drums(th.drums, s, t, L.drums);

    // Melody voice.
    if (this.melodyStepLeft <= 0) {
      const mel = th.melody;
      const [note, dur] = mel[this.melodyIdx % mel.length];
      this.melodyIdx++;
      this.melodyStepLeft = dur;
      if (note != null) {
        const f = midiToFreq(note);
        const d = dur * sd;
        if (th.melodyVoice === 'brass') this.brass(f, t, d, L.mel);
        else if (th.melodyVoice === 'flute') this.flute(f, t, d, L.mel);
        else if (th.melodyVoice === 'organ') this.organ(f, t, d, L.mel);
        else this.choirVoice(f, t, d, L.mel, 0.16);
      }
    }
    this.melodyStepLeft--;
  }

  drums(style, s, t, dest) {
    if (style === 'battle') {
      if (s === 0 || s === 6 || s === 10) this.taiko(t, 1, dest);
      if (s === 3 || s === 13) this.taiko(t, 0.5, dest, 1.6);
      if (s === 4 || s === 12) this.rim(t, dest, 0.3);
      if (s % 2 === 1) this.hat(t, dest, 0.05);
    } else if (style === 'boss') {
      if (s % 4 === 0) this.taiko(t, 1, dest);
      if (s === 7 || s === 14 || s === 15) this.taiko(t, 0.6, dest, 1.5);
      if (s === 4 || s === 12) this.rim(t, dest, 0.45);
      this.hat(t, dest, s % 2 ? 0.04 : 0.07);
    } else if (style === 'slow') {
      if (s === 0) this.taiko(t, 0.9, dest, 0.8);
      if (s === 10) this.taiko(t, 0.45, dest, 1);
    } else if (style === 'light') {
      if (s === 0 || s === 8) this.taiko(t, 0.4, dest, 1.2);
    }
  }

  // ---------------------------------------------------------------- voices
  env(g, t, a, peak, d, sustain, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sustain, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, rel);
  }

  padChord(notes, t, dur, dest) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    this.env(g, t, 0.5, 0.06, 1, 0.8, 0.45, t + dur);
    f.connect(g).connect(dest);
    for (const n of notes) {
      for (const det of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 2);
      }
    }
  }

  formantChain(dest, gainScale = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gainScale;
    out.connect(dest);
    const input = ctx.createGain();
    for (const [freq, q, amp] of [[700, 6, 1], [1150, 8, 0.6], [2800, 10, 0.25]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const a = ctx.createGain();
      a.gain.value = amp;
      input.connect(bp).connect(a).connect(out);
    }
    return input;
  }

  choirChord(notes, t, dur, dest) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    this.env(g, t, 0.8, 0.35, 1, 0.9, 0.6, t + dur);
    g.connect(dest);
    const input = this.formantChain(g, 1);
    for (const n of notes) {
      for (const det of [-10, 0, 11]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(n);
        o.detune.value = det;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.5 + Math.random();
        const lg = ctx.createGain();
        lg.gain.value = 6;
        lfo.connect(lg).connect(o.detune);
        o.connect(input);
        o.start(t); lfo.start(t);
        o.stop(t + dur + 2.5); lfo.stop(t + dur + 2.5);
      }
    }
  }

  choirVoice(f, t, dur, dest, amp = 0.2) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    this.env(g, t, 0.15, amp * 2.5, 0.5, 0.85, 0.25, t + dur);
    g.connect(dest);
    const input = this.formantChain(g);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const lg = ctx.createGain();
      lg.gain.value = 9;
      lfo.connect(lg).connect(o.detune);
      o.connect(input);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 1.5); lfo.stop(t + dur + 1.5);
    }
  }

  bass(f, t, dur, dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    this.env(g, t, 0.08, 0.22, 0.6, 0.7, 0.3, t + dur);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(dest);
    o.start(t); o2.start(t);
    o.stop(t + dur + 1.5); o2.stop(t + dur + 1.5);
  }

  pluck(f, t, dest, amp = 0.2) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(dest);
    o.start(t); o2.start(t);
    o.stop(t + 1.5); o2.stop(t + 1.5);
  }

  stacc(f, t, dest, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = f;
    o2.detune.value = 12;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(lp); o2.connect(lp);
    lp.connect(g).connect(dest);
    o.start(t); o2.start(t);
    o.stop(t + 0.25); o2.stop(t + 0.25);
  }

  brass(f, t, dur, dest) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.linearRampToValueAtTime(2400, t + 0.09);
    lp.frequency.setTargetAtTime(1400, t + 0.1, 0.3);
    const g = ctx.createGain();
    this.env(g, t, 0.06, 0.16, 0.3, 0.75, 0.12, t + dur * 0.98);
    lp.connect(g).connect(dest);
    for (const [mult, det, type] of [[1, -6, 'sawtooth'], [1, 7, 'sawtooth'], [0.5, 0, 'square']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      o.detune.value = det;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(7, t + Math.min(0.6, dur));
      lfo.connect(lg).connect(o.detune);
      o.connect(lp);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 1); lfo.stop(t + dur + 1);
    }
  }

  flute(f, t, dur, dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.5);
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    this.env(g, t, 0.07, 0.2, 0.4, 0.8, 0.12, t + dur * 0.97);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(dest);
    o.start(t); o2.start(t); lfo.start(t);
    const e = t + dur + 1;
    o.stop(e); o2.stop(e); lfo.stop(e);
  }

  organ(f, t, dur, dest) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    this.env(g, t, 0.04, 0.13, 0.5, 0.9, 0.2, t + dur * 0.98);
    g.connect(dest);
    for (const [m, a] of [[0.5, 0.6], [1, 1], [2, 0.5], [3, 0.3], [4, 0.2]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 1);
    }
  }

  noise(t, dur, dest, { type = 'lowpass', freq = 1000, q = 0.7, amp = 0.3, attack = 0.005, freqEnd = null, decayCurve = 'exp' } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    if (decayCurve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return g;
  }

  tone(t, dur, dest, { type = 'sine', freq = 440, freqEnd = null, amp = 0.3, attack = 0.005, curve = 'exp' } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      else o.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  taiko(t, vel, dest, pitch = 1) {
    this.tone(t, 0.55, dest, { freq: 120 * pitch, freqEnd: 42 * pitch, amp: 0.55 * vel });
    this.noise(t, 0.12, dest, { freq: 900, amp: 0.18 * vel });
  }
  rim(t, dest, amp) {
    this.noise(t, 0.12, dest, { type: 'bandpass', freq: 2200, q: 1.2, amp });
    this.tone(t, 0.08, dest, { freq: 330, freqEnd: 200, amp: amp * 0.4, type: 'triangle' });
  }
  hat(t, dest, amp) { this.noise(t, 0.05, dest, { type: 'highpass', freq: 7000, amp }); }
  cymbal(t, amp) {
    if (!this.ready) return;
    this.noise(t, 2.2, this.layers.drums, { type: 'highpass', freq: 5000, amp, attack: 0.9, decayCurve: 'lin' });
  }

  // -------------------------------------------------------------- sound FX
  get now() { return this.ctx.currentTime; }

  sfx(name, opt = {}) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.sfxBus;
    const r = () => 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'swing': {
        const p = opt.power || 1;
        this.noise(t, 0.28, out, { type: 'bandpass', freq: 500 * r(), freqEnd: 3200 * p, q: 2.2, amp: 0.35 * p, attack: 0.04 });
        this.tone(t + 0.03, 0.22, out, { type: 'sine', freq: 1800 * r(), freqEnd: 900, amp: 0.03 });
        break;
      }
      case 'hit': {
        const h = opt.heavy ? 1.4 : 1;
        this.tone(t, 0.25 * h, out, { freq: 150 * r(), freqEnd: 45, amp: 0.55 * h });
        this.noise(t, 0.16 * h, out, { type: 'bandpass', freq: 1800 * r(), q: 0.8, amp: 0.5 });
        this.tone(t, 0.35, out, { type: 'triangle', freq: 620 * r(), freqEnd: 580, amp: 0.08 });
        this.tone(t, 0.3, out, { type: 'sine', freq: 1690 * r(), amp: 0.05 });
        break;
      }
      case 'clang': {
        for (const [f, a] of [[1320, 0.18], [2640 * 1.02, 0.1], [3960 * 1.05, 0.06], [880, 0.12]]) this.tone(t, 1.3, out, { freq: f * r(), amp: a });
        this.noise(t, 0.08, out, { type: 'highpass', freq: 3000, amp: 0.4 });
        break;
      }
      case 'flap': {
        this.noise(t, 0.35, out, { type: 'lowpass', freq: 380 * r(), freqEnd: 900, amp: 0.45, attack: 0.08 });
        this.tone(t, 0.3, out, { freq: 70, freqEnd: 45, amp: 0.2, attack: 0.05 });
        break;
      }
      case 'dash': {
        this.noise(t, 0.35, out, { type: 'bandpass', freq: 400, freqEnd: 4000, q: 1.5, amp: 0.45, attack: 0.02 });
        this.tone(t, 0.3, out, { freq: 90, freqEnd: 50, amp: 0.3 });
        break;
      }
      case 'jump': this.noise(t, 0.2, out, { type: 'lowpass', freq: 600, freqEnd: 1400, amp: 0.2, attack: 0.03 }); break;
      case 'land': {
        const s = opt.power || 1;
        this.tone(t, 0.2, out, { freq: 90, freqEnd: 40, amp: 0.3 * s });
        this.noise(t, 0.15, out, { freq: 500, amp: 0.2 * s });
        break;
      }
      case 'step': this.noise(t, 0.06, out, { freq: 700 * r(), amp: 0.05 }); break;
      case 'impact': {
        this.tone(t, 0.9, out, { freq: 110, freqEnd: 30, amp: 0.8 });
        this.noise(t, 0.7, out, { freq: 1600, freqEnd: 200, amp: 0.5 });
        this.noise(t, 1.4, out, { type: 'highpass', freq: 4000, amp: 0.08, attack: 0.01 });
        break;
      }
      case 'enemyDie': {
        this.tone(t, 0.7, out, { type: 'sawtooth', freq: 260 * r(), freqEnd: 60, amp: 0.1 });
        this.noise(t, 0.6, out, { type: 'bandpass', freq: 1200, freqEnd: 200, q: 3, amp: 0.25 });
        break;
      }
      case 'hurt': {
        this.tone(t, 0.25, out, { type: 'sawtooth', freq: 180, freqEnd: 90, amp: 0.15 });
        this.noise(t, 0.2, out, { freq: 1200, amp: 0.35 });
        this.tone(t, 0.3, out, { freq: 70, freqEnd: 35, amp: 0.45 });
        break;
      }
      case 'feather': {
        [86, 90, 93, 98].forEach((n, i) => this.tone(t + i * 0.06, 0.9, out, { freq: midiToFreq(n), amp: 0.09 }));
        break;
      }
      case 'scroll': {
        this.choirChord([62, 66, 69, 74], t, 1.6, out);
        [74, 78, 81].forEach((n, i) => this.tone(t + i * 0.12, 1.5, out, { freq: midiToFreq(n), amp: 0.06 }));
        break;
      }
      case 'relic': {
        this.choirChord([50, 57, 62, 66, 69], t, 2.5, out);
        this.bell(midiToFreq(74), t, out, 0.2);
        this.bell(midiToFreq(81), t + 0.3, out, 0.14);
        this.taikoSfx(t, 1);
        break;
      }
      case 'judgment': {
        this.choirChord([50, 57, 62, 66, 69, 74], t, 2.8, out);
        this.tone(t + 0.6, 2, out, { freq: 70, freqEnd: 25, amp: 0.9 });
        this.noise(t + 0.6, 2.2, out, { freq: 3000, freqEnd: 150, amp: 0.6 });
        this.bell(midiToFreq(86), t + 0.6, out, 0.15);
        break;
      }
      case 'charge': this.tone(t, 0.8, out, { type: 'sawtooth', freq: 200, freqEnd: 900, amp: 0.05, attack: 0.3, curve: 'lin' }); break;
      case 'bolt': {
        this.tone(t, 0.3, out, { type: 'sawtooth', freq: 900 * r(), freqEnd: 200, amp: 0.08 });
        this.noise(t, 0.25, out, { type: 'bandpass', freq: 2500, freqEnd: 600, q: 4, amp: 0.15 });
        break;
      }
      case 'explode': {
        this.tone(t, 0.8, out, { freq: 90, freqEnd: 30, amp: 0.6 });
        this.noise(t, 0.9, out, { freq: 2400, freqEnd: 120, amp: 0.55 });
        break;
      }
      case 'parry': {
        this.sfx('clang');
        this.bell(midiToFreq(93), t, out, 0.12);
        break;
      }
      case 'guard': this.tone(t, 0.3, out, { type: 'triangle', freq: 520, freqEnd: 780, amp: 0.08 }); break;
      case 'horn': {
        const d = opt.dur || 2.6;
        const f = midiToFreq(opt.note || 45);
        this.brass(f, t, d, out);
        this.brass(f * 1.5, t + 0.05, d, out);
        this.brass(f * 2, t + 0.1, d * 0.9, out);
        break;
      }
      case 'bigbell': {
        const f = midiToFreq(opt.note || 50);
        for (const [m, a, d] of [[1, 0.35, 5], [2.0, 0.18, 4], [2.4, 0.14, 3.5], [3.0, 0.1, 3], [4.2, 0.07, 2.5], [0.5, 0.2, 6]]) this.tone(t, d, out, { freq: f * m, amp: a });
        this.noise(t, 0.1, out, { type: 'bandpass', freq: 2000, q: 1, amp: 0.3 });
        break;
      }
      case 'roar': {
        this.noise(t, 2, out, { type: 'bandpass', freq: 300, freqEnd: 120, q: 1.5, amp: 0.7, attack: 0.2 });
        this.tone(t, 1.8, out, { type: 'sawtooth', freq: 95, freqEnd: 55, amp: 0.25, attack: 0.2 });
        this.tone(t, 1.8, out, { type: 'sawtooth', freq: 101, freqEnd: 50, amp: 0.2, attack: 0.25 });
        break;
      }
      case 'rumble': {
        const d = opt.dur || 3;
        this.noise(t, d, out, { freq: 180, amp: 0.8, attack: 0.3, decayCurve: 'lin' });
        for (let i = 0; i < 5; i++) this.tone(t + i * d / 5 + Math.random() * 0.2, 0.9, out, { freq: 80, freqEnd: 30, amp: 0.5 });
        break;
      }
      case 'fire': this.noise(t, 0.6, out, { type: 'lowpass', freq: 1500, freqEnd: 400, amp: 0.3, attack: 0.05 }); break;
      case 'teleport': {
        this.tone(t, 0.5, out, { type: 'sine', freq: 200, freqEnd: 1400, amp: 0.12 });
        this.noise(t, 0.45, out, { type: 'bandpass', freq: 600, freqEnd: 5000, q: 4, amp: 0.2 });
        break;
      }
      case 'ui': this.tone(t, 0.12, out, { type: 'triangle', freq: opt.f || 880, amp: 0.05 }); break;
      case 'uiConfirm': {
        this.tone(t, 0.3, out, { type: 'triangle', freq: 660, amp: 0.07 });
        this.tone(t + 0.07, 0.4, out, { type: 'triangle', freq: 990, amp: 0.07 });
        break;
      }
      case 'brazier': {
        this.noise(t, 1.2, out, { type: 'lowpass', freq: 600, freqEnd: 2500, amp: 0.4, attack: 0.1 });
        this.bell(midiToFreq(81), t, out, 0.08);
        break;
      }
      case 'objective': {
        [69, 74, 78, 81].forEach((n, i) => this.bell(midiToFreq(n), t + i * 0.1, out, 0.07));
        break;
      }
      case 'heartbeat': {
        this.tone(t, 0.15, out, { freq: 60, freqEnd: 40, amp: 0.4 });
        this.tone(t + 0.2, 0.15, out, { freq: 55, freqEnd: 38, amp: 0.3 });
        break;
      }
      case 'splash': this.noise(t, 1, out, { type: 'lowpass', freq: 2000, freqEnd: 300, amp: 0.5, attack: 0.02 }); break;
      default: break;
    }
  }

  taikoSfx(t, v) { this.taiko(t, v, this.sfxBus); }

  bell(f, t, dest, amp = 0.1) {
    for (const [m, a, d] of [[1, 1, 2.2], [2.76, 0.5, 1.4], [5.4, 0.25, 0.8], [0.5, 0.3, 2.5]]) {
      this.tone(t, d, dest, { freq: f * m, amp: amp * a });
    }
  }

  // A cinematic "stinger" for big story moments.
  stinger(kind = 'epic') {
    if (!this.ready) return;
    const t = this.now;
    if (kind === 'epic') {
      this.choirChord([50, 57, 62, 65, 69], t, 3, this.sfxBus);
      this.taikoSfx(t, 1.2);
      this.taikoSfx(t + 0.45, 0.8);
      this.brass(midiToFreq(50), t, 2.5, this.sfxBus);
      this.brass(midiToFreq(57), t, 2.5, this.sfxBus);
    } else if (kind === 'dark') {
      this.choirChord([48, 49, 55, 60], t, 3.5, this.sfxBus);
      this.tone(t, 3, this.sfxBus, { freq: 55, freqEnd: 30, amp: 0.5 });
    } else if (kind === 'holy') {
      this.choirChord([62, 66, 69, 74, 78], t, 4, this.sfxBus);
      this.bell(midiToFreq(86), t, this.sfxBus, 0.12);
      this.bell(midiToFreq(93), t + 0.4, this.sfxBus, 0.08);
    }
  }
}

export const audio = new AudioEngine();
