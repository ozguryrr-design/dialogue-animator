// "paper-cut" body: a flat puppet made of cut pieces — trapezoid torso, round head, two-segment strip
// arms held by split pins. Coordinates: feet at (0, 0), up is negative y, 1 unit ≈ 1 px in a 1080x1920 two-shot.
import { darken, mix } from '../color.mjs';
import { armFromAngles, solveIK } from '../poses.mjs';
import { arcPts, quadPts, circlePts } from '../shapes.mjs';

export const BASE_HEIGHT = 900;

export function metrics(ch, style) {
  const H = BASE_HEIGHT * (ch.body?.height || 1);
  const W = ch.body?.width || 1;
  const headR = H * (style?.character?.headRatio ?? 0.38) * 0.5 * (ch.head?.size || 1);
  const headCY = -H + headR;
  const torsoTop = headCY + headR * 0.8;
  const legH = H * 0.22;
  const [tw, bw] = TORSO[ch.body?.shape || 'trapezoid'];
  return { H, W, headR, headCY, torsoTop, legH, topW: tw * H * W, botW: bw * H * W, halfW: Math.max(bw, tw) * H * W * 0.5 + H * 0.07, faceY: headCY };
}

const TORSO = { trapezoid: [0.3, 0.46], rect: [0.36, 0.38], round: [0.32, 0.44], pear: [0.26, 0.52], triangle: [0.48, 0.3], robe: [0.3, 0.54] };

function torsoPts(m, shape) {
  const top = m.torsoTop, bot = shape === 'robe' ? -m.H * 0.035 : -m.legH + 22, tw = m.topW / 2, bw = m.botW / 2;
  if (shape === 'round') {
    const cy = (top + bot) / 2, ry = (bot - top) / 2, rx = Math.max(tw, bw) * 1.08;
    const pts = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; pts.push([Math.cos(a) * rx, cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 1 : 1.02)]); }
    return pts;
  }
  const r = 26;
  return [[-tw + r, top], [tw - r, top], [tw, top + r], [bw, bot - 6], [bw - 10, bot], [-bw + 10, bot], [-bw, bot - 6], [-tw, top + r]];
}

function headShape(m, shape, color) {
  const r = m.headR, cy = m.headCY;
  if (shape === 'oval') return { k: 'ellipse', x: 0, y: cy, rx: r * 0.9, ry: r * 1.06, fill: color };
  if (shape === 'square') return { k: 'rrect', x: -r * 0.95, y: cy - r * 0.98, w: r * 1.9, h: r * 1.96, r: r * 0.42, fill: color };
  if (shape === 'egg') {
    const pts = [];
    for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, s = Math.sin(a); pts.push([Math.cos(a) * r * (s > 0 ? 1 - 0.16 * s : 1), cy + s * r * (s > 0 ? 1.04 : 1)]); }
    return { k: 'poly', pts, fill: color };
  }
  return { k: 'circle', x: 0, y: cy, r, fill: color };
}

function hairShapes(m, style, color, dir) {
  const r = m.headR, cy = m.headCY, back = [], front = [];
  const cap = (lo = 1.1, hi = 1.9, rr = 1.07, fringe) => ({ k: 'poly', pts: [...arcPts(0, cy - r * 0.02, r * rr, Math.PI * lo, Math.PI * hi, 18), ...fringe], fill: color });
  const zig = (y0) => [[r * 0.62, cy - r * y0], [r * 0.3, cy - r * (y0 + 0.13)], [0, cy - r * y0], [-r * 0.3, cy - r * (y0 + 0.13)], [-r * 0.62, cy - r * y0]];
  switch (style) {
    case 'none': break;
    case 'short': front.push(cap(1.08, 1.92, 1.07, zig(0.5))); break;
    case 'spiky': {
      const sp = [];
      for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + i * 0.175), b = a + 0.0875 * Math.PI; sp.push({ k: 'poly', pts: [[Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95], [Math.cos(b) * r * 1.42, cy + Math.sin(b) * r * 1.42], [Math.cos(a + 0.175 * Math.PI) * r * 0.95, cy + Math.sin(a + 0.175 * Math.PI) * r * 0.95]], fill: color }); }
      front.push(...sp, cap(1.08, 1.92, 1.04, zig(0.55)));
      break;
    }
    case 'bob':
      back.push({ k: 'poly', pts: [...arcPts(0, cy, r * 1.16, Math.PI * 0.96, Math.PI * 2.04, 22), [r * 1.16, cy + r * 0.62], [-r * 1.16, cy + r * 0.62]], fill: color });
      front.push(cap(1.06, 1.94, 1.08, [[r * 0.8, cy - r * 0.42], [-r * 0.8, cy - r * 0.42]]));
      break;
    case 'long':
      back.push({ k: 'poly', pts: [...arcPts(0, cy, r * 1.18, Math.PI * 0.94, Math.PI * 2.06, 22), [r * 1.22, cy + r * 1.75], [r * 0.4, cy + r * 1.62], [-r * 0.4, cy + r * 1.62], [-r * 1.22, cy + r * 1.75]], fill: color });
      front.push(cap(1.04, 1.96, 1.08, [[r * 0.95, cy - r * 0.2], [r * 0.25 * dir, cy - r * 0.62], [-r * 0.9, cy - r * 0.35]]));
      break;
    case 'bun':
      back.push({ k: 'circle', x: 0, y: cy - r * 1.12, r: r * 0.4, fill: color });
      front.push(cap(1.06, 1.94, 1.07, [[r * 0.7, cy - r * 0.48], [-r * 0.7, cy - r * 0.48]]));
      break;
    case 'ponytail':
      back.push({ k: 'poly', pts: [[-dir * r * 0.75, cy - r * 0.6], [-dir * r * 1.45, cy - r * 0.2], [-dir * r * 1.55, cy + r * 0.9], [-dir * r * 1.2, cy + r * 0.4], [-dir * r * 0.9, cy]], fill: color });
      front.push(cap(1.06, 1.94, 1.07, [[r * 0.75, cy - r * 0.45], [0, cy - r * 0.6], [-r * 0.75, cy - r * 0.45]]));
      break;
    case 'curly': {
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.0 + (i / 8) * 1.0); back.push({ k: 'circle', x: Math.cos(a) * r * 1.02, y: cy + Math.sin(a) * r * 1.02, r: r * 0.32, fill: color }); }
      front.push(cap(1.12, 1.88, 1.0, [[r * 0.5, cy - r * 0.55], [0, cy - r * 0.7], [-r * 0.5, cy - r * 0.55]]));
      break;
    }
    default: front.push(cap(1.08, 1.92, 1.07, zig(0.5)));
  }
  return { back, front };
}

function faceShapes(ch, m, st, ink, skin) {
  const r = m.headR, cy = m.headCY, dir = st.dir, e = st.expr;
  const fx = dir * r * 0.13 + e.look[0] * dir * r * 0.04;
  const out = [];
  const eyeR = r * 0.085 * (ch.eyes?.size || 1) * e.eye;
  const ey = cy + r * 0.04 + e.look[1] * r * 0.03;
  const lid = Math.max(0, Math.min(0.9, e.lid));
  for (const k of [-1, 1]) {
    const ex = fx + k * r * 0.4;
    if (st.blink > 0.5) out.push({ k: 'rrect', x: ex - eyeR * 1.3, y: ey - eyeR * 0.3, w: eyeR * 2.6, h: eyeR * 0.6, r: eyeR * 0.3, fill: ink, feature: true });
    else if (e.shape === 'arc' || e.shape === 'closed') {
      const rr = eyeR * (e.shape === 'closed' ? 1.25 : 1.5);
      out.push({ k: 'stroke', pts: arcPts(ex, ey + rr * 0.55, rr, Math.PI * 1.12, Math.PI * 1.88, 8), w: eyeR * 0.62, fill: ink, feature: true });
    } else {
      const lx = e.look[0] * dir * eyeR * 0.35, ly = e.look[1] * eyeR * 0.35;
      out.push({ k: 'ellipse', x: ex + lx, y: ey + ly + eyeR * lid * 0.3, rx: eyeR, ry: eyeR * (1 - lid * 0.6) * (st.blink > 0 ? 0.55 : 1), fill: ink, feature: true });
      if (ch.eyes?.lashes) out.push({ k: 'stroke', pts: [[ex + k * eyeR * 0.6, ey - eyeR * 0.6], [ex + k * eyeR * 1.4, ey - eyeR * 1.2]], w: eyeR * 0.35, fill: ink, feature: true });
    }
    // brows
    const bw = r * 0.17, bh = r * 0.07 * (ch.brows?.weight || 1), by = ey - r * 0.34 - e.brow * r;
    const t = k * e.tilt;
    const c = Math.cos(t), s = Math.sin(t);
    const corners = [[-bw, -bh / 2], [bw, -bh / 2], [bw, bh / 2], [-bw, bh / 2]].map(([x, y]) => [ex + x * c - y * s, by + x * s + y * c]);
    out.push({ k: 'poly', pts: corners, fill: ink, feature: true });
  }
  // nose
  const nose = ch.nose || 'none';
  const ny = cy + r * 0.24;
  if (nose === 'dot') out.push({ k: 'circle', x: fx + dir * r * 0.04, y: ny, r: r * 0.045, fill: darken(skin, 0.22), feature: true });
  if (nose === 'button') out.push({ k: 'ellipse', x: fx + dir * r * 0.05, y: ny, rx: r * 0.09, ry: r * 0.065, fill: darken(skin, 0.14), feature: true });
  if (nose === 'long') out.push({ k: 'poly', pts: [[fx, ny - r * 0.16], [fx + dir * r * 0.26, ny + r * 0.06], [fx, ny + r * 0.06]], fill: darken(skin, 0.12) });
  // mouth
  const mw = r * 0.2 * e.width, mx = fx + dir * r * 0.02 + e.skew * r * 0.05, my = cy + r * 0.48;
  const open = Math.max(e.open * (st.talking ? 0.4 : 1), st.mouth.open);
  const curve = e.curve;
  if (open > 0.06) {
    const rx = mw * (st.mouth.round ? 0.62 : 1), ry = r * (0.05 + 0.2 * open);
    const lift = curve * r * 0.06;
    const L = [mx - rx, my - lift], R = [mx + rx, my - lift - e.skew * r * 0.05];
    const top = quadPts(L, [mx, my - ry * 0.55 + curve * r * 0.02], R, 8);
    const bot = quadPts(R, [mx, my + ry * 1.7], L, 10).slice(1, -1);
    out.push({ k: 'poly', pts: [...top, ...bot], fill: ink, feature: true });
    if (open > 0.4) out.push({ k: 'ellipse', x: mx, y: my + ry * 0.62, rx: rx * 0.45, ry: ry * 0.28, fill: mix('#D9653B', skin, 0.15), feature: true });
  } else {
    const L = [mx - mw, my - curve * r * 0.04], R = [mx + mw, my - curve * r * 0.04 - e.skew * r * 0.07];
    out.push({ k: 'stroke', pts: quadPts(L, [mx, my + curve * r * 0.16], R, 10), w: r * 0.065, fill: ink, feature: true });
  }
  return out;
}

function accessoryShapes(ch, m, st, cols) {
  const acc = new Set(ch.accessories || []), r = m.headR, cy = m.headCY, dir = st.dir;
  const head = [], neck = [], top = [];
  const fx = dir * r * 0.13;
  if (acc.has('blush')) for (const k of [-1, 1]) head.push({ k: 'ellipse', x: fx + k * r * 0.52, y: cy + r * 0.3, rx: r * 0.13, ry: r * 0.07, fill: mix('#E88FAE', cols.skin, 0.35), feature: true });
  if (acc.has('freckles')) for (const k of [-1, 1]) for (let i = 0; i < 3; i++) head.push({ k: 'circle', x: fx + k * r * (0.42 + i * 0.09), y: cy + r * (0.26 + (i % 2) * 0.07), r: r * 0.022, fill: darken(cols.skin, 0.3), feature: true });
  if (acc.has('mustache')) for (const k of [-1, 1]) head.push({ k: 'ellipse', x: fx + k * r * 0.1, y: cy + r * 0.36, rx: r * 0.13, ry: r * 0.055, rot: k * 0.25, fill: cols.hair });
  if (acc.has('beard')) head.push({ k: 'poly', pts: [...arcPts(fx * 0.5, cy + r * 0.2, r * 0.82, 0.1, Math.PI - 0.1, 14), ...arcPts(fx * 0.5, cy + r * 0.32, r * 0.5, Math.PI - 0.3, 0.3, 10)], fill: cols.hair });
  if (acc.has('earrings')) for (const k of [-1, 1]) head.push({ k: 'circle', x: k * r * 0.98, y: cy + r * 0.32, r: r * 0.07, fill: cols.accent });
  if (acc.has('glasses')) {
    const ey = cy + r * 0.04, gr = r * 0.2, w = r * 0.055;
    for (const k of [-1, 1]) top.push({ k: 'ring', x: fx + k * r * 0.4, y: ey, r: gr, w, fill: cols.ink });
    top.push({ k: 'stroke', pts: [[fx - r * 0.2, ey - r * 0.02], [fx + r * 0.2, ey - r * 0.02]], w, fill: cols.ink });
  }
  if (acc.has('headphones')) {
    top.push({ k: 'stroke', pts: arcPts(0, cy, r * 1.12, Math.PI * 1.05, Math.PI * 1.95, 14), w: r * 0.1, fill: cols.accent });
    for (const k of [-1, 1]) top.push({ k: 'rrect', x: k * r * 1.02 - r * 0.13, y: cy - r * 0.2, w: r * 0.26, h: r * 0.42, r: r * 0.1, fill: cols.accent });
  }
  if (acc.has('hat')) {
    top.push({ k: 'rrect', x: -r * 1.25, y: cy - r * 0.82, w: r * 2.5, h: r * 0.16, r: r * 0.06, fill: cols.accent });
    top.push({ k: 'rrect', x: -r * 0.78, y: cy - r * 1.5, w: r * 1.56, h: r * 0.74, r: r * 0.2, fill: cols.accent });
    top.push({ k: 'rrect', x: -r * 0.78, y: cy - r * 0.98, w: r * 1.56, h: r * 0.14, r: 0, fill: cols.ink, noShadow: true });
  }
  if (acc.has('turban')) {
    // a wrapped dome sitting above the brow line, with wrap bands and a small top cap
    const base = cy - r * 0.52, light = 'light', band = mix(cols.ink, '#F3EBDD', 0.82);
    top.push({ k: 'poly', pts: [...arcPts(0, base, r * 1.06, Math.PI, Math.PI * 2, 20).map(([x, y]) => [x, base + (y - base) * 0.78])], fill: light });
    for (const [k, a0, a1] of [[0.22, 1.1, 1.7], [0.5, 1.2, 1.84], [0.78, 1.32, 1.93]]) top.push({ k: 'stroke', pts: arcPts(0, base + r * 0.12, r * (1.0 - k * 0.32), Math.PI * a0, Math.PI * a1, 10).map(([x, y]) => [x, base + (y - base) * 0.82]), w: r * 0.06, fill: band, noShadow: true });
    top.push({ k: 'rrect', x: -r * 1.06, y: base - r * 0.06, w: r * 2.12, h: r * 0.2, r: r * 0.1, fill: light });
    top.push({ k: 'ellipse', x: 0, y: base - r * 0.8, rx: r * 0.2, ry: r * 0.1, fill: cols.accent });
  }
  if (acc.has('crown')) {
    const base = cy - r * 0.7;
    top.push({ k: 'poly', pts: [[-r * 0.75, base], [-r * 0.8, base - r * 0.55], [-r * 0.4, base - r * 0.25], [0, base - r * 0.7], [r * 0.4, base - r * 0.25], [r * 0.8, base - r * 0.55], [r * 0.75, base]], fill: 'accent1' });
  }
  if (acc.has('beanie')) {
    top.push({ k: 'poly', pts: [...arcPts(0, cy - r * 0.3, r * 1.04, Math.PI * 1.02, Math.PI * 1.98, 18)], fill: cols.accent });
    top.push({ k: 'rrect', x: -r * 1.08, y: cy - r * 0.48, w: r * 2.16, h: r * 0.28, r: r * 0.1, fill: darken(cols.accent, 0.15) });
    top.push({ k: 'circle', x: 0, y: cy - r * 1.36, r: r * 0.16, fill: cols.accent });
  }
  if (acc.has('flower')) {
    const x0 = -dir * r * 0.72, y0 = cy - r * 0.72;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; top.push({ k: 'circle', x: x0 + Math.cos(a) * r * 0.13, y: y0 + Math.sin(a) * r * 0.13, r: r * 0.1, fill: cols.accent }); }
    top.push({ k: 'circle', x: x0, y: y0, r: r * 0.08, fill: 'accent1' });
  }
  const tt = m.torsoTop;
  if (acc.has('scarf')) {
    neck.push({ k: 'rrect', x: -m.topW * 0.42, y: tt - r * 0.08, w: m.topW * 0.84, h: r * 0.3, r: r * 0.12, fill: cols.accent });
    neck.push({ k: 'rrect', x: dir * m.topW * 0.12 - r * 0.11, y: tt + r * 0.12, w: r * 0.22, h: r * 0.75, r: r * 0.06, fill: cols.accent });
  }
  if (acc.has('bowtie')) {
    neck.push({ k: 'poly', pts: [[0, tt + r * 0.12], [-r * 0.3, tt - r * 0.02], [-r * 0.3, tt + r * 0.28]], fill: cols.accent });
    neck.push({ k: 'poly', pts: [[0, tt + r * 0.12], [r * 0.3, tt - r * 0.02], [r * 0.3, tt + r * 0.28]], fill: cols.accent });
    neck.push({ k: 'circle', x: 0, y: tt + r * 0.12, r: r * 0.08, fill: darken(cols.accent, 0.2) });
  }
  if (acc.has('tie')) neck.push({ k: 'poly', pts: [[-r * 0.1, tt + r * 0.02], [r * 0.1, tt + r * 0.02], [r * 0.16, tt + r * 1.1], [0, tt + r * 1.3], [-r * 0.16, tt + r * 1.1]], fill: cols.accent });
  return { head, neck, top };
}

/**
 * Build the shapes of one character at one instant.
 * st: { dir, expr, mouth:{open, round}, blink, pose:{near, far, lean, head}, breath, headTilt, talking }
 */
export function build(ch, st, env) {
  const m = metrics(ch, env.style);
  const P = (k) => env.color(k);
  const cols = { skin: ch.colors.skin, body: ch.colors.body, hair: ch.colors.hair, legs: ch.colors.legs || P('ink'), accent: ch.colors.accent || P('accent1'), ink: env.style.character?.featureColor ? P(env.style.character.featureColor) : P('ink') };
  const dir = st.dir, near = dir, far = -dir;
  const limbW = (env.style.character?.limbWidth || 58) * (m.H / BASE_HEIGHT);
  const breathe = 1 + (env.style.motion?.breath || 0) * st.breath;
  const items = [];

  // legs (a robe covers them: only the shoes show)
  const lw = m.H * 0.07, lx = m.H * 0.065 * m.W;
  if (ch.body?.shape !== 'robe') {
    items.push({ k: 'rrect', x: -lx - lw / 2, y: -m.legH, w: lw, h: m.legH, r: lw * 0.2, fill: cols.legs });
    items.push({ k: 'rrect', x: lx - lw / 2, y: -m.legH, w: lw, h: m.legH, r: lw * 0.2, fill: cols.legs });
  }
  items.push({ k: 'ellipse', x: -lx - lw * 0.15, y: -lw * 0.18, rx: lw * 0.75, ry: lw * 0.3, fill: cols.legs, noShadow: true });
  items.push({ k: 'ellipse', x: lx + lw * 0.15, y: -lw * 0.18, rx: lw * 0.75, ry: lw * 0.3, fill: cols.legs, noShadow: true });

  // upper body group (breathing scales around the hip)
  const upper = [];
  const hip = -m.legH + 22;
  const headGroup = [];
  const covered = (ch.accessories || []).includes('turban');
  const hair = hairShapes(m, covered ? 'none' : ch.hair?.style || 'short', cols.hair, dir);
  const acc = accessoryShapes(ch, m, st, cols);
  // order: back hair, head, front hair, then the face on top (brows must never hide under a fringe)
  headGroup.push(...hair.back.map((s) => ({ ...s })), headShape(m, ch.head?.shape || 'round', cols.skin), ...hair.front);
  headGroup.push(...faceShapes(ch, m, st, cols.ink, cols.skin), ...acc.head, ...acc.top);

  const arm = (k) => {
    const side = k === near ? st.pose.near : st.pose.far;
    const S = [k * m.topW * 0.44, m.torsoTop + m.H * 0.045];
    const l1 = m.H * 0.17, l2 = m.H * 0.16;
    let E, Hd;
    if (side.target) {
      const T = [side.target[0] * m.headR * dir, m.headCY + side.target[1] * m.headR];
      ({ E, H: Hd } = solveIK(S, T, l1, l2, k > 0 ? -1 : 1));
    } else ({ E, H: Hd } = armFromAngles(S, k, side.sh, side.el, l1, l2));
    const g = [
      { k: 'stroke', pts: [S, E], w: limbW, fill: cols.body },
      { k: 'stroke', pts: [E, Hd], w: limbW * 0.92, fill: cols.body },
      { k: 'circle', x: Hd[0], y: Hd[1], r: m.H * 0.036, fill: cols.skin },
    ];
    if (env.style.character?.jointPins) g.push({ k: 'circle', x: S[0], y: S[1], r: m.H * 0.011, fill: cols.ink, feature: true }, { k: 'circle', x: E[0], y: E[1], r: m.H * 0.011, fill: cols.ink, feature: true });
    return g;
  };
  upper.push(...arm(far));
  upper.push({ k: 'poly', pts: torsoPts(m, ch.body?.shape || 'trapezoid'), fill: cols.body });
  upper.push(...acc.neck);
  const neckY = m.torsoTop + m.headR * 0.1;
  upper.push({ k: 'group', tf: { x: 0, y: neckY, rot: st.headTilt + st.pose.head * dir }, items: headGroup.map((s) => shift(s, 0, -neckY)) });
  upper.push(...arm(near));

  items.push({ k: 'group', tf: { x: 0, y: hip, rot: st.pose.lean * dir, sy: breathe, sx: 1 / Math.sqrt(breathe) }, items: upper.map((s) => shift(s, 0, -hip)) });
  return { items, metrics: m };
}

/** Translate a shape spec (used to re-base shapes into a group's local frame). */
export function shift(s, dx, dy) {
  if (!s) return s;
  const mv = (p) => [p[0] + dx, p[1] + dy];
  switch (s.k) {
    case 'poly': return { ...s, pts: s.pts.map(mv) };
    case 'stroke': return { ...s, pts: s.pts.map(mv) };
    case 'circle': case 'ellipse': case 'ring': return { ...s, x: s.x + dx, y: s.y + dy };
    case 'rrect': return { ...s, x: s.x + dx, y: s.y + dy };
    case 'group': return { ...s, tf: { ...(s.tf || {}), x: (s.tf?.x || 0) + dx, y: (s.tf?.y || 0) + dy } };
    case 'path': return { ...s, cmds: s.cmds.map((c) => c.map((v, i) => (i === 0 ? v : (i % 2 ? v + dx : v + dy)))) };
    default: return s;
  }
}

/** Head circle in character-local coordinates (for framing and face-cut checks). */
export function headBox(ch, style) {
  const m = metrics(ch, style);
  return { cx: 0, cy: m.headCY, r: m.headR * 1.15 };
}

export { circlePts };
