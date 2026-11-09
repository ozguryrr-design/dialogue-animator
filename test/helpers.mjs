// Build a storyboard in memory (no audio, no files) for fast unit tests.
import { parseDialogueText } from '../src/project/parse.mjs';
import { autoCharacter } from '../src/project/cast.mjs';
import { estimateDuration, estimateWords, placeInBeats } from '../src/audio/align.mjs';
import { direct } from '../src/director/storyboard.mjs';
import { DEFAULTS, FORMATS } from '../src/project/config.mjs';
import { loadStyle } from '../src/style/load.mjs';

export const SAMPLE = `# Test
## Kitchen
Ada: Good morning! Is the tea ready? [happy]
Bo: (shrugs) Almost... but we are out of sugar, and the shop around the corner is closed until noon today.
Ada: What?! No sugar at all?
## Park
Bo: Relax. I brought cake! [smug]
Ada: (cheers) You are the best!
`;

export function timingFor(dialogue, rate = 4.6) {
  if (dialogue.beats?.length) {
    const r = placeInBeats(dialogue.lines, dialogue.beats, {}, { leadIn: 0.4, tail: 1, gap: 0.25, speechRate: rate });
    return { source: 'estimate + beats', estimated: true, duration: r.end, voice: null, lines: r.timed };
  }
  let t = 0.4;
  const lines = dialogue.lines.map((l, i) => {
    if (i) t += 0.4;
    const d = estimateDuration(l.words, rate);
    const out = { id: l.id, index: l.index, speaker: l.speaker, start: t, end: t + d, words: estimateWords(l.words, t, t + d), wordSource: 'estimate' };
    t += d;
    return out;
  });
  return { source: 'estimate', estimated: true, duration: +(t + 1).toFixed(3), voice: null, lines };
}

export function makeStoryboard({ text = SAMPLE, style = 'kesik-kagit', format = '9:16', captions = 'word' } = {}) {
  const dialogue = parseDialogueText(text);
  dialogue.title = dialogue.title || 'Test';
  const characters = dialogue.speakers.filter((s) => !s.narrator).map((s, i) => autoCharacter(s, i, dialogue.lines));
  const timing = timingFor(dialogue);
  const st = loadStyle(style);
  const [w, h] = FORMATS[format];
  const cfg = { ...DEFAULTS, captions, fps: 30, video: { width: w, height: h, fps: 30 } };
  return { sb: direct({ dialogue, characters, timing, envelope: null, style: st, cfg }), style: st, cfg, dialogue };
}
