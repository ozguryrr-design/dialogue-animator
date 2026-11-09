// Character state at time t: expression blend, mouth, blink, pose, breathing, head tilt, facing.
// Characters may animate "on twos" (style.motion.characterFps), independent of the camera's frame rate.
import { clamp, ease, spring, hash32, TAU } from './math.mjs';
import { blendExpr } from './expressions.mjs';
import { poseAt, REST } from './poses.mjs';
import { geometryOf } from './props.mjs';
import { GAITS, HOLD_POSES, positionAt, heldAt } from './motion.mjs';

export function characterTime(t, env) {
  const cf = env.style.motion?.characterFps || env.fps;
  return cf >= env.fps ? t : Math.floor(t * cf + 1e-6) / cf;
}

export function speakerAt(sb, t) {
  for (const l of sb.lines) if (!l.voiceOver && t >= l.start - 0.05 && t <= l.end + 0.05) return l.speaker;
  return null;
}

export function facingAt(env, ch, scene, t) {
  const looks = env.idx.look[ch.id];
  if (looks) { let d = null; for (const e of looks) if (e.t <= t) d = e.value; if (d === -1 || d === 1) return d; }
  return scene.facing?.[ch.id] ?? 1;
}

/** Seated characters sink this fraction of their height (behind a table in front of them). */
export const SIT_DROP = 0.2;

/** Vertical offset (stage units, + = down) from sitting/standing at time t, plus 0..1 progress of a change. */
export function postureAt(env, ch, scene, t, height) {
  const H = height ?? 900 * (ch.body?.height || 1);
  let v = scene.posture?.[ch.id] === 'sit' ? 1 : 0, change = 0;
  for (const e of env.idx.posture?.[ch.id] || []) {
    if (t < e.t) break;
    const to = e.value === 'sit' ? 1 : 0, u = ease.smoother(clamp((t - e.t) / (e.dur || 1)));
    if (u < 1) change = Math.sin(Math.PI * u);
    v = v + (to - v) * u;
  }
  return { y: v * SIT_DROP * H, change };
}

export function characterState(env, ch, scene, t) {
  const sb = env.sb, M = env.style.motion || {}, fps = env.fps;
  const tc = characterTime(t, env);
  const f = Math.max(0, Math.min(sb.video.frames - 1, Math.round(tc * fps)));
  const seed = hash32(ch.id);

  // expression
  const evs = env.idx.expr[ch.id] || [];
  const base = ch.personality?.baseline || 'neutral';
  let cur = { t: -1, value: base }, prev = { value: base };
  for (const e of evs) if (e.t <= tc) { prev = cur; cur = e; }
  const dt = tc - cur.t;
  let u = M.expressionFrames ? clamp((dt * fps) / M.expressionFrames) : 1;
  if (M.overshoot) u = ease.outBack(u, 1 + 2 * M.overshoot);
  const expr = blendExpr(prev.value, cur.value, u);

  // squash: a short pop when the expression changes, plus spring bounce on word onsets for bouncy styles
  let squash = 0;
  if (M.squash && cur.t >= 0 && prev.value !== cur.value && dt * fps < (M.squashFrames || 2)) squash = -M.squash;
  if (M.springHz) {
    const own = env.linesBy[ch.id] || [];
    let onset = null;
    for (const l of own) for (const w of l.words) if (w.s <= tc && tc - w.s < 0.7) onset = w.s;
    if (onset !== null) squash += -(M.squash || 0.1) * Math.exp(-5 * (tc - onset)) * Math.cos(TAU * M.springHz * (tc - onset));
    if (cur.t >= 0 && prev.value !== cur.value) squash += (M.squash || 0.1) * 0.6 * (spring(dt, M.springHz, 0.35) - 1) * (dt < 0.6 ? 1 : 0);
  }
  if (M.bob) squash += M.bob * Math.sin(TAU * (M.bobHz || 0.6) * tc + (seed % 7));

  // mouth
  const mouth = { open: 0, round: false };
  const track = sb.tracks?.mouth?.[ch.id];
  if (track) mouth.open = (track[f] || 0) / 100;
  const rt = sb.tracks?.round?.[ch.id];
  if (rt) mouth.round = rt[f] === '1';
  const talking = (env.linesBy[ch.id] || []).some((l) => tc >= l.start && tc <= l.end);

  // blink
  let blink = 0;
  const BF = M.blinkFrames || 4;
  for (const b of sb.tracks?.blinks?.[ch.id] || []) {
    const k = (tc - b) * fps;
    if (k >= 0 && k < BF) { blink = k < BF * 0.25 || k >= BF * 0.75 ? 0.6 : 1; break; }
  }

  // pose and head
  // walking and carrying: the feet follow the distance covered, so they stay planted
  const mv = positionAt(env, ch, scene, tc);
  const G = mv.gait ? GAITS[mv.gait] : null;
  const walk = G ? { amount: mv.amount, phase: (mv.walked / G.cycle) * TAU, gait: G } : null;
  const props = (env.cache.propById ||= Object.fromEntries(Object.values(env.scenes).flatMap((s) => (s.background?.props || []).map((p) => [p.id, p]))));
  const held = heldAt(env, ch, scene, tc).filter((h) => props[h.id]).map((h) => { const p = props[h.id], g = geometryOf(p); return { ...h, items: g.items, h: g.h, w: g.w, s: (p.s || 1) * h.scale }; });
  const restPose = { ...REST };
  for (const h of held) Object.assign(restPose, HOLD_POSES[h.side] || HOLD_POSES.near);
  const pose = poseAt(env.idx.gesture[ch.id] || [], tc, (M.gestureFrames || 6) / fps, restPose);
  if (walk) {
    const swing = Math.sin(walk.phase) * G.arm * walk.amount;
    if (!pose.near.target && !pose.near.at) pose.near = { ...pose.near, sh: Math.max(0.02, pose.near.sh + swing) };
    if (!pose.far.target && !pose.far.at) pose.far = { ...pose.far, sh: Math.max(0.02, pose.far.sh - swing) };
    pose.lean += G.lean * walk.amount;
  }
  let headTilt = 0;
  const speaker = speakerAt(sb, tc);
  const dir = facingAt(env, ch, scene, tc);
  if (speaker && speaker !== ch.id) headTilt += dir * 0.04; // listeners lean their head toward the speaker
  if (M.headNodDeg) {
    for (const l of env.linesBy[ch.id] || []) for (const w of l.words) {
      const d = tc - w.s;
      if (d >= 0 && d < 0.35 && /[!?.]$/.test(w.w)) headTilt += (M.headNodDeg * Math.PI / 180) * Math.sin(Math.PI * d / 0.35) * dir;
    }
  }
  const breath = Math.sin(TAU * (M.breathHz || 0.3) * tc + (seed % 11));
  const sway = (M.swayDeg ? (M.swayDeg * Math.PI / 180) * Math.sin(TAU * 0.25 * tc + (seed % 5)) : 0) + (walk ? Math.sin(walk.phase) * 0.022 * walk.amount : 0);
  // an explicit glance overrides where the expression looks
  for (const g of env.idx.gaze[ch.id] || []) if (tc >= g.t && tc <= g.t + (g.dur || 1.2)) expr.look = g.value;
  const posture = postureAt(env, ch, scene, tc);
  if (posture.change) pose.lean += 0.09 * posture.change; // lean forward while getting up or sitting down
  return { dir, expr, mouth, talking, blink, pose, breath, headTilt, squash, sway, tc, postureY: posture.y, walk, held, turn: walk ? walk.amount : 0, bob: walk ? -Math.abs(Math.sin(walk.phase)) * G.bob * walk.amount : 0 };
}
