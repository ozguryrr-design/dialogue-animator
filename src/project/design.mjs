// design.json: the art direction of a video. What each scene looks like and what each character wears.
//   da design <dir>            writes a first draft from the script (keywords only; an agent improves it)
//   da design <dir> --check    validates and reviews it
//   da design <dir> --accept   marks it final as it is
//   da design --catalog        everything ready-made, for whoever is designing
// With no design.json at all, cast and board use the same automatic draft in memory.
import path from 'node:path';
import { readJSON, writeJSON, exists, log, rel, c as paint } from '../lib/util.mjs';
import { foldKey } from '../lib/text.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { scanProject } from './config.mjs';
import { normalizeColor } from './colors.mjs';
import { findSetting, foldWords } from './lexicon.mjs';
import { SETTINGS } from '../engine/settings.mjs';
import { PROP_TYPES, propGeometry } from '../engine/props.mjs';
import { HEADWEAR, FACEWEAR, GARMENTS } from '../engine/wardrobe.mjs';
import { flatten } from '../engine/materials.mjs';
import { bbox } from '../engine/shapes.mjs';
import { nearest } from '../engine/color.mjs';

export const DESIGN_FILE = 'design.json';
export const ROLE_COLORS = ['paper', 'ink', 'wall', 'wall2', 'wall3', 'floor', 'floor2', 'sky', 'ground', 'hill', 'accent1', 'accent2', 'accent3', 'light', 'dark', 'glass', 'white'];
export const OWN_COLORS = ['body', 'accent', 'hair', 'skin', 'legs', 'fold'];
const HALF_VIEW = 560; // half the width of a 9:16 wide shot, in stage units
const hit = (words, stems) => stems.filter((s) => words.some((w) => w === s || (s.length >= 4 && w.startsWith(s))));

// ---------------- what the script is about ----------------
export const WORLDS = {
  ottoman: { words: ['saray', 'hunkar', 'padisah', 'sultan', 'pasa', 'vezir', 'sadrazam', 'yeniceri', 'harem', 'osmanli', 'ottoman', 'serasker', 'sehzade', 'sefer', 'kanuni', 'valide', 'kaftan', 'kavuk', 'konak'], base: 'palace', outdoors: 'palace-garden', town: 'bazaar', fallback: 'courtier', concept: 'An Ottoman palace' },
  medieval: { words: ['kral', 'kralice', 'sovalye', 'sato', 'castle', 'king', 'queen', 'knight', 'prenses', 'prince', 'princess', 'krallik', 'kingdom', 'taht', 'throne'], base: 'throne-room', outdoors: 'village', town: 'bazaar', fallback: 'villager', concept: 'A storybook medieval kingdom' },
  school: { words: ['okul', 'sinif', 'ogretmen', 'ogrenci', 'ders', 'teneffus', 'sinav', 'odev', 'karne', 'mudur', 'school', 'classroom', 'teacher', 'student', 'homework', 'exam', 'lesson', 'hocam'], base: 'classroom', outdoors: 'schoolyard', fallback: 'student', concept: 'A school' },
  hospital: { words: ['hastane', 'doktor', 'hemsire', 'ameliyat', 'hospital', 'doctor', 'nurse', 'surgery', 'recete', 'muayene', 'serum'], base: 'hospital', concept: 'A hospital' },
};
const OUTDOOR = ['bahce', 'avlu', 'disari', 'garden', 'yard', 'outside', 'teneffus'], TOWN = ['pazar', 'carsi', 'sokak', 'market', 'bazaar', 'street'];

const INK = '#22304A', GOLD = '#E3A72F';
// A costume comes only from a title or job, never from a given name alone.
export const ROLES = {
  lady: { world: 'ottoman', name: ['valide', 'hatun', 'hurrem'], address: ['validem', 'hatunum'], costume: { head: 'tiara', body: 'dress' }, colors: { body: '#2F7F7A', accent: GOLD } },
  sultan: { world: 'ottoman', name: ['hunkar', 'padisah', 'kanuni', 'halife'], address: ['hunkarim', 'sultanim', 'padisahim'], costume: { head: 'sultan-kavuk', body: 'kaftan', face: 'beard' }, colors: { body: '#7A1F2B', accent: GOLD, hair: '#2B2018', legs: INK } },
  prince: { world: 'ottoman', name: ['sehzade'], address: ['sehzadem'], costume: { head: 'turban', body: 'kaftan' }, colors: { body: '#3A78C3', accent: GOLD, legs: INK } },
  pasha: { world: 'ottoman', name: ['pasa', 'vezir', 'sadrazam', 'serasker'], address: ['pasam', 'vezirim', 'sadrazamim'], costume: { head: 'kavuk', body: 'kaftan', face: 'beard' }, colors: { body: '#2F7F7A', accent: GOLD, hair: '#3A3024', legs: INK } },
  janissary: { world: 'ottoman', name: ['yeniceri', 'sipahi', 'nefer'], address: ['agam'], costume: { head: 'bork', body: 'robe', face: 'mustache' }, colors: { body: '#7A1F2B', accent: GOLD, hair: '#3A3024', legs: INK } },
  scholar: { world: 'ottoman', name: ['kadi', 'muderris', 'seyh', 'mufti'], address: ['kadim'], costume: { head: 'turban', body: 'robe', face: 'long-beard' }, colors: { body: INK, accent: GOLD, hair: '#BFBFBF' } },
  courtier: { costume: { head: 'turban', body: 'robe' }, colors: { body: '#2F7F7A', accent: GOLD } },
  king: { name: ['kral', 'king', 'imparator', 'emperor'], address: ['kralim', 'majesteleri', 'majesty'], costume: { head: 'crown', body: 'cloak' }, colors: { body: '#7A1F2B', accent: GOLD } },
  queen: { name: ['kralice', 'queen', 'prenses', 'princess'], address: ['kralicem', 'prensesim'], costume: { head: 'tiara', body: 'dress' }, colors: { body: '#7E57C2', accent: GOLD } },
  knight: { name: ['sovalye', 'knight'], address: ['sovalyem'], costume: { head: 'knight-helmet', body: 'armor' }, colors: { body: '#22304A', accent: '#D9653B' } },
  wizard: { name: ['buyucu', 'wizard', 'mage', 'cadi', 'witch'], costume: { head: 'witch-hat', body: 'robe' }, colors: { body: '#7E57C2', accent: GOLD } },
  pirate: { name: ['korsan', 'pirate', 'kaptan'], costume: { head: 'pirate-hat', body: 'vest' }, colors: { body: '#F3EBDD', accent: '#7A1F2B' } },
  villager: { costume: { head: 'bandana', body: 'overalls' }, colors: { body: '#E3A72F', accent: '#2F7F7A' } },
  teacher: { name: ['ogretmen', 'teacher', 'muallim', 'profesor', 'professor', 'mudur', 'principal'], address: ['hocam', 'ogretmenim', 'mudurum', 'professor'], costume: { body: 'suit' }, colors: { body: '#22304A', accent: '#D9653B' }, accessories: ['glasses'] },
  student: { name: ['ogrenci', 'talebe', 'student'], costume: { body: 'uniform' }, colors: { body: '#3A78C3', accent: '#D9653B' } },
  doctor: { name: ['doktor', 'doctor', 'hekim', 'cerrah', 'surgeon'], address: ['doktorum', 'doktor'], costume: { body: 'lab-coat' }, colors: { body: '#3A78C3', accent: '#2F7F7A' } },
  nurse: { name: ['hemsire', 'nurse'], address: ['hemsire', 'hemsirem'], costume: { head: 'nurse-cap', body: 'lab-coat' }, colors: { body: '#4F9A5A', accent: '#D9653B' } },
  police: { name: ['polis', 'police', 'komiser', 'detective', 'dedektif'], address: ['komiserim', 'polis'], costume: { head: 'police-cap', body: 'uniform' }, colors: { body: '#22304A', accent: '#E3A72F' } },
  soldier: { name: ['asker', 'soldier', 'komutan', 'general', 'yuzbasi'], address: ['komutanim', 'yuzbasim'], costume: { head: 'cap', body: 'uniform' }, colors: { body: '#4F9A5A', accent: '#22304A' } },
  chef: { name: ['asci', 'sef', 'chef', 'cook'], address: ['sefim', 'ustam'], costume: { head: 'chef-hat', body: 'apron' }, colors: { body: '#F3EBDD', accent: '#D9653B' } },
  waiter: { name: ['garson', 'waiter'], address: ['garson'], costume: { body: 'vest' }, colors: { body: '#F3EBDD', accent: '#22304A' } },
  farmer: { name: ['ciftci', 'farmer', 'koylu', 'cuban', 'shepherd', 'balikci', 'fisherman'], costume: { head: 'straw-hat', body: 'overalls' }, colors: { body: '#E3A72F', accent: '#3A78C3' } },
  builder: { name: ['insaatci', 'isci', 'builder', 'worker'], costume: { head: 'hard-hat', body: 'overalls' }, colors: { body: '#3A78C3', accent: '#E3A72F' } },
};

function detectWorld(words) {
  let best = null, score = 1; // at least two different clues
  for (const [id, w] of Object.entries(WORLDS)) { const n = hit(words, w.words).length; if (n > score) { best = id; score = n; } }
  return best;
}

function detectRoles(dialogue, world) {
  const votes = {}, add = (id, role, n) => { (votes[id] ||= {})[role] = (votes[id][role] || 0) + n; };
  const speakers = dialogue.speakers.filter((s) => !s.narrator);
  for (const sp of speakers) {
    const words = foldWords(sp.name);
    // "Hürrem Sultan" is a lady of the court, "Sultan Selim" and "Sultan" are the ruler
    if (words.length > 1 && words[words.length - 1] === 'sultan') add(sp.id, 'lady', 6);
    else if (words.includes('sultan')) add(sp.id, 'sultan', 6);
    for (const [role, r] of Object.entries(ROLES)) if (r.name && hit(words, r.name).length && (!r.world || r.world === world || words.length)) add(sp.id, role, 5);
  }
  // being called "hünkârım" makes the person spoken to a sultan
  const lines = dialogue.lines.filter((l) => !l.voiceOver);
  lines.forEach((l, i) => {
    const words = foldWords(l.text);
    const near = [lines[i - 1], lines[i + 1], lines[i - 2], lines[i + 2]].find((x) => x && x.speaker !== l.speaker && x.scene === l.scene);
    if (!near) return;
    for (const [role, r] of Object.entries(ROLES)) if (r.address && (!r.world || r.world === world) && hit(words, r.address).length) add(near.speaker, role, 2);
  });
  const out = {};
  for (const sp of speakers) {
    const v = Object.entries(votes[sp.id] || {}).sort((a, b) => b[1] - a[1])[0];
    out[sp.id] = v ? v[0] : (WORLDS[world]?.fallback || null);
  }
  return out;
}

const textOf = (dialogue, s) => [s.label || '', ...dialogue.lines.filter((l) => l.scene === s.id).map((l) => l.text), ...(dialogue.beats || []).filter((b) => b.scene === s.id).map((b) => b.text)].join(' ');

/** A first design from words alone. Deterministic, and meant to be improved. */
export function draftDesign(dialogue) {
  const all = foldWords([dialogue.title || '', ...dialogue.speakers.map((s) => s.name), ...dialogue.scenes.map((s) => textOf(dialogue, s))].join(' '));
  const world = detectWorld(all), W = WORLDS[world];
  const scenes = dialogue.scenes.map((s) => {
    const text = textOf(dialogue, s), w = foldWords(text);
    let base = s.setting || findSetting(s.label || '');
    if (!base && W) base = (W.town && hit(w, TOWN).length && W.town) || (W.outdoors && hit(w, OUTDOOR).length && W.outdoors) || W.base;
    if (!base) base = findSetting(text) || 'living-room';
    const night = hit(w, ['gece', 'iftar', 'aksam', 'night', 'evening', 'midnight', 'karanlik']).length > 0;
    return { scene: s.id, label: s.label || '', base, ...(night ? { night: true } : {}), parts: [] };
  });
  const roles = detectRoles(dialogue, world), characters = {};
  for (const [id, role] of Object.entries(roles)) {
    if (!role) continue;
    const r = ROLES[role];
    characters[id] = { role, costume: { ...r.costume }, colors: { ...r.colors }, ...(r.accessories ? { accessories: [...r.accessories] } : {}) };
  }
  return { status: 'draft', concept: W?.concept || 'Everyday life today', scenes, characters };
}

// ---------------- shapes ----------------
const ALIAS = { rect: 'rrect', rectangle: 'rrect', polygon: 'poly', polyline: 'stroke', line: 'stroke' };
function moved(s, dx, dy) {
  if (s.pts) return { ...s, pts: s.pts.map(([x, y]) => [x + dx, y + dy]) };
  if (s.cmds) return { ...s, cmds: s.cmds.map((c) => c.map((v, i) => (i === 0 ? v : v + (i % 2 ? dx : dy)))) };
  return { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy };
}
function mirrored(s) {
  if (s.pts) return { ...s, pts: s.pts.map(([x, y]) => [-x, y]) };
  if (s.cmds) return { ...s, cmds: s.cmds.map((c) => c.map((v, i) => (i && i % 2 ? -v : v))) };
  if (s.k === 'rrect') return { ...s, x: -s.x - s.w };
  return { ...s, x: -(s.x || 0), ...(s.rot ? { rot: -s.rot } : {}) };
}

/** Turn a design's shapes into plain engine shapes: aliases resolved, repeat and mirror expanded, colours fixed. */
export function expandShapes(list = [], fill = (c) => c) {
  const out = [];
  for (const raw of list) {
    const k = ALIAS[raw.k] || raw.k;
    if (k === 'repeat') { const inner = expandShapes(raw.items, fill); for (let i = 0; i < (raw.n || 1); i++) out.push(...inner.map((s) => moved(s, i * (raw.dx || 0), i * (raw.dy || 0)))); continue; }
    if (k === 'mirror') { const inner = expandShapes(raw.items, fill); out.push(...inner, ...inner.map(mirrored)); continue; }
    const s = { ...raw, k, fill: fill(raw.fill || 'dark') };
    if (k === 'rrect') s.r = raw.r || 0;
    if (k === 'stroke') s.w = raw.w || 8;
    out.push(s);
  }
  return out;
}

/** Colour resolver: palette roles stay roles; everything else becomes a hex snapped to a locked palette. */
export function makeFill(style, own = []) {
  const pal = style.palette, hexes = [...new Set(Object.values(pal.roles))];
  return (c) => {
    if (!c) return 'dark';
    if (ROLE_COLORS.includes(c) || own.includes(c)) return c;
    const hex = normalizeColor(c);
    if (!hex) return 'dark';
    return pal.lockToPalette !== false ? nearest(hex, hexes) : hex;
  };
}

/** Parts of one scene as storyboard props. */
export function propsFromDesign(sd, sceneId, fill) {
  return (sd?.parts || []).map((p, j) => {
    const base = { id: `${sceneId}-d${j + 1}`, x: p.x || 0, y: p.y || 0, s: p.s || 1, ...(p.flip ? { flip: true } : {}), ...(p.layer ? { layer: p.layer } : {}) };
    if (p.use) return { ...base, type: p.use, ...(p.opts ? { opts: p.opts } : {}) };
    const draw = expandShapes(p.draw, fill), b = boundsOf(draw);
    return { ...base, type: 'custom', name: p.name || 'drawn', draw, w: Math.round(Math.max(b.x1, -b.x0) * 2), h: Math.round(Math.max(1, -b.y0)) };
  });
}

function boundsOf(items) {
  const pts = flatten(items).flatMap((s) => s.abs || []);
  return pts.length ? bbox(pts) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
}

export function designFor(design, scene, index) {
  const list = design?.scenes || [];
  return list.find((d) => d.scene === scene.id) || list.find((d) => d.label && scene.label && foldKey(d.label) === foldKey(scene.label)) || (list[index] && !list[index].scene ? list[index] : null);
}

// ---------------- checking ----------------
function suggest(name, options) {
  const dist = (a, b) => { const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; };
  const best = options.map((o) => [o, dist(String(name), o)]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, String(name).length / 3) ? ` Did you mean "${best[0]}"?` : '';
}

function checkShapes(list, where, colors, errors) {
  for (const s of list || []) {
    if (s.items) { checkShapes(s.items, where, colors, errors); continue; }
    if (s.fill && !colors.includes(s.fill) && !normalizeColor(s.fill)) errors.push(`${where}: colour "${s.fill}" is not a palette role, a hex value or a colour word.${suggest(s.fill, colors)}`);
    const k = ALIAS[s.k] || s.k;
    const need = { rrect: ['x', 'y', 'w', 'h'], circle: ['x', 'y', 'r'], ring: ['x', 'y', 'r', 'w'], ellipse: ['x', 'y', 'rx', 'ry'], poly: ['pts'], stroke: ['pts'], path: ['cmds'] }[k] || [];
    for (const f of need) if (s[f] === undefined) errors.push(`${where}: a "${s.k}" shape needs "${f}"`);
  }
}

/** Returns { errors, warnings }. Errors stop the pipeline; warnings are advice. */
export function checkDesign(design, dialogue) {
  const errors = [], warnings = [];
  const { errors: schema } = validate(design, loadSchema('design'));
  if (schema.length) return { errors: schema.map((e) => e.replace(/^\$\.?/, 'design.json ')), warnings };
  const sceneIds = (dialogue?.scenes || []).map((s) => s.id);
  (design.scenes || []).forEach((d, i) => {
    const at = `scene ${d.scene || i + 1}`;
    if (d.scene && dialogue && !sceneIds.includes(d.scene)) errors.push(`${at}: this script has no such scene (it has ${sceneIds.join(', ')})`);
    if (d.base && d.base !== 'none' && !SETTINGS.includes(d.base)) errors.push(`${at}: there is no ready-made set "${d.base}".${suggest(d.base, SETTINGS)} Use "none" for a bare stage.`);
    let visible = 0, shapes = 0;
    (d.parts || []).forEach((p, j) => {
      const where = `${at}, part ${j + 1}${p.use || p.name ? ` (${p.use || p.name})` : ''}`;
      if (!p.use && !p.draw) { errors.push(`${where}: needs "use" (a catalogue part) or "draw" (your own shapes)`); return; }
      if (p.use && !PROP_TYPES.includes(p.use)) { errors.push(`${where}: there is no part "${p.use}".${suggest(p.use, PROP_TYPES)} Draw it instead with "draw".`); return; }
      if (p.draw) checkShapes(p.draw, where, ROLE_COLORS, errors);
      if (errors.length) return;
      const s = p.s || 1, items = p.use ? propGeometry(p.use, p.opts || {}).items : expandShapes(p.draw), b = boundsOf(items);
      shapes += flatten(items).length;
      const x0 = (p.x || 0) + b.x0 * s, x1 = (p.x || 0) + b.x1 * s, top = (p.y || 0) + b.y0 * s;
      if (x1 > -HALF_VIEW && x0 < HALF_VIEW) visible++;
      if (p.layer === 'front' && top < -520) warnings.push(`${where}: it is in front of the characters and reaches their faces`);
    });
    if (shapes > 1500) warnings.push(`${at}: ${shapes} shapes will slow rendering down; use fewer or larger pieces`);
    if ((!d.base || d.base === 'none') && visible < 4) warnings.push(`${at}: only ${visible} part(s) are inside a 9:16 frame (x between -${HALF_VIEW} and ${HALF_VIEW}), so the scene will look empty`);
  });
  const ids = (dialogue?.speakers || []).filter((s) => !s.narrator).map((s) => s.id);
  for (const [id, ch] of Object.entries(design.characters || {})) {
    if (dialogue && !ids.includes(id)) { errors.push(`character "${id}": no such speaker (the speakers are ${ids.join(', ')})`); continue; }
    const c = ch.costume || {};
    if (c.head && !HEADWEAR[c.head]) errors.push(`character "${id}": no headwear "${c.head}".${suggest(c.head, Object.keys(HEADWEAR))} Draw it with costume.custom.hat.`);
    if (c.body && !GARMENTS[c.body]) errors.push(`character "${id}": no garment "${c.body}".${suggest(c.body, Object.keys(GARMENTS))} Draw it with costume.custom.body.`);
    if (c.face && !FACEWEAR[c.face]) errors.push(`character "${id}": no face piece "${c.face}".${suggest(c.face, Object.keys(FACEWEAR))}`);
    for (const part of ['hat', 'back', 'face', 'body']) checkShapes(c.custom?.[part], `character "${id}", costume.custom.${part}`, [...ROLE_COLORS, ...OWN_COLORS], errors);
  }
  for (const id of ids) { const c = design.characters?.[id]?.costume; if (!c || (!c.head && !c.body && !c.custom)) warnings.push(`character "${id}" has no costume, so they will wear plain generated clothes`); }
  return { errors, warnings };
}

/** The design to use: the project's design.json, or an automatic draft. Throws when design.json is broken. */
export function resolveDesign(files, dialogue) {
  const file = path.join(files.dir, DESIGN_FILE);
  if (!exists(file)) return { ...draftDesign(dialogue), source: 'automatic from the script' };
  const design = readJSON(file);
  const { errors } = checkDesign(design, dialogue);
  if (errors.length) throw new Error(`${DESIGN_FILE} has problems:\n${errors.map((e) => '  - ' + e).join('\n')}`);
  return { ...design, source: `${DESIGN_FILE} (${design.status || 'final'})` };
}

/** What `da next` needs to know. */
export function designState(files, dialogue) {
  const file = path.join(files.dir, DESIGN_FILE);
  if (!exists(file)) return { exists: false, file, status: null, errors: [], warnings: [] };
  let design;
  try { design = readJSON(file); } catch (e) { return { exists: true, file, status: null, errors: [`${DESIGN_FILE} is not valid JSON: ${e.message}`], warnings: [] }; }
  return { exists: true, file, status: design.status || 'final', ...checkDesign(design, dialogue) };
}

// ---------------- catalogue and CLI ----------------
const GROUPS = {
  palace: ['tile-band', 'lattice-window', 'arch', 'arcade', 'niche', 'drape', 'carpet', 'column', 'calligraphy', 'brazier', 'ewer', 'tray', 'cushion', 'throne', 'banner', 'chandelier', 'kandil', 'divan', 'sofra', 'bowl', 'door'],
  school: ['blackboard', 'school-desk', 'teacher-desk', 'wall-map', 'globe', 'lockers', 'poster', 'backpack', 'book-stack', 'school-building', 'flagpole', 'basket-hoop'],
  nature: ['tree', 'pine', 'cypress', 'bush', 'grass', 'flowers', 'rock', 'mountain', 'sea', 'palm', 'dune', 'cactus', 'tent', 'campfire', 'well', 'sun', 'moon', 'stars', 'cloud', 'gull', 'boat', 'beach-umbrella', 'fence'],
  town: ['building', 'house', 'windmill', 'skyline', 'bazaar-stall', 'lantern', 'barrel', 'fountain', 'streetlamp', 'bench', 'awning'],
};

export function catalog() {
  const inGroup = new Set(Object.values(GROUPS).flat());
  const groups = { ...GROUPS, indoors: PROP_TYPES.filter((t) => !inGroup.has(t)) };
  const size = (t) => { const g = propGeometry(t, {}); return `${t} ${Math.round(g.w)}x${Math.round(g.h)}`; };
  return { sets: SETTINGS, parts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.filter((t) => PROP_TYPES.includes(t)).map(size)])), costumes: { head: Object.keys(HEADWEAR), body: Object.keys(GARMENTS), face: Object.keys(FACEWEAR) }, colors: { palette: ROLE_COLORS, ownOfTheCharacter: OWN_COLORS } };
}

export async function cli(args) {
  if (args.catalog) {
    const cat = catalog();
    if (args.json) { console.log(JSON.stringify(cat, null, 1)); return 0; }
    console.log(paint.bold('SETS') + ' ("base" of a scene, or "none" for a bare stage)\n  ' + cat.sets.join(', '));
    console.log(paint.bold('\nPARTS') + ' ("use" in a scene, name width x height in stage units; characters are 900 tall)');
    for (const [g, list] of Object.entries(cat.parts)) console.log(`  ${g}: ${list.join(', ')}`);
    console.log(paint.bold('\nCOSTUMES') + `\n  head: ${cat.costumes.head.join(', ')}\n  body: ${cat.costumes.body.join(', ')}\n  face: ${cat.costumes.face.join(', ')}`);
    console.log(paint.bold('\nCOLOURS') + ` (they follow the style pack)\n  ${cat.colors.palette.join(', ')}\n  on a costume also: ${cat.colors.ownOfTheCharacter.join(', ')}`);
    return 0;
  }
  const dir = path.resolve(args._[0] || '.');
  const files = scanProject(dir), file = path.join(dir, DESIGN_FILE);
  const dialoguePath = path.join(files.build, 'dialogue.json');
  if (!exists(dialoguePath)) await (await import('./parse.mjs')).run(dir, args);
  const dialogue = readJSON(dialoguePath);
  if (!exists(file) || args.redo) {
    const d = draftDesign(dialogue);
    writeJSON(file, d);
    log.ok(`${rel(file)}: first draft (${d.concept})`);
    for (const s of d.scenes) log.info(`${s.scene}: ${s.base}${s.night ? ', night' : ''}`);
    for (const [id, ch] of Object.entries(d.characters)) log.info(`${id}: ${ch.role} (${Object.values(ch.costume).join(', ')})`);
    return 0;
  }
  const design = readJSON(file);
  const { errors, warnings } = checkDesign(design, dialogue);
  for (const w of warnings) log.warn(w);
  if (errors.length) { for (const e of errors) log.err(e); return 1; }
  if (args.accept) { design.status = 'final'; writeJSON(file, design); log.ok(`${rel(file)}: accepted`); return 0; }
  log.ok(`${rel(file)}: valid (${design.status || 'final'}), ${warnings.length} warning(s)`);
  return 0;
}
