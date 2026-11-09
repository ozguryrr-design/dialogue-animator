// dialogue.md / .txt / .json -> build/dialogue.json
//
// Text format (one utterance per line):
//   # Title                       first heading = title (optional)
//   ## Kitchen  |  @scene: park   new scene; the words pick a stage setting (optional)
//   Ali: Is the tea gone? [surprised]       [tag] = expression (any language word from lexicon.mjs)
//   Su: (sighs) Yes.                         (direction) or *direction* = gesture/expression hint, not spoken
//   @pause 0.8                               extra silence before the next line (seconds)
//   Anlatıcı: Text  |  Ali (dış ses): Text   narration: heard, never seen speaking (also Narrator:, @narrator Name)
//   @cast Ali, Su                            who stands in this scene without having to speak
//   @sfx thunder  |  @sfx thunder 12.5 -3dB  a sound effect (from sfx/ or built in), optional time and gain
// Lines without "Name:" continue the previous line. HTML comments are ignored.
import path from 'node:path';
import { readText, readJSON, writeJSON, log, rel } from '../lib/util.mjs';
import { slug, detectLanguage, tokenize, foldKey } from '../lib/text.mjs';
import { tagToExpression, inferExpression, parseDirection, isGreeting, findSetting, parseActions, isNarratorName } from './lexicon.mjs';
import { loadConfig, writeDecisions } from './config.mjs';
import { assertValid } from '../lib/schema.mjs';

const SPEAKER_RE = /^\s*(?:[-*•]\s+)?(?:\*\*|__)?([^:：*_\[\]()@#<>]{1,40}?)(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/u;
const SCENE_RE = /^\s*(?:@(?:scene|sahne|mekan|location)\s*[:=]?\s*|\[(?:scene|sahne|mekan)\s*[:=]\s*)(.+?)\]?\s*$/iu;
const PAUSE_RE = /^\s*@(?:pause|duraklama|bekle|wait)\s*[:=]?\s*([\d.,]+)\s*s?\s*$/iu;
// Timed beats: "0–5 sn — direction", "[0:05-0:10] direction", "@at 12-15: direction", "@at 12.5"
const T = '(\\d{1,2}:\\d{2}(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)';
const U = '\\s*(?:sn|s|sec|saniye|secs|seconds)?\\.?';
const BEAT_RE = new RegExp(`^\\s*(?:@(?:at|beat|zaman)\\s*)?\\[?\\s*${T}${U}\\s*[–—-]\\s*${T}${U}\\s*\\]?\\s*(?:[—–:\\-]\\s*(.*))?$`, 'iu');
const AT_RE = new RegExp(`^\\s*@(?:at|zaman)\\s+${T}${U}\\s*(?:[—–:\\-]\\s*(.*))?$`, 'iu');
const NARRATOR_RE = /^\s*@(?:narrator|anlatici|anlatıcı)\s*[:=]?\s*(.+?)\s*$/iu;
const CAST_RE = /^\s*@(?:cast|sahnede|oyuncular)\s*[:=]?\s*(.+?)\s*$/iu;
const SFX_RE = new RegExp(`^\\s*@(?:sfx|efekt|ses)\\s*[:=]?\\s*(.+?)(?:\\s+(?:at\\s+)?${T}\\s*(?:sn|s|saniye)?)?(?:\\s+([+-]\\d+(?:[.,]\\d+)?)\\s*db)?\\s*$`, 'iu');
const VO_RE = /\s*\((?:v\.?\s*o\.?|d[ıi][şs]\s*ses|d[ıi][şs]\s*anlat[ıi]m|voice[\s-]*over|off[\s-]*screen|ekran\s*d[ıi][şs][ıi])\)(?=\s*[:：])/iu;
const toSec = (s) => { const v = s.replace(',', '.'); if (v.includes(':')) { const [m, x] = v.split(':'); return +m * 60 + +x; } return +v; };

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
  // a line written as a quotation ("…", “…”, «…») is spoken without the outer quote marks
  const q = text.match(/^["“„«](.*)["”»“]$/s);
  if (q) text = q[1].trim();
  return { text, tags, directions };
}

export function parseDialogueText(src, { file = 'dialogue.md' } = {}) {
  const warnings = [];
  const lines = [], speakers = new Map(), scenes = [], beats = [], sfx = [], narrators = new Set();
  let title = null, pendingPause = 0, scene = null, beat = null;
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
    if ((m = t.match(NARRATOR_RE))) { narrators.add(foldKey(m[1])); return; }
    if ((m = t.match(CAST_RE))) {
      if (!scene) newScene('', 0);
      for (const raw of m[1].split(/[,;]/)) {
        const name = niceName(raw);
        if (!name) continue;
        const id = slug(name);
        if (!speakers.has(id)) speakers.set(id, { id, name });
        (scene.cast ||= []).push(id);
      }
      return;
    }
    if ((m = t.match(SFX_RE))) {
      sfx.push({ name: m[1].trim(), at: m[2] ? toSec(m[2]) : null, gainDb: m[3] ? parseFloat(m[3].replace(',', '.')) : 0, beat: beat ? beat.id : null, nextIndex: lines.length, srcLine: ln });
      return;
    }
    if ((m = t.match(/^#\s+(.+)$/))) { if (!title) title = m[1].trim(); else newScene(m[1], ln); return; }
    if ((m = t.match(/^#{2,6}\s+(.+)$/))) { newScene(m[1].replace(/^(scene|sahne|mekan)\s*[:\-–]\s*/i, ''), ln); return; }
    if ((m = t.match(SCENE_RE))) { newScene(m[1], ln); return; }
    if ((m = t.match(PAUSE_RE))) { pendingPause += parseFloat(m[1].replace(',', '.')) || 0; return; }
    // only lines that clearly look like timecodes (unit, brackets, @at or m:ss) start a beat
    if (/^\s*[@[]|\d:\d|^\s*[\d.,]+\s*(sn|s|sec|saniye|seconds?)?\s*[–—-]\s*[\d.,]+\s*(sn|s|sec|saniye|seconds?)\b/iu.test(t) && ((m = t.match(BEAT_RE)) || (m = t.match(AT_RE)))) {
      const isRange = m.length === 4;
      const start = toSec(m[1]), end = isRange ? toSec(m[2]) : null;
      if (!scene) newScene('', 0);
      if (beats.length && beats[beats.length - 1].end === null) beats[beats.length - 1].end = start;
      beat = { id: `b${beats.length + 1}`, start, end, text: ((isRange ? m[3] : m[2]) || '').trim(), scene: scene.id, srcLine: ln };
      if (end !== null && end <= start) warnings.push(`${file}:${ln}: beat ends before it starts (${start}–${end})`);
      beats.push(beat);
      return;
    }
    if (t.startsWith('@')) { warnings.push(`${file}:${ln}: unknown directive "${t}" ignored`); return; }
    const vo = VO_RE.test(t);
    m = t.replace(VO_RE, '').match(SPEAKER_RE);
    if (m && looksLikeSpeaker(m[1]) && m[2].trim()) {
      const name = niceName(m[1]);
      const id = slug(name);
      if (!speakers.has(id)) speakers.set(id, { id, name });
      if (!scene) newScene('', 0);
      lines.push({ speaker: id, speakerName: speakers.get(id).name, raw: m[2].trim(), scene: scene.id, pauseBefore: pendingPause, srcLine: ln, beat: beat ? beat.id : null, voiceOver: vo });
      pendingPause = 0;
      return;
    }
    // a direction on its own line inside a beat belongs to the beat, not to the previous speech
    if (beat && (!lines.length || lines[lines.length - 1].beat !== beat.id)) { beat.text = `${beat.text} ${t}`.trim(); return; }
    if (lines.length) { lines[lines.length - 1].raw += ' ' + t; return; }
    warnings.push(`${file}:${ln}: text without a speaker ("${t.slice(0, 40)}") — write it as "Name: text"`);
  });
  return finish({ title, lines, speakers: [...speakers.values()], scenes, beats, sfx, narrators, warnings });
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
    return { speaker: id, speakerName: speakers.get(id).name, raw: `${raw} ${extra}`.trim(), scene: sceneByLabel.get(label).id, pauseBefore: +l.pause || 0, srcLine: i + 1, audio: l.audio || null, voiceOver: !!(l.voiceOver || l.narrator) };
  });
  const sfx = (obj.sfx || []).map((c) => ({ name: c.name, at: c.at ?? null, gainDb: c.gainDb || 0, beat: null, nextIndex: c.beforeLine ? c.beforeLine - 1 : lines.length, srcLine: 0 }));
  return finish({ title: obj.title || null, lines, speakers: [...speakers.values()], scenes, sfx, warnings });
}

function finish({ title, lines, speakers, scenes, beats = [], sfx = [], narrators = new Set(), warnings }) {
  // names used to find who a direction is about: first name and full name, folded
  const names = {};
  for (const s of speakers) { names[foldKey(s.name.split(/\s+/)[0])] = s.id; names[foldKey(s.name)] = s.id; }
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
    const actions = directions.flatMap((d) => parseActions(d, names, l.speaker)).filter((a) => a.posture || a.sfx || a.door || a.fade || a.noBlink);
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
      beat: l.beat || null,
      voiceOver: !!(l.voiceOver || isNarratorName(l.speakerName) || narrators.has(foldKey(l.speakerName))),
      actions,
      srcLine: l.srcLine,
    };
  });
  const outBeats = beats.map((b, i) => {
    const end = b.end ?? (beats[i + 1] ? beats[i + 1].start : null);
    const firstSpeaker = out.find((l) => l.beat === b.id)?.speaker || null;
    return { id: b.id, start: b.start, end, text: b.text, scene: b.scene, actions: parseActions(b.text, names, firstSpeaker), lines: out.filter((l) => l.beat === b.id).map((l) => l.id) };
  });
  for (let i = 1; i < outBeats.length; i++) if (outBeats[i].start < outBeats[i - 1].start) warnings.push(`beat ${outBeats[i].id} starts before ${outBeats[i - 1].id}`);
  const usedScenes = scenes.filter((s) => out.some((l) => l.scene === s.id) || outBeats.some((b) => b.scene === s.id));
  for (const s of usedScenes) {
    if (!s.setting) s.setting = findSetting([...out.filter((l) => l.scene === s.id).map((l) => l.text), ...outBeats.filter((b) => b.scene === s.id).map((b) => b.text)].join(' ')) || null;
  }
  const allText = out.map((l) => l.text).join(' ');
  // a narrator is a speaker who is only ever heard: no character, no place on stage
  const onStage = new Set(scenes.flatMap((s) => s.cast || []));
  const allSpeakers = speakers.map((s) => {
    const mine = out.filter((l) => l.speaker === s.id);
    return { ...s, narrator: !onStage.has(s.id) && mine.length > 0 && mine.every((l) => l.voiceOver) };
  });
  const cues = sfx.map(({ nextIndex, ...c }) => ({ ...c, nextLine: out[nextIndex]?.id ?? null }));
  return { title, language: detectLanguage(allText), speakers: allSpeakers, scenes: usedScenes, beats: outBeats, sfx: cues, lines: out, warnings };
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
  if (!d.lines.length) throw new Error(`${rel(files.dialogue)} has no "Name: text" lines. Every line needs its speaker in front, like   Ali: Merhaba.   If you cannot tell who says what, ask the user; do not guess.`);
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
  const vo = d.lines.filter((l) => l.voiceOver);
  if (vo.length) log.info(`narration: ${vo.length} line(s), heard but not seen (${[...new Set(vo.map((l) => l.speakerName))].join(', ')})`);
  if (d.sfx.length) log.info(`sound effect cues: ${d.sfx.map((c) => c.name + (c.at !== null ? `@${c.at}s` : '')).join(', ')}`);
  for (const w of d.warnings) log.warn(w);
  log.ok(`wrote ${rel(path.join(files.build, 'dialogue.json'))}`);
  return 0;
}
