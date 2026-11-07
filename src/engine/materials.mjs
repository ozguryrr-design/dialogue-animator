// Materials paint shape specs. The same character or prop looks like cut paper, an outlined gummy
// sticker or a riso print depending on the style pack's "family".
import { rand, hash32 } from './math.mjs';
import { rgba, mix } from './color.mjs';
import { toPolygon, tracePoly, tracePath, circlePts, bbox } from './shapes.mjs';

function jitterPts(pts, amp, seed) {
  if (!amp) return pts;
  return pts.map((p, i) => [p[0] + (rand(seed, i, 1) - 0.5) * 2 * amp, p[1] + (rand(seed, i, 2) - 0.5) * 2 * amp]);
}

function withGroup(ctx, item, fn) {
  const tf = item.tf || {};
  ctx.save();
  ctx.translate(tf.x || 0, tf.y || 0);
  if (tf.rot) ctx.rotate(tf.rot);
  if (tf.sx || tf.sy) ctx.scale(tf.sx || 1, tf.sy || 1);
  fn();
  ctx.restore();
}

function resolve(c, env) { return c && c[0] !== '#' ? env.color(c) : c; }

// ---------------- paper ----------------
function paperShape(ctx, s, env, seed) {
  const st = env.style, sh = st.shadow || {}, edge = st.edge || {};
  const amp = s.noJitter ? 0 : (s.feature ? 0.6 : 1) * (edge.jitter || 0);
  const fill = resolve(s.fill, env);
  if (s.k === 'ring') {
    const outer = jitterPts(circlePts(s.x, s.y, s.r + s.w / 2), amp, seed), inner = jitterPts(circlePts(s.x, s.y, Math.max(1, s.r - s.w / 2)), amp, seed + 7);
    const draw = (c) => { ctx.beginPath(); for (const ring of [outer, inner]) { ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); } ctx.fillStyle = c; ctx.fill('evenodd'); };
    if (!s.feature && !s.noShadow) { ctx.save(); ctx.translate(sh.offsetX || 0, sh.offsetY || 0); draw(rgba(resolve(sh.color || 'ink', env), sh.opacity ?? 0.2)); ctx.restore(); }
    draw(fill);
    return;
  }
  const pts = jitterPts(toPolygon(s), amp, seed);
  if (!pts.length) return;
  if (s.alpha !== undefined) ctx.globalAlpha *= s.alpha;
  if (!s.feature && !s.noShadow && (sh.opacity || 0) > 0) {
    ctx.save();
    ctx.translate(sh.offsetX || 0, sh.offsetY || 0);
    tracePoly(ctx, pts);
    ctx.fillStyle = rgba(resolve(sh.color || 'ink', env), sh.opacity);
    ctx.fill();
    ctx.restore();
  }
  tracePoly(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (s.alpha !== undefined) ctx.globalAlpha /= s.alpha;
}

// ---------------- gummy (outlined, glossy) ----------------
function gummyShape(ctx, s, env, seed) {
  const st = env.style, L = st.line?.width ?? 9, ink = resolve(st.line?.color || 'ink', env);
  const fill = resolve(s.fill, env);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (s.alpha !== undefined) ctx.globalAlpha *= s.alpha;
  if (s.k === 'stroke') {
    if (!s.feature) { ctx.strokeStyle = ink; ctx.lineWidth = s.w + 2 * L; tracePoly(ctx, s.pts, !!s.closed); ctx.stroke(); }
    ctx.strokeStyle = fill; ctx.lineWidth = s.w; tracePoly(ctx, s.pts, !!s.closed); ctx.stroke();
  } else if (s.k === 'ring') {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    if (!s.feature) { ctx.strokeStyle = ink; ctx.lineWidth = s.w + 2 * L * 0.7; ctx.stroke(); }
    ctx.strokeStyle = fill; ctx.lineWidth = s.w; ctx.stroke();
  } else {
    if (s.k === 'path') tracePath(ctx, s.cmds); else tracePoly(ctx, toPolygon(s));
    ctx.fillStyle = fill; ctx.fill();
    if (!s.feature && !s.noOutline) { ctx.lineWidth = s.lineW || L; ctx.strokeStyle = ink; ctx.stroke(); }
    if (s.gloss) {
      const b = bbox(toPolygon(s));
      ctx.save();
      ctx.translate(b.x0 + b.w * 0.28, b.y0 + b.h * 0.16);
      ctx.rotate(-0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(4, b.w * 0.075), Math.max(6, b.h * 0.07), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
      ctx.restore();
    }
  }
  if (s.alpha !== undefined) ctx.globalAlpha /= s.alpha;
}

// ---------------- line (monoline ink + offset print fills) ----------------
function lineShape(ctx, s, env, seed) {
  const st = env.style, W = st.line?.width ?? 5, ink = resolve(st.line?.color || 'ink', env);
  const amp = s.noJitter ? 0 : (st.line?.jitter ?? 2);
  const [mx, my] = st.texture?.misregisterPx || [8, 5];
  const fill = resolve(s.fill, env);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (s.alpha !== undefined) ctx.globalAlpha *= s.alpha;
  if (s.k === 'stroke') {
    ctx.strokeStyle = s.feature ? ink : ink;
    ctx.lineWidth = s.feature ? Math.max(W, s.w * 0.5) : Math.min(W * 1.4, Math.max(W, s.w * 0.12));
    tracePoly(ctx, jitterPts(s.pts, amp, seed), !!s.closed);
    ctx.stroke();
  } else if (s.k === 'ring') {
    ctx.strokeStyle = ink; ctx.lineWidth = W;
    tracePoly(ctx, jitterPts(circlePts(s.x, s.y, s.r), amp, seed)); ctx.stroke();
  } else {
    const pts = toPolygon(s);
    if (s.feature) { tracePoly(ctx, jitterPts(pts, amp * 0.15, seed)); ctx.fillStyle = ink === fill ? ink : fill; ctx.fill(); }
    else {
      // paper underlay hides lines behind, then the offset colour pass (multiply), then the ink outline
      tracePoly(ctx, pts); ctx.fillStyle = resolve('paper', env); ctx.fill();
      if (fill && fill.toUpperCase() !== resolve('paper', env).toUpperCase()) {
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.translate(mx, my);
        tracePoly(ctx, jitterPts(pts, amp * 0.6, seed + 3)); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      }
      if (!s.noOutline) { ctx.strokeStyle = ink; ctx.lineWidth = W; tracePoly(ctx, jitterPts(pts, amp, seed)); ctx.stroke(); }
    }
  }
  if (s.alpha !== undefined) ctx.globalAlpha /= s.alpha;
}

const PAINTERS = { paper: paperShape, gummy: gummyShape, line: lineShape };

/** Draw a list of shapes (and nested groups) with the style's material. */
export function drawShapes(ctx, items, env, seed = 0) {
  const paint = PAINTERS[env.style.family] || paperShape;
  items.forEach((s, i) => {
    if (!s) return;
    const sd = hash32(seed * 131 + i * 977 + (s.id ? hash32(s.id) : 0));
    if (s.k === 'group') withGroup(ctx, s, () => drawShapes(ctx, s.items, env, sd));
    else paint(ctx, s, env, sd);
  });
}

/** Flatten groups into absolute shapes (for bounding boxes / layout checks). */
export function flatten(items, tf = { x: 0, y: 0, rot: 0 }) {
  const out = [];
  for (const s of items) {
    if (!s) continue;
    if (s.k === 'group') {
      const g = s.tf || {};
      const c = Math.cos(tf.rot), si = Math.sin(tf.rot);
      const gx = tf.x + (g.x || 0) * c - (g.y || 0) * si, gy = tf.y + (g.x || 0) * si + (g.y || 0) * c;
      out.push(...flatten(s.items, { x: gx, y: gy, rot: tf.rot + (g.rot || 0) }));
    } else {
      const pts = s.k === 'ring' ? circlePts(s.x, s.y, s.r + s.w / 2) : toPolygon(s);
      const c = Math.cos(tf.rot), si = Math.sin(tf.rot);
      out.push({ ...s, abs: pts.map(([x, y]) => [tf.x + x * c - y * si, tf.y + x * si + y * c]) });
    }
  }
  return out;
}

export { mix };
