// Shot/scene transitions. u goes 0 -> 1 across the window centred on the cut.
// drawA / drawB paint the outgoing / incoming shot (each with its own camera) onto ctx.
import { ease, rand, clamp } from './math.mjs';
import { rgba } from './color.mjs';
import { tracePoly } from './shapes.mjs';

export const TRANSITIONS = {
  cut(ctx, env, u, A, B) { (u < 0.5 ? A : B)(); },

  dissolve(ctx, env, u, A, B) {
    A();
    ctx.save(); ctx.globalAlpha = ease.smooth(u); B(); ctx.restore();
  },

  // the next scene arrives on a new sheet of paper with a torn diagonal edge and a cast shadow
  'paper-slide'(ctx, env, u, A, B) {
    const W = env.W, H = env.H, e = ease.inOutCubic(u);
    A();
    const ex = W * 1.25 - (W * 1.5) * e, slope = W * 0.22;
    const pts = [[ex, -20]];
    for (let i = 1; i < 16; i++) { const q = i / 16; pts.push([ex - slope * q + (rand(i, 91) - 0.5) * W * 0.022, -20 + (H + 40) * q]); }
    pts.push([ex - slope, H + 20], [W * 3, H + 20], [W * 3, -20]);
    const sh = env.style.shadow || {};
    ctx.save(); ctx.translate(-(sh.offsetX || 6) * 2.2, 0); tracePoly(ctx, pts); ctx.fillStyle = rgba(env.color(sh.color || 'ink'), 0.3); ctx.fill(); ctx.restore();
    ctx.save(); tracePoly(ctx, pts); ctx.clip(); B(); ctx.restore();
  },

  // fast horizontal pan between the two shots with a few motion-blur samples
  whip(ctx, env, u, A, B) {
    const W = env.W, N = 4;
    for (let s = 0; s < N; s++) {
      const e = ease.inOutCubic(clamp(u - s * 0.035));
      ctx.save();
      ctx.globalAlpha = 1 / (s + 1);
      if (e < 0.5) { ctx.translate(-W * e * 2 * 0.9, 0); A(); }
      else { ctx.translate(W * (1 - e) * 2 * 0.9, 0); B(); }
      ctx.restore();
    }
  },

  // circle closes on the old shot, opens on the new one
  iris(ctx, env, u, A, B) {
    const W = env.W, H = env.H, first = u < 0.5;
    (first ? A : B)();
    const R = Math.hypot(W, H) * 0.6;
    const r = Math.max(0.5, first ? R * (1 - ease.inOutCubic(u * 2)) : R * ease.inOutCubic(u * 2 - 1));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H * 0.42, r, 0, Math.PI * 2);
    ctx.fillStyle = env.color('ink'); ctx.fill('evenodd');
    ctx.lineWidth = 16 * (W / 1080); ctx.strokeStyle = env.color('accent1');
    ctx.beginPath(); ctx.arc(W / 2, H * 0.42, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },

  // a band of ink sweeps across; the new shot is revealed behind it
  'ink-wipe'(ctx, env, u, A, B) {
    const W = env.W, H = env.H, x0 = -W * 0.5 + W * 2 * ease.inOutCubic(u), half = W * 0.2;
    const edge = (off, ph) => { const a = []; for (let y = -40; y <= H + 40; y += H / 24) a.push([x0 + off + Math.sin(y * 0.011 + ph) * W * 0.03, y]); return a; };
    const left = edge(-half, 1), right = edge(half, 2);
    A();
    ctx.save(); tracePoly(ctx, [[-50, -40], ...left, [-50, H + 40]]); ctx.clip(); B(); ctx.restore();
    const band = [...left, ...right.reverse()];
    const [mx, my] = env.style.texture?.misregisterPx || [12, 8];
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.translate(mx * 1.5, my * 1.5); tracePoly(ctx, band); ctx.fillStyle = env.color('accent3'); ctx.fill(); ctx.restore();
    tracePoly(ctx, band); ctx.fillStyle = env.color('ink'); ctx.fill();
  },
};

export function drawTransition(ctx, env, type, u, A, B) {
  const fn = env.hooks?.transitions?.[type] || TRANSITIONS[type] || TRANSITIONS.dissolve;
  fn(ctx, env, clamp(u), A, B);
}
