// Load a style pack (styles/<id>/style.json or any folder with a style.json), resolve its fonts and
// return a plain object the engine can use. The engine never reads files itself.
import path from 'node:path';
import fs from 'node:fs';
import { ROOT, readJSON, exists, isDir } from '../lib/util.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';

export const STYLES_DIR = path.join(ROOT, 'styles');

export function listStyles(extraDirs = []) {
  const dirs = [STYLES_DIR, ...extraDirs].filter(isDir);
  const out = [];
  for (const d of dirs) {
    for (const e of fs.readdirSync(d)) {
      const f = path.join(d, e, 'style.json');
      if (exists(f)) {
        try { const s = readJSON(f); out.push({ id: s.id, name: s.name, family: s.family, dir: path.join(d, e), description: s.description }); }
        catch (err) { out.push({ id: e, name: `(invalid: ${err.message})`, dir: path.join(d, e) }); }
      }
    }
  }
  return out;
}

/** Find a style by id or path. Project-local packs (project/styles/<id>) win over built-in ones. */
export function resolveStyleDir(idOrPath, projectDir) {
  const cands = [];
  if (idOrPath && (idOrPath.includes('/') || idOrPath.includes('\\') || idOrPath.startsWith('.'))) {
    cands.push(path.resolve(projectDir || process.cwd(), idOrPath));
  }
  if (projectDir) cands.push(path.join(projectDir, 'styles', idOrPath));
  cands.push(path.join(STYLES_DIR, idOrPath));
  for (const c of cands) if (exists(path.join(c, 'style.json'))) return c;
  const known = listStyles().map((s) => s.id).join(', ');
  throw new Error(`Style "${idOrPath}" not found. Known styles: ${known}. Use a pack id or a folder containing style.json.`);
}

export function loadStyle(idOrPath = 'kesik-kagit', projectDir) {
  const dir = resolveStyleDir(idOrPath, projectDir);
  const style = readJSON(path.join(dir, 'style.json'));
  const { valid, errors } = validate(style, loadSchema('style-pack'));
  if (!valid) throw new Error(`Style pack ${dir} is invalid:\n${errors.slice(0, 12).map((e) => '  - ' + e).join('\n')}`);
  style.dir = dir;
  style.fonts = (style.fonts || []).map((f) => ({ ...f, path: path.resolve(dir, f.file) }));
  for (const f of style.fonts) if (!exists(f.path)) throw new Error(`Style ${style.id}: font file missing: ${f.path}`);
  const hook = path.join(dir, 'style.mjs');
  style.hookPath = exists(hook) ? hook : null;
  return style;
}

/** Every colour the pack can paint with (roles + character colours), skin tones excluded. */
export function paletteColors(style) {
  const set = new Set([...Object.values(style.palette.roles), ...style.palette.characterColors].map((c) => c.toUpperCase()));
  return [...set];
}
