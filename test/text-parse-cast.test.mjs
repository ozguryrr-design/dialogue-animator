import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldKey, slug, syllables, tokenize, detectLanguage, nuclei } from '../src/lib/text.mjs';
import { parseDialogueText, parseDialogueJSON } from '../src/project/parse.mjs';
import { parseDescription, autoCharacter } from '../src/project/cast.mjs';
import { tagToExpression } from '../src/project/lexicon.mjs';

test('Turkish-aware folding and slugs', () => {
  assert.equal(foldKey('ALİ'), 'ali');
  assert.equal(foldKey('IŞIK'), 'isik');
  assert.equal(foldKey('Ayşe'), 'ayse');
  assert.equal(slug('Güneş Işık'), 'gunes-isik');
  assert.equal(foldKey('Çağrı'), 'cagri');
});

test('syllables and tokens', () => {
  assert.equal(syllables('Günaydın'), 3);
  assert.equal(syllables('bitti?'), 2);
  assert.deepEqual(nuclei('köşedeki'), ['ö', 'e', 'e', 'i']);
  assert.deepEqual(tokenize('Ne?! Bütün paket mi bitti?'), ['Ne?!', 'Bütün', 'paket', 'mi', 'bitti?']);
  assert.deepEqual(tokenize('— ... ok'), ['ok']);
  assert.equal(detectLanguage('Çay bitti mi? Evet, bitti.'), 'tr');
  assert.equal(detectLanguage('Is the tea ready? Yes it is.'), 'en');
});

test('dialogue parser: speakers, tags, directions, scenes, pauses, continuation', () => {
  const d = parseDialogueText(`# Başlık
<!-- a comment -->
## Mutfak
ALİ: Merhaba! [mutlu]
**Su:** (omuz silker) Bilmem...
devam eden cümle.
@pause 0.8
- Ali: *el sallar* Görüşürüz!
## Park
Su: Tamam. [kendinden emin]
`);
  assert.equal(d.title, 'Başlık');
  assert.deepEqual(d.speakers.map((s) => s.id), ['ali', 'su']);
  assert.equal(d.speakers[0].name, 'Ali');
  assert.equal(d.lines.length, 4);
  assert.equal(d.lines[0].emotion, 'happy');
  assert.equal(d.lines[0].gesture, 'wave'); // greeting
  assert.equal(d.lines[1].gesture, 'shrug');
  assert.equal(d.lines[1].text, 'Bilmem... devam eden cümle.');
  assert.equal(d.lines[2].pauseBefore, 0.8);
  assert.equal(d.lines[2].gesture, 'wave');
  assert.equal(d.lines[3].emotion, 'smug');
  assert.deepEqual(d.scenes.map((s) => s.setting), ['kitchen', 'park']);
  assert.equal(d.language, 'tr');
});

test('dialogue JSON input', () => {
  const d = parseDialogueJSON({ lines: [{ speaker: 'Mia', text: 'Hi!', emotion: 'surprised', scene: 'office' }, { speaker: 'Leo', text: 'Hello.' }] });
  assert.equal(d.lines[0].emotion, 'surprised');
  assert.equal(d.scenes[0].setting, 'office');
  assert.equal(d.lines[1].scene, d.lines[0].scene);
});

test('tags in Turkish and English map to expressions', () => {
  assert.equal(tagToExpression('şaşkın'), 'surprised');
  assert.equal(tagToExpression('Kızgın'), 'angry');
  assert.equal(tagToExpression('excited'), 'happy');
  assert.equal(tagToExpression('xyz'), null);
});

test('character descriptions (TR + EN)', () => {
  const tr = parseDescription('Deniz uzun boylu, kıvırcık kızıl saçlı, hardal sarısı kazaklı ve gözlüklü. Enerjik.');
  assert.equal(tr.hair.style, 'curly');
  assert.equal(tr.colors.hair, '#C8642E');
  assert.equal(tr.colors.body, '#E3A72F');
  assert.equal(tr.body.height, 1.12);
  assert.deepEqual(tr.accessories, ['glasses']);
  assert.equal(tr.personality.energy, 0.85);
  const en = parseDescription('A short person with a red jacket, blonde bun and a scarf. Calm and shy.');
  assert.equal(en.colors.body, '#D33F3F');
  assert.equal(en.colors.hair, '#E8C870');
  assert.equal(en.hair.style, 'bun');
  assert.ok(en.accessories.includes('scarf'));
  assert.equal(en.personality.baseline, 'worried');
});

test('generated characters are deterministic and distinct', () => {
  const a = autoCharacter({ id: 'ada', name: 'Ada' }, 0), b = autoCharacter({ id: 'bo', name: 'Bo' }, 1);
  assert.deepEqual(a, autoCharacter({ id: 'ada', name: 'Ada' }, 0));
  assert.notEqual(a.colors.body, b.colors.body);
  assert.notEqual(a.body.shape, b.body.shape);
});
