// Sound effects synthesized from code (no samples): door, bolt, clink, knock, whoosh.
// The director places them as "sfx" events; `da mix` renders them into build/sfx.wav and mixes them in
// (not ducked — they are part of the action). Deterministic: same storyboard -> same file.
import path from 'node:path';
import { writeWav } from '../lib/wav.mjs';
import { decodeAudio } from '../lib/ffmpeg.mjs';
import { foldKey } from '../lib/text.mjs';
import { log } from '../lib/util.mjs';
import { rng } from '../engine/math.mjs';

const SR = 48000;

function onePoleLP(x, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = y; }
  return x;
}

function partials(n, list, r) {
  const out = new Float32Array(n);
  for (const [f, amp, decay] of list) {
    const ph = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] += Math.sin(2 * Math.PI * f * t + ph) * amp * Math.exp(-decay * t); }
  }
  return out;
}

function noise(n, r, decay, cutoff) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (r() * 2 - 1) * Math.exp(-decay * (i / SR));
  return cutoff ? onePoleLP(x, cutoff) : x;
}

const add = (dst, src, at = 0, g = 1) => { for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] += src[i] * g; return dst; };

export const SFX = {
  // a heavy wooden door shutting: low body thump + latch
  door(r) {
    const n = Math.round(0.9 * SR), out = new Float32Array(n);
    add(out, partials(n, [[58, 1, 9], [96, 0.6, 13], [151, 0.25, 20]], r));
    add(out, noise(Math.round(0.12 * SR), r, 35, 900), 0, 0.9);
    add(out, partials(Math.round(0.15 * SR), [[1900, 0.25, 45], [2950, 0.15, 60]], r), Math.round(0.035 * SR));
    return out;
  },
  // an iron bolt slid home: short scrape, then a hard click and a ring
  bolt(r) {
    const n = Math.round(0.8 * SR), out = new Float32Array(n);
    const scrape = noise(Math.round(0.16 * SR), r, 4, 0);
    for (let i = 0; i < scrape.length; i++) scrape[i] *= 0.35 * Math.min(1, i / (0.03 * SR));
    add(out, onePoleLP(scrape, 5200));
    const hit = Math.round(0.17 * SR);
    add(out, partials(n - hit, [[2150, 0.7, 26], [3420, 0.45, 34], [5100, 0.3, 48], [148, 0.6, 22]], r), hit);
    add(out, noise(Math.round(0.02 * SR), r, 120, 0), hit, 0.8);
    return out;
  },
  // a ceramic bowl set on a wooden tray
  clink(r) {
    const n = Math.round(0.5 * SR), out = new Float32Array(n);
    add(out, partials(n, [[1870, 0.5, 9], [3120, 0.3, 14], [4650, 0.2, 21]], r));
    add(out, partials(Math.round(0.12 * SR), [[180, 0.5, 30]], r));
    return out;
  },
  knock(r) {
    const n = Math.round(0.7 * SR), out = new Float32Array(n);
    for (const k of [0, 0.18, 0.36]) add(out, partials(Math.round(0.2 * SR), [[120, 0.9, 25], [320, 0.4, 40]], r), Math.round(k * SR));
    return out;
  },
  whoosh(r) {
    const n = Math.round(0.45 * SR), x = noise(n, r, 0, 0);
    for (let i = 0; i < n; i++) x[i] *= Math.sin(Math.PI * i / n) ** 2 * 0.5;
    return onePoleLP(x, 2500);
  },
};

/** Other names (Turkish included) for the built-in effects; a file with any of these names replaces the built-in one. */
export const SFX_ALIASES = {
  door: ['kapi', 'kapikapanma'], bolt: ['surgu', 'kilit'], clink: ['tikirti', 'kase'], knock: ['tiklama', 'kapivurma'], whoosh: ['hisirti', 'gecis'],
};

/** Find a sound by name: the user's file in sfx/ first, then a built-in. Returns { file } | { builtin } | null. */
export function resolveSfx(name, userFiles = []) {
  const k = foldKey(name);
  const id = Object.keys(SFX).find((x) => x === k || SFX_ALIASES[x]?.includes(k));
  const names = id ? [id, ...(SFX_ALIASES[id] || [])] : [k];
  const file = userFiles.find((f) => names.includes(foldKey(path.basename(f, path.extname(f)))));
  if (file) return { file };
  return id ? { builtin: id } : null;
}

/** Render all "sfx" events of a storyboard. Returns the wav path, or null when there are none. */
export function renderSfx(sb, buildDir, userFiles = []) {
  const events = (sb.events || []).filter((e) => e.type === 'sfx');
  if (!events.length) return null;
  const n = Math.ceil(sb.video.duration * SR);
  const out = new Float32Array(n), ref = new Float32Array(n);
  const cache = new Map();
  events.forEach((e, i) => {
    const r = resolveSfx(e.value, userFiles);
    if (!r) { log.warn(`sound effect "${e.value}" not found in sfx/ and not built in — skipped`); return; }
    let pcm;
    if (r.file) {
      if (!cache.has(r.file)) {
        const x = decodeAudio(r.file, { sr: SR });
        let p = 0;
        for (const v of x) p = Math.max(p, Math.abs(v));
        cache.set(r.file, x.map((v) => (p > 0 ? (v * 0.8) / p : 0))); // your files are level-matched; adjust with "@sfx name -3dB"
      }
      pcm = cache.get(r.file);
    } else pcm = SFX[r.builtin](rng(`sfx:${sb.meta.seed}:${i}:${r.builtin}`));
    add(out, pcm, Math.round(e.t * SR), Math.pow(10, (e.gainDb || 0) / 20));
    add(ref, pcm, Math.round(e.t * SR), 1);
  });
  // the level is set by the mix at 0 dB, so that "@sfx name -6dB" stays 6 dB quieter even when it is the only cue
  let peak = 0, refPeak = 0;
  for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(out[i])); refPeak = Math.max(refPeak, Math.abs(ref[i])); }
  const g = peak > 0 ? Math.min(0.9 / refPeak, 0.98 / peak) : 1;
  for (let i = 0; i < n; i++) out[i] *= g;
  const file = path.join(buildDir, 'sfx.wav');
  writeWav(file, out, SR);
  return file;
}
