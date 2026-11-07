// Locate ffmpeg/ffprobe and wrap the few calls the pipeline needs.
// ffprobe is optional on purpose: some installs (e.g. the imageio-ffmpeg Python wheel) ship ffmpeg only.
// Durations therefore come from decoded sample counts, never from ffprobe.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './util.mjs';

let cached = null;

function works(bin) {
  if (!bin) return false;
  const r = spawnSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

function siblingProbe(ffmpeg) {
  const dir = path.dirname(ffmpeg);
  const ext = process.platform === 'win32' ? '.exe' : '';
  const cand = path.join(dir, `ffprobe${ext}`);
  return fs.existsSync(cand) && works(cand) ? cand : null;
}

/** Returns { ffmpeg, ffprobe, source } or { ffmpeg: null, tried: [...] }. */
export function findFfmpeg({ refresh = false } = {}) {
  if (cached && !refresh) return cached;
  const tried = [];
  const result = (ffmpeg, source) => {
    const ffprobe = process.env.FFPROBE_PATH && works(process.env.FFPROBE_PATH)
      ? process.env.FFPROBE_PATH
      : (works('ffprobe') ? 'ffprobe' : siblingProbe(ffmpeg));
    cached = { ffmpeg, ffprobe, source };
    return cached;
  };
  // 1. explicit env var
  if (process.env.FFMPEG_PATH) {
    tried.push(`FFMPEG_PATH=${process.env.FFMPEG_PATH}`);
    if (works(process.env.FFMPEG_PATH)) return result(process.env.FFMPEG_PATH, 'FFMPEG_PATH');
  }
  // 2. PATH
  tried.push('ffmpeg on PATH');
  if (works('ffmpeg')) return result('ffmpeg', 'PATH');
  // 3. optional npm package ffmpeg-static (not a dependency; used if the user installed it)
  try {
    const req = createRequire(path.join(ROOT, 'package.json'));
    const p = req('ffmpeg-static');
    tried.push('npm ffmpeg-static');
    if (p && works(p)) return result(p, 'ffmpeg-static');
  } catch { tried.push('npm ffmpeg-static (not installed)'); }
  // 4. Python imageio-ffmpeg wheel
  for (const py of ['python', 'python3', 'py']) {
    const r = spawnSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0) {
      const p = r.stdout.trim();
      tried.push(`${py} imageio-ffmpeg`);
      if (works(p)) return result(p, 'imageio-ffmpeg');
    }
  }
  tried.push('python imageio-ffmpeg (not installed)');
  cached = { ffmpeg: null, ffprobe: null, source: null, tried };
  return cached;
}

export function requireFfmpeg() {
  const f = findFfmpeg();
  if (!f.ffmpeg) throw new Error('ffmpeg not found. Run `da doctor` for install instructions, or set FFMPEG_PATH.');
  return f.ffmpeg;
}

/** Run ffmpeg synchronously. Returns { code, stdout (Buffer), stderr (string) }. */
export function ffmpegSync(args, { input } = {}) {
  const bin = requireFfmpeg();
  const r = spawnSync(bin, ['-hide_banner', ...args], { input, maxBuffer: 2 ** 32, windowsHide: true });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr ? r.stderr.toString('utf8') : '' };
}

export function ffmpegOrThrow(args, opts) {
  const r = ffmpegSync(args, opts);
  if (r.code !== 0) throw new Error(`ffmpeg failed (${r.code}): ffmpeg ${args.join(' ')}\n${r.stderr.split('\n').slice(-12).join('\n')}`);
  return r;
}

/** Spawn ffmpeg as a child process with stdin open (used for frame piping). */
export function ffmpegSpawn(args) {
  const bin = requireFfmpeg();
  return spawn(bin, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
}

/** Decode any audio file to mono (or N-channel) float32 PCM at `sr`. Exact length, no ffprobe. */
export function decodeAudio(file, { sr = 48000, channels = 1 } = {}) {
  const r = ffmpegOrThrow(['-v', 'error', '-i', file, '-vn', '-ac', String(channels), '-ar', String(sr), '-f', 'f32le', '-']);
  const buf = r.stdout;
  const out = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  return Float32Array.from(out); // copy into an aligned, owned buffer
}

/** Parse `ffmpeg -i` banner: duration, video size/fps, audio rate/channels, codecs. */
export function mediaInfo(file) {
  const r = ffmpegSync(['-i', file]);
  const s = r.stderr;
  const info = { duration: null, video: null, audio: null, raw: s };
  const d = s.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (d) info.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];
  const v = s.match(/Stream #\S+.*?Video:\s*([^\s,]+)[^\n]*?(\d{2,5})x(\d{2,5})[^\n]*?(?:(\d+(?:\.\d+)?) fps|(\d+(?:\.\d+)?) tbr)/);
  if (v) info.video = { codec: v[1], width: +v[2], height: +v[3], fps: +(v[4] || v[5]) };
  const a = s.match(/Stream #\S+.*?Audio:\s*([^\s,]+)[^\n]*?(\d+) Hz,\s*([^,]+)/);
  if (a) info.audio = { codec: a[1], sampleRate: +a[2], layout: a[3].trim() };
  return info;
}

export function ffmpegCapabilities() {
  const filters = ffmpegSync(['-filters']).stdout.toString('utf8');
  const encoders = ffmpegSync(['-encoders']).stdout.toString('utf8');
  const has = (txt, name) => new RegExp(`\\s${name}\\s`).test(txt);
  const version = (ffmpegSync(['-version']).stdout.toString('utf8').match(/ffmpeg version (\S+)/) || [])[1] || 'unknown';
  return {
    version,
    filters: Object.fromEntries(['loudnorm', 'sidechaincompress', 'ebur128', 'amix', 'aformat', 'afade', 'apad', 'atrim'].map((f) => [f, has(filters, f)])),
    encoders: Object.fromEntries(['libx264', 'aac'].map((e) => [e, has(encoders, e)])),
  };
}

/** Integrated loudness / LRA / true peak of a file via ebur128. */
export function measureLoudness(file) {
  const r = ffmpegSync(['-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re) => { const m = tail.match(re); return m ? +m[1] : null; };
  return { I: num(/I:\s*(-?[\d.]+) LUFS/), LRA: num(/LRA:\s*(-?[\d.]+) LU/), TP: num(/Peak:\s*(-?[\d.]+|-inf) dBFS/) };
}
