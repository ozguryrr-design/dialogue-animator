// What happens on screen: walking, carrying, the moving camera, staging.json and stories with no speech.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { ROOT } from '../src/lib/util.mjs';
import { validate, loadSchema } from '../src/lib/schema.mjs';
import { moveState, travelCurve } from '../src/engine/motion.mjs';
import { createEnv, renderFrame, facesInShot, shotIndexAt } from '../src/engine/render.mjs';
import { cameraAt } from '../src/engine/camera.mjs';
import { propState } from '../src/engine/background.mjs';
import { geometryOf } from '../src/engine/props.mjs';
import { parseDialogueText } from '../src/project/parse.mjs';
import { checkStaging, draftStaging, readDirections } from '../src/project/staging.mjs';
import { timeOf } from '../src/director/blocking.mjs';
import { makeStoryboard, timingFor } from './helpers.mjs';

const STORY = `# Kazan
## Sokak
@cast Ali, Su
0–4 sn — Ali gelir.
Ali: Selam!
4–8 sn — Su tencereyi alır.
Su: Bu ne?
8–12 sn — Ali gülümser.
Ali: Sürpriz.
`;
const staging = {
  status: 'final',
  scenes: [{
    scene: 's1', keepScriptActions: false,
    objects: { pot: { use: 'pot', x: 200, hold: 'near' }, sack: { use: 'sack', hold: 'both' } },
    start: { ali: { x: -2000, holding: 'sack' }, su: { x: 380, face: 'left', hidden: true } },
    do: [
      { at: 0, who: 'ali', walk: -300, dur: 3.5 },
      { at: '+0.1', who: 'ali', put: 'sack', x: -60 },
      { at: 'b2', who: 'su', hidden: false },
      { at: 'b2+0.3', who: 'su', take: 'pot' },
      { at: 'l2', who: 'su', give: 'pot', to: 'ali' },
      { at: 'b3', who: 'ali', hide: 'pot' },
    ],
    camera: [{ at: 0, on: 'ali', size: 'full' }, { at: 'b2', on: ['ali', 'su'], size: 'two' }, { at: 'l2', on: 'su', size: 'medium' }, { at: 'b3', on: 'ali', size: 'close' }],
  }],
};
const made = (text = STORY, st = staging, style = 'kesik-kagit') => makeStoryboard({ text, camera: 'follow', staging: st, style });

test('walking: arrives exactly, slows at both ends, and a later move takes over', () => {
  assert.equal(travelCurve(0), 0);
  assert.equal(travelCurve(1), 1);
  const moves = [{ t: 1, to: 1000, dur: 2, gait: 'walk' }];
  assert.equal(moveState(moves, 0, 0.5).x, 0);
  assert.equal(moveState(moves, 0, 3.5).x, 1000);
  assert.equal(moveState(moves, 0, 3.5).amount, 0, 'standing again');
  assert.equal(moveState(moves, 0, 2).amount, 1, 'in full stride');
  assert.equal(moveState(moves, 0, 2).dir, 1);
  const two = [{ t: 0, to: 1000, dur: 2 }, { t: 1, to: 0, dur: 1 }];
  assert.ok(moveState(two, 0, 1).x < 1000);
  assert.ok(Math.abs(moveState(two, 0, 2).x) < 1e-6, 'the second move ends where it says');
});

test('times: seconds, lines, beats, ends, offsets, after the previous action', () => {
  const ctx = { lines: [{ index: 3, start: 5, end: 7 }], beats: [{ id: 'b2', start: 10, end: 12 }], scene: { start: 0 } };
  assert.equal(timeOf(4, ctx), 4);
  assert.equal(timeOf('l3', ctx), 5);
  assert.equal(timeOf('l03+0.5', ctx), 5.5);
  assert.equal(timeOf('l3.end-1', ctx), 6);
  assert.equal(timeOf('b2.end', ctx), 12);
  assert.equal(timeOf('+0.4', ctx, 2), 2.4);
  assert.throws(() => timeOf('soon', ctx), /not a time/);
  assert.throws(() => timeOf('l9', ctx), /no l9/);
});

test('staging becomes events: a walk, a put down, a hand-over, hiding, footsteps', () => {
  const { sb } = made();
  const v = validate(sb, loadSchema('storyboard'));
  assert.ok(v.valid, v.errors.join('\n'));
  const of = (type) => sb.events.filter((e) => e.type === type);
  assert.deepEqual(of('move').map((e) => [e.target, e.to, e.gait]), [['ali', -300, 'walk']]);
  assert.ok(of('drop').some((e) => e.x === -60));
  assert.deepEqual(of('hold').map((e) => [e.by, e.side]), [['ali', 'both'], ['su', 'near'], ['ali', 'near'], ['ali', 'behind']]);
  assert.ok(of('sfx').filter((e) => e.value === 'step').length >= 4, 'a walk has footsteps');
  assert.ok(of('visible').length === 2);
});

test('the camera follows: whoever it is on stays in frame all the way along the walk', () => {
  const { sb, style } = made();
  const env = createEnv(sb, style, { createCanvas });
  for (let t = 0.6; t < 3.4; t += 0.2) {
    const k = shotIndexAt(sb, t), ali = facesInShot(env, k, t).find((f) => f.id === 'ali');
    assert.ok(ali.visible && ali.cut === 0, `t=${t.toFixed(1)}: ali is out of frame`);
  }
  const k = shotIndexAt(sb, 3), cam = cameraAt(env, sb.shots[k], 3);
  assert.ok(cam.x < -300, 'and it travelled with him');
});

test('one camera: every shot has a path and starts where the last one ended', () => {
  const { sb } = made();
  for (const s of sb.shots) { assert.ok(s.camera.track.x.length >= 2, s.id); for (const k of ['x', 'y', 'h']) assert.ok(s.camera.track[k].every(Number.isFinite), `${s.id} ${k}`); }
  for (let i = 1; i < sb.shots.length; i++) {
    const a = sb.shots[i - 1].camera.track, b = sb.shots[i].camera.track;
    assert.ok(Math.abs(a.x.at(-1) - b.x[0]) < 60, `jump between shots ${i - 1} and ${i}: ${a.x.at(-1)} -> ${b.x[0]}`);
  }
});

test('a hard cut asked for is a hard cut', () => {
  const st = JSON.parse(JSON.stringify(staging));
  st.scenes[0].camera[1].cut = true;
  const { sb } = made(STORY, st);
  const a = sb.shots[0].camera.track, b = sb.shots[1].camera.track;
  assert.ok(Math.abs(a.x.at(-1) - b.x[0]) > 200, 'a cut does not glide');
});

test('the set exists wherever the camera goes', () => {
  const { sb } = made();
  const scene = sb.scenes[0], aspect = sb.video.width / sb.video.height;
  const spans = scene.background.props.filter((p) => p.layer !== 'front').map((p) => { const w = geometryOf(p).w * (p.s || 1); return [p.x - w / 2, p.x + w / 2]; });
  for (const s of sb.shots) s.camera.track.x.forEach((x, i) => {
    const hw = (s.camera.track.h[i] * aspect) / 2;
    assert.ok(spans.some(([a, b]) => b > x - hw && a < x + hw), `nothing in view around x=${x}`);
  });
  assert.ok(new Set(scene.background.props.map((p) => p.id)).size === scene.background.props.length, 'ids stay unique');
  assert.ok(!scene.background.props.some((p) => p.object && p.id.includes('~')), 'a handled object is never duplicated');
});

test('a held object leaves the floor and comes back where it is put', () => {
  const { sb, style } = made();
  const env = createEnv(sb, style, { createCanvas });
  const sack = sb.scenes[0].background.props.find((p) => p.type === 'sack');
  assert.equal(propState(env, sack, 1).held, true);
  const after = propState(env, sack, 5);
  assert.equal(after.held, false);
  assert.equal(after.x, -60);
});

test('walking, carrying and hiding draw in every style and every format', () => {
  for (const style of ['kesik-kagit', 'jole', 'riso-cizgi']) {
    const { sb, style: st } = made(STORY, staging, style);
    const env = createEnv(sb, st, { createCanvas });
    const c = createCanvas(108, 192), g = c.getContext('2d');
    g.scale(0.1, 0.1);
    for (const t of [0.2, 2, 3.8, 5, 6.3, 9, 11]) renderFrame(g, env, t);
  }
});

test('the door is on screen while it moves, even if someone stands up in the same beat', () => {
  const text = `@cast Ali, Su\n## Saray\n0–5 sn — Ali kâseyi bırakır.\nAli: Yeter.\n5–10 sn — Kapı kapanır. Su ayağa kalkar.\n`;
  const { sb } = makeStoryboard({ text });
  const door = sb.events.find((e) => e.type === 'prop' && e.key === 'open');
  const mid = door.t + door.dur / 2;
  assert.equal(sb.shots.find((s) => mid >= s.start && mid < s.end).type, 'insert');
});

test('a story with no speech: directions and @cast are enough', () => {
  const text = '# Sessiz\n@cast Ali, Su\n0–4 sn — Ali gelir.\n4–8 sn — Su kapıyı açar.\n';
  const d = parseDialogueText(text);
  assert.equal(d.lines.length, 0);
  assert.equal(d.language.length > 0, true);
  assert.ok(validate(d, loadSchema('dialogue')).valid);
  assert.equal(timingFor(d).duration, 8);
  const { sb } = makeStoryboard({ text, camera: 'follow', staging: draftStaging(d) });
  assert.ok(validate(sb, loadSchema('storyboard')).valid);
  assert.equal(sb.video.duration, 8);
  assert.deepEqual(sb.scenes[0].cast, ['ali', 'su']);
  assert.ok(sb.events.some((e) => e.type === 'move'), 'somebody moves');
});

test('reading a script: verbs, the person doing them, what they handle', () => {
  const names = { hoca: 'hoca', komsu: 'komsu' };
  const [put] = readDirections('Hoca, bakır kazanı kapının önüne bırakır.', names);
  assert.deepEqual([put.verb, put.who, put.objects[0].noun], ['put', 'hoca', 'kazan']);
  const [take] = readDirections('Komşu kazanın içinden küçük bir tencere çıkarır.', names);
  assert.deepEqual([take.verb, take.who, take.objects.map((o) => o.noun)], ['take', 'komsu', ['kazan', 'tencere']]);
  assert.deepEqual(readDirections('Ali bağırır.', { ali: 'ali' }).flatMap((d) => d.objects), [], '"bag" must not match "bağırır"');
});

test('the draft makes somebody carry in what the script says they put down', () => {
  const d = parseDialogueText('## Kapı\n0–5 sn — Hoca kazanı bırakır.\nHoca: Al.\nKomşu: Sağ ol.\n');
  const s = draftStaging(d).scenes[0];
  assert.equal(s.objects.kazan.use, 'cauldron');
  assert.equal(s.start.hoca.holding, 'kazan');
  assert.ok(s.do.some((a) => a.who === 'hoca' && a.walk === 'home'));
  assert.ok(s.do.some((a) => a.put === 'kazan'));
  assert.deepEqual(checkStaging({ status: 'final', ...{ scenes: [s] } }, d).errors, []);
});

test('checking staging: says what is wrong and how to fix it', () => {
  const d = parseDialogueText(STORY);
  const bad = (patch) => checkStaging({ scenes: [{ scene: 's1', objects: { pot: { use: 'pot' } }, ...patch }] }, d).errors.join('\n');
  assert.match(bad({ do: [{ who: 'veli', walk: 0 }] }), /not on stage.*@cast veli/s);
  assert.match(bad({ do: [{ who: 'ali', take: 'kilic' }] }), /no object "kilic"/);
  assert.match(bad({ do: [{ who: 'ali', gesture: 'dance' }] }), /no gesture "dance"/);
  assert.match(bad({ do: [{ who: 'ali', face: 'bored' }] }), /no expression "bored"/);
  assert.match(bad({ do: [{ at: 'l9', who: 'ali', walk: 0 }] }), /no l9/);
  assert.match(bad({ do: [{ who: 'ali', sfx: 'patlama' }] }), /patlama/);
  assert.match(bad({ camera: [{ at: 0, on: 'veli' }] }), /neither on stage nor an object/);
  assert.match(bad({ objects: { x: { use: 'kazann' } } }), /no catalogue part "kazann"/);
  assert.match(bad({ do: [{ walk: 0 }] }), /needs "who"/);
  assert.deepEqual(checkStaging(staging, d).errors, []);
  assert.match(checkStaging({ scenes: [{ scene: 's9' }] }, d).errors[0], /no such scene/);
});

test('the example in docs/STAGING.md is valid', () => {
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'STAGING.md'), 'utf8');
  const example = JSON.parse(md.match(/```json\n([\s\S]*?)```/)[1]);
  const d = parseDialogueText('@cast Ali, Su\nAli: Bir.\nSu: İki.\nAli: Üç.\n');
  assert.deepEqual(checkStaging(example, d).errors, []);
  const { sb } = makeStoryboard({ text: '@cast Ali, Su\nAli: Bir.\nSu: İki.\nAli: Üç.\n', camera: 'follow', staging: example });
  assert.ok(validate(sb, loadSchema('storyboard')).valid);
});
