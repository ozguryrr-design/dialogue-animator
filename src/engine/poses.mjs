// Arm/head poses for gestures. Angles use an "outward" convention so every body builder can share them:
// sh = shoulder angle from hanging down (0) rotating away from the body (+), el = extra forearm rotation
// in the same direction. A side can instead give `target: [x, y]` in head radii relative to the head
// centre (the builder solves a 2-bone IK), used for hand-to-face poses.
// Sides are "near" (towards the character's facing direction) and "far".
import { TAU, clamp, ease } from './math.mjs';

export const REST = { near: { sh: 0.16, el: 0.12 }, far: { sh: 0.16, el: 0.12 }, lean: 0, head: 0 };

const G = {
  wave: (p) => ({ near: { sh: 2.55, el: 0.35 + 0.45 * Math.sin(p * TAU * 2.4) }, head: 0.04 }),
  point: () => ({ near: { sh: 1.5, el: 0.05 }, lean: 0.03 }),
  shrug: () => ({ near: { sh: 0.62, el: 1.75 }, far: { sh: 0.62, el: 1.75 }, head: -0.06 }),
  facepalm: () => ({ near: { target: [0.05, 0.05] }, head: 0.08, lean: 0.02 }),
  cheer: (p) => ({ near: { sh: 2.7 + 0.12 * Math.sin(p * TAU * 2), el: 0.2 }, far: { sh: 2.7 - 0.12 * Math.sin(p * TAU * 2), el: 0.2 } }),
  explain: (p) => ({ near: { sh: 0.95 + 0.18 * Math.sin(p * TAU * 1.3), el: 0.85 } }),
  think: () => ({ near: { target: [0.25, 0.95] }, head: -0.07 }),
  hips: () => ({ near: { sh: 0.75, el: -1.55 }, far: { sh: 0.75, el: -1.55 } }),
  nod: (p) => ({ head: 0.07 * Math.sin(p * TAU * 2) }),
  // reach down-forward to set something on a table, then come back
  place: (p) => ({ near: { sh: 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, p * 1.2)), el: 0.35 }, lean: 0.05 * Math.sin(Math.PI * p), head: 0.05 }),
};
export const GESTURES = Object.keys(G);

const mixSide = (a, b, u) => {
  if (b.target || a.target) return u > 0.35 ? (b.target ? b : a) : a;
  return { sh: a.sh + (b.sh - a.sh) * u, el: a.el + (b.el - a.el) * u };
};

/**
 * Pose at time `t` given the gesture events of one character ({t, value, dur} sorted by t).
 * `inF` = blend-in seconds. Returns { near, far, lean, head }.
 */
export function poseAt(events, t, inS = 0.2) {
  let pose = { ...REST };
  for (const ev of events) {
    if (t < ev.t - inS || t > ev.t + ev.dur + inS) continue;
    const fn = G[ev.value];
    if (!fn) continue;
    const p = clamp((t - ev.t) / Math.max(0.1, ev.dur));
    const target = { ...REST, ...fn(p) };
    const u = Math.min(ease.smooth((t - (ev.t - inS)) / inS), ease.smooth((ev.t + ev.dur + inS - t) / inS));
    pose = {
      near: mixSide(pose.near, target.near || REST.near, u),
      far: mixSide(pose.far, target.far || REST.far, u),
      lean: pose.lean + ((target.lean || 0) - pose.lean) * u,
      head: pose.head + ((target.head || 0) - pose.head) * u,
    };
  }
  return pose;
}

/** 2-bone IK: elbow position for shoulder S -> hand H with lengths a, b; bend away from body (sign). */
export function solveIK(S, H, a, b, bendSign) {
  let dx = H[0] - S[0], dy = H[1] - S[1];
  let d = Math.hypot(dx, dy);
  const max = a + b - 1e-3;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const base = Math.atan2(dy, dx), ang = base + bendSign * Math.acos(cosA);
  const E = [S[0] + Math.cos(ang) * a, S[1] + Math.sin(ang) * a];
  const Hh = [S[0] + dx, S[1] + dy];
  return { E, H: Hh };
}

/** Elbow and hand positions for a side given outward angles. k = -1 left, +1 right. */
export function armFromAngles(S, k, sh, el, l1, l2) {
  const a1 = -k * sh, a2 = a1 - k * el;
  const E = [S[0] - Math.sin(a1) * l1, S[1] + Math.cos(a1) * l1];
  const H = [E[0] - Math.sin(a2) * l2, E[1] + Math.cos(a2) * l2];
  return { E, H, a1, a2 };
}
