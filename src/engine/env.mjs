// Render environment: everything renderFrame needs that is derived (not stored) — palette lookup,
// per-character event indexes, body builder registry. Built once per storyboard; pure data afterwards.
import * as paperCut from './bodies/paperCut.mjs';
import * as gummy from './bodies/gummy.mjs';
import * as lanky from './bodies/lanky.mjs';

export const BODIES = { 'paper-cut': paperCut, gummy, 'lanky-line': lanky };

export function createEnv(sb, style, { createCanvas, hooks = null } = {}) {
  const roles = style.palette.roles;
  const color = (c) => {
    if (!c) return roles.ink;
    if (c[0] === '#') return c;
    if (roles[c]) return roles[c];
    if (c === 'white') return '#FFFFFF';
    return roles.ink;
  };
  const by = (type) => {
    const m = {};
    for (const e of sb.events || []) if (e.type === type) (m[e.target] ||= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.t - b.t);
    return m;
  };
  const body = BODIES[style.character?.body] || BODIES['paper-cut'];
  const bodies = { ...BODIES, ...(hooks?.bodies || {}) };
  return {
    sb,
    style,
    hooks,
    W: sb.video.width,
    H: sb.video.height,
    fps: sb.video.fps,
    color,
    body: bodies[style.character?.body] || body,
    chars: Object.fromEntries(sb.characters.map((c) => [c.id, c])),
    scenes: Object.fromEntries(sb.scenes.map((s) => [s.id, s])),
    idx: {
      expr: by('expression'), gesture: by('gesture'), look: by('look'), posture: by('posture'), prop: by('prop'),
      fx: (sb.events || []).filter((e) => e.type === 'fx'), shake: (sb.events || []).filter((e) => e.type === 'shake'),
      punch: (sb.events || []).filter((e) => e.type === 'punch'), fade: (sb.events || []).filter((e) => e.type === 'fade'),
    },
    linesBy: (() => { const m = {}; for (const l of sb.lines) if (!l.voiceOver) (m[l.speaker] ||= []).push(l); return m; })(),
    createCanvas,
    cache: {},
  };
}
