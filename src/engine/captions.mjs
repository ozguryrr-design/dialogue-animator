// Captions: none | word (one word or short group at a time) | line (subtitle pages, spoken word highlighted)
// | bubble (attached to the speaker; hidden whenever the speaker is not in frame).
// Layout is computed separately from drawing so QA can check it (overflow, faces covered) without pixels.
import { rand, clamp, ease } from './math.mjs';
import { rgba } from './color.mjs';
import { drawShapes } from './materials.mjs';

export function fontFor(env, size) {
  const f = env.style.captions.font;
  const fallback = (env.style.fonts || []).filter((x) => x.fallback).map((x) => `"${x.family}"`).join(', ');
  return `${f.style === 'italic' ? 'italic ' : ''}${f.weight || 700} ${Math.round(size)}px "${f.family}"${fallback ? ', ' + fallback : ''}, sans-serif`;
}

const overlaps = (b, c) => {
  const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w)), ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
  return Math.hypot(nx - c.cx, ny - c.cy) < c.r * 0.92;
};

function activeItem(env, t) {
  const items = env.sb.captions?.items || [];
  for (let i = items.length - 1; i >= 0; i--) if (t >= items[i].start && t < items[i].end) return { item: items[i], index: i };
  return null;
}

/** Returns a layout object (or null) for the caption visible at time t. `faces` = screen circles to avoid. */
export function captionLayout(env, t, measure, faces = [], speakerHead = null) {
  const mode = env.sb.captions?.mode || 'none';
  if (mode === 'none') return null;
  const hit = activeItem(env, t);
  if (!hit) return null;
  const { item, index } = hit;
  const W = env.W, H = env.H, k = W / 1080;
  const cfg = env.style.captions[mode] || {};
  const upper = !!cfg.uppercase;
  const lang = env.sb.meta?.language;
  const caseFn = (s) => (upper ? (lang === 'tr' ? s.toLocaleUpperCase('tr') : s.toUpperCase()) : s);
  const issues = [];

  if (mode === 'word') {
    let size = (cfg.size || 92) * k;
    const text = caseFn(item.text);
    measure.font = fontFor(env, size);
    let tw = measure.measureText(text).width;
    const maxW = W * 0.88 - 2 * (cfg.padX || 30) * k;
    if (tw > maxW) { size *= maxW / tw; measure.font = fontFor(env, size); tw = measure.measureText(text).width; issues.push('word caption shrunk to fit'); }
    const padX = (cfg.padX ?? 30) * k, padY = (cfg.padY ?? 10) * k;
    const w = tw + 2 * padX, h = size * 1.18 + 2 * padY;
    let box = null;
    for (const fy of [cfg.y ?? 0.79, 0.87, 0.7, 0.16]) {
      const b = { x: (W - w) / 2, y: fy * H - h / 2, w, h };
      if (!faces.some((f) => overlaps(b, f))) { box = b; break; }
    }
    if (!box) { box = { x: (W - w) / 2, y: (cfg.y ?? 0.79) * H - h / 2, w, h }; issues.push('caption overlaps a face'); }
    const rot = cfg.tilt ? (rand(index, 3) - 0.5) * 2 * (cfg.tilt * Math.PI / 180) : 0;
    return { mode, item, index, size, box, rot, lines: [{ text, words: [{ text, w: tw, state: 'current' }], y: box.y + box.h / 2 }], issues };
  }

  if (mode === 'line') {
    let size = (cfg.size || 58) * k;
    const maxW = W * (cfg.maxWidth || 0.86), maxLines = cfg.maxLines || 2;
    const words = item.words.map((w) => ({ ...w, text: caseFn(w.w) }));
    let rows;
    for (let tries = 0; tries < 6; tries++) {
      measure.font = fontFor(env, size);
      const sp = measure.measureText(' ').width;
      rows = [[]];
      let cw = 0;
      for (const w of words) {
        w.width = measure.measureText(w.text).width;
        if (cw + w.width > maxW && rows[rows.length - 1].length) { rows.push([]); cw = 0; }
        rows[rows.length - 1].push(w);
        cw += w.width + sp;
      }
      rows.sp = sp;
      if (rows.length <= maxLines) break;
      size *= 0.9;
      if (tries === 5) issues.push(`caption needs ${rows.length} lines (max ${maxLines})`);
    }
    const lh = size * 1.25, padX = 26 * k, padY = 14 * k;
    const widths = rows.map((r) => r.reduce((a, w) => a + w.width, 0) + rows.sp * (r.length - 1));
    const w = Math.max(...widths) + 2 * padX, h = rows.length * lh + 2 * padY;
    let box = null;
    for (const fy of [cfg.y ?? 0.83, 0.9, 0.72, 0.14]) {
      const b = { x: (W - w) / 2, y: fy * H - h / 2, w, h };
      if (b.y + b.h <= H * 0.97 && !faces.some((f) => overlaps(b, f))) { box = b; break; }
    }
    if (!box) { box = { x: (W - w) / 2, y: Math.min(H * 0.97 - h, (cfg.y ?? 0.83) * H - h / 2), w, h }; issues.push('caption overlaps a face'); }
    const lines = rows.map((r, ri) => {
      let x = box.x + (box.w - widths[ri]) / 2;
      const out = r.map((wd) => { const o = { text: wd.text, x, w: wd.width, state: t >= wd.e ? 'done' : t >= wd.s ? 'current' : 'next' }; x += wd.width + rows.sp; return o; });
      return { words: out, y: box.y + padY + lh * (ri + 0.5) };
    });
    return { mode, item, index, size, box, rot: 0, lines, issues };
  }

  if (mode === 'bubble') {
    if (!speakerHead) return null; // speaker not in frame -> no bubble (never point at someone off-screen)
    let size = (cfg.size || 50) * k;
    measure.font = fontFor(env, size);
    const sp = measure.measureText(' ').width, maxW = W * (cfg.maxWidth || 0.6);
    const rows = [[]];
    let cw = 0;
    for (const w of item.words) {
      const ww = measure.measureText(w.w).width;
      if (cw + ww > maxW && rows[rows.length - 1].length) { rows.push([]); cw = 0; }
      rows[rows.length - 1].push({ ...w, width: ww });
      cw += ww + sp;
    }
    const lh = size * 1.2, padX = 32 * k, padY = 22 * k;
    const widths = rows.map((r) => r.reduce((a, w) => a + w.width, 0) + sp * (r.length - 1));
    const w = Math.max(...widths) + 2 * padX, h = rows.length * lh + 2 * padY;
    const x = clamp(speakerHead.cx - w / 2, W * 0.04, W * 0.96 - w);
    const y = clamp(speakerHead.cy - speakerHead.r - 50 * k - h, H * 0.06, H * 0.8);
    const box = { x, y, w, h };
    const lines = rows.map((r, ri) => {
      let xx = box.x + (box.w - widths[ri]) / 2;
      return { words: r.map((wd) => { const o = { text: wd.w, x: xx, w: wd.width, state: t >= wd.s ? 'done' : 'next' }; xx += wd.width + sp; return o; }), y: box.y + padY + lh * (ri + 0.5) };
    });
    return { mode, item, index, size, box, rot: 0, lines, issues, tail: [clamp(speakerHead.cx, box.x + 40 * k, box.x + box.w - 40 * k), speakerHead.cy - speakerHead.r] };
  }
  return null;
}

export function drawCaption(ctx, env, L, t) {
  if (!L) return;
  const cfg = env.style.captions[L.mode] || {};
  const k = env.W / 1080;
  const fps = env.fps;
  ctx.save();
  const cx = L.box.x + L.box.w / 2, cy = L.box.y + L.box.h / 2;
  ctx.translate(cx, cy);
  if (L.rot) ctx.rotate(L.rot);
  // entrance
  const age = (t - L.item.start) * fps;
  if (cfg.pop === 'step' && age < 2) ctx.scale(0.92, 0.92);
  else if (cfg.pop === 'spring') { const s = 0.75 + 0.25 * ease.outBack(clamp(age / 4)); ctx.scale(s, s); }
  ctx.translate(-cx, -cy);
  if (cfg.bg) {
    const shape = { k: 'rrect', x: L.box.x, y: L.box.y, w: L.box.w, h: L.box.h, r: (cfg.radius ?? 14) * k, fill: cfg.bg, alpha: cfg.bgOpacity ?? 1 };
    if (L.mode === 'bubble') {
      const [tx, ty] = L.tail;
      drawShapes(ctx, [{ k: 'poly', pts: [[tx - 26 * k, L.box.y + L.box.h - 2], [tx + 26 * k, L.box.y + L.box.h - 2], [tx, Math.min(ty, L.box.y + L.box.h + 60 * k)]], fill: cfg.bg }], env, 900 + L.index);
    }
    drawShapes(ctx, [shape], env, 1000 + L.index * 7 + Math.floor(age / 4));
  }
  ctx.font = fontFor(env, L.size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  const fill = env.color(cfg.fill || 'paper'), hi = env.color(cfg.highlight || cfg.fill || 'paper');
  for (const line of L.lines) {
    let x = line.words.length === 1 && L.mode === 'word' ? L.box.x + (L.box.w - line.words[0].w) / 2 : null;
    for (const w of line.words) {
      const wx = x ?? w.x;
      const color = w.state === 'current' && L.mode !== 'word' ? hi : fill;
      ctx.globalAlpha = w.state === 'next' ? (cfg.dim ?? 0.4) : 1;
      if (cfg.stroke) { ctx.lineWidth = cfg.stroke * k; ctx.strokeStyle = env.color(cfg.strokeColor || 'ink'); ctx.strokeText(w.text, wx, line.y); }
      ctx.fillStyle = color;
      ctx.fillText(w.text, wx, line.y);
    }
  }
  ctx.restore();
}

export { rgba };
