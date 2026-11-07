// Rhythm and coverage rules for a storyboard. Pure data checks — no rendering needed.
import { round } from '../lib/util.mjs';

export function lintStoryboard(sb, style, cfg) {
  const W = [];
  const D = cfg.director, fps = sb.video.fps;
  const shots = sb.shots;
  const durs = shots.map((s) => s.end - s.start);
  shots.forEach((s, i) => {
    const d = durs[i];
    if (d < D.minShot - 1e-6 && i !== shots.length - 1) W.push(`${s.id}: ${d.toFixed(2)} s is shorter than the minimum shot (${D.minShot} s)`);
    if (d > D.maxShot + 1.0 && s.type !== 'two') W.push(`${s.id}: ${d.toFixed(2)} s hold on a single — consider a reaction cut (max ${D.maxShot} s)`);
    const c = s.camera;
    if (c.from.h === c.to.h && c.from.x === c.to.x && c.from.y === c.to.y) W.push(`${s.id}: static camera (every hold should creep)`);
    const pxPerUnit = sb.video.height / c.from.h;
    const pan = (Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y) * pxPerUnit) / Math.max(1, d * fps);
    if (pan > style.camera.maxPanPxPerFrame + 0.01) W.push(`${s.id}: pans ${pan.toFixed(1)} px/frame (limit ${style.camera.maxPanPxPerFrame})`);
    const p = shots[i - 1];
    if (p && p.type === s.type && p.focus === s.focus && p.scene === s.scene) W.push(`${s.id}: same framing as ${p.id} (${s.type} on ${s.focus || 'group'})`);
  });
  // singles in a row
  let run = 0;
  for (const s of shots) { run = s.type === 'two' || s.type === 'wide' ? 0 : run + 1; if (run === 6) W.push(`${s.id}: six single shots in a row without a two-shot`); }
  // speaker on screen while talking
  let talk = 0, seen = 0;
  for (const l of sb.lines) {
    for (let t = l.start; t < l.end; t += 1 / fps) {
      talk++;
      const s = shots.find((x) => t >= x.start && t < x.end);
      if (s && (s.subjects.includes(l.speaker))) seen++;
    }
  }
  const speakerShare = talk ? seen / talk : 1;
  if (speakerShare < 0.6) W.push(`the speaker is on screen only ${(speakerShare * 100).toFixed(0)} % of the speaking time (aim for >= 60 %)`);
  // reactions lead their word
  const lead = style.motion.reactionLeadFrames ?? 4;
  for (const e of sb.events) {
    if (e.type !== 'expression' || !e.word) continue;
    const l = sb.lines.find((x) => x.words.some((w) => w.w.replace(/[^\p{L}\p{N}]/gu, '') === e.word && Math.abs(w.s - e.t) < 1));
    const w = l?.words.find((x) => x.w.replace(/[^\p{L}\p{N}]/gu, '') === e.word);
    if (w && (w.s - e.t) * fps < Math.min(1, lead)) W.push(`reaction of ${e.target} at ${e.t}s does not lead "${e.word}" (${((w.s - e.t) * fps).toFixed(1)} frames)`);
  }
  // captions readability
  const cap = sb.captions;
  if (cap && cap.mode !== 'none') {
    for (const it of cap.items) {
      const d = it.end - it.start;
      if (d * fps < 6) W.push(`caption "${it.text}" shows for only ${(d * fps).toFixed(0)} frames`);
      if (cap.mode === 'line' && it.text.length / Math.max(0.1, d) > 22) W.push(`caption "${it.text.slice(0, 30)}…" needs ${(it.text.length / d).toFixed(0)} chars/s (aim <= 20)`);
    }
  }
  const cuts = shots.length - 1;
  return {
    warnings: W,
    stats: {
      shots: shots.length,
      cuts,
      avgShot: durs.reduce((a, b) => a + b, 0) / Math.max(1, durs.length),
      minShot: round(Math.min(...durs), 2),
      maxShot: round(Math.max(...durs), 2),
      speakerOnScreen: round(speakerShare, 3),
      types: shots.reduce((m, s) => ((m[s.type] = (m[s.type] || 0) + 1), m), {}),
    },
  };
}
