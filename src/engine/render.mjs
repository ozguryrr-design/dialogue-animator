// renderFrame(ctx, env, t): the only entry point a renderer adapter needs.
// Pure: the pixels depend only on (storyboard, style, t). Works with any Canvas2D context
// (@napi-rs/canvas in Node, HTMLCanvasElement in a browser / Playwright).
import { hash32, rand } from './math.mjs';
import { drawShapes } from './materials.mjs';
import { cameraAt, applyView, toScreen } from './camera.mjs';
import { characterState, postureAt } from './state.mjs';
import { positionAt, alphaAt } from './motion.mjs';
import { drawBackground, drawForeground, halftonePattern } from './background.mjs';
import { drawFx } from './fx.mjs';
import { captionLayout, drawCaption } from './captions.mjs';
import { drawTransition } from './transitions.mjs';

export { createEnv } from './env.mjs';

export function shotIndexAt(sb, t) {
  const s = sb.shots;
  for (let i = 0; i < s.length; i++) if (t < s[i].end) return i;
  return s.length - 1;
}

function boilSeed(env, t) {
  const bf = env.style.edge?.boilFrames || env.style.line?.boilFrames || 0;
  return bf ? Math.floor((t * env.fps) / bf + 1e-6) * 101 : 0;
}

const metricsCache = new WeakMap();
export function metricsOf(env, ch) {
  let m = metricsCache.get(ch);
  if (!m) { m = env.body.metrics(ch, env.style); metricsCache.set(ch, m); }
  return m;
}

function drawCharacter(ctx, env, ch, scene, t, seed) {
  const alpha = alphaAt(env, ch, scene, t);
  if (alpha <= 0) return;
  const x = positionAt(env, ch, scene, t).x;
  const st = characterState(env, ch, scene, t);
  const { items } = env.body.build(ch, st, env);
  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, (st.postureY || 0) + (st.bob || 0));
  if (env.style.family === 'gummy') {
    const m = metricsOf(env, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, 4, m.halfW * 0.9, 20, 0, 0, Math.PI * 2); ctx.fill();
  } else if (env.style.texture?.type === 'halftone') {
    const m = metricsOf(env, ch);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = halftonePattern(ctx, env, env.style.texture.pitchPx || 14, 0.28);
    ctx.beginPath(); ctx.ellipse(0, 6, m.halfW * 0.85, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (st.sway) ctx.rotate(st.sway);
  if (st.squash) ctx.scale(1 - st.squash * 0.6, 1 + st.squash);
  drawShapes(ctx, items, env, seed + hash32(ch.id));
  ctx.restore();
}

export function drawShot(ctx, env, k, t) {
  const shot = env.sb.shots[k];
  const scene = env.scenes[shot.scene];
  const cam = cameraAt(env, shot, t);
  const seed = boilSeed(env, t);
  ctx.save();
  applyView(ctx, env, cam);
  drawBackground(ctx, env, scene, cam, seed, t);
  // automatic inserts show the object alone; everything else shows the cast (focus drawn last, in front)
  const order = shot.type === 'insert' && !shot.withCast ? [] : [...scene.cast].sort((a, b) => (a === shot.focus) - (b === shot.focus));
  for (const id of order) drawCharacter(ctx, env, env.chars[id], scene, t, seed);
  drawForeground(ctx, env, scene, seed, t, cam);
  if (shot.type !== 'insert') {
    const visible = new Set(facesInShot(env, k, t).filter((f) => f.visible && f.cut < 0.2).map((f) => f.id));
    drawFx(ctx, env, scene, t, seed, (ch) => metricsOf(env, ch), visible);
  }
  ctx.restore();
  return cam;
}

/** Screen-space head circles of every character in the shot, plus how much of each is outside the frame. */
export function facesInShot(env, k, t) {
  const shot = env.sb.shots[k], scene = env.scenes[shot.scene];
  const cam = cameraAt(env, shot, t), s = env.H / cam.h;
  return scene.cast.map((id) => {
    const ch = env.chars[id], m = metricsOf(env, ch);
    const py = postureAt(env, ch, scene, t, m.H).y;
    const [cx, cy] = toScreen(env, cam, positionAt(env, ch, scene, t).x, (m.faceY ?? m.headCY) + py);
    const r = (m.faceR ?? m.headR) * s;
    const outX = Math.max(0, r - cx, cx + r - env.W), outY = Math.max(0, r - cy, cy + r - env.H);
    return { id, cx, cy, r, cut: Math.min(1, Math.max(outX, outY) / (2 * r)), visible: alphaAt(env, ch, scene, t) > 0 && cx + r > 0 && cx - r < env.W && cy + r > 0 && cy - r < env.H };
  });
}

let measureCtx = null;
function measurer(env) {
  if (!measureCtx) measureCtx = env.createCanvas(8, 8).getContext('2d');
  return measureCtx;
}

/** Layout of everything checkable at time t (used by the renderer and by QA). */
export function frameLayout(env, t, ctxForMeasure) {
  const k = shotIndexAt(env.sb, t);
  const faces = facesInShot(env, k, t).filter((f) => f.visible);
  const speaker = env.sb.lines.find((l) => t >= l.start - 0.15 && t <= l.end + 0.35)?.speaker;
  const head = faces.find((f) => f.id === speaker && f.cut < 0.25) || null;
  const caption = captionLayout(env, t, ctxForMeasure || measurer(env), faces, head);
  return { shot: env.sb.shots[k], shotIndex: k, faces, caption };
}

function paperGrain(ctx, env) {
  const tx = env.style.texture;
  if (!tx || tx.type !== 'paper-grain' || !tx.amount) return;
  if (!env.cache.grain) {
    const px = tx.grainPx || 6, w = Math.ceil(env.W / px), h = Math.ceil(env.H / px);
    const c = env.createCanvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 96 + Math.floor(rand(i, 17) * 64);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    env.cache.grain = c;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, tx.amount * 4);
  ctx.drawImage(env.cache.grain, 0, 0, env.W, env.H);
  ctx.restore();
}

export function renderFrame(ctx, env, t) {
  const sb = env.sb, shots = sb.shots;
  ctx.save();
  ctx.fillStyle = env.color('paper');
  ctx.fillRect(0, 0, env.W, env.H);
  const i = shotIndexAt(sb, t);
  let done = false;
  for (const k of [i, i + 1]) {
    if (k <= 0 || k >= shots.length) continue;
    const T = shots[k].transitionIn;
    if (!T || T.type === 'cut' || !T.frames) continue;
    const half = T.frames / env.fps / 2, c = shots[k].start;
    if (t >= c - half && t < c + half) {
      drawTransition(ctx, env, T.type, (t - (c - half)) / (2 * half), () => drawShot(ctx, env, k - 1, t), () => drawShot(ctx, env, k, t));
      done = true;
      break;
    }
  }
  if (!done) drawShot(ctx, env, i, t);
  if (env.hooks?.beforeCaptions) env.hooks.beforeCaptions(ctx, env, t);
  const L = frameLayout(env, t);
  drawCaption(ctx, env, L.caption, t);
  paperGrain(ctx, env);
  // fades: 'out' goes to black and stays black; 'in' comes up from black
  for (const e of env.idx.fade) {
    if (t < e.t) continue;
    const u = Math.min(1, (t - e.t) / (e.dur || 1));
    const a = e.value === 'in' ? 1 - u : u;
    if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = e.color || '#000000'; ctx.fillRect(0, 0, env.W, env.H); ctx.restore();
  }
  if (env.hooks?.afterFrame) env.hooks.afterFrame(ctx, env, t);
  ctx.restore();
}
