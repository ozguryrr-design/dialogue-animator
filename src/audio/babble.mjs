// A playful gibberish "voice" per character, synthesized from the dialogue text (no recording, no TTS,
// no third-party samples, so no licence questions). Each syllable of the real text becomes one sung vowel
// with the right formants, so the rhythm, the mouth shapes and the word timing all follow the script.
// Pitch is derived from the character id (never from the name's assumed gender).
import path from 'node:path';
import { writeWav } from '../lib/wav.mjs';
import { readJSON, exists, log, rel, ensureDir } from '../lib/util.mjs';
import { hash32, rng } from '../engine/math.mjs';
import { tokenize, nuclei } from '../lib/text.mjs';
import { loadConfig } from '../project/config.mjs';
import { run as runParse } from '../project/parse.mjs';

const FORMANTS = {
  a: [800, 1300, 2500], e: [500, 1900, 2600], i: [320, 2300, 3000], ı: [420, 1500, 2500],
  o: [500, 900, 2400], ö: [460, 1500, 2400], u: [340, 850, 2300], ü: [330, 1750, 2300], y: [330, 1750, 2300],
};
const baseVowel = (ch) => {
  const c = ch.toLowerCase();
  if (FORMANTS[c]) return c;
  const b = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return FORMANTS[b] ? b : 'a';
};

function resonator(freq, bw, sr) {
  const r = Math.exp(-Math.PI * bw / sr), th = 2 * Math.PI * freq / sr;
  const a1 = 2 * r * Math.cos(th), a2 = -r * r, g = 1 - r;
  let y1 = 0, y2 = 0;
  return (x) => { const y = g * x + a1 * y1 + a2 * y2; y2 = y1; y1 = y; return y; };
}

export function voiceFor(id, character = {}) {
  const h = hash32(id);
  const height = character.body?.height || 1;
  return {
    f0: (150 + (h % 140)) * (1.08 - (height - 1) * 0.6),
    formant: 0.95 + ((h >>> 8) % 20) / 100,
    rate: 5.4 + ((h >>> 13) % 10) / 10,
    vibrato: 0.012 + ((h >>> 17) % 10) / 1000,
    seed: h,
  };
}

/** Synthesize one line. Returns Float32Array at `sr`. */
export function synthLine(text, voice, sr = 24000) {
  const r = rng(voice.seed + hash32(text));
  const words = tokenize(text);
  const out = [];
  const push = (arr) => { for (const v of arr) out.push(v); };
  const silence = (s) => push(new Float32Array(Math.round(s * sr)));
  silence(0.06);
  const total = words.reduce((n, w) => n + Math.max(1, nuclei(w).length), 0);
  let k = 0;
  const question = /\?\s*$/.test(text), excl = /!\s*$/.test(text);
  let phase = 0;
  for (const [wi, w] of words.entries()) {
    const vs = nuclei(w);
    const syl = vs.length ? vs : ['a'];
    const consonants = w.replace(/[^\p{L}]/gu, '').length - syl.length;
    for (const [si, v] of syl.entries()) {
      const pos = k / Math.max(1, total - 1);
      let f0 = voice.f0 * (1.06 - 0.12 * pos) * (1 + (r() - 0.5) * 0.14);
      if (question && k >= total - 2) f0 *= 1.18 + 0.12 * (k - total + 2);
      if (excl) f0 *= 1.08;
      // consonant onset: a short filtered noise burst, longer for sibilant-looking words
      if (consonants > 0 && (si === 0 || r() < 0.5)) {
        const sib = /[sşzcçjxf]/i.test(w);
        const n = Math.round((sib ? 0.055 : 0.022) * sr);
        const bp = resonator(sib ? 4800 : 2600, 1800, sr);
        const burst = new Float32Array(n);
        for (let i = 0; i < n; i++) burst[i] = bp((r() * 2 - 1)) * (sib ? 0.5 : 0.8) * Math.sin(Math.PI * i / n);
        push(burst);
      }
      const dur = (1 / voice.rate) * (0.75 + r() * 0.35) * (si === syl.length - 1 && wi === words.length - 1 ? 1.5 : 1);
      const n = Math.round(dur * sr);
      const F = FORMANTS[baseVowel(v)].map((f) => f * voice.formant);
      const res = F.map((f, j) => resonator(f, [90, 120, 170][j], sr));
      const seg = new Float32Array(n);
      const amp = excl ? 1.0 : 0.85;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const vib = 1 + voice.vibrato * Math.sin(2 * Math.PI * 5.5 * t);
        phase += (f0 * vib) / sr;
        if (phase >= 1) phase -= 1;
        const src = (phase < 0.4 ? Math.sin(Math.PI * phase / 0.4) : 0) - 0.25; // soft glottal pulse
        let y = 0;
        res.forEach((rf, j) => { y += rf(src) * [1, 0.6, 0.25][j]; });
        const envA = Math.min(1, t / 0.012) * Math.min(1, (dur - t) / 0.035);
        seg[i] = y * envA * amp;
      }
      push(seg);
      k++;
    }
    const tail = /[.!?…]$/.test(w) ? 0.26 : /[,;:]$/.test(w) ? 0.16 : 0.05 + r() * 0.03;
    silence(tail);
  }
  silence(0.05);
  const arr = Float32Array.from(out);
  let peak = 0;
  for (const v of arr) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.7 / peak : 1;
  for (let i = 0; i < arr.length; i++) arr[i] *= g;
  return arr;
}

/** Write one file per line: NN_<speaker>.wav into `outDir`. */
export async function run(dir, cli = {}) {
  const { files } = loadConfig(dir, cli);
  const dPath = path.join(files.build, 'dialogue.json');
  const dialogue = exists(dPath) ? readJSON(dPath) : (await runParse(dir, cli)).dialogue;
  const cPath = path.join(files.build, 'characters.json');
  const chars = exists(cPath) ? readJSON(cPath).characters : [];
  const outDir = cli.into === 'audio' ? path.join(files.dir, 'audio') : path.join(files.build, 'babble');
  ensureDir(outDir);
  const written = [];
  for (const l of dialogue.lines) {
    const ch = chars.find((c) => c.id === l.speaker) || {};
    const pcm = synthLine(l.text, voiceFor(l.speaker, ch), 24000);
    const f = path.join(outDir, `${String(l.index).padStart(2, '0')}_${l.speaker}.wav`);
    writeWav(f, pcm, 24000);
    written.push(f);
  }
  return { outDir, written, files };
}

export async function cli(args) {
  log.step('babble');
  const { outDir, written, files } = await run(args._[0] || '.', args);
  log.ok(`${written.length} line file(s) -> ${rel(outDir, process.cwd())}`);
  if (args.into !== 'audio') log.info(`used automatically when project.json has "voice": "babble" (or pass --into audio to keep them in ${rel(path.join(files.dir, 'audio'))})`);
  return 0;
}
