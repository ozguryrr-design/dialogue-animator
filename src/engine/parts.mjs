// Set pieces for the places a story can happen in: palace, school, nature, town, hospital, home.
// Same contract as props.mjs: origin = bottom centre, up is negative y, colours are palette roles, so every
// part follows the style pack. Each returns { items, w, h }. Options are in docs/DESIGN.md (`da design --catalog`).
import { arcPts, quadPts, circlePts } from './shapes.mjs';

const R = (x, y, w, h, fill, r = 0, extra = {}) => ({ k: 'rrect', x, y, w, h, r, fill, ...extra });
const C = (x, y, r, fill, extra = {}) => ({ k: 'circle', x, y, r, fill, ...extra });
const E = (x, y, rx, ry, fill, extra = {}) => ({ k: 'ellipse', x, y, rx, ry, fill, ...extra });
const P = (pts, fill, extra = {}) => ({ k: 'poly', pts, fill, ...extra });
const S = (pts, w, fill, extra = {}) => ({ k: 'stroke', pts, w, fill, ...extra });
const NS = { noShadow: true };
const Q = (a, c, b, n = 8) => quadPts(a, c, b, n).slice(1);

function pointedArch(w, h, y0 = 0) {
  const sh = y0 - h * 0.66, top = y0 - h;
  return [[-w / 2, y0], [-w / 2, sh], ...Q([-w / 2, sh], [-w / 2, top + h * 0.08], [0, top]), ...Q([0, top], [w / 2, top + h * 0.08], [w / 2, sh]), [w / 2, y0]];
}
const star = (x, y, r, n = 8, inner = 0.5) => Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, q = i % 2 ? r * inner : r; return [x + Math.cos(a) * q, y + Math.sin(a) * q]; });
const span = (o, d) => o.w || d;
const scribble = (x, y, w, seed) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push([x + (w * i) / 8, y + (((seed * 7 + i * 13) % 5) - 2) * 7]); return pts; };

export const PARTS = {
  // ------------ things people carry ------------
  cauldron: () => ({ w: 330, h: 250, items: [S([[-150, -196], [-172, -232], [-132, -232]], 12, 'dark'), S([[150, -196], [172, -232], [132, -232]], 12, 'dark'), E(0, -108, 150, 108, 'accent1'), E(-58, -108, 22, 62, 'light', { alpha: 0.3, ...NS }), R(-160, -206, 320, 26, 'dark', 12)] }),
  pot: () => ({ w: 200, h: 150, items: [S([[-92, -96], [-128, -104]], 14, 'dark'), S([[92, -96], [128, -104]], 14, 'dark'), R(-90, -118, 180, 118, 'accent1', 22), E(-40, -66, 12, 30, 'light', { alpha: 0.3, ...NS }), R(-100, -132, 200, 22, 'dark', 10), C(0, -146, 12, 'dark')] }),
  sack: () => ({ w: 260, h: 320, items: [E(0, -130, 130, 130, 'wall3'), P([[-40, -250], [40, -250], [66, -320], [-66, -320]], 'wall3'), R(-46, -262, 92, 16, 'dark', 8, NS)] }),
  box: () => ({ w: 300, h: 220, items: [R(-150, -200, 300, 200, 'accent3', 8), R(-160, -220, 320, 44, 'dark', 8), R(-22, -220, 44, 90, 'accent1', 4, NS)] }),
  basket: () => ({ w: 300, h: 290, items: [S(arcPts(0, -150, 124, Math.PI, Math.PI * 2, 14), 18, 'accent1'), P([[-150, -160], [150, -160], [112, 0], [-112, 0]], 'accent1'), S([[-140, -110], [140, -110]], 8, 'dark', NS), S([[-125, -60], [125, -60]], 8, 'dark', NS)] }),
  sword: () => ({ w: 90, h: 620, items: [P([[-16, -130], [16, -130], [12, -580], [0, -620], [-12, -580]], 'light'), R(-58, -146, 116, 24, 'accent1', 8), R(-12, -122, 24, 110, 'dark', 6), C(0, -8, 20, 'accent1')] }),
  letter: () => ({ w: 240, h: 170, items: [R(-120, -170, 240, 170, 'light', 6), P([[-120, -170], [120, -170], [0, -72]], 'wall3', NS), C(0, -82, 22, 'accent3', NS)] }),
  key: () => ({ w: 70, h: 210, items: [S([[0, -140], [0, -14]], 16, 'accent1'), S([[0, -24], [28, -24]], 14, 'accent1'), S([[0, -56], [22, -56]], 14, 'accent1'), { k: 'ring', x: 0, y: -176, r: 30, w: 16, fill: 'accent1' }] }),
  bag: () => ({ w: 280, h: 300, items: [S(arcPts(0, -170, 84, Math.PI, Math.PI * 2, 12), 16, 'dark'), R(-130, -190, 260, 190, 'accent3', 22), R(-130, -130, 260, 16, 'dark', 0, NS), R(-26, -148, 52, 42, 'accent1', 8, NS)] }),
  // ------------ palace ------------
  'tile-band': (o = {}) => {
    const w = span(o, 2400), h = o.h || 150, n = Math.round(w / h), step = w / n, cy = -h / 2;
    const items = [R(-w / 2, -h, w, h, o.base || 'light', 0), R(-w / 2, -h, w, 12, 'accent3', 0, NS), R(-w / 2, -12, w, 12, 'accent3', 0, NS)];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * step, r = h * 0.34;
      items.push(P([[x, cy - r], [x + r, cy], [x, cy + r], [x - r, cy]], 'accent2', NS));
      for (const [dx, dy] of [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) items.push(C(x + dx * r, cy + dy * r, r * 0.22, 'accent1', NS));
      items.push(C(x, cy, r * 0.24, 'accent3', NS));
    }
    return { w, h, items };
  },
  'lattice-window': (o = {}) => {
    const w = o.w || 300, h = o.h || 620, iw = w * 0.76, ih = h * 0.9, bot = -h * 0.04, frame = o.frame || 'accent1', glass = o.glass || 'dark';
    const items = [P(pointedArch(w, h), frame), P(pointedArch(iw, ih, bot), glass, NS)];
    const top = bot - ih * 0.6, step = iw / 5;
    for (let x = -iw / 2 + step; x < iw / 2 - 1; x += step) items.push(S([[x, bot], [x, top]], 7, frame, NS));
    for (let y = bot - step; y > top; y -= step) items.push(S([[-iw / 2, y], [iw / 2, y]], 7, frame, NS));
    items.push(S([[-iw / 2, top], [iw / 2, top]], 10, frame, NS));
    if (o.moon) items.push(C(0, -h * 0.76, w * 0.1, 'light', NS), C(w * 0.05, -h * 0.77, w * 0.085, glass, NS));
    else items.push(P(star(0, -h * 0.76, w * 0.1), frame, NS));
    items.push(R(-w / 2 - 18, -18, w + 36, 26, frame, 6));
    return { w, h, items };
  },
  arcade: (o = {}) => {
    const w = span(o, 2400), h = o.h || 240, n = Math.max(2, Math.round(w / (h * 1.25))), step = w / n, items = [R(-w / 2, -h, w, h, o.base || 'accent1', 0)];
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * step; items.push(P(pointedArch(step * 0.76, h * 0.8).map(([px, py]) => [x + px, py]), o.fill || 'accent3', NS), C(x, -h * 0.9, h * 0.05, 'light', NS)); }
    return { w, h, items };
  },
  drape: (o = {}) => {
    const w = o.w || 240, h = o.h || 1300, f = o.fill || 'accent3', items = [];
    for (let i = 0; i < 5; i++) {
      const x0 = -w / 2 + (i * w) / 5, x1 = x0 + w / 5, g = 0.45;
      items.push(P([[x0, -h], [x1, -h], [x1 * g + w * 0.14 * g, -h * 0.42], [x1 * 0.8, 0], [x0 * 0.8, 0], [x0 * g + w * 0.14 * g, -h * 0.42]], i % 2 ? 'accent1' : f, { noShadow: i % 2 === 1 }));
    }
    items.push(R(-w * 0.34, -h * 0.46, w * 0.68, 34, 'accent1', 14), R(-w / 2 - 20, -h - 18, w + 40, 36, 'accent1', 10));
    return { w, h, items };
  },
  carpet: (o = {}) => {
    const w = span(o, 1400), t = 14, b = o.h || 250;
    const trap = (m, y0, y1) => [[-w / 2 + 70 + m, y0], [w / 2 - 70 - m, y0], [w / 2 - m, y1], [-w / 2 + m, y1]];
    const items = [P(trap(0, t, b), 'accent3', NS), P(trap(34, t + 18, b - 18), 'accent1', NS), P(trap(52, t + 30, b - 30), 'accent2', NS)];
    for (let x = -w / 2 + 200; x < w / 2 - 150; x += 240) items.push(P([[x, t + 44], [x + 76, (t + b) / 2], [x, b - 44], [x - 76, (t + b) / 2]], 'accent1', NS), C(x, (t + b) / 2, 18, 'accent3', NS));
    return { w, h: b, items };
  },
  column: (o = {}) => {
    const h = o.h || 1400, w = o.w || 92, f = o.fill || 'light';
    return { w: w + 70, h, items: [R(-w / 2, -h + 60, w, h - 110, f, 8), R(-w / 2 - 30, -h, w + 60, 70, 'accent1', 8), P([[-w / 2 - 14, -h + 70], [w / 2 + 14, -h + 70], [w / 2, -h + 130], [-w / 2, -h + 130]], 'accent1', NS), R(-w / 2 - 34, -56, w + 68, 56, 'accent1', 8), S([[-w / 5, -h + 150], [-w / 5, -70]], 5, 'fold', NS), S([[w / 5, -h + 150], [w / 5, -70]], 5, 'fold', NS)] };
  },
  niche: (o = {}) => {
    const w = o.w || 420, h = o.h || 700, items = [P(pointedArch(w, h), 'accent1'), P(pointedArch(w * 0.8, h * 0.9, -h * 0.03), o.fill || 'accent3', NS)];
    for (let r = 0; r < 3; r++) { const n = 5 - r, yy = -h * (0.62 + r * 0.09), ww = w * (0.72 - r * 0.17); for (let i = 0; i < n; i++) { const x = -ww / 2 + (i + 0.5) * (ww / n); items.push(P([[x - (ww / n) * 0.45, yy], [x + (ww / n) * 0.45, yy], [x, yy + h * 0.1]], r % 2 ? 'accent2' : 'light', NS)); } }
    return { w, h, items };
  },
  calligraphy: (o = {}) => {
    const w = o.w || 460, h = o.h || 300, cx = 0, y = -h / 2;
    return { w, h, items: [R(-w / 2, -h, w, h, 'accent1', 8), R(-w / 2 + 18, -h + 18, w - 36, h - 36, 'light', 4, NS),
      S([[-w * 0.33, y + 40], ...Q([-w * 0.33, y + 40], [-w * 0.1, y - 90], [w * 0.05, y + 18])], 13, 'dark', NS), S([[-w * 0.12, y + 62], ...Q([-w * 0.12, y + 62], [w * 0.18, y + 90], [w * 0.34, y - 52])], 13, 'dark', NS),
      S([[cx - 8, y - 96], [cx + 6, y + 40]], 12, 'dark', NS), S([[w * 0.18, y - 86], [w * 0.2, y + 22]], 12, 'dark', NS), C(-w * 0.28, y - 60, 9, 'accent3', NS), C(w * 0.32, y + 64, 9, 'accent3', NS)] };
  },
  brazier: () => ({ w: 300, h: 380, items: [
    C(0, -320, 90, 'accent1', { noShadow: true, alpha: 0.18 }), P([[-120, -270], [120, -270], [84, -160], [-84, -160]], 'accent1'), R(-136, -286, 272, 26, 'dark', 8),
    C(-44, -298, 26, 'accent3', NS), C(10, -304, 30, 'accent3', NS), C(56, -296, 22, 'accent3', NS), S([[-70, -160], [-114, 0]], 16, 'dark'), S([[70, -160], [114, 0]], 16, 'dark'), S([[0, -160], [0, 0]], 16, 'dark'),
  ] }),
  ewer: () => ({ w: 200, h: 320, items: [S([[56, -190], [108, -262]], 22, 'accent1'), S(arcPts(-80, -170, 56, Math.PI * 0.5, Math.PI * 1.5, 10), 14, 'accent1'), E(0, -120, 80, 106, 'accent1'), R(-34, -290, 68, 76, 'accent1', 12), E(0, -296, 42, 12, 'dark'), R(-58, -16, 116, 16, 'dark', 4), R(-52, -140, 104, 14, 'accent3', 3, NS)] }),
  tray: (o = {}) => { const w = o.w || 420; return { w, h: 300, items: [E(0, -294, w / 2, 36, 'accent1'), E(0, -296, w / 2 - 26, 24, 'accent3', NS), S([[-w * 0.3, -280], [-w * 0.2, 0]], 14, 'dark'), S([[w * 0.3, -280], [w * 0.2, 0]], 14, 'dark'), S([[0, -280], [0, 0]], 14, 'dark')] }; },
  cushion: () => ({ w: 320, h: 170, items: [R(-160, -170, 320, 170, 'accent3', 56), R(-108, -128, 216, 86, 'accent1', 30, NS), ...[-160, 160].map((x) => C(x, -86, 20, 'accent1'))] }),
  throne: () => ({ w: 640, h: 1160, items: [P(pointedArch(560, 1160), 'accent1'), P(pointedArch(430, 980, -60), 'accent3', NS), R(-280, -470, 560, 120, 'accent1', 30), R(-300, -360, 600, 360, 'accent2', 24), R(-240, -310, 480, 120, 'accent3', 34, NS), P(star(0, -880, 64), 'light', NS)] }),
  banner: (o = {}) => { const h = o.h || 620, w = o.w || 240; return { w, h, items: [S([[-w / 2 - 30, -h], [w / 2 + 30, -h]], 18, 'dark'), P([[-w / 2, -h + 8], [w / 2, -h + 8], [w / 2, -h * 0.2], [0, 0], [-w / 2, -h * 0.2]], o.fill || 'accent3'), P(star(0, -h * 0.62, w * 0.2), 'accent1', NS)] }; },
  chandelier: () => ({ w: 460, h: 560, items: [S([[0, -560], [0, -240]], 7, 'dark'), E(0, -180, 200, 30, 'accent1'), S([[-170, -180], [-170, -96]], 6, 'dark'), S([[0, -180], [0, -60]], 6, 'dark'), S([[170, -180], [170, -96]], 6, 'dark'), ...[[-170, -66], [0, -30], [170, -66]].flatMap(([x, y]) => [C(x, y, 62, 'accent1', { noShadow: true, alpha: 0.2 }), P([[x - 26, y - 34], [x + 26, y - 34], [x + 16, y + 30], [x - 16, y + 30]], 'accent1'), C(x, y, 11, 'light', NS)])] }),
  // ------------ school ------------
  blackboard: (o = {}) => {
    const w = span(o, 1000), h = o.h || 520, f = o.fill || 'dark', chalk = 'light';
    return { w, h, items: [R(-w / 2 - 26, -h - 26, w + 52, h + 52, 'accent3', 10), R(-w / 2, -h, w, h, f, 4, NS),
      S(scribble(-w * 0.4, -h * 0.82, w * 0.34, 1), 8, chalk, NS), S(scribble(-w * 0.4, -h * 0.66, w * 0.26, 2), 8, chalk, NS), S(scribble(-w * 0.4, -h * 0.5, w * 0.3, 3), 8, chalk, NS),
      S([[w * 0.06, -h * 0.26], [w * 0.2, -h * 0.76], [w * 0.36, -h * 0.26], [w * 0.06, -h * 0.26]], 8, chalk, NS), S([[w * 0.2, -h * 0.76], [w * 0.2, -h * 0.26]], 6, chalk, NS),
      R(-w / 2 - 40, 26, w + 80, 22, 'accent3', 6), R(w * 0.3, 14, 70, 14, chalk, 4, NS), R(w * 0.2, 16, 46, 12, 'accent1', 4, NS)] };
  },
  'school-desk': () => ({ w: 460, h: 430, items: [R(-210, -340, 420, 30, 'accent3', 8), R(-190, -310, 380, 96, 'light', 6), S([[-180, -214], [-190, 0]], 18, 'dark'), S([[180, -214], [190, 0]], 18, 'dark'), R(-150, -372, 190, 32, 'accent2', 6), R(-140, -392, 150, 20, 'accent1', 5), R(70, -366, 90, 26, 'light', 4)] }),
  'teacher-desk': () => ({ w: 640, h: 420, items: [R(-320, -340, 640, 36, 'accent3', 8), R(-300, -304, 600, 304, 'accent3', 6), R(-260, -270, 220, 96, 'light', 6, NS), R(40, -270, 220, 96, 'light', 6, NS), C(-150, -222, 9, 'dark', NS), C(150, -222, 9, 'dark', NS), R(-220, -380, 170, 40, 'accent2', 6), R(-210, -414, 130, 34, 'accent1', 5), C(180, -392, 50, 'accent2'), S([[180, -340], [180, -350]], 12, 'dark')] }),
  'wall-map': (o = {}) => { const w = o.w || 520, h = o.h || 340; return { w, h, items: [R(-w / 2, -h, w, h, 'accent3', 4), R(-w / 2 + 16, -h + 16, w - 32, h - 32, 'glass', 2, NS), P([[-w * 0.36, -h * 0.72], [-w * 0.12, -h * 0.82], [-w * 0.02, -h * 0.58], [-w * 0.2, -h * 0.38], [-w * 0.32, -h * 0.5]], 'accent1', NS), P([[w * 0.06, -h * 0.74], [w * 0.36, -h * 0.8], [w * 0.4, -h * 0.5], [w * 0.2, -h * 0.26], [w * 0.1, -h * 0.46]], 'accent2', NS), S([[-w / 2 - 14, -h - 8], [w / 2 + 14, -h - 8]], 18, 'dark')] }; },
  globe: () => ({ w: 240, h: 330, items: [S(arcPts(0, -190, 118, Math.PI * 0.6, Math.PI * 1.75, 16), 12, 'dark'), C(0, -190, 100, 'glass'), P([[-60, -240], [-10, -262], [20, -216], [-20, -170], [-58, -194]], 'accent1', NS), P([[30, -150], [76, -176], [62, -128]], 'accent2', NS), R(-10, -90, 20, 60, 'dark', 4), R(-80, -30, 160, 30, 'dark', 8)] }),
  lockers: (o = {}) => { const n = o.n || 4, u = 190, w = n * u, h = o.h || 1020, items = []; for (let i = 0; i < n; i++) { const x = -w / 2 + i * u; items.push(R(x + 6, -h, u - 12, h, i % 2 ? 'accent2' : 'accent3', 6), R(x + 54, -h + 56, u - 108, 60, 'light', 4, NS), ...[0, 1, 2].map((k) => R(x + 44, -h + 150 + k * 22, u - 88, 8, 'dark', 3, NS)), C(x + u - 38, -h * 0.5, 9, 'light', NS)); } return { w, h, items }; },
  poster: (o = {}) => { const w = o.w || 240, h = o.h || 320, f = o.fill || 'accent2'; return { w, h, items: [R(-w / 2, -h, w, h, 'light', 4), R(-w / 2 + 18, -h + 18, w - 36, h * 0.52, f, 3, NS), C(0, -h * 0.72, w * 0.16, 'accent1', NS), R(-w * 0.32, -h * 0.34, w * 0.64, 14, 'dark', 6, NS), R(-w * 0.32, -h * 0.24, w * 0.46, 14, 'dark', 6, NS), R(-w * 0.32, -h * 0.14, w * 0.56, 14, 'dark', 6, NS)] }; },
  backpack: () => ({ w: 240, h: 330, items: [S(arcPts(0, -300, 54, Math.PI, Math.PI * 2, 10), 14, 'dark'), R(-120, -310, 240, 310, 'accent3', 60), R(-90, -170, 180, 130, 'accent1', 26), R(-70, -240, 140, 16, 'dark', 8, NS)] }),
  'book-stack': () => ({ w: 300, h: 150, items: [R(-150, -50, 300, 50, 'accent3', 6), R(-130, -98, 260, 48, 'accent2', 6), R(-142, -148, 250, 50, 'accent1', 6)] }),
  'school-building': (o = {}) => {
    const w = span(o, 1500), h = o.h || 900, items = [R(-w / 2, -h, w, h, o.fill || 'wall2', 4)], cols = Math.round(w / 240);
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) { const x = -w / 2 + (c + 0.5) * (w / cols); if (r === 1 && Math.abs(x) < 170) continue; items.push(R(x - 70, -h + 110 + r * 340, 140, 200, 'glass', 4, NS), S([[x, -h + 110 + r * 340], [x, -h + 310 + r * 340]], 6, 'dark', NS)); }
    items.push(R(-160, -300, 320, 300, 'accent3', 6), S([[0, -300], [0, 0]], 8, 'dark', NS), R(-220, -340, 440, 40, 'dark', 6), R(-w / 2 - 24, -h - 26, w + 48, 36, 'dark', 4), P([[-260, -h - 26], [0, -h - 240], [260, -h - 26]], 'accent3'), C(0, -h - 96, 62, 'light', NS), S([[0, -h - 96], [0, -h - 140]], 7, 'dark', NS), S([[0, -h - 96], [30, -h - 84]], 7, 'dark', NS));
    return { w, h: h + 240, items };
  },
  flagpole: (o = {}) => { const f = o.fill || 'accent3'; return { w: 300, h: 1300, items: [S([[0, -1300], [0, 0]], 14, 'dark'), C(0, -1310, 16, 'accent1'), P([[8, -1280], [270, -1250], [8, -1100]], f), R(-70, -22, 140, 22, 'dark', 4)] }; },
  'basket-hoop': () => ({ w: 340, h: 1120, items: [S([[0, -1000], [0, 0]], 20, 'dark'), R(-140, -1120, 280, 190, 'light', 8), R(-60, -1060, 120, 90, 'accent3', 2, NS), S([[-60, -930], [60, -930]], 12, 'accent3', NS), S([[-54, -926], [-34, -850]], 4, 'dark', NS), S([[54, -926], [34, -850]], 4, 'dark', NS), S([[0, -926], [0, -850]], 4, 'dark', NS)] }),
  // ------------ nature ------------
  pine: (o = {}) => { const f = o.fill || 'hill'; return { w: 420, h: 1100, items: [R(-26, -260, 52, 260, 'dark', 8), P([[-210, -220], [210, -220], [0, -620]], f), P([[-170, -470], [170, -470], [0, -840]], o.fill2 || 'ground'), P([[-120, -710], [120, -710], [0, -1100]], f)] }; },
  cypress: () => ({ w: 200, h: 1180, items: [R(-16, -130, 32, 130, 'dark', 6), P([...Q([0, -1180], [120, -640], [60, -110]), [-60, -110], ...Q([-60, -110], [-120, -640], [0, -1180])], 'ground')] }),
  mountain: (o = {}) => { const w = span(o, 1700), h = o.h || 1040, f = o.fill || 'hill'; return { w, h, items: [P([[-w / 2, 0], [-w * 0.18, -h], [w * 0.12, -h * 0.46], [w * 0.28, -h * 0.72], [w / 2, 0]], f), P([[-w * 0.3, -h * 0.62], [-w * 0.18, -h], [-w * 0.05, -h * 0.72], [-w * 0.15, -h * 0.68], [-w * 0.22, -h * 0.58]], 'light', NS), P([[w * 0.2, -h * 0.56], [w * 0.28, -h * 0.72], [w * 0.36, -h * 0.5], [w * 0.28, -h * 0.54]], 'light', NS)] }; },
  rock: () => ({ w: 340, h: 200, items: [P([[-170, 0], [-130, -120], [-40, -200], [90, -160], [170, 0]], 'wall2'), S([[-40, -200], [-10, -90], [50, -40]], 6, 'dark', NS)] }),
  grass: (o = {}) => { const w = span(o, 500), items = []; for (let x = -w / 2; x < w / 2; x += 42) items.push(P([[x - 14, 0], [x + ((x * 7) % 18) - 6, -74 - Math.abs(x * 3) % 40], [x + 14, 0]], Math.abs(x) % 84 < 42 ? 'hill' : 'ground', NS)); return { w, h: 120, items }; },
  flowers: (o = {}) => { const w = span(o, 500), items = []; for (let x = -w / 2 + 30; x < w / 2; x += 74) { const y = -60 - Math.abs(x * 5) % 56; items.push(S([[x, 0], [x, y]], 6, 'ground', NS)); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; items.push(C(x + Math.cos(a) * 15, y + Math.sin(a) * 15, 11, Math.abs(x) % 148 < 74 ? 'accent3' : 'accent1', NS)); } items.push(C(x, y, 8, 'light', NS)); } return { w, h: 130, items }; },
  fence: (o = {}) => { const w = span(o, 1200), items = [R(-w / 2, -210, w, 22, 'accent3', 4), R(-w / 2, -110, w, 22, 'accent3', 4)]; for (let x = -w / 2 + 30; x < w / 2; x += 110) items.push(P([[x - 22, 0], [x - 22, -260], [x, -296], [x + 22, -260], [x + 22, 0]], 'light')); return { w, h: 296, items }; },
  sea: (o = {}) => { const w = span(o, 5000), h = o.h || 300, items = [R(-w / 2, -h, w, h, o.fill || 'accent2', 0, NS)]; for (let r = 0; r < 3; r++) for (let x = -w / 2 + (r % 2) * 80; x < w / 2; x += 170) items.push(S(arcPts(x, -h + 70 + r * 80, 58, Math.PI * 1.2, Math.PI * 1.8, 8), 6, 'light', NS)); return { w, h, items }; },
  palm: () => ({ w: 640, h: 1020, items: [S(Q([-40, 0], [-70, -480], [40, -880], 12), 44, 'accent3'), ...[[-1, -0.1], [-1, 0.5], [1, -0.1], [1, 0.5], [0.3, -0.8], [-0.4, -0.8]].map(([k, u]) => P([[40, -880], ...Q([40, -880], [40 + k * 200, -1000 + u * 180], [40 + k * 320, -760 + u * 280], 8), ...Q([40 + k * 320, -760 + u * 280], [40 + k * 160, -850 + u * 180], [40, -860], 8)], 'hill')), C(14, -860, 22, 'accent3'), C(62, -852, 22, 'accent3')] }),
  'beach-umbrella': () => ({ w: 620, h: 830, items: [S([[-40, 0], [40, -780]], 16, 'dark'), P([...arcPts(44, -640, 310, Math.PI * 1.05, Math.PI * 1.95, 20)], 'accent3'), ...[0.3, 0.5, 0.7].map((u) => S([[44, -950], [44 + (u - 0.5) * 600, -650]], 8, 'light', NS))] }),
  boat: () => ({ w: 500, h: 620, items: [S([[10, -620], [10, -96]], 14, 'dark'), P([[24, -600], [220, -160], [24, -160]], 'light'), P([[-250, -96], [250, -96], [170, 0], [-170, 0]], 'accent3'), R(-250, -112, 500, 20, 'light', 6)] }),
  gull: () => ({ w: 180, h: 70, items: [S([...Q([-90, -40], [-44, -86], [0, -36]), ...Q([0, -36], [44, -86], [90, -40])], 8, 'dark', NS)] }),
  dune: (o = {}) => { const w = span(o, 2400), h = o.h || 420, f = o.fill || 'accent1'; return { w, h, items: [P([[-w / 2, 0], ...Q([-w / 2, 0], [-w * 0.2, -h * 1.5], [w * 0.1, -h * 0.5], 14), ...Q([w * 0.1, -h * 0.5], [w * 0.3, -h * 1.2], [w / 2, 0], 10)], f, NS)] }; },
  cactus: () => ({ w: 340, h: 640, items: [S([[0, 0], [0, -620]], 84, 'ground'), S([[0, -300], [-120, -300], [-120, -470]], 54, 'ground'), S([[0, -220], [120, -220], [120, -420]], 54, 'ground')] }),
  tent: (o = {}) => { const w = span(o, 720), f = o.fill || 'accent3'; return { w, h: 560, items: [P([[-w / 2, 0], [0, -560], [w / 2, 0]], f), P([[-w * 0.15, 0], [0, -330], [w * 0.15, 0]], 'dark', NS), S([[0, -560], [0, -640]], 10, 'dark'), P([[0, -640], [76, -610], [0, -580]], 'accent1')] }; },
  campfire: () => ({ w: 300, h: 300, items: [C(0, -120, 150, 'accent1', { noShadow: true, alpha: 0.2 }), P([[-90, -30], [0, -290], [90, -30]], 'accent3'), P([[-46, -30], [10, -190], [50, -30]], 'accent1', NS), S([[-130, -12], [130, -40]], 26, 'dark'), S([[-130, -40], [130, -12]], 26, 'dark')] }),
  well: () => ({ w: 420, h: 640, items: [S([[-160, -340], [-160, -640]], 18, 'dark'), S([[160, -340], [160, -640]], 18, 'dark'), P([[-210, -600], [0, -700], [210, -600]], 'accent3'), S([[0, -600], [0, -330]], 6, 'dark', NS), R(-36, -380, 72, 62, 'accent1', 6), R(-180, -340, 360, 340, 'wall2', 12), ...[0, 1, 2, 3].map((r) => S([[-180, -280 + r * 80], [180, -280 + r * 80]], 5, 'fold', NS))] }),
  house: (o = {}) => { const w = span(o, 640), h = o.h || 460, f = o.fill || 'wall3'; return { w, h: h + 330, items: [R(-w / 2, -h, w, h, f, 4), P([[-w / 2 - 50, -h], [0, -h - 330], [w / 2 + 50, -h]], o.roof || 'accent3'), R(-70, -240, 140, 240, 'accent2', 6), C(40, -120, 9, 'light', NS), R(-w * 0.4, -h + 80, 130, 130, 'glass', 4, NS), R(w * 0.4 - 130, -h + 80, 130, 130, 'glass', 4, NS), S([[-w * 0.4 + 65, -h + 80], [-w * 0.4 + 65, -h + 210]], 6, 'dark', NS), S([[w * 0.4 - 65, -h + 80], [w * 0.4 - 65, -h + 210]], 6, 'dark', NS), R(w * 0.22, -h - 250, 70, 180, 'dark', 2)] }; },
  windmill: () => ({ w: 640, h: 1040, items: [P([[-130, 0], [130, 0], [84, -640], [-84, -640]], 'wall3'), P([[-110, -630], [0, -790], [110, -630]], 'accent3'), ...[0.5, 1.5, 2.5, 3.5].map((k) => { const a = k * (Math.PI / 2) + 0.3, c = Math.cos(a), s = Math.sin(a); const x0 = 0, y0 = -680; return P([[x0 + c * 40 - s * 12, y0 + s * 40 + c * 12], [x0 + c * 320 - s * 12, y0 + s * 320 + c * 12], [x0 + c * 320 + s * 56, y0 + s * 320 - c * 56], [x0 + c * 40 + s * 56, y0 + s * 40 - c * 56]], 'light'); }), C(0, -680, 26, 'dark')] }),
  moon: () => ({ w: 220, h: 220, items: [P(circlePts(0, -110, 110), 'light', NS), C(40, -128, 92, 'sky', NS)] }),
  stars: (o = {}) => { const w = span(o, 1400), items = []; for (let i = 0; i < 18; i++) { const x = -w / 2 + ((i * 197) % w), y = -((i * 83) % 330) - 10; items.push(P(star(x, y, 12 + (i % 3) * 5, 4, 0.4), 'light', NS)); } return { w, h: 350, items }; },
  // ------------ town and bazaar ------------
  'bazaar-stall': (o = {}) => {
    const w = span(o, 720), f = o.fill || 'accent3', items = [R(-w / 2 + 16, -760, 20, 760, 'dark', 4), R(w / 2 - 36, -760, 20, 760, 'dark', 4)];
    const n = 8, top = -830;
    for (let i = 0; i < n; i++) items.push(P([[-w / 2 + i * (w / n), top], [-w / 2 + (i + 1) * (w / n), top], [-w / 2 + (i + 1) * (w / n), top + 130], [-w / 2 + (i + 0.5) * (w / n), top + 180], [-w / 2 + i * (w / n), top + 130]], i % 2 ? 'light' : f, { noShadow: i % 2 === 1 }));
    items.push(R(-w / 2, -340, w, 340, 'accent1', 6), R(-w / 2 - 20, -366, w + 40, 34, 'dark', 6));
    for (let x = -w / 2 + 70; x < w / 2 - 30; x += 90) items.push(C(x, -400, 38, x % 180 < 90 ? 'accent3' : 'accent2'));
    return { w, h: 830, items };
  },
  skyline: (o = {}) => {
    const w = span(o, 2600), f = o.fill || 'hill', items = [];
    for (let x = -w / 2 + 150, i = 0; x < w / 2; x += 300, i++) {
      if (i % 3 === 1) { items.push(R(x - 130, -300, 260, 300, f, 0, NS), P(arcPts(x, -300, 130, Math.PI, Math.PI * 2, 14), f, NS), S([[x, -430], [x, -480]], 8, f, NS)); }
      else if (i % 3 === 2) items.push(R(x - 24, -640, 48, 640, f, 0, NS), P([[x - 30, -640], [x, -760], [x + 30, -640]], f, NS), R(x - 38, -490, 76, 18, f, 4, NS));
      else items.push(R(x - 130, -250 - (i % 2) * 70, 260, 250 + (i % 2) * 70, f, 0, NS));
    }
    return { w, h: 760, items };
  },
  lantern: () => ({ w: 150, h: 300, items: [S([[0, -300], [0, -210]], 6, 'dark'), C(0, -120, 100, 'accent1', { noShadow: true, alpha: 0.2 }), R(-46, -210, 92, 150, 'accent1', 12), R(-60, -222, 120, 20, 'dark', 6), R(-60, -66, 120, 20, 'dark', 6), S([[-16, -196], [-16, -74]], 5, 'dark', NS), S([[16, -196], [16, -74]], 5, 'dark', NS)] }),
  barrel: () => ({ w: 240, h: 320, items: [P([[-90, 0], [-120, -160], [-90, -320], [90, -320], [120, -160], [90, 0]], 'accent3'), R(-112, -250, 224, 18, 'dark', 2), R(-112, -90, 224, 18, 'dark', 2), E(0, -320, 90, 16, 'dark')] }),
  fountain: () => ({ w: 760, h: 620, items: [S(Q([0, -600], [-180, -660], [-250, -240]), 10, 'glass', NS), S(Q([0, -600], [180, -660], [250, -240]), 10, 'glass', NS), R(-34, -600, 68, 400, 'light', 8), P([[-210, -280], [210, -280], [130, -220], [-130, -220]], 'light'), R(-340, -160, 680, 160, 'wall2', 16), R(-340, -186, 680, 34, 'accent1', 14), P(star(0, -80, 44), 'accent3', NS)] }),
  // ------------ indoors ------------
  bed: (o = {}) => { const w = span(o, 860), f = o.fill || 'accent2'; return { w, h: 520, items: [R(-w / 2, -520, 60, 520, 'accent3', 12), R(w / 2 - 44, -340, 44, 340, 'accent3', 12), R(-w / 2 + 40, -270, w - 70, 210, 'light', 26), R(-w / 2 + 300, -292, w - 330, 232, f, 22), R(-w / 2 + 62, -360, 230, 110, 'light', 40)] }; },
  closet: () => ({ w: 520, h: 1120, items: [R(-260, -1120, 520, 1120, 'accent3', 8), R(-236, -1094, 228, 1050, 'wall2', 4, NS), R(8, -1094, 228, 1050, 'wall2', 4, NS), C(-34, -560, 11, 'dark', NS), C(34, -560, 11, 'dark', NS)] }),
  'hospital-bed': (o = {}) => { const w = span(o, 920); return { w, h: 560, items: [S([[-w / 2 + 40, -560], [-w / 2 + 40, -90]], 16, 'dark'), S([[-w / 2 + 40, -470], [-w / 2 + 40 + 160, -470]], 10, 'dark'), R(-w / 2 + 40, -330, w - 80, 90, 'light', 22), R(-w / 2 + 300, -352, w - 340, 110, 'accent2', 22), R(-w / 2 + 60, -392, 220, 78, 'light', 30), R(-w / 2 + 40, -240, w - 80, 22, 'dark', 4), S([[-w / 2 + 90, -218], [-w / 2 + 90, -40]], 14, 'dark'), S([[w / 2 - 90, -218], [w / 2 - 90, -40]], 14, 'dark'), C(-w / 2 + 90, -24, 24, 'dark'), C(w / 2 - 90, -24, 24, 'dark')] }; },
  'iv-stand': () => ({ w: 220, h: 1020, items: [S([[0, -980], [0, -30]], 10, 'dark'), S([[-74, -980], [74, -980]], 8, 'dark'), R(-98, -960, 70, 130, 'glass', 14), S(Q([-62, -830], [40, -600], [30, -360]), 4, 'dark', NS), S([[-90, 0], [90, 0]], 12, 'dark')] }),
  'curtain-rail': (o = {}) => { const w = span(o, 700), h = o.h || 1200, items = [R(-w / 2, -h - 10, w, 16, 'dark', 6)]; for (let i = 0; i < 7; i++) items.push(P([[-w / 2 + i * (w / 7), -h], [-w / 2 + (i + 1) * (w / 7), -h], [-w / 2 + (i + 1) * (w / 7) - 8, 0], [-w / 2 + i * (w / 7) + 8, 0]], i % 2 ? 'wall2' : 'light', { noShadow: i % 2 === 0 })); return { w, h, items }; },
  'med-cabinet': () => ({ w: 440, h: 900, items: [R(-220, -900, 440, 900, 'light', 8), R(-196, -876, 188, 400, 'glass', 4, NS), R(8, -876, 188, 400, 'glass', 4, NS), R(-196, -440, 392, 420, 'wall2', 4, NS), R(-30, -700, 60, 180, 'accent3', 2), R(-90, -640, 180, 60, 'accent3', 2)] }),
  'judge-bench': (o = {}) => { const w = span(o, 1000); return { w, h: 620, items: [R(-w / 2, -500, w, 500, 'accent3', 6), R(-w / 2 - 26, -526, w + 52, 36, 'dark', 6), R(-w * 0.32, -420, w * 0.64, 300, 'wall2', 4, NS), P(star(0, -270, 74), 'accent1', NS), R(w * 0.14, -566, 170, 40, 'accent1', 6)] }; },
  fireplace: () => ({ w: 760, h: 780, items: [R(-380, -780, 760, 60, 'accent3', 8), R(-320, -720, 640, 720, 'wall2', 4), R(-210, -470, 420, 470, 'dark', 12, NS), P([[-120, 0], [0, -300], [120, 0]], 'accent3', NS), P([[-66, 0], [14, -190], [70, 0]], 'accent1', NS), S([[-160, -18], [160, -18]], 34, 'accent3')] }),
  fridge: () => ({ w: 400, h: 1040, items: [R(-200, -1040, 400, 1040, 'light', 26), S([[-200, -700], [200, -700]], 8, 'dark', NS), R(-164, -930, 20, 180, 'dark', 8, NS), R(-164, -640, 20, 200, 'dark', 8, NS)] }),
  tv: () => ({ w: 660, h: 500, items: [R(-330, -500, 660, 390, 'dark', 16), R(-296, -470, 592, 330, 'glass', 4, NS), R(-60, -110, 120, 70, 'dark', 2), R(-200, -40, 400, 40, 'accent3', 8)] }),
};
