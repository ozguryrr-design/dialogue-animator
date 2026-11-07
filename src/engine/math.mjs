// Deterministic math for the renderer: hashes instead of Math.random, easing curves, value noise.
// Same inputs -> same pixels, on every machine and in every renderer adapter.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const invLerp = (a, b, x) => (b === a ? 0 : clamp((x - a) / (b - a)));

export const ease = {
  linear: (u) => clamp(u),
  smooth: (u) => { u = clamp(u); return u * u * (3 - 2 * u); },
  smoother: (u) => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); },
  inOutCubic: (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
  outCubic: (u) => 1 - Math.pow(1 - clamp(u), 3),
  inCubic: (u) => Math.pow(clamp(u), 3),
  outBack: (u, s = 1.70158) => { u = clamp(u); return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); },
  inOutSine: (u) => -(Math.cos(Math.PI * clamp(u)) - 1) / 2,
};

/** 32-bit hash of a string or number (FNV-1a for strings, integer mix for numbers). */
export function hash32(v) {
  if (typeof v === 'string') {
    let h = 0x811c9dc5;
    for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  let x = (Math.floor(v) | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Deterministic random in [0,1) from any number of integer/string keys. */
export function rand(...keys) {
  let h = 0x12345678;
  for (const k of keys) h = hash32((typeof k === 'string' ? hash32(k) : Math.floor(k * 1000)) ^ Math.imul(h, 31));
  return h / 4294967296;
}

export const randRange = (a, b, ...keys) => a + (b - a) * rand(...keys);

/** Seeded generator (mulberry32) for build-time choices (director). */
export function rng(seed) {
  let a = hash32(seed) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed, x) {
  const i = Math.floor(x), f = x - i;
  const a = rand(seed, i) * 2 - 1, b = rand(seed, i + 1) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Damped spring response to a step at t=0 (0 -> 1 with overshoot). */
export function spring(t, hz = 3, damping = 0.5) {
  if (t <= 0) return 0;
  const w = TAU * hz, z = clamp(damping, 0.05, 0.99);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
