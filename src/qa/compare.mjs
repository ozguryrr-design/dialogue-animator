// `da compare --a a.png,b.png --b c.png,d.png --out cmp.png [--labels before,after]`
// Side-by-side review sheet: row A over row B, same height. Use it for before/after a fix, or to put
// your frames next to a style pack's reference stills (styles/<id>/preview/).
import path from 'node:path';
import fs from 'node:fs';
import { log, rel, ensureDir } from '../lib/util.mjs';

export async function compare(rowA, rowB, out, { h = 640, labels = ['A', 'B'] } = {}) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const load = async (list) => Promise.all(list.map(async (f) => ({ f, img: await loadImage(fs.readFileSync(f)) })));
  const rows = [await load(rowA), await load(rowB)].filter((r) => r.length);
  const widthOf = (r) => r.reduce((s, x) => s + Math.round((x.img.width * h) / x.img.height) + 8, 0);
  const W = Math.max(...rows.map(widthOf)) + 90, H = rows.length * (h + 30) + 10;
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, W, H);
  rows.forEach((r, ri) => {
    const y = 10 + ri * (h + 30);
    g.fillStyle = '#ffd400'; g.font = '600 22px sans-serif'; g.fillText(labels[ri] || '', 10, y + 30);
    let x = 90;
    for (const it of r) {
      const w = Math.round((it.img.width * h) / it.img.height);
      g.drawImage(it.img, x, y, w, h);
      g.fillStyle = '#ccc'; g.font = '13px sans-serif'; g.fillText(path.basename(it.f).slice(0, 40), x, y + h + 18);
      x += w + 8;
    }
  });
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, await c.encode('png'));
  return out;
}

export async function cli(args) {
  const a = String(args.a || '').split(',').filter(Boolean), b = String(args.b || '').split(',').filter(Boolean);
  if (!a.length) throw new Error('Usage: da compare --a a.png,b.png --b c.png,d.png --out cmp.png [--labels before,after]');
  log.step('compare');
  const out = await compare(a, b, path.resolve(args.out || 'compare.png'), { h: +(args.h || 640), labels: String(args.labels || 'A,B').split(',') });
  log.ok(`wrote ${rel(out)}`);
  return 0;
}
