// staging.json: what actually HAPPENS in a video. Who walks where, what they carry, take, hide or give, and
// where the camera goes. An agent writes it from the story; without one the draft below is used.
//   da stage <dir>            writes a first draft and prints the timed script
//   da stage <dir> --check    validates it
//   da stage <dir> --accept   marks it final as it is
//   da stage <dir> --sheet    prints the timed script again
import path from 'node:path';
import { readJSON, writeJSON, exists, log, rel } from '../lib/util.mjs';
import { foldKey } from '../lib/text.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { scanProject } from './config.mjs';
import { foldWords, STAGE_VERBS, CARRY_WORDS } from './lexicon.mjs';
import { GESTURES } from '../engine/poses.mjs';
import { EXPRESSION_NAMES as EXPRESSIONS } from '../engine/expressions.mjs';
import { PROP_TYPES } from '../engine/props.mjs';
import { resolveSfx } from '../audio/sfx.mjs';

export const STAGING_FILE = 'staging.json';
const ON_STAGE = (dialogue, s) => dialogue.speakers.filter((x) => !x.narrator && (dialogue.lines.some((l) => l.scene === s.id && l.speaker === x.id && !l.voiceOver) || (s.cast || []).includes(x.id))).map((x) => x.id);

// ---------------- the draft: every verb the script gives, plus a way in ----------------
function namesOf(dialogue) {
  const names = {};
  for (const s of dialogue.speakers) { names[foldKey(s.name.split(/\s+/)[0])] = s.id; names[foldKey(s.name)] = s.id; }
  return names;
}

/** What a piece of text says is going on: [{ verb, who, objects }] in order. */
export function readDirections(text, names, fallback = null) {
  const out = [];
  for (const sentence of String(text).split(/(?<=[.!?…])\s+/).filter((x) => x.trim())) {
    const words = foldWords(sentence), k = ` ${words.join(' ')} `;
    let who = fallback, best = Infinity;
    for (const [nm, id] of Object.entries(names)) { const i = k.indexOf(` ${nm}`); if (i >= 0 && i < best) { best = i; who = id; } }
    const objects = [];
    for (const w of words) for (const [key, part] of Object.entries(CARRY_WORDS)) { const noun = key.replace('$', ''), hit = key.endsWith('$') ? w === noun || w === `${noun}s` : w.startsWith(noun); if (hit && !objects.some((o) => o.noun === noun)) objects.push({ noun, part }); }
    for (const v of STAGE_VERBS) if (v.stems.some((s) => k.includes(` ${s}`))) out.push({ verb: v.do, who, objects, text: sentence.trim() });
  }
  return out;
}

export function draftStaging(dialogue, design = null) {
  const names = namesOf(dialogue);
  const scenes = dialogue.scenes.map((s, si) => {
    const cast = ON_STAGE(dialogue, s), lines = dialogue.lines.filter((l) => l.scene === s.id), beats = (dialogue.beats || []).filter((b) => b.scene === s.id);
    const out = { scene: s.id, keepScriptActions: true, objects: {}, start: {}, do: [] };
    const parts = (design?.scenes || []).find((d) => d.scene === s.id)?.parts || [];
    const need = (o) => {
      if (out.objects[o.noun]) return;
      const part = parts.find((p) => foldWords(p.name || '').some((w) => w.startsWith(o.noun)));
      out.objects[o.noun] = part ? { part: part.name } : { use: o.part, hidden: true };
    };
    const held = {};
    const seated = / (sofra|iftar|oturuyor|otururlar|sitting|seated|dinner)/.test(` ${foldWords([s.label || '', ...beats.map((b) => b.text)].join(' ')).join(' ')} `);
    const steps = [];
    for (const b of beats) {
      let at = 0;
      for (const d of readDirections(b.text, names, lines.find((l) => l.beat === b.id && !l.voiceOver)?.speaker || null)) {
        const when = at ? `b${b.id.slice(1)}+${at.toFixed(1)}` : `b${b.id.slice(1)}`;
        if (d.who && cast.includes(d.who)) steps.push({ ...d, when });
        at += 1.1;
      }
    }
    for (const l of lines) for (const dir of l.directions || []) for (const d of readDirections(dir, names, l.speaker)) if (d.who && cast.includes(d.who)) steps.push({ ...d, when: `l${l.index}` });
    const first = cast[0];
    for (const st of steps) {
      // people at a table stay at the table; the script's own "sets the bowl down" is enough
      if (seated && (st.verb === 'put' || st.verb === 'carry')) continue;
      const pick = /^(tr|und)/.test(dialogue.language || 'tr') ? st.objects[st.objects.length - 1] : st.objects[0];
      if (pick) need(pick);
      const other = cast.find((c) => c !== st.who);
      switch (st.verb) {
        case 'walk': out.do.push({ at: st.when, who: st.who, walk: other || 'off-right' }); break;
        case 'run': out.do.push({ at: st.when, who: st.who, run: other || 'off-right' }); break;
        case 'approach': if (other) out.do.push({ at: st.when, who: st.who, walk: other }); break;
        case 'leave': out.do.push({ at: st.when, who: st.who, walk: 'off-right' }); break;
        case 'take': if (pick && !held[pick.noun]) { held[pick.noun] = st.who; out.do.push({ at: st.when, who: st.who, take: pick.noun }); } break;
        case 'put':
          if (pick) {
            if (!held[pick.noun]) { held[pick.noun] = st.who; out.start[st.who] = { ...(out.start[st.who] || {}), holding: pick.noun, x: -1500 }; out.objects[pick.noun] = { ...out.objects[pick.noun], hold: 'both' }; }
            out.do.push({ at: st.when, who: st.who, put: pick.noun, quiet: true });
            delete held[pick.noun];
          }
          break;
        case 'carry':
          if (pick && !held[pick.noun]) { held[pick.noun] = st.who; out.start[st.who] = { ...(out.start[st.who] || {}), holding: pick.noun, x: -1500 }; out.objects[pick.noun] = { ...out.objects[pick.noun], hold: 'both' }; }
          break;
        case 'give': if (pick && other) { if (!held[pick.noun]) { held[pick.noun] = st.who; out.do.push({ at: st.when, who: st.who, take: pick.noun }); } out.do.push({ at: `+0.2`, who: st.who, give: pick.noun, to: other }); held[pick.noun] = other; } break;
        case 'hide': if (pick) { if (!held[pick.noun]) { held[pick.noun] = st.who; out.do.push({ at: st.when, who: st.who, take: pick.noun }); out.do.push({ at: '+0.1', who: st.who, hide: pick.noun }); } else out.do.push({ at: st.when, who: st.who, hide: pick.noun }); } break;
        case 'look': { const target = pick?.noun || other; if (target) out.do.push({ at: st.when, who: st.who, look: target }); break; }
        default:
      }
    }
    // everybody has to come from somewhere: whoever carries something, or the first to speak, walks in
    const walker = Object.keys(out.start)[0] || (!seated && first && (si === 0 || cast.length > 1) ? first : null);
    const walking = out.do.some((a) => a.who === walker && (a.walk !== undefined || a.run !== undefined));
    if (walker && !walking && !seated) {
      out.start[walker] = { x: -1500, ...(out.start[walker] || {}) };
      const firstBeat = beats[0];
      out.do.unshift({ at: firstBeat ? `b${firstBeat.id.slice(1)}` : 0, who: walker, walk: 'home', dur: 2.6 });
    }
    // a walked-in object must be set down near the door of the action, after the arrival
    for (const a of out.do) if (a.put !== undefined && a.who === walker && typeof a.at === 'string' && a.at.startsWith('b') && !a.at.includes('+')) a.at += '+2.7';
    // the people react with their bodies: strong lines close the distance or open it
    if (cast.length > 1) for (const l of lines) {
      if (l.voiceOver) continue;
      if (['angry', 'surprised'].includes(l.emotion)) out.do.push({ at: `l${l.index}`, who: l.speaker, step: 'toward', by: 150 });
      else if (['scared', 'sad'].includes(l.emotion)) out.do.push({ at: `l${l.index}`, who: l.speaker, step: 'back', by: 130 });
    }
    return out;
  });
  return { status: 'draft', idea: 'Automatic: the verbs found in the script, an entrance, and small steps on strong lines.', scenes };
}

// ---------------- checking ----------------
function suggest(name, options) {
  const k = foldKey(String(name));
  const best = options.find((o) => foldKey(o).startsWith(k.slice(0, 3)));
  return best ? ` Did you mean "${best}"?` : '';
}

/** Returns { errors, warnings }. Errors stop the pipeline; warnings are advice. */
export function checkStaging(staging, dialogue, design = null, sfxFiles = []) {
  const errors = [], warnings = [];
  const { errors: schema } = validate(staging, loadSchema('staging'));
  if (schema.length) return { errors: schema.map((e) => e.replace(/^\$\.?/, 'staging.json ')), warnings };
  const lineN = new Set(dialogue.lines.map((l) => l.index)), beatN = new Set((dialogue.beats || []).map((b) => +b.id.slice(1)));
  const checkAt = (at, where) => {
    if (at === undefined || typeof at === 'number') return;
    const s = String(at).trim();
    if (/^\+\s*[\d.]+$/.test(s)) return;
    const m = s.match(/^([lb])0*(\d+)(\.end)?\s*([+-]\s*[\d.]+)?$/i);
    if (!m) { errors.push(`${where}: "${at}" is not a time. Use seconds, l3, l3.end, b2, b2+1.5 or +0.5`); return; }
    if (m[1].toLowerCase() === 'l' ? !lineN.has(+m[2]) : !beatN.has(+m[2])) errors.push(`${where}: this script has no ${m[1]}${m[2]}`);
  };
  for (const [i, sd] of (staging.scenes || []).entries()) {
    const s = dialogue.scenes.find((x) => x.id === sd.scene);
    const at = `scene ${sd.scene || i + 1}`;
    if (!s) { errors.push(`${at}: this script has no such scene (it has ${dialogue.scenes.map((x) => x.id).join(', ')})`); continue; }
    const cast = ON_STAGE(dialogue, s), objects = Object.keys(sd.objects || {});
    const parts = (design?.scenes || []).find((d) => d.scene === s.id)?.parts || [];
    const whoOk = (who, where) => { if (!cast.includes(who)) errors.push(`${where}: "${who}" is not on stage in this scene (on stage: ${cast.join(', ') || 'nobody'}). To bring in somebody who does not speak, add "@cast ${who}" to dialogue.md.${suggest(who, cast)}`); };
    for (const [name, o] of Object.entries(sd.objects || {})) {
      const where = `${at}, object "${name}"`;
      if (o.part && !parts.some((p) => p.name && foldKey(p.name).includes(foldKey(o.part))) && !PROP_TYPES.includes(o.part)) errors.push(`${where}: design.json has no part named "${o.part}" in this scene`);
      if (!o.part && !o.draw && !o.use) errors.push(`${where}: needs "part" (a named part of design.json), "use" (a catalogue part) or "draw" (your own shapes)`);
      if (o.use && !PROP_TYPES.includes(o.use)) errors.push(`${where}: there is no catalogue part "${o.use}".${suggest(o.use, PROP_TYPES)} Draw it with "draw".`);
      if (o.draw && !o.h) warnings.push(`${where}: give "w" and "h" (its size) so the hands hold it in the right place and the camera can frame it`);
    }
    for (const [id, st] of Object.entries(sd.start || {})) {
      whoOk(id, `${at}, start`);
      if (st.holding && !objects.includes(st.holding)) errors.push(`${at}, start of ${id}: no object "${st.holding}" in this scene.${suggest(st.holding, objects)}`);
    }
    const objTargets = ['take', 'put', 'give', 'hide', 'show', 'object'];
    const targetOk = (v, where) => { if (typeof v === 'number' || ['left', 'right', 'up', 'down', 'home', 'off-left', 'off-right'].includes(v)) return; if (!cast.includes(v) && !objects.includes(v)) errors.push(`${where}: "${v}" is neither on stage nor an object of this scene.${suggest(v, [...cast, ...objects])}`); };
    (sd.do || []).forEach((a, j) => {
      const where = `${at}, do[${j}]`;
      checkAt(a.at, where);
      if (a.who !== undefined) whoOk(a.who, where);
      for (const k of objTargets) if (a[k] !== undefined && !objects.includes(a[k])) errors.push(`${where}: no object "${a[k]}" in this scene. Declare it under "objects".${suggest(a[k], objects)}`);
      for (const k of ['walk', 'run', 'sneak', 'turn', 'look']) if (a[k] !== undefined) targetOk(a[k], where);
      if (a.to !== undefined) whoOk(a.to, where);
      if (a.gesture !== undefined && !GESTURES.includes(a.gesture)) errors.push(`${where}: no gesture "${a.gesture}" (there are ${GESTURES.join(', ')})`);
      if (a.face !== undefined && !EXPRESSIONS.includes(a.face)) errors.push(`${where}: no expression "${a.face}" (there are ${EXPRESSIONS.join(', ')})`);
      if (a.sfx !== undefined && !resolveSfx(a.sfx, sfxFiles)) errors.push(`${where}: sound effect "${a.sfx}" is not built in and is not in sfx/`);
      for (const k of ['walk', 'run', 'sneak', 'step', 'turn', 'take', 'put', 'give', 'hide', 'show', 'gesture', 'face', 'look', 'sit', 'stand', 'hidden', 'fx']) if (a[k] !== undefined && a.who === undefined) errors.push(`${where}: "${k}" needs "who"`);
    });
    (sd.camera || []).forEach((c, j) => {
      const where = `${at}, camera[${j}]`;
      checkAt(c.at, where);
      const on = c.on ?? c.follow;
      for (const v of Array.isArray(on) ? on : on === undefined || typeof on === 'number' ? [] : [on]) if (!cast.includes(v) && !objects.includes(v)) errors.push(`${where}: "${v}" is neither on stage nor an object of this scene.${suggest(v, [...cast, ...objects])}`);
    });
    if (!(sd.do || []).length) warnings.push(`${at}: nothing happens in it; "do" is empty`);
  }
  return { errors, warnings };
}

/** The staging to use: the project's staging.json, or an automatic draft. Throws when staging.json is broken. */
export function resolveStaging(files, dialogue, design) {
  const file = path.join(files.dir, STAGING_FILE);
  if (!exists(file)) return { ...draftStaging(dialogue, design), source: 'automatic from the script' };
  const staging = readJSON(file);
  const { errors } = checkStaging(staging, dialogue, design, files.sfx);
  if (errors.length) throw new Error(`${STAGING_FILE} has problems:\n${errors.map((e) => '  - ' + e).join('\n')}`);
  return { ...staging, source: `${STAGING_FILE} (${staging.status || 'final'})` };
}

/** What `da next` needs to know. */
export function stagingState(files, dialogue, design) {
  const file = path.join(files.dir, STAGING_FILE);
  if (!exists(file)) return { exists: false, file, status: null, errors: [], warnings: [] };
  let staging;
  try { staging = readJSON(file); } catch (e) { return { exists: true, file, status: null, errors: [`${STAGING_FILE} is not valid JSON: ${e.message}`], warnings: [] }; }
  return { exists: true, file, status: staging.status || 'final', ...checkStaging(staging, dialogue, design, files.sfx) };
}

/** The script with its times, which is what a director needs in order to write "at". */
export function timedSheet(dialogue, timing) {
  const out = [`Total: ${timing.duration.toFixed(2)} s`];
  for (const s of dialogue.scenes) {
    out.push(``, `SCENE ${s.id}${s.label ? ` "${s.label}"` : ''}  on stage: ${ON_STAGE(dialogue, s).join(', ') || 'nobody'}`);
    const items = [
      ...(dialogue.beats || []).filter((b) => b.scene === s.id).map((b) => ({ t: b.start, text: `${b.id}  ${b.start}-${b.end ?? '?'} s  DIRECTION: ${b.text}` })),
      ...dialogue.lines.filter((l) => l.scene === s.id).map((l) => { const tl = timing.lines.find((x) => x.id === l.id); return { t: tl.start, text: `l${l.index}  ${tl.start.toFixed(2)}-${tl.end.toFixed(2)} s  ${l.speakerName}${l.voiceOver ? ' (heard, not seen)' : ''}: ${l.text}` }; }),
    ].sort((a, b) => a.t - b.t);
    for (const i of items) out.push(`  ${i.text}`);
  }
  return out.join('\n');
}

export async function cli(args) {
  const dir = path.resolve(args._[0] || '.');
  const files = scanProject(dir), file = path.join(dir, STAGING_FILE);
  const b = (f) => path.join(files.build, f);
  if (!exists(b('dialogue.json'))) await (await import('./parse.mjs')).run(dir, args);
  const dialogue = readJSON(b('dialogue.json'));
  const designFile = path.join(dir, 'design.json');
  const design = exists(designFile) ? readJSON(designFile) : null;
  if (args.sheet) {
    if (!exists(b('timing.json'))) await (await import('../audio/align.mjs')).run(dir, args);
    console.log(timedSheet(dialogue, readJSON(b('timing.json'))));
    return 0;
  }
  if (!exists(file) || args.redo) {
    const d = draftStaging(dialogue, design);
    writeJSON(file, d);
    log.ok(`${rel(file)}: first draft (${d.scenes.reduce((n, s) => n + s.do.length, 0)} actions)`);
    if (exists(b('timing.json'))) console.log(`\n${timedSheet(dialogue, readJSON(b('timing.json')))}`);
    return 0;
  }
  const staging = readJSON(file);
  const { errors, warnings } = checkStaging(staging, dialogue, design, files.sfx);
  for (const w of warnings) log.warn(w);
  if (errors.length) { for (const e of errors) log.err(e); return 1; }
  if (args.accept) { staging.status = 'final'; writeJSON(file, staging); log.ok(`${rel(file)}: accepted`); return 0; }
  log.ok(`${rel(file)}: valid (${staging.status || 'final'}), ${warnings.length} warning(s)`);
  return 0;
}
