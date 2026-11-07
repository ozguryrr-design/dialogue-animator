// Style pack tools: list, new (copy), check (schema + measurable style-guide limits), preview, palette.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { log, rel, readJSON, writeJSON, writeText, ensureDir, exists, c, ROOT } from '../lib/util.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { contrast } from '../engine/color.mjs';
import { missingGlyphs, TURKISH_TEST } from '../lib/fontcheck.mjs';
import { listStyles, loadStyle, resolveStyleDir, paletteColors, STYLES_DIR } from './load.mjs';

export function checkStyle(style) {
  const out = [];
  const add = (status, name, detail) => out.push({ status, name, detail });
  const lim = style.limits || {};
  const roles = style.palette.roles, col = (k) => (k && k[0] === '#' ? k : roles[k]);
  const n = paletteColors(style).length;
  add(lim.maxColors && n > lim.maxColors ? 'fail' : 'pass', 'colour count', `${n} colours (limit ${lim.maxColors ?? 'none'}), plus ${style.palette.skin.length} skin tones`);
  const minC = lim.minTextContrast ?? 4.5;
  for (const mode of ['word', 'line', 'bubble']) {
    const cap = style.captions[mode];
    if (!cap) continue;
    const fg = col(cap.fill || 'paper');
    const bg = cap.bg ? col(cap.bg) : cap.stroke ? col(cap.strokeColor || 'ink') : roles.paper;
    const ratio = contrast(fg, bg);
    add(ratio >= minC ? 'pass' : 'fail', `caption contrast (${mode})`, `${ratio.toFixed(2)}:1 ${fg} on ${bg} (min ${minC}:1)`);
  }
  if (style.line && style.line.mode !== 'none') add((style.line.width || 0) >= (lim.minLinePx ?? 3) ? 'pass' : 'fail', 'line width', `${style.line.width} px at 1080 wide (min ${lim.minLinePx ?? 3})`);
  const cam = style.camera;
  add(cam.pushPerFrame > 0 && cam.pushPerFrame <= 0.004 ? 'pass' : 'warn', 'push-in', `${(cam.pushPerFrame * 100).toFixed(2)} %/frame (guide: 0.05–0.4 %)`);
  add(cam.maxPanPxPerFrame <= 60 ? 'pass' : 'warn', 'pan speed limit', `${cam.maxPanPxPerFrame} px/frame (guide: <= 60)`);
  const cf = style.motion.characterFps;
  add(30 % cf === 0 || 60 % cf === 0 ? 'pass' : 'warn', 'character frame rate', `${cf} fps (divides 30/60 evenly: ${30 % cf === 0 || 60 % cf === 0})`);
  const miss = missingGlyphs(TURKISH_TEST, style.fonts.map((f) => f.path));
  add(miss.length ? 'fail' : 'pass', 'Turkish glyphs', miss.length ? `missing ${miss.join(' ')}` : `${TURKISH_TEST} covered`);
  return out;
}

const PREVIEW_DIALOGUE = `# Style preview

## Kitchen
Ada: Good morning! Is the tea ready? [happy]
Bo: (shrugs) Almost... but we are out of sugar.
Ada: What?! No sugar at all?

## Park
Bo: Relax. I brought cake! [smug]
Ada: (cheers) You are the best!
`;

export async function previewStyle(idOrPath, { out, projectDir } = {}) {
  const style = loadStyle(idOrPath, projectDir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-style-'));
  writeText(path.join(tmp, 'dialogue.md'), PREVIEW_DIALOGUE);
  writeJSON(path.join(tmp, 'project.json'), { style: style.dir, captions: 'word', voice: 'none', music: 'none' });
  const { run } = await import('../render/stills.mjs');
  const target = out || path.join(style.dir, 'preview');
  const res = await run(tmp, { _: [tmp], scale: 0.4, out: target, shots: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

export async function cli(args) {
  const sub = args.command === 'styles' ? 'list' : args._[0];
  if (!sub || sub === 'list') {
    log.step('style packs');
    for (const s of listStyles()) log.info(`${c.bold(s.id.padEnd(12))} ${s.family?.padEnd(6) || ''} ${s.name}  ${c.dim(rel(s.dir, ROOT))}`);
    log.info(c.dim('use one with --style <id> or "style": "<id>" in project.json; make your own with `da style new <id> --from kesik-kagit`'));
    return 0;
  }
  if (sub === 'new') {
    const id = args._[1];
    if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('Usage: da style new <id> --from <pack> [--project <dir>]  (id: lowercase letters, digits, dashes)');
    const fromDir = resolveStyleDir(args.from || 'kesik-kagit', args.project);
    const destRoot = args.project ? path.join(path.resolve(args.project), 'styles') : STYLES_DIR;
    const dest = path.join(destRoot, id);
    if (exists(dest)) throw new Error(`${rel(dest)} already exists`);
    ensureDir(dest);
    for (const f of fs.readdirSync(fromDir)) if (f !== 'preview') fs.cpSync(path.join(fromDir, f), path.join(dest, f), { recursive: true });
    const s = readJSON(path.join(dest, 'style.json'));
    s.id = id; s.name = args.name || `${id} (from ${s.id})`; s.version = '0.1.0';
    s.fonts = s.fonts.map((f) => ({ ...f, file: path.relative(dest, path.resolve(fromDir, f.file)).split(path.sep).join('/') }));
    if (s.$schema) s.$schema = path.relative(dest, path.join(ROOT, 'schemas', 'style-pack.schema.json')).split(path.sep).join('/');
    writeJSON(path.join(dest, 'style.json'), s);
    log.ok(`created ${rel(dest)} — edit style.json, then: da style check ${id}${args.project ? ` --project ${args.project}` : ''} && da style preview ${id}`);
    return 0;
  }
  if (sub === 'check') {
    const target = args._[1] || 'kesik-kagit';
    log.step(`style check ${target}`);
    const dir = resolveStyleDir(target, args.project);
    const raw = readJSON(path.join(dir, 'style.json'));
    const { valid, errors } = validate(raw, loadSchema('style-pack'));
    if (!valid) { for (const e of errors) log.err(e); return 1; }
    const style = loadStyle(dir);
    const res = checkStyle(style);
    const icon = { pass: c.green('✔'), fail: c.red('✖'), warn: c.yellow('!') };
    for (const r of res) console.log(`  ${icon[r.status]} ${r.name.padEnd(26)} ${r.detail}`);
    return res.some((r) => r.status === 'fail') ? 1 : 0;
  }
  if (sub === 'preview') {
    const target = args._[1] || 'kesik-kagit';
    log.step(`style preview ${target}`);
    const res = await previewStyle(target, { out: args.out ? path.resolve(args.out) : undefined, projectDir: args.project });
    log.ok(`${res.written.length} stills + ${rel(res.sheet)}`);
    return 0;
  }
  if (sub === 'palette') {
    const img = args._[1];
    if (!img) throw new Error('Usage: da style palette <image>');
    const { colorsFromImage } = await import('../project/cast.mjs');
    const cols = await colorsFromImage(path.resolve(img));
    log.step('dominant colours');
    for (const x of cols) log.info(`${x.hex}  ${(x.share * 100).toFixed(1)} %`);
    return 0;
  }
  throw new Error(`Unknown style sub-command "${sub}" (list | new | check | preview | palette)`);
}
