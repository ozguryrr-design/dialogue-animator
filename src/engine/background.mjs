// Scene backgrounds from storyboard data (scene.background) + props, painted with the style material.
import { drawShapes } from './materials.mjs';
import { geometryOf } from './props.mjs';
import { visibleRect } from './camera.mjs';

function gradientOr(ctx, env, role, y0, y1) {
  const g = env.style.palette.gradient?.[role];
  if (!g) return env.color(role);
  const lg = ctx.createLinearGradient(0, y0, 0, y1);
  lg.addColorStop(0, g[0]); lg.addColorStop(1, g[1]);
  return lg;
}

/** Cached dot pattern (dot radius = r * pitch) in the texture colour. */
export function halftonePattern(ctx, env, pitch, r) {
  const key = `ht:${pitch}:${r}`;
  const cache = (env.cache.patterns ||= new Map());
  let entry = cache.get(key);
  if (!entry) {
    const c = env.createCanvas(pitch, pitch), g = c.getContext('2d');
    g.fillStyle = env.color(env.style.texture.color || 'accent1');
    g.beginPath(); g.arc(pitch / 2, pitch / 2, Math.max(0.5, r * pitch), 0, Math.PI * 2); g.fill();
    entry = { canvas: c, patterns: new WeakMap() };
    cache.set(key, entry);
  }
  // a pattern belongs to the context that created it
  let pat = entry.patterns.get(ctx);
  if (!pat) { pat = ctx.createPattern(entry.canvas, 'repeat'); entry.patterns.set(ctx, pat); }
  return pat;
}

/** Prop state at time t: "prop" events animate numbers (door open 1 -> 0, x, y) or toggle visibility; hold and drop move it between hands and floor. */
export function propState(env, p, t) {
  const opts = { ...(p.opts || {}) };
  let visible = p.visible !== false, x = p.x, y = p.y, held = false;
  for (const e of (env?.idx?.prop?.[p.id]) || []) {
    if (t < e.t) break;
    if (e.key === 'visible') { visible = !!e.value; continue; }
    const u = Math.min(1, (t - e.t) / (e.dur || 0.001)), k = u * u * (3 - 2 * u);
    if (e.key === 'x') { x += (e.value - x) * k; continue; }
    if (e.key === 'y') { y += (e.value - y) * k; continue; }
    const from = opts[e.key] ?? 0;
    opts[e.key] = from + (e.value - from) * k;
  }
  for (const e of (env?.idx?.attach?.[p.id]) || []) {
    if (t < e.t) break;
    if (e.type === 'hold') held = true;
    else { held = false; visible = true; x = e.x ?? x; y = e.y ?? y; }
  }
  return { opts, visible, x, y, held };
}

export function propItems(p, env = null, t = 0, shift = [0, 0]) {
  const { opts, visible, x, y, held } = propState(env, p, t);
  if (!visible || held) return null;
  const g = geometryOf(p, opts);
  return { k: 'group', tf: { x: x + shift[0], y: y + shift[1], sx: (p.flip ? -1 : 1) * (p.s || 1), sy: p.s || 1 }, items: g.items, id: p.id };
}

/** Depth: 1 sits on the characters' plane, less is further away and slides more slowly past the camera, more is closer. */
function parallax(p, cam) {
  const d = p.depth ?? 1;
  return d === 1 || !cam ? [0, 0] : [cam.x * (1 - d), (cam.y + 620) * (1 - d) * 0.5];
}

function ridge(X0, X1, off) {
  const pts = [[X0, 0]];
  for (let x = X0; x <= X1 + 120; x += 120) { const v = x + off; pts.push([x, -445 - 118 * Math.sin(v * 0.0021 + 0.6) - 52 * Math.sin(v * 0.0057 + 2.1)]); }
  pts.push([X1 + 120, 0]);
  return pts;
}

export function drawBackground(ctx, env, scene, cam, seed, t = 0) {
  if (env.hooks?.background) { env.hooks.background(ctx, env, scene, cam, seed); return; }
  const bg = scene.background || { place: 'studio', wall: 'wall', floor: 'floor', props: [] };
  const v = visibleRect(env, cam, 0.4);
  const X0 = Math.min(v.x0, -3000), X1 = Math.max(v.x1, 3000);
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const base = [];
  if (bg.place === 'exterior') {
    fill(X0, Math.min(v.y0, -4000), X1 - X0, Math.abs(Math.min(v.y0, -4000)) + 10, gradientOr(ctx, env, bg.sky || 'sky', -2000, 0));
    if (bg.hills) base.push({ k: 'poly', pts: ridge(X0, X1, -cam.x * 0.65), fill: bg.hills, noShadow: false });
    base.push({ k: 'poly', pts: [[X0, bg.horizon || -40], [0, (bg.horizon || -40) - 6], [X1, bg.horizon || -40], [X1, 4000], [X0, 4000]], fill: bg.ground || 'ground' });
  } else {
    fill(X0, Math.min(v.y0, -4000), X1 - X0, Math.abs(Math.min(v.y0, -4000)) + 10, gradientOr(ctx, env, bg.wall || 'wall', -1800, 0));
    if (bg.place === 'studio' && bg.disc) base.push({ k: 'circle', x: 0, y: -620, r: 760, fill: bg.disc });
    if (bg.stripe) base.push({ k: 'rrect', x: X0, y: -640, w: X1 - X0, h: 26, r: 0, fill: bg.stripe, noShadow: true });
    base.push({ k: 'poly', pts: [[X0, 0], [0, -4], [X1, 0], [X1, 4000], [X0, 4000]], fill: bg.floor || 'floor' });
    base.push({ k: 'rrect', x: X0, y: -24, w: X1 - X0, h: 24, r: 0, fill: 'dark', noShadow: true, alpha: 0.85 });
  }
  drawShapes(ctx, base, env, seed + 11);
  if (env.style.texture?.type === 'halftone') {
    // print-style shading: coarse dot bands high on the wall/sky, denser toward the top
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const pitch = env.style.texture.pitchPx || 14;
    for (const [y0, y1, r] of [[-4000, -1250, 0.36], [-1250, -1000, 0.26], [-1000, -820, 0.16]]) {
      ctx.fillStyle = halftonePattern(ctx, env, pitch, r);
      ctx.fillRect(X0, y0, X1 - X0, y1 - y0);
    }
    ctx.restore();
  }
  const floorProps = (bg.props || []).filter((p) => p.layer === 'floor');
  const backProps = (bg.props || []).filter((p) => !p.layer || p.layer === 'back');
  drawShapes(ctx, floorProps.map((p) => propItems(p, env, t, parallax(p, cam))), env, seed + 23);
  drawShapes(ctx, backProps.map((p) => propItems(p, env, t, parallax(p, cam))), env, seed + 37);
  // night / mood tint over the set only (characters stay lit, as if by lamplight)
  if (bg.tint) {
    ctx.save();
    ctx.globalAlpha = bg.tint.alpha ?? 0.3;
    ctx.fillStyle = env.color(bg.tint.color || 'dark');
    ctx.fillRect(X0, Math.min(v.y0, -4000), X1 - X0, 8000);
    ctx.restore();
  }
}

export function drawForeground(ctx, env, scene, seed, t = 0, cam = null) {
  const front = (scene.background?.props || []).filter((p) => p.layer === 'front');
  if (front.length) drawShapes(ctx, front.map((p) => propItems(p, env, t, parallax(p, cam))), env, seed + 53);
}
