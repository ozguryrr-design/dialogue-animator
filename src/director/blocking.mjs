// Staging: turns staging.json (who walks where, what they carry, where the camera goes) into storyboard
// events and shots, and solves the camera path so it follows the action. Plain data in, plain data out.
import { moveState, GAITS } from '../engine/motion.mjs';
import { geometryOf } from '../engine/props.mjs';
import { GESTURES } from '../engine/poses.mjs';
import { clamp, ease, noise1, hash32 } from '../engine/math.mjs';
import { foldKey } from '../lib/text.mjs';
import { round } from '../lib/util.mjs';
import { expandShapes } from '../project/design.mjs';

export const SIZES = { wide: 'wide', two: 'two', group: 'two', full: 'full', medium: 'medium', close: 'close', 'close-up': 'close', reaction: 'reaction', ots: 'ots' };
const OFF = 2100;

// ---------------- time ----------------
/** "l03", "l3+0.5", "l03.end-0.2", "b2", "b2.end", "+0.4" (after the previous action), or plain seconds. */
export function timeOf(at, { lines, beats, scene }, prevEnd = scene.start) {
  if (typeof at === 'number') return at;
  if (at === undefined || at === null) return prevEnd;
  const s = String(at).trim();
  let m = s.match(/^\+\s*([\d.]+)$/);
  if (m) return prevEnd + +m[1];
  m = s.match(/^([lb])0*(\d+)(\.end)?\s*([+-]\s*[\d.]+)?$/i);
  if (!m) throw new Error(`"${at}" is not a time. Use seconds, l3, l3.end, b2, b2+1.5 or +0.5`);
  const n = +m[2], off = m[4] ? parseFloat(m[4].replace(/\s/g, '')) : 0;
  const ref = m[1].toLowerCase() === 'l' ? lines.find((x) => x.index === n) : beats.find((x) => x.id === `b${n}`);
  if (!ref) throw new Error(`staging: there is no ${m[1]}${n} in this script`);
  return (m[3] ? ref.end ?? ref.start : ref.start) + off;
}

// ---------------- objects ----------------
function findPart(props, name) {
  const k = foldKey(name);
  return props.find((p) => foldKey(p.name || '') === k) || props.find((p) => foldKey(p.name || '').includes(k)) || props.find((p) => p.type === name);
}

function addObjects(scene, sd, fill) {
  const objects = {};
  for (const [name, o] of Object.entries(sd.objects || {})) {
    let p = o.part ? findPart(scene.background.props, o.part) : null;
    if (!p) {
      p = { id: `${scene.id}-o-${foldKey(name)}`, x: o.x ?? 0, y: o.y ?? 0, s: o.s ?? 1, ...(o.layer ? { layer: o.layer } : {}) };
      if (o.draw) { const draw = expandShapes(o.draw, fill); Object.assign(p, { type: 'custom', name, draw, w: o.w || 200, h: o.h || 200 }); } else p.type = o.use || 'box';
      scene.background.props.push(p);
    }
    if (o.x !== undefined) p.x = o.x;
    if (o.y !== undefined) p.y = o.y;
    if (o.s !== undefined) p.s = o.s;
    if (o.hidden) p.visible = false;
    p.object = true;
    if (p.type === 'custom' && o.h) { p.w = o.w || p.w; p.h = o.h; }
    objects[name] = { prop: p, hold: o.hold || 'near', holdScale: o.holdScale || 1 };
  }
  return objects;
}

// ---------------- a scene's actions ----------------
/** Applies one scene of staging.json. Mutates scene (start positions, objects); returns { events, moves }. */
export function stageScene(scene, sd, ctx) {
  const { M, lines, beats, fill } = ctx;
  const home = { ...scene.positions };
  const objects = addObjects(scene, sd, fill);
  const moves = {};
  const ev = [];
  const posAt = (id, t) => moveState(moves[id] || [], scene.positions[id], t).x;
  const hw = (id) => M[id].halfW;
  const look = { ...scene.facing };
  const setLook = (t, id, v) => { if (v && look[id] !== v) { look[id] = v; ev.push({ t: round(t), type: 'look', target: id, value: v }); } };
  const objX = (name, t) => {
    const o = objects[name], held = heldBy[name];
    return held ? posAt(held, t) : (o.x ?? o.prop.x);
  };
  const heldBy = {};
  const dirTo = (who, t, target) => {
    if (target === 'left') return -1;
    if (target === 'right') return 1;
    const x = scene.cast.includes(target) ? posAt(target, t) : objects[target] ? objX(target, t) : null;
    return x === null ? 0 : Math.sign(x - posAt(who, t));
  };
  const hold = (t, name, by, side) => { const o = objects[name]; heldBy[name] = by; ev.push({ t: round(t), type: 'hold', target: o.prop.id, by, side: side || o.hold, scene: scene.id, ...(o.holdScale !== 1 ? { scale: o.holdScale } : {}) }); };
  const drop = (t, name, x, y) => { const o = objects[name]; delete heldBy[name]; o.x = x; ev.push({ t: round(t), type: 'drop', target: o.prop.id, x: round(x), y: round(y ?? o.prop.y), scene: scene.id }); };

  for (const [id, s] of Object.entries(sd.start || {})) {
    if (s.x !== undefined) scene.positions[id] = s.x;
    if (s.face) scene.facing[id] = s.face === 'left' ? -1 : 1;
    look[id] = scene.facing[id];
    if (s.sit) scene.posture[id] = 'sit';
    if (s.holding) { const o = objects[s.holding]; hold(0, s.holding, id, s.hand || o.hold); ev[ev.length - 1].t = round(scene.start); }
    if (s.hidden) ev.push({ t: round(scene.start), type: 'visible', target: id, value: false, scene: scene.id });
  }

  let prevEnd = scene.start;
  const tctx = { lines, beats, scene };
  for (const a of sd.do || []) {
    const t = Math.max(scene.start, timeOf(a.at, tctx, prevEnd));
    let end = t;
    const who = a.who;
    const gait = a.run !== undefined ? 'run' : a.sneak !== undefined ? 'sneak' : a.walk !== undefined ? 'walk' : null;
    if (gait) {
      const goal = a[gait], x0 = posAt(who, t);
      let to;
      if (typeof goal === 'number') to = goal;
      else if (goal === 'home') to = home[who];
      else if (goal === 'off-left') to = Math.min(x0, ...scene.cast.map((c) => posAt(c, t))) - OFF;
      else if (goal === 'off-right') to = Math.max(x0, ...scene.cast.map((c) => posAt(c, t))) + OFF;
      else if (scene.cast.includes(goal)) { const x = posAt(goal, t); to = x + (Math.sign(x0 - x) || -1) * (a.stop ?? hw(who) + hw(goal) + 40); }
      else if (objects[goal]) { const x = objX(goal, t), w = geometryOf(objects[goal].prop).w * (objects[goal].prop.s || 1); to = x + (Math.sign(x0 - x) || -1) * (a.stop ?? w / 2 + hw(who) * 0.75); }
      else to = x0;
      const dur = a.dur ?? Math.max(0.4, Math.abs(to - x0) / GAITS[gait].speed);
      const m = { t: round(t), type: 'move', target: who, scene: scene.id, to: round(to), dur: round(dur), gait };
      (moves[who] ||= []).push(m); ev.push(m);
      setLook(t, who, Math.sign(to - x0));
      end = t + dur;
      if (a.footsteps !== false && sd.footsteps !== false) {
        const dist = Math.abs(to - x0), stepLen = GAITS[gait].cycle / 2, n = Math.floor(dist / stepLen), gain = gait === 'sneak' ? -30 : gait === 'run' ? -19 : -24;
        for (let i = 0; i < n; i++) ev.push({ t: round(t + (dur * (i + 0.6)) / Math.max(1, n)), type: 'sfx', value: 'step', gainDb: gain });
      }
      // after arriving, look at whoever is nearest
      if (!a.keepFacing) {
        const others = scene.cast.filter((c) => c !== who);
        if (others.length) {
          const near = others.sort((p, q) => Math.abs(posAt(p, end) - to) - Math.abs(posAt(q, end) - to))[0];
          if (Math.abs(posAt(near, end) - to) < 1400) setLook(end, who, Math.sign(posAt(near, end) - to));
        }
      }
    } else if (a.step !== undefined) {
      const other = a.of || scene.cast.find((c) => c !== who), x0 = posAt(who, t), ox = other ? posAt(other, t) : x0 + 1;
      const toward = Math.sign(ox - x0) || 1, by = a.by ?? 150, gap = hw(who) + hw(other || who) + 30;
      let to = x0 + (a.step === 'toward' ? toward : -toward) * by;
      if (a.step === 'toward' && Math.abs(ox - to) < gap) to = ox - toward * gap;
      const dur = a.dur ?? 0.7;
      const m = { t: round(t), type: 'move', target: who, scene: scene.id, to: round(to), dur: round(dur), gait: 'walk' };
      (moves[who] ||= []).push(m); ev.push(m);
      end = t + dur;
    } else if (a.turn !== undefined) {
      setLook(t, who, dirTo(who, t, a.turn));
      end = t + 0.1;
    } else if (a.take !== undefined) {
      if (!a.quiet) ev.push({ t: round(t), type: 'gesture', target: who, value: 'reach', dur: 0.9, why: `takes ${a.take}` });
      hold(t + 0.45, a.take, who, a.hand);
      end = t + 0.95;
    } else if (a.put !== undefined) {
      const o = objects[a.put], x0 = posAt(who, t + 0.45), dir = look[who] ?? 1;
      const w = geometryOf(o.prop).w * (o.prop.s || 1);
      const x = typeof a.x === 'number' ? a.x : x0 + dir * (hw(who) * 0.7 + w / 2);
      if (!a.quiet) ev.push({ t: round(t), type: 'gesture', target: who, value: 'reach', dur: 0.9, why: `puts down ${a.put}` });
      drop(t + 0.5, a.put, x, a.y);
      if (a.sfx) ev.push({ t: round(t + 0.5), type: 'sfx', value: a.sfx });
      end = t + 0.95;
    } else if (a.give !== undefined) {
      ev.push({ t: round(t), type: 'gesture', target: who, value: 'give', dur: 0.9, why: `gives ${a.give}` }, { t: round(t + 0.15), type: 'gesture', target: a.to, value: 'give', dur: 0.75 });
      hold(t + 0.5, a.give, a.to, a.hand);
      end = t + 0.95;
    } else if (a.hide !== undefined) {
      ev.push({ t: round(t), type: 'gesture', target: who, value: 'hide', dur: 0.7, why: `hides ${a.hide}` });
      hold(t + 0.4, a.hide, who, 'behind');
      end = t + 0.75;
    } else if (a.show !== undefined) {
      hold(t, a.show, who, a.hand || 'near');
      end = t + 0.3;
    } else if (a.gesture !== undefined) {
      const dur = a.dur ?? 1;
      ev.push({ t: round(t), type: 'gesture', target: who, value: a.gesture, dur: round(dur) });
      end = t + dur;
    } else if (a.face !== undefined) {
      ev.push({ t: round(t), type: 'expression', target: who, value: a.face, why: 'staging' });
    } else if (a.look !== undefined) {
      const dur = a.dur ?? 1.2, dir = look[who] ?? 1;
      let v;
      if (a.look === 'down') v = [0, 0.9];
      else if (a.look === 'up') v = [0, -0.9];
      else v = [dirTo(who, t, a.look) * dir * 0.95 || 0.95, 0.05];
      ev.push({ t: round(t), type: 'gaze', target: who, value: v, dur: round(dur) });
      end = t + dur;
    } else if (a.sit || a.stand) {
      ev.push({ t: round(t), type: 'posture', target: who, value: a.sit ? 'sit' : 'stand', dur: a.dur ?? 1 });
      end = t + (a.dur ?? 1);
    } else if (a.hidden !== undefined) {
      ev.push({ t: round(t), type: 'visible', target: who, value: !a.hidden, scene: scene.id });
    } else if (a.door !== undefined) {
      const door = (a.part && findPart(scene.background.props, a.part)) || scene.background.props.find((p) => p.type === 'door');
      if (door) {
        const dur = a.dur ?? 1.1, closing = a.door === 'close';
        door.opts = { ...(door.opts || {}), open: door.opts?.open ?? (closing ? 1 : 0) };
        ev.push({ t: round(t), type: 'prop', target: door.id, key: 'open', value: closing ? 0 : 1, dur: round(dur) });
        end = t + dur;
      }
    } else if (a.object !== undefined) {
      const o = objects[a.object], dur = a.dur ?? 0.6;
      if (a.visible !== undefined) ev.push({ t: round(t), type: 'prop', target: o.prop.id, key: 'visible', value: !!a.visible });
      if (a.x !== undefined) ev.push({ t: round(t), type: 'prop', target: o.prop.id, key: 'x', value: a.x, dur: round(dur) });
      if (a.y !== undefined) ev.push({ t: round(t), type: 'prop', target: o.prop.id, key: 'y', value: a.y, dur: round(dur) });
      end = t + dur;
    } else if (a.fx !== undefined) {
      ev.push({ t: round(t), type: 'fx', target: who, value: a.fx, dur: a.dur ?? 0.9, scene: scene.id });
      end = t + 0.3;
    } else if (a.fade !== undefined) {
      ev.push({ t: round(t), type: 'fade', value: a.fade, dur: a.dur ?? 1 });
      end = t + (a.dur ?? 1);
    } else if (a.sfx !== undefined) {
      ev.push({ t: round(t), type: 'sfx', value: a.sfx, gainDb: a.gainDb || 0 });
    }
    prevEnd = end;
  }
  return { events: ev, moves, objects, posAt, home };
}

// ---------------- shots from staging.json ----------------
export function plannedFromStaging(scene, sd, stage, ctx) {
  const tctx = { lines: ctx.lines, beats: ctx.beats, scene };
  let prev = scene.start;
  const list = sd.camera.map((c) => { const t = timeOf(c.at, tctx, prev); prev = t; return { c, t: clamp(t, scene.start, scene.end - 0.05) }; }).sort((a, b) => a.t - b.t);
  list[0].t = scene.start;
  return list.map(({ c, t }, i) => {
    const end = list[i + 1]?.t ?? scene.end;
    const on = c.on ?? c.follow;
    const size = SIZES[c.size] || (Array.isArray(on) ? 'two' : 'full');
    const out = { start: t, end, why: c.why || `staging: ${[size, Array.isArray(on) ? on.join('+') : on].filter(Boolean).join(' on ')}`, snap: i === 0 || !!c.cut, push: c.push ?? 0.08, speed: c.speed || 'normal', crane: c.crane || null, drift: c.drift || null, transition: c.whip ? 'whip' : null, staged: true };
    if (typeof on === 'number') return { ...out, type: 'wide', focus: null, subjects: scene.cast, atX: on, sizeHint: c.size };
    if (stage.objects[on]) return { ...out, type: 'insert', focus: null, prop: stage.objects[on].prop.id, withCast: true, subjects: [], wideObject: c.size === 'wide' || c.size === 'full' || c.size === 'two' };
    if (Array.isArray(on)) return { ...out, type: size === 'wide' ? 'wide' : 'two', focus: null, subjects: on };
    if (on) return { ...out, type: size, focus: size === 'two' || size === 'wide' ? null : on, subjects: size === 'two' || size === 'wide' ? scene.cast : [on] };
    return { ...out, type: size === 'two' || size === 'wide' ? size : 'wide', focus: null, subjects: scene.cast };
  });
}

// ---------------- the camera path ----------------
function smooth(cur, target, vel, st, dt) {
  const w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const c = cur - target, tmp = (vel + w * c) * dt;
  return [target + (c + tmp) * e, (vel - w * tmp) * e];
}
const TAU_OF = { fast: 0.14, normal: 0.26, slow: 0.7 };

/**
 * Follows the planned shots frame by frame with a critically damped spring, aiming a little ahead so the
 * camera arrives with the action instead of after it. Writes shot.camera = { from, to, track }.
 */
export function solveCamera(scene, planned, shots, ctx, frameFor) {
  const { fps, aspect, style, seed = 7 } = ctx;
  const moves = ctx.moves || {};
  const hand = style.camera.handheld ?? 0.0032, nz = hash32(scene.id) + (seed % 97);
  const PRE = 0.36, LOOK = 0.2;
  const facingAt = (id, t) => { let d = scene.facing[id] ?? 1; for (const e of ctx.lookEvents?.[id] || []) { if (e.t > t) break; d = e.value; } return d; };
  const positions = (t) => Object.fromEntries(scene.cast.map((id) => [id, moveState(moves[id] || [], scene.positions[id], t).x]));
  const propAt = (p, t) => {
    if (!p.prop) return null;
    const prop = scene.background.props.find((x) => x.id === p.prop);
    let cur = null;
    for (const e of ctx.attachEvents?.[p.prop] || []) { if (e.t > t) break; cur = e; }
    if (cur?.type === 'hold') return { ...prop, x: moveState(moves[cur.by] || [], scene.positions[cur.by], t).x + (facingAt(cur.by, t) * 110), y: -300 };
    if (cur?.type === 'drop') return { ...prop, x: cur.x, y: cur.y ?? prop.y };
    return prop;
  };
  const want = (p, t, i) => {
    const look = t + LOOK;
    const facing = { ...scene.facing };
    for (const id of scene.cast) facing[id] = facingAt(id, look);
    const sc = { ...scene, positions: positions(look), facing };
    const move = p.focus ? moveState(moves[p.focus] || [], scene.positions[p.focus], look) : null;
    // a group shot waits for whoever is still far away instead of pulling back to take them in
    let subjects = p.subjects;
    if ((p.type === 'two' || p.type === 'wide') && !p.staged) {
      const all = subjects?.length ? subjects : scene.cast;
      const near = all.filter((id) => { const list = moves[id] || []; const m = list.filter((e) => e.t <= look).at(-1); return !m || look >= m.t + m.dur || Math.abs(sc.positions[id] - m.to) < 900; });
      if (near.length) subjects = near;
    }
    const f = frameFor(p.type, { ...ctx, scene: sc }, p.focus, { prop: propAt(p, look), t0: t, t1: t, subjects, lead: move?.dir ? move.dir : 0 });
    let { x, y, h } = f;
    if (p.atX !== undefined) x = p.atX;
    if (p.wideObject) { h = Math.max(h * 1.8, 1500); y = -0.74 * h + h / 2; }
    const prog = clamp((t - p.start) / Math.max(0.1, p.end - p.start));
    const push = p.push ?? 0.08;
    h *= 1 - push * prog;
    if (p.drift) x += (p.drift === 'left' ? -1 : 1) * h * aspect * 0.12 * (prog - 0.5);
    else if (!move?.amount) x += (i % 2 ? 1 : -1) * h * aspect * 0.075 * (prog - 0.5);
    if (p.crane) y += (p.crane === 'up' ? 1 : -1) * h * 0.2 * (1 - ease.smooth(prog * 1.4)) * -1;
    return { x, y, h, roll: p.roll || 0 };
  };

  const n = Math.max(1, Math.ceil((scene.end - scene.start) * fps));
  const tracks = shots.map(() => ({ x: [], y: [], h: [], roll: [] }));
  let aim = 0, cur = 0, s = null;
  const emit = (k, t) => {
    const T = tracks[k];
    T.x.push(round(s.x + noise1(nz, t * 0.55) * s.h * hand * aspect, 2));
    T.y.push(round(s.y + noise1(nz + 1, t * 0.47) * s.h * hand, 2));
    T.h.push(round(s.h * (1 + noise1(nz + 2, t * 0.3) * hand * 0.5), 2));
    T.roll.push(round(s.roll + noise1(nz + 3, t * 0.4) * 0.0028, 5));
  };
  for (let f = 0; f <= n; f++) {
    const t = Math.min(scene.start + f / fps, scene.end);
    let snapped = false;
    while (cur + 1 < planned.length && t >= planned[cur + 1].start) {
      cur++;
      if (planned[cur].snap) { aim = cur; snapped = true; s = null; } else if (aim < cur) aim = cur;
    }
    while (aim + 1 < planned.length && t + PRE >= planned[aim + 1].start && !planned[aim + 1].snap) aim++;
    const p = planned[aim], w = want(p, t, aim);
    const opening = f === 0 && p.staged === undefined;
    if (!s) {
      s = { ...w, vx: 0, vy: 0, vh: 0, vr: 0, born: t, slow: opening };
      if (opening) { s.h = w.h * 1.28; s.y = w.y - w.h * 0.1; }
    } else {
      const dt = 1 / fps, slow = s.slow && t - s.born < 1.6;
      const tau = slow ? 0.7 : TAU_OF[p.speed] || (p.focus && moves[p.focus]?.length ? 0.26 : TAU_OF.normal);
      [s.x, s.vx] = smooth(s.x, w.x, s.vx, tau, dt);
      [s.y, s.vy] = smooth(s.y, w.y, s.vy, tau * 1.1, dt);
      [s.h, s.vh] = smooth(s.h, w.h, s.vh, tau * 1.35, dt);
      [s.roll, s.vr] = smooth(s.roll, w.roll, s.vr, 0.4, dt);
    }
    // a shot starts exactly where the last one left off, unless it is a hard cut
    if (f > 0 && cur > 0 && tracks[cur].x.length === 0 && !snapped) emit(cur - 1, t);
    emit(cur, t);
  }
  shots.forEach((shot, k) => {
    const T = tracks[k], last = T.x.length - 1;
    const first = Math.round((shot.start - scene.start) * fps);
    const t0 = scene.start + first / fps;
    const at = (i) => ({ x: T.x[i], y: T.y[i], h: T.h[i], roll: T.roll[i] });
    shot.camera = { from: at(0), to: at(last), ease: 'linear', track: { t0: round(t0), rate: fps, x: T.x, y: T.y, h: T.h, roll: T.roll } };
  });
}

// ---------------- the world ----------------
const FAR = { sun: 0.04, moon: 0.04, stars: 0.05, cloud: 0.14, gull: 0.3, mountain: 0.22, skyline: 0.34, dune: 0.4, sea: 0.45, windmill: 0.62, building: 0.74, house: 0.8, 'school-building': 0.8, tree: 0.86, pine: 0.86, cypress: 0.86, palm: 0.86 };
const NO_TILE = new Set(['sun', 'moon', 'stars', 'sofra', 'bowl', 'throne', 'judge-bench', 'chandelier']);
const FRONT = { exterior: ['flowers', 'grass'], interior: [] };

/** Gives every piece a depth, repeats the set wherever the camera goes past its edge, adds things passing close to the lens. */
export function dressWorld(scene, xmin, xmax, travel = xmax - xmin) {
  const bg = scene.background, place = bg.place === 'exterior' ? 'exterior' : 'interior';
  for (const p of bg.props) {
    if (p.depth !== undefined || p.object) continue;
    if (FAR[p.type]) p.depth = FAR[p.type];
    else if (place === 'interior' && p.y < -300 && p.layer !== 'front') p.depth = 0.93;
  }
  const widthOf = (p) => geometryOf(p).w * (p.s || 1);
  const tile = bg.props.filter((p) => !p.object && !NO_TILE.has(p.type) && p.layer !== 'front');
  const copies = [];
  const repeat = (list, period, L, R, tag) => {
    for (let k = -12; k <= 12; k++) {
      if (!k) continue;
      const dx = k * period;
      if (L + dx > xmax || R + dx < xmin) continue;
      for (const p of list) copies.push({ ...p, id: `${p.id}~${tag}${k}`, x: p.x + dx });
    }
  };
  // long pieces (a wall, a roof) continue edge to edge; the small ones repeat as a group
  const wide = tile.filter((p) => widthOf(p) >= 1400), small = tile.filter((p) => widthOf(p) < 1400);
  wide.forEach((p, i) => repeat([p], widthOf(p), p.x - widthOf(p) / 2, p.x + widthOf(p) / 2, `w${i}`));
  if (small.length) {
    const L = Math.min(...small.map((p) => p.x - widthOf(p) / 2)), R = Math.max(...small.map((p) => p.x + widthOf(p) / 2));
    repeat(small, Math.max(1500, R - L), L, R, 's');
  }
  // anything the designer placed by hand stays on top of the repeats
  bg.props.unshift(...copies);
  // only a camera that really travels has anything pass close to the lens
  const types = FRONT[place];
  if (travel > 900 && types.length && !bg.props.some((p) => p.layer === 'front' && p.depth)) {
    let i = 0;
    for (let x = xmin + 200; x < xmax; x += 1050, i++) {
      const j = hash32(`${scene.id}:${i}`);
      bg.props.push({ id: `${scene.id}-near${i}`, type: types[j % types.length], x: Math.round(x + (j % 300) - 150), y: 470, s: 1.5, layer: 'front', depth: 1.45 });
    }
  }
}

export { GESTURES };
