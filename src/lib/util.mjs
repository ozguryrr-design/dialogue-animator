// Small shared helpers: paths, JSON IO, argument parsing and a tiny logger.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

export const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
export const ensureDir = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

export function readJSON(p, fallback) {
  if (!exists(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`File not found: ${p}`);
  }
  const txt = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  try { return JSON.parse(txt); } catch (e) { throw new Error(`Invalid JSON in ${p}: ${e.message}`); }
}

export function writeJSON(p, obj, { compact = false } = {}) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, (compact ? JSON.stringify(obj) : JSON.stringify(obj, null, 2)) + '\n', 'utf8');
  return p;
}

export function readText(p) { return fs.readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n'); }

export function writeText(p, txt) { ensureDir(path.dirname(p)); fs.writeFileSync(p, txt, 'utf8'); return p; }

/** Project-relative display path with forward slashes (stable in reports on every OS). */
export function rel(p, base = process.cwd()) {
  const r = path.relative(base, p) || '.';
  return r.split(path.sep).join('/');
}

/** Minimal argv parser: positional args in `_`, `--key value`, `--key=value`, `--flag`. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { out[camel(a.slice(2, eq))] = a.slice(eq + 1); continue; }
      const key = camel(a.slice(2));
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = { red: paint(31), green: paint(32), yellow: paint(33), blue: paint(34), dim: paint(2), bold: paint(1) };

const warnings = [];
export const log = {
  step: (m) => console.log(c.bold(`\n▸ ${m}`)),
  info: (m) => console.log(`  ${m}`),
  ok: (m) => console.log(`  ${c.green('✔')} ${m}`),
  warn: (m) => { warnings.push(m); console.log(`  ${c.yellow('!')} ${m}`); },
  err: (m) => console.error(`  ${c.red('✖')} ${m}`),
  warnings: () => warnings.slice(),
};

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function humanBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function dirSize(p) {
  if (!exists(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  let n = 0;
  for (const e of fs.readdirSync(p)) n += dirSize(path.join(p, e));
  return n;
}

export const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
