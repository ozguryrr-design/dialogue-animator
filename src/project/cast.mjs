// characters/ (json, md/txt description, image) or the dialogue itself -> build/characters.json
//
// Priority per speaker: characters/<id>.json (exact, validated) > <id>.md/.txt (description parsed with a
// small keyword reader; an agent can do better by writing <id>.json itself) > <id>.png/.jpg (colours only)
// > generated from the dialogue (deterministic from the name). project.json "characters.overrides" wins last.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, readText, writeJSON, log, rel, exists } from '../lib/util.mjs';
import { foldKey } from '../lib/text.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { hash32 } from '../engine/math.mjs';
import { deltaE, rgbToHex } from '../engine/color.mjs';
import { loadConfig, IMAGE_EXT } from './config.mjs';
import { COLOR_WORDS, COLOR_HEX, SKIN_WORDS, normalizeColor } from './colors.mjs';
import { run as runParse } from './parse.mjs';

export const GENERIC_SKIN = ['#F6D3B8', '#EBB48E', '#C98D62', '#94603E', '#5F3D2A'];
const AUTO_BODY = ['#E3A72F', '#2F7F7A', '#D9653B', '#3A78C3', '#7E57C2', '#4F9A5A', '#E88FAE', '#22304A'];
const AUTO_SHAPES = ['trapezoid', 'round', 'rect', 'pear', 'triangle'];
const AUTO_HAIR = ['short', 'bob', 'curly', 'bun', 'spiky', 'long', 'ponytail', 'short'];
const AUTO_HAIR_COLORS = ['#22304A', '#8B5A3C', '#C8642E', '#222222', '#E8C870', '#7A2E3A'];
const AUTO_HEIGHT = [1.0, 0.93, 1.06, 0.97, 1.03];
const AUTO_ACCESSORY = [[], [], ['glasses'], ['scarf'], ['earrings'], ['freckles'], ['beanie'], ['bowtie'], ['headphones'], ['mustache']];

const NOUNS = {
  hair: ['sac', 'sacli', 'saclari', 'saclar', 'sacini', 'hair', 'haired', 'perce', 'perceli'],
  body: ['ceket', 'ceketli', 'kazak', 'kazakli', 'tisort', 'tisortlu', 'gomlek', 'gomlekli', 'elbise', 'elbiseli', 'mont', 'montlu', 'hirka', 'hirkali', 'sweatshirt', 'shirt', 'tshirt', 'jacket', 'sweater', 'dress', 'hoodie', 'coat', 'top', 'kiyafet', 'kiyafetli', 'giysi', 'outfit', 'govde', 'body', 'tulum', 'yelek', 'vest'],
  legs: ['pantolon', 'pantolonlu', 'etek', 'etekli', 'sort', 'sortlu', 'jean', 'kot', 'pants', 'trousers', 'skirt', 'shorts', 'jeans', 'legs', 'bacak', 'tayt'],
  skin: ['ten', 'tenli', 'cilt', 'ciltli', 'skin', 'skinned'],
  accent: ['atki', 'atkili', 'sapka', 'sapkali', 'bere', 'bereli', 'kravat', 'kravatli', 'papyon', 'papyonlu', 'scarf', 'hat', 'beanie', 'tie', 'bowtie', 'kulaklik', 'headphones'],
};

const has = (f, stems) => f.some((w) => stems.some((s) => w === s || (s.length >= 4 && w.startsWith(s))));
const pairHas = (f, a, b) => f.some((w, i) => a.some((x) => w.startsWith(x)) && b.some((y) => (f[i + 1] || '').startsWith(y)));

/** Keyword reader for short character descriptions (Turkish + English). Returns a partial character. */
export function parseDescription(text) {
  const out = { colors: {}, accessories: [], hair: {}, body: {}, head: {}, eyes: {}, personality: {} };
  const raw = String(text);
  const nameLine = raw.match(/^\s*[-*]?\s*(?:name|isim|ad|adı)\s*:\s*(.+)$/im);
  if (nameLine) out.name = nameLine[1].trim();
  const f = raw.split(/[\s,.;:!?()"“”'’\-–—/]+/).map(foldKey).filter(Boolean);

  // colours: "kırmızı ceket" / "red jacket" (adjective first) or "ceketi kırmızı" (noun first)
  const colorAt = (i) => {
    const two = (f[i] || '') + (f[i + 1] || '');
    for (const [name, words] of Object.entries(COLOR_WORDS)) if (words.includes(two) && two.length > 4) return { hex: COLOR_HEX[name], len: 2 };
    for (const [name, words] of Object.entries(COLOR_WORDS)) if (words.includes(f[i])) return { hex: COLOR_HEX[name], len: 1 };
    return null;
  };
  const nounAt = (i) => {
    const w = f[i] || '';
    for (const [target, stems] of Object.entries(NOUNS)) if (stems.some((s) => w === s || (s.length >= 4 && w.startsWith(s)))) return target;
    return null;
  };
  const unattached = [];
  for (let i = 0; i < f.length; i++) {
    const col = colorAt(i);
    if (!col) continue;
    // skip colour modifiers between the colour and its noun ("hardal sarısı kazak", "koyu renkli ceket")
    let j = i + col.len;
    while (j < f.length && j < i + col.len + 2 && (/^(rengi|renkli|renk|tonu|tonlu|colou?red|tone|toned|acik|koyu|light|dark|pastel)$/.test(f[j]) || Object.values(COLOR_WORDS).flat().some((w) => w.length >= 3 && f[j].startsWith(w)))) j++;
    const back = nounAt(i - 1);
    let target = nounAt(j) || (back && !out.colors[back] ? back : null);
    if (target === 'hair' && col.hex === COLOR_HEX.yellow) col.hex = COLOR_HEX.blonde;
    if (target === 'hair' && col.hex === COLOR_HEX.red) col.hex = COLOR_HEX.ginger;
    if (target === 'skin') continue; // skin tones are handled below
    if (target && !out.colors[target]) out.colors[target] = col.hex;
    else if (!target) unattached.push(col.hex);
    i += col.len - 1;
  }
  if (!out.colors.body && unattached.length) out.colors.body = unattached.shift();
  if (!out.colors.accent && unattached.length) out.colors.accent = unattached.shift();
  if (has(f, ['sarisin', 'blonde', 'blond'])) out.colors.hair = COLOR_HEX.blonde;
  if (has(f, ['kizil', 'redhead', 'ginger'])) out.colors.hair = COLOR_HEX.ginger;

  const joined = ' ' + f.join(' ') + ' ';
  for (const s of SKIN_WORDS) if (s.words.some((w) => joined.includes(' ' + w.split(' ').map(foldKey).join(' ')))) out.colors.skin = GENERIC_SKIN[s.idx];

  // hair style ("kısa saç" = short hair, but "kısa boylu" = short person)
  const HAIRN = ['sac', 'hair', 'perce'];
  if (pairHas(f, ['kisa', 'short'], HAIRN)) out.hair.style = 'short';
  if (pairHas(f, ['uzun', 'long'], HAIRN)) out.hair.style = 'long';
  if (has(f, ['kivircik', 'kivir', 'curly', 'bukle', 'afro'])) out.hair.style = 'curly';
  if (has(f, ['topuz', 'bun'])) out.hair.style = 'bun';
  if (has(f, ['atkuyrugu', 'ponytail']) || pairHas(f, ['at'], ['kuyrug'])) out.hair.style = 'ponytail';
  if (has(f, ['kel', 'bald', 'sacsiz', 'kazitilmis'])) out.hair.style = 'none';
  if (has(f, ['diken', 'spiky', 'jole'])) out.hair.style = 'spiky';
  if (has(f, ['kakul', 'kut', 'bob', 'fringe', 'bangs', 'kahkul'])) out.hair.style = 'bob';

  // body
  if (pairHas(f, ['uzun'], ['boy']) || has(f, ['tall', 'leggy'])) out.body.height = 1.12;
  if (pairHas(f, ['kisa'], ['boy']) || pairHas(f, ['short'], ['person', 'guy', 'girl', 'kid'])) out.body.height = 0.88;
  if (has(f, ['minik', 'tiny', 'ufak', 'cocuk', 'kid', 'child'])) out.body.height = 0.84;
  if (has(f, ['iri', 'genis', 'tombul', 'chubby', 'stocky', 'tikniz', 'dolgun', 'kilolu'])) { out.body.width = 1.18; out.body.shape = out.body.shape || 'round'; }
  if (has(f, ['zayif', 'ince', 'skinny', 'thin', 'slim', 'cilimsi', 'lanky'])) { out.body.width = 0.86; out.body.shape = out.body.shape || 'rect'; }
  if (has(f, ['yuvarlak', 'round', 'tostoparlak'])) out.body.shape = 'round';
  if (has(f, ['armut', 'pear'])) out.body.shape = 'pear';
  if (has(f, ['ucgen', 'triangle', 'kaslı', 'kasli', 'muscular']) || pairHas(f, ['genis'], ['omuz'])) out.body.shape = 'triangle';
  if (has(f, ['kare', 'kutu', 'square', 'boxy'])) out.body.shape = out.body.shape || 'rect';
  if (has(f, ['yumurta', 'egg'])) out.head.shape = 'egg';
  if (has(f, ['oval'])) out.head.shape = 'oval';
  if (pairHas(f, ['kare', 'square'], ['kafa', 'bas', 'head', 'yuz', 'face'])) out.head.shape = 'square';
  if (pairHas(f, ['buyuk', 'koca', 'big'], ['kafa', 'bas', 'head'])) out.head.size = 1.15;

  // face
  if (pairHas(f, ['kocaman', 'buyuk', 'iri', 'big', 'huge'], ['goz', 'eye'])) out.eyes.size = 1.3;
  if (pairHas(f, ['kucuk', 'ufak', 'small', 'tiny'], ['goz', 'eye'])) out.eyes.size = 0.8;
  if (has(f, ['kirpik', 'lashes', 'eyelash'])) out.eyes.lashes = true;
  if (pairHas(f, ['uzun', 'sivri', 'long', 'pointy'], ['burun', 'nose'])) out.nose = 'long';
  if (pairHas(f, ['kucuk', 'kalkik', 'button', 'small'], ['burun', 'nose'])) out.nose = 'button';

  // accessories
  const ACC = {
    glasses: ['gozluk', 'glasses', 'spectacles', 'gozluklu'], hat: ['sapka', 'hat', 'kasket', 'cap'], beanie: ['bere', 'beanie', 'beresi'],
    scarf: ['atki', 'scarf', 'fular', 'sal'], bowtie: ['papyon', 'bowtie'], tie: ['kravat', 'necktie'], earrings: ['kupe', 'earring'],
    beard: ['sakal', 'beard', 'sakalli'], mustache: ['biyik', 'mustache', 'moustache'], freckles: ['cil', 'cilli', 'freckle'],
    headphones: ['kulaklik', 'headphone', 'headset'], flower: ['cicek', 'flower', 'tokasi'], blush: ['allik', 'blush', 'pembeyanak', 'kizarik'],
  };
  for (const [acc, stems] of Object.entries(ACC)) if (has(f, stems) && !(acc === 'tie' && has(f, ['bowtie', 'papyon']))) out.accessories.push(acc);

  // personality
  if (has(f, ['enerjik', 'hareketli', 'neseli', 'energetic', 'hyper', 'cheerful', 'bubbly', 'heyecanli', 'cosk'])) out.personality.energy = 0.85;
  if (has(f, ['sakin', 'calm', 'yavas', 'sleepy', 'uykulu', 'durgun', 'relaxed', 'rahat'])) out.personality.energy = 0.25;
  if (has(f, ['huysuz', 'grumpy', 'somurtkan', 'aksi', 'sarcastic', 'alayci'])) out.personality.baseline = 'smug';
  if (has(f, ['utangac', 'shy', 'cekingen', 'kaygili', 'anxious'])) out.personality.baseline = 'worried';
  if (has(f, ['neseli', 'cheerful', 'mutlu', 'happy', 'gulumser'])) out.personality.baseline = out.personality.baseline || 'happy';
  if (has(f, ['dusunceli', 'thoughtful', 'bilge', 'wise', 'meraklı', 'merakli', 'curious'])) out.personality.baseline = out.personality.baseline || 'thinking';

  for (const k of ['hair', 'body', 'head', 'eyes', 'personality', 'colors']) if (!Object.keys(out[k]).length) delete out[k];
  if (!out.accessories.length) delete out.accessories;
  out.description = raw.trim().slice(0, 600);
  return out;
}

/** Dominant colours of a character image (k-means on a 48x48 thumbnail). */
export async function colorsFromImage(file) {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const img = await loadImage(fs.readFileSync(file));
  const S = 48, cv = createCanvas(S, S), ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const corner = [d[0], d[1], d[2]];
  const px = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const p = [d[i], d[i + 1], d[i + 2]];
    if (Math.hypot(p[0] - corner[0], p[1] - corner[1], p[2] - corner[2]) < 30) continue; // background
    px.push(p);
  }
  if (px.length < 20) return [];
  let cents = [0, 0.2, 0.4, 0.6, 0.8].map((q) => px[Math.floor(q * (px.length - 1))].slice());
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    assign = px.map((p) => cents.reduce((b, c, k) => (Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < Math.hypot(p[0] - cents[b][0], p[1] - cents[b][1], p[2] - cents[b][2]) ? k : b), 0));
    cents = cents.map((c, k) => {
      const m = px.filter((_, i) => assign[i] === k);
      return m.length ? [0, 1, 2].map((j) => m.reduce((s, p) => s + p[j], 0) / m.length) : c;
    });
  }
  const counts = cents.map((_, k) => assign.filter((a) => a === k).length);
  return cents.map((c, k) => ({ hex: rgbToHex(c), share: counts[k] / px.length })).filter((x) => x.share > 0.03).sort((a, b) => b.share - a.share);
}

function imagePartial(colors) {
  const out = { colors: {} };
  const rest = [...colors];
  const skinIdx = rest.findIndex((c) => GENERIC_SKIN.some((s) => deltaE(c.hex, s) < 22));
  if (skinIdx >= 0) out.colors.skin = rest.splice(skinIdx, 1)[0].hex;
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  if (rest.length) out.colors.body = rest.shift().hex;
  const dark = rest.filter((c) => c.share > 0.05).sort((a, b) => lum(a.hex) - lum(b.hex))[0];
  if (dark) { out.colors.hair = dark.hex; rest.splice(rest.indexOf(dark), 1); }
  if (rest.length) out.colors.accent = rest.shift().hex;
  return out;
}

export function autoCharacter(speaker, index, lines = []) {
  const h = hash32(speaker.id);
  const mine = lines.filter((l) => l.speaker === speaker.id);
  const excl = mine.length ? mine.filter((l) => /!/.test(l.text)).length / mine.length : 0.3;
  return {
    id: speaker.id,
    name: speaker.name,
    source: 'auto',
    body: { shape: AUTO_SHAPES[index % AUTO_SHAPES.length], height: AUTO_HEIGHT[index % AUTO_HEIGHT.length], width: 1 },
    head: { shape: ['round', 'oval', 'round', 'egg'][h % 4], size: 1 },
    colors: {
      skin: GENERIC_SKIN[(h >>> 3) % GENERIC_SKIN.length],
      body: AUTO_BODY[index % AUTO_BODY.length],
      hair: AUTO_HAIR_COLORS[(h >>> 7) % AUTO_HAIR_COLORS.length],
      legs: '#22304A',
      accent: AUTO_BODY[(index + 3) % AUTO_BODY.length],
    },
    hair: { style: AUTO_HAIR[(h >>> 11) % AUTO_HAIR.length] },
    eyes: { size: 1, lashes: false },
    brows: { weight: 1 },
    nose: ['none', 'dot', 'button', 'none'][(h >>> 15) % 4],
    accessories: AUTO_ACCESSORY[(h >>> 17) % AUTO_ACCESSORY.length],
    personality: { energy: Math.round((0.35 + 0.5 * excl) * 100) / 100, baseline: 'neutral' },
  };
}

function deepMerge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) o[k] = deepMerge(a?.[k] || {}, v);
    else if (v !== undefined) o[k] = v;
  }
  return o;
}

function findFileFor(speaker, files) {
  const keys = [foldKey(speaker.id), foldKey(speaker.name)];
  return files.filter((f) => keys.includes(foldKey(path.basename(f, path.extname(f)))));
}

export async function run(dir, cli = {}) {
  const { cfg, files } = loadConfig(dir, cli);
  const dPath = path.join(files.build, 'dialogue.json');
  const dialogue = exists(dPath) ? readJSON(dPath) : (await runParse(dir, cli)).dialogue;
  const schema = loadSchema('character');
  const notes = [];
  const used = new Set();
  const characters = [];
  for (const s of dialogue.speakers) if (s.narrator) notes.push(`${s.name}: narration only (heard, no character on screen)`);
  for (const [i, sp] of dialogue.speakers.filter((s) => !s.narrator).entries()) {
    let ch = autoCharacter(sp, i, dialogue.lines);
    const matches = findFileFor(sp, files.characters);
    const json = matches.find((f) => f.toLowerCase().endsWith('.json'));
    const txt = matches.find((f) => /\.(md|txt)$/i.test(f));
    const img = matches.find((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()));
    matches.forEach((m) => used.add(m));
    if (json) {
      const j = readJSON(json);
      ch = deepMerge(ch, j); ch.source = 'json';
      notes.push(`${sp.name}: ${rel(json, files.dir)} (exact)`);
    } else {
      if (img) {
        const cols = await colorsFromImage(img);
        ch = deepMerge(ch, imagePartial(cols)); ch.source = 'image';
        notes.push(`${sp.name}: colours from ${rel(img, files.dir)} (${cols.slice(0, 4).map((c) => c.hex).join(' ')}); shape/hair/accessories are generated — an agent that can see the image should write characters/${sp.id}.json`);
      }
      if (txt) {
        const part = parseDescription(readText(txt));
        ch = deepMerge(ch, part); ch.source = 'description';
        notes.push(`${sp.name}: description ${rel(txt, files.dir)} -> ${summarize(part)}`);
      }
      if (!img && !txt) notes.push(`${sp.name}: generated from the dialogue (no file in characters/)`);
    }
    const ov = cfg.characters?.overrides?.[sp.id];
    if (ov) { ch = deepMerge(ch, ov); notes.push(`${sp.name}: project.json overrides applied`); }
    ch.id = sp.id;
    ch.name = ch.name || sp.name;
    for (const k of Object.keys(ch.colors || {})) {
      const n = normalizeColor(ch.colors[k]);
      if (!n) { notes.push(`${sp.name}: colour "${ch.colors[k]}" for ${k} not understood — using the generated one`); ch.colors[k] = autoCharacter(sp, i).colors[k]; }
      else ch.colors[k] = n;
    }
    const { valid, errors } = validate(ch, schema);
    if (!valid) throw new Error(`Character ${sp.name} is invalid:\n${errors.map((e) => '  - ' + e).join('\n')}`);
    characters.push(ch);
  }
  for (const f of files.characters) if (!used.has(f)) notes.push(`unused file ${rel(f, files.dir)} — its name does not match any speaker (${dialogue.speakers.map((s) => s.id).join(', ')})`);
  const out = { characters, notes };
  writeJSON(path.join(files.build, 'characters.json'), out);
  return { ...out, files };
}

function summarize(p) {
  const bits = [];
  if (p.colors) bits.push(Object.entries(p.colors).map(([k, v]) => `${k} ${v}`).join(', '));
  if (p.hair?.style) bits.push(`hair ${p.hair.style}`);
  if (p.body) bits.push(`body ${Object.entries(p.body).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (p.accessories) bits.push(p.accessories.join('+'));
  if (p.personality) bits.push(`personality ${JSON.stringify(p.personality)}`);
  return bits.join('; ') || 'nothing recognised (generated look kept)';
}

export async function cli(args) {
  log.step('cast');
  const { characters, notes, files } = await run(args._[0] || '.', args);
  for (const n of notes) log.info(n);
  log.ok(`${characters.length} character(s) -> ${rel(path.join(files.build, 'characters.json'))}`);
  return 0;
}
