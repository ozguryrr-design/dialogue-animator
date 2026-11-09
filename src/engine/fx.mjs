// Small reaction symbols next to a character's head (!, ?, sweat, anger, sparkle, drop, heart, idea).
import { drawShapes } from './materials.mjs';
import { arcPts } from './shapes.mjs';
import { clamp, ease } from './math.mjs';
import { positionAt } from './motion.mjs';

function symbol(kind, s) {
  const out = [];
  const star = (n, r1, r2, x = 0, y = 0, rot = -Math.PI / 2) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i / (n * 2)) * Math.PI * 2; pts.push([x + Math.cos(a) * r * s, y + Math.sin(a) * r * s]); }
    return pts;
  };
  switch (kind) {
    case 'exclaim':
      out.push({ k: 'poly', pts: star(6, 92, 54), fill: 'accent1' });
      out.push({ k: 'rrect', x: -9 * s, y: -46 * s, w: 18 * s, h: 58 * s, r: 7 * s, fill: 'ink', feature: true });
      out.push({ k: 'circle', x: 0, y: 32 * s, r: 10 * s, fill: 'ink', feature: true });
      break;
    case 'question':
      out.push({ k: 'circle', x: 0, y: 0, r: 70 * s, fill: 'light' });
      out.push({ k: 'stroke', pts: [...arcPts(0, -16 * s, 26 * s, Math.PI * 1.05, Math.PI * 2.35, 10), [6 * s, 18 * s]], w: 15 * s, fill: 'ink', feature: true });
      out.push({ k: 'circle', x: 6 * s, y: 42 * s, r: 9 * s, fill: 'ink', feature: true });
      break;
    case 'sweat':
      out.push({ k: 'poly', pts: [[0, -50 * s], [30 * s, 10 * s], [22 * s, 34 * s], [0, 44 * s], [-22 * s, 34 * s], [-30 * s, 10 * s]], fill: 'glass' });
      break;
    case 'drop':
      out.push({ k: 'poly', pts: [[0, -26 * s], [16 * s, 6 * s], [10 * s, 20 * s], [0, 24 * s], [-10 * s, 20 * s], [-16 * s, 6 * s]], fill: 'glass' });
      break;
    case 'anger':
      for (const [x, y, r] of [[-26, -26, 0], [26, -26, 1], [26, 26, 2], [-26, 26, 3]]) {
        const a = (r * Math.PI) / 2;
        out.push({ k: 'stroke', pts: arcPts(x * s, y * s, 22 * s, a + Math.PI * 0.25, a + Math.PI * 1.25, 6), w: 12 * s, fill: 'accent3' });
      }
      break;
    case 'sparkle':
      out.push({ k: 'poly', pts: star(4, 70, 16), fill: 'accent1' });
      out.push({ k: 'poly', pts: star(4, 36, 9, 76 * s, -56 * s), fill: 'accent1' });
      break;
    case 'heart':
      out.push({ k: 'path', cmds: [['M', 0, 30 * s], ['C', -70 * s, -20 * s, -40 * s, -70 * s, 0, -36 * s], ['C', 40 * s, -70 * s, 70 * s, -20 * s, 0, 30 * s], ['Z']], fill: 'accent3' });
      break;
    case 'idea':
      out.push({ k: 'circle', x: 0, y: -14 * s, r: 50 * s, fill: 'accent1' });
      out.push({ k: 'rrect', x: -24 * s, y: 30 * s, w: 48 * s, h: 30 * s, r: 6 * s, fill: 'dark' });
      break;
    default:
  }
  return out;
}

export function drawFx(ctx, env, scene, t, seed, metricsOf, visible = null) {
  for (const e of env.idx.fx) {
    if (t < e.t || t > e.t + (e.dur || 0.8)) continue;
    const ch = env.chars[e.target];
    if (!ch || !scene.positions || scene.positions[ch.id] === undefined) continue;
    if (visible && !visible.has(ch.id)) continue; // never pop a symbol for someone who is out of frame
    if (e.scene && e.scene !== scene.id) continue;
    const m = metricsOf(ch);
    const dir = scene.facing?.[ch.id] ?? 1;
    const x = positionAt(env, ch, scene, t).x + dir * m.headR * 1.25, y = m.headCY - m.headR * 1.25;
    const k = (t - e.t) * env.fps, end = ((e.t + (e.dur || 0.8)) - t) * env.fps;
    const stepped = (env.style.motion?.characterFps || env.fps) < env.fps;
    const pop = stepped ? (k < 2 ? 0.6 : 1) : ease.outBack(clamp(k / 5));
    const fade = clamp(end / 4);
    const sc = (m.headR / 170) * pop * (0.85 + 0.15 * fade);
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.translate(x, y);
    drawShapes(ctx, symbol(e.value, sc), env, seed + 7);
    ctx.restore();
  }
}
