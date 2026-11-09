// `da qa <dir>`: automatic checks any model or person can read — no vision needed.
//   specs        resolution / fps / duration / codecs match the storyboard
//   frames       black, white, frozen spans, unplanned pops (frame-difference spikes outside cuts)
//   audio        integrated loudness, true peak, long silences
//   sync         speech in the final audio vs the storyboard's line times (cross-correlation lag in frames)
//   layout       captions inside the safe area and off faces, speaker faces not cut by the frame edge
//   rhythm       storyboard lint (shot lengths, repeats, static holds, reaction lead)
// Writes build/qa/report.md + report.json + contact sheets (whole video, one still per shot).
import path from 'node:path';
import fs from 'node:fs';
import { log, rel, ensureDir, writeJSON, writeText, readJSON, exists, humanBytes, dirSize, round, c } from '../lib/util.mjs';
import { mediaInfo, measureLoudness, ffmpegSync, decodeAudio } from '../lib/ffmpeg.mjs';
import { loadProject } from '../render/common.mjs';
import { outputPath } from '../project/config.mjs';
import { lintStoryboard } from '../director/lint.mjs';
import { decodeFrames, makeSheet, videoSheets } from './sheet.mjs';

const ranges = (frames) => {
  const out = [];
  for (const f of frames.sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && f <= last[1] + 1) last[1] = f; else out.push([f, f]);
  }
  return out;
};
const fmtRanges = (rs, fps) => rs.slice(0, 12).map(([a, b]) => (a === b ? `f${a} (${(a / fps).toFixed(2)}s)` : `f${a}–${b} (${(a / fps).toFixed(2)}–${(b / fps).toFixed(2)}s)`)).join(', ') + (rs.length > 12 ? ` … +${rs.length - 12}` : '');

export async function run(dir, args = {}) {
  const { cfg, files, sb, style } = await loadProject(dir, args);
  const video = path.resolve(args.video || outputPath(cfg, files, sb.meta.title));
  if (!exists(video)) throw new Error(`${rel(video)} not found — run \`da mix\` first (or pass --video).`);
  const qaDir = ensureDir(path.join(files.build, 'qa'));
  const fps = sb.video.fps, checks = [];
  const add = (group, name, status, detail) => checks.push({ group, name, status, detail });

  // ---- specs ----
  const info = mediaInfo(video);
  const v = info.video, a = info.audio;
  add('specs', 'video stream', v && v.width === sb.video.width && v.height === sb.video.height && Math.abs(v.fps - fps) < 0.01 ? 'pass' : 'fail',
    v ? `${v.codec} ${v.width}x${v.height} @ ${v.fps} fps (expected ${sb.video.width}x${sb.video.height} @ ${fps})` : 'no video stream');
  add('specs', 'audio stream', a && a.codec === 'aac' && a.sampleRate === 48000 ? 'pass' : 'fail', a ? `${a.codec} ${a.sampleRate} Hz ${a.layout}` : 'no audio stream');
  add('specs', 'duration', Math.abs((info.duration || 0) - sb.video.duration) <= 2 / fps ? 'pass' : 'warn', `${info.duration?.toFixed(3)} s (storyboard ${sb.video.duration.toFixed(3)} s)`);

  // ---- frames ----
  const W = 90, H = Math.round((W * sb.video.height) / sb.video.width / 2) * 2;
  const { frames } = decodeFrames(video, { w: W, h: H });
  const n = frames.length;
  const luma = new Float64Array(n), diff = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    let s = 0, d = 0;
    for (let p = 0; p < f.length; p += 4) {
      s += 0.2126 * f[p] + 0.7152 * f[p + 1] + 0.0722 * f[p + 2];
      if (i) { const g = frames[i - 1]; d += Math.abs(f[p] - g[p]) + Math.abs(f[p + 1] - g[p + 1]) + Math.abs(f[p + 2] - g[p + 2]); }
    }
    luma[i] = s / (f.length / 4) / 255;
    diff[i] = i ? d / ((f.length / 4) * 3) : 0;
  }
  add('frames', 'frame count', Math.abs(n - sb.video.frames) <= 1 ? 'pass' : 'warn', `${n} decoded (storyboard ${sb.video.frames})`);
  const planned = new Set();
  for (const s of sb.shots) {
    const f0 = Math.round(s.start * fps), half = Math.ceil((s.transitionIn?.frames || 0) / 2) + 1;
    for (let f = f0 - half; f <= f0 + half; f++) planned.add(f);
  }
  // expression changes pop on purpose (style squash), gestures start on purpose
  const sq = (style.motion?.squashFrames || 2) + 2;
  for (const e of sb.events) if (e.type === 'expression' || e.type === 'gesture' || e.type === 'punch' || e.type === 'shake' || e.type === 'prop' || e.type === 'posture') {
    const f0 = Math.round(e.t * fps);
    for (let f = f0 - 1; f <= f0 + sq + Math.round((e.dur || 0) * fps * (e.type === 'prop' ? 1 : 0)); f++) planned.add(f);
  }
  // a planned fade to black: black frames from its start to the end are intended
  const fadeOut = sb.events.find((e) => e.type === 'fade' && e.value === 'out');
  const fadeFrom = fadeOut ? Math.round(fadeOut.t * fps) : Infinity;
  for (const e of sb.events) if (e.type === 'fade') for (let f = Math.round(e.t * fps) - 1; f <= Math.round((e.t + (e.dur || 1)) * fps) + 1; f++) planned.add(f);
  for (const it of sb.captions?.items || []) for (const t of [it.start, it.end]) { const f = Math.round(t * fps); for (let k = f - 1; k <= f + 1; k++) planned.add(k); }
  const black = [], white = [], pops = [];
  for (let i = 0; i < n; i++) {
    if (luma[i] < 0.04 && i < fadeFrom) black.push(i);
    if (luma[i] > 0.94 && !planned.has(i)) white.push(i);
  }
  for (let i = 1; i < n; i++) {
    const win = [];
    for (let k = Math.max(1, i - 8); k <= Math.min(n - 1, i + 8); k++) if (k !== i) win.push(diff[k]);
    win.sort((x, y) => x - y);
    const med = win[Math.floor(win.length / 2)] || 0;
    if (diff[i] > Math.max(10, 4 * med + 3) && !planned.has(i)) pops.push(i);
  }
  const frozen = [];
  let runStart = null;
  for (let i = 1; i <= n; i++) {
    const still = i < n && diff[i] < 0.02 && i < fadeFrom;
    if (still && runStart === null) runStart = i;
    if (!still && runStart !== null) { if (i - runStart >= 12) frozen.push([runStart, i - 1]); runStart = null; }
  }
  add('frames', 'black frames', black.length ? 'fail' : 'pass', black.length ? fmtRanges(ranges(black), fps) : (fadeOut ? `none before the planned fade to black at ${fadeOut.t.toFixed(2)} s` : 'none'));
  add('frames', 'white frames', white.length ? 'warn' : 'pass', white.length ? fmtRanges(ranges(white), fps) : 'none');
  add('frames', 'frozen spans >= 12 f', frozen.length ? 'fail' : 'pass', frozen.length ? fmtRanges(frozen, fps) : 'none (every hold moves)');
  add('frames', 'unplanned pops', pops.length ? 'warn' : 'pass', pops.length ? `${fmtRanges(ranges(pops), fps)} — look at these frames in the sheets` : 'none');
  const motionShare = diff.filter((d) => d < 0.3).length / Math.max(1, n);

  // ---- audio ----
  const L = measureLoudness(video);
  const target = cfg.mix.lufs;
  add('audio', 'loudness', L.I !== null && Math.abs(L.I - target) <= 1 ? 'pass' : 'fail', `${L.I} LUFS integrated (target ${target} ±1), LRA ${L.LRA} LU`);
  add('audio', 'true peak', L.TP !== null && L.TP <= -1.0 ? 'pass' : 'fail', `${L.TP} dBTP (limit -1.0)`);
  const sil = ffmpegSync(['-nostats', '-i', video, '-map', '0:a:0', '-af', 'silencedetect=n=-50dB:d=2', '-f', 'null', '-']).stderr;
  const longSil = (sil.match(/silence_duration: [\d.]+/g) || []).length;
  add('audio', 'long silences', longSil ? 'warn' : 'pass', longSil ? `${longSil} silence(s) longer than 2 s` : 'none');

  // ---- sync ----
  if (sb.audio?.voice && sb.lines.length) {
    // The storyboard is timed to build/voice.wav by construction (align). What can still drift is the
    // finished file: compare its audio with that voice track around every line (10 ms envelopes,
    // cross-correlation inside ±0.6 s windows, so music beds and sound effects elsewhere do not matter).
    const pcm = decodeAudio(video, { sr: 8000 });
    const voicePath = path.join(files.dir, sb.audio.voice);
    const vpcm = exists(voicePath) ? decodeAudio(voicePath, { sr: 8000 }) : null;
    const env = (x) => { const h = 80, n = Math.floor(x.length / h), e = new Float64Array(n); for (let i = 0; i < n; i++) { let q = 0; for (let k = 0; k < h; k++) { const v = x[i * h + k] || 0; q += v * v; } e[i] = Math.sqrt(q / h); } return e; };
    if (vpcm) {
      const A = env(pcm), B = env(vpcm), mask = new Uint8Array(A.length);
      for (const l of sb.lines) for (let i = Math.max(0, Math.round((l.start - 0.6) * 100)); i < Math.min(A.length, Math.round((l.end + 0.6) * 100)); i++) mask[i] = 1;
      let best = -Infinity, bestLag = 0;
      for (let lag = -50; lag <= 50; lag++) {
        let sum = 0;
        for (let i = 0; i < A.length; i++) { const j = i - lag; if (mask[i] && j >= 0 && j < B.length) sum += A[i] * B[j]; }
        if (sum > best) { best = sum; bestLag = lag; }
      }
      const frames = (bestLag / 100) * fps;
      add('sync', 'speech vs storyboard', Math.abs(frames) <= 1 ? 'pass' : Math.abs(frames) <= 2 ? 'warn' : 'fail',
        Math.abs(frames) < 0.05 ? 'final audio matches the timed voice track exactly (0 frames)' : `final audio is ${Math.abs(frames).toFixed(1)} frame(s) ${frames > 0 ? 'late' : 'early'} against the timed voice track`);
    } else add('sync', 'speech vs storyboard', 'warn', `${sb.audio.voice} not found — cannot compare`);
    const aDur = pcm.length / 8000;
    add('sync', 'audio vs video length', Math.abs(aDur - n / fps) <= 1.5 / fps ? 'pass' : 'warn', `audio ${aDur.toFixed(3)} s, video ${(n / fps).toFixed(3)} s`);
  } else add('sync', 'speech vs storyboard', 'info', sb.meta.estimatedTiming ? 'no voice: timing was ESTIMATED from text length' : 'no voice track');

  // ---- layout (geometry from the engine; no pixels involved) ----
  const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
  for (const f of style.fonts) GlobalFonts.registerFromPath(f.path, f.family);
  const { createEnv, frameLayout } = await import('../engine/render.mjs');
  const env = createEnv(sb, style, { createCanvas });
  const mctx = createCanvas(8, 8).getContext('2d');
  const capOut = [], capFace = [], faceCut = [], capIssues = new Set();
  const m = 0.04;
  for (let f = 0; f < sb.video.frames; f++) {
    const t = f / fps, Lf = frameLayout(env, t, mctx);
    if (Lf.caption) {
      const b = Lf.caption.box;
      if (b.x < sb.video.width * m || b.y < sb.video.height * m || b.x + b.w > sb.video.width * (1 - m) || b.y + b.h > sb.video.height * (1 - m)) capOut.push(f);
      for (const i of Lf.caption.issues) { capIssues.add(i); if (i.includes('face')) capFace.push(f); }
    }
    const speaker = sb.lines.find((l) => t >= l.start && t <= l.end)?.speaker;
    const shot = Lf.shot;
    if (speaker && shot.type !== 'insert' && shot.subjects.includes(speaker)) {
      const face = Lf.faces.find((x) => x.id === speaker);
      if (!face || face.cut > 0.1) faceCut.push(f);
    }
  }
  add('layout', 'captions in safe area', capOut.length ? 'fail' : 'pass', capOut.length ? fmtRanges(ranges(capOut), fps) : `${sb.captions.mode} captions stay inside the 4 % margin`);
  add('layout', 'captions off faces', capFace.length ? 'warn' : 'pass', capFace.length ? fmtRanges(ranges(capFace), fps) : 'no caption covers a face');
  add('layout', 'speaker face in frame', faceCut.length ? 'fail' : 'pass', faceCut.length ? `${fmtRanges(ranges(faceCut), fps)} — the speaker's face is cut by the frame edge` : 'speaker faces are never cut while talking');
  for (const i of capIssues) if (!i.includes('face')) add('layout', 'caption fit', 'warn', i);

  // ---- rhythm ----
  const lint = lintStoryboard(sb, style, cfg);
  add('rhythm', 'storyboard lint', lint.warnings.length ? 'warn' : 'pass', lint.warnings.length ? `${lint.warnings.length} warning(s): ${lint.warnings.slice(0, 4).join(' · ')}` : `${lint.stats.shots} shots, avg ${lint.stats.avgShot.toFixed(2)} s, speaker on screen ${(lint.stats.speakerOnScreen * 100).toFixed(0)} %`);

  // ---- sheets ----
  const sheets = await videoSheets(video, path.join(qaDir, 'sheets'), { every: +(args.every || 10), labelFn: (f, t) => `f${f} ${t.toFixed(2)}s ${sb.shots.find((s) => t >= s.start && t < s.end)?.id || ''}` });
  const mids = sb.shots.map((s) => Math.min(n - 1, Math.round(((s.start + s.end) / 2) * fps)));
  const big = decodeFrames(video, { w: 216, h: Math.round((216 * sb.video.height) / sb.video.width / 2) * 2 });
  const shotSheet = await makeSheet(mids.map((f, i) => ({ rgba: big.frames[f], w: big.w, h: big.h, label: `${sb.shots[i].id} ${sb.shots[i].type} ${sb.shots[i].focus || ''} f${f}` })), path.join(qaDir, 'shots.png'), { cols: Math.min(6, mids.length), thumbW: 216, title: 'one frame per shot (middle)' });

  // ---- disk ----
  const disk = { build: dirSize(files.build), out: dirSize(files.out) };

  const fails = checks.filter((x) => x.status === 'fail').length, warns = checks.filter((x) => x.status === 'warn').length;
  const verdict = fails ? 'FAIL' : warns ? 'PASS with warnings' : 'PASS';
  const report = { video: rel(video, files.dir), verdict, checks, stats: { frames: n, heldFrameShare: round(motionShare, 3), loudness: L, lint: lint.stats }, sheets: sheets.map((s) => rel(s, files.dir)), shotSheet: rel(shotSheet, files.dir), disk };
  writeJSON(path.join(qaDir, 'report.json'), report);
  const md = [
    `# QA report — ${sb.meta.title}`, '',
    `Video: \`${report.video}\` · verdict: **${verdict}** · ${fails} fail, ${warns} warn`, '',
    '| group | check | result | detail |', '|---|---|---|---|',
    ...checks.map((x) => `| ${x.group} | ${x.name} | ${x.status.toUpperCase()} | ${String(x.detail).replace(/\|/g, '/')} |`), '',
    '## Look at these images', '',
    `- One frame per shot: \`${report.shotSheet}\``,
    ...report.sheets.map((s) => `- Contact sheet: \`${s}\``), '',
    '## Manual checklist (any model or person; see SKILL.md step 9)', '',
    '- [ ] Text readable at phone size, nothing cut off', '- [ ] No face cut by the frame edge, no caption over a face',
    '- [ ] Mouth moves only while that character speaks', '- [ ] Every cut feels motivated (speaker change, reaction, cutaway); no two identical shots in a row',
    '- [ ] Reactions start just before the word they react to', '- [ ] Music never covers the voice; ending does not clip', '',
    `Disk: build/ ${humanBytes(disk.build)}, out/ ${humanBytes(disk.out)}. \`da clean\` removes build/tmp; \`da clean --all\` removes build/.`, '',
  ].join('\n');
  writeText(path.join(qaDir, 'report.md'), md);
  return { report, qaDir, files };
}

export async function cli(args) {
  log.step('qa');
  const { report, qaDir } = await run(args._[0] || '.', args);
  const icon = { pass: c.green('✔'), fail: c.red('✖'), warn: c.yellow('!'), info: c.blue('•') };
  for (const x of report.checks) console.log(`  ${icon[x.status]} ${x.group.padEnd(7)} ${x.name.padEnd(24)} ${x.detail}`);
  console.log(`\n  verdict: ${report.verdict === 'PASS' ? c.green(report.verdict) : report.verdict.startsWith('PASS') ? c.yellow(report.verdict) : c.red(report.verdict)}`);
  log.ok(`report ${rel(path.join(qaDir, 'report.md'))}, sheets in ${rel(path.join(qaDir, 'sheets'))}, ${rel(path.join(qaDir, 'shots.png'))}`);
  return report.verdict === 'FAIL' ? 1 : 0;
}
