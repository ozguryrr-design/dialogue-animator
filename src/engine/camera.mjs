// Camera at time t for a shot: a sampled path (`camera.track`, written by the director when the camera
// follows the action) or a linear creep from `from` to `to`; constant roll, plus impact shakes and punch
// zooms from events. Units: stage units; h = visible height.
import { lerp, clamp, ease } from './math.mjs';

export function cameraAt(env, shot, t) {
  const c = shot.camera, dur = Math.max(1e-3, shot.end - shot.start);
  let cam;
  if (c.track) {
    const T = c.track, last = T.x.length - 1, at = clamp((t - T.t0) * T.rate, 0, last), k = Math.min(Math.floor(at), Math.max(0, last - 1)), f = last ? at - k : 0;
    const pick = (a) => lerp(a[k], a[Math.min(k + 1, last)], f);
    cam = { x: pick(T.x), y: pick(T.y), h: Math.max(50, pick(T.h)), roll: T.roll ? pick(T.roll) : c.from.roll || 0 };
  } else {
    const raw = (t - shot.start) / dur;
    const fn = ease[c.ease || 'linear'] || ease.linear;
    const u = raw < 0 || raw > 1 || (c.ease || 'linear') === 'linear' ? raw : fn(raw);
    cam = { x: lerp(c.from.x, c.to.x, u), y: lerp(c.from.y, c.to.y, u), h: Math.max(50, lerp(c.from.h, c.to.h, u)), roll: c.from.roll || 0 };
  }
  const scale = env.H / cam.h;
  for (const e of env.idx.shake) {
    const k = Math.floor((t - e.t) * env.fps);
    if (k >= 0 && k < (e.frames || 7)) cam.x += ((k % 2 ? 1 : -1) * (e.amp || 12) * (1 - k / (e.frames || 7))) / scale;
  }
  // punch-in: a quick zoom with overshoot that holds until the end of the shot (`until`)
  for (const e of env.idx.punch) {
    if (t < e.t || t > (e.until ?? e.t + 1)) continue;
    const k = (t - e.t) * env.fps;
    cam.h *= 1 - (e.amount || 0.08) * ease.outBack(clamp(k / (e.frames || 7)));
  }
  return cam;
}

export function applyView(ctx, env, cam) {
  const s = env.H / cam.h;
  ctx.translate(env.W / 2, env.H / 2);
  if (cam.roll) ctx.rotate(cam.roll);
  ctx.scale(s, s);
  ctx.translate(-cam.x, -cam.y);
}

/** Stage point -> screen pixel. */
export function toScreen(env, cam, x, y) {
  const s = env.H / cam.h, c = Math.cos(cam.roll || 0), si = Math.sin(cam.roll || 0);
  const dx = (x - cam.x) * s, dy = (y - cam.y) * s;
  return [env.W / 2 + dx * c - dy * si, env.H / 2 + dx * si + dy * c];
}

/** Visible stage rectangle (with margin) for a camera, used to size background fills. */
export function visibleRect(env, cam, margin = 0.3) {
  const s = env.H / cam.h, hw = (env.W / 2 / s) * (1 + margin), hh = (env.H / 2 / s) * (1 + margin);
  const r = Math.abs(Math.sin(cam.roll || 0));
  return { x0: cam.x - hw - hh * r, x1: cam.x + hw + hh * r, y0: cam.y - hh - hw * r, y1: cam.y + hh + hw * r };
}
