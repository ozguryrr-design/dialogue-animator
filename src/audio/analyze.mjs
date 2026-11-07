// Audio analysis on float PCM: RMS envelopes, voiced regions, silence splitting, word-boundary snapping.

export function rmsEnvelope(x, sr, hop = 0.01, win = 0.02) {
  const h = Math.max(1, Math.round(hop * sr)), w = Math.max(h, Math.round(win * sr));
  const n = Math.max(1, Math.ceil(x.length / h));
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i * h, a = Math.max(0, c - (w >> 1)), b = Math.min(x.length, c + (w >> 1));
    let s = 0;
    for (let k = a; k < b; k++) s += x[k] * x[k];
    env[i] = Math.sqrt(s / Math.max(1, b - a));
  }
  return { env, hop: h / sr };
}

export function percentile(arr, p) {
  const a = Array.from(arr).sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

export const db = (v) => 20 * Math.log10(Math.max(1e-9, v));

/** First/last moment the signal rises above the speech threshold. Seconds. */
export function voicedRegion(x, sr) {
  const { env, hop } = rmsEnvelope(x, sr);
  const ref = percentile(env, 0.95);
  if (ref < 1e-4) return { start: 0, end: x.length / sr, silent: true };
  const thr = Math.max(ref * 0.07, 0.0015);
  let a = 0, b = env.length - 1;
  while (a < env.length && env[a] < thr) a++;
  while (b > a && env[b] < thr) b--;
  return { start: Math.max(0, a * hop - 0.03), end: Math.min(x.length / sr, (b + 1) * hop + 0.05), silent: false };
}

/** Speech segments separated by silences >= minSilence. Returns [{start, end}] in seconds. */
export function speechSegments(x, sr, { minSilence = 0.25, minSpeech = 0.12 } = {}) {
  const { env, hop } = rmsEnvelope(x, sr);
  const ref = percentile(env, 0.95);
  const thr = Math.max(ref * 0.06, 0.0015);
  const segs = [];
  let inSp = false, s = 0, quiet = 0;
  for (let i = 0; i < env.length; i++) {
    const loud = env[i] >= thr;
    if (loud) { if (!inSp) { inSp = true; s = i; } quiet = 0; }
    else if (inSp) {
      quiet++;
      if (quiet * hop >= minSilence) { segs.push({ start: s * hop, end: (i - quiet + 1) * hop }); inSp = false; quiet = 0; }
    }
  }
  if (inSp) segs.push({ start: s * hop, end: (env.length - quiet) * hop });
  return segs.filter((g) => g.end - g.start >= minSpeech).map((g) => ({ start: Math.max(0, g.start - 0.03), end: g.end + 0.05 }));
}

/** Lowest-energy moment within ±radius of t (used to snap estimated word boundaries to real dips). */
export function snapToDip(env, hop, t, radius = 0.08) {
  const a = Math.max(0, Math.floor((t - radius) / hop)), b = Math.min(env.length - 1, Math.ceil((t + radius) / hop));
  let best = Math.round(t / hop), bv = Infinity;
  for (let i = a; i <= b; i++) if (env[i] < bv) { bv = env[i]; best = i; }
  return best * hop;
}

/** Deepest dip inside [a, b] (seconds) — used to split one speech segment into two lines. */
export function deepestDip(env, hop, a, b) {
  const i0 = Math.ceil(a / hop), i1 = Math.floor(b / hop);
  let best = Math.round((a + b) / 2 / hop), bv = Infinity;
  for (let i = i0; i <= i1; i++) {
    let s = 0, n = 0;
    for (let k = i - 3; k <= i + 3; k++) if (k >= 0 && k < env.length) { s += env[k]; n++; }
    if (s / n < bv) { bv = s / n; best = i; }
  }
  return best * hop;
}
