// "gummy" body: one soft blob (no neck), nub arms, big outlined eyes. Single candy colour per character
// (skin tones are not used). Feet at (0, 0), up is negative y.
import { armFromAngles, solveIK } from '../poses.mjs';
import { arcPts, quadPts } from '../shapes.mjs';
import { darken } from '../color.mjs';
import { wear } from '../wardrobe.mjs';
import { footOf, placeHeld } from '../motion.mjs';

export const BASE_HEIGHT = 760;

export function metrics(ch, style) {
  const H = BASE_HEIGHT * (ch.body?.height || 1);
  const W = H * 0.46 * (ch.body?.width || 1);
  const headR = H * 0.3;
  return { H, W, headR, headCY: -H + headR, faceY: -H * 0.6, faceR: H * 0.17, halfW: W * 0.5 + H * 0.16, torsoTop: -H * 0.45, legH: 0 };
}

function blobPath(shape, w, h) {
  const k = { trapezoid: [0.58, 0.38], round: [0.7, 0.46], rect: [0.52, 0.5], pear: [0.66, 0.3], triangle: [0.5, 0.52] }[shape] || [0.58, 0.38];
  return [['M', -w / 2, 0], ['C', -w * k[0], -h * 0.55, -w * k[1], -h, 0, -h], ['C', w * k[1], -h, w * k[0], -h * 0.55, w / 2, 0], ['Z']];
}

/** Where a costume attaches on this body (src/engine/wardrobe.mjs). */
export function anchors(m) {
  return { H: m.H, r: m.W * 0.44, cy: -m.H * 0.72, rim: -m.H * 0.84, fy: -m.H * 0.6, fx: 0.1, shoulderY: -m.H * 0.42, shoulderW: m.W * 0.86, hemY: -m.H * 0.03, hemW: m.W * 0.98 };
}

export function build(ch, st, env) {
  const m = metrics(ch, env.style);
  const P = (k) => env.color(k);
  const body = ch.colors.body, ink = P('ink'), white = P('white') || '#FFFFFF';
  const acc = new Set(ch.accessories || []);
  const dir = st.dir, e = st.expr, H = m.H, w = m.W;
  const items = [];
  const limb = H * 0.075;
  const hands = {};
  const arm = (k) => {
    const side = k === dir ? st.pose.near : st.pose.far;
    const S = [k * w * 0.4, -H * 0.4];
    const l1 = H * 0.13, l2 = H * 0.12;
    let E, Hd;
    if (side.at) ({ E, H: Hd } = solveIK(S, [side.at[0] * H * dir, -side.at[1] * H], l1, l2, k > 0 ? -1 : 1));
    else if (side.target) ({ E, H: Hd } = solveIK(S, [side.target[0] * m.headR * dir, m.faceY + side.target[1] * m.headR * 0.8], l1, l2, k > 0 ? -1 : 1));
    else ({ E, H: Hd } = armFromAngles(S, k, side.sh + 0.25, side.el, l1, l2));
    hands[k === dir ? 'near' : 'far'] = Hd;
    return { k: 'stroke', pts: [S, E, Hd], w: limb, fill: body };
  };
  const farArm = arm(-dir), nearArm = arm(dir), held = placeHeld(st.held, hands, dir);
  items.push(...held.behind, farArm);
  // feet
  for (const k of [-1, 1]) { const { dx, lift } = footOf(st.walk, k, H * 0.3, dir); items.push({ k: 'ellipse', x: k * w * 0.22 + dx, y: -H * 0.02 - lift, rx: w * 0.16, ry: H * 0.05, fill: darken(body, 0.25) }); }
  // hair behind
  const hairC = ch.colors.hair;
  const worn = wear(ch, st, { ...anchors(m), fx: 0.1 + 0.14 * (st.turn || 0) }, env);
  const style = worn.hidesHair ? 'none' : ch.hair?.style || 'short';
  items.push(...worn.back);
  if (style === 'long') for (const k of [-1, 1]) items.push({ k: 'stroke', pts: [[k * w * 0.32, -H * 0.92], [k * w * 0.55, -H * 0.55], [k * w * 0.5, -H * 0.3]], w: H * 0.1, fill: hairC });
  if (style === 'ponytail') items.push({ k: 'stroke', pts: [[-dir * w * 0.3, -H * 0.95], [-dir * w * 0.62, -H * 0.86], [-dir * w * 0.66, -H * 0.62]], w: H * 0.09, fill: hairC });
  if (style === 'bun') items.push({ k: 'circle', x: 0, y: -H * 1.04, r: H * 0.1, fill: hairC });
  items.push({ k: 'path', cmds: blobPath(ch.body?.shape, w, H), fill: body, gloss: true });
  items.push(...worn.over);
  // hair on top
  if (style === 'short' || style === 'bob') items.push({ k: 'path', cmds: [['M', -w * 0.36, -H * 0.86], ['Q', 0, -H * 1.1, w * 0.36, -H * 0.86], ['Q', 0, -H * (style === 'bob' ? 0.82 : 0.9), -w * 0.36, -H * 0.86], ['Z']], fill: hairC });
  if (style === 'spiky') for (let i = -1; i <= 1; i++) items.push({ k: 'poly', pts: [[i * w * 0.16 - w * 0.08, -H * 0.97], [i * w * 0.18, -H * 1.14], [i * w * 0.16 + w * 0.08, -H * 0.97]], fill: hairC });
  if (style === 'curly') for (let i = -2; i <= 2; i++) items.push({ k: 'circle', x: i * w * 0.13, y: -H * (0.98 - Math.abs(i) * 0.03), r: H * 0.06, fill: hairC });
  if (acc.has('hat')) { items.push({ k: 'rrect', x: -w * 0.42, y: -H * 1.0, w: w * 0.84, h: H * 0.05, r: H * 0.02, fill: ch.colors.accent }); items.push({ k: 'rrect', x: -w * 0.25, y: -H * 1.17, w: w * 0.5, h: H * 0.19, r: H * 0.05, fill: ch.colors.accent }); }
  if (acc.has('beanie')) items.push({ k: 'path', cmds: [['M', -w * 0.34, -H * 0.9], ['Q', 0, -H * 1.18, w * 0.34, -H * 0.9], ['Z']], fill: ch.colors.accent });
  if (acc.has('scarf')) items.push({ k: 'stroke', pts: [[-w * 0.44, -H * 0.42], [0, -H * 0.38], [w * 0.44, -H * 0.42]], w: H * 0.07, fill: ch.colors.accent });
  if (acc.has('bowtie')) { items.push({ k: 'poly', pts: [[0, -H * 0.36], [-H * 0.07, -H * 0.4], [-H * 0.07, -H * 0.32]], fill: ch.colors.accent }); items.push({ k: 'poly', pts: [[0, -H * 0.36], [H * 0.07, -H * 0.4], [H * 0.07, -H * 0.32]], fill: ch.colors.accent }); }
  items.push(...worn.hat);
  // face
  const fx = dir * w * (0.06 + 0.09 * (st.turn || 0)), ey = -H * 0.66 - e.look[1] * H * 0.01;
  const er = H * 0.055 * (ch.eyes?.size || 1) * e.eye;
  for (const k of [-1, 1]) {
    const ex = fx + k * w * 0.2;
    if (e.shape === 'arc' || e.shape === 'closed') items.push({ k: 'stroke', pts: arcPts(ex, ey + er * 0.5, er * 0.9, Math.PI * 1.15, Math.PI * 1.85, 8), w: H * 0.018, fill: ink, feature: true });
    else {
      const ry = er * 1.2 * (1 - e.lid * 0.5);
      items.push({ k: 'ellipse', x: ex, y: ey, rx: er, ry, fill: white, lineW: H * 0.009 });
      if (st.blink > 0) items.push({ k: 'ellipse', x: ex, y: ey - ry * (1 - st.blink), rx: er * 1.02, ry: ry * st.blink, fill: body, lineW: H * 0.009 });
      else {
        const px = ex + dir * er * 0.22 + e.look[0] * dir * er * 0.25, py = ey + er * 0.12 + e.look[1] * er * 0.3;
        items.push({ k: 'circle', x: px, y: py, r: er * 0.5, fill: ink, feature: true });
        items.push({ k: 'circle', x: px - er * 0.16, y: py - er * 0.2, r: er * 0.16, fill: white, feature: true });
      }
    }
    const by = ey - er * 1.6 - e.brow * H * 0.25, t = k * e.tilt;
    items.push({ k: 'stroke', pts: [[ex - Math.cos(t) * er, by - Math.sin(t) * er], [ex + Math.cos(t) * er, by + Math.sin(t) * er]], w: H * 0.02 * (ch.brows?.weight || 1), fill: ink, feature: true });
  }
  if (acc.has('glasses')) { for (const k of [-1, 1]) items.push({ k: 'ring', x: fx + k * w * 0.2, y: ey, r: er * 1.55, w: H * 0.014, fill: ink, feature: true }); }
  if (acc.has('freckles')) for (const k of [-1, 1]) for (let i = 0; i < 3; i++) items.push({ k: 'circle', x: fx + k * w * (0.24 + i * 0.05), y: -H * 0.56 + (i % 2) * H * 0.015, r: H * 0.006, fill: darken(body, 0.35), feature: true });
  if (acc.has('blush')) for (const k of [-1, 1]) items.push({ k: 'ellipse', x: fx + k * w * 0.3, y: -H * 0.56, rx: w * 0.07, ry: H * 0.02, fill: P('accent3'), feature: true, alpha: 0.6 });
  // mouth
  const mx = fx + e.skew * w * 0.03, my = -H * 0.5;
  const open = Math.max(e.open * (st.talking ? 0.4 : 1), st.mouth.open);
  if (open > 0.06) {
    const rx = w * 0.1 * e.width * (st.mouth.round ? 0.62 : 1), ry = H * (0.015 + 0.05 * open);
    items.push({ k: 'ellipse', x: mx, y: my, rx, ry, fill: ink, feature: true });
    if (open > 0.35) items.push({ k: 'ellipse', x: mx, y: my + ry * 0.5, rx: rx * 0.6, ry: ry * 0.4, fill: P('accent3'), feature: true });
  } else items.push({ k: 'stroke', pts: quadPts([mx - w * 0.09 * e.width, my - e.curve * H * 0.01], [mx, my + e.curve * H * 0.035], [mx + w * 0.09 * e.width, my - e.curve * H * 0.01 - e.skew * H * 0.015], 10), w: H * 0.016, fill: ink, feature: true });
  if (acc.has('mustache')) for (const k of [-1, 1]) items.push({ k: 'ellipse', x: mx + k * w * 0.05, y: my - H * 0.03, rx: w * 0.06, ry: H * 0.014, fill: hairC });
  items.push(...worn.face);
  items.push(...held.front, nearArm);
  return { items, metrics: m };
}
