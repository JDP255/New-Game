// Pose library & keyframed attack clips for Valkimsmor.
// Conventions (character faces +Z):
//  shoulders use 'YXZ': x = elevation (-1.57 forward, -3.1 overhead), y = azimuth (+ toward his left)
//  elbows: x negative bends forward. wrist haR.x: 0 blade forward/up, 1.57 blade continues along arm.
//  thighs: x negative = leg forward; knees positive bend back. body/spine/chest x positive = lean forward.
//  wings: w1 z raises, y sweeps back.
import { Ease } from '../core/utils.js';

const S = Math.sin, C = Math.cos;

export const WING = {
  folded: { w1: [0, 1.1, 0.95], w2: [0, 0.35, -1.0], w3: [0, 0.2, -0.6] },
  spread: { w1: [0, 0.2, 0.42], w2: [0, -0.1, -0.2], w3: [0, -0.15, -0.3] },
  glide: { w1: [0, 0.12, 0.1], w2: [0, 0.02, -0.02], w3: [0, 0.02, -0.08] },
  dive: { w1: [0, 1.1, 1.05], w2: [0, 0.35, -0.2], w3: [0, 0.3, -0.1] },
  majestic: { w1: [-0.1, 0.05, 0.62], w2: [0, -0.1, -0.15], w3: [0, -0.2, -0.25] },
};

function setWings(p, w, mirror = true) {
  p.w1L = [...w.w1]; p.w2L = [...w.w2]; p.w3L = [...w.w3];
  if (mirror) { p.w1R = [...w.w1]; p.w2R = [...w.w2]; p.w3R = [...w.w3]; }
  return p;
}

// Flap cycle, phase in radians. amp 0..1
export function flapWings(p, phase, amp = 1, base = WING.spread) {
  const s1 = S(phase), s2 = S(phase - 0.7), s3 = S(phase - 1.3);
  const w1 = [base.w1[0], base.w1[1] - 0.25 * C(phase) * amp, base.w1[2] + 0.75 * s1 * amp];
  const w2 = [base.w2[0], base.w2[1] + 0.1 * C(phase - 0.7) * amp, base.w2[2] + 0.45 * s2 * amp];
  const w3 = [base.w3[0] + 0.15 * s3 * amp, base.w3[1] + 0.15 * C(phase - 1.3) * amp, base.w3[2] + 0.4 * s3 * amp];
  return setWings(p, { w1, w2, w3 });
}

export function idlePose(p, t, combat = 0) {
  const br = S(t * 1.6);
  p.bodyPos = [0, -0.02 - combat * 0.06 + br * 0.008, 0];
  p.body = [0, 0, 0];
  p.hips = [0, 0.2 + combat * 0.15, 0];
  p.spine = [0.04 + br * 0.015, -0.08, 0];
  p.chest = [0.02 + br * 0.02, -0.12 - combat * 0.15, 0];
  p.neck = [0, 0.05, 0];
  p.head = [0.04 - br * 0.02, 0.1 + combat * 0.2, 0];
  p.shR = [-0.35 - combat * 0.25, -0.35, -0.18];
  p.elR = [-0.55 - combat * 0.35, 0, 0];
  p.haR = [1.2 - combat * 0.2, 0, 0];
  p.shL = [-0.12 - combat * 0.2, 0.1, 0.22 + br * 0.02];
  p.elL = [-0.35 - combat * 0.4, 0, 0];
  p.haL = [0, 0, 0];
  p.thL = [-0.12, -0.2, 0.12];
  p.knL = [0.18 + combat * 0.12, 0, 0];
  p.ftL = [-0.06 - combat * 0.08, 0.1, -0.08];
  p.thR = [0.14, 0.15, -0.12];
  p.knR = [0.15 + combat * 0.14, 0, 0];
  p.ftR = [-0.29 - combat * 0.1, -0.1, 0.08];
  setWings(p, WING.folded);
  const flutter = S(t * 0.9) * 0.03;
  p.w1L[2] += flutter; p.w1R[2] += flutter;
  return p;
}

// Run cycle. phase radians, speed01 0..1 (1 = full sprint)
export function runPose(p, phase, speed01, t, turn = 0) {
  const s = S(phase), c = C(phase);
  const k = 0.5 + speed01 * 0.5;
  p.bodyPos = [0, -0.06 * k + Math.abs(S(phase)) * 0.07 * k, 0];
  p.body = [0.14 + speed01 * 0.2, 0, -turn * 0.25];
  p.hips = [0, -0.18 * s * k, 0];
  p.spine = [0.05, 0.12 * s * k, 0];
  p.chest = [0.06 + speed01 * 0.08, 0.14 * s * k, 0];
  p.neck = [0, -0.06 * s, 0];
  p.head = [-0.1 - speed01 * 0.15, -0.08 * s, 0];
  p.thL = [-0.85 * s * k - 0.1, 0, 0.04];
  p.thR = [0.85 * s * k - 0.1, 0, -0.04];
  p.knL = [0.25 + 1.25 * Math.max(0, -c) * k + 0.2 * k, 0, 0];
  p.knR = [0.25 + 1.25 * Math.max(0, c) * k + 0.2 * k, 0, 0];
  p.ftL = [0.2 * s * k, 0, 0];
  p.ftR = [-0.2 * s * k, 0, 0];
  // Left arm pumps; sword arm carries Veritas low and trailing.
  p.shL = [0.75 * s * k - 0.15, 0.1, 0.18];
  p.elL = [-0.9 - 0.2 * k, 0, 0];
  p.haL = [0, 0, 0];
  p.shR = [0.35 - 0.3 * s * k + speed01 * 0.35, -0.25, -0.25];
  p.elR = [-0.3, 0, 0];
  p.haR = [2.3 + speed01 * 0.3, 0, 0];
  const wb = S(phase * 2) * 0.06 * k;
  const base = speed01 > 0.6 ? { w1: [0.1, 1.3, 0.8], w2: [0, 0.5, -1.1], w3: [0, 0.3, -0.5] } : WING.folded;
  setWings(p, base);
  p.w1L[2] += wb; p.w1R[2] += wb;
  return p;
}

export function airPose(p, t, vy, flapPhase, flapAmp) {
  const up = Math.max(-1, Math.min(1, vy / 10));
  p.bodyPos = [0, 0, 0];
  p.body = [0.1 - up * 0.1, 0, 0];
  p.hips = [0, 0.1, 0];
  p.spine = [0.05, 0, 0];
  p.chest = [-0.05 - up * 0.1, 0, 0];
  p.neck = [0, 0, 0];
  p.head = [0.05, 0, 0];
  p.thL = [-0.9 + up * 0.2, 0, 0.12];
  p.knL = [1.4 - up * 0.2, 0, 0];
  p.ftL = [0.3, 0, 0];
  p.thR = [-0.2, 0, -0.1];
  p.knR = [0.7, 0, 0];
  p.ftR = [0.3, 0, 0];
  p.shL = [-0.4, 0.4, 0.6];
  p.elL = [-0.5, 0, 0];
  p.haL = [0, 0, 0];
  p.shR = [-0.3, -0.6, -0.5];
  p.elR = [-0.4, 0, 0];
  p.haR = [1.9, 0, 0];
  flapWings(p, flapPhase, flapAmp, WING.spread);
  return p;
}

export function glidePose(p, t, bank = 0, pitch = 0) {
  const fl = S(t * 9) * 0.04;
  p.bodyPos = [0, 0.3, 0];
  p.body = [1.05 + pitch * 0.35, 0, -bank * 0.6];
  p.hips = [0, 0, 0];
  p.spine = [-0.05, 0, 0];
  p.chest = [-0.15, 0, 0];
  p.neck = [-0.35, 0, 0];
  p.head = [-0.55, 0, 0];
  p.thL = [0.25, 0, 0.06];
  p.knL = [0.35, 0, 0];
  p.ftL = [0.5, 0, 0];
  p.thR = [0.35, 0, -0.06];
  p.knR = [0.2, 0, 0];
  p.ftR = [0.5, 0, 0];
  p.shL = [0.6, 0.2, 0.35];
  p.elL = [-0.2, 0, 0];
  p.haL = [0, 0, 0];
  p.shR = [0.5, -0.2, -0.35];
  p.elR = [-0.2, 0, 0];
  p.haR = [1.5, 0, 0];
  setWings(p, WING.glide);
  p.w1L[2] += fl + bank * 0.2; p.w1R[2] += fl - bank * 0.2;
  p.w3L[2] += S(t * 11) * 0.05; p.w3R[2] += S(t * 11 + 1) * 0.05;
  return p;
}

// Flying (free flight / hover flapping with body leaning into motion)
export function flyPose(p, t, flapPhase, lean = 0.4) {
  airPose(p, t, 0, flapPhase, 1);
  p.body = [lean, 0, 0];
  p.thL = [0.1, 0, 0.1]; p.knL = [0.6, 0, 0];
  p.thR = [0.2, 0, -0.1]; p.knR = [0.4, 0, 0];
  return p;
}

export function kneelPose(p, t = 0) {
  const br = S(t * 1.3) * 0.01;
  p.bodyPos = [0, -0.45, 0];
  p.body = [0, 0, 0];
  p.hips = [0.05, 0, 0];
  p.spine = [0.25 + br, 0, 0];
  p.chest = [0.15, 0, 0];
  p.neck = [0.25, 0, 0];
  p.head = [0.35, 0, 0];
  p.thL = [-1.45, 0, 0.1];
  p.knL = [1.5, 0, 0];
  p.ftL = [0, 0, 0];
  p.thR = [0.25, 0, -0.08];
  p.knR = [1.9, 0, 0];
  p.ftR = [0.8, 0, 0];
  // Both hands resting on the pommel of the planted sword.
  p.shR = [-0.95, 0.25, 0];
  p.elR = [-0.45, 0, 0];
  p.haR = [1.95, 0, 0];
  p.shL = [-0.95, -0.35, 0];
  p.elL = [-0.5, 0, 0];
  p.haL = [0, 0, 0];
  setWings(p, { w1: [0.1, 1.0, 0.7], w2: [0, 0.35, -0.95], w3: [0, 0.2, -0.4] });
  return p;
}

export function heroPose(p, t = 0) {
  // Sword raised to the heavens, wings spread — the iconic stance.
  const br = S(t * 1.2) * 0.02;
  idlePose(p, t, 0);
  p.shR = [-3.05, 0.1, 0.05];
  p.elR = [-0.05, 0, 0];
  p.haR = [1.57, 0, 0];
  p.shL = [-0.3, 0.3, 0.55];
  p.elL = [-0.3, 0, 0];
  p.chest = [-0.12 + br, 0, 0];
  p.head = [-0.35, 0, 0];
  setWings(p, WING.majestic);
  p.w1L[2] += br * 2; p.w1R[2] += br * 2;
  return p;
}

// ---------------------------------------------------------------- attack clips
// Each: dur (s), keys [{t, p, ease}], hit [start,end] (s), dmg, range, arc (rad), lunge (m/s),
// comboWindow start (s), trail true, and fx hooks.
const legsLunge = { thL: [-0.55, 0, 0.12], knL: [0.45, 0, 0], thR: [0.4, 0, -0.1], knR: [0.25, 0, 0], ftR: [-0.25, 0, 0] };
const legsWide = { thL: [-0.3, -0.2, 0.25], knL: [0.5, 0, 0], thR: [0.3, 0.2, -0.25], knR: [0.5, 0, 0], ftR: [-0.2, 0, 0], ftL: [-0.2, 0, 0] };

export const CLIPS = {
  light1: {
    dur: 0.46, hit: [0.13, 0.25], dmg: 18, range: 3.1, arc: 2.4, lunge: 7, combo: 0.22, power: 1, shake: 0.15,
    keys: [
      { t: 0, p: { chest: [0.05, -0.8, 0], spine: [0, -0.35, 0], hips: [0, -0.3, 0], shR: [-1.45, -1.8, 0], elR: [-0.35, 0, 0], haR: [1.45, 0, 0], shL: [-0.7, 0.7, 0.25], elL: [-0.9, 0, 0], ...legsLunge } },
      { t: 0.11, p: { chest: [0.05, -1.0, 0], spine: [0, -0.4, 0], hips: [0, -0.35, 0], shR: [-1.4, -2.15, 0], elR: [-0.45, 0, 0], haR: [1.35, 0, 0], shL: [-0.8, 0.8, 0.3], elL: [-0.9, 0, 0] }, ease: Ease.outCubic },
      { t: 0.25, p: { chest: [0.12, 0.85, 0], spine: [0.05, 0.35, 0], hips: [0, 0.35, 0], shR: [-1.55, 0.95, 0], elR: [-0.1, 0, 0], haR: [1.6, 0, 0], shL: [-0.2, -0.3, 0.6], elL: [-0.3, 0, 0], bodyPos: [0, -0.1, 0] }, ease: Ease.outExpo },
      { t: 0.46, p: { chest: [0.08, 0.6, 0], spine: [0.03, 0.25, 0], hips: [0, 0.25, 0], shR: [-1.2, 0.75, 0], elR: [-0.5, 0, 0], haR: [1.7, 0, 0], shL: [-0.25, -0.2, 0.5], elL: [-0.4, 0, 0], bodyPos: [0, -0.08, 0] }, ease: Ease.outQuad },
    ],
  },
  light2: {
    dur: 0.46, hit: [0.11, 0.24], dmg: 20, range: 3.1, arc: 2.4, lunge: 7, combo: 0.22, power: 1.05, shake: 0.15,
    keys: [
      { t: 0, p: { chest: [0.08, 0.6, 0], spine: [0.03, 0.25, 0], hips: [0, 0.25, 0], shR: [-1.2, 0.75, 0], elR: [-0.5, 0, 0], haR: [1.7, 0, 0], shL: [-0.25, -0.2, 0.5], elL: [-0.4, 0, 0], ...legsLunge } },
      { t: 0.09, p: { chest: [0.05, 0.95, 0], spine: [0, 0.4, 0], hips: [0, 0.35, 0], shR: [-1.15, 1.2, 0], elR: [-1.0, 0, 0], haR: [1.9, 0, 0] }, ease: Ease.outCubic },
      { t: 0.24, p: { chest: [-0.05, -0.9, 0], spine: [0, -0.4, 0], hips: [0, -0.4, 0], shR: [-2.05, -1.7, 0], elR: [-0.05, 0, 0], haR: [1.5, 0, 0], shL: [-0.5, 0.6, 0.4], elL: [-0.8, 0, 0], bodyPos: [0, -0.05, 0] }, ease: Ease.outExpo },
      { t: 0.46, p: { chest: [0, -0.7, 0], spine: [0, -0.3, 0], hips: [0, -0.3, 0], shR: [-1.8, -1.5, 0], elR: [-0.35, 0, 0], haR: [1.45, 0, 0] }, ease: Ease.outQuad },
    ],
  },
  light3: {
    dur: 0.72, hit: [0.3, 0.4], dmg: 34, range: 3.8, arc: 6.3, lunge: 9, combo: 0.5, power: 1.6, shake: 0.4, slam: true, knock: 9,
    keys: [
      { t: 0, p: { body: [0, 0, 0], chest: [0, -0.7, 0], shR: [-1.8, -1.5, 0], elR: [-0.35, 0, 0], haR: [1.45, 0, 0], shL: [-0.5, 0.6, 0.4], bodyPos: [0, 0, 0], ...legsLunge } },
      { t: 0.16, p: { body: [-0.2, 3.3, 0], chest: [-0.2, 0, 0], spine: [-0.1, 0, 0], shR: [-3.0, -0.2, 0], elR: [-0.5, 0, 0], haR: [1.1, 0, 0], shL: [-2.6, 0.3, 0.2], elL: [-0.6, 0, 0], bodyPos: [0, 0.9, 0], thL: [-1.0, 0, 0.1], knL: [1.5, 0, 0], thR: [-0.3, 0, -0.1], knR: [1.0, 0, 0] }, ease: Ease.outCubic },
      { t: 0.34, p: { body: [0.3, 6.283, 0], chest: [0.3, 0, 0], spine: [0.25, 0, 0], shR: [-0.75, 0, 0], elR: [-0.05, 0, 0], haR: [1.65, 0, 0], shL: [-0.6, 0.2, 0.5], elL: [-0.5, 0, 0], bodyPos: [0, -0.28, 0], ...legsWide }, ease: Ease.inQuad },
      { t: 0.72, p: { body: [0.12, 6.283, 0], chest: [0.15, 0, 0], spine: [0.1, 0, 0], shR: [-0.8, 0, 0], elR: [-0.2, 0, 0], haR: [1.6, 0, 0], bodyPos: [0, -0.15, 0] }, ease: Ease.outQuad },
    ],
  },
  heavy: {
    dur: 1.0, hit: [0.44, 0.54], dmg: 55, range: 4.5, arc: 6.3, lunge: 5, combo: 0.8, power: 2.2, shake: 0.7, slam: true, knock: 14, radiant: true,
    keys: [
      { t: 0, p: { body: [0, 0, 0], chest: [0, 0, 0], shR: [-1, 0, 0], elR: [-0.5, 0, 0], haR: [1.4, 0, 0], ...legsWide } },
      { t: 0.32, p: { body: [-0.15, 0, 0], chest: [-0.35, 0, 0], spine: [-0.15, 0, 0], head: [-0.3, 0, 0], shR: [-3.1, 0, 0.1], elR: [-0.2, 0, 0], haR: [1.2, 0, 0], shL: [-3.0, 0, -0.1], elL: [-0.3, 0, 0], bodyPos: [0, 0.35, 0], w1L: [0, 0.1, 0.9], w1R: [0, 0.1, 0.9], w2L: [0, 0, -0.1], w2R: [0, 0, -0.1], w3L: [0, 0, -0.2], w3R: [0, 0, -0.2] }, ease: Ease.outCubic },
      { t: 0.48, p: { body: [0.35, 0, 0], chest: [0.4, 0, 0], spine: [0.3, 0, 0], head: [0.1, 0, 0], shR: [-0.55, 0, 0], elR: [0, 0, 0], haR: [1.6, 0, 0], shL: [-0.6, -0.2, 0], elL: [-0.1, 0, 0], bodyPos: [0, -0.4, 0], w1L: [0, 0.4, -0.2], w1R: [0, 0.4, -0.2], thL: [-0.9, 0, 0.1], knL: [1.1, 0, 0], thR: [0.5, 0, -0.1], knR: [1.0, 0, 0] }, ease: Ease.inExpo },
      { t: 1.0, p: { body: [0.15, 0, 0], chest: [0.2, 0, 0], spine: [0.1, 0, 0], shR: [-0.6, 0, 0], elR: [-0.3, 0, 0], haR: [1.6, 0, 0], bodyPos: [0, -0.2, 0] }, ease: Ease.outQuad },
    ],
  },
  air: {
    dur: 0.5, hit: [0.1, 0.34], dmg: 20, range: 3.3, arc: 6.3, lunge: 4, combo: 0.28, power: 1.2, shake: 0.18,
    keys: [
      { t: 0, p: { body: [0.1, 0, 0], shR: [-1.57, -1.6, 0], elR: [0, 0, 0], haR: [1.57, 0, 0], shL: [-1.2, 1.3, 0], thL: [-0.8, 0, 0.2], knL: [1.3, 0, 0], thR: [-0.4, 0, -0.2], knR: [1.1, 0, 0] } },
      { t: 0.4, p: { body: [0.1, 6.283, 0], shR: [-1.57, -1.6, 0], elR: [0, 0, 0], haR: [1.57, 0, 0], shL: [-1.2, 1.3, 0] }, ease: Ease.inOutQuad },
      { t: 0.5, p: { body: [0.1, 6.283, 0], shR: [-1.3, -1.2, 0], elR: [-0.3, 0, 0], haR: [1.6, 0, 0] } },
    ],
  },
  parry: {
    dur: 0.42, window: [0.0, 0.25],
    keys: [
      { t: 0, p: { chest: [0, 0.2, 0], shR: [-1.0, 0.2, 0], elR: [-0.9, 0, 0], haR: [0.6, 0, 0] } },
      { t: 0.06, p: { chest: [-0.05, 0.45, 0], spine: [0, 0.15, 0], shR: [-1.35, 0.55, 0], elR: [-1.1, 0, 0], haR: [0.1, 0, 0.3], shL: [-1.2, -0.3, 0.2], elL: [-1.2, 0, 0], ...legsWide }, ease: Ease.outExpo },
      { t: 0.42, p: { chest: [0, 0.3, 0], shR: [-1.25, 0.5, 0], elR: [-1.0, 0, 0], haR: [0.2, 0, 0.3] }, ease: Ease.outQuad },
    ],
  },
  riposte: {
    dur: 0.55, hit: [0.1, 0.24], dmg: 60, range: 3.6, arc: 2.6, lunge: 14, combo: 0.35, power: 1.8, shake: 0.35, knock: 6,
    keys: [
      { t: 0, p: { chest: [-0.05, 0.45, 0], shR: [-1.35, 0.55, 0], elR: [-1.1, 0, 0], haR: [0.1, 0, 0.3] } },
      { t: 0.14, p: { body: [0.25, 0, 0], chest: [0.15, -0.2, 0], shR: [-1.57, 0, 0], elR: [0, 0, 0], haR: [1.57, 0, 0], shL: [0.4, 0, 0.4], ...legsLunge, bodyPos: [0, -0.2, 0] }, ease: Ease.outExpo },
      { t: 0.55, p: { body: [0.15, 0, 0], chest: [0.1, -0.1, 0], shR: [-1.4, 0, 0], elR: [-0.2, 0, 0], haR: [1.57, 0, 0] }, ease: Ease.outQuad },
    ],
  },
  hurt: {
    dur: 0.4,
    keys: [
      { t: 0, p: { chest: [-0.4, 0.2, 0], head: [-0.4, 0, 0], spine: [-0.2, 0, 0], shL: [-0.4, 0.4, 0.7], shR: [-0.3, -0.4, -0.6] } },
      { t: 0.4, p: { chest: [0, 0, 0], head: [0, 0, 0], spine: [0, 0, 0] }, ease: Ease.outQuad },
    ],
  },
  judgment: {
    dur: 2.2,
    keys: [
      { t: 0, p: { body: [0, 0, 0], shR: [-1.0, 0, 0], elR: [-0.5, 0, 0], haR: [1.4, 0, 0], bodyPos: [0, 0, 0] } },
      { t: 0.5, p: { body: [-0.1, 0, 0], chest: [-0.25, 0, 0], head: [-0.5, 0, 0], shR: [-3.1, 0.1, 0.05], elR: [0, 0, 0], haR: [1.57, 0, 0], shL: [-0.3, 0.3, 0.9], elL: [-0.2, 0, 0], w1L: [-0.1, 0.0, 0.8], w1R: [-0.1, 0.0, 0.8], w2L: [0, -0.1, -0.1], w2R: [0, -0.1, -0.1], w3L: [0, -0.2, -0.15], w3R: [0, -0.2, -0.15], thL: [-0.3, 0, 0.15], knL: [0.6, 0, 0], thR: [0.1, 0, -0.15], knR: [0.4, 0, 0], bodyPos: [0, 0, 0] }, ease: Ease.outCubic },
      { t: 1.35, p: { body: [-0.1, 0, 0], chest: [-0.3, 0, 0], head: [-0.55, 0, 0], shR: [-3.1, 0.1, 0.05], haR: [1.57, 0, 0], w1L: [-0.1, 0.0, 0.85], w1R: [-0.1, 0.0, 0.85] } },
      { t: 1.65, p: { body: [0.45, 0, 0], chest: [0.4, 0, 0], head: [0.2, 0, 0], shR: [-0.5, 0, 0], elR: [0, 0, 0], haR: [1.6, 0, 0], shL: [-0.5, 0, 0.2], w1L: [0, 0.6, -0.1], w1R: [0, 0.6, -0.1], ...legsWide, bodyPos: [0, -0.4, 0] }, ease: Ease.inExpo },
      { t: 2.2, p: { body: [0.1, 0, 0], chest: [0.1, 0, 0], shR: [-0.6, 0, 0], haR: [1.6, 0, 0], bodyPos: [0, -0.15, 0] }, ease: Ease.outQuad },
    ],
  },
};

export function wingsIntoPose(p, name) { return setWings(p, WING[name]); }
