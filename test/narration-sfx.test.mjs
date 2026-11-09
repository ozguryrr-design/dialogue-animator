import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { parseDialogueText } from '../src/project/parse.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSfx, renderSfx } from '../src/audio/sfx.mjs';
import { readWav } from '../src/lib/wav.mjs';
import { mapAudioToLines } from '../src/audio/align.mjs';
import { validate, loadSchema } from '../src/lib/schema.mjs';
import { createEnv, frameLayout, renderFrame } from '../src/engine/render.mjs';
import { makeStoryboard } from './helpers.mjs';

test('narration: built-in names, @narrator, (dış ses), @cast', () => {
  const d = parseDialogueText('@narrator Hikayeci\n## Park\n@cast Ali\nAnlatıcı: Bir varmış.\nHikayeci: Bir yokmuş.\nNarrator: Once.\nAli (dış ses): İçimden geçti.\nAli: Selam!\nSu (V.O.): Duydum.\nSu: Selam.\n');
  assert.deepEqual(d.lines.map((l) => l.voiceOver), [true, true, true, true, false, true, false]);
  assert.deepEqual(d.speakers.filter((s) => s.narrator).map((s) => s.id), ['anlatici', 'hikayeci', 'narrator']);
  assert.deepEqual(d.scenes[0].cast, ['ali']);
  assert.equal(d.lines[3].speaker, 'ali');
  assert.deepEqual(d.warnings, []);
});

test('sfx cues: name, time, gain, position', () => {
  const d = parseDialogueText('Ali: Bir.\n@sfx gök gürültüsü\nSu: İki.\n@sfx gong 12.5 -3dB\n@efekt kapi 1:05\n');
  assert.deepEqual(d.sfx.map((c) => [c.name, c.at, c.gainDb, c.nextLine]), [['gök gürültüsü', null, 0, 'l02'], ['gong', 12.5, -3, null], ['kapi', 65, 0, null]]);
});

test('sfx names: user file first, Turkish aliases, built-ins, unknown', () => {
  const files = ['/p/sfx/Gök-Gürültüsü.wav', '/p/sfx/kapi.mp3'];
  assert.deepEqual(resolveSfx('gök gürültüsü', files), { file: files[0] });
  assert.deepEqual(resolveSfx('door', files), { file: files[1] }, 'a file replaces the built-in of that name');
  assert.deepEqual(resolveSfx('sürgü', []), { builtin: 'bolt' });
  assert.equal(resolveSfx('yok', files), null);
});

test('sfx gain still counts when it is the only cue', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-sfx-'));
  const peakAt = (gainDb) => {
    const sb = { meta: { seed: 1 }, video: { duration: 1 }, events: [{ t: 0.1, type: 'sfx', value: 'knock', gainDb }] };
    return readWav(renderSfx(sb, dir)).channels[0].reduce((p, v) => Math.max(p, Math.abs(v)), 0);
  };
  assert.ok(Math.abs(peakAt(-6) / peakAt(0) - 0.501) < 0.02);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('audio files without a number are reported, not silently dropped', () => {
  const lines = [1, 2].map((i) => ({ id: `l0${i}`, index: i, speaker: 'ali', speakerName: 'Ali' }));
  const notes = [];
  const m = mapAudioToLines(lines, ['/a/01_ali.wav', '/a/fazla.wav', '/a/ozel.wav'], notes);
  assert.equal(m.get('l01'), '/a/01_ali.wav');
  assert.equal(notes.filter((n) => n.includes('was not used')).length, 2);
});

const NARRATED = `# Anlatım
## Park
Anlatıcı: Çok uzun zaman önce, bu parkta kimsenin bilmediği bir ağaç vardı ve herkes yanından geçip giderdi, çünkü kimse durup bakmazdı.
@sfx knock
## Mutfak
Anlatıcı: Ali o sabah çok erken uyandı.
Ali: Günaydın!
Su: Günaydın, çay var.
Ali (dış ses): Keşke kahve olsaydı.
Anlatıcı: Ama kahve yoktu.
`;

for (const style of ['kesik-kagit', 'jole', 'riso-cizgi']) for (const captions of ['word', 'line', 'bubble']) {
  test(`narration storyboard (${style}, ${captions}): empty stage works, narrators never act`, () => {
    const { sb, style: st } = makeStoryboard({ text: NARRATED, style, captions });
    const v = validate(sb, loadSchema('storyboard'));
    assert.ok(v.valid, v.errors.join('\n'));
    assert.deepEqual(sb.characters.map((c) => c.id), ['ali', 'su']);
    assert.deepEqual(sb.scenes[0].cast, [], 'nobody on stage in the narrated scene');
    assert.equal(sb.shots[0].start, 0);
    for (let i = 1; i < sb.shots.length; i++) assert.equal(sb.shots[i].start, sb.shots[i - 1].end);
    for (const s of sb.shots) for (const k of ['x', 'y', 'h']) assert.ok(Number.isFinite(s.camera.from[k]) && Number.isFinite(s.camera.to[k]), `${s.id} ${k}`);
    assert.ok(sb.shots.filter((s) => s.scene === 's1').some((s) => s.type === 'insert'), 'long narration looks around the set');
    assert.ok(!sb.events.some((e) => e.target === 'anlatici'), 'the narrator has no events');
    // Ali's off-screen line: his mouth stays closed
    const L = sb.lines.find((l) => l.voiceOver && l.speaker === 'ali');
    for (let f = Math.ceil(L.start * 30); f < Math.floor(L.end * 30); f++) assert.equal(sb.tracks.mouth.ali[f], 0);
    // every frame can be laid out and drawn, and narration always has a caption
    const env = createEnv(sb, st, { createCanvas });
    const c = createCanvas(54, 96), ctx = c.getContext('2d'), m = createCanvas(8, 8).getContext('2d');
    ctx.setTransform(54 / sb.video.width, 0, 0, 96 / sb.video.height, 0, 0);
    for (const l of sb.lines.filter((x) => x.voiceOver)) {
      const t = (l.start + l.end) / 2;
      assert.ok(frameLayout(env, t, m).caption, `${l.id}: narration needs a caption`);
      renderFrame(ctx, env, t);
    }
  });
}

test('a one-character monologue starts its first shot at zero', () => {
  const { sb } = makeStoryboard({ text: 'Ali: Merhaba, bugün size bir şey anlatacağım.\nAli: Dinliyor musunuz?\n' });
  assert.equal(sb.shots[0].start, 0);
});
