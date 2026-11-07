// Contact sheets: a grid of labelled thumbnails, from image files or from a video (decoded with ffmpeg).
import path from 'node:path';
import fs from 'node:fs';
import { log, rel, ensureDir } from '../lib/util.mjs';
import { ffmpegOrThrow, mediaInfo } from '../lib/ffmpeg.mjs';

/** items: [{file?, rgba?, w?, h?, label}] -> PNG at `out`. */
export async function makeSheet(items, out, { cols = 6, thumbW = 216, title = null } = {}) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const imgs = [];
  for (const it of items) {
    if (it.file) imgs.push({ img: await loadImage(fs.readFileSync(it.file)), label: it.label });
    else {
      const c = createCanvas(it.w, it.h); const g = c.getContext('2d');
      const id = g.createImageData(it.w, it.h); id.data.set(it.rgba); g.putImageData(id, 0, 0);
      imgs.push({ img: c, label: it.label });
    }
  }
  if (!imgs.length) return null;
  const ar = imgs[0].img.height / imgs[0].img.width;
  const tw = thumbW, th = Math.round(tw * ar), lab = 22, gap = 6, head = title ? 34 : 0;
  const rows = Math.ceil(imgs.length / cols);
  const W = cols * (tw + gap) + gap, H = head + rows * (th + lab + gap) + gap;
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, W, H);
  if (title) { g.fillStyle = '#fff'; g.font = '600 18px sans-serif'; g.fillText(title, gap + 2, 23); }
  imgs.forEach((it, i) => {
    const x = gap + (i % cols) * (tw + gap), y = head + gap + Math.floor(i / cols) * (th + lab + gap);
    g.drawImage(it.img, x, y, tw, th);
    g.fillStyle = '#000'; g.fillRect(x, y + th, tw, lab);
    g.fillStyle = '#ffd400'; g.font = '13px sans-serif'; g.fillText(String(it.label || '').slice(0, 42), x + 4, y + th + 15);
  });
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, await c.encode('png'));
  return out;
}

/** Decode a video at small size; returns { frames: Buffer[], w, h, fps }. */
export function decodeFrames(video, { w = 90, h = 160, everyN = 1 } = {}) {
  const info = mediaInfo(video);
  const vf = [`scale=${w}:${h}:flags=area`];
  if (everyN > 1) vf.unshift(`select=not(mod(n\\,${everyN}))`);
  const r = ffmpegOrThrow(['-v', 'error', '-i', video, '-vf', vf.join(','), ...(everyN > 1 ? ['-vsync', 'vfr'] : []), '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  const size = w * h * 4, frames = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) frames.push(r.stdout.subarray(o, o + size));
  return { frames, w, h, fps: info.video?.fps || 30, info };
}

/** Sheets of a whole video: one thumbnail every `every` frames, `perSheet` per image. */
export async function videoSheets(video, outDir, { every = 10, perSheet = 40, cols = 8, labelFn = null } = {}) {
  const info = mediaInfo(video);
  const ar = info.video ? info.video.height / info.video.width : 16 / 9;
  const w = 180, h = Math.round((w * ar) / 2) * 2;
  const { frames, fps } = decodeFrames(video, { w, h, everyN: every });
  const out = [];
  for (let s = 0; s * perSheet < frames.length; s++) {
    const chunk = frames.slice(s * perSheet, (s + 1) * perSheet).map((buf, i) => {
      const f = (s * perSheet + i) * every;
      return { rgba: buf, w, h, label: labelFn ? labelFn(f, f / fps) : `f${f} ${(f / fps).toFixed(2)}s` };
    });
    out.push(await makeSheet(chunk, path.join(outDir, `sheet_${String(s + 1).padStart(2, '0')}.png`), { cols, thumbW: w, title: `${path.basename(video)} — every ${every} frames` }));
  }
  return out;
}

export async function cli(args) {
  const video = args._[0];
  if (!video) throw new Error('Usage: da sheet <video.mp4> [--every 10] [--out folder]');
  log.step('sheet');
  const outDir = path.resolve(args.out || path.join(path.dirname(video), 'sheets'));
  const files = await videoSheets(path.resolve(video), outDir, { every: +(args.every || 10) });
  log.ok(`${files.length} sheet(s) in ${rel(outDir)}`);
  return 0;
}
