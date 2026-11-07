// `da stills <dir>`: render chosen frames to PNG for a quick look (no video, no ffmpeg needed).
//   --t 1.5,4.2   seconds        --frames 45,120   frame numbers        --shots   middle of every shot
//   --scale 0.5   draft size     --out <folder>    default build/stills
import path from 'node:path';
import fs from 'node:fs';
import { log, rel, ensureDir } from '../lib/util.mjs';
import { loadProject, openAdapter } from './common.mjs';
import { makeSheet } from '../qa/sheet.mjs';

export function pickTimes(sb, args) {
  const fps = sb.video.fps;
  if (args.t) return String(args.t).split(',').map(Number).filter((x) => x >= 0 && x <= sb.video.duration);
  if (args.frames) return String(args.frames).split(',').map((f) => +f / fps);
  if (args.shots || true) return sb.shots.map((s) => Math.floor(((s.start + s.end) / 2) * fps) / fps);
  return [];
}

export async function run(dir, args = {}) {
  const { sb, style, files } = await loadProject(dir, args);
  const scale = +(args.scale || 0.5);
  const outDir = ensureDir(path.resolve(args.out || path.join(files.build, 'stills')));
  for (const f of fs.readdirSync(outDir)) if (/^f\d+.*\.png$/.test(f)) fs.rmSync(path.join(outDir, f));
  const r = await openAdapter(args.renderer, sb, style, { scale, projectDir: files.dir });
  const times = pickTimes(sb, args);
  const written = [];
  for (const t of times) {
    const f = Math.round(t * sb.video.fps);
    const shot = sb.shots.find((s) => t >= s.start && t < s.end) || sb.shots[sb.shots.length - 1];
    const file = path.join(outDir, `f${String(f).padStart(5, '0')}_${shot.id}.png`);
    fs.writeFileSync(file, await r.png(t));
    written.push({ file, t, f, shot: shot.id, label: `${shot.id} ${shot.type} f${f} ${t.toFixed(2)}s` });
  }
  await r.close();
  let sheet = null;
  if (written.length > 1) sheet = await makeSheet(written.map((w) => ({ file: w.file, label: w.label })), path.join(outDir, 'sheet.png'), { cols: Math.min(6, written.length), thumbW: 240 });
  return { written, sheet, outDir };
}

export async function cli(args) {
  log.step('stills');
  const { written, sheet, outDir } = await run(args._[0] || '.', args);
  log.ok(`${written.length} still(s) in ${rel(outDir)}${sheet ? `, contact sheet ${rel(sheet)}` : ''}`);
  return 0;
}
