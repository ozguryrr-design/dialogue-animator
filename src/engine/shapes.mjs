// Shape specs shared by body builders, props and materials.
//   {k:'poly', pts, fill}            {k:'circle', x, y, r, fill}        {k:'ellipse', x, y, rx, ry, rot, fill}
//   {k:'rrect', x, y, w, h, r, fill} {k:'stroke', pts, w, fill, closed} {k:'ring', x, y, r, w, fill}
//   {k:'path', cmds:[['M',x,y],['L',x,y],['Q',cx,cy,x,y],['C',...],['Z']], fill}
//   {k:'group', tf:{x, y, rot, sx, sy}, items:[...]}
// Flags: feature (face detail: no shadow/outline), noShadow, gloss, alpha, noJitter.
import { TAU } from './math.mjs';

export function circlePts(x, y, r, n) {
  const N = n || Math.max(12, Math.min(72, Math.round((TAU * r) / 22)));
  const out = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU; out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return out;
}

export function ellipsePts(x, y, rx, ry, rot = 0, n) {
  const N = n || Math.max(12, Math.min(72, Math.round((Math.PI * (rx + ry)) / 22)));
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
    out.push([x + px * c - py * s, y + px * s + py * c]);
  }
  return out;
}

export function arcPts(x, y, r, a0, a1, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return out;
}

export function rrectPts(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r < 1) return [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  const q = Math.PI / 2, n = Math.max(3, Math.round(r / 10));
  return [
    ...arcPts(x + w - r, y + r, r, -q, 0, n), ...arcPts(x + w - r, y + h - r, r, 0, q, n),
    ...arcPts(x + r, y + h - r, r, q, 2 * q, n), ...arcPts(x + r, y + r, r, 2 * q, 3 * q, n),
  ];
}

export function quadPts(p0, c, p1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** Polygon outline of a thick polyline with round caps (used to cut strokes out of paper). */
export function stripPts(pts, w) {
  const h = w / 2, L = [], R = [];
  const n = pts.length;
  if (n < 2) return circlePts(pts[0][0], pts[0][1], h);
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    L.push([p[0] - dy * h, p[1] + dx * h]);
    R.push([p[0] + dy * h, p[1] - dx * h]);
  }
  const d0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  const d1 = Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]);
  const capEnd = arcPts(pts[n - 1][0], pts[n - 1][1], h, d1 + Math.PI / 2, d1 - Math.PI / 2, 6);
  const capStart = arcPts(pts[0][0], pts[0][1], h, d0 - Math.PI / 2, d0 - 1.5 * Math.PI, 6);
  return [...L, ...capEnd.slice(1, -1), ...R.reverse(), ...capStart.slice(1, -1)];
}

/** Sample a path spec into a polygon (for paper jitter / hit tests). */
export function pathPts(cmds) {
  const out = [];
  let cur = [0, 0];
  for (const c of cmds) {
    if (c[0] === 'M' || c[0] === 'L') { cur = [c[1], c[2]]; out.push(cur); }
    else if (c[0] === 'Q') { const p = quadPts(cur, [c[1], c[2]], [c[3], c[4]], 10).slice(1); out.push(...p); cur = [c[3], c[4]]; }
    else if (c[0] === 'C') {
      const p0 = cur, p1 = [c[1], c[2]], p2 = [c[3], c[4]], p3 = [c[5], c[6]];
      for (let i = 1; i <= 14; i++) {
        const t = i / 14, u = 1 - t;
        out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
      }
      cur = p3;
    }
  }
  return out;
}

/** Any closed shape -> polygon points. */
export function toPolygon(s) {
  switch (s.k) {
    case 'poly': return s.pts;
    case 'circle': return circlePts(s.x, s.y, s.r);
    case 'ellipse': return ellipsePts(s.x, s.y, s.rx, s.ry, s.rot || 0);
    case 'rrect': return rrectPts(s.x, s.y, s.w, s.h, s.r || 0);
    case 'stroke': return stripPts(s.pts, s.w);
    case 'path': return pathPts(s.cmds);
    default: return [];
  }
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function tracePoly(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
}

export function tracePath(ctx, cmds) {
  ctx.beginPath();
  for (const c of cmds) {
    if (c[0] === 'M') ctx.moveTo(c[1], c[2]);
    else if (c[0] === 'L') ctx.lineTo(c[1], c[2]);
    else if (c[0] === 'Q') ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'C') ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    else if (c[0] === 'Z') ctx.closePath();
  }
}
