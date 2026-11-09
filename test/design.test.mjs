// Art direction: the look of a video follows its story, in every style, whether a person, an agent or nobody designed it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { ROOT, readJSON } from '../src/lib/util.mjs';
import { parseDialogueText } from '../src/project/parse.mjs';
import { draftDesign, checkDesign, expandShapes, catalog } from '../src/project/design.mjs';
import { autoCharacter } from '../src/project/cast.mjs';
import { compose, SETTINGS } from '../src/engine/settings.mjs';
import { PROP_TYPES, propGeometry } from '../src/engine/props.mjs';
import { HEADWEAR, GARMENTS, FACEWEAR } from '../src/engine/wardrobe.mjs';
import { flatten } from '../src/engine/materials.mjs';
import { createEnv, renderFrame } from '../src/engine/render.mjs';
import { direct } from '../src/director/storyboard.mjs';
import { loadStyle } from '../src/style/load.mjs';
import { DEFAULTS, FORMATS } from '../src/project/config.mjs';
import { timingFor } from './helpers.mjs';

const STYLES = ['kesik-kagit', 'jole', 'riso-cizgi'];
const da = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'da.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const next = (dir) => JSON.parse(da('next', dir, '--json').stdout);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'da-design-'));

const PALACE = 'Süleyman: Seferde sana sultan demişler, İbrahim.\nİbrahim Paşa: Serasker Sultan, hünkârım. Orduya sizin adınıza kumanda ettim.\n';
const SCHOOL = 'Öğretmen: Ödevini getirdin mi, Ali?\nAli: Hocam, sınav için çalışıyordum.\nÖğretmen: Derste konuşacağız.\n';
const TODAY = 'Ali: Kahve içelim mi?\nSu: Olur, dün de içmiştik.\n';

function board(text, { style = 'kesik-kagit', design = undefined } = {}) {
  const dialogue = parseDialogueText(text);
  dialogue.title ||= 'Test';
  const d = design === undefined ? draftDesign(dialogue) : design;
  const characters = dialogue.speakers.filter((s) => !s.narrator).map((s, i) => {
    const c = autoCharacter(s, i, dialogue.lines), p = d?.characters?.[s.id];
    if (!p) return c;
    const { role, ...look } = p;
    const out = { ...c, ...look, colors: { ...c.colors, ...look.colors }, accessories: look.accessories || [] };
    if (GARMENTS[out.costume?.body]?.long) out.body = { ...out.body, shape: 'robe' };
    return out;
  });
  const st = loadStyle(style), [w, h] = FORMATS['9:16'];
  const cfg = { ...DEFAULTS, fps: 30, video: { width: w, height: h, fps: 30 } };
  return { sb: direct({ dialogue, characters, timing: timingFor(dialogue), envelope: null, style: st, cfg, design: d }), st, dialogue };
}

function pixels(sb, st, t = 1) {
  const env = createEnv(sb, st, { createCanvas });
  const c = createCanvas(108, 192), g = c.getContext('2d');
  g.setTransform(0.1, 0, 0, 0.1, 0, 0);
  renderFrame(g, env, t);
  return g.getImageData(0, 0, 108, 192).data;
}
const changed = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; };

test('the draft reads the world of the story from the script', () => {
  const p = draftDesign(parseDialogueText(PALACE));
  assert.equal(p.scenes[0].base, 'palace');
  assert.equal(p.characters.suleyman.role, 'sultan', 'being called hünkârım makes the other person the sultan');
  assert.equal(p.characters.suleyman.costume.head, 'sultan-kavuk');
  assert.equal(p.characters['ibrahim-pasa'].role, 'pasha');
  assert.equal(p.characters['ibrahim-pasa'].costume.head, 'kavuk');
  const s = draftDesign(parseDialogueText(SCHOOL));
  assert.equal(s.scenes[0].base, 'classroom');
  assert.equal(s.characters.ogretmen.role, 'teacher');
  assert.equal(s.characters.ali.role, 'student');
  assert.equal(draftDesign(parseDialogueText('## Orman\nAli: Yol nerede?\nSu: Bilmiyorum.\n')).scenes[0].base, 'forest');
  assert.equal(draftDesign(parseDialogueText('## Bahçe\nHünkâr: Saray sessiz, paşa.\nPaşa: Evet, hünkârım.\n')).scenes[0].base, 'park', 'a heading always wins');
});

test('a costume comes from a title or a job, never from a given name alone', () => {
  assert.deepEqual(draftDesign(parseDialogueText(TODAY)).characters, {});
  assert.deepEqual(draftDesign(parseDialogueText('Süleyman: Kahve?\nMehmet: Olur.\n')).characters, {});
  const lady = draftDesign(parseDialogueText('Hürrem Sultan: Saray uyuyor.\nİbrahim Paşa: Evet, sultanım.\n'));
  assert.equal(lady.characters['hurrem-sultan'].role, 'lady');
  assert.equal(lady.characters['hurrem-sultan'].costume.face, undefined);
});

test('every set and every part draws in every style', () => {
  assert.ok(SETTINGS.length >= 20);
  for (const t of PROP_TYPES) for (const s of flatten(propGeometry(t, {}).items)) for (const [x, y] of s.abs) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${t}: ${s.k}`);
  for (const style of STYLES) for (const base of SETTINGS) {
    const { sb, st } = board(TODAY, { style, design: { scenes: [{ scene: 's1', base }], characters: {} } });
    assert.equal(sb.scenes[0].setting, base);
    assert.ok(compose(base).props.every((p) => PROP_TYPES.includes(p.type)), base);
    pixels(sb, st);
  }
});

test('every costume is drawn by every body, with no broken coordinates', () => {
  for (const style of STYLES) {
    const st = loadStyle(style);
    for (const [slot, table] of [['head', HEADWEAR], ['body', GARMENTS], ['face', FACEWEAR]]) for (const id of Object.keys(table)) {
      const d = { scenes: [{ scene: 's1', base: 'studio' }], characters: { ali: { costume: { [slot]: id } } } };
      const { sb } = board(TODAY, { style, design: d });
      const env = createEnv(sb, st, { createCanvas });
      const ch = sb.characters.find((c) => c.id === 'ali');
      assert.equal(ch.costume[slot], id);
      const expr = { eye: 1, lid: 0, look: [0, 0], brow: 0, tilt: 0, shape: 'open', open: 0, width: 1, curve: 0, skew: 0 };
      for (const dir of [1, -1]) {
        const { items } = env.body.build(ch, { dir, expr, mouth: { open: 0, round: false }, blink: 0, pose: { near: { sh: 0.2, el: 0.2 }, far: { sh: 0.2, el: 0.2 }, lean: 0, head: 0 }, breath: 0, headTilt: 0, talking: false }, env);
        for (const s of flatten(items)) for (const [x, y] of s.abs) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${style} ${slot} ${id}: ${s.k}`);
      }
    }
  }
});

test('riso characters can wear the costumes of the story (the gap a user hit)', () => {
  const plain = board(PALACE, { style: 'riso-cizgi', design: { scenes: [{ scene: 's1', base: 'palace' }], characters: {} } });
  const dressed = board(PALACE, { style: 'riso-cizgi' });
  assert.ok(changed(pixels(plain.sb, plain.st), pixels(dressed.sb, dressed.st)) > 400);
});

test('an agent can draw what the catalogue does not have: a set piece', () => {
  const lamp = { name: 'hanging censer', x: 0, y: -1200, s: 2, draw: [
    { k: 'rect', x: -80, y: -100, w: 160, h: 100, r: 10, fill: 'accent3' },
    { k: 'repeat', n: 3, dx: 50, items: [{ k: 'circle', x: -50, y: -140, r: 14, fill: '#FF0000' }] },
    { k: 'mirror', items: [{ k: 'line', pts: [[20, -100], [60, -240]], w: 6, fill: 'kırmızı' }] },
  ] };
  const without = board(TODAY, { design: { scenes: [{ scene: 's1', base: 'studio' }], characters: {} } });
  const withIt = board(TODAY, { design: { scenes: [{ scene: 's1', base: 'studio', parts: [lamp] }], characters: {} } });
  const prop = withIt.sb.scenes[0].background.props.find((p) => p.type === 'custom');
  assert.equal(prop.name, 'hanging censer');
  assert.equal(prop.draw.length, 1 + 3 + 2, 'repeat and mirror are expanded');
  assert.equal(prop.draw[0].k, 'rrect');
  assert.equal(prop.draw[3].k, 'circle');
  assert.ok(withIt.st.palette.lockToPalette !== false);
  assert.ok(Object.values(withIt.st.palette.roles).includes(prop.draw[1].fill), 'a hex colour is snapped to the palette');
  assert.ok(prop.w > 0 && prop.h > 200);
  assert.ok(changed(pixels(without.sb, without.st), pixels(withIt.sb, withIt.st)) > 30);
});

test('an agent can draw what the catalogue does not have: a costume', () => {
  const custom = { hat: [{ k: 'poly', pts: [[-1, 0], [0, -1.6], [1, 0]], fill: 'accent' }], body: [{ k: 'rect', x: -0.5, y: 0.2, w: 1, h: 0.3, fill: 'light' }], face: [{ k: 'circle', x: 0.5, y: 0, r: 0.2, fill: 'dark' }] };
  for (const style of STYLES) {
    const plain = board(TODAY, { style, design: { scenes: [{ scene: 's1', base: 'studio' }], characters: { ali: { costume: { head: 'fez' }, hair: { style: 'none' } } } } });
    const drawn = board(TODAY, { style, design: { scenes: [{ scene: 's1', base: 'studio' }], characters: { ali: { costume: { custom: Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, expandShapes(v)])) }, hair: { style: 'none' } } } } });
    assert.ok(changed(pixels(plain.sb, plain.st), pixels(drawn.sb, drawn.st)) > 30, style);
  }
});

test('base, remove, night and colours of a scene can be set', () => {
  const { sb } = board(TODAY, { design: { scenes: [{ scene: 's1', base: 'palace', remove: ['kandil'], wall: 'accent1', night: true }], characters: {} } });
  const bg = sb.scenes[0].background;
  assert.equal(bg.wall, 'accent1');
  assert.ok(bg.tint);
  assert.ok(!bg.props.some((p) => p.type === 'kandil'));
  const day = board('Ali: Gece oldu.\nSu: Evet.\n', { design: { scenes: [{ scene: 's1', base: 'park', night: false }], characters: {} } });
  assert.equal(day.sb.scenes[0].background.tint, undefined, 'the designer can overrule the word "gece"');
  const bare = board('Ali: Selam.\nSu: Selam.\n', { design: { scenes: [{ scene: 's1', base: 'none', place: 'exterior', parts: [{ use: 'pine', x: 0 }] }], characters: {} } });
  assert.equal(bare.sb.scenes[0].background.place, 'exterior');
  assert.equal(bare.sb.scenes[0].background.props.length, 1);
});

test('tall headwear stays inside a wide shot', () => {
  const { sb } = board(PALACE, { style: 'riso-cizgi' });
  const wide = sb.shots.find((s) => s.type === 'two');
  const top = wide.camera.to.y - wide.camera.to.h / 2;
  assert.ok(top < -900 * 1.25, `frame top ${top}`);
});

test('mistakes in a design are explained, with the likely fix', () => {
  const dialogue = parseDialogueText(TODAY);
  const bad = (d) => checkDesign(d, dialogue).errors.join('\n');
  assert.match(bad({ scenes: [{ scene: 's1', parts: [{ use: 'lattice-windw', x: 0 }] }] }), /Did you mean "lattice-window"/);
  assert.match(bad({ scenes: [{ scene: 's1', base: 'palce' }] }), /Did you mean "palace"/);
  assert.match(bad({ scenes: [{ scene: 's9' }] }), /no such scene/);
  assert.match(bad({ scenes: [{ scene: 's1', parts: [{ x: 0 }] }] }), /needs "use"/);
  assert.match(bad({ scenes: [{ scene: 's1', parts: [{ draw: [{ k: 'circle', x: 0, y: 0, fill: 'accent1' }] }] }] }), /needs "r"/);
  assert.match(bad({ scenes: [{ scene: 's1', parts: [{ draw: [{ k: 'circle', x: 0, y: 0, r: 5, fill: 'mor-ötesi' }] }] }] }), /colour/);
  assert.match(bad({ characters: { kim: {} } }), /no such speaker/);
  assert.match(bad({ characters: { ali: { costume: { head: 'kavk' } } } }), /Did you mean "kavuk"/);
  const w = checkDesign({ scenes: [{ scene: 's1', base: 'none', parts: [{ use: 'pine', x: 3000 }, { use: 'sofra', x: 0, layer: 'front', opts: { h: 900 } }] }], characters: {} }, dialogue).warnings.join('\n');
  assert.match(w, /look empty/);
  assert.match(w, /reaches their faces/);
  assert.match(w, /no costume/);
});

test('the catalogue lists only what really exists', () => {
  const c = catalog();
  for (const list of Object.values(c.parts)) for (const entry of list) assert.ok(PROP_TYPES.includes(entry.split(' ')[0]), entry);
  assert.equal(Object.values(c.parts).flat().length, PROP_TYPES.length);
});

test('next: a draft is written, then the agent is told to design it, then the loop moves on', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'dialogue.md'), PALACE);
  fs.writeFileSync(path.join(dir, 'project.json'), '{"style":"riso-cizgi"}');
  assert.equal(spawnSync(next(dir).command, { shell: true }).status, 0); // parse
  let d = next(dir);
  assert.equal(d.step, 'design');
  assert.equal(d.state, 'run');
  assert.equal(spawnSync(d.command, { shell: true }).status, 0);
  const file = path.join(dir, 'design.json');
  assert.equal(readJSON(file).status, 'draft');
  d = next(dir);
  assert.equal(d.state, 'design');
  const text = d.instructions.join('\n');
  for (const w of [/art director/, /DESIGN\.md/, /--catalog/, /even if the user described nothing/, /draw it yourself/]) assert.match(text, w);
  assert.match(d.defaultsCommand, /--accept/);

  // a broken design goes back to whoever wrote it
  const good = readJSON(file);
  fs.writeFileSync(file, JSON.stringify({ ...good, status: 'final', scenes: [{ scene: 's1', parts: [{ use: 'no-such-part', x: 0 }] }] }));
  d = next(dir);
  assert.equal(d.state, 'edit');
  assert.match(d.instructions.join('\n'), /no-such-part/);

  fs.writeFileSync(file, JSON.stringify({ ...good, status: 'final' }));
  assert.equal(next(dir).step, 'cast');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cast: an exact character file wins over the design; a description adds to it', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'characters'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), PALACE);
  fs.writeFileSync(path.join(dir, 'characters', 'suleyman.json'), JSON.stringify({ colors: { body: '#00FF00' } }));
  fs.writeFileSync(path.join(dir, 'characters', 'ibrahim-pasa.md'), 'Kırmızı kaftanlı, kavuklu bir adam.');
  assert.equal(da('cast', dir).status, 0);
  const chars = readJSON(path.join(dir, 'build', 'characters.json')).characters;
  assert.equal(chars.find((c) => c.id === 'suleyman').costume, undefined, 'exact means exact');
  const ib = chars.find((c) => c.id === 'ibrahim-pasa');
  assert.equal(ib.costume.head, 'kavuk');
  assert.equal(ib.costume.body, 'kaftan');
  assert.equal(ib.body.shape, 'robe', 'a long garment needs the robe silhouette');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('every JSON example in docs/DESIGN.md is a valid design', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'DESIGN.md'), 'utf8');
  const blocks = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  assert.ok(blocks.length >= 3);
  for (const b of blocks) assert.deepEqual(checkDesign(b, null).errors, []);
});

test('SKILL.md makes the look the agent\'s job and points at the guide', () => {
  const s = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  for (const w of [/even if the user said nothing/, /design\.json/, /docs\/DESIGN\.md/, /CANNOT DESIGN/, /da design --catalog/]) assert.match(s, w);
});
