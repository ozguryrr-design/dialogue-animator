// Who is where at time t, and what they are carrying. Plain functions over storyboard data: the renderer
// uses them to draw and the director uses the same ones to aim the camera, so the two can never disagree.
import { clamp } from './math.mjs';

// speed in stage units per second; cycle = distance covered by two steps, so the feet do not slide
export const GAITS = {
  walk: { speed: 520, cycle: 470, step: 1, lift: 1, bob: 12, lean: 0.03, arm: 0.42 },
  run: { speed: 1050, cycle: 560, step: 1.35, lift: 1.7, bob: 26, lean: 0.11, arm: 0.95 },
  sneak: { speed: 230, cycle: 300, step: 0.7, lift: 0.7, bob: 5, lean: 0.08, arm: 0.12 },
};

/** 0..1 -> 0..1 with a short speed-up and slow-down (trapezoid velocity). */
export function travelCurve(u, a = 0.16) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const v = 1 / (1 - a);
  if (u < a) return (0.5 * v * u * u) / a;
  if (u > 1 - a) return 1 - (0.5 * v * (1 - u) * (1 - u)) / a;
  return v * (u - a / 2);
}

/**
 * Position of an actor at time t. `moves` are { t, to, dur, gait } sorted by t; a later move interrupts an
 * earlier one. Returns { x, walked (total distance so far), amount (0 still .. 1 at full stride), gait, dir }.
 */
export function moveState(moves, x0, t) {
  let x = x0, walked = 0, active = null;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (t < m.t) break;
    const stop = Math.min(t, moves[i + 1]?.t ?? Infinity);
    const from = x, u = clamp((stop - m.t) / Math.max(1e-3, m.dur)), k = travelCurve(u);
    x = from + (m.to - from) * k;
    walked += Math.abs(m.to - from) * k;
    active = stop === t && u < 1 ? { m, from } : null;
  }
  if (!active) return { x, walked, amount: 0, gait: null, dir: 0 };
  const { m, from } = active;
  return { x, walked, amount: clamp(Math.min((t - m.t) / 0.14, (m.t + m.dur - t) / 0.14)), gait: m.gait || 'walk', dir: Math.sign(m.to - from) };
}

const NONE = [];
export const positionAt = (env, ch, scene, t) => moveState(env.idx.moves?.[scene.id]?.[ch.id] || NONE, scene.positions[ch.id] ?? 0, t);

/** 0 = not on stage yet (behind a door, gone), 1 = visible. Short fade so nobody pops. */
export function alphaAt(env, ch, scene, t) {
  let a = 1;
  for (const e of env.idx.visible?.[scene.id]?.[ch.id] || NONE) {
    if (t < e.t) { if (e === env.idx.visible[scene.id][ch.id][0]) a = e.value ? 0 : 1; break; }
    const u = clamp((t - e.t) / 0.15);
    a = e.value ? u : 1 - u;
  }
  return a;
}

/** Objects a character has in hand at time t: [{ id, side, scale }]. */
export function heldAt(env, ch, scene, t) {
  const ids = env.idx.holders?.[scene.id]?.[ch.id];
  if (!ids) return NONE;
  const out = [];
  for (const id of ids) {
    let cur = null;
    for (const e of env.idx.attach[id]) { if (e.t > t) break; cur = e; }
    if (cur?.type === 'hold' && cur.by === ch.id) out.push({ id, side: cur.side || 'near', scale: cur.scale || 1 });
  }
  return out;
}

/** Hand targets while carrying, as fractions of body height: [forward, up from the ground]. */
export const HOLD_POSES = {
  both: { near: { at: [0.17, 0.43] }, far: { at: [-0.04, 0.43] } },
  near: { near: { at: [0.24, 0.47] } },
  behind: { far: { at: [-0.19, 0.36] } },
};

/** Where to draw what is held, given the body's hand positions. Returns { front, behind } shape lists. */
export function placeHeld(held, hands, dir) {
  const front = [], behind = [];
  for (const h of held || NONE) {
    const a = h.side === 'behind' ? hands.far : hands.near, b = h.side === 'both' ? hands.far : a;
    const x = (a[0] + b[0]) / 2, y = Math.max(a[1], b[1]);
    const grip = h.side === 'both' ? 0.45 : 0.72;
    (h.side === 'behind' ? behind : front).push({ k: 'group', id: h.id, tf: { x, y: y + h.h * h.s * grip, sx: h.s * dir, sy: h.s }, items: h.items });
  }
  return { front, behind };
}

/** A foot's offset along the ground and its height while walking; k = -1 / +1 picks the leg. */
export function footOf(walk, k, legH, dir) {
  if (!walk) return { dx: 0, lift: 0 };
  const ph = walk.phase + (k === 1 ? 0 : Math.PI);
  return { dx: dir * Math.sin(ph) * legH * 0.62 * walk.gait.step * walk.amount, lift: Math.max(0, Math.cos(ph)) * legH * 0.24 * walk.gait.lift * walk.amount };
}
