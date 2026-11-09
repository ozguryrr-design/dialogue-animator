// Timed scripts: beats, actions, placement into windows, silent-beat coverage, sound effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDialogueText } from '../src/project/parse.mjs';
import { placeInBeats, clipsFromWords } from '../src/audio/align.mjs';
import { SFX, renderSfx } from '../src/audio/sfx.mjs';
import { rng } from '../src/engine/math.mjs';
import { makeStoryboard } from './helpers.mjs';
import { validate, loadSchema } from '../src/lib/schema.mjs';

const FLOW = `0–5 sn — İftar bitmiş. Süleyman kâsesini sofraya bırakır.
Süleyman: “Seferde sana ‘sultan’ demişler, İbrahim.”

5–10 sn
İbrahim Paşa: “Serasker Sultan, hünkârım.”

10–14 sn — Süleyman gözünü İbrahim’den ayırmaz.
Süleyman: “Benim adım yetmedi mi?”

14–19 sn — İbrahim bakışını indirip ayağa kalkar.
İbrahim Paşa: “Müsaadenizle konağıma döneyim, hünkârım.”

24–30 sn — Kapı kapanır. Sürgünün sesiyle ekran kararır.
`;

test('beats: time ranges, directions, actions with the right subject', () => {
  const d = parseDialogueText(FLOW);
  assert.equal(d.beats.length, 5);
  assert.deepEqual(d.beats.map((b) => [b.start, b.end]), [[0, 5], [5, 10], [10, 14], [14, 19], [24, 30]]);
  assert.equal(d.beats[1].text, ''); // a beat line without a direction must not crash
  assert.equal(d.lines[0].text, 'Seferde sana ‘sultan’ demişler, İbrahim.'); // outer quotes removed, inner kept
  assert.deepEqual(d.beats[0].actions.map((a) => [a.gesture, a.prop, a.sfx, a.target]), [['place', 'bowl', 'clink', 'suleyman']]);
  assert.deepEqual(d.beats[2].actions.map((a) => [a.expression, a.noBlink, a.target]), [['stern', true, 'suleyman']]);
  assert.deepEqual(d.beats[3].actions.map((a) => a.posture || a.expression), ['stand', 'downcast']);
  assert.equal(d.beats[3].actions[0].target, 'ibrahim-pasa');
  assert.deepEqual(d.beats[4].actions.map((a) => a.door || a.sfx || a.fade), ['close', 'bolt', 'out']);
  assert.equal(d.scenes[0].setting, 'palace');
  assert.equal(d.beats[4].lines.length, 0);
});

test('plain numbers do not start beats', () => {
  const d = parseDialogueText('Ali: Skor ne?\nSu: Bilmem.\n3-2 yendik galiba.\n');
  assert.equal(d.beats.length, 0);
  assert.equal(d.lines[1].text, 'Bilmem. 3-2 yendik galiba.');
});

test('lines are placed inside their windows and the video lasts until the last beat', () => {
  const d = parseDialogueText(FLOW);
  const T = { leadIn: 0.4, tail: 1, gap: 0.25, speechRate: 4.6 };
  const clips = Object.fromEntries(d.lines.map((l) => [l.id, { dur: 2.0 }]));
  const r = placeInBeats(d.lines, d.beats, clips, T);
  for (const tl of r.timed) {
    const b = d.beats.find((x) => x.id === d.lines.find((l) => l.id === tl.id).beat);
    assert.ok(tl.start >= b.start && tl.end <= b.end + 1e-6, `${tl.id} ${tl.start}-${tl.end} outside ${b.start}-${b.end}`);
  }
  assert.equal(r.end, 30);
  assert.ok(r.timed[0].start >= 1.5, 'the first line waits for the bowl to be put down');
});

test('one recording is cut into clips between lines', () => {
  const SR = 48000, pcm = new Float32Array(SR * 4);
  for (const [a, b] of [[0.2, 1.3], [2.2, 3.5]]) for (let i = Math.floor(a * SR); i < b * SR; i++) pcm[i] = 0.3 * Math.sin(i / 7);
  const lines = [{ id: 'l1', words: ['bir', 'iki'] }, { id: 'l2', words: ['üç', 'dört'] }];
  const words = [{ w: 'bir', s: 0.2, e: 0.7 }, { w: 'iki', s: 0.8, e: 1.3 }, { w: 'üç', s: 2.2, e: 2.8 }, { w: 'dört', s: 2.9, e: 3.5 }];
  const c = clipsFromWords(pcm, lines, words);
  assert.ok(Math.abs(c.l1.pcm.length / SR - 1.1) < 0.2, `clip 1 length ${c.l1.pcm.length / SR}`);
  assert.ok(Math.abs(c.l2.pcm.length / SR - 1.3) < 0.2, `clip 2 length ${c.l2.pcm.length / SR}`);
  assert.ok(c.l2.words[0].s < 0.1, 'clip-relative word times');
});

test('storyboard: seated cast, sofra, door insert, fade, sound effects', () => {
  const { sb } = makeStoryboard({ text: FLOW });
  const v = validate(sb, loadSchema('storyboard'));
  assert.ok(v.valid, v.errors.join('\n'));
  const s = sb.scenes[0];
  assert.deepEqual(s.posture, { suleyman: 'sit', 'ibrahim-pasa': 'sit' });
  assert.ok(s.background.props.some((p) => p.type === 'sofra' && p.layer === 'front'));
  assert.ok(s.background.tint, 'iftar = night tint');
  const last = sb.shots.at(-1);
  assert.equal(last.type, 'insert');
  assert.ok(sb.events.some((e) => e.type === 'posture' && e.target === 'ibrahim-pasa' && e.value === 'stand'));
  const sfx = sb.events.filter((e) => e.type === 'sfx').map((e) => e.value);
  assert.deepEqual(sfx, ['clink', 'door', 'bolt']);
  const fade = sb.events.find((e) => e.type === 'fade');
  assert.ok(fade.t > sb.events.find((e) => e.value === 'bolt').t && fade.t + fade.dur <= 30);
  assert.ok(sb.shots.some((x) => x.type === 'two' && x.why.includes('stands up')), 'standing up is shown in a two-shot');
  // no blinks while he stares
  assert.ok(!sb.tracks.blinks.suleyman.some((t) => t >= 10 && t <= 14));
});

test('sound effects are deterministic', () => {
  for (const k of Object.keys(SFX)) assert.deepEqual(SFX[k](rng('x')).slice(0, 500), SFX[k](rng('x')).slice(0, 500), k);
  assert.equal(renderSfx({ events: [], video: { duration: 1 }, meta: { seed: 1 } }, '.'), null);
});
