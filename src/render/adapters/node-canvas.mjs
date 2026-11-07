// Default renderer adapter: @napi-rs/canvas (Skia) in Node — no browser needed.
// Adapter contract (see docs/RENDERERS.md): open(sb, style, opts) -> { width, height, frameRGBA(t), png(t), close() }.
import { pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { createEnv, renderFrame } from '../../engine/render.mjs';

const registered = new Set();
export function registerFonts(style) {
  for (const f of style.fonts) {
    const key = `${f.family}|${f.path}`;
    if (registered.has(key)) continue;
    GlobalFonts.registerFromPath(f.path, f.family);
    registered.add(key);
  }
}

export async function loadHooks(style) {
  if (!style.hookPath) return null;
  const mod = await import(pathToFileURL(style.hookPath).href);
  return mod.default || mod;
}

export async function open(sb, style, { scale = 1 } = {}) {
  registerFonts(style);
  const hooks = await loadHooks(style);
  const width = Math.max(2, Math.round((sb.video.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((sb.video.height * scale) / 2) * 2);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const env = createEnv(sb, style, { createCanvas, hooks });
  const draw = (t) => {
    ctx.setTransform(width / sb.video.width, 0, 0, height / sb.video.height, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    renderFrame(ctx, env, t);
  };
  return {
    name: 'node-canvas',
    width,
    height,
    env,
    frameRGBA(t) { draw(t); return Buffer.from(ctx.getImageData(0, 0, width, height).data.buffer); },
    async png(t) { draw(t); return canvas.encode('png'); },
    async close() {},
  };
}
