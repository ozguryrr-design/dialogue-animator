// dialogue.md / .txt / .json -> build/dialogue.json
//
// Text format (one utterance per line):
//   # Title                       first heading = title (optional)
//   ## Kitchen  |  @scene: park   new scene; the words pick a stage setting (optional)
//   Ali: Is the tea gone? [surprised]       [tag] = expression (any language word from lexicon.mjs)
//   Su: (sighs) Yes.                         (direction) or *direction* = gesture/expression hint, not spoken
//   @pause 0.8                               extra silence before the next line (seconds)
// Lines without "Name:" continue the previous line. HTML comments are ignored.
import path from 'node:path';
import { readText, readJSON, writeJSON, log, rel } from '../lib/util.mjs';
import { slug, detectLanguage, tokenize } from '../lib/text.mjs';
import { tagToExpression, inferExpression, parseDirection, isGreeting, findSetting } from './lexicon.mjs';
import { loadConfig, writeDecisions } from './config.mjs';
import { assertValid } from '../lib/schema.mjs';

const SPEAKER_RE = /^\s*(?:[-*•]\s+)?(?:\*\*|__)?([^:：*_\[\]()@#<>]{1,40}?)(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/u;
const SCENE_RE = /^\s*(?:@(?:scene|sahne|mekan|location)\s*[:=]?\s*|\[(?:scene|sahne|mekan)\s*[:=]\s*)(.+?)\]?\s*$/iu;
const PAUSE_RE = /^\s*@(?:pause|duraklama|bekle|wait)\s*[:=]?\s*([\d.,]+)\s*s?\s*$/iu;

function niceName(raw) {
  const n = raw.trim().replace(/\s+/g, ' ');
  // ALL CAPS names ("ALİ") become title case with locale-aware casing.
  if (n === n.toLocaleUpperCase('tr') && /[\p{Lu}]/u.test(n) && n.length > 1) {
    const lower = n.toLocaleLowerCase('tr');
    return lower.split(' ').map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join(' ');
  }
  return n;
}

function looksLikeSpeaker(name) {
  const words = name.trim().split(/\s+/);
  return words.length <= 4 && !/[.!?,;"“”]/.test(name) && !/^\d+$/.test(name.trim()) && !/^https?$/i.test(name.trim());
}

/** Split the raw utterance into spoken text, tags and directions. */
function splitUtterance(raw) {
  const tags = [], directions = [];
  let text = raw.replace(/\[([^\]]+)\]/g, (_, t) => { tags.push(t.trim()); return ' '; });
  text = text.replace(/\(([^)]+)\)/g, (_, d) => { directions.push(d.trim()); return ' '; });
  text = text.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, (_, pre, d) => { directions.push(d.trim()); return pre + ' '; });
  text = text.replace(/\s+/g, ' ').trim();
  return { text, tags, directions };
}

export function parseDialogueText(src, { file = 'dialogue.md' } = {}) {
  const warnings = [];
  const lines = [], speakers = new Map(), scenes = [];
  let title = null, pendingPause = 0, scene = null;
  const body = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
  const newScene = (label, at) => {
    scene = { id: `s${scenes.length + 1}`, label: label.trim(), setting: findSetting(label) || null, line: at };
    scenes.push(scene);
  };
  body.split('\n').forEach((rawLine, i) => {
    const ln = i + 1;
    const t = rawLine.trim();
    if (!t || /^(-{3,}|\*{3,}|_{3,})$/.test(t) || t.startsWith('//') || t.startsWith('>')) return;
    let m;
    if ((m = t.match(/^#\s+(.+)$/))) { if (!title) title = m[1].trim(); else newScene(m[1], ln); return; }
    if ((m = t.match(/^#{2,6}\s+(.+)$/))) { newScene(m[1].replace(/^(scene|sahne|mekan)\s*[:\-–]\s*/i, ''), ln); return; }
    if ((m = t.match(SCENE_RE))) { newScene(m[1], ln); return; }
    if ((m = t.match(PAUSE_RE))) { pendingPause += parseFloat(m[1].replace(',', '.')) || 0; return; }
    if (t.startsWith('@')) { warnings.push(`${file}:${ln}: unknown directive "${t}" ignored`); return; }
    m = t.match(SPEAKER_RE);
    if (m && looksLikeSpeaker(m[1]) && m[2].trim()) {
      const name = niceName(m[1]);
      const id = slug(name);
      if (!speakers.has(id)) speakers.set(id, { id, name });
      if (!scene) newScene('', 0);
      lines.push({ speaker: id, speakerName: speakers.get(id).name, raw: m[2].trim(), scene: scene.id, pauseBefore: pendingPause, srcLine: ln });
      pendingPause = 0;
      return;
    }
    if (lines.length) { lines[lines.length - 1].raw += ' ' + t; return; }
    warnings.push(`${file}:${ln}: text without a speaker ("${t.slice(0, 40)}") — write it as "Name: text"`);
  });
  return finish({ title, lines, speakers: [...speakers.values()], scenes, warnings });
}

export function parseDialogueJSON(obj, { file = 'dialogue.json' } = {}) {
  const arr = Array.isArray(obj) ? obj : obj.lines;
  if (!Array.isArray(arr)) throw new Error(`${file}: expected an array of lines or {"lines": [...]}`);
  const speakers = new Map(), scenes = [], warnings = [];
  const sceneByLabel = new Map();
  const lines = arr.map((l, i) => {
    const name = niceName(l.speaker || l.name || l.character || '');
    const raw = String(l.text ?? l.line ?? '').trim();
    if (!name || !raw) throw new Error(`${file}: line ${i + 1} needs "speaker" and "text"`);
    const id = slug(name);
    if (!speakers.has(id)) speakers.set(id, { id, name });
    const label = l.scene || (scenes.length ? scenes[scenes.length - 1].label : '');
    if (!sceneByLabel.has(label)) { const s = { id: `s${scenes.length + 1}`, label, setting: findSetting(label) || null, line: 0 }; scenes.push(s); sceneByLabel.set(label, s); }
    const extra = [l.emotion ? `[${l.emotion}]` : '', l.direction ? `(${l.direction})` : ''].join(' ');
    return { speaker: id, speakerName: speakers.get(id).name, raw: `${raw} ${extra}`.trim(), scene: sceneByLabel.get(label).id, pauseBefore: +l.pause || 0, srcLine: i + 1, audio: l.audio || null };
  });
  return finish({ title: obj.title || null, lines, speakers: [...speakers.values()], scenes, warnings });
}

function finish({ title, lines, speakers, scenes, warnings }) {
  const out = lines.map((l, i) => {
    const { text, tags, directions } = splitUtterance(l.raw);
    let emotion = null, emotionSource = 'none', gesture = null, trigger = null;
    for (const tg of tags) {
      const e = tagToExpression(tg);
      if (e) { emotion = e; emotionSource = 'tag'; } else warnings.push(`line ${l.srcLine}: unknown tag [${tg}] (known: see src/project/lexicon.mjs TAGS)`);
    }
    for (const d of directions) {
      const p = parseDirection(d);
      if (p.gesture && !gesture) gesture = p.gesture;
      if (p.expression && !emotion) { emotion = p.expression; emotionSource = 'direction'; }
    }
    const inferred = inferExpression(text);
    if (!emotion) { emotion = inferred.expression; emotionSource = inferred.source; }
    trigger = inferred.trigger;
    if (!gesture && isGreeting(text)) gesture = 'wave';
    if (!text) warnings.push(`line ${l.srcLine}: only directions, nothing spoken`);
    return {
      id: `l${String(i + 1).padStart(2, '0')}`,
      index: i + 1,
      speaker: l.speaker,
      speakerName: l.speakerName,
      text,
      words: tokenize(text),
      emotion,
      emotionSource,
      triggerWord: trigger,
      gesture,
      directions,
      scene: l.scene,
      pauseBefore: l.pauseBefore,
      audio: l.audio || null,
      srcLine: l.srcLine,
    };
  });
  const usedScenes = scenes.filter((s) => out.some((l) => l.scene === s.id));
  const allText = out.map((l) => l.text).join(' ');
  return { title, language: detectLanguage(allText), speakers, scenes: usedScenes, lines: out, warnings };
}

export function parseDialogueFile(file) {
  const name = path.basename(file);
  if (file.toLowerCase().endsWith('.json')) return parseDialogueJSON(readJSON(file), { file: name });
  return parseDialogueText(readText(file), { file: name });
}

export async function run(dir, cli = {}) {
  const { cfg, decisions, files } = loadConfig(dir, cli);
  if (!files.dialogue) throw new Error(`No dialogue file in ${files.dir}. Create dialogue.md (see "da doctor").`);
  const d = parseDialogueFile(files.dialogue);
  if (!d.lines.length) throw new Error(`${rel(files.dialogue)} has no "Name: text" lines.`);
  d.title = d.title || cfg.title || path.basename(files.dir);
  if (cfg.language && cfg.language !== 'auto') d.language = cfg.language;
  d.source = rel(files.dialogue, files.dir);
  assertValid(d, 'dialogue');
  writeJSON(path.join(files.build, 'dialogue.json'), d);
  writeDecisions(files, decisions);
  return { dialogue: d, cfg, files, decisions };
}

export async function cli(args) {
  const dir = args._[0] || '.';
  log.step('parse');
  const { dialogue: d, files } = await run(dir, args);
  log.ok(`${d.lines.length} lines, ${d.speakers.length} speakers (${d.speakers.map((s) => s.name).join(', ')}), ${d.scenes.length} scene(s), language ${d.language}`);
  const byEmo = {};
  for (const l of d.lines) byEmo[l.emotion] = (byEmo[l.emotion] || 0) + 1;
  log.info(`expressions: ${Object.entries(byEmo).map(([k, v]) => `${k}×${v}`).join(', ')}`);
  for (const w of d.warnings) log.warn(w);
  log.ok(`wrote ${rel(path.join(files.build, 'dialogue.json'))}`);
  return 0;
}
