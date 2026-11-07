// `da render <dir>`: storyboard -> build/video.mp4 (picture only; `da mix` adds the sound).
// Frames are piped as raw RGBA straight into ffmpeg — no frame folders on disk. With --workers N the
// frame range is split into N chunks rendered in parallel (worker threads), each encoded to a temporary
// segment in build/tmp/, then joined losslessly with the concat demuxer; build/tmp/ is deleted afterwards.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { log, rel, ensureDir, humanBytes, exists } from '../lib/util.mjs';
import { ffmpegSpawn, ffmpegOrThrow } from '../lib/ffmpeg.mjs';
import { loadProject, openAdapter, rmrf } from './common.mjs';

export function encoderArgs({ width, height, fps, crf = 18, preset = 'medium', out }) {
  return [
    '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-tune', 'animation',
    '-g', String(Math.round(fps * 2)), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out,
  ];
}

/** Render frames [f0, f1) of a storyboard into one mp4 (used in-process and by workers). */
export async function renderRange({ sb, style, scale, f0, f1, out, crf, preset, renderer, onProgress, projectDir }) {
  const r = await openAdapter(renderer, sb, style, { scale, projectDir });
  const ff = ffmpegSpawn(encoderArgs({ width: r.width, height: r.height, fps: sb.video.fps, crf, preset, out }));
  let err = '';
  ff.stderr.on('data', (d) => { err += d.toString(); });
  const closed = new Promise((res) => ff.on('close', res));
  const write = (buf) => new Promise((res, rej) => {
    if (ff.stdin.destroyed) return rej(new Error(`ffmpeg exited early: ${err.slice(-400)}`));
    ff.stdin.write(buf, (e) => (e ? rej(e) : res()));
  });
  try {
    for (let f = f0; f < f1; f++) {
      await write(await r.frameRGBA(f / sb.video.fps));
      if (onProgress) onProgress(f - f0 + 1);
    }
  } finally {
    ff.stdin.end();
    await r.close();
  }
  const code = await closed;
  if (code !== 0) throw new Error(`ffmpeg encoding failed (${code}): ${err.slice(-600)}`);
  return out;
}

export async function run(dir, args = {}) {
  const { cfg, files, sb, style, sbPath } = await loadProject(dir, args);
  const fps = sb.video.fps, total = sb.video.frames;
  const f0 = args.from !== undefined ? Math.max(0, Math.round(+args.from * fps)) : 0;
  const f1 = args.to !== undefined ? Math.min(total, Math.round(+args.to * fps)) : total;
  const scale = +(args.scale || 1);
  const crf = +(args.crf || cfg.quality.crf), preset = args.preset || cfg.quality.preset;
  const out = path.resolve(args.out || path.join(files.build, 'video.mp4'));
  const tmp = ensureDir(path.join(files.build, 'tmp'));
  const n = f1 - f0;
  const workers = Math.max(1, Math.min(+(args.workers || Math.min(4, Math.max(1, os.cpus().length - 1))), Math.ceil(n / 60)));
  const t0 = Date.now();
  let done = 0, lastPrint = 0;
  const tick = (k = 1) => {
    done += k;
    const now = Date.now();
    if (now - lastPrint > 1000 || done === n) {
      lastPrint = now;
      const fpsR = done / ((now - t0) / 1000);
      process.stdout.write(`\r  frames ${done}/${n}  ${fpsR.toFixed(1)} fps  ETA ${Math.max(0, (n - done) / Math.max(0.1, fpsR)).toFixed(0)} s   `);
    }
  };
  if (workers === 1 || args.renderer === 'playwright') {
    await renderRange({ sb, style, scale, f0, f1, out, crf, preset, renderer: args.renderer, projectDir: files.dir, onProgress: () => tick() });
  } else {
    const chunk = Math.ceil(n / workers), segs = [];
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
      if (a >= b) continue;
      const seg = path.join(tmp, `seg_${String(w).padStart(2, '0')}.mp4`);
      segs.push(seg);
      jobs.push(new Promise((res, rej) => {
        const wk = new Worker(fileURLToPath(new URL('./worker.mjs', import.meta.url)), { workerData: { sbPath, styleId: style.dir, projectDir: files.dir, scale, f0: a, f1: b, out: seg, crf, preset } });
        wk.on('message', (m) => { if (m.progress) tick(m.progress); });
        wk.on('error', rej);
        wk.on('exit', (code) => (code === 0 ? res() : rej(new Error(`render worker ${w} exited with code ${code}`))));
      }));
    }
    await Promise.all(jobs);
    const list = path.join(tmp, 'concat.txt');
    fs.writeFileSync(list, segs.map((s) => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    ffmpegOrThrow(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  }
  process.stdout.write('\n');
  const tmpSize = exists(tmp) ? fs.readdirSync(tmp).reduce((s, f) => s + fs.statSync(path.join(tmp, f)).size, 0) : 0;
  if (!args.keepTmp) rmrf(tmp);
  const secs = (Date.now() - t0) / 1000;
  return { out, frames: n, secs, workers, size: fs.statSync(out).size, tmpSize, files };
}

export async function cli(args) {
  log.step('render');
  const r = await run(args._[0] || '.', args);
  log.ok(`${r.frames} frames in ${r.secs.toFixed(1)} s (${(r.frames / r.secs).toFixed(1)} fps, ${r.workers} worker${r.workers > 1 ? 's' : ''}) -> ${rel(r.out)} (${humanBytes(r.size)})`);
  if (r.tmpSize) log.info(`temporary segments (${humanBytes(r.tmpSize)}) were ${args.keepTmp ? 'kept in build/tmp' : 'deleted'}`);
  return 0;
}
