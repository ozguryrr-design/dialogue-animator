// Dependency-free WAV reader/writer (PCM 16/24/32-bit int and 32-bit float).
import fs from 'node:fs';
import path from 'node:path';

export function writeWav(file, channels, sampleRate = 48000) {
  // channels: Float32Array (mono) or array of Float32Array (one per channel)
  const ch = Array.isArray(channels) ? channels : [channels];
  const n = ch[0].length, nc = ch.length;
  const buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nc * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i] || 0));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

/** Returns { sampleRate, channels: Float32Array[] } or throws for unsupported encodings. */
export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a RIFF/WAVE file`);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(off + 8), nc: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    else if (id === 'data') { data = { start: off + 8, size: Math.min(size, b.length - off - 8) }; }
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: missing fmt or data chunk`);
  const { format, nc, sr, bits } = fmt;
  const bytes = bits / 8, frames = Math.floor(data.size / (bytes * nc));
  const out = Array.from({ length: nc }, () => new Float32Array(frames));
  const isFloat = format === 3 || (format === 0xfffe && bits === 32 && guessFloat(b, data, nc));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nc; c++) {
      const p = data.start + (i * nc + c) * bytes;
      let v;
      if (bits === 16) v = b.readInt16LE(p) / 32768;
      else if (bits === 24) v = b.readIntLE(p, 3) / 8388608;
      else if (bits === 32) v = isFloat ? b.readFloatLE(p) : b.readInt32LE(p) / 2147483648;
      else if (bits === 8) v = (b[p] - 128) / 128;
      else throw new Error(`${file}: unsupported bit depth ${bits}`);
      out[c][i] = v;
    }
  }
  return { sampleRate: sr, channels: out };
}

function guessFloat(b, data, nc) {
  // WAVE_FORMAT_EXTENSIBLE 32-bit: assume float if sample magnitudes look like floats in [-1, 1]
  const n = Math.min(64, Math.floor(data.size / 4));
  for (let i = 0; i < n; i++) { const f = b.readFloatLE(data.start + i * 4); if (!Number.isFinite(f) || Math.abs(f) > 8) return false; }
  return true;
}

export function mixToMono(channels) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}
