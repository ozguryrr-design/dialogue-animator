import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { missingGlyphs, TURKISH_TEST } from '../src/lib/fontcheck.mjs';
import { validate, loadSchema } from '../src/lib/schema.mjs';
import { listStyles, loadStyle } from '../src/style/load.mjs';
import { checkStyle } from '../src/style/cli.mjs';
import { alignSequences, estimateWords, mapAudioToLines } from '../src/audio/align.mjs';
import { ROOT } from '../src/lib/util.mjs';

test('every shipped style draws Turkish (ğ ş ı İ ö ü ç â î û)', () => {
  for (const s of listStyles()) {
    const st = loadStyle(s.id);
    assert.deepEqual(missingGlyphs(TURKISH_TEST, st.fonts.map((f) => f.path)), [], s.id);
  }
});

test('font check finds missing scripts', () => {
  const baloo = path.join(ROOT, 'fonts', 'baloo2', 'Baloo2-VF.ttf');
  assert.deepEqual(missingGlyphs('Merhaba dünya', [baloo]), []);
  assert.ok(missingGlyphs('こんにちは', [baloo]).length > 0);
});

test('shipped style packs pass their own limits', () => {
  for (const s of listStyles()) {
    const res = checkStyle(loadStyle(s.id));
    assert.deepEqual(res.filter((r) => r.status === 'fail'), [], s.id);
  }
});

test('project.json schema accepts good and rejects bad answers', () => {
  const sch = loadSchema('project');
  assert.ok(validate({ style: 'jole', format: '16:9', captions: 'line', music: { mode: 'synth', mood: 'playful' } }, sch).valid);
  const bad = validate({ format: '3:2', captions: 'subtitles', fps: 31 }, sch);
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 3);
});

test('sequence alignment tolerates spelling and extra words', () => {
  const map = alignSequences(['Good', 'morning!', 'Did', 'you', 'bring', 'the', 'cake?'], ['good', 'mornin', 'uh', 'did', 'you', 'bring', 'cake']);
  assert.equal(map[0], 0); assert.equal(map[1], 1); assert.equal(map[2], 3); assert.equal(map[6], 6); assert.equal(map[5], -1);
});

test('estimated words are ordered and inside the line', () => {
  const ws = estimateWords(['Merhaba,', 'nasılsın', 'bugün?'], 1, 3);
  assert.equal(ws[0].s, 1);
  for (let i = 1; i < ws.length; i++) assert.ok(ws[i].s >= ws[i - 1].e - 1e-9 && ws[i].s > ws[i - 1].s);
  assert.ok(ws[2].e <= 3 + 1e-9);
});

test('audio files map to lines by their number', () => {
  const lines = [1, 2, 3].map((i) => ({ id: `l0${i}`, index: i, speaker: i % 2 ? 'ali' : 'su', speakerName: i % 2 ? 'Ali' : 'Su' }));
  const notes = [];
  const m = mapAudioToLines(lines, ['/a/03_ali.wav', '/a/01_ali.wav', '/a/02_su.wav'], notes);
  assert.equal(m.get('l01'), '/a/01_ali.wav');
  assert.equal(m.get('l03'), '/a/03_ali.wav');
  assert.equal(notes.length, 0);
  const m0 = mapAudioToLines(lines, ['/a/00_ali.wav', '/a/01_su.wav', '/a/02_ali.wav'], notes);
  assert.equal(m0.get('l01'), '/a/00_ali.wav');
  mapAudioToLines(lines, ['/a/01_bob.wav', '/a/02_su.wav', '/a/03_ali.wav'], notes);
  assert.equal(notes.length, 1); // name mismatch is reported
});
