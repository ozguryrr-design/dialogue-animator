// An original background score synthesized from code (no samples, no external tools) — so the music has no
// licence questions: it is generated fresh from this repository's MIT code and a seed. Deterministic: the same
// seed + duration + style always gives the same file. Instruments: soft pad, bass, a plucked lead
// (kalimba / marimba / bell / synth) and light percussion; arrangement = intro, body, ending on the tonic.
import path from 'node:path';
import { writeWav } from '../lib/wav.mjs';
import { log, rel, readJSON, exists } from '../lib/util.mjs';
import { rng } from '../engine/math.mjs';
import { loadConfig } from '../project/config.mjs';
import { loadStyle } from '../style/load.mjs';

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], pentatonic: [0, 2, 4, 7, 9] };
const PROGRESSIONS = {
  warm: [[0, 5, 3, 4], [0, 3, 5, 4]],          // I vi IV V / I IV vi V (scale degrees, 0-based)
  playful: [[0, 3, 4, 3], [0, 4, 5, 3]],
  calm: [[0, 2, 3, 0], [0, 5, 3, 0]],
  tense: [[0, 5, 2, 6], [0, 3, 6, 4]],
};
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function chordNotes(root, scale, degree) {
  const s = SCALES[scale === 'pentatonic' ? 'major' : scale];
  const n = (d) => root + s[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  return [n(degree), n(degree + 2), n(degree + 4)];
}

export function synthMusic({ duration, tempo = 92, mood = 'warm', scale = 'major', lead = 'kalimba', seed = 7, sr = 48000 }) {
  const r = rng(`music:${seed}:${mood}`);
  const N = Math.ceil(duration * sr) + sr; // one extra second of ring-out, trimmed by the mix
  const L = new Float32Array(N), R = new Float32Array(N);
  const beat = 60 / tempo, bar = beat * 4;
  const roots = scale === 'minor' || mood === 'tense' ? [57, 62, 64] : [60, 62, 65, 67];
  const root = roots[Math.floor(r() * roots.length)];
  const sc = mood === 'tense' && scale === 'major' ? 'minor' : scale;
  const prog = PROGRESSIONS[mood][Math.floor(r() * PROGRESSIONS[mood].length)];
  const bars = Math.ceil(duration / bar);
  const add = (buf, i, v) => { if (i >= 0 && i < N) buf[i] += v; };

  const pluck = (t0, freq, amp, pan, kind) => {
    const n = Math.round((kind === 'bell' ? 1.6 : kind === 'marimba' ? 0.5 : 0.9) * sr), s0 = Math.round(t0 * sr);
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let v;
      if (kind === 'kalimba') v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 4.5) + 0.25 * Math.sin(2 * Math.PI * freq * 5.95 * t) * Math.exp(-t * 18);
      else if (kind === 'marimba') v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 7) + 0.4 * Math.sin(2 * Math.PI * freq * 4 * t) * Math.exp(-t * 22);
      else if (kind === 'bell') v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2.2) + 0.3 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 4) + 0.15 * Math.sin(2 * Math.PI * freq * 5.4 * t) * Math.exp(-t * 7);
      else { const ph = (freq * t) % 1; v = (ph < 0.5 ? 1 : -1) * 0.35 * Math.exp(-t * 6); }
      const a = Math.min(1, t / 0.004) * amp;
      add(L, s0 + i, v * a * gl); add(R, s0 + i, v * a * gr);
    }
  };
  const pad = (t0, dur, notes, amp) => {
    const s0 = Math.round(t0 * sr), n = Math.round((dur + 0.6) * sr);
    let lpL = 0, lpR = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.35) * Math.min(1, Math.max(0, (dur + 0.6 - t) / 0.6));
      let vl = 0, vr = 0;
      for (const [k, m] of notes.entries()) {
        const f = mtof(m);
        vl += tri(f * 0.998 * t + k * 0.13);
        vr += tri(f * 1.002 * t + k * 0.29);
      }
      lpL += (vl - lpL) * 0.08; lpR += (vr - lpR) * 0.08;
      add(L, s0 + i, lpL * env * amp); add(R, s0 + i, lpR * env * amp);
    }
  };
  const bass = (t0, freq, amp) => {
    const s0 = Math.round(t0 * sr), n = Math.round(0.55 * sr);
    for (let i = 0; i < n; i++) { const t = i / sr; const v = (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t)) * Math.exp(-t * 4) * Math.min(1, t / 0.01) * amp; add(L, s0 + i, v); add(R, s0 + i, v); }
  };
  const kick = (t0, amp) => {
    const s0 = Math.round(t0 * sr), n = Math.round(0.18 * sr);
    let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += (50 + 70 * Math.exp(-t * 30)) / sr; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 18) * amp; add(L, s0 + i, v); add(R, s0 + i, v); }
  };
  const shaker = (t0, amp) => {
    const s0 = Math.round(t0 * sr), n = Math.round(0.05 * sr);
    let prev = 0;
    for (let i = 0; i < n; i++) { const w = r() * 2 - 1; const hp = w - prev; prev = w; const v = hp * Math.exp(-(i / sr) * 70) * amp; add(L, s0 + i, v * 0.8); add(R, s0 + i, v); }
  };

  const pent = [0, 2, 4, 7, 9].map((x) => x + (sc === 'minor' ? (x === 4 ? -1 : x === 9 ? -1 : 0) : 0));
  let mel = 2;
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, last = b === bars - 1;
    const deg = last ? 0 : prog[b % prog.length];
    const notes = chordNotes(root - 12, sc, deg);
    pad(t0, last ? Math.min(bar * 1.5, duration - t0 + 0.8) : bar, notes, 0.05);
    const intro = b < 1;
    if (!intro) { bass(t0, mtof(notes[0] - 12), 0.32); if (mood !== 'calm') bass(t0 + beat * 2, mtof(notes[0] - 12 + (b % 2 ? 7 : 0)), 0.22); }
    if (!intro && mood !== 'calm' && !last) {
      kick(t0, mood === 'playful' ? 0.5 : 0.35);
      if (mood === 'playful') kick(t0 + beat * 2, 0.35);
      for (let s = 0; s < 8; s++) shaker(t0 + (s * beat) / 2, s % 2 ? 0.05 : 0.09);
    }
    // lead: a motif on 8th notes with rests, walking the pentatonic scale
    const pattern = last ? [1, 0, 0, 0, 0, 0, 0, 0] : [1, 0, 1, 1, 0, 1, 0, r() < 0.5 ? 1 : 0];
    for (let s = 0; s < 8; s++) {
      if (!pattern[s]) continue;
      mel = Math.max(0, Math.min(9, mel + Math.round((r() - 0.5) * 3)));
      if (last) mel = 5;
      const m = root + 12 + pent[mel % 5] + 12 * Math.floor(mel / 5) - 12;
      pluck(t0 + (s * beat) / 2, mtof(m), (intro ? 0.12 : 0.16) * (s % 4 === 0 ? 1 : 0.8), (r() - 0.5) * 0.6, lead);
    }
  }
  // normalise to a gentle peak
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? 0.6 / peak : 1;
  for (let i = 0; i < N; i++) { L[i] *= g; R[i] *= g; }
  return { channels: [L, R], sr, key: root, progression: prog, bars };
}
const tri = (x) => { const p = x - Math.floor(x); return 4 * Math.abs(p - 0.5) - 1; };

export async function run(dir, cli = {}) {
  const { cfg, files } = loadConfig(dir, cli);
  const sbPath = path.join(files.build, 'storyboard.json');
  const tPath = path.join(files.build, 'timing.json');
  const duration = exists(sbPath) ? readJSON(sbPath).video.duration : exists(tPath) ? readJSON(tPath).duration : null;
  if (!duration) throw new Error('Run `da align` (or `da board`) first so the music knows the video length.');
  const style = loadStyle(cfg.style, files.dir);
  const opts = { duration, seed: cfg.seed, ...(style.music || {}), ...(cfg.music.tempo ? { tempo: cfg.music.tempo } : {}), ...(cfg.music.mood ? { mood: cfg.music.mood } : {}) };
  const m = synthMusic(opts);
  const out = path.join(files.build, 'music.wav');
  writeWav(out, m.channels, m.sr);
  return { out, opts, info: m, files };
}

export async function cli(args) {
  log.step('music');
  const { out, opts, info } = await run(args._[0] || '.', args);
  log.ok(`${opts.duration.toFixed(1)} s, ${opts.tempo || 92} bpm, mood ${opts.mood || 'warm'}, lead ${opts.lead || 'kalimba'}, ${info.bars} bars -> ${rel(out)}`);
  log.info('synthesized from code in this repository (no samples): free to use, MIT');
  return 0;
}
