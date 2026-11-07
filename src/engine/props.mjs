// Prop geometry as shape specs with colour ROLES (resolved by the style palette). Origin = bottom centre,
// up is negative y. Every prop returns { items, w, h } so the director can frame cutaway inserts on it.
import { arcPts, circlePts } from './shapes.mjs';

const R = (x, y, w, h, fill, r = 0, extra = {}) => ({ k: 'rrect', x, y, w, h, r, fill, ...extra });
const C = (x, y, r, fill, extra = {}) => ({ k: 'circle', x, y, r, fill, ...extra });
const E = (x, y, rx, ry, fill, extra = {}) => ({ k: 'ellipse', x, y, rx, ry, fill, ...extra });
const P = (pts, fill, extra = {}) => ({ k: 'poly', pts, fill, ...extra });
const S = (pts, w, fill, extra = {}) => ({ k: 'stroke', pts, w, fill, ...extra });

export const PROPS = {
  window: () => ({ w: 320, h: 360, items: [
    R(-160, -360, 320, 360, 'light', 10), R(-140, -340, 280, 320, 'glass', 4, { noShadow: true }),
    C(60, -260, 46, 'accent1', { noShadow: true }),
    R(-8, -340, 16, 320, 'accent2', 0), R(-140, -188, 280, 14, 'accent2', 0), R(-180, -14, 360, 22, 'dark', 6),
  ] }),
  door: () => ({ w: 260, h: 640, items: [R(-130, -640, 260, 640, 'accent3', 12), R(-100, -600, 200, 250, 'light', 8, { alpha: 0.35 }), C(90, -300, 14, 'dark')] }),
  shelf: () => ({ w: 320, h: 150, items: [
    R(-120, -110, 60, 86, 'accent2', 12), E(-10, -46, 40, 48, 'accent3'), R(50, -100, 46, 76, 'accent1', 10), R(-160, -26, 320, 26, 'dark', 4),
  ] }),
  plant: () => ({ w: 230, h: 430, items: [
    E(-60, -300, 46, 110, 'accent2', { rot: -0.5 }), E(55, -320, 46, 120, 'accent2', { rot: 0.45 }), E(0, -370, 44, 120, 'hill'),
    P([[-80, -170], [80, -170], [62, 0], [-62, 0]], 'accent3'), R(-90, -190, 180, 30, 'accent3', 6),
  ] }),
  lamp: () => ({ w: 220, h: 820, items: [S([[0, -660], [0, -20]], 16, 'dark'), E(0, -12, 80, 18, 'dark'), P([[-110, -640], [110, -640], [70, -820], [-70, -820]], 'accent1')] }),
  table: () => ({ w: 300, h: 300, items: [R(-150, -300, 300, 36, 'accent3', 8), S([[-110, -270], [-120, 0]], 22, 'dark'), S([[110, -270], [120, 0]], 22, 'dark')] }),
  counter: (o = {}) => {
    const w = o.w || 1600, n = Math.max(2, Math.round(w / 300)), items = [R(-w / 2, -400, w, 400, 'light', 0)];
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n); items.push(R(x - w / n / 2 + 18, -340, w / n - 36, 300, 'wall2', 8, { noShadow: true }), R(x - 30, -220, 60, 12, 'dark', 6, { noShadow: true })); }
    items.push(R(-w / 2 - 20, -430, w + 40, 40, 'dark', 6));
    return { w, h: 430, items };
  },
  teapot: () => ({ w: 230, h: 200, items: [
    S([[70, -120], [130, -165], [150, -175]], 22, 'accent3'), S(arcPts(-95, -95, 50, Math.PI * 0.5, Math.PI * 1.5, 10), 18, 'accent3'),
    E(0, -85, 95, 85, 'accent3'), E(0, -168, 50, 16, 'dark'), C(0, -190, 14, 'dark'), R(-70, -12, 140, 12, 'dark', 4),
  ] }),
  mug: () => ({ w: 150, h: 220, items: [
    S(arcPts(52, -65, 34, -Math.PI * 0.5, Math.PI * 0.5, 10), 16, 'accent2'), R(-55, -130, 110, 130, 'accent2', 14),
    S([[-20, -150], [-30, -185], [-18, -215]], 10, 'light', { noShadow: true }), S([[15, -150], [5, -180], [18, -210]], 10, 'light', { noShadow: true }),
  ] }),
  clock: () => ({ w: 220, h: 220, items: [C(0, -110, 110, 'dark'), C(0, -110, 92, 'light'), S([[0, -110], [0, -170]], 12, 'dark', { noShadow: true }), S([[0, -110], [40, -95]], 12, 'dark', { noShadow: true }), C(0, -110, 10, 'accent3', { noShadow: true })] }),
  frame: () => ({ w: 260, h: 200, items: [R(-130, -200, 260, 200, 'accent1', 6), R(-108, -178, 216, 156, 'light', 2, { noShadow: true }), P([[-100, -24], [-30, -120], [20, -60], [55, -100], [100, -24]], 'accent2', { noShadow: true }), C(60, -140, 18, 'accent3', { noShadow: true })] }),
  sofa: (o = {}) => {
    const w = o.w || 900;
    return { w, h: 420, items: [R(-w / 2 + 40, -420, w - 80, 260, 'accent2', 40), R(-w / 2, -250, w, 190, 'accent2', 30), R(-w / 2 - 20, -300, 110, 240, 'accent2', 40), R(w / 2 - 90, -300, 110, 240, 'accent2', 40), R(-w / 2 + 70, -60, 30, 60, 'dark', 6), R(w / 2 - 100, -60, 30, 60, 'dark', 6)] };
  },
  desk: () => ({ w: 520, h: 480, items: [
    R(-200, -470, 230, 150, 'dark', 12), R(-210, -330, 250, 16, 'dark', 6),
    R(-260, -310, 520, 34, 'accent3', 8), R(-240, -276, 30, 276, 'dark', 6), R(210, -276, 30, 276, 'dark', 6), R(120, -276, 120, 160, 'accent3', 8),
  ] }),
  bookshelf: () => {
    const items = [R(-170, -900, 340, 900, 'accent3', 10)];
    const roles = ['accent1', 'accent2', 'light', 'dark', 'accent1', 'wall'];
    for (let row = 0; row < 4; row++) {
      const y = -860 + row * 215;
      items.push(R(-150, y + 170, 300, 18, 'dark', 2, { noShadow: true }));
      let x = -140;
      for (let b = 0; b < 6 && x < 120; b++) { const w = 34 + ((row * 7 + b * 13) % 28), h = 120 + ((row * 11 + b * 17) % 50); items.push(R(x, y + 170 - h, w, h, roles[(row + b) % roles.length], 4)); x += w + 6; }
    }
    return { w: 340, h: 900, items };
  },
  tree: () => ({ w: 420, h: 900, items: [R(-28, -520, 56, 520, 'dark', 10), C(0, -640, 190, 'hill'), C(-120, -540, 130, 'ground'), C(120, -560, 140, 'ground'), C(20, -760, 130, 'hill')] }),
  bush: () => ({ w: 360, h: 200, items: [C(-100, -80, 90, 'ground'), C(0, -110, 110, 'hill'), C(110, -80, 90, 'ground')] }),
  bench: () => ({ w: 520, h: 300, items: [R(-260, -300, 520, 34, 'accent3', 8), R(-260, -250, 520, 34, 'accent3', 8), R(-260, -170, 520, 30, 'accent3', 8), S([[-220, -150], [-230, 0]], 22, 'dark'), S([[220, -150], [230, 0]], 22, 'dark')] }),
  building: (o = {}) => {
    const w = o.w || 520, h = o.h || 1300, fill = o.fill || 'wall', items = [R(-w / 2, -h, w, h, fill, 6)];
    const cols = Math.max(2, Math.floor(w / 150)), rows = Math.max(3, Math.floor(h / 230));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ww = w / cols * 0.55, hh = 130, x = -w / 2 + (c + 0.5) * (w / cols) - ww / 2, y = -h + 90 + r * (h - 200) / rows;
      items.push(R(x, y, ww, hh, (r + c) % 3 === 0 ? 'accent1' : 'light', 6, { noShadow: true }));
    }
    items.push(R(-w / 2 - 14, -h - 26, w + 28, 30, 'dark', 4));
    return { w, h, items };
  },
  streetlamp: () => ({ w: 160, h: 980, items: [S([[0, -900], [0, 0]], 22, 'dark'), S([[0, -900], [70, -940], [110, -930]], 18, 'dark'), E(110, -905, 46, 26, 'accent1')] }),
  sun: () => ({ w: 260, h: 260, items: [C(0, -130, 130, 'accent1')] }),
  cloud: () => ({ w: 420, h: 170, items: [C(-110, -60, 70, 'light'), C(0, -100, 100, 'light'), C(120, -60, 76, 'light'), R(-180, -70, 370, 70, 'light', 35)] }),
  awning: (o = {}) => {
    const w = o.w || 900, n = 8, items = [];
    for (let i = 0; i < n; i++) items.push(P([[-w / 2 + i * (w / n), -170], [-w / 2 + (i + 1) * (w / n), -170], [-w / 2 + (i + 1) * (w / n), -40], [-w / 2 + (i + 0.5) * (w / n), 0], [-w / 2 + i * (w / n), -40]], i % 2 ? 'light' : 'accent3', { noShadow: i % 2 === 1 }));
    return { w, h: 170, items };
  },
  'cafe-table': () => ({ w: 300, h: 330, items: [E(0, -320, 150, 30, 'accent3'), S([[0, -300], [0, -20]], 22, 'dark'), E(0, -10, 90, 16, 'dark')] }),
  'menu-board': () => ({ w: 420, h: 300, items: [R(-210, -300, 420, 300, 'dark', 16), ...[0, 1, 2, 3].map((i) => R(-160, -250 + i * 60, 220 - (i % 2) * 70, 18, 'light', 9, { noShadow: true })), ...[0, 1, 2, 3].map((i) => R(110, -250 + i * 60, 50, 18, 'accent1', 9, { noShadow: true }))] }),
  'coffee-machine': () => ({ w: 260, h: 330, items: [R(-130, -330, 260, 330, 'dark', 20), R(-90, -290, 180, 70, 'light', 10, { noShadow: true }), R(-30, -200, 60, 50, 'accent3', 8), R(-45, -80, 90, 70, 'accent2', 10)] }),
  phone: () => ({ w: 120, h: 220, items: [R(-60, -220, 120, 220, 'dark', 20), R(-48, -200, 96, 170, 'light', 8, { noShadow: true }), R(-30, -170, 60, 14, 'accent2', 7, { noShadow: true }), R(-30, -140, 44, 14, 'accent1', 7, { noShadow: true })] }),
  book: () => ({ w: 220, h: 70, items: [R(-110, -70, 220, 70, 'accent3', 8), R(-100, -60, 200, 22, 'light', 4, { noShadow: true })] }),
  cake: () => ({ w: 260, h: 260, items: [R(-120, -150, 240, 150, 'accent3', 20), R(-120, -170, 240, 50, 'light', 22), C(-60, -170, 18, 'accent1'), C(0, -175, 18, 'accent1'), C(60, -170, 18, 'accent1'), S([[0, -190], [0, -250]], 14, 'accent2'), E(0, -262, 12, 18, 'accent1')] }),
  umbrella: () => ({ w: 360, h: 420, items: [S([[0, -330], [0, -30]], 14, 'dark'), S(arcPts(-24, -30, 24, 0, Math.PI, 8), 14, 'dark'), P([...arcPts(0, -300, 180, Math.PI, Math.PI * 2, 18)], 'accent3')] }),
  rug: (o = {}) => ({ w: o.w || 900, h: 60, items: [E(0, 40, (o.w || 900) / 2, 60, 'accent1', { noShadow: true })] }),
  'hanging-lamp': () => ({ w: 200, h: 600, items: [S([[0, -600], [0, -130]], 8, 'dark'), P([[-100, 0], [100, 0], [50, -130], [-50, -130]], 'accent1')] }),
};

export const PROP_TYPES = Object.keys(PROPS);

export function propGeometry(type, opts = {}) {
  const fn = PROPS[type];
  if (!fn) return { w: 100, h: 100, items: [] };
  return fn(opts);
}

export { circlePts };
