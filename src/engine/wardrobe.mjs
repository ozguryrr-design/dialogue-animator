// Costumes that every body style can wear. A piece is drawn once, in coordinates tied to the body, not in pixels:
//   headwear  origin = middle of the brim line, 1 = head radius, up is negative (or origin 'head' = head centre)
//   face      origin = head centre, 1 = head radius
//   garment   (u, v): u = -1..1 across the torso, v = 0 at the shoulders .. 1 at the hem
// x is drawn facing right and mirrored when the character faces left. Colours are palette roles, hex values,
// or the character's own: body, accent, hair, skin, legs. "fold" is a soft line colour for cloth.
// Each body exports anchors() and places the result of wear() in its own drawing order.
import { arcPts, quadPts, rrectPts } from './shapes.mjs';
import { mix } from './color.mjs';

const R = (x, y, w, h, fill, r = 0, extra = {}) => ({ k: 'rrect', x, y, w, h, r, fill, ...extra });
const C = (x, y, r, fill, extra = {}) => ({ k: 'circle', x, y, r, fill, ...extra });
const E = (x, y, rx, ry, fill, extra = {}) => ({ k: 'ellipse', x, y, rx, ry, fill, ...extra });
const P = (pts, fill, extra = {}) => ({ k: 'poly', pts, fill, ...extra });
const S = (pts, w, fill, extra = {}) => ({ k: 'stroke', pts, w, fill, ...extra });
const NS = { noShadow: true };
const Q = (a, c, b, n = 8) => quadPts(a, c, b, n);
const dome = (rx, h, y0 = 0, n = 20) => arcPts(0, y0, rx, Math.PI, Math.PI * 2, n).map(([x, y]) => [x, y0 + (y - y0) * (h / rx)]);
const band = (y, w = 1.08, h = 0.24, fill = 'light') => R(-w, y, w * 2, h, fill, h / 2);
const wraps = (ys, half, rise, w = 0.05) => ys.map((y) => S(Q([-half, y], [0, y - rise * 0.2], [half, y - rise]), w, 'fold', NS));
const onion = (bot, wide, top, shoulder = 1.3) => {
  const side = (k) => [...Q([k * bot, 0], [k * (wide + 0.32), -shoulder * 0.42], [k * wide, -shoulder]), ...Q([k * wide, -shoulder], [k * wide * 0.74, -top], [0, -top], 10).slice(1)];
  return [...side(-1), ...side(1).reverse().slice(1)];
};

// top = how far the piece rises above its brim, in head radii (used to keep it in the frame)
export const HEADWEAR = {
  turban: { top: 0.95, hidesHair: true, items: [
    P(dome(1.06, 0.83), 'light'),
    ...[[0.22, 1.1, 1.7], [0.5, 1.2, 1.84], [0.78, 1.32, 1.93]].map(([k, a0, a1]) => S(arcPts(0, 0.12, 1 - k * 0.32, Math.PI * a0, Math.PI * a1, 10).map(([x, y]) => [x, y * 0.82]), 0.06, 'fold', NS)),
    R(-1.06, -0.06, 2.12, 0.2, 'light', 0.1), E(0, -0.8, 0.2, 0.1, 'accent'),
  ] },
  // the tall cylindrical turban of a vizier
  kavuk: { top: 1.62, hidesHair: true, items: [
    R(-1.0, -1.56, 2.0, 1.66, 'light', 0.58),
    ...wraps([-0.26, -0.56, -0.86, -1.14], 0.96, 0.3),
    E(0, -1.53, 0.5, 0.13, 'accent', NS), band(-0.16, 1.08, 0.26),
  ] },
  // the wide onion turban of a sultan, with a jewel and a plume (sorguç)
  'sultan-kavuk': { top: 2.5, hidesHair: true, items: [
    P(onion(1.04, 1.34, 1.9, 1.15), 'light'),
    ...[[-0.3, 0.2], [-0.62, 0.24], [-0.96, 0.26], [-1.28, 0.24]].map(([y, r]) => S(Q([-1.24 + (y < -1 ? 0.2 : 0), y + r * 0.2], [0, y - r], [1.24 - (y < -1 ? 0.2 : 0), y - r * 0.6]), 0.05, 'fold', NS)),
    E(0, -1.82, 0.42, 0.14, 'accent', NS), band(-0.16, 1.1, 0.26),
    S(Q([0, -0.9], [0.02, -1.7], [0.3, -2.25]), 0.07, 'accent1', NS),
    E(0.36, -2.3, 0.15, 0.32, 'accent', { rot: 0.45 }), E(0.14, -2.12, 0.1, 0.24, 'accent1', { rot: -0.35, noShadow: true }),
    C(0, -0.86, 0.22, 'accent1'), C(0, -0.86, 0.1, 'accent', NS),
  ] },
  // the janissary's tall felt cap, its sleeve falling behind the head
  bork: { top: 1.8, hidesHair: true, back: [P([[-0.1, -1.7], [-1.0, -0.9], [-1.3, 0.9], [-0.86, 1.0], [-0.5, -0.3]], 'light')], items: [
    P([[-0.92, 0.04], [0.92, 0.04], [0.5, -1.7], [-0.32, -1.8]], 'light'), band(-0.16, 1.0, 0.26, 'accent1'), R(-0.14, -0.84, 0.28, 0.74, 'accent1', 0.08, NS),
  ] },
  fez: { top: 1.1, items: [P([[-0.86, 0.06], [0.86, 0.06], [0.64, -1.08], [-0.64, -1.08]], 'accent'), S([[0, -1.08], [0.58, -0.9], [0.8, -0.3]], 0.05, 'dark', NS), E(0.82, -0.2, 0.08, 0.2, 'dark', NS)] },
  crown: { top: 1.0, items: [
    P([[-0.92, 0.06], [-1.02, -0.86], [-0.5, -0.4], [0, -1.0], [0.5, -0.4], [1.02, -0.86], [0.92, 0.06]], 'accent1'),
    C(-1.0, -0.88, 0.1, 'accent', NS), C(0, -1.0, 0.12, 'accent', NS), C(1.0, -0.88, 0.1, 'accent', NS), R(-0.92, -0.14, 1.84, 0.2, 'accent', 0.04, NS),
  ] },
  tiara: { top: 0.72, items: [P([[-0.9, 0.08], [-0.46, -0.3], [0, -0.72], [0.46, -0.3], [0.9, 0.08], [0.5, -0.06], [0, -0.2], [-0.5, -0.06]], 'accent1'), C(0, -0.42, 0.11, 'accent', NS)] },
  headscarf: { top: 0.28, origin: 'head', hidesHair: true, back: [P([[-1.28, -0.2], [-1.3, 0.9], [-0.9, 1.5], [0.9, 1.5], [1.3, 0.9], [1.28, -0.2]], 'accent')], items: [
    P([...dome(1.22, 1.26, -0.04), [0.92, 0.5], [0.76, 0.1], [0.68, -0.34], [0, -0.66], [-0.68, -0.34], [-0.76, 0.1], [-0.92, 0.5]], 'accent'),
  ] },
  hood: { top: 0.36, origin: 'head', hidesHair: true, back: [P([[-1.3, 0], [-1.36, 1.2], [1.36, 1.2], [1.3, 0]], 'body')], items: [
    P([...dome(1.26, 1.34, -0.02), [0.96, 0.7], [0.72, 0.1], [0.6, -0.42], [0, -0.74], [-0.6, -0.42], [-0.72, 0.1], [-0.96, 0.7]], 'body'),
  ] },
  cap: { top: 0.86, items: [P(dome(1.02, 0.86), 'accent'), R(0.3, -0.12, 1.3, 0.2, 'accent', 0.1), C(0, -0.86, 0.08, 'dark', NS)] },
  'school-cap': { top: 0.82, items: [P(dome(1.02, 0.82), 'accent'), R(-1.06, -0.1, 2.12, 0.14, 'light', 0.05, NS), R(0.3, -0.04, 1.14, 0.17, 'dark', 0.08), C(0, -0.46, 0.14, 'accent1', NS)] },
  'graduation-cap': { top: 0.86, items: [
    P(dome(0.98, 0.5), 'dark'), P([[-1.5, -0.46], [0, -0.86], [1.5, -0.46], [0, -0.08]], 'dark'), S([[0, -0.46], [1.2, -0.3], [1.24, 0.42]], 0.05, 'accent1', NS), E(1.24, 0.52, 0.08, 0.16, 'accent1', NS),
  ] },
  beret: { top: 0.72, items: [E(-0.08, -0.34, 1.2, 0.42, 'accent', { rot: -0.12 }), R(-0.92, -0.04, 1.84, 0.14, 'accent', 0.07), C(0, -0.74, 0.07, 'dark', NS)] },
  'top-hat': { top: 1.8, items: [R(-1.36, -0.12, 2.72, 0.2, 'dark', 0.08), R(-0.8, -1.8, 1.6, 1.74, 'dark', 0.08), R(-0.8, -0.42, 1.6, 0.26, 'accent', 0, NS)] },
  'straw-hat': { top: 0.96, items: [E(0, -0.04, 1.8, 0.28, 'accent1'), P(dome(0.96, 0.96), 'accent1'), R(-0.96, -0.36, 1.92, 0.22, 'accent', 0.04, NS)] },
  'chef-hat': { top: 1.6, items: [C(-0.56, -1.04, 0.56, 'light'), C(0.56, -1.04, 0.56, 'light'), C(0, -1.2, 0.62, 'light'), R(-0.88, -0.8, 1.76, 0.92, 'light', 0.1), S([[-0.34, -0.74], [-0.34, -0.1]], 0.05, 'fold', NS), S([[0.34, -0.74], [0.34, -0.1]], 0.05, 'fold', NS)] },
  'hard-hat': { top: 1.0, items: [P(dome(1.08, 1.0), 'accent1'), R(-1.22, -0.1, 2.44, 0.18, 'accent1', 0.08), R(-0.16, -1.0, 0.32, 0.92, 'light', 0.1, NS)] },
  'police-cap': { top: 0.92, items: [P([[-1.3, -0.62], [-0.9, 0.0], [0.9, 0.0], [1.3, -0.62], [0.5, -0.92], [-0.5, -0.92]], 'dark'), R(-0.96, -0.14, 1.92, 0.2, 'accent', 0, NS), R(0.2, -0.02, 1.12, 0.17, 'dark', 0.08), C(0, -0.42, 0.17, 'accent1', NS)] },
  'nurse-cap': { top: 0.62, items: [P([[-0.86, 0.06], [-0.7, -0.6], [0.7, -0.6], [0.86, 0.06]], 'light'), R(-0.14, -0.42, 0.28, 0.1, 'accent', 0, NS), R(-0.05, -0.51, 0.1, 0.28, 'accent', 0, NS)] },
  'knight-helmet': { top: 1.22, origin: 'head', hidesHair: true, items: [P([...dome(1.14, 1.22, -0.1), [1.14, 0.3], [0.82, -0.3], [-0.82, -0.3], [-1.14, 0.3]], 'light'), R(-0.1, -1.3, 0.2, 1.06, 'dark', 0.04, NS), E(0, -1.4, 0.34, 0.14, 'accent')] },
  'viking-helmet': { top: 1.26, hidesHair: true, items: [S(Q([-0.92, -0.34], [-1.6, -0.5], [-1.42, -1.26]), 0.2, 'light'), S(Q([0.92, -0.34], [1.6, -0.5], [1.42, -1.26]), 0.2, 'light'), P(dome(1.0, 0.96), 'accent1'), band(-0.12, 1.06, 0.22, 'dark')] },
  'pirate-hat': { top: 1.18, hidesHair: true, items: [P([[-1.62, -0.1], [-1.0, -0.94], [0, -1.18], [1.0, -0.94], [1.62, -0.1], [0, 0.12]], 'dark'), C(0, -0.58, 0.18, 'light', NS), R(-0.3, -0.4, 0.6, 0.08, 'light', 0.04, NS)] },
  'witch-hat': { top: 2.2, items: [E(0, -0.04, 1.62, 0.26, 'dark'), P([[-0.9, -0.04], [0.9, -0.04], [0.34, -1.3], [0.9, -2.2], [-0.16, -1.5]], 'dark'), R(-0.9, -0.34, 1.8, 0.24, 'accent', 0, NS)] },
  'cowboy-hat': { top: 1.16, items: [P([...Q([-1.82, -0.46], [-1.0, 0.24], [0, 0.16]), ...Q([0, 0.16], [1.0, 0.24], [1.82, -0.46]).slice(1), [0, -0.14]], 'accent3'), P([[-0.8, -0.04], [-0.72, -1.1], [0, -0.92], [0.72, -1.16], [0.8, -0.04]], 'accent3'), R(-0.8, -0.3, 1.6, 0.2, 'dark', 0, NS)] },
  wreath: { top: 0.5, items: Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (1.06 + i * 0.088); return E(Math.cos(a) * 1.04, 0.1 + Math.sin(a) * 0.52, 0.2, 0.09, 'hill', { rot: a + 1.3 }); }) },
  bandana: { top: 0.86, hidesHair: true, back: [P([[-0.9, -0.2], [-1.5, 0.3], [-1.2, 0.5], [-0.9, 0.24]], 'accent')], items: [P([...dome(1.08, 0.86), [1.08, 0.12], [-1.08, 0.12]], 'accent'), C(-0.4, -0.5, 0.06, 'light', NS), C(0.1, -0.56, 0.06, 'light', NS), C(0.56, -0.4, 0.06, 'light', NS)] },
};

export const FACEWEAR = {
  beard: [P([...arcPts(0, 0.2, 0.82, 0.1, Math.PI - 0.1, 14), ...arcPts(0, 0.32, 0.5, Math.PI - 0.3, 0.3, 10)], 'hair')],
  'long-beard': [P([...arcPts(0, 0.2, 0.82, 0.1, Math.PI * 0.32, 6), [0.3, 1.5], [0, 1.82], [-0.3, 1.5], ...arcPts(0, 0.2, 0.82, Math.PI * 0.68, Math.PI - 0.1, 6), ...arcPts(0, 0.32, 0.5, Math.PI - 0.3, 0.3, 10)], 'hair')],
  goatee: [P([[-0.22, 0.86], [0.22, 0.86], [0.08, 1.22], [-0.08, 1.22]], 'hair')],
  mustache: [E(-0.11, 0.37, 0.15, 0.06, 'hair', { rot: -0.25 }), E(0.11, 0.37, 0.15, 0.06, 'hair', { rot: 0.25 })],
  'curled-mustache': [S(Q([0, 0.38], [-0.34, 0.48], [-0.5, 0.22]), 0.1, 'hair'), S(Q([0, 0.38], [0.34, 0.48], [0.5, 0.22]), 0.1, 'hair')],
  'eye-patch': [C(0.36, 0.02, 0.24, 'dark', NS), S([[-1.0, -0.42], [1.0, 0.3]], 0.05, 'dark', NS)],
};

const buttons = (vs, fill = 'accent1') => vs.map((v) => E(0, v, 0.05, 0.016, fill, NS));
const lapels = (fill = 'body') => [P([[-0.46, 0], [0, 0.42], [0.46, 0], [0.16, 0.0], [0, 0.2], [-0.16, 0.0]], fill)];

export const GARMENTS = {
  // a long robe with an embroidered front, gold bars and a sash
  kaftan: { long: true, items: [
    P([[-0.26, 0], [0.26, 0], [0.42, 1], [-0.42, 1]], 'accent', NS),
    ...[0.08, 0.15, 0.22, 0.29].map((v) => S([[-0.22, v], [0.22, v]], 0.07, 'accent1', NS)),
    P([[-1, 0.36], [1, 0.36], [1, 0.42], [-1, 0.42]], 'accent1'), P([[-0.14, 0.42], [0.14, 0.42], [0.1, 0.62], [-0.1, 0.62]], 'accent1', NS),
    S([[-0.62, 0], [0, 0.13], [0.62, 0]], 0.2, 'light'),
  ] },
  robe: { long: true, items: [S([[-0.6, 0], [0, 0.15], [0.6, 0]], 0.13, 'accent'), P([[-1, 0.38], [1, 0.38], [1, 0.43], [-1, 0.43]], 'accent'), S([[0, 0.16], [0, 1]], 0.05, 'fold', NS)] },
  cloak: { long: true, items: [P([[-1, 0], [-0.1, 0], [-0.3, 1], [-1, 1]], 'accent'), P([[1, 0], [0.1, 0], [0.3, 1], [1, 1]], 'accent'), S([[-0.76, 0], [0, 0.1], [0.76, 0]], 0.2, 'light'), C(0, 0.1, 0.09, 'accent1', NS)] },
  dress: { long: true, items: [P([[-1, 0.34], [1, 0.34], [1, 0.4], [-1, 0.4]], 'accent'), S(Q([-0.42, 0], [0, 0.18], [0.42, 0]), 0.1, 'light', NS), S([[-0.34, 0.5], [-0.46, 1]], 0.04, 'fold', NS), S([[0.34, 0.5], [0.46, 1]], 0.04, 'fold', NS)] },
  uniform: { items: [P([[-0.5, 0], [0, 0.2], [0.5, 0], [0.34, 0.26], [0, 0.34], [-0.34, 0.26]], 'light'), P([[-0.09, 0.2], [0.09, 0.2], [0.14, 0.82], [0, 0.94], [-0.14, 0.82]], 'accent'), R(0.3, 0.46, 0.46, 0.2, 'light', 0.03, NS)] },
  suit: { items: [P([[-0.4, 0], [0.4, 0], [0, 0.62]], 'light', NS), P([[-0.08, 0.04], [0.08, 0.04], [0.11, 0.5], [0, 0.6], [-0.11, 0.5]], 'accent', NS), ...lapels('body'), ...buttons([0.72, 0.86], 'dark')] },
  'lab-coat': { items: [P([[-1, 0], [1, 0], [1, 1], [-1, 1]], 'light'), P([[-0.3, 0], [0.3, 0], [0, 0.42]], 'body', NS), S([[-0.4, 0], [0, 0.46]], 0.05, 'fold', NS), S([[0.4, 0], [0, 0.46]], 0.05, 'fold', NS), S([[0, 0.46], [0, 1]], 0.04, 'fold', NS), R(0.34, 0.64, 0.42, 0.2, 'light', 0.03), R(-0.76, 0.64, 0.42, 0.2, 'light', 0.03)] },
  apron: { items: [P([[-0.44, 0.12], [0.44, 0.12], [0.76, 0.44], [0.76, 1], [-0.76, 1], [-0.76, 0.44]], 'light'), S([[-0.44, 0.12], [-0.3, 0]], 0.06, 'light', NS), S([[0.44, 0.12], [0.3, 0]], 0.06, 'light', NS), R(-0.3, 0.6, 0.6, 0.2, 'fold', 0.03, NS)] },
  armor: { items: [P([[-1, 0], [1, 0], [0.8, 0.62], [0, 0.78], [-0.8, 0.62]], 'light'), S([[0, 0.02], [0, 0.74]], 0.05, 'fold', NS), S(Q([-0.8, 0.26], [0, 0.42], [0.8, 0.26]), 0.05, 'fold', NS), P([[-1, 0.78], [1, 0.78], [1, 1], [-1, 1]], 'dark')] },
  vest: { items: [P([[-1, 0], [-0.2, 0], [-0.14, 1], [-1, 1]], 'accent'), P([[1, 0], [0.2, 0], [0.14, 1], [1, 1]], 'accent')] },
  'overalls': { items: [P([[-0.42, 0.26], [0.42, 0.26], [0.84, 0.62], [0.84, 1], [-0.84, 1], [-0.84, 0.62]], 'accent'), S([[-0.36, 0.26], [-0.46, 0]], 0.08, 'accent', NS), S([[0.36, 0.26], [0.46, 0]], 0.08, 'accent', NS), C(-0.34, 0.3, 0.05, 'accent1', NS), C(0.34, 0.3, 0.05, 'accent1', NS)] },
};

function mapShape(s, f, unit, dir, color) {
  const out = { noShadow: false, ...s, fill: color(s.fill) };
  switch (s.k) {
    case 'poly': return { ...out, pts: s.pts.map(([x, y]) => f(x, y)) };
    case 'stroke': return { ...out, pts: s.pts.map(([x, y]) => f(x, y)), w: s.w * unit };
    case 'circle': case 'ring': { const [x, y] = f(s.x, s.y); return { ...out, x, y, r: s.r * unit, ...(s.w ? { w: s.w * unit } : {}) }; }
    case 'ellipse': { const [x, y] = f(s.x, s.y); return { ...out, x, y, rx: s.rx * unit, ry: s.ry * unit, rot: (s.rot || 0) * dir }; }
    case 'rrect': { const k = 1000; return { ...out, k: 'poly', pts: rrectPts(s.x * k, s.y * k, s.w * k, s.h * k, (s.r || 0) * k).map(([x, y]) => f(x / k, y / k)) }; }
    case 'path': return { ...out, cmds: s.cmds.map((c) => { const r = [c[0]]; for (let i = 1; i < c.length; i += 2) r.push(...f(c[i], c[i + 1])); return r; }) };
    default: return null;
  }
}

const EMPTY = Object.freeze({ back: [], hat: [], face: [], over: [], hidesHair: false });

/** The headwear a character ends up with (costume first, then the older accessories list). */
export function headwearOf(ch) {
  const acc = ch.accessories || [];
  return ch.costume?.head || (acc.includes('turban') ? 'turban' : acc.includes('crown') ? 'crown' : null);
}

/** How far a character's headwear rises above the top of the head, in stage units. */
export function hatRise(ch, a) {
  let top = HEADWEAR[headwearOf(ch)]?.top ?? 0, origin = HEADWEAR[headwearOf(ch)]?.origin === 'head' ? a.cy : a.rim;
  for (const s of ch.costume?.custom?.hat || []) {
    const y = s.pts ? Math.min(...s.pts.map((p) => p[1])) : (s.y ?? 0) - (s.r ?? s.ry ?? 0);
    if (Number.isFinite(y)) { top = Math.max(top, -y); origin = a.rim; }
  }
  return Math.max(0, (origin - top * a.r) * -1 - a.H);
}

/** Shapes of the costume in body coordinates: back (behind the head), hat, face, over (on the torso). */
export function wear(ch, st, a, env) {
  const c = ch.costume || {}, acc = ch.accessories || [];
  const headId = headwearOf(ch), faceId = c.face || (acc.includes('beard') ? 'beard' : null);
  const hat = HEADWEAR[headId], cu = c.custom || {}, garment = GARMENTS[c.body];
  if (!hat && !FACEWEAR[faceId] && !garment && !c.custom) return EMPTY;
  const dir = st.dir;
  const own = { body: ch.colors.body, accent: ch.colors.accent, hair: ch.colors.hair, skin: ch.colors.skin, legs: ch.colors.legs };
  const fold = mix(env.color(env.style.character?.featureColor || 'ink'), env.color('light'), 0.78);
  const color = (f) => (f === 'fold' ? fold : own[f] || f);
  const fromRim = (x, y) => [x * a.r * dir, a.rim + y * a.r];
  const fromHead = (x, y) => [x * a.r * dir, a.cy + y * a.r];
  const fromFace = (x, y) => [(x + a.fx * 0.5) * a.r * dir, a.fy + y * a.r];
  const fromBody = (u, v) => { const hw = (a.shoulderW + (a.hemW - a.shoulderW) * v) / 2; return [u * hw * dir, a.shoulderY + (a.hemY - a.shoulderY) * v]; };
  const place = (list, f, unit) => (list || []).map((s) => mapShape(s, f, unit, dir, color)).filter(Boolean);
  const fh = hat?.origin === 'head' ? fromHead : fromRim;
  return {
    back: [...place(hat?.back, fh, a.r), ...place(cu.back, fromRim, a.r)],
    hat: [...place(hat?.items, fh, a.r), ...place(cu.hat, fromRim, a.r)],
    face: [...place(FACEWEAR[faceId], fromFace, a.r), ...place(cu.face, fromHead, a.r)],
    over: [...place(garment?.items, fromBody, a.shoulderW / 2), ...place(cu.body, fromBody, a.shoulderW / 2)],
    hidesHair: !!hat?.hidesHair || !!c.hidesHair,
  };
}

export const COSTUME_CATALOG = { head: Object.keys(HEADWEAR), face: Object.keys(FACEWEAR), body: Object.keys(GARMENTS) };
