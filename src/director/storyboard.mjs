// The director: dialogue + characters + timing + style -> build/storyboard.json
// Every editing rule lives here (and in docs/DIRECTING.md): speaker-focused coverage, shot-reverse-shot,
// reaction and cutaway inserts, rhythm limits, reactions that lead their trigger word, creeping push-ins.
// The output is plain data; any renderer can draw it.
import path from 'node:path';
import { readJSON, writeJSON, writeText, exists, log, rel, round, VERSION } from '../lib/util.mjs';
import { assertValid } from '../lib/schema.mjs';
import { nuclei, isRoundVowel, stripPunct } from '../lib/text.mjs';
import { rng, hash32, clamp } from '../engine/math.mjs';
import { nearest, toLab } from '../engine/color.mjs';
import { BODIES } from '../engine/env.mjs';
import { compose } from '../engine/settings.mjs';
import { propGeometry } from '../engine/props.mjs';
import { REACTION, REACTION_FX } from '../engine/expressions.mjs';
import { loadConfig, writeDecisions } from '../project/config.mjs';
import { findProps, findSetting } from '../project/lexicon.mjs';
import { loadStyle, paletteColors } from '../style/load.mjs';
import { run as runParse } from '../project/parse.mjs';
import { run as runCast } from '../project/cast.mjs';
import { run as runAlign } from '../audio/align.mjs';
import { lintStoryboard } from './lint.mjs';

const STRONG = new Set(['surprised', 'angry', 'scared', 'laugh']);

// ---------------- characters ----------------
export function resolveCharacters(characters, style) {
  const pal = style.palette, lock = pal.lockToPalette !== false;
  const all = paletteColors(style);
  const used = [], usedHair = [];
  return characters.map((c0) => {
    const c = JSON.parse(JSON.stringify(c0));
    c.colors = { ...c.colors };
    c.colors.skin = nearest(c.colors.skin || '#EBB48E', pal.skin);
    if (lock) {
      c.colors.body = nearest(c.colors.body, pal.characterColors, [...used, pal.roles.wall]);
      used.push(c.colors.body);
      c.colors.accent = nearest(c.colors.accent || c.colors.body, all, [c.colors.body]);
      // two characters should not share a hair colour when the palette is small (they would read as twins)
      // hair keeps its lightness first (dark brown -> the darkest ink, not a pastel)
      const want = toLab(c.colors.hair || pal.roles.ink);
      const avoid = new Set([c.colors.skin, c.colors.body, ...usedHair].map((x) => x.toUpperCase()));
      const ranked = all.map((p) => { const L = toLab(p); return { p, d: Math.hypot(L[0] - want[0], L[1] - want[1], L[2] - want[2]) + 1.2 * Math.abs(L[0] - want[0]) }; }).sort((a, b) => a.d - b.d);
      c.colors.hair = (ranked.find((r) => !avoid.has(r.p.toUpperCase())) || ranked[0]).p;
      usedHair.push(c.colors.hair);
      c.colors.legs = nearest(c.colors.legs || pal.roles.ink, all, [c.colors.body]);
    }
    return c;
  });
}

// ---------------- framing ----------------
function groundFrac(aspect) { return aspect < 0.8 ? 0.7 : aspect < 1.2 ? 0.8 : 0.86; }

export function frameFor(type, ctx, focus, extra = {}) {
  const { scene, M, aspect } = ctx;
  const gf = groundFrac(aspect), portrait = aspect < 1;
  if (type === 'two' || type === 'wide') {
    const xs = scene.cast.map((id) => [scene.positions[id] - M[id].halfW, scene.positions[id] + M[id].halfW]);
    const minX = Math.min(...xs.map((v) => v[0])), maxX = Math.max(...xs.map((v) => v[1]));
    const maxH = Math.max(...scene.cast.map((id) => M[id].H));
    const w = maxX - minX + 140;
    let h = Math.max(w / aspect, (maxH * 1.06) / (gf - 0.05));
    if (type === 'wide') h *= 1.18;
    return { x: (minX + maxX) / 2, y: -gf * h + h / 2, h };
  }
  if (type === 'insert') {
    const p = extra.prop, g = propGeometry(p.type, p.opts || {});
    const pw = g.w * (p.s || 1), ph = g.h * (p.s || 1);
    const h = Math.max(ph * 2.3, (pw * 2.0) / aspect, 420);
    return { x: p.x, y: p.y - ph / 2 - h * 0.04, h };
  }
  const m = M[focus], x0 = scene.positions[focus], dir = scene.facing[focus] ?? 1;
  const headTop = m.headCY - m.headR;
  if (type === 'close' || type === 'reaction') {
    const h = m.headR * 2 * (portrait ? 2.75 : 1.9) * (type === 'reaction' ? 1.1 : 1);
    const top = headTop - m.headR * 0.45 - h * 0.08; // room for hair and hats
    return { x: x0 + dir * h * aspect * 0.06, y: top + h / 2, h };
  }
  if (type === 'ots') {
    const h = m.H * (portrait ? 1.2 : 0.92);
    const fw = h * aspect;
    const others = scene.cast.filter((id) => id !== focus);
    const lid = others.sort((a, b) => Math.abs(scene.positions[a] - x0) - Math.abs(scene.positions[b] - x0))[0];
    let x = x0;
    if (lid) {
      const lx = scene.positions[lid], side = Math.sign(lx - x0) || dir;
      const edge = Math.abs(lx - x0) - M[lid].halfW * 0.7;
      // shift toward the listener, but the speaker's face must stay fully inside the frame (with margin)
      const maxOff = Math.max(0, fw * 0.5 - m.headR * 1.35);
      x = x0 + side * Math.min(clamp(edge - fw * 0.5 + fw * 0.16, 0, fw * 0.32), maxOff);
    }
    const top = headTop - h * 0.07;
    return { x, y: top + h / 2, h };
  }
  // medium
  const h = m.H * (portrait ? 1.1 : 0.88);
  const top = headTop - h * 0.07;
  return { x: x0 + dir * h * aspect * 0.05, y: top + h / 2, h };
}

// ---------------- shots ----------------
function planScene(scene, lines, ctx) {
  const { lead, minShot, maxShot, reactions, cutaways, fps } = ctx;
  const cast = scene.cast, multi = cast.length > 1;
  const shots = [];
  const add = (start, type, focus, why, extra = {}) => shots.push({ start: Math.max(scene.start, start), type, focus, why, ...extra });
  const framingNext = {};
  const nextFraming = (id) => { const t = framingNext[id] || (multi ? 'ots' : 'medium'); framingNext[id] = t === 'ots' ? 'medium' : 'ots'; return t; };
  const listenerOf = (L, prevSpeaker) => {
    const others = cast.filter((id) => id !== L.speaker);
    if (!others.length) return null;
    if (prevSpeaker && others.includes(prevSpeaker)) return prevSpeaker;
    return others.sort((a, b) => Math.abs(scene.positions[a] - scene.positions[L.speaker]) - Math.abs(scene.positions[b] - scene.positions[L.speaker]))[0];
  };
  let singles = 0, lastInsert = -99, start = 0;
  if (multi) {
    add(scene.start, 'two', null, 'establishing two-shot');
    const l0 = lines[0];
    if (l0 && l0.end - scene.start > 3.2) {
      const w = l0.words.find((x) => x.s - scene.start >= 1.6);
      if (w) { add(w.s - lead, nextFraming(l0.speaker), l0.speaker, 'cut into the speaker during a long opening line'); singles = 1; }
    }
    start = 1;
  }
  for (let li = (multi ? start : 0); li < lines.length; li++) {
    const L = lines[li], P = lines[li - 1], cur = shots[shots.length - 1];
    const dur = L.end - L.start;
    const same = P && P.speaker === L.speaker;
    const strong = STRONG.has(L.emotion) || (/!\s*$/.test(L.text) && dur < 1.6);
    const gap = P ? L.start - P.end : 0;
    let cutAt = L.start - lead;
    let why = 'cut to the speaker';
    if (P && !same && gap >= 0.9 && reactions) { cutAt = P.end + 0.15; why = 'cut early: the next speaker reacts in the pause'; }
    if (!(same && cur && cur.focus === L.speaker && L.end - cur.start <= maxShot)) {
      let type;
      if (multi && singles >= 3 && dur <= 3) { type = 'two'; why = 're-establish after three singles'; }
      else if (strong) { type = 'close'; why = `close-up for a strong line (${L.emotion})`; }
      else type = nextFraming(L.speaker);
      if (cur && cur.type === type && (cur.focus === (type === 'two' ? null : L.speaker))) type = type === 'close' ? 'medium' : 'close';
      add(cutAt, type, type === 'two' ? null : L.speaker, why, { line: L.id });
      singles = type === 'two' ? 0 : singles + 1;
    }
    if (!multi) continue;
    const listener = listenerOf(L, P?.speaker);
    // a) a long line gets a listener reaction in the middle
    if (reactions && listener && dur > maxShot - 0.4) {
      const mid = L.start + dur * 0.5;
      const w = L.words.find((x) => x.s >= mid) || L.words[Math.floor(L.words.length / 2)];
      if (w && w.s - shots[shots.length - 1].start >= minShot) {
        add(w.s - lead, 'reaction', listener, 'reaction cut in a long line', { line: L.id });
        const back = w.s + Math.min(1.4, (L.end - w.s) * 0.5);
        if (L.end - back > 0.9) { add(back, shots[shots.length - 2].type === 'close' ? 'medium' : 'close', L.speaker, 'back to the speaker', { line: L.id }); }
        singles++;
      }
    } else if (reactions && listener && (STRONG.has(L.emotion) || L.emotion === 'sad') && L.trigger !== null && dur >= 2.2) {
      // b) the punch word of an emotional line: show the listener taking it
      const w = L.words[L.trigger];
      if (w && w.e - shots[shots.length - 1].start >= minShot && L.end - w.e > 0.5) {
        add(w.e - lead, 'reaction', listener, `reaction to "${stripPunct(w.w)}"`, { line: L.id });
        if (L.end - (w.e + 1.0) > 0.9) add(w.e + 1.0, 'close', L.speaker, 'back to the speaker', { line: L.id });
      }
    }
    // c) cutaway to a prop the line mentions
    if (cutaways && L.props?.length && dur >= 1.6 && L.start - lastInsert >= 7) {
      const hit = L.props[0], w = L.words[hit.word], prop = scene.background.props.find((p) => p.id === hit.propId);
      if (w && prop && w.s - lead - shots[shots.length - 1].start >= minShot * 0.9) {
        add(w.s - lead, 'insert', null, `cutaway: ${hit.prop}`, { prop: prop.id, line: L.id });
        lastInsert = L.start;
        const back = w.s - lead + 1.05;
        if (L.end - back > 0.7) add(back, framingNext[L.speaker] === 'ots' ? 'medium' : 'ots', L.speaker, 'back from the cutaway', { line: L.id });
      }
    }
  }
  // finalize: order, ends, minimum length, no identical neighbours
  shots.sort((a, b) => a.start - b.start);
  for (let i = 0; i < shots.length; i++) shots[i].end = i + 1 < shots.length ? shots[i + 1].start : scene.end;
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i], p = shots[i - 1];
    if (s.end - s.start < minShot) {
      const ns = Math.max(p.start + minShot, s.end - minShot);
      if (ns < s.start) { s.start = ns; p.end = ns; }
    }
  }
  const out = [];
  for (const s of shots) {
    const p = out[out.length - 1];
    if (s.end - s.start < 0.2 * minShot) { if (p) p.end = s.end; continue; }
    if (p && (p.end - p.start < minShot * 0.75)) { p.end = s.end; p.type = s.type; p.focus = s.focus; p.why += ` + ${s.why}`; continue; }
    if (p && p.type === s.type && p.focus === s.focus && p.prop === s.prop) { p.end = s.end; continue; }
    out.push(s);
  }
  return out;
}

function cameraFor(shot, ctx) {
  const { scene, style, fps, aspect, M } = ctx;
  const C = style.camera;
  const prop = shot.prop ? scene.background.props.find((p) => p.id === shot.prop) : null;
  const from = { ...frameFor(shot.type, ctx, shot.focus, { prop }), roll: 0 };
  const frames = Math.max(1, (shot.end - shot.start) * fps);
  const strong = shot.type === 'close' && ctx.lineById[shot.line] && STRONG.has(ctx.lineById[shot.line].emotion);
  const push = strong ? (C.punchPushPerFrame || C.pushPerFrame * 2) : C.pushPerFrame;
  let shrink = Math.min(0.15, push * frames);
  if (shot.type === 'two' || shot.type === 'wide') {
    // a group shot may only creep in as far as the empty margin allows (nobody gets cut)
    const xs = scene.cast.map((id) => [scene.positions[id] - M[id].halfW, scene.positions[id] + M[id].halfW]);
    const contentW = Math.max(...xs.map((v) => v[1])) - Math.min(...xs.map((v) => v[0]));
    const slack = 1 - contentW / (from.h * aspect);
    shrink = Math.min(shrink, Math.max(0.015, slack * 0.8));
  }
  // zoom toward the face (or the frame centre for group shots)
  let fx = from.x, fy = from.y;
  if (shot.focus) { const m = M[shot.focus]; fx = scene.positions[shot.focus]; fy = m.headCY; }
  const to = { x: from.x + (fx - from.x) * shrink, y: from.y + (fy - from.y) * shrink, h: from.h * (1 - shrink), roll: 0 };
  if (shot.type === 'two' || shot.type === 'wide') {
    const sp = ctx.speakerDuring(shot);
    if (sp) to.x += (scene.positions[sp] - from.x) * 0.05;
  }
  if (strong && C.rollDeg) { ctx.rollSign = -(ctx.rollSign || 1); from.roll = to.roll = (ctx.rollSign * C.rollDeg * Math.PI) / 180; }
  // pan speed limit (px per frame at output resolution)
  const pxPerUnit = ctx.H / from.h;
  const pan = Math.hypot(to.x - from.x, to.y - from.y) * pxPerUnit / frames;
  if (pan > C.maxPanPxPerFrame) { const k = C.maxPanPxPerFrame / pan; to.x = from.x + (to.x - from.x) * k; to.y = from.y + (to.y - from.y) * k; }
  for (const o of [from, to]) for (const k of ['x', 'y', 'h', 'roll']) o[k] = round(o[k], 4);
  return { from, to, ease: 'linear' };
}

// ---------------- events ----------------
function gestureTiming(L, gesture, lead) {
  const dur = L.end - L.start, trig = L.trigger !== null && L.words[L.trigger] ? L.words[L.trigger].s : L.start + dur * 0.3;
  const last = L.words[L.words.length - 1]?.s ?? L.start;
  switch (gesture) {
    case 'wave': return { t: L.start - lead, dur: Math.min(1.3, dur) };
    case 'point': return { t: trig - lead, dur: 1.0 };
    case 'shrug': return { t: last - lead - 0.1, dur: 1.0 };
    case 'facepalm': return { t: L.start - lead, dur: Math.min(1.6, dur) };
    case 'cheer': return { t: trig - lead, dur: 1.2 };
    case 'explain': return { t: L.start + 0.15, dur: Math.max(0.6, Math.min(2.2, dur - 0.2)) };
    case 'think': return { t: L.start - lead, dur: Math.max(0.8, dur) };
    case 'nod': return { t: L.start, dur: 0.6 };
    default: return { t: L.start, dur: 1 };
  }
}

function buildEvents(sb, ctx) {
  const ev = [], lead = ctx.lead;
  let fxCool = -99;
  const chars = Object.fromEntries(sb.characters.map((c) => [c.id, c]));
  for (const L of sb.lines) {
    const scene = sb.scenes.find((s) => s.id === L.scene);
    const base = chars[L.speaker].personality?.baseline || 'neutral';
    ev.push({ t: round(L.start - lead), type: 'expression', target: L.speaker, value: L.emotion === 'neutral' ? base : L.emotion, why: `says ${L.id}` });
    const listeners = scene.cast.filter((id) => id !== L.speaker);
    const reaction = REACTION[L.emotion];
    const trigW = L.trigger !== null ? L.words[L.trigger] : null;
    if (reaction && listeners.length) {
      const tt = trigW ? trigW.s : L.start + (L.end - L.start) * 0.4;
      for (const id of listeners) ev.push({ t: round(tt - lead), type: 'expression', target: id, value: reaction, word: trigW ? stripPunct(trigW.w) : null, why: `reacts to ${L.id}` });
      if (REACTION_FX[reaction] && tt - fxCool > 3) { ev.push({ t: round(tt - lead), type: 'fx', target: listeners[0], value: REACTION_FX[reaction], dur: 0.9 }); fxCool = tt; }
    } else if (/\?\s*$/.test(L.text) && listeners.length) {
      const lw = L.words[L.words.length - 1];
      ev.push({ t: round(lw.s - lead), type: 'expression', target: listeners[0], value: 'thinking', why: `ponders the question ${L.id}` });
      if (lw.s - fxCool > 3) { ev.push({ t: round(lw.s - lead), type: 'fx', target: listeners[0], value: 'question', dur: 0.9 }); fxCool = lw.s; }
    }
    if (L.emotion === 'angry' && trigW && trigW.s - fxCool > 2) { ev.push({ t: round(trigW.s - lead), type: 'fx', target: L.speaker, value: 'anger', dur: 0.8 }); fxCool = trigW.s; }
    let g = L.gesture;
    const energy = chars[L.speaker].personality?.energy ?? 0.5;
    if (!g && energy >= 0.6 && L.end - L.start >= 2.4) g = 'explain';
    if (g) { const gt = gestureTiming(L, g, lead); ev.push({ t: round(gt.t), type: 'gesture', target: L.speaker, value: g, dur: round(gt.dur) }); }
    if (scene.cast.length > 2) for (const id of listeners) ev.push({ t: round(L.start - lead), type: 'look', target: id, value: Math.sign(scene.positions[L.speaker] - scene.positions[id]) || 1 });
    const S = ctx.style.camera.shake;
    if (S && S.amp > 0 && (L.emotion === 'angry' || L.emotion === 'surprised')) {
      const w = L.words.find((x) => /!/.test(x.w));
      if (w) ev.push({ t: round(w.s), type: 'shake', amp: S.amp, frames: S.frames || 7 });
    }
  }
  // collapse expression events of the same target closer than 3 frames (keep the later one)
  ev.sort((a, b) => a.t - b.t);
  const out = [];
  for (const e of ev) {
    const p = out.findLast?.((x) => x.type === 'expression' && x.target === e.target && e.type === 'expression');
    if (p && e.t - p.t < 3 / ctx.fps) out.splice(out.indexOf(p), 1);
    out.push({ ...e, t: Math.max(0, e.t) });
  }
  return out;
}

// ---------------- tracks ----------------
function mouthFromWords(lines, id, frames, fps) {
  const arr = new Array(frames).fill(0);
  for (const L of lines) if (L.speaker === id) for (const w of L.words) {
    const n = Math.max(1, nuclei(w.w).length);
    for (let f = Math.floor(w.s * fps); f <= Math.ceil(w.e * fps) && f < frames; f++) {
      const p = clamp((f / fps - w.s) / Math.max(0.05, w.e - w.s));
      arr[f] = Math.max(arr[f], Math.round((0.25 + 0.75 * Math.abs(Math.sin(Math.PI * n * p))) * 100));
    }
  }
  return arr;
}

function roundTrack(lines, id, frames, fps) {
  const a = new Array(frames).fill('0');
  for (const L of lines) if (L.speaker === id) for (const w of L.words) {
    const vs = nuclei(w.w);
    if (!vs.length) continue;
    for (let f = Math.floor(w.s * fps); f <= Math.ceil(w.e * fps) && f < frames; f++) {
      const p = clamp((f / fps - w.s) / Math.max(0.05, w.e - w.s));
      if (isRoundVowel(vs[Math.min(vs.length - 1, Math.floor(p * vs.length))])) a[f] = '1';
    }
  }
  return a.join('');
}

function blinkTrack(id, events, duration, style, seed) {
  const r = rng(`${seed}:${id}:blink`), [lo, hi] = style.motion.blinkEvery || [2.2, 5.5];
  const changes = events.filter((e) => e.target === id && e.type === 'expression').map((e) => e.t);
  const out = [];
  for (let t = r.range(0.4, 1.6); t < duration - 0.2; t += r.range(lo, hi)) {
    if (changes.some((c) => Math.abs(c - t) < 0.15)) continue;
    out.push(round(t));
  }
  return out;
}

// ---------------- captions ----------------
function buildCaptions(mode, lines, aspect) {
  const items = [];
  if (mode === 'word') {
    for (const L of lines) {
      const ws = L.words;
      for (let i = 0; i < ws.length; i++) {
        const short = (w) => stripPunct(w.w).length <= 2 || w.e - w.s < 0.22;
        const ends = (w) => /[.!?…:;]$/.test(w.w);
        const group = [ws[i]];
        // short words travel with a neighbour, but never across a sentence boundary
        if (short(ws[i]) && !ends(ws[i]) && i + 1 < ws.length) { group.push(ws[i + 1]); i++; }
        else if (short(ws[i]) && ends(ws[i]) && items.length && items[items.length - 1].line === L.id && !ends(items[items.length - 1].words.at(-1))) {
          const p = items[items.length - 1]; p.words.push(ws[i]); p.text += ' ' + ws[i].w; p.end = ws[i].e + 0.3; continue;
        } else if (i + 1 === ws.length - 1 && short(ws[i + 1]) && !ends(ws[i])) { group.push(ws[i + 1]); i++; }
        items.push({ start: group[0].s, end: group[group.length - 1].e + 0.3, text: group.map((g) => g.w).join(' '), speaker: L.speaker, line: L.id, words: group });
      }
    }
  } else if (mode === 'line') {
    const maxChars = aspect < 1 ? 40 : 64;
    for (const L of lines) {
      let page = [], len = 0;
      const flush = () => { if (page.length) items.push({ start: page[0].s - 0.1, end: page[page.length - 1].e + 0.35, text: page.map((w) => w.w).join(' '), speaker: L.speaker, line: L.id, words: page }); page = []; len = 0; };
      for (const w of L.words) { if (len + w.w.length > maxChars && page.length) flush(); page.push(w); len += w.w.length + 1; }
      flush();
    }
  } else if (mode === 'bubble') {
    for (const L of lines) items.push({ start: L.start - 0.12, end: L.end + 0.35, text: L.text, speaker: L.speaker, line: L.id, words: L.words });
  }
  items.sort((a, b) => a.start - b.start);
  for (let i = 0; i < items.length; i++) {
    const n = items[i + 1];
    if (n && items[i].end > n.start) items[i].end = n.start;
    if (items[i].end - items[i].start < 0.2) items[i].end = Math.min(items[i].start + 0.2, n ? n.start : items[i].start + 0.2);
    items[i].start = round(Math.max(0, items[i].start)); items[i].end = round(items[i].end);
  }
  return { mode, items };
}

// ---------------- main ----------------
export function direct({ dialogue, characters, timing, envelope, style, cfg }) {
  const fps = cfg.fps, { width: W, height: H } = cfg.video, aspect = W / H;
  const duration = timing.duration, frames = Math.ceil(duration * fps);
  const lead = (style.camera.cutLeadFrames ?? 4) / fps;
  const D = cfg.director;
  const chars = resolveCharacters(characters, style);
  const body = BODIES[style.character?.body] || BODIES['paper-cut'];
  const M = Object.fromEntries(chars.map((c) => [c.id, body.metrics(c, style)]));
  const order = dialogue.speakers.map((s) => s.id);

  // lines
  const lines = dialogue.lines.map((l) => {
    const tl = timing.lines.find((x) => x.id === l.id);
    return {
      id: l.id, index: l.index, speaker: l.speaker, scene: l.scene, start: tl.start, end: tl.end, text: l.text,
      emotion: l.emotion, gesture: l.gesture || null, trigger: l.triggerWord ?? null,
      words: tl.words.map((w) => ({ w: w.w, s: w.s, e: w.e })),
    };
  });

  // scenes
  const scenes = dialogue.scenes.map((s, i) => {
    const sl = lines.filter((l) => l.scene === s.id);
    const castIds = order.filter((id) => sl.some((l) => l.speaker === id));
    const gapW = (a, b) => Math.max(480, M[a].halfW + M[b].halfW + 50);
    const xs = [0];
    for (let k = 1; k < castIds.length; k++) xs.push(xs[k - 1] + gapW(castIds[k - 1], castIds[k]));
    const shift = xs[xs.length - 1] / 2;
    const positions = Object.fromEntries(castIds.map((id, k) => [id, round(xs[k] - shift)]));
    const facing = Object.fromEntries(castIds.map((id) => [id, positions[id] <= 0 ? 1 : -1]));
    if (castIds.length === 1) facing[castIds[0]] = 1;
    const setting = s.setting || findSetting(sl.map((l) => l.text).join(' ')) || 'living-room';
    const span = [Math.min(...Object.values(positions)), Math.max(...Object.values(positions))];
    const background = compose(setting, span);
    background.props = background.props.map((p, k) => ({ id: `${s.id}-p${k + 1}`, ...p }));
    // make sure every prop a line mentions exists in the scene, so a cutaway can show it
    for (const l of sl) {
      l.props = [];
      for (const h of findProps(l.text)) {
        let prop = background.props.find((p) => p.type === h.prop);
        if (!prop && D.cutaways) {
          const counter = background.props.find((p) => p.type === 'counter' || p.type === 'desk' || p.type === 'table');
          const x = counter ? (counter.type === 'counter' ? span[1] + 260 : counter.x) : span[1] + 420;
          if (!counter) background.props.push({ id: `${s.id}-p${background.props.length + 1}`, type: 'table', x, y: 0, s: 1 });
          prop = { id: `${s.id}-p${background.props.length + 1}`, type: h.prop, x, y: counter?.type === 'counter' ? -430 : -300, s: 0.9 };
          background.props.push(prop);
        }
        if (prop) l.props.push({ ...h, propId: prop.id });
      }
    }
    return { id: s.id, label: s.label || '', setting, cast: castIds, positions, facing, background, first: sl[0], last: sl[sl.length - 1] };
  });
  scenes.forEach((s, i) => {
    s.start = i === 0 ? 0 : round((scenes[i - 1].last.end + s.first.start) / 2);
    s.end = i === scenes.length - 1 ? duration : round((s.last.end + scenes[i + 1].first.start) / 2);
  });

  // shots
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
  const shots = [];
  const ctxBase = { style, fps, aspect, H, M, lead, minShot: D.minShot, maxShot: D.maxShot, reactions: D.reactions, cutaways: D.cutaways, lineById };
  ctxBase.speakerDuring = (shot) => { const l = lines.find((x) => x.start < shot.end && x.end > shot.start); return l ? l.speaker : null; };
  let speakerChanges = 0;
  for (const [si, scene] of scenes.entries()) {
    const ctx = { ...ctxBase, scene };
    const planned = planScene(scene, lines.filter((l) => l.scene === scene.id), ctx);
    planned.forEach((p, k) => {
      const prev = shots[shots.length - 1];
      let transitionIn = { type: 'cut', frames: 0 };
      if (k === 0 && si > 0) transitionIn = { ...style.transitions.scene };
      else if (k > 0) {
        transitionIn = { ...style.transitions.cut };
        const sc = style.transitions.speakerChange;
        if (sc && prev && prev.focus && p.focus && prev.focus !== p.focus && (++speakerChanges % 3 === 1)) transitionIn = { ...sc };
      }
      const shot = { id: `sh${String(shots.length + 1).padStart(2, '0')}`, scene: scene.id, start: round(p.start), end: round(p.end), type: p.type, focus: p.focus || null, subjects: p.type === 'two' || p.type === 'wide' ? scene.cast : p.focus ? [p.focus] : [], line: p.line || null, prop: p.prop || null, transitionIn, why: p.why };
      shot.camera = cameraFor({ ...shot }, ctx);
      shots.push(shot);
    });
  }

  const sb = {
    version: 1,
    meta: { title: dialogue.title, generator: `dialogue-animator ${VERSION}`, seed: cfg.seed, language: dialogue.language, timingSource: timing.source, estimatedTiming: !!timing.estimated },
    video: { width: W, height: H, fps, duration, frames },
    style: { id: style.id, family: style.family, body: style.character?.body || 'paper-cut' },
    stage: { characterHeight: 900, groundY: 0 },
    characters: chars,
    scenes: scenes.map(({ first, last, ...s }) => s),
    lines: lines.map(({ props, ...l }) => l),
    shots,
    events: [],
    tracks: { mouth: {}, round: {}, blinks: {} },
    captions: null,
    audio: { voice: timing.voice, music: null, mix: null },
  };
  for (const s of sb.scenes) s.start = round(s.start), s.end = round(s.end);
  sb.events = buildEvents(sb, { ...ctxBase, style });
  // punch-ins for bouncy styles on strong close-ups
  if (style.camera.punchZoom) for (const s of shots) if (s.type === 'close' && lineById[s.line] && STRONG.has(lineById[s.line].emotion)) sb.events.push({ t: s.start, type: 'punch', amount: style.camera.punchZoom, frames: style.camera.punchFrames || 7, until: s.end });
  sb.events.sort((a, b) => a.t - b.t);
  for (const c of chars) {
    const env = envelope?.speakers?.[c.id];
    sb.tracks.mouth[c.id] = env ? Array.from({ length: frames }, (_, f) => env[f] || 0) : mouthFromWords(lines, c.id, frames, fps);
    sb.tracks.round[c.id] = roundTrack(lines, c.id, frames, fps);
    sb.tracks.blinks[c.id] = blinkTrack(c.id, sb.events, duration, style, cfg.seed);
  }
  sb.captions = buildCaptions(cfg.captions, lines, aspect);
  // nothing of one scene may leak into the next: clip captions and symbols at scene ends
  const sceneEnd = Object.fromEntries(sb.scenes.map((s) => [s.id, s.end]));
  for (const it of sb.captions.items) { const L = lineById[it.line]; if (L) it.end = round(Math.min(it.end, sceneEnd[L.scene] - 2 / fps)); }
  for (const e of sb.events) {
    if (e.type !== 'fx') continue;
    const sc = sb.scenes.find((s) => e.t >= s.start && e.t < s.end);
    if (sc) { e.scene = sc.id; e.dur = round(Math.min(e.dur || 0.8, sc.end - e.t - 1 / fps)); }
  }
  return sb;
}

/** JSON with number arrays on one line (storyboards stay readable but small). */
export function stringifyStoryboard(sb) {
  return JSON.stringify(sb, (k, v) => (Array.isArray(v) && v.length > 12 && v.every((x) => typeof x === 'number') ? `__ARR__${JSON.stringify(v)}` : v), 1)
    .replace(/"__ARR__(\[[^"]*\])"/g, '$1');
}

export async function run(dir, cli = {}) {
  const { cfg, files, decisions } = loadConfig(dir, cli);
  const b = (f) => path.join(files.build, f);
  if (!exists(b('dialogue.json')) || cli.fresh) await runParse(dir, cli);
  if (!exists(b('characters.json')) || cli.fresh) await runCast(dir, cli);
  if (!exists(b('timing.json')) || cli.fresh) await runAlign(dir, cli);
  const dialogue = readJSON(b('dialogue.json'));
  const characters = readJSON(b('characters.json')).characters;
  const timing = readJSON(b('timing.json'));
  const envelope = exists(b('envelope.json')) ? readJSON(b('envelope.json')) : null;
  const style = loadStyle(cfg.style, files.dir);
  const sb = direct({ dialogue, characters, timing, envelope, style, cfg });
  const lint = lintStoryboard(sb, style, cfg);
  sb.lint = { warnings: lint.warnings, stats: lint.stats };
  assertValid(sb, 'storyboard');
  writeText(b('storyboard.json'), stringifyStoryboard(sb) + '\n');
  writeDecisions(files, decisions, [
    { key: 'timing source', value: timing.source + (timing.estimated ? ' (ESTIMATED)' : ''), source: 'auto' },
    ...sb.scenes.map((s) => ({ key: `scene ${s.id}`, value: `${s.setting} (${s.label || 'no label'}), cast: ${s.cast.join(', ')}`, source: s.label ? 'dialogue' : 'auto' })),
    { key: 'shots', value: `${sb.shots.length} shots, ${lint.stats.cuts} cuts, avg ${lint.stats.avgShot.toFixed(2)} s`, source: 'auto' },
  ]);
  return { sb, lint, files };
}

export async function cli(args) {
  log.step('board');
  const { sb, lint, files } = await run(args._[0] || '.', args);
  log.ok(`${sb.shots.length} shots over ${sb.video.duration.toFixed(2)} s in ${sb.scenes.length} scene(s); ${sb.events.length} events; captions: ${sb.captions.mode}`);
  for (const s of sb.shots) log.info(`${s.id} ${s.start.toFixed(2).padStart(6)}–${s.end.toFixed(2).padEnd(6)} ${s.type.padEnd(8)} ${(s.focus || s.prop || s.subjects.join('+')).padEnd(12)} ${s.transitionIn.type !== 'cut' ? `[${s.transitionIn.type}] ` : ''}${s.why}`);
  for (const w of lint.warnings) log.warn(w);
  log.ok(`wrote ${rel(path.join(files.build, 'storyboard.json'))}`);
  return 0;
}
