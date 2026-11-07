// Voice timing -> build/timing.json + build/voice.wav + build/envelope.json
//
// Sources, in order of preference (docs/AUDIO.md):
//   1. words.json given by the user                       -> exact word times
//   2. one audio file per line (audio/01_ali.wav ...)     -> exact line times from decoded sample counts
//   3. one voice file + whisper (faster-whisper / openai-whisper) -> word times, lines found by text alignment
//   4. one voice file without whisper                     -> silence detection, lines matched by expected length
//   5. no audio at all                                    -> ESTIMATED from syllable counts (flagged everywhere)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJSON, writeJSON, exists, log, rel, ensureDir, round } from '../lib/util.mjs';
import { decodeAudio } from '../lib/ffmpeg.mjs';
import { writeWav } from '../lib/wav.mjs';
import { foldKey, syllables, stripPunct } from '../lib/text.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { loadConfig } from '../project/config.mjs';
import { run as runParse } from '../project/parse.mjs';
import { run as runCast } from '../project/cast.mjs';
import { run as runBabble } from './babble.mjs';
import { rmsEnvelope, voicedRegion, speechSegments, snapToDip, deepestDip, percentile } from './analyze.mjs';

export const SR = 48000;

// ---------- word helpers ----------

/** Spread words over [start, end] by syllable weight, snapping inner boundaries to energy dips. */
export function estimateWords(tokens, start, end, envInfo) {
  const weights = tokens.map((w) => syllables(w) + 0.35 + (/[,;:]$/.test(w) ? 0.6 : 0) + (/[.!?…]$/.test(w) ? 0.4 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const bounds = [start];
  let acc = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    acc += weights[i];
    let t = start + (end - start) * (acc / total);
    if (envInfo) t = snapToDip(envInfo.env, envInfo.hop, t - envInfo.offset, 0.08) + envInfo.offset;
    bounds.push(Math.min(Math.max(t, bounds[bounds.length - 1] + 0.06), end - 0.06 * (tokens.length - 1 - i)));
  }
  bounds.push(end);
  return tokens.map((w, i) => ({ w, s: round(bounds[i]), e: round(Math.max(bounds[i] + 0.05, bounds[i + 1] - (i < tokens.length - 1 ? 0.02 : 0))) }));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const sim = (a, b) => (a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0);

/** Needleman–Wunsch alignment of script words to transcript words. Returns index map script->transcript (or -1). */
export function alignSequences(script, heard) {
  const A = script.map((w) => foldKey(stripPunct(w))), B = heard.map((w) => foldKey(stripPunct(w)));
  const m = A.length, n = B.length, GAP = -0.4;
  const S = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  const P = Array.from({ length: m + 1 }, () => new Int8Array(n + 1));
  for (let i = 1; i <= m; i++) { S[i][0] = i * GAP; P[i][0] = 1; }
  for (let j = 1; j <= n; j++) { S[0][j] = j * GAP; P[0][j] = 2; }
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const s = sim(A[i - 1], B[j - 1]);
    const d = S[i - 1][j - 1] + (s >= 0.5 ? s : -0.6), u = S[i - 1][j] + GAP, l = S[i][j - 1] + GAP;
    if (d >= u && d >= l) { S[i][j] = d; P[i][j] = 0; } else if (u >= l) { S[i][j] = u; P[i][j] = 1; } else { S[i][j] = l; P[i][j] = 2; }
  }
  const map = new Array(m).fill(-1);
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && P[i][j] === 0) { if (sim(A[i - 1], B[j - 1]) >= 0.5) map[i - 1] = j - 1; i--; j--; }
    else if (i > 0 && (j === 0 || P[i][j] === 1)) i--;
    else j--;
  }
  return map;
}

/** Fill times for script words from matched transcript words; unmatched words are interpolated. */
function timesFromAlignment(script, heard, map) {
  const out = script.map((w, i) => (map[i] >= 0 ? { w, s: heard[map[i]].start, e: heard[map[i]].end } : { w, s: null, e: null }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].s !== null) continue;
    let a = i - 1; while (a >= 0 && out[a].s === null) a--;
    let b = i + 1; while (b < out.length && out[b].s === null) b++;
    const t0 = a >= 0 ? out[a].e : (b < out.length ? Math.max(0, out[b].s - 0.3 * (b - i)) : 0);
    const t1 = b < out.length ? out[b].s : t0 + 0.3 * (i - a);
    const span = (b - a - 1) || 1, k = i - a;
    out[i].s = t0 + ((t1 - t0) * (k - 1)) / span;
    out[i].e = t0 + ((t1 - t0) * k) / span;
  }
  return out.map((w) => ({ w: w.w, s: round(w.s), e: round(Math.max(w.e, w.s + 0.05)) }));
}

function flatWords(words) {
  if (Array.isArray(words)) return words;
  if (words.words) return words.words;
  if (words.segments) return words.segments.flatMap((s) => s.words || []);
  return [];
}
const wordText = (w) => w.word ?? w.w ?? w.text ?? '';

// ---------- whisper ----------

export function whisperBackend() {
  for (const py of ['python', 'python3', 'py']) {
    if (spawnSync(py, ['-c', 'import faster_whisper'], { windowsHide: true }).status === 0) return { kind: 'faster-whisper', py };
  }
  if (spawnSync('whisper', ['--help'], { windowsHide: true }).status === 0) return { kind: 'openai-whisper' };
  return null;
}

export function whisperWords(file, { model = 'base', language = 'auto' } = {}) {
  const be = whisperBackend();
  if (!be) return null;
  if (be.kind === 'faster-whisper') {
    const r = spawnSync(be.py, ['-I', path.join(ROOT, 'src', 'audio', 'whisper_words.py'), file, model, language], { encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true });
    if (r.status !== 0) throw new Error(`faster-whisper failed: ${(r.stderr || '').split('\n').slice(-5).join(' ')}`);
    return JSON.parse(r.stdout.trim().split('\n').pop()).words;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-whisper-'));
  const args = [file, '--model', model, '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', tmp];
  if (language && language !== 'auto' && language !== 'und') args.push('--language', language);
  const r = spawnSync('whisper', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`whisper failed: ${(r.stderr || '').slice(-300)}`);
  const j = readJSON(path.join(tmp, path.basename(file).replace(/\.[^.]+$/, '') + '.json'));
  fs.rmSync(tmp, { recursive: true, force: true });
  return flatWords(j).map((w) => ({ word: wordText(w).trim(), start: w.start, end: w.end }));
}

// ---------- file <-> line mapping ----------

export function mapAudioToLines(lines, audio, notes) {
  const map = new Map();
  const nums = audio.map((f) => ({ f, n: parseInt((path.basename(f).match(/^(\d+)/) || [])[1], 10) }));
  if (audio.length > 1 && nums.every((x) => !Number.isNaN(x.n))) {
    const zeroBased = nums.some((x) => x.n === 0);
    for (const { f, n } of nums) {
      const line = lines.find((l) => l.index === n + (zeroBased ? 1 : 0));
      if (line) map.set(line.id, f); else notes.push(`${path.basename(f)}: number ${n} has no matching line — ignored`);
    }
  } else if (audio.length === lines.length) lines.forEach((l, i) => map.set(l.id, audio[i]));
  for (const l of lines) {
    const f = map.get(l.id);
    if (!f) continue;
    const stem = foldKey(path.basename(f).replace(/^\d+[_\-. ]*/, '').replace(/\.[^.]+$/, ''));
    if (stem && stem !== foldKey(l.speaker) && stem !== foldKey(l.speakerName || '')) {
      notes.push(`${path.basename(f)} is mapped to line ${l.index} spoken by ${l.speakerName} — check the file name`);
    }
  }
  return map;
}

// ---------- main ----------

export async function run(dir, cli = {}) {
  const { cfg, files } = loadConfig(dir, cli);
  const T = cfg.timing;
  const dPath = path.join(files.build, 'dialogue.json');
  const dialogue = exists(dPath) ? readJSON(dPath) : (await runParse(dir, cli)).dialogue;
  if (!exists(path.join(files.build, 'characters.json'))) await runCast(dir, cli);
  const lines = dialogue.lines;
  const notes = [];
  let audio = files.audio;
  let source;

  if (cfg.voice === 'babble') {
    const b = await runBabble(dir, cli);
    audio = b.written;
    notes.push(`babble voice synthesized for ${audio.length} line(s) in ${rel(b.outDir, files.dir)}`);
  }
  const userWords = files.words ? readJSON(files.words) : null;
  if (userWords) {
    const { valid, errors } = validate(userWords, loadSchema('words'));
    if (!valid) throw new Error(`words.json is invalid:\n${errors.slice(0, 8).map((e) => '  - ' + e).join('\n')}`);
  }
  const perLineWords = userWords && userWords.lines ? userWords.lines : null;
  const fileMap = audio.length > 1 || (audio.length === 1 && lines.length === 1) ? mapAudioToLines(lines, audio, notes) : new Map();
  const timed = lines.map((l) => ({ id: l.id, index: l.index, speaker: l.speaker, start: 0, end: 0, audio: null, words: [], wordSource: 'estimate' }));
  const segments = []; // { start, pcm }
  let total;

  if (fileMap.size) {
    // ---- per-line audio ----
    source = cfg.voice === 'babble' ? 'babble' : 'per-line-audio';
    let t = T.leadIn;
    for (const [i, l] of lines.entries()) {
      const tl = timed[i];
      if (i > 0) t += T.gap * (lines[i - 1].speaker === l.speaker ? 0.6 : 1);
      t += l.pauseBefore || 0;
      const f = fileMap.get(l.id);
      if (!f) {
        const dur = estimateDuration(l.words, T.speechRate);
        tl.start = round(t); tl.end = round(t + dur);
        tl.words = estimateWords(l.words, tl.start, tl.end);
        tl.wordSource = 'estimate'; tl.estimated = true;
        notes.push(`line ${l.index} has no audio file — duration estimated`);
        t += dur; continue;
      }
      let pcm = decodeAudio(f, { sr: SR });
      const vr = voicedRegion(pcm, SR);
      if (vr.silent) notes.push(`${path.basename(f)} is silent`);
      let cut = 0;
      if (T.trimSilence && !vr.silent) {
        cut = vr.start;
        pcm = pcm.slice(Math.floor(vr.start * SR), Math.ceil(vr.end * SR));
      }
      const dur = pcm.length / SR;
      tl.start = round(t); tl.end = round(t + dur); tl.audio = rel(f, files.dir);
      segments.push({ start: t, pcm });
      const env = rmsEnvelope(pcm, SR);
      const pw = perLineWords && perLineWords.find((x) => x.index === l.index || x.id === l.id);
      if (pw) {
        const heard = pw.words.map((w) => ({ start: w.start - cut + t, end: w.end - cut + t, word: wordText(w) }));
        tl.words = timesFromAlignment(l.words, heard, alignSequences(l.words, heard.map((h) => h.word)));
        tl.wordSource = 'words.json';
      } else if (T.wordTiming === 'whisper') {
        const heard = (whisperWords(f, { model: T.whisperModel, language: dialogue.language }) || []).map((w) => ({ ...w, start: w.start - cut + t, end: w.end - cut + t }));
        tl.words = timesFromAlignment(l.words, heard, alignSequences(l.words, heard.map((h) => h.word)));
        tl.wordSource = 'whisper';
      } else {
        tl.words = estimateWords(l.words, t + 0.02, t + dur - 0.04, { env: env.env, hop: env.hop, offset: t });
        tl.wordSource = 'estimate-in-audio';
      }
      t += dur;
    }
    total = t + T.tail;
  } else if (audio.length === 1 || (userWords && !audio.length)) {
    // ---- one voice file (or words.json alone) ----
    const f = audio[0] || null;
    const pcm = f ? decodeAudio(f, { sr: SR }) : new Float32Array(0);
    const offset = T.leadIn;
    if (f) segments.push({ start: offset, pcm });
    const script = lines.flatMap((l) => l.words.map((w) => ({ w, line: l.index })));
    let heard = null;
    if (userWords) { heard = flatWords(userWords).map((w) => ({ word: wordText(w), start: w.start, end: w.end })); source = 'words.json'; }
    else if (T.wordTiming !== 'estimate' && whisperBackend()) {
      log.info(`whisper (${T.whisperModel}) is transcribing ${path.basename(f)} …`);
      heard = whisperWords(f, { model: T.whisperModel, language: dialogue.language });
      source = 'whisper';
    }
    if (heard && heard.length) {
      const words = timesFromAlignment(script.map((s) => s.w), heard, alignSequences(script.map((s) => s.w), heard.map((h) => h.word)));
      const matched = alignSequences(script.map((s) => s.w), heard.map((h) => h.word)).filter((x) => x >= 0).length;
      notes.push(`${matched}/${script.length} script words matched the ${source} transcript`);
      let k = 0;
      for (const [i, l] of lines.entries()) {
        const ws = words.slice(k, k + l.words.length).map((w) => ({ ...w, s: round(w.s + offset), e: round(w.e + offset) }));
        k += l.words.length;
        timed[i].words = ws; timed[i].wordSource = source;
        timed[i].start = ws.length ? ws[0].s : 0; timed[i].end = ws.length ? ws[ws.length - 1].e : 0;
        if (f) timed[i].audio = rel(f, files.dir);
      }
    } else if (f) {
      source = 'silence-split';
      const env = rmsEnvelope(pcm, SR);
      let segs = speechSegments(pcm, SR);
      const weight = lines.map((l) => l.words.reduce((a, w) => a + syllables(w), 0));
      while (segs.length > lines.length) {
        let best = 1, bg = Infinity;
        for (let i = 1; i < segs.length; i++) { const g = segs[i].start - segs[i - 1].end; if (g < bg) { bg = g; best = i; } }
        segs.splice(best - 1, 2, { start: segs[best - 1].start, end: segs[best].end });
      }
      while (segs.length < lines.length && segs.length) {
        // split the segment that is longest relative to the lines it should hold
        const totalW = weight.reduce((a, b) => a + b, 0), totalD = segs.reduce((a, s) => a + s.end - s.start, 0);
        let bi = 0, bv = -1;
        segs.forEach((s, i) => { const v = (s.end - s.start) / totalD; if (v > bv) { bv = v; bi = i; } });
        const s = segs[bi];
        const cut = deepestDip(env.env, env.hop, s.start + (s.end - s.start) * 0.3, s.start + (s.end - s.start) * 0.7);
        segs.splice(bi, 1, { start: s.start, end: cut - 0.02 }, { start: cut + 0.02, end: s.end });
        if (totalW <= 0) break;
      }
      if (segs.length < lines.length) throw new Error('Could not find speech in the voice file.');
      notes.push(`lines found by silence detection (${segs.length} segments) — use whisper (timing.wordTiming "auto") or words.json for exact timing`);
      lines.forEach((l, i) => {
        const s = segs[i];
        timed[i].start = round(s.start + offset); timed[i].end = round(s.end + offset); timed[i].audio = rel(f, files.dir);
        timed[i].words = estimateWords(l.words, timed[i].start, timed[i].end, { env: env.env, hop: env.hop, offset });
        timed[i].wordSource = 'estimate-in-audio';
      });
    }
    total = Math.max(offset + pcm.length / SR, timed[timed.length - 1].end) + T.tail;
  } else {
    // ---- no audio: estimate ----
    source = 'estimate';
    let t = T.leadIn;
    for (const [i, l] of lines.entries()) {
      if (i > 0) t += T.gap + 0.15;
      t += l.pauseBefore || 0;
      const dur = estimateDuration(l.words, T.speechRate);
      timed[i].start = round(t); timed[i].end = round(t + dur);
      timed[i].words = estimateWords(l.words, timed[i].start, timed[i].end);
      timed[i].wordSource = 'estimate'; timed[i].estimated = true;
      t += dur;
    }
    total = t + T.tail;
    notes.push(`no voice: timing ESTIMATED at ${T.speechRate} syllables/s — the video is silent apart from music`);
  }

  // ---- voice track ----
  total = round(total, 3);
  const voicePath = path.join(files.build, 'voice.wav');
  let hasVoice = false, envelope = null;
  if (segments.length) {
    const buf = new Float32Array(Math.ceil(total * SR));
    for (const s of segments) {
      const o = Math.round(s.start * SR);
      for (let i = 0; i < s.pcm.length && o + i < buf.length; i++) buf[o + i] += s.pcm[i];
    }
    writeWav(voicePath, buf, SR);
    hasVoice = true;
    envelope = mouthEnvelopes(buf, timed, total, cfg.fps);
  } else if (exists(voicePath)) fs.rmSync(voicePath);

  const timing = {
    source,
    estimated: source === 'estimate' || timed.some((l) => l.estimated),
    duration: total,
    sampleRate: SR,
    voice: hasVoice ? 'build/voice.wav' : null,
    lines: timed,
    notes,
  };
  writeJSON(path.join(files.build, 'timing.json'), timing);
  if (envelope) writeJSON(path.join(files.build, 'envelope.json'), envelope, { compact: true });
  else if (exists(path.join(files.build, 'envelope.json'))) fs.rmSync(path.join(files.build, 'envelope.json'));
  return { timing, files };
}

export function estimateDuration(words, rate = 4.6) {
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const punct = words.filter((w) => /[,;:.!?…]$/.test(w)).length;
  return Math.max(0.8, syl / rate + 0.12 * punct + 0.15);
}

/** Per-speaker mouth openness (0..100) per video frame from the placed voice track. */
export function mouthEnvelopes(buf, timed, total, fps) {
  const frames = Math.ceil(total * fps);
  const spf = SR / fps;
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const a = Math.max(0, Math.round((f - 0.5) * spf)), b = Math.min(buf.length, Math.round((f + 0.5) * spf));
    let s = 0;
    for (let i = a; i < b; i++) s += buf[i] * buf[i];
    rms[f] = Math.sqrt(s / Math.max(1, b - a));
  }
  const speakers = {};
  for (const l of timed) {
    const arr = speakers[l.speaker] || (speakers[l.speaker] = new Array(frames).fill(0));
    const f0 = Math.max(0, Math.floor((l.start - 0.02) * fps)), f1 = Math.min(frames - 1, Math.ceil((l.end + 0.03) * fps));
    const ref = percentile(Array.from(rms.slice(f0, f1 + 1)), 0.9) || 1e-6;
    let prev = 0;
    for (let f = f0; f <= f1; f++) {
      let v = Math.min(1, Math.pow(rms[f] / ref, 0.7));
      if (v < 0.12) v = 0;
      v = Math.max(v, prev * 0.5); // fast attack, ~2-frame release
      prev = v;
      arr[f] = Math.max(arr[f], Math.round(v * 100));
    }
  }
  return { fps, frames, speakers };
}

export async function cli(args) {
  log.step('align');
  const { timing, files } = await run(args._[0] || '.', args);
  log.ok(`source: ${timing.source}${timing.estimated ? ' (ESTIMATED timing)' : ''}, ${timing.lines.length} lines, ${timing.duration.toFixed(2)} s`);
  for (const n of timing.notes) log.info(n);
  log.ok(`wrote ${rel(path.join(files.build, 'timing.json'))}${timing.voice ? ', build/voice.wav, build/envelope.json' : ''}`);
  return 0;
}
