// Facial expressions as numbers, so every body builder can draw them and any two can be blended.
// brow: raise in head radii · tilt: brow rotation (+ = inner ends up, sad) · eye: eye scale · lid: upper lid
// closure 0..1 · shape: dot | arc (happy ^) | closed (laugh) · look: pupil offset [x, y] (-1..1) · curve: mouth
// curvature (-1 frown .. 1 smile) · open: resting mouth opening · width: mouth width · skew: one-sided smile.
import { lerp } from './math.mjs';

export const EXPR = {
  neutral: { brow: 0, tilt: 0, eye: 1, lid: 0, shape: 'dot', look: [0, 0], curve: 0.15, open: 0, width: 1, skew: 0 },
  happy: { brow: 0.07, tilt: 0, eye: 1, lid: 0, shape: 'arc', look: [0, 0], curve: 1, open: 0.12, width: 1.1, skew: 0 },
  laugh: { brow: 0.12, tilt: 0, eye: 1, lid: 0, shape: 'closed', look: [0, 0], curve: 1, open: 0.75, width: 1.2, skew: 0 },
  sad: { brow: -0.03, tilt: 0.35, eye: 0.92, lid: 0.25, shape: 'dot', look: [0, 0.35], curve: -0.8, open: 0, width: 0.9, skew: 0 },
  angry: { brow: -0.09, tilt: -0.42, eye: 0.95, lid: 0.15, shape: 'dot', look: [0, 0], curve: -0.6, open: 0.18, width: 1.1, skew: 0 },
  surprised: { brow: 0.28, tilt: 0, eye: 1.35, lid: 0, shape: 'dot', look: [0, 0], curve: 0, open: 0.55, width: 0.6, skew: 0 },
  scared: { brow: 0.22, tilt: 0.3, eye: 1.3, lid: 0, shape: 'dot', look: [0, 0], curve: -0.5, open: 0.3, width: 0.9, skew: 0 },
  thinking: { brow: 0.1, tilt: -0.12, eye: 1, lid: 0.1, shape: 'dot', look: [0.5, -0.6], curve: 0.05, open: 0, width: 0.8, skew: 0.5 },
  worried: { brow: 0.06, tilt: 0.42, eye: 1, lid: 0, shape: 'dot', look: [0, 0.1], curve: -0.35, open: 0, width: 0.9, skew: -0.25 },
  smug: { brow: -0.02, tilt: -0.1, eye: 0.9, lid: 0.45, shape: 'dot', look: [0.3, 0], curve: 0.6, open: 0, width: 1, skew: 0.7 },
};

export const EXPRESSION_NAMES = Object.keys(EXPR);

export function blendExpr(a, b, u) {
  const A = EXPR[a] || EXPR.neutral, B = EXPR[b] || EXPR.neutral;
  const out = {};
  for (const k of Object.keys(B)) {
    if (k === 'shape') out.shape = u < 0.5 ? A.shape : B.shape;
    else if (k === 'look') out.look = [lerp(A.look[0], B.look[0], u), lerp(A.look[1], B.look[1], u)];
    else out[k] = lerp(A[k], B[k], u);
  }
  out.name = u < 0.5 ? a : b;
  return out;
}

/** How a listener reacts to a line said with this emotion. */
export const REACTION = {
  surprised: 'surprised', angry: 'worried', sad: 'sad', happy: 'happy', laugh: 'happy',
  scared: 'scared', smug: 'thinking', worried: 'worried', thinking: 'thinking',
};

/** Little symbol popped next to a reacting character. */
export const REACTION_FX = {
  surprised: 'exclaim', thinking: 'question', angry: 'anger', worried: 'sweat', scared: 'sweat', happy: 'sparkle', laugh: 'sparkle', sad: 'drop',
};
