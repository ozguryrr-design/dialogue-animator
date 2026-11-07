// Scene backgrounds from storyboard data (scene.background) + props, painted with the style material.
import { drawShapes } from './materials.mjs';
import { propGeometry } from './props.mjs';
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

export function propItems(p) {
  const g = propGeometry(p.type, p.opts || {});
  return { k: 'group', tf: { x: p.x, y: p.y, sx: (p.flip ? -1 : 1) * (p.s || 1), sy: p.s || 1 }, items: g.items, id: p.id };
}

export function drawBackground(ctx, env, scene, cam, seed) {
  if (env.hooks?.background) { env.hooks.background(ctx, env, scene, cam, seed); return; }
  const bg = scene.background || { place: 'studio', wall: 'wall', floor: 'floor', props: [] };
  const v = visibleRect(env, cam, 0.4);
  const X0 = Math.min(v.x0, -3000), X1 = Math.max(v.x1, 3000);
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const base = [];
  if (bg.place === 'exterior') {
    fill(X0, Math.min(v.y0, -4000), X1 - X0, Math.abs(Math.min(v.y0, -4000)) + 10, gradientOr(ctx, env, bg.sky || 'sky', -2000, 0));
    if (bg.hills) base.push({ k: 'poly', pts: [[X0, -330], [-1400, -520], [-700, -380], [-100, -560], [600, -360], [1300, -540], [X1, -380], [X1, 0], [X0, 0]], fill: bg.hills, noShadow: false });
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
  drawShapes(ctx, floorProps.map(propItems), env, seed + 23);
  drawShapes(ctx, backProps.map(propItems), env, seed + 37);
}

export function drawForeground(ctx, env, scene, seed) {
  const front = (scene.background?.props || []).filter((p) => p.layer === 'front');
  if (front.length) drawShapes(ctx, front.map(propItems), env, seed + 53);
}
