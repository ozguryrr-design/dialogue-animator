// Read the cmap table of a TTF/OTF file to know exactly which characters a font can draw.
// Used by `doctor` and `parse` so missing glyphs (e.g. Turkish ğ/ş/ı or CJK) are reported before rendering.
import fs from 'node:fs';

const cache = new Map();

export function fontCodepoints(file) {
  if (cache.has(file)) return cache.get(file);
  const b = fs.readFileSync(file);
  const numTables = b.readUInt16BE(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (b.toString('ascii', rec, rec + 4) === 'cmap') cmapOff = b.readUInt32BE(rec + 8);
  }
  if (cmapOff < 0) throw new Error(`${file}: no cmap table`);
  const set = new Set();
  const n = b.readUInt16BE(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const rec = cmapOff + 4 + i * 8;
    const platform = b.readUInt16BE(rec), encoding = b.readUInt16BE(rec + 2);
    const sub = cmapOff + b.readUInt32BE(rec + 4);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = b.readUInt16BE(sub);
    if (format === 4) readFormat4(b, sub, set);
    else if (format === 12) readFormat12(b, sub, set);
  }
  cache.set(file, set);
  return set;
}

function readFormat4(b, off, set) {
  const segX2 = b.readUInt16BE(off + 6), seg = segX2 / 2;
  const endO = off + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  for (let s = 0; s < seg; s++) {
    const end = b.readUInt16BE(endO + s * 2), start = b.readUInt16BE(startO + s * 2);
    const delta = b.readInt16BE(deltaO + s * 2), rangeOff = b.readUInt16BE(rangeO + s * 2);
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      let gid;
      if (rangeOff === 0) gid = (cp + delta) & 0xffff;
      else {
        const p = rangeO + s * 2 + rangeOff + (cp - start) * 2;
        gid = p + 1 < b.length ? b.readUInt16BE(p) : 0;
        if (gid) gid = (gid + delta) & 0xffff;
      }
      if (gid) set.add(cp);
    }
  }
}

function readFormat12(b, off, set) {
  const groups = b.readUInt32BE(off + 12);
  for (let g = 0; g < groups; g++) {
    const p = off + 16 + g * 12;
    const start = b.readUInt32BE(p), end = b.readUInt32BE(p + 4), gid = b.readUInt32BE(p + 8);
    for (let cp = start; cp <= end; cp++) if (gid + (cp - start)) set.add(cp);
  }
}

/** Characters of `text` that none of the font files can draw (whitespace and controls ignored). */
export function missingGlyphs(text, files) {
  const sets = files.map(fontCodepoints);
  const missing = new Set();
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x21 || (cp >= 0x7f && cp < 0xa0) || /\s/.test(ch) || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x200d) continue;
    if (!sets.some((s) => s.has(cp))) missing.add(ch);
  }
  return [...missing];
}

export const TURKISH_TEST = 'ğĞşŞıİöÖüÜçÇâÂîÎûÛ';
