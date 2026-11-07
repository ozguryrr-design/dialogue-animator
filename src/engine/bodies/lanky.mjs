// "lanky-line" body: a tall, thin figure drawn with one ink line — about 4 heads tall, stick limbs,
// rounded-rectangle torso, small dot eyes and big expressive brows. Feet at (0, 0), up is negative y.
import { armFromAngles, solveIK } from '../poses.mjs';
import { arcPts, quadPts } from '../shapes.mjs';

export const BASE_HEIGHT = 900;

export function metrics(ch, style) {
  const H = BASE_HEIGHT * (ch.body?.height || 1);
  const headR = H * (style?.character?.headRatio ?? 0.26) * 0.5 * (ch.head?.size || 1);
  const headCY = -H + headR;
  const torsoTop = headCY + headR + H * 0.03;
  const legH = H * 0.3;
  const tw = { trapezoid: 0.2, rect: 0.18, round: 0.24, pear: 0.22, triangle: 0.21 }[ch.body?.shape || 'trapezoid'] * H * (ch.body?.width || 1);
  return { H, headR, headCY, torsoTop, legH, tw, faceY: headCY, halfW: tw * 0.5 + H * 0.17 };
}

export function build(ch, st, env) {
  const m = metrics(ch, env.style);
  const P = (k) => env.color(k);
  const ink = P('ink'), body = ch.colors.body, hairC = ch.colors.hair;
  const acc = new Set(ch.accessories || []);
  const dir = st.dir, e = st.expr, H = m.H, r = m.headR;
  const items = [];
  const lw = env.style.character?.limbWidth || 10;
  // legs
  for (const k of [-1, 1]) items.push({ k: 'stroke', pts: [[k * m.tw * 0.22, -m.legH], [k * m.tw * 0.26, -H * 0.012], [k * m.tw * 0.26 + dir * H * 0.045, -H * 0.006]], w: lw, fill: ink });
  const arm = (k) => {
    const side = k === dir ? st.pose.near : st.pose.far;
    const S = [k * m.tw * 0.46, m.torsoTop + H * 0.03];
    const l1 = H * 0.15, l2 = H * 0.14;
    let E, Hd;
    if (side.target) ({ E, H: Hd } = solveIK(S, [side.target[0] * r * dir, m.headCY + side.target[1] * r], l1, l2, k > 0 ? -1 : 1));
    else ({ E, H: Hd } = armFromAngles(S, k, side.sh, side.el, l1, l2));
    return [{ k: 'stroke', pts: [S, E, Hd], w: lw, fill: ink }, { k: 'circle', x: Hd[0], y: Hd[1], r: H * 0.014, fill: ink, feature: true }];
  };
  items.push(...arm(-dir));
  const torsoH = -m.legH - m.torsoTop + 10;
  items.push({ k: 'rrect', x: -m.tw / 2, y: m.torsoTop, w: m.tw, h: torsoH, r: m.tw * 0.28, fill: body });
  if (acc.has('scarf')) items.push({ k: 'rrect', x: -m.tw * 0.45, y: m.torsoTop - H * 0.01, w: m.tw * 0.9, h: H * 0.035, r: H * 0.015, fill: ch.colors.accent });
  if (acc.has('tie') || acc.has('bowtie')) items.push({ k: 'poly', pts: [[0, m.torsoTop + 4], [-H * 0.02, m.torsoTop + H * 0.03], [0, m.torsoTop + H * 0.12], [H * 0.02, m.torsoTop + H * 0.03]], fill: ch.colors.accent });
  items.push({ k: 'stroke', pts: [[0, m.torsoTop], [0, m.headCY + r * 0.9]], w: lw, fill: ink });
  // head group (tilts)
  const head = [];
  const style = ch.hair?.style || 'short';
  if (style === 'bun') head.push({ k: 'circle', x: 0, y: m.headCY - r * 1.18, r: r * 0.36, fill: hairC });
  if (style === 'long' || style === 'bob') head.push({ k: 'poly', pts: [...arcPts(0, m.headCY, r * 1.12, Math.PI * 0.95, Math.PI * 2.05, 16), [r * 1.15, m.headCY + r * (style === 'long' ? 1.5 : 0.6)], [-r * 1.15, m.headCY + r * (style === 'long' ? 1.5 : 0.6)]], fill: hairC });
  if (style === 'ponytail') head.push({ k: 'stroke', pts: [[-dir * r * 0.8, m.headCY - r * 0.6], [-dir * r * 1.5, m.headCY - r * 0.2], [-dir * r * 1.4, m.headCY + r * 0.9]], w: lw * 2, fill: ink });
  head.push({ k: 'circle', x: 0, y: m.headCY, r, fill: ch.colors.skin });
  if (style === 'short' || style === 'spiky') for (let j = 0; j < 5; j++) { const x0 = -r * 0.75 + j * r * 0.32; head.push({ k: 'stroke', pts: [[x0, m.headCY - r * 0.82 + Math.abs(j - 2) * r * 0.05], [x0 + r * 0.16, m.headCY - r * (style === 'spiky' ? 1.32 : 1.12)], [x0 + r * 0.32, m.headCY - r * 0.82 + Math.abs(j - 1.5) * r * 0.05]], w: lw * 0.8, fill: ink }); }
  if (style === 'curly') for (let j = 0; j < 7; j++) { const a = Math.PI * (1.05 + j * 0.15); head.push({ k: 'ring', x: Math.cos(a) * r * 1.02, y: m.headCY + Math.sin(a) * r * 1.02, r: r * 0.2, w: lw * 0.8, fill: hairC }); }
  if (style === 'bob') head.push({ k: 'stroke', pts: [[-r * 0.85, m.headCY - r * 0.62], [r * 0.85, m.headCY - r * 0.62]], w: lw, fill: ink });
  // hats sit above the highest brow position (surprised), so expressions stay readable
  if (acc.has('hat') || acc.has('beanie')) head.push({ k: 'poly', pts: [...arcPts(0, m.headCY - r * 0.8, r * 0.92, Math.PI * 1.02, Math.PI * 1.98, 12)], fill: ch.colors.accent });
  const fx = dir * r * 0.18, ey = m.headCY + r * 0.02;
  for (const k of [-1, 1]) {
    const ex = fx + k * r * 0.38;
    if (st.blink > 0.5) head.push({ k: 'stroke', pts: [[ex - r * 0.12, ey], [ex + r * 0.12, ey]], w: lw * 0.8, fill: ink, feature: true });
    else if (e.shape === 'arc' || e.shape === 'closed') head.push({ k: 'stroke', pts: arcPts(ex, ey + r * 0.1, r * 0.16, Math.PI * 1.1, Math.PI * 1.9, 6), w: lw * 0.8, fill: ink, feature: true });
    else head.push({ k: 'circle', x: ex + e.look[0] * dir * r * 0.05, y: ey + e.look[1] * r * 0.05, r: r * 0.085 * e.eye * (1 - e.lid * 0.4) * (ch.eyes?.size || 1), fill: ink, feature: true });
    const by = ey - r * 0.38 - e.brow * r, t = k * e.tilt;
    head.push({ k: 'stroke', pts: [[ex - Math.cos(t) * r * 0.24, by - Math.sin(t) * r * 0.24], [ex + Math.cos(t) * r * 0.24, by + Math.sin(t) * r * 0.24]], w: lw * 1.8 * (ch.brows?.weight || 1), fill: ink, feature: true });
  }
  if (ch.nose !== 'none') head.push({ k: 'stroke', pts: [[fx + dir * r * 0.04, ey + r * 0.08], [fx + dir * r * 0.18, ey + r * 0.3], [fx + dir * r * 0.02, ey + r * 0.34]], w: lw * 0.7, fill: ink, feature: true });
  if (acc.has('glasses')) { for (const k of [-1, 1]) head.push({ k: 'ring', x: fx + k * r * 0.38, y: ey, r: r * 0.22, w: lw * 0.8, fill: ink }); }
  if (acc.has('mustache')) head.push({ k: 'stroke', pts: [[fx - r * 0.2, ey + r * 0.44], [fx, ey + r * 0.38], [fx + r * 0.2, ey + r * 0.44]], w: lw * 1.4, fill: ink, feature: true });
  const mx = fx, my = ey + r * 0.55;
  const open = Math.max(e.open * (st.talking ? 0.4 : 1), st.mouth.open);
  if (open > 0.06) head.push({ k: 'ellipse', x: mx, y: my, rx: r * 0.16 * e.width * (st.mouth.round ? 0.6 : 1), ry: r * (0.04 + 0.16 * open), fill: P('accent2') });
  else head.push({ k: 'stroke', pts: quadPts([mx - r * 0.18 * e.width, my - e.curve * r * 0.03], [mx, my + e.curve * r * 0.14], [mx + r * 0.18 * e.width, my - e.curve * r * 0.03 - e.skew * r * 0.06], 8), w: lw * 0.9, fill: ink, feature: true });
  const neckY = m.torsoTop;
  items.push({ k: 'group', tf: { x: 0, y: neckY, rot: st.headTilt + st.pose.head * dir }, items: head.map((s) => shiftY(s, -neckY)) });
  items.push(...arm(dir));
  return { items, metrics: m };
}

function shiftY(s, dy) {
  const mv = (p) => [p[0], p[1] + dy];
  if (s.pts) return { ...s, pts: s.pts.map(mv) };
  if (s.y !== undefined) return { ...s, y: s.y + dy };
  return s;
}
