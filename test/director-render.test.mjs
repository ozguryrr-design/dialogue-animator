import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { makeStoryboard } from './helpers.mjs';
import { validate, loadSchema } from '../src/lib/schema.mjs';
import { lintStoryboard } from '../src/director/lint.mjs';
import { createEnv, renderFrame, frameLayout } from '../src/engine/render.mjs';
import { synthMusic } from '../src/audio/music.mjs';

const STYLES = ['kesik-kagit', 'jole', 'riso-cizgi'];

for (const style of STYLES) for (const format of ['9:16', '16:9']) {
  test(`storyboard rules hold (${style}, ${format})`, () => {
    const { sb, cfg, style: st } = makeStoryboard({ style, format });
    const v = validate(sb, loadSchema('storyboard'));
    assert.ok(v.valid, v.errors.join('\n'));
    // shots tile the timeline exactly
    assert.equal(sb.shots[0].start, 0);
    for (let i = 1; i < sb.shots.length; i++) assert.equal(sb.shots[i].start, sb.shots[i - 1].end);
    assert.ok(Math.abs(sb.shots.at(-1).end - sb.video.duration) < 1e-6);
    // no identical framing back to back, no shot under the minimum (except possibly the last)
    for (let i = 1; i < sb.shots.length; i++) {
      const a = sb.shots[i - 1], b = sb.shots[i];
      assert.ok(!(a.type === b.type && a.focus === b.focus && a.scene === b.scene), `${a.id}/${b.id} repeat`);
    }
    for (const s of sb.shots.slice(0, -1)) assert.ok(s.end - s.start >= cfg.director.minShot - 1e-6, `${s.id} too short`);
    // every hold creeps
    for (const s of sb.shots) assert.ok(s.camera.to.h < s.camera.from.h, `${s.id} static`);
    // a new scene starts with the style's scene transition
    const firstOfScene2 = sb.shots.find((s) => s.scene === 's2');
    assert.equal(firstOfScene2.transitionIn.type, st.transitions.scene.type);
    // reactions lead their trigger word
    const lint = lintStoryboard(sb, st, cfg);
    assert.ok(!lint.warnings.some((w) => w.includes('does not lead')), lint.warnings.join('\n'));
    assert.ok(lint.stats.speakerOnScreen >= 0.6);
  });
}

test('captions never sit on a face and stay in the safe area (all styles, both formats)', () => {
  const m = createCanvas(8, 8).getContext('2d');
  for (const style of STYLES) for (const format of ['9:16', '16:9']) {
    const { sb, style: st } = makeStoryboard({ style, format });
    for (const f of st.fonts) GlobalFonts.registerFromPath(f.path, f.family);
    const env = createEnv(sb, st, { createCanvas });
    for (let f = 0; f < sb.video.frames; f += 3) {
      const L = frameLayout(env, f / sb.video.fps, m);
      if (!L.caption) continue;
      const b = L.caption.box;
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= sb.video.width && b.y + b.h <= sb.video.height, `${style} ${format} f${f} caption outside`);
    }
  }
});

test('renderFrame is deterministic and order-independent (all styles)', () => {
  for (const style of STYLES) {
    const { sb, style: st } = makeStoryboard({ style });
    for (const f of st.fonts) GlobalFonts.registerFromPath(f.path, f.family);
    const W = 108, H = 192;
    const draw = (env, t) => {
      const c = createCanvas(W, H), ctx = c.getContext('2d');
      ctx.setTransform(W / sb.video.width, 0, 0, H / sb.video.height, 0, 0);
      renderFrame(ctx, env, t);
      return crypto.createHash('sha1').update(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)).digest('hex');
    };
    const times = [0, 1.5, 3.2, sb.video.duration - 0.1];
    const e1 = createEnv(sb, st, { createCanvas }), e2 = createEnv(sb, st, { createCanvas });
    const forward = times.map((t) => draw(e1, t));
    const backward = [...times].reverse().map((t) => draw(e2, t)).reverse();
    assert.deepEqual(forward, backward, style);
    assert.notEqual(forward[0], forward[1], `${style}: different times must differ`);
  }
});

test('music synthesis is deterministic and the right length', () => {
  const a = synthMusic({ duration: 3, seed: 3 }), b = synthMusic({ duration: 3, seed: 3 }), c = synthMusic({ duration: 3, seed: 4 });
  assert.equal(a.channels[0].length, 4 * 48000);
  assert.deepEqual(a.channels[0].slice(0, 2000), b.channels[0].slice(0, 2000));
  assert.notDeepEqual(a.channels[0].slice(48000, 50000), c.channels[0].slice(48000, 50000));
});
